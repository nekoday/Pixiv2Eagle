export const EAGLE_SAVE_BUTTON_ID = "eagle-save-button-wrapper";
export const EAGLE_OPEN_ITEM_BUTTON_ID = "eagle-open-artwork-button";
export const PIXIV_SECTION_CLASS = "sc-7709e4d9-0"; // deprecated
export const PIXIV_ARTIST_DIV_CLASS = "sc-946c1cc3-1 lnPJtB"; // deprecated

// JS 库加载源开关（true = 国内源，false = 国际源）
export const USE_DOMESTIC_CDN = true;

// Runtime Tunables —— 运行时可调参数（超时/间隔/分页/循环上限）
export const EAGLE_CHECK_TIMEOUT          = 5000;   // checkEagle 连接超时（毫秒）
export const EAGLE_ITEM_LIST_LIMIT        = 200;    // isArtworkSavedInEagle 单页条目数
export const EAGLE_ITEM_LIST_MAX_PAGES    = 500;    // isArtworkSavedInEagle 最大翻页数（上限 10 万条目）
export const EAGLE_ITEM_INFO_CONCURRENCY  = 5;      // isArtworkSavedInEagle 深度检查并发数
export const PAGE_OBSERVER_TIMEOUT_MS     = 30000;  // handlePageChange 观察器存活上限（毫秒）
export const PAGE_RETRY_INTERVAL_MS       = 500;    // handlePageChange 重试间隔（毫秒）
export const PAGE_RETRY_MAX_COUNT         = 10;     // handlePageChange 最大重试次数
export const NOVEL_IMAGE_DOWNLOAD_DELAY_MS = 500;  // 小说图片下载延迟（毫秒，避免浏览器拦截）
export const INDEX_EXPIRE_TIME = 24 * 60 * 60 * 1000; // Eagle 索引缓存有效期（24 小时，毫秒）
