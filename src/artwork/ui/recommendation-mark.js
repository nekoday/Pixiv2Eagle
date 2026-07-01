"use strict";

import { dbg, err, warn } from "../../tampermonkey/logger.js";
import { subscribe } from "../../tampermonkey/settings-api.js";
import { gmFetch } from "../../tampermonkey/request.js";
import {
    REC_ZONE_SELECTOR,
    REC_THUMBNAIL_LINK_SELECTOR,
    REC_USER_NAME_LINK_SELECTOR,
    REC_SIDEBAR_OTHER_WORKS_NAV,
} from "../../config/selectors/index.js";
import { insertSavedBadge } from "../../shared/marking/insert-badge.js";
import { resolveThumbnailAnchor } from "../../shared/marking/resolve-thumbnail-anchor.js";
import {
    resolveRecRoots,
    resolveRecommendationItems,
    waitForRecommendationItems,
} from "../../shared/marking/resolve-recommendation-items.js";
import { ensureEagleIndex } from "../../eagle/index-cache.js";
import { getAllEagleItemsInFolder } from "../../eagle/items.js";
import { getArtistInfoFromDOM, getArtistInfoFromArtwork } from "../artist-info.js";
import {
    applyAuthorFilter,
    clearFilterState,
    rescanZoneAuthorFilter,
} from "./recommendation-author-filter.js";
import {
    applySavedFilter,
    clearSavedFilterState,
    rescanZoneSavedFilter,
} from "./recommendation-saved-filter.js";
import { getFilterRecSavedMode } from "../../tampermonkey/setting.js";

const TYPE_FOLDER_DESCRIPTIONS = ["illustrations", "manga", "novels"];

const FALLBACK_SCAN_INTERVAL = 30000;
const PENDING_RETRY_INTERVAL = 200;
const PENDING_MAX_RETRIES = 10; // 10 × 200ms ≈ 2s 窗口
const LIFECYCLE_MS = 5 * 60 * 1000;
const MUTATION_DEBOUNCE_MS = 100;

const artistUrlCache = new Map();

// ---- 模块级生命周期状态（替代旧 window 定时器 / 单 observer） ----
let isRecAreaInitializing = false;
let currentRecUrl = "";
let recObservers = [];
let recIntersectionObserver = null;
let fallbackScanTimer = null;
let pendingTimer = null;
let lifecycleTimer = null;
let recActive = false;

let currentPageArtistUid = null;
let currentArtworkPid = null;
let recZoneRoot = null;
let settingsUnsub = null;

function getFilterContext() {
    return {
        currentPid: currentArtworkPid,
        currentPageArtistUid,
    };
}

async function resolveCurrentPageArtistUid(artworkPid) {
    const domInfo = getArtistInfoFromDOM();
    if (domInfo?.userId) {
        return String(domInfo.userId);
    }
    if (artworkPid) {
        const apiInfo = await getArtistInfoFromArtwork(artworkPid);
        if (apiInfo?.userId) {
            return String(apiInfo.userId);
        }
    }
    return null;
}

function onFilterSettingsChange() {
    if (!recZoneRoot) return;
    rescanZoneAuthorFilter(recZoneRoot, getFilterContext());
}

function onSavedFilterSettingsChange(processLi) {
    if (!recZoneRoot) return;
    rescanZoneSavedFilter(recZoneRoot, (li) => processLi(li));
}

function findFolderInTree(folders, id) {
    for (const folder of folders) {
        if (folder.id === id) return folder;
        if (folder.children) {
            const found = findFolderInTree(folder.children, id);
            if (found) return found;
        }
    }
    return null;
}

async function ensureArtistUrlSet(artistFolderId) {
    if (artistUrlCache.has(artistFolderId)) {
        return artistUrlCache.get(artistFolderId);
    }

    const promise = (async () => {
        const urlSet = new Set();

        const collectItems = async (folderId) => {
            const items = await getAllEagleItemsInFolder(folderId);
            for (const item of items) {
                if (item.url) urlSet.add(item.url);
            }
        };

        await collectItems(artistFolderId);

        try {
            const folderList = await gmFetch("http://localhost:41595/api/folder/list");
            if (folderList.status && Array.isArray(folderList.data)) {
                const artistFolder = findFolderInTree(folderList.data, artistFolderId);
                if (artistFolder?.children) {
                    for (const child of artistFolder.children) {
                        if (TYPE_FOLDER_DESCRIPTIONS.includes(child.description)) {
                            await collectItems(child.id);
                        }
                    }
                }
            }
        } catch (e) {
            warn("推荐区：拉取画师 items 失败:", e);
        }

        return urlSet;
    })();

    artistUrlCache.set(artistFolderId, promise);
    return promise;
}

