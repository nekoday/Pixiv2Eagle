import { warn } from "../../tampermonkey/logger.js";
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
} from "./list.js";

const SERIES_PAGE_SELECTOR = "a[data-gtm-value-series-work]";
const LIST_THUMBNAIL_SELECTOR = 'a[href*="/artworks/"]';

function queryWithFallbacks(selectors) {
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
    }
    return null;
}

function queryAllWithFallbacks(selectors) {
    for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) return [...els];
    }
    return [];
}

function buildItemFromAnchor(anchor, mode, parentSelector) {
    const item = anchor.closest("li") || anchor.closest("div[class*='sc-']") || anchor.parentElement;
    if (!item) return null;
    return {
        item,
        anchor,
        artworkId: anchor.href.match(/\/artworks\/(\d+)/)?.[1] ?? null,
        thumbnailContainer:
            item.querySelector(THUMBNAIL_CONTAINER_SELECTOR) ||
            item.querySelector(THUMBNAIL_CONTAINER_PARTIAL_SELECTOR) ||
            (() => {
                for (const s of THUMBNAIL_CONTAINER_FALLBACK_SELECTORS) {
                    const el = item.querySelector(s);
                    if (el) return el;
                }
                return item;
            })(),
        _meta: { mode, parentSelector },
    };
}

/** Tier 3 — 当前选择器常量定位容器 */
function findItemsTier3() {
    const parent =
        document.querySelector(LIST_CONTAINER_SELECTOR) ||
        document.querySelector(LIST_CONTAINER_PARTIAL_SELECTOR) ||
        queryWithFallbacks(LIST_CONTAINER_FALLBACK_SELECTORS) ||
        document.querySelector(SERIES_PAGE_LIST_SELECTOR) ||
        document.querySelector(SERIES_PAGE_LIST_PARTIAL_SELECTOR) ||
        queryWithFallbacks(SERIES_PAGE_LIST_FALLBACK_SELECTORS);

    if (!parent) return [];

    const anchors = parent.querySelectorAll(LIST_THUMBNAIL_SELECTOR);
    return [...anchors].map((a) =>
        buildItemFromAnchor(a, "tier3-container", LIST_CONTAINER_SELECTOR)
    ).filter(Boolean);
}

/** Tier 1 — 系列页专用 */
function findItemsTier1() {
    const seriesAnchors = document.querySelectorAll(SERIES_PAGE_SELECTOR);
    if (seriesAnchors.length === 0) return [];

    return [...seriesAnchors].map((a) =>
        buildItemFromAnchor(a, "tier1-series-link", SERIES_PAGE_SELECTOR)
    ).filter(Boolean);
}

/** Tier 0 — 全页 artworks 链接兜底 */
function findItemsTier0() {
    const anchors = document.querySelectorAll('section a[href*="/artworks/"], main a[href*="/artworks/"]');
    const seen = new Set();
    const result = [];

    for (const a of anchors) {
        const id = a.href.match(/\/artworks\/(\d+)/)?.[1];
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const built = buildItemFromAnchor(a, "tier0-global-fallback", "global");
        if (built) result.push(built);
    }
    return result;
}

/**
 * 按 Tier 3 → 1 → 0 查找列表作品项。
 * @returns {Array<{ item, anchor, artworkId, thumbnailContainer, _meta }>}
 */
export function findListItems() {
    const tier3 = findItemsTier3();
    if (tier3.length > 0) return tier3;

    const tier1 = findItemsTier1();
    if (tier1.length > 0) return tier1;

    const tier0 = findItemsTier0();
    if (tier0.length === 0) {
        warn("[list-find] all tiers exhausted, no list items found");
    } else {
        warn("[list-find] fell back to tier0-global-fallback");
    }
    return tier0;
}
