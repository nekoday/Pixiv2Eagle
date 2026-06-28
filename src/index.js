"use strict";

import {
    SETTING_KEYS,
    getFolderId,
    forceRefreshEagleIndex,
} from "./Tampermonkey/setting.js";
import { registerMenuCommands } from "./Tampermonkey/menu.js";
import { dbg, err } from "./Tampermonkey/logger.js";
import { waitForElement } from "./ui/dom.js";
import { debouncedMarkSavedInArtistList } from "./artist-list/marking.js";
import { createMonitorConfig } from "./config/monitor.js";
import { observeUrlChanges } from "./routing/observe-url.js";
import { handlePageChange } from "./routing/handle-page.js";
import {
    findArtistFolder,
    setArtistMatcher,
} from "./eagle/artist.js";
import { findSeriesFolderInArtist } from "./eagle/items.js";
import { ensureEagleIndex } from "./eagle/index-cache.js";
import { addButton } from "./artwork/ui/save-button.js";
import { markSavedInRecommendationArea } from "./artwork/ui/recommendation-mark.js";
import { addNovelButton } from "./novel/ui/save-button.js";
import {
    NOVEL_SERIES_LIST_SELECTOR,
    NOVEL_CHAPTER_LINK_SELECTOR,
    NOVEL_CHAPTER_BADGE_CONTAINER_SELECTOR,
    NOVEL_CHAPTER_REF_BUTTON_SELECTOR,
    NOVEL_AUTHOR_CONTAINER_SELECTOR,
} from "./config/selectors/index.js";

void SETTING_KEYS;

registerMenuCommands({
    forceRefreshEagleIndex,
    setArtistMatcher,
});

async function markSavedInNovelSeries() {
    const listContainer = await waitForElement(NOVEL_SERIES_LIST_SELECTOR);
    if (!listContainer) return;

    const seriesIdMatch = location.pathname.match(/\/novel\/series\/(\d+)/);
    const seriesId = seriesIdMatch ? seriesIdMatch[1] : null;
    if (!seriesId) return;

    const authorContainer = document.querySelector(NOVEL_AUTHOR_CONTAINER_SELECTOR);
    if (!authorContainer) return;

    const authorId = authorContainer.getAttribute("data-gtm-value") || authorContainer.getAttribute("data-gtm-user-id");
    if (!authorId) return;

    const pixivFolderId = getFolderId();
    const artistFolder = await findArtistFolder(pixivFolderId, authorId);
    if (!artistFolder) return;

    let seriesFolder = findSeriesFolderInArtist(artistFolder, authorId, seriesId);

    if (!seriesFolder && artistFolder.children) {
        const novelFolder = artistFolder.children.find((c) => c.description === "novels");
        if (novelFolder) {
            seriesFolder = findSeriesFolderInArtist(novelFolder, authorId, seriesId);
        }
    }

    if (!seriesFolder) return;

    const chapterFolders = seriesFolder.children || [];
    const savedChapterIds = new Set(chapterFolders.map((c) => c.description));

    const lis = listContainer.querySelectorAll("li");
    for (const li of lis) {
        const link = li.querySelector(NOVEL_CHAPTER_LINK_SELECTOR);
        if (!link) continue;

        const novelId = link.getAttribute("data-gtm-value");
        if (savedChapterIds.has(novelId)) {
            const targetContainer = li.querySelector(NOVEL_CHAPTER_BADGE_CONTAINER_SELECTOR);
            if (targetContainer) {
                if (targetContainer.querySelector(".eagle-saved-mark")) continue;

                const refButton = targetContainer.querySelector(NOVEL_CHAPTER_REF_BUTTON_SELECTOR);

                const mark = document.createElement("span");
                mark.className = "eagle-saved-mark";
                mark.textContent = "✅";
                mark.style.marginRight = "8px";
                mark.title = "已保存到 Eagle";

                if (refButton) {
                    targetContainer.insertBefore(mark, refButton);
                } else {
                    targetContainer.appendChild(mark);
                }
            }
        }
    }
}

const monitorConfig = createMonitorConfig({
    addButton,
    markSavedInRecommendationArea,
    addNovelButton,
    markSavedInNovelSeries,
    debouncedMarkSavedInArtistList,
});

try {
    dbg("脚本已启动，当前URL:", location.pathname);

    ensureEagleIndex();

    for (const monitorInfo of monitorConfig) {
        if (location.pathname.includes(monitorInfo.urlSuffix)) {
            dbg("初始加载时触发处理器:", monitorInfo.urlSuffix);
            handlePageChange(monitorInfo);
        }
    }
    observeUrlChanges(monitorConfig);
} catch (error) {
    err("脚本启动失败:", error);
}