function insertRecSavedBadge(target) {
    if (!target) return false;
    return insertSavedBadge(target, {
        zIndex: "2147483647",
        fontSize: "18px",
        padding: "2px 6px",
        large: true,
        ensureOverflowVisible: true,
    });
}

/**
 * @param {string} pid
 * @param {ParentNode} zoneRoot
 * @returns {HTMLElement | null}
 */
function findRecLiByPid(pid, zoneRoot) {
    if (!zoneRoot || !pid) return null;
    for (const link of zoneRoot.querySelectorAll('a[href*="/artworks/"]')) {
        const href = link.getAttribute("href") || "";
        const m = href.match(/\/artworks\/(\d+)/);
        if (m && m[1] === pid) {
            return link.closest("li");
        }
    }
    return null;
}

/**
 * @param {string} pid
 * @returns {HTMLAnchorElement | null}
 */
function findRecSidebarLinkByPid(pid) {
    if (!pid) return null;
    for (const a of document.querySelectorAll(REC_SIDEBAR_OTHER_WORKS_NAV)) {
        const href = a.getAttribute("href") || "";
        const m = href.match(/\/artworks\/(\d+)/);
        if (m && m[1] === pid) return a;
    }
    return null;
}

/**
 * 保存事件增量更新：在推荐区 zone li 与侧栏 link 上按 pid 标记已保存。
 * @param {{ kind: string, id: string }} payload
 */
export function handleSavedEventForRecommendation(payload) {
    const { kind, id } = payload;
    if (kind !== "artwork" && kind !== "manga-chapter") return;
    if (!id) return;

    const roots = resolveRecRoots();
    const zoneRoot = recZoneRoot || roots.find((r) => r.matches(REC_ZONE_SELECTOR));

    const li = zoneRoot ? findRecLiByPid(id, zoneRoot) : null;
    if (li) {
        const target = resolveThumbnailAnchor(li, { context: "rec" });
        if (!target?.querySelector(".eagle-saved-badge")) {
            delete li.dataset.eagleChecked;
            insertRecSavedBadge(target);
            applySavedFilter(li, { isSaved: true });
            li.dataset.eagleChecked = "1";
        }
    }

    const sidebarLink = findRecSidebarLinkByPid(id);
    if (!sidebarLink) return;

    const sidebarTarget = resolveThumbnailAnchor(sidebarLink, { context: "sidebar" });
    if (sidebarTarget?.querySelector(".eagle-saved-badge")) return;

    delete sidebarLink.dataset.eagleChecked;
    insertRecSavedBadge(sidebarTarget);
    sidebarLink.dataset.eagleChecked = "1";
}

function cleanupRecMarking() {
    if (settingsUnsub) {
        settingsUnsub();
        settingsUnsub = null;
    }
    if (recZoneRoot) {
        recZoneRoot.querySelectorAll("li").forEach(clearFilterState);
        recZoneRoot.querySelectorAll("li").forEach(clearSavedFilterState);
        recZoneRoot = null;
    }
    currentPageArtistUid = null;
    currentArtworkPid = null;
    recObservers.forEach((obs) => obs.disconnect());
    recObservers = [];
    if (recIntersectionObserver) {
        recIntersectionObserver.disconnect();
        recIntersectionObserver = null;
    }
    if (fallbackScanTimer) {
        clearInterval(fallbackScanTimer);
        fallbackScanTimer = null;
    }
    if (pendingTimer) {
        clearInterval(pendingTimer);
        pendingTimer = null;
    }
    if (lifecycleTimer) {
        clearTimeout(lifecycleTimer);
        lifecycleTimer = null;
    }
    recActive = false;
}

