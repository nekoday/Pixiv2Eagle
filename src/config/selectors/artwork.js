export const REC_ZONE_SELECTOR = ".gtm-illust-recommend-zone";
export const REC_THUMBNAIL_LINK_SELECTOR = ".gtm-illust-recommend-thumbnail-link";
export const REC_USER_NAME_LINK_SELECTOR = ".gtm-illust-recommend-user-name";

/** 推荐区容器哈希 fallback（GTM 不可用时的兜底） */
export const REC_CONTAINER_FALLBACK_SELECTORS = [
    'section[class*="sc-79c00fd3-0"]',
    "div.sc-bf8cea3f-0.dKbaFf",
    'div[class*="sc-bf8cea3f-0"]',
];

/** 推荐作品链接哈希 fallback */
export const REC_WORK_LINK_FALLBACK_SELECTORS = [
    "a.sc-fab8f26d-6",
    'a[class*="sc-fab8f26d-6"]',
];

export const REC_THUMBNAIL_SELECTOR = "div.sc-20eee990-9.icCaYS";
export const REC_THUMBNAIL_PARTIAL_SELECTOR = "div.sc-20eee990-9";
export const REC_THUMBNAIL_FALLBACK_SELECTOR = "div.sc-fab8f26d-3.etVILu";
export const REC_THUMBNAIL_FALLBACK_PARTIAL_SELECTOR = "div.sc-fab8f26d-3";
export const REC_THUMBNAIL_FALLBACK_SELECTORS = [
    "div.sc-f44a0b30-9.cvPXKv",
    "div.sc-f44a0b30-9",
    "div.sc-fab8f26d-3.etVILu",
    "div.sc-fab8f26d-3",
];
export const ARTWORK_BUTTON_CONTAINER_SELECTOR = 'div.sc-7fd477ff-3.jrRrCf';
export const ARTWORK_BUTTON_REF_SELECTOR = 'div.sc-7fd477ff-4.duoqQE';

/** 侧栏「其他作品」作品 link（`resolveRecRoots` 取其 `closest('nav')` 为 Observer root；现网固定 3 条） */
export const REC_SIDEBAR_OTHER_WORKS_NAV = 'aside nav a[href*="/artworks/"]';
