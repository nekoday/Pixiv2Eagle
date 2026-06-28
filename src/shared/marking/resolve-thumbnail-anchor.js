"use strict";

import {
    LIST_CONTAINER_SELECTOR,
    LIST_CONTAINER_PARTIAL_SELECTOR,
    LIST_CONTAINER_FALLBACK_SELECTORS,
    SERIES_PAGE_LIST_SELECTOR,
    SERIES_PAGE_LIST_PARTIAL_SELECTOR,
    SERIES_PAGE_LIST_FALLBACK_SELECTORS,
    THUMBNAIL_CONTAINER_SELECTOR,
    THUMBNAIL_CONTAINER_PARTIAL_SELECTOR,
    THUMBNAIL_CONTAINER_FALLBACK_SELECTORS,
} from "../../config/selectors/list.js";
import {
    REC_THUMBNAIL_SELECTOR,
    REC_THUMBNAIL_PARTIAL_SELECTOR,
    REC_THUMBNAIL_FALLBACK_SELECTOR,
    REC_THUMBNAIL_FALLBACK_PARTIAL_SELECTOR,
    REC_THUMBNAIL_FALLBACK_SELECTORS,
} from "../../config/selectors/artwork.js";

/**
 * 按序尝试 selectors，返回 root 内第一个匹配元素。
 * @param {ParentNode} root
 * @param {string[]} selectors
 * @returns {HTMLElement|null}
 */
export function queryFirst(root, selectors) {
    if (!root || !selectors || selectors.length === 0) return null;
    for (const selector of selectors) {
        if (!selector) continue;
        try {
            const el = root.querySelector(selector);
            if (el) return el;
        } catch (e) {
            // 无效选择器（极少数环境不支持 :has）— 跳过
        }
    }
    return null;
}

/** Tier 1 结构：含 artwork 链接的 ul 及其 div 包装 */
function findListContainerStructural(root = document) {
    const uls = root.querySelectorAll("ul");
    for (const ul of uls) {
        if (!ul.querySelector('li a[href*="/artworks/"]')) continue;
        const parent = ul.parentElement;
        if (parent && parent.tagName === "DIV") return parent;
        return ul;
    }
    return null;
}

/** Tier 1 JS 降级：从 artwork 链接向上找 ul/div 容器（:has 不可用时的兜底） */
function findListContainerByArtworkLinks(root = document) {
    const links = root.querySelectorAll('a[href*="/artworks/"]');
    for (const link of links) {
        const li = link.closest("li");
        if (!li) continue;
        const ul = li.closest("ul");
        if (!ul) continue;
        if (ul.querySelectorAll('li a[href*="/artworks/"]').length === 0) continue;
        const parent = ul.parentElement;
        return parent && parent.tagName === "DIV" ? parent : ul;
    }
    return null;
}

function buildListContainerTier3(isSeriesPage) {
    if (isSeriesPage) {
        return [
            SERIES_PAGE_LIST_SELECTOR,
            SERIES_PAGE_LIST_PARTIAL_SELECTOR,
            ...SERIES_PAGE_LIST_FALLBACK_SELECTORS,
        ];
    }
    return [
        LIST_CONTAINER_SELECTOR,
        LIST_CONTAINER_PARTIAL_SELECTOR,
        ...LIST_CONTAINER_FALLBACK_SELECTORS,
    ];
}

function buildListContainerTier2(isSeriesPage) {
    if (isSeriesPage) {
        return [
            'div:has(ul > li a[href*="/artworks/"])',
            'section:has(ul > li a[href*="/artworks/"])',
        ];
    }
    return [
        'div:has(> ul > li a[href*="/artworks/"])',
        'div:has(ul > li a[href*="/artworks/"])',
    ];
}

/**
 * 解析列表/系列页容器（Tier 1 结构 → Tier 2 语义 → Tier 3 哈希）。
 * @param {{ isSeriesPage?: boolean }} [options]
 * @returns {HTMLElement|null}
 */
export function resolveListContainer({ isSeriesPage = false } = {}) {
    const structural = findListContainerStructural(document);
    if (structural) return structural;

    const jsFallback = findListContainerByArtworkLinks(document);
    if (jsFallback) return jsFallback;

    const tier2Match = queryFirst(document, buildListContainerTier2(isSeriesPage));
    if (tier2Match) return tier2Match;

    const tier3 = buildListContainerTier3(isSeriesPage);
    return queryFirst(document, tier3);
}

/**
 * 等待列表容器出现（轮询 resolver + MutationObserver）。
 * @param {{ isSeriesPage?: boolean, timeout?: number }} [options]
 * @returns {Promise<HTMLElement|null>}
 */
export function waitForListContainer({ isSeriesPage = false, timeout = 5000 } = {}) {
    return new Promise((resolve) => {
        const tryResolve = () => resolveListContainer({ isSeriesPage });

        const immediate = tryResolve();
        if (immediate) return resolve(immediate);

        const obs = new MutationObserver(() => {
            const el = tryResolve();
            if (el) {
                obs.disconnect();
                resolve(el);
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            obs.disconnect();
            resolve(tryResolve());
        }, timeout);
    });
}

function buildThumbnailTier3(context) {
    if (context === "rec") {
        return [
            REC_THUMBNAIL_SELECTOR,
            REC_THUMBNAIL_PARTIAL_SELECTOR,
            REC_THUMBNAIL_FALLBACK_SELECTOR,
            REC_THUMBNAIL_FALLBACK_PARTIAL_SELECTOR,
            ...REC_THUMBNAIL_FALLBACK_SELECTORS,
        ];
    }
    return [
        THUMBNAIL_CONTAINER_SELECTOR,
        THUMBNAIL_CONTAINER_PARTIAL_SELECTOR,
        ...THUMBNAIL_CONTAINER_FALLBACK_SELECTORS,
    ];
}

/**
 * 在单个 li 内解析缩略图锚点（徽章插入容器）。
 * @param {HTMLElement} li
 * @param {{ context?: 'list'|'rec' }} [options]
 * @returns {HTMLElement|null}
 */
export function resolveThumbnailAnchor(li, { context = "list" } = {}) {
    if (!li) return null;

    // Tier 1 结构
    const link = li.querySelector('a[href*="/artworks/"]');
    if (link) {
        const radiusDiv = link.querySelector('div[radius="4"]');
        if (radiusDiv) return radiusDiv;
    }
    const img = li.querySelector('img[src*="i.pximg.net"]') || li.querySelector("img");
    if (img) {
        const imgContainer = img.closest('div[radius="4"]') || img.parentElement;
        if (imgContainer) return imgContainer;
    }

    // Tier 2 语义
    const tier2 = [
        'a[href*="/artworks/"] div[radius="4"]',
        'a[href*="/artworks/"] div:has(img[src*="i.pximg.net"])',
    ];
    let target = queryFirst(li, tier2);
    if (target) return target;

    // Tier 3 哈希
    const tier3 = buildThumbnailTier3(context);
    return queryFirst(li, tier3);
}
