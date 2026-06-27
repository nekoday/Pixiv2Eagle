"use strict";

import { dbg, err } from "../../Tampermonkey/logger.js";
import {
    REC_SECTION_SELECTOR,
    REC_CONTAINER_SELECTOR,
    REC_WORK_LINK_SELECTOR,
    REC_ARTIST_LINK_SELECTOR,
    REC_THUMBNAIL_SELECTOR,
    REC_THUMBNAIL_FALLBACK_SELECTOR,
} from "../../config/selectors/index.js";
import { insertSavedBadge } from "../../shared/marking/insert-badge.js";
import { ensureEagleIndex } from "../../eagle/index-cache.js";

let currentRecObserver = null;
let isRecAreaInitializing = false;
let currentRecUrl = "";

// 在推荐区域标记已保存作品
export async function markSavedInRecommendationArea() {
    if (isRecAreaInitializing) return;

    if (currentRecUrl === location.href && currentRecObserver) {
        return;
    }

    isRecAreaInitializing = true;
    currentRecUrl = location.href;

    try {
        if (currentRecObserver) {
            currentRecObserver.disconnect();
            currentRecObserver = null;
        }
        if (window.recScanTimer) {
            clearInterval(window.recScanTimer);
            window.recScanTimer = null;
        }
        if (window.recPendingTimer) {
            clearInterval(window.recPendingTimer);
            window.recPendingTimer = null;
        }

        dbg("开始监控推荐区域 (全局索引版)...");

        ensureEagleIndex();

        const pendingLis = new Set();

        const processLi = (li) => {
            if (li.dataset.eagleChecked) {
                pendingLis.delete(li);
                return;
            }

            let titleLink = li.querySelector(REC_WORK_LINK_SELECTOR);
            if (!titleLink) titleLink = li.querySelector('a[href*="/artworks/"]');

            if (!titleLink) {
                pendingLis.add(li);
                return;
            }
            const pidMatch = titleLink.getAttribute("href").match(/\/artworks\/(\d+)/);
            if (!pidMatch) {
                pendingLis.add(li);
                return;
            }
            const pid = pidMatch[1];

            let artistLink = li.querySelector(REC_ARTIST_LINK_SELECTOR);
            if (!artistLink) artistLink = li.querySelector('a[href*="/users/"]');

            if (!artistLink) {
                pendingLis.add(li);
                return;
            }
            const uidMatch = artistLink.getAttribute("href").match(/\/users\/(\d+)/);
            if (!uidMatch) {
                pendingLis.add(li);
                return;
            }
            const uid = uidMatch[1];

            if (!window.__pixiv2eagle_globalEagleIndex) {
                pendingLis.add(li);
                return;
            }

            const artistData = window.__pixiv2eagle_globalEagleIndex.get(uid);

            if (!artistData) {
                dbg(`作品 ${pid}: 画师 ${uid} 不在 Eagle 中 -> 未保存`);
                li.dataset.eagleChecked = "1";
                pendingLis.delete(li);
                return;
            }

            if (artistData.pids.has(pid)) {
                const success = addBadge(li, pid);
                if (success) {
                    li.dataset.eagleChecked = "1";
                    pendingLis.delete(li);
                    dbg(`作品 ${pid}: 已保存 (画师 ${uid}) -> 标记成功`);
                } else {
                    dbg(`作品 ${pid}: 已保存 (画师 ${uid}) -> 标记失败 (找不到容器)，加入重试`);
                    pendingLis.add(li);
                }
            } else {
                dbg(`作品 ${pid}: 画师 ${uid} 在 Eagle 中，但作品未保存`);
                li.dataset.eagleChecked = "1";
                pendingLis.delete(li);
            }
        };

        const addBadge = (li, pid) => {
            let target = li.querySelector(REC_THUMBNAIL_SELECTOR);
            if (!target) target = li.querySelector("div.sc-f44a0b30-9");

            if (!target) target = li.querySelector(REC_THUMBNAIL_FALLBACK_SELECTOR);
            if (!target) target = li.querySelector("div.sc-fab8f26d-3");

            if (!target) {
                const img = li.querySelector("img");
                if (img) target = img.parentElement;
            }

            if (!target) return false;

            return insertSavedBadge(target);
        };

        const scan = () => {
            if (!window.__pixiv2eagle_globalEagleIndex) return;

            let lis = [];

            const containers = document.querySelectorAll(`${REC_SECTION_SELECTOR}, ${REC_CONTAINER_SELECTOR}`);
            if (containers.length > 0) {
                containers.forEach((container) => {
                    container.querySelectorAll("li").forEach((li) => lis.push(li));
                });
            }

            if (!lis || lis.length === 0) {
                const links = document.querySelectorAll(REC_WORK_LINK_SELECTOR);
                if (links.length > 0) {
                    const liSet = new Set();
                    links.forEach((a) => {
                        const li = a.closest("li");
                        if (li) liSet.add(li);
                    });
                    lis = Array.from(liSet);
                }
            }

            if (lis.length > 0) {
                lis.forEach(processLi);
            }
        };

        const observer = new MutationObserver((mutations) => {
            let shouldScan = false;
            for (const mut of mutations) {
                if (mut.addedNodes.length > 0) {
                    shouldScan = true;
                    break;
                }
            }
            if (shouldScan) {
                dbg("推荐区域检测到新内容，触发扫描...");
                scan();
            }
        });

        const targetRoot = document.querySelector("main") || document.body;
        observer.observe(targetRoot, { childList: true, subtree: true });
        currentRecObserver = observer;

        window.recScanTimer = setInterval(scan, 2000);

        window.recPendingTimer = setInterval(() => {
            if (pendingLis.size > 0) {
                const items = Array.from(pendingLis);
                items.forEach(processLi);
            }
        }, 200);

        scan();
    } catch (error) {
        err("推荐区域监控出错:", error);
    } finally {
        isRecAreaInitializing = false;
    }
}
