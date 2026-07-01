"use strict";

import { err } from "./logger.js";

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
    UI_THEME: "uiTheme",
    FILTER_REC_SAME_AUTHOR: "filterRecSameAuthor",
    FILTER_REC_SAME_AUTHOR_MODE: "filterRecSameAuthorMode",
    FILTER_REC_SAVED_MODE: "filterRecSavedMode",
    EAGLE_SAVE_POLL_TIMEOUT_MS: "eagleSavePollTimeoutMs",
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
    [SETTING_KEYS.UI_THEME]: "system",
    [SETTING_KEYS.FILTER_REC_SAME_AUTHOR]: false,
    [SETTING_KEYS.FILTER_REC_SAME_AUTHOR_MODE]: "remove",
    [SETTING_KEYS.FILTER_REC_SAVED_MODE]: "mark",
    [SETTING_KEYS.EAGLE_SAVE_POLL_TIMEOUT_MS]: 120000,
});

let _invalidateEagleIndex = null;
let _ensureEagleIndex = null;

/** Phase 2：由 index.js 在 ensureEagleIndex 定义后注入，避免 setting ↔ index 循环依赖 */
export function bindEagleIndexRefresh({ invalidateEagleIndex, ensureEagleIndex }) {
    _invalidateEagleIndex = invalidateEagleIndex;
    _ensureEagleIndex = ensureEagleIndex;
}

// 获取文件夹 ID
export function getFolderId() {
    return GM_getValue(SETTING_KEYS.PIXIV_FOLDER_ID, SETTING_DEFAULTS[SETTING_KEYS.PIXIV_FOLDER_ID]);
}

/**
 * 从用户输入解析 Pixiv 根文件夹 ID（支持 Eagle 链接 folder?id=）
 * @param {string} userInput
 * @returns {string}
 */
export function parsePixivFolderIdInput(userInput) {
    let finalId = userInput.trim();
    const urlParam = "folder?id=";
    const urlIndex = finalId.indexOf(urlParam);

    if (urlIndex !== -1) {
        finalId = finalId.substring(urlIndex + urlParam.length);
        const queryParamIndex = finalId.indexOf("?");
        if (queryParamIndex !== -1) {
            finalId = finalId.substring(0, queryParamIndex);
        }
        const hashIndex = finalId.indexOf("#");
        if (hashIndex !== -1) {
            finalId = finalId.substring(0, hashIndex);
        }
    }
    return finalId.trim();
}

// 设置文件夹 ID
export function setFolderId() {
    const currentId = getFolderId();
    const userInput = prompt("请输入 Pixiv 文件夹 ID 或 Eagle 文件夹链接：", currentId);

    if (userInput === null) return;

    const finalId = parsePixivFolderIdInput(userInput);

    GM_setValue(SETTING_KEYS.PIXIV_FOLDER_ID, finalId);

    if (finalId === "") {
        alert("已清空文件夹 ID，将默认在根目录创建画师文件夹");
    } else {
        alert(`文件夹 ID 已设置为: ${finalId}`);
    }
}

// 获取是否使用投稿时间
export function getUseUploadDate() {
    return GM_getValue(SETTING_KEYS.USE_UPLOAD_DATE, SETTING_DEFAULTS[SETTING_KEYS.USE_UPLOAD_DATE]);
}

// 获取是否保存作品描述
export function getSaveDescription() {
    return GM_getValue(SETTING_KEYS.SAVE_DESCRIPTION, SETTING_DEFAULTS[SETTING_KEYS.SAVE_DESCRIPTION]);
}

// 设置 toggle 工厂：生成布尔型开关函数（P1 阶段仍用 alert，P2 替换为 toast）
// 保留各 toggle 原有的 alert 文案与默认值（spec 要求用户可见行为不变）
export function makeToggle({ key, label, defaultValue = false, onText = "开启 ✅", offText = "关闭 ❌" }) {
    return function () {
        const current = GM_getValue(key, defaultValue);
        GM_setValue(key, !current);
        alert(`${label}已${!current ? onText : offText}`);
    };
}

// 切换是否为多 P 作品创建子文件夹（三态：off / multi-page / always，不套工厂）
export function toggleCreateSubFolder() {
    const currentMode = getCreateSubFolder();
    switch (currentMode) {
        case "off":
            GM_setValue(SETTING_KEYS.CREATE_SUB_FOLDER, "multi-page");
            alert("✅ 仅为多页作品创建子文件夹");
            break;
        case "multi-page":
            GM_setValue(SETTING_KEYS.CREATE_SUB_FOLDER, "always");
            alert("✅ 为任意作品创建子文件夹");
            break;
        case "always":
            GM_setValue(SETTING_KEYS.CREATE_SUB_FOLDER, "off");
            alert("❌ 已关闭创建作品子文件夹功能");
            break;
        default:
            GM_setValue(SETTING_KEYS.CREATE_SUB_FOLDER, "off");
            alert("❌ 已关闭创建作品子文件夹功能");
    }
}

// 获取是否为多 P 作品创建子文件夹
export function getCreateSubFolder() {
    let currentMode = GM_getValue(SETTING_KEYS.CREATE_SUB_FOLDER, SETTING_DEFAULTS[SETTING_KEYS.CREATE_SUB_FOLDER]);
    if (typeof currentMode === "boolean") {
        currentMode = currentMode ? "multi-page" : "off";
        GM_setValue(SETTING_KEYS.CREATE_SUB_FOLDER, currentMode);
    }
    return currentMode;
}

// 获取是否按类型保存
export function getSaveByType() {
    return GM_getValue(SETTING_KEYS.SAVE_BY_TYPE, SETTING_DEFAULTS[SETTING_KEYS.SAVE_BY_TYPE]);
}

