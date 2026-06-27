"use strict";

import { showToast } from "../ui/toast.js";
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

let _invalidateEagleIndex = null;
let _ensureEagleIndex = null;

/** Phase 2：由 index.js 在 ensureEagleIndex 定义后注入，避免 setting ↔ index 循环依赖 */
export function bindEagleIndexRefresh({ invalidateEagleIndex, ensureEagleIndex }) {
    _invalidateEagleIndex = invalidateEagleIndex;
    _ensureEagleIndex = ensureEagleIndex;
}

// 获取文件夹 ID
export function getFolderId() {
    return GM_getValue("pixivFolderId", "");
}

// 设置文件夹 ID
export function setFolderId() {
    const currentId = getFolderId();
    const userInput = prompt("请输入 Pixiv 文件夹 ID 或 Eagle 文件夹链接：", currentId);

    if (userInput === null) return;

    let finalId = userInput.trim();
    const urlParam = "folder?id=";
    const urlIndex = finalId.indexOf(urlParam);

    if (urlIndex !== -1) {
        // 如果输入的是链接，提取 ID
        finalId = finalId.substring(urlIndex + urlParam.length);
        // 移除可能的后续参数（虽然 Eagle 链接通常没有）
        const queryParamIndex = finalId.indexOf("?");
        if (queryParamIndex !== -1) {
            finalId = finalId.substring(0, queryParamIndex);
        }
        const hashIndex = finalId.indexOf("#");
        if (hashIndex !== -1) {
            finalId = finalId.substring(0, hashIndex);
        }
    }

    // 再次 trim 以防万一
    finalId = finalId.trim();

    GM_setValue("pixivFolderId", finalId);

    if (finalId === "") {
        alert("已清空文件夹 ID，将默认在根目录创建画师文件夹");
    } else {
        alert(`文件夹 ID 已设置为: ${finalId}`);
    }
}

// 获取是否使用投稿时间
export function getUseUploadDate() {
    return GM_getValue("useUploadDate", false);
}

// 获取是否保存作品描述
export function getSaveDescription() {
    return GM_getValue("saveDescription", true); // 默认开启
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
            GM_setValue("createSubFolder", "multi-page");
            alert("✅ 仅为多页作品创建子文件夹");
            break;
        case "multi-page":
            GM_setValue("createSubFolder", "always");
            alert("✅ 为任意作品创建子文件夹");
            break;
        case "always":
            GM_setValue("createSubFolder", "off");
            alert("❌ 已关闭创建作品子文件夹功能");
            break;
        default:
            GM_setValue("createSubFolder", "off");
            alert("❌ 已关闭创建作品子文件夹功能");
    }
}

// 获取是否为多 P 作品创建子文件夹
export function getCreateSubFolder() {
    let currentMode = GM_getValue("createSubFolder", "off");
    if (typeof currentMode === "boolean") {
        currentMode = currentMode ? "multi-page" : "off";
        GM_setValue("createSubFolder", currentMode);
    }
    return currentMode;
}

// 获取是否按类型保存
export function getSaveByType() {
    return GM_getValue("saveByType", false);
}

// 获取调试模式状态
export function getDebugMode() {
    return GM_getValue("debugMode", false);
}

// 获取是否自动检测作品保存状态
export function getAutoCheckSavedStatus() {
    return GM_getValue("autoCheckSavedStatus", false);
}

// 强制更新 Eagle 索引
export async function forceRefreshEagleIndex() {
    try {
        _invalidateEagleIndex();
        await _ensureEagleIndex(true);
        alert("✅ Eagle 索引已强制更新完成");
    } catch (error) {
        err("强制更新索引失败:", error);
        alert(`❌ 强制更新索引失败: ${error.message}`);
    }
}

// 获取小说保存路径配置
export function getNovelSavePath() {
    return GM_getValue("novelSavePath", "");
}

// 设置小说保存路径
export function setNovelSavePath() {
    const currentPath = getNovelSavePath();
    const userInput = prompt("请输入小说保存路径（例如：C:\\Users\\YourName\\Downloads）:", currentPath);

    if (userInput === null) return;

    const path = userInput.trim();
    GM_setValue("novelSavePath", path);

    if (path === "") {
        alert("已清空保存路径，将提示用户手动输入");
    } else {
        alert(`小说保存路径已设置为: ${path}`);
    }
}

// 获取小说保存格式
export function getNovelSaveFormat() {
    const format = GM_getValue("novelSaveFormat", "txt"); // 默认 txt
    return format;
}

// 设置小说保存格式
export function setNovelSaveFormat() {
    const currentFormat = getNovelSaveFormat();
    const formats = ["txt", "md", "epub"];
    const formatNames = { txt: "纯文本 (TXT)", md: "Markdown (MD)", epub: "EPUB 电子书" };

    const formatIndex = formats.indexOf(currentFormat);
    const nextFormat = formats[(formatIndex + 1) % formats.length];

    GM_setValue("novelSaveFormat", nextFormat);
    alert(`小说保存格式已设置为: ${formatNames[nextFormat]}`);
}
