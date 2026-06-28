"use strict";

import { getFolderId, getDebugMode } from "../tampermonkey/setting.js";
import { dbg, err } from "../tampermonkey/logger.js";
import { waitForElement } from "../ui/dom.js";
import { insertSavedBadge } from "../shared/marking/insert-badge.js";
import { findArtistFolder } from "../eagle/artist.js";
import { getAllEagleItemsInFolder } from "../eagle/items.js";
import { enrichMarkingContextForMangaSeriesPage } from "../manga/series/marking.js";
import {
    LIST_CONTAINER_SELECTOR,
    SERIES_PAGE_LIST_SELECTOR,
    THUMBNAIL_CONTAINER_SELECTOR,
} from "../config/selectors/index.js";

let markSavedDebounceTimer = null;
let currentGalleryObserver = null;

// 在画师作品列表页面标注已保存的作品（在作品标题前添加 ✅）
export async function markSavedInArtistList() {
    // 清理旧的 Observer，防止重复监听
    if (currentGalleryObserver) {
        currentGalleryObserver.disconnect();
        currentGalleryObserver = null;
    }

    // 更稳健的实现：等待作品链接加载，支持动态添加（滚动加载），并在 debug 模式下打印日志
    function log(...args) {
        dbg("markSavedInArtistList:", ...args);
    }

    dbg("markSavedInArtistList 函数已执行，当前URL:", location.pathname, "调试模式:", getDebugMode());

    try {
        // 仅在用户的常见画师列表或系列页面上运行
        if (
            !location.pathname.includes("/illustrations") &&
            !location.pathname.includes("/manga") &&
            !location.pathname.includes("/series/") &&
            !location.pathname.includes("/artworks")
        ) {
            log("当前页面非 artist illustrations/manga/series/artworks 页面，跳过");
            return;
        }

        log("当前页面匹配条件，开始处理");

        // 确定搜索范围与列表容器
        let listContainer = null;

        // 1. 系列页面
        if (location.pathname.includes("/series/")) {
            const selector = SERIES_PAGE_LIST_SELECTOR;
            log("系列页面：尝试定位列表容器", selector);
            // 尝试等待容器出现（最多 5 秒，避免过久阻塞）
            listContainer = await new Promise((resolve) => {
                const el = document.querySelector(selector);
                if (el) return resolve(el);
                const obs = new MutationObserver(() => {
                    const found = document.querySelector(selector);
                    if (found) {
                        obs.disconnect();
                        resolve(found);
                    }
                });
                obs.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => {
                    obs.disconnect();
                    resolve(null);
                }, 5000);
            });
        }
        // 2. 插画/漫画页面 (以及用户主页可能的列表)
        else {
            // 用户提供的选择器: div.sc-bf8cea3f-0.dKbaFf
            const selector = LIST_CONTAINER_SELECTOR;
            log("插画/漫画页面：尝试定位列表容器", selector);
            listContainer = await waitForElement(selector, 5000);
        }

        const anchorMap = {};

        if (listContainer) {
            const lis = listContainer.querySelectorAll("li");
            log(`在列表容器中找到 ${lis.length} 个作品项`);

            for (const li of lis) {
                // 查找作品链接提取 PID
                // 注意：有时一个 li 可能包含多个链接，通常取第一个指向 artworks 的
                const link = li.querySelector('a[href*="/artworks/"]');
                if (!link) continue;

                const href = link.getAttribute("href");
                const m = href.match(/\/artworks\/(\d+)/);
                if (!m) continue;

                const pid = m[1];

                // 查找目标缩略图容器 (标记插入点)
                // 优先匹配带 radius="4" 的 div.sc-f44a0b30-9.cvPXKv
                let target = li.querySelector(THUMBNAIL_CONTAINER_SELECTOR);
                if (!target) target = li.querySelector("div.sc-f44a0b30-9");

                // 备选：如果找不到特定 class，尝试找图片容器
                if (!target) {
                    const img = li.querySelector('img[src*="i.pximg.net"]');
                    if (img) {
                        // 通常图片被包裹在 picture > div 或直接在 div 中
                        // 我们希望找到那个有圆角和 overflow 的容器
                        target = img.closest('div[radius="4"]') || img.parentElement;
                    }
                }

                if (target) {
                    anchorMap[pid] = target;
                }
            }
        } else {
            log("未找到列表容器，跳过检测");
            return;
        }

        const artworkIds = Object.keys(anchorMap);
        if (artworkIds.length === 0) {
            log("未解析到任何 artwork id");
            return;
        }

        log("检测到", artworkIds.length, "个作品链接/目标容器");
        log("解析到 artworkIds:", artworkIds.slice(0, 5).join(","), artworkIds.length > 5 ? "..." : "");

        // 获取画师 ID - 支持 /user/{id} 和 /users/{id} 两种格式
        let artistMatch = location.pathname.match(/^\/users\/(\d+)/);
        if (!artistMatch) {
            artistMatch = location.pathname.match(/^\/user\/(\d+)/);
        }
        const artistId = artistMatch ? artistMatch[1] : null;
        if (!artistId) {
            log("无法从 URL 解析 artistId，URL:", location.pathname);
            return;
        }

        log("解析到 artistId:", artistId);

        const pixivFolderId = getFolderId();
        const artistFolder = await findArtistFolder(pixivFolderId, artistId);
        if (!artistFolder) {
            log("未找到对应的画师文件夹，跳过标注（pixivFolderId:", pixivFolderId, "）");
            return;
        }

        log("找到画师文件夹", artistFolder.id, "名称:", artistFolder.name, "开始拉取 items");
        const items = await getAllEagleItemsInFolder(artistFolder.id);

        // 如果开启了按类型保存，还需要拉取类型文件夹中的 items
        if (artistFolder.children) {
            const typeFolders = artistFolder.children.filter((c) =>
                ["illustrations", "manga", "novels"].includes(c.description)
            );
            for (const tf of typeFolders) {
                const typeItems = await getAllEagleItemsInFolder(tf.id);
                if (typeItems && typeItems.length) {
                    items.push(...typeItems);
                }
            }
        }

        const urlSet = new Set((items || []).map((it) => it.url));
        log("画师文件夹(含类型子文件夹)中 items 数量:", items ? items.length : 0);

        // 依据规则：
        // - 画师文件夹的 description 中含有 `pid = {artistId}` 用于识别画师（见 findArtistFolder）
        // - 单个作品的子文件夹的 description 等于作品 ID（作品 pid）
        // 因此除了比对 item.url，还需要检查 artistFolder 及其子文件夹的 description 是否等于 artworkId
        const folderDescSet = new Set();
        const folderDescMap = {}; // desc -> folderId
        (function collectFolderDescriptions(folder) {
            if (!folder || !folder.children) return;
            for (const child of folder.children) {
                const desc = (child.description || "").trim();
                if (desc) {
                    folderDescSet.add(desc);
                    folderDescMap[desc] = child.id;
                }
                if (child.children && child.children.length) collectFolderDescriptions(child);
            }
        })(artistFolder);
        log("已收集到的子文件夹描述数量:", folderDescSet.size);

        // 如果是系列页面，优先查找系列文件夹并在该文件夹下递归寻找 item/url 与子文件夹描述（备注为 pid）
        if (location.pathname.includes("/series/")) {
            await enrichMarkingContextForMangaSeriesPage({
                pixivFolderId,
                artistId,
                urlSet,
                folderDescSet,
                folderDescMap,
                log,
            });
        }

        // 插入标记的函数：将勾号浮动到作品卡片容器左下角（优先使用容器类名: sc-4822cddd-0 eCgTWT），
        // 同时支持系列缩略图容器：sc-e83d358-1（包含 sc-f44a0b30-9 cvPXKv）
        // 插入标记的函数：直接在指定的容器中插入勾号
        const insertBadgeToContainer = (container, matchInfo = {}) => {
            if (
                insertSavedBadge(container, {
                    zIndex: "2147483647",
                    fontSize: "18px",
                    padding: "2px 6px",
                    large: true,
                    markContainer: true,
                    ensureOverflowVisible: true,
                })
            ) {
                log("徽章已插入:", matchInfo.artworkId);
            }
        };

        // 首次批量标注
        log("开始首次批量标注，artworkIds:", artworkIds.length, "个");
        for (const id of artworkIds) {
            const target = anchorMap[id];
            // 标记为已检查，防止重复处理（无论是否匹配）
            if (target.dataset.eagleChecked === "1") continue;
            target.dataset.eagleChecked = "1";

            const artworkUrl = `https://www.pixiv.net/artworks/${id}`;
            if (urlSet.has(artworkUrl)) {
                log("作品", id, "匹配 (itemUrl)");
                insertBadgeToContainer(target, { artworkId: id, artworkUrl, matchedBy: "itemUrl" });
            } else if (folderDescSet.has(String(id))) {
                log("作品", id, "匹配 (folderDesc)");
                insertBadgeToContainer(target, { artworkId: id, artworkUrl, matchedBy: "folderDesc" });
            } else {
                log("未匹配作品:", id);
            }
        }

        // 监听后续动态添加的作品节点
        currentGalleryObserver = new MutationObserver((mutations) => {
            let shouldScan = false;
            for (const mut of mutations) {
                if (mut.addedNodes.length > 0) {
                    shouldScan = true;
                    break;
                }
            }

            if (shouldScan && listContainer) {
                const lis = listContainer.querySelectorAll("li");
                for (const li of lis) {
                    // 查找目标容器
                    let target = li.querySelector("div.sc-f44a0b30-9.cvPXKv");
                    if (!target) target = li.querySelector("div.sc-f44a0b30-9");

                    // 如果已经检查过，跳过
                    if (target && target.dataset.eagleChecked === "1") continue;

                    // 提取 PID
                    const link = li.querySelector('a[href*="/artworks/"]');
                    if (!link) continue;
                    const m = link.getAttribute("href").match(/\/artworks\/(\d+)/);
                    if (!m) continue;
                    const pid = m[1];

                    if (target) {
                        target.dataset.eagleChecked = "1"; // 标记为已检查

                        const artworkUrl = `https://www.pixiv.net/artworks/${pid}`;
                        if (urlSet.has(artworkUrl)) {
                            insertBadgeToContainer(target, { artworkId: pid, artworkUrl, matchedBy: "itemUrl" });
                        } else if (folderDescSet.has(String(pid))) {
                            insertBadgeToContainer(target, { artworkId: pid, artworkUrl, matchedBy: "folderDesc" });
                        }
                    }
                }
            }
        });

        // 观察 listContainer 或 body
        const observeTarget = listContainer || document.body;
        currentGalleryObserver.observe(observeTarget, { childList: true, subtree: true });

        // 5 分钟后断开监听以避免长期占用
        setTimeout(() => {
            if (currentGalleryObserver) currentGalleryObserver.disconnect();
        }, 5 * 60 * 1000);
    } catch (error) {
        err("标注画师作品保存状态失败:", error);
    }
}

export async function debouncedMarkSavedInArtistList() {
    if (markSavedDebounceTimer) clearTimeout(markSavedDebounceTimer);
    markSavedDebounceTimer = setTimeout(() => {
        markSavedInArtistList();
    }, 300);
}