// 获取调试模式状态
export function getDebugMode() {
    return GM_getValue(SETTING_KEYS.DEBUG_MODE, SETTING_DEFAULTS[SETTING_KEYS.DEBUG_MODE]);
}

// 获取是否自动检测作品保存状态
export function getAutoCheckSavedStatus() {
    return GM_getValue(SETTING_KEYS.AUTO_CHECK_SAVED_STATUS, SETTING_DEFAULTS[SETTING_KEYS.AUTO_CHECK_SAVED_STATUS]);
}

/**
 * 强制更新 Eagle 索引
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function forceRefreshEagleIndex() {
    try {
        _invalidateEagleIndex();
        await _ensureEagleIndex(true);
        return { ok: true };
    } catch (error) {
        err("强制更新索引失败:", error);
        const message = (error && error.message) ? error.message : String(error);
        return { ok: false, error: message };
    }
}

// 获取小说保存路径配置
export function getNovelSavePath() {
    return GM_getValue(SETTING_KEYS.NOVEL_SAVE_PATH, SETTING_DEFAULTS[SETTING_KEYS.NOVEL_SAVE_PATH]);
}

// 设置小说保存路径
export function setNovelSavePath() {
    const currentPath = getNovelSavePath();
    const userInput = prompt("请输入小说保存路径（例如：C:\\Users\\YourName\\Downloads）:", currentPath);

    if (userInput === null) return;

    const path = userInput.trim();
    GM_setValue(SETTING_KEYS.NOVEL_SAVE_PATH, path);

    if (path === "") {
        alert("已清空保存路径，将提示用户手动输入");
    } else {
        alert(`小说保存路径已设置为: ${path}`);
    }
}

// 获取小说保存格式
export function getNovelSaveFormat() {
    return GM_getValue(SETTING_KEYS.NOVEL_SAVE_FORMAT, SETTING_DEFAULTS[SETTING_KEYS.NOVEL_SAVE_FORMAT]);
}

// 获取落盘等待轮询超时（毫秒）；非法值回退默认 120000
export function getEagleSavePollTimeoutMs() {
    const raw = GM_getValue(
        SETTING_KEYS.EAGLE_SAVE_POLL_TIMEOUT_MS,
        SETTING_DEFAULTS[SETTING_KEYS.EAGLE_SAVE_POLL_TIMEOUT_MS]
    );
    const ms = Number(raw);
    return Number.isFinite(ms) && ms > 0 ? ms : SETTING_DEFAULTS[SETTING_KEYS.EAGLE_SAVE_POLL_TIMEOUT_MS];
}

// 菜单：设置落盘等待超时（秒）
export function setEagleSavePollTimeout() {
    const currentSec = Math.round(getEagleSavePollTimeoutMs() / 1000);
    const userInput = prompt("请输入 Eagle 落盘等待超时（秒，建议 30–300）：", String(currentSec));
    if (userInput === null) return;
    const sec = Number(userInput.trim());
    if (!Number.isFinite(sec) || sec <= 0) {
        alert("无效的秒数，未修改");
        return;
    }
    GM_setValue(SETTING_KEYS.EAGLE_SAVE_POLL_TIMEOUT_MS, Math.round(sec * 1000));
    alert(`落盘等待超时已设置为 ${Math.round(sec)} 秒`);
}

// 获取界面主题偏好
export function getUiTheme() {
    return GM_getValue(SETTING_KEYS.UI_THEME, SETTING_DEFAULTS[SETTING_KEYS.UI_THEME]);
}

// 获取是否过滤推荐区同作者作品
export function getFilterRecSameAuthor() {
    return GM_getValue(
        SETTING_KEYS.FILTER_REC_SAME_AUTHOR,
        SETTING_DEFAULTS[SETTING_KEYS.FILTER_REC_SAME_AUTHOR]
    );
}

// 获取推荐区同作者过滤模式（remove | blur）
export function getFilterRecSameAuthorMode() {
    const v = GM_getValue(
        SETTING_KEYS.FILTER_REC_SAME_AUTHOR_MODE,
        SETTING_DEFAULTS[SETTING_KEYS.FILTER_REC_SAME_AUTHOR_MODE]
    );
    return v === "blur" ? "blur" : "remove";
}

// 获取推荐区已保存作品展示模式（mark | blur | hide）
export function getFilterRecSavedMode() {
    const v = GM_getValue(
        SETTING_KEYS.FILTER_REC_SAVED_MODE,
        SETTING_DEFAULTS[SETTING_KEYS.FILTER_REC_SAVED_MODE]
    );
    if (v === "blur" || v === "hide") return v;
    return "mark";
}

// 三态轮询切换界面主题：light → dark → system
export function cycleUiTheme() {
    const themes = ["light", "dark", "system"];
    const labels = { light: "浅色", dark: "深色", system: "跟随系统" };
    const current = getUiTheme();
    const idx = themes.indexOf(current);
    const next = themes[(idx + 1) % themes.length];
    GM_setValue(SETTING_KEYS.UI_THEME, next);
    return { theme: next, label: labels[next] };
}

// 设置小说保存格式
export function setNovelSaveFormat() {
    const currentFormat = getNovelSaveFormat();
    const formats = ["txt", "md", "epub"];
    const formatNames = { txt: "纯文本 (TXT)", md: "Markdown (MD)", epub: "EPUB 电子书" };

    const formatIndex = formats.indexOf(currentFormat);
    const nextFormat = formats[(formatIndex + 1) % formats.length];

    GM_setValue(SETTING_KEYS.NOVEL_SAVE_FORMAT, nextFormat);
    alert(`小说保存格式已设置为: ${formatNames[nextFormat]}`);
}
