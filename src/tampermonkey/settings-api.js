"use strict";

import {
    SETTING_KEYS,
    SETTING_DEFAULTS,
    parsePixivFolderIdInput,
    getFolderId,
    getUseUploadDate,
    getSaveDescription,
    getCreateSubFolder,
    getSaveByType,
    getDebugMode,
    getAutoCheckSavedStatus,
    getNovelSavePath,
    getNovelSaveFormat,
    getUiTheme,
    getFilterRecSameAuthor,
    getFilterRecSameAuthorMode,
    getFilterRecSavedMode,
    getEagleSavePollTimeoutMs,
    forceRefreshEagleIndex,
} from "./setting.js";
import { checkEagle } from "../eagle/client.js";
import { loadEagleIndexCache } from "./storage.js";
import { applyTheme } from "../ui/theme.js";

/** @type {Set<(snapshot: ReturnType<typeof getSnapshot>) => void>} */
const subscribers = new Set();

const DEFAULT_EAGLE_SNAPSHOT = {
    connected: false,
    version: null,
    indexLoaded: false,
    indexArtistCount: 0,
    indexCacheValid: false,
    indexExpiresAt: null,
    indexState: "未构建",
};

/** @type {typeof DEFAULT_EAGLE_SNAPSHOT} */
let cachedEagleSnapshot = { ...DEFAULT_EAGLE_SNAPSHOT };

function readSettingsSnapshot() {
    return {
        pixivFolderId: getFolderId(),
        useUploadDate: getUseUploadDate(),
        saveDescription: getSaveDescription(),
        createSubFolder: getCreateSubFolder(),
        saveByType: getSaveByType(),
        debugMode: getDebugMode(),
        autoCheckSavedStatus: getAutoCheckSavedStatus(),
        folderNameTemplate: GM_getValue(
            SETTING_KEYS.FOLDER_NAME_TEMPLATE,
            SETTING_DEFAULTS[SETTING_KEYS.FOLDER_NAME_TEMPLATE]
        ),
        novelSavePath: getNovelSavePath(),
        novelSaveFormat: getNovelSaveFormat(),
        uiTheme: getUiTheme(),
        filterRecSameAuthor: getFilterRecSameAuthor(),
        filterRecSameAuthorMode: getFilterRecSameAuthorMode(),
        filterRecSavedMode: getFilterRecSavedMode(),
        eagleSavePollTimeoutMs: getEagleSavePollTimeoutMs(),
    };
}

/** 可导出/导入的设置字段（与 readSettingsSnapshot 键集同步） */
export const EXPORTABLE_SETTING_KEYS = Object.freeze([
    "pixivFolderId",
    "useUploadDate",
    "saveDescription",
    "createSubFolder",
    "saveByType",
    "debugMode",
    "autoCheckSavedStatus",
    "folderNameTemplate",
    "novelSavePath",
    "novelSaveFormat",
    "uiTheme",
    "filterRecSameAuthor",
    "filterRecSameAuthorMode",
    "filterRecSavedMode",
    "eagleSavePollTimeoutMs",
]);

const UTF8_BASE64_CHUNK = 0x8000;

/**
 * UTF-8 字符串 → Base64（避免 btoa 的 Latin-1 限制）
 * @param {string} str
 * @returns {string}
 */
function utf8Base64Encode(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    for (let i = 0; i < bytes.length; i += UTF8_BASE64_CHUNK) {
        const slice = bytes.subarray(i, i + UTF8_BASE64_CHUNK);
        binary += String.fromCharCode.apply(null, slice);
    }
    return btoa(binary);
}

/**
 * Base64 → UTF-8 字符串
 * @param {string} base64
 * @returns {string}
 */
