"use strict";

import { dbg, warn } from "../Tampermonkey/logger.js";
import {
    NOVEL_TITLE_SELECTOR,
    NOVEL_COVER_SELECTOR,
    NOVEL_TAGS_CONTAINER_SELECTOR,
} from "../config/selectors/index.js";

/**
 * 基于特征识别查找小说标签容器（使用备用方案）
 * @returns {HTMLElement|null}
 */
export function findNovelTagsContainer() {
    let tagsContainer = document.querySelector(NOVEL_TAGS_CONTAINER_SELECTOR);
    if (tagsContainer) {
        dbg("标签容器查找: 使用精确选择器");
        return tagsContainer;
    }

    const mainEl = document.querySelector("main");
    if (mainEl) {
        const footerEl = mainEl.querySelector("footer");
        if (footerEl) {
            const ulEl = footerEl.querySelector("ul");
            if (ulEl) {
                dbg("标签容器查找: 使用main>footer>ul结构");
                return footerEl;
            }
        }
    }

    dbg("标签容器查找: 未找到合适的元素");
    return null;
}

/**
 * 基于特征识别查找小说标题元素
 * @returns {HTMLElement|null}
 */
export function findNovelTitle() {
    let titleEl = document.querySelector(NOVEL_TITLE_SELECTOR);
    if (titleEl) {
        dbg("标题查找: 使用精确选择器");
        return titleEl;
    }

    titleEl = document.querySelector('h1[class*="sc-57130d55"]');
    if (titleEl) {
        dbg("标题查找: 使用部分class匹配");
        return titleEl;
    }

    const mainEl = document.querySelector("main");
    if (mainEl) {
        titleEl = mainEl.querySelector("h1");
        if (titleEl) {
            dbg("标题查找: 使用main>h1结构");
            return titleEl;
        }
    }

    const allH1s = document.querySelectorAll("h1");
    if (allH1s.length > 0) {
        let maxFontSize = 0;
        let bestCandidate = null;

        allH1s.forEach((h1) => {
            const style = window.getComputedStyle(h1);
            if (style.display === "none" || style.visibility === "hidden") {
                return;
            }

            const rect = h1.getBoundingClientRect();
            if (rect.top < 0 || rect.top > window.innerHeight) {
                return;
            }

            const fontSize = parseFloat(style.fontSize);
            if (fontSize > maxFontSize) {
                maxFontSize = fontSize;
                bestCandidate = h1;
            }
        });

        if (bestCandidate) {
            dbg("标题查找: 使用字号特征识别");
            return bestCandidate;
        }
    }

    titleEl = document.querySelector("h1");
    if (titleEl) {
        dbg("标题查找: 使用通用h1回退");
        return titleEl;
    }

    warn("无法找到小说标题元素");
    return null;
}

/**
 * 基于特征识别查找小说封面
 * @returns {HTMLImageElement|null}
 */
export function findNovelCover() {
    let coverImg = document.querySelector(NOVEL_COVER_SELECTOR);
    if (coverImg) {
        dbg("封面查找: 使用精确选择器");
        return coverImg;
    }

    coverImg = document.querySelector('img[class*="sc-41178ccf"]');
    if (coverImg) {
        dbg("封面查找: 使用部分class匹配");
        return coverImg;
    }

    const mainEl = document.querySelector("main");
    if (mainEl) {
        coverImg = mainEl.querySelector("img");
        if (coverImg) {
            dbg("封面查找: 使用main>img结构");
            return coverImg;
        }
    }

    coverImg = document.querySelector("img");
    if (coverImg) {
        dbg("封面查找: 使用通用img回退");
        return coverImg;
    }

    warn("无法找到小说封面元素");
    return null;
}