// 在推荐区域标记已保存作品（双 root scoped 增量模式）
export async function markSavedInRecommendationArea() {
    if (isRecAreaInitializing) return;

    // 同 URL 且监控活跃且索引存在 → 早退（保留原 currentRecUrl 语义）
    if (currentRecUrl === location.href && recActive && window.__pixiv2eagle_globalEagleIndex) {
        return;
    }

    isRecAreaInitializing = true;
    const initUrl = location.href;
    currentRecUrl = initUrl;

    try {
        // ---- 路由切换：清理上一页状态 ----
        artistUrlCache.clear();
        cleanupRecMarking();
        resolveRecommendationItems().forEach((li) => {
            clearFilterState(li);
            clearSavedFilterState(li);
            delete li.dataset.eagleChecked;
            li.querySelector(".eagle-saved-badge")?.remove();
        });
        document.querySelectorAll(REC_SIDEBAR_OTHER_WORKS_NAV).forEach((a) => {
            delete a.dataset.eagleChecked;
            a.querySelector(".eagle-saved-badge")?.remove();
        });

        dbg("开始监控推荐区域 (双 root 增量版)...");

        const isStale = () => location.href !== initUrl;

        await ensureEagleIndex();
        if (isStale()) return;

        const currentPid = location.pathname.match(/\/artworks\/(\d+)/)?.[1];
        currentArtworkPid = currentPid ?? null;
        currentPageArtistUid = null;

        resolveCurrentPageArtistUid(currentArtworkPid).then((uid) => {
            if (isStale()) return;
            currentPageArtistUid = uid;
            dbg(`推荐区：当前页画师 uid = ${uid ?? "(未解析)"}`);
            if (recZoneRoot) {
                rescanZoneAuthorFilter(recZoneRoot, getFilterContext());
            }
        });

        const pending = new Map(); // node -> { count, kind: 'zone'|'sidebar' }

        let zoneUl = null;
        let sidebarNav = null;

        const enqueuePending = (node, kind) => {
            if (pending.has(node)) return;
            pending.set(node, { count: 0, kind });
        };

        const insertBadge = insertRecSavedBadge;

        // ---- zone：单 li 处理 ----
        const processLi = async (li) => {
            applyAuthorFilter(li, getFilterContext());

            if (li.dataset.p2eAuthorFiltered === "1") {
                pending.delete(li);
                return;
            }

            if (li.dataset.eagleChecked) {
                pending.delete(li);
                return;
            }

            const titleLink =
                li.querySelector(REC_THUMBNAIL_LINK_SELECTOR) ||
                li.querySelector('a[href*="/artworks/"]');
            if (!titleLink) {
                enqueuePending(li, "zone");
                return;
            }
            const pidMatch = titleLink.getAttribute("href").match(/\/artworks\/(\d+)/);
            if (!pidMatch) {
                enqueuePending(li, "zone");
                return;
            }
            const pid = pidMatch[1];

            if (currentPid && pid === currentPid) {
                clearSavedFilterState(li);
                li.dataset.eagleChecked = "1";
                pending.delete(li);
                return;
            }

            const artistLink =
                li.querySelector(REC_USER_NAME_LINK_SELECTOR) ||
                li.querySelector('a[href*="/users/"]');
            if (!artistLink) {
                enqueuePending(li, "zone");
                return;
            }
            const uidMatch = artistLink.getAttribute("href").match(/\/users\/(\d+)/);
            if (!uidMatch) {
                enqueuePending(li, "zone");
                return;
            }
            const uid = uidMatch[1];

            if (!window.__pixiv2eagle_globalEagleIndex) {
                enqueuePending(li, "zone");
                return;
            }

            const artistData = window.__pixiv2eagle_globalEagleIndex.get(uid);
            let isSaved = false;

            if (!artistData) {
                dbg(`作品 ${pid}: 画师 ${uid} 不在 Eagle 中 -> 未保存`);
                applySavedFilter(li, { isSaved: false });
                li.dataset.eagleChecked = "1";
                pending.delete(li);
                return;
            }

            const target = resolveThumbnailAnchor(li, { context: "rec" });
            const savedMode = getFilterRecSavedMode();

            if (artistData.pids.has(pid)) {
                isSaved = true;
            } else {
                try {
                    const urlSet = await ensureArtistUrlSet(artistData.id);
                    if (isStale()) return;
                    isSaved = urlSet.has(`https://www.pixiv.net/artworks/${pid}`);
                } catch (e) {
                    warn(`推荐区：作品 ${pid} url 回退查询失败:`, e);
                    enqueuePending(li, "zone");
                    return;
                }
            }

            applyAuthorFilter(li, getFilterContext());
            if (li.dataset.p2eAuthorFiltered === "1") {
                pending.delete(li);
                return;
            }

            applySavedFilter(li, { isSaved });

            if (isSaved && savedMode !== "hide") {
                if (insertBadge(target)) {
                    dbg(`作品 ${pid}: 已保存 -> 标记成功 (mode=${savedMode})`);
                } else {
                    enqueuePending(li, "zone");
                    return;
                }
            } else if (!isSaved) {
                dbg(`作品 ${pid}: 画师 ${uid} 在 Eagle 中，但作品未保存`);
            }

            li.dataset.eagleChecked = "1";
            pending.delete(li);
        };

        // ---- sidebar：单 link 处理 ----
        const resolveSidebarUid = (a) => {
            const container = a.closest("li") || a.parentElement;
            const m1 = container
                ?.querySelector('a[href*="/users/"]')
                ?.getAttribute("href")
                ?.match(/\/users\/(\d+)/);
            if (m1) return m1[1];
            const m2 = sidebarNav
                ?.querySelector('a[href*="/users/"]')
                ?.getAttribute("href")
                ?.match(/\/users\/(\d+)/);
            return m2 ? m2[1] : null;
        };

        const processSidebarLink = async (a) => {
            if (a.dataset.eagleChecked) {
                pending.delete(a);
                return;
            }
            const pidMatch = a.getAttribute("href")?.match(/\/artworks\/(\d+)/);
            if (!pidMatch) {
                pending.delete(a);
                return;
            }
            const pid = pidMatch[1];

            if (currentPid && pid === currentPid) {
                a.dataset.eagleChecked = "1";
                pending.delete(a);
                return;
            }

            const uid = resolveSidebarUid(a);
            if (!uid) {
                enqueuePending(a, "sidebar");
                return;
            }

            if (!window.__pixiv2eagle_globalEagleIndex) {
                enqueuePending(a, "sidebar");
                return;
            }

            const artistData = window.__pixiv2eagle_globalEagleIndex.get(uid);
            if (!artistData) {
                a.dataset.eagleChecked = "1";
                pending.delete(a);
                return;
            }

            const target = resolveThumbnailAnchor(a, { context: "sidebar" });

            if (artistData.pids.has(pid)) {
                if (insertBadge(target)) {
                    a.dataset.eagleChecked = "1";
                    pending.delete(a);
                    dbg(`侧栏作品 ${pid}: 已保存 (画师 ${uid}, folderDesc) -> 标记成功`);
                } else {
                    enqueuePending(a, "sidebar");
                }
                return;
            }

            try {
                const urlSet = await ensureArtistUrlSet(artistData.id);
                if (isStale()) return;
                if (urlSet.has(`https://www.pixiv.net/artworks/${pid}`)) {
                    if (insertBadge(target)) {
                        a.dataset.eagleChecked = "1";
                        pending.delete(a);
                        dbg(`侧栏作品 ${pid}: 已保存 (画师 ${uid}, itemUrl) -> 标记成功`);
                    } else {
                        enqueuePending(a, "sidebar");
                    }
                    return;
                }
            } catch (e) {
                warn(`推荐区(侧栏)：作品 ${pid} url 查询失败:`, e);
                enqueuePending(a, "sidebar");
                return;
            }

            a.dataset.eagleChecked = "1";
            pending.delete(a);
        };

        const processNode = (node, kind) =>
            kind === "zone" ? processLi(node) : processSidebarLink(node);

        // ---- 从 mutation.addedNodes 收集候选节点 ----
        const collectZoneLis = (addedNodes, sink) => {
            for (const node of addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.tagName === "LI") sink.add(node);
                node.querySelectorAll?.("li").forEach((li) => sink.add(li));
            }
        };
        const collectSidebarLinks = (addedNodes, sink) => {
            for (const node of addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.matches?.('a[href*="/artworks/"]')) sink.add(node);
                node.querySelectorAll?.('a[href*="/artworks/"]').forEach((a) => sink.add(a));
            }
        };

        // ---- per-root scoped Observer（debounce 合并同帧 mutation） ----
        const observeRoot = (root, kind) => {
            let debounceTimer = null;
            const batch = new Set();
            const obs = new MutationObserver((mutations) => {
                for (const mut of mutations) {
                    if (mut.addedNodes.length === 0) continue;
                    if (kind === "zone") collectZoneLis(mut.addedNodes, batch);
                    else collectSidebarLinks(mut.addedNodes, batch);
                }
                if (batch.size === 0) return;
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    if (isStale()) return;
                    const nodes = Array.from(batch);
                    batch.clear();
                    dbg(`推荐区(${kind})：增量批 ${nodes.length} 项`);
                    nodes.forEach((n) => processNode(n, kind));
                }, MUTATION_DEBOUNCE_MS);
            });
            obs.observe(root, { childList: true, subtree: true });
            recObservers.push(obs);
        };

        // ---- zone 首扫（IntersectionObserver 延迟到进视口） ----
        const initialScanZone = (zoneRoot) => {
            zoneRoot.querySelectorAll("li").forEach((li) => processLi(li));
        };
        const observeZoneVisibility = (zoneRoot) => {
            recIntersectionObserver = new IntersectionObserver((entries, io) => {
                for (const entry of entries) {
                    if (entry.intersectionRatio > 0) {
                        io.unobserve(entry.target);
                        if (recIntersectionObserver) {
                            recIntersectionObserver.disconnect();
                            recIntersectionObserver = null;
                        }
                        if (!isStale()) {
                            dbg("推荐区：zone 进入视口，首扫");
                            initialScanZone(zoneRoot);
                        }
                        break;
                    }
                }
            });
            recIntersectionObserver.observe(zoneRoot);
        };

        // ---- sidebar 首扫（首屏即在 DOM，无需 IntersectionObserver） ----
        const scanSidebar = (nav) => {
            nav.querySelectorAll('a[href*="/artworks/"]').forEach((a) => processSidebarLink(a));
        };

        // ---- 30s 兜底 diff（仅处理未 eagleChecked 项；不再每轮清全量） ----
        const fallbackScan = async () => {
            if (isStale()) return;
            if (!window.__pixiv2eagle_globalEagleIndex) {
                artistUrlCache.clear();
                await ensureEagleIndex();
                if (isStale()) return;
                if (!window.__pixiv2eagle_globalEagleIndex) return;
            }
            resolveRecommendationItems().forEach((li) => {
                applyAuthorFilter(li, getFilterContext());
                if (!li.dataset.eagleChecked) processLi(li);
            });
            document.querySelectorAll(REC_SIDEBAR_OTHER_WORKS_NAV).forEach((a) => {
                if (!a.dataset.eagleChecked) processSidebarLink(a);
            });
        };

        // ---- pending 限流重试（单节点 10 次封顶，超限移出，不写 eagleChecked） ----
        const pendingRetry = () => {
            if (isStale()) return;
            if (pending.size === 0) return;
            for (const [node, meta] of Array.from(pending.entries())) {
                if (meta.count >= PENDING_MAX_RETRIES) {
                    warn(`推荐区：节点 pending 超 ${PENDING_MAX_RETRIES} 次，移出重试 (${meta.kind})`);
                    pending.delete(node);
                    continue;
                }
                meta.count += 1;
                processNode(node, meta.kind);
            }
        };

        // ---- 解析 root 并绑定 ----
        const bindRoots = (roots) => {
            for (const root of roots) {
                if (root.matches(REC_ZONE_SELECTOR)) {
                    zoneUl = root;
                    recZoneRoot = root;
                } else {
                    sidebarNav = root;
                }
            }
            if (zoneUl) {
                observeRoot(zoneUl, "zone");
                observeZoneVisibility(zoneUl);
            }
            if (sidebarNav) {
                observeRoot(sidebarNav, "sidebar");
                scanSidebar(sidebarNav);
            }
        };

        let roots = resolveRecRoots();

        // root 为空：单次等待后重试 resolve（不 fallback body）
        if (roots.length === 0) {
            warn("推荐区：未找到 zone / sidebar root，等待后重试一次");
            await waitForRecommendationItems({ timeout: 10000 });
            if (isStale()) return;
            roots = resolveRecRoots();
        }
        if (roots.length === 0) {
            warn("推荐区：重试后仍无 root，放弃本次（依赖下次路由触发）");
            return;
        }

        if (isStale()) return;
        bindRoots(roots);

        if (settingsUnsub) {
            settingsUnsub();
        }
        function onRecommendationSettingsChange() {
            onFilterSettingsChange();
            onSavedFilterSettingsChange(processLi);
        }
        settingsUnsub = subscribe(onRecommendationSettingsChange);
        if (currentPageArtistUid && recZoneRoot) {
            rescanZoneAuthorFilter(recZoneRoot, getFilterContext());
        }

        pendingTimer = setInterval(pendingRetry, PENDING_RETRY_INTERVAL);
        fallbackScanTimer = setInterval(fallbackScan, FALLBACK_SCAN_INTERVAL);
        lifecycleTimer = setTimeout(() => {
            dbg("推荐区：5min 生命周期到，断开监控");
            cleanupRecMarking();
        }, LIFECYCLE_MS);
        recActive = true;
    } catch (error) {
        err("推荐区域监控出错:", error);
    } finally {
        isRecAreaInitializing = false;
    }
}
