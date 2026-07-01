"use strict";

import {
    NOVEL_SERIES_LIST_SELECTOR,
    NOVEL_CHAPTER_LINK_SELECTOR,
    NOVEL_CHAPTER_BADGE_CONTAINER_SELECTOR,
    NOVEL_CHAPTER_REF_BUTTON_SELECTOR,
    NOVEL_AUTHOR_CONTAINER_SELECTOR,
} from "../../config/selectors/index.js";
import { getFolderId } from "../../tampermonkey/setting.js";
import { findArtistFolder } from "../../eagle/artist.js";
import { findNovelSeriesFolder } from "./find-series-folder.js";
import { waitForElement } from "../../ui/dom.js";

export async function markSavedInNovelSeries() {
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

    const seriesFolder = findNovelSeriesFolder(artistFolder, seriesId);
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
            if (!targetContainer) continue;
            insertNovelSeriesSavedMark(targetContainer);
        }
    }
}

function insertNovelSeriesSavedMark(targetContainer) {
    if (targetContainer.querySelector(".eagle-saved-mark")) return;

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

/**
 * 保存事件增量更新：小说系列页按 novelId 插入 ✅ 标记。
 * @param {{ kind: string, id: string }} payload
 */
export function handleSavedEventForNovelSeries(payload) {
    const { kind, id } = payload;
    if (kind !== "novel") return;
    if (!id) return;

    if (!location.pathname.match(/\/novel\/series\/(\d+)/)) return;

    const listContainer = document.querySelector(NOVEL_SERIES_LIST_SELECTOR);
    if (!listContainer) return;

    const lis = listContainer.querySelectorAll("li");
    for (const li of lis) {
        const link = li.querySelector(NOVEL_CHAPTER_LINK_SELECTOR);
        if (!link) continue;

        const novelId = link.getAttribute("data-gtm-value");
        if (novelId !== id) continue;

        const targetContainer = li.querySelector(NOVEL_CHAPTER_BADGE_CONTAINER_SELECTOR);
        if (!targetContainer) return;

        insertNovelSeriesSavedMark(targetContainer);
        return;
    }
}
