// Tier 3 — 画师插画/漫画列表容器（2026-06 Pixiv 改版）
export const LIST_CONTAINER_SELECTOR = "div.sc-e967f3f1-0.ehpqUi";
export const LIST_CONTAINER_PARTIAL_SELECTOR = "div.sc-e967f3f1-0";

// 旧版哈希 fallback（Pixiv 回滚或多布局并存时保留）
export const LIST_CONTAINER_FALLBACK_SELECTORS = [
    "div.sc-e83d358-0.daBOIJ",
    "div.sc-e83d358-0",
];

// Tier 3 — 系列页面作品列表容器
export const SERIES_PAGE_LIST_SELECTOR = "div.sc-de6bf819-3.cNVLSX";
export const SERIES_PAGE_LIST_PARTIAL_SELECTOR = "div.sc-de6bf819-3";
export const SERIES_PAGE_LIST_FALLBACK_SELECTORS = [
    "div.sc-de6bf819-3.cNVLSX",
    "div.sc-de6bf819-3",
];

// Tier 3 — 列表作品缩略图容器（徽章插入锚点，2026-06 改版）
export const THUMBNAIL_CONTAINER_SELECTOR = "div.sc-20eee990-9.icCaYS";
export const THUMBNAIL_CONTAINER_PARTIAL_SELECTOR = "div.sc-20eee990-9";

// 旧版缩略图 fallback
export const THUMBNAIL_CONTAINER_FALLBACK_SELECTORS = [
    "div.sc-f44a0b30-9.cvPXKv",
    "div.sc-f44a0b30-9",
];