function utf8Base64Decode(base64) {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function buildEagleSnapshotSync(probe) {
    const pixivFolderId = getFolderId();
    const memIndex = window.__pixiv2eagle_globalEagleIndex;
    const loadingPromise = window.__pixiv2eagle_eagleIndexLoadingPromise;
    const cached = loadEagleIndexCache();
    const now = Date.now();

    let indexCacheValid = false;
    let indexExpiresAt = null;
    if (cached && cached.expireTime && cached.pixivFolderId === pixivFolderId && pixivFolderId) {
        indexExpiresAt = cached.expireTime;
        indexCacheValid = now < cached.expireTime;
    }

    const indexLoaded = memIndex instanceof Map;
    const indexArtistCount = indexLoaded ? memIndex.size : 0;

    let indexState = "未构建";
    if (loadingPromise) {
        indexState = "构建中";
    } else if (indexLoaded) {
        indexState = "已加载";
    } else if (indexCacheValid) {
        indexState = "仅缓存";
    }

    return {
        connected: probe ? probe.running : cachedEagleSnapshot.connected,
        version: probe ? probe.version : cachedEagleSnapshot.version,
        indexLoaded,
        indexArtistCount,
        indexCacheValid,
        indexExpiresAt,
        indexState,
    };
}

cachedEagleSnapshot = buildEagleSnapshotSync(null);

function notifySubscribers() {
    const snapshot = getSnapshot();
    for (const listener of subscribers) {
        try {
            listener(snapshot);
        } catch (e) {
            // 订阅者错误不阻断其他订阅者
        }
    }
}

export function getSnapshot() {
    return {
        settings: readSettingsSnapshot(),
        eagle: { ...cachedEagleSnapshot },
    };
}

export async function refreshEagleState() {
    const probe = await checkEagle();
    cachedEagleSnapshot = buildEagleSnapshotSync(probe);
    notifySubscribers();
}

export function set(key, value) {
    switch (key) {
        case "pixivFolderId": {
            if (typeof value !== "string") {
                return { ok: false, error: "文件夹 ID 必须为字符串" };
            }
            const finalId = parsePixivFolderIdInput(value);
            GM_setValue(SETTING_KEYS.PIXIV_FOLDER_ID, finalId);
            cachedEagleSnapshot = buildEagleSnapshotSync(null);
            notifySubscribers();
            return { ok: true };
        }
        case "createSubFolder": {
            const allowed = ["off", "multi-page", "always"];
            if (!allowed.includes(value)) {
                return { ok: false, error: "无效的子文件夹模式" };
            }
            GM_setValue(SETTING_KEYS.CREATE_SUB_FOLDER, value);
            notifySubscribers();
            return { ok: true };
        }
        case "novelSaveFormat": {
            const allowed = ["txt", "md", "epub"];
            if (!allowed.includes(value)) {
                return { ok: false, error: "无效的保存格式" };
            }
            GM_setValue(SETTING_KEYS.NOVEL_SAVE_FORMAT, value);
            notifySubscribers();
            return { ok: true };
        }
        case "uiTheme": {
            const allowed = ["light", "dark", "system"];
            if (!allowed.includes(value)) {
                return { ok: false, error: "无效的主题" };
            }
            GM_setValue(SETTING_KEYS.UI_THEME, value);
            applyTheme(value);
            notifySubscribers();
            return { ok: true };
        }
        case "folderNameTemplate": {
            if (typeof value !== "string" || value.trim() === "") {
                return { ok: false, error: "模板不能为空" };
            }
            GM_setValue(SETTING_KEYS.FOLDER_NAME_TEMPLATE, value.trim());
            notifySubscribers();
            return { ok: true };
        }
        case "novelSavePath": {
            if (typeof value !== "string") {
                return { ok: false, error: "路径必须为字符串" };
            }
            GM_setValue(SETTING_KEYS.NOVEL_SAVE_PATH, value.trim());
            notifySubscribers();
            return { ok: true };
        }
        case "filterRecSameAuthorMode": {
            const allowed = ["remove", "blur"];
            if (!allowed.includes(value)) {
                return { ok: false, error: "无效的隐藏模式" };
            }
            GM_setValue(SETTING_KEYS.FILTER_REC_SAME_AUTHOR_MODE, value);
            notifySubscribers();
            return { ok: true };
        }
        case "filterRecSavedMode": {
            const allowed = ["mark", "blur", "hide"];
            if (!allowed.includes(value)) {
                return { ok: false, error: "无效的已保存作品模式" };
            }
            GM_setValue(SETTING_KEYS.FILTER_REC_SAVED_MODE, value);
            notifySubscribers();
            return { ok: true };
        }
        case "eagleSavePollTimeoutMs": {
            const ms = Number(value);
            if (!Number.isFinite(ms) || ms <= 0) {
                return { ok: false, error: "超时必须为正数（毫秒）" };
            }
            GM_setValue(SETTING_KEYS.EAGLE_SAVE_POLL_TIMEOUT_MS, Math.round(ms));
            notifySubscribers();
            return { ok: true };
        }
        case "useUploadDate":
        case "saveDescription":
        case "saveByType":
        case "debugMode":
        case "autoCheckSavedStatus":
        case "filterRecSameAuthor": {
            if (typeof value !== "boolean") {
                return { ok: false, error: "必须为布尔值" };
            }
            const keyMap = {
                useUploadDate: SETTING_KEYS.USE_UPLOAD_DATE,
                saveDescription: SETTING_KEYS.SAVE_DESCRIPTION,
                saveByType: SETTING_KEYS.SAVE_BY_TYPE,
                debugMode: SETTING_KEYS.DEBUG_MODE,
                autoCheckSavedStatus: SETTING_KEYS.AUTO_CHECK_SAVED_STATUS,
                filterRecSameAuthor: SETTING_KEYS.FILTER_REC_SAME_AUTHOR,
            };
            GM_setValue(keyMap[key], value);
            notifySubscribers();
            return { ok: true };
        }
        default:
            return { ok: false, error: `未知设置项: ${key}` };
    }
}

export function subscribe(listener) {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
}

/**
 * 读取当前 GM 设置，序列化为 Base64 blob。
 * @returns {string}
 */
export function exportSettingsBlob() {
    const settings = readSettingsSnapshot();
    const payload = {
        version: GM_info.script.version,
        settings,
    };
    const json = JSON.stringify(payload);
    return utf8Base64Encode(json);
}

function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function importSettingsBlob(blob) {
    if (typeof blob !== "string" || blob.trim() === "") {
        return { ok: false, error: "配置内容为空" };
    }
    let json;
    try {
        json = utf8Base64Decode(blob.trim());
    } catch {
        return { ok: false, error: "无法解码配置（Base64 无效）" };
    }
    let payload;
    try {
        payload = JSON.parse(json);
    } catch {
        return { ok: false, error: "无法解析配置（JSON 无效）" };
    }
    if (!isPlainObject(payload)) {
        return { ok: false, error: "配置格式无效" };
    }
    if (typeof payload.version !== "string") {
        return { ok: false, error: "配置缺少版本号" };
    }
    if (!isPlainObject(payload.settings)) {
        return { ok: false, error: "配置缺少 settings 对象" };
    }
    const currentVersion = GM_info.script.version;
    let versionWarning;
    if (payload.version !== currentVersion) {
        versionWarning = `配置来自脚本 v${payload.version}，当前为 v${currentVersion}，将继续导入`;
    }
    const exportableSet = new Set(EXPORTABLE_SETTING_KEYS);
    const imported = [];
    const skipped = [];
    for (const key of Object.keys(payload.settings)) {
        if (!exportableSet.has(key)) {
            continue;
        }
        const result = set(key, payload.settings[key]);
        if (result.ok) {
            imported.push(key);
        } else {
            skipped.push({ key, reason: result.error });
        }
    }
    return {
        ok: true,
        imported,
        skipped,
        ...(versionWarning ? { versionWarning } : {}),
    };
}

export async function refreshEagleIndexFromPanel() {
    const result = await forceRefreshEagleIndex();
    if (result.ok) {
        cachedEagleSnapshot = buildEagleSnapshotSync(null);
        await refreshEagleState();
    } else {
        notifySubscribers();
    }
    return result;
}
