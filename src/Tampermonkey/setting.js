"use strict";

/** 用户 GM 设置键（eagleIndex 在 storage.js，不在此列） */
export const SETTING_KEYS = Object.freeze({
    PIXIV_FOLDER_ID: "pixivFolderId",
    USE_UPLOAD_DATE: "useUploadDate",
    SAVE_DESCRIPTION: "saveDescription",
    CREATE_SUB_FOLDER: "createSubFolder",
    SAVE_BY_TYPE: "saveByType",
    DEBUG_MODE: "debugMode",
    AUTO_CHECK_SAVED_STATUS: "autoCheckSavedStatus",
    FOLDER_NAME_TEMPLATE: "folderNameTemplate",
    NOVEL_SAVE_PATH: "novelSavePath",
    NOVEL_SAVE_FORMAT: "novelSaveFormat",
});

export const SETTING_DEFAULTS = Object.freeze({
    [SETTING_KEYS.PIXIV_FOLDER_ID]: "",
    [SETTING_KEYS.USE_UPLOAD_DATE]: false,
    [SETTING_KEYS.SAVE_DESCRIPTION]: true,
    [SETTING_KEYS.CREATE_SUB_FOLDER]: "off",
    [SETTING_KEYS.SAVE_BY_TYPE]: false,
    [SETTING_KEYS.DEBUG_MODE]: false,
    [SETTING_KEYS.AUTO_CHECK_SAVED_STATUS]: false,
    [SETTING_KEYS.FOLDER_NAME_TEMPLATE]: "$name",
    [SETTING_KEYS.NOVEL_SAVE_PATH]: "",
    [SETTING_KEYS.NOVEL_SAVE_FORMAT]: "txt",
});

// Phase 2 迁入完整实现；骨架阶段仅导出键名供其它模块引用
export function getFolderId() {
    return GM_getValue(SETTING_KEYS.PIXIV_FOLDER_ID, SETTING_DEFAULTS[SETTING_KEYS.PIXIV_FOLDER_ID]);
}
