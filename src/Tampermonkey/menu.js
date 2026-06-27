"use strict";

import {
    setFolderId,
    makeToggle,
    toggleCreateSubFolder,
    setNovelSavePath,
    setNovelSaveFormat,
    SETTING_KEYS,
    SETTING_DEFAULTS,
} from "./setting.js";
import { saveCurrentArtwork } from "../artwork/save.js";

export function registerMenuCommands(deps) {
    GM_registerMenuCommand("📁 设置 Pixiv 文件夹 ID", setFolderId);
    GM_registerMenuCommand("📅 切换：使用投稿时间作为添加日期", makeToggle({ key: SETTING_KEYS.USE_UPLOAD_DATE, label: "使用投稿时间作为添加日期" }));
    GM_registerMenuCommand("🕗 切换：保存作品描述", makeToggle({ key: SETTING_KEYS.SAVE_DESCRIPTION, label: "保存作品描述", defaultValue: SETTING_DEFAULTS[SETTING_KEYS.SAVE_DESCRIPTION] }));
    GM_registerMenuCommand("🗂️ 切换：为多页作品创建子文件夹", toggleCreateSubFolder);
    GM_registerMenuCommand("🗂️ 切换：按类型保存", makeToggle({ key: SETTING_KEYS.SAVE_BY_TYPE, label: "按类型保存" }));
    GM_registerMenuCommand("🖼️ 保存当前作品到 Eagle", saveCurrentArtwork);
    GM_registerMenuCommand("🔎 切换：自动检测作品保存状态", makeToggle({ key: SETTING_KEYS.AUTO_CHECK_SAVED_STATUS, label: "自动检测作品保存状态", onText: "开启", offText: "关闭" }));
    GM_registerMenuCommand("🔄 强制更新 Eagle 索引", deps.forceRefreshEagleIndex);
    GM_registerMenuCommand("📂 设置小说保存路径", setNovelSavePath);
    GM_registerMenuCommand("📚 切换：小说保存格式 (TXT/MD/EPUB)", setNovelSaveFormat);
    GM_registerMenuCommand("🧪 切换：调试模式", makeToggle({ key: SETTING_KEYS.DEBUG_MODE, label: "调试模式" }));
    GM_registerMenuCommand("🧪 设置画师文件夹名称模板", deps.setArtistMatcher);
}
