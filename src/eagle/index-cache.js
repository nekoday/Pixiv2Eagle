"use strict";

import { bindEagleIndexRefresh, getFolderId } from "../tampermonkey/setting.js";
import { dbg, warn, err } from "../tampermonkey/logger.js";
import { gmFetch } from "../tampermonkey/request.js";
import {
    loadEagleIndexCache,
    saveEagleIndexCache,
    clearEagleIndexCache,
} from "../tampermonkey/storage.js";
import { INDEX_EXPIRE_TIME } from "../config/constants.js";

// 索引序列化：将 Map 转换为可存储的普通对象
export function serializeIndex(index) {
    const serialized = {};
    for (const [uid, data] of index.entries()) {
        serialized[uid] = {
            id: data.id,
            pids: Array.from(data.pids), // Set 转换为 Array
        };
    }
    return serialized;
}

// 索引反序列化：将存储的数据恢复为 Map
export function deserializeIndex(data) {
    const index = new Map();
    for (const [uid, value] of Object.entries(data)) {
        index.set(uid, {
            id: value.id,
            pids: new Set(value.pids), // Array 转换为 Set
        });
    }
    return index;
}

// 使索引失效（清除缓存）
export function invalidateEagleIndex() {
    // 清除持久化存储
    clearEagleIndexCache();
    // 清除 window 对象上的索引
    window.__pixiv2eagle_globalEagleIndex = null;
    window.__pixiv2eagle_eagleIndexLoadingPromise = null;
}

// 使用 window 对象存储索引，避免页面导航时被重置
if (typeof window.__pixiv2eagle_globalEagleIndex === "undefined") {
    window.__pixiv2eagle_globalEagleIndex = null;
}
if (typeof window.__pixiv2eagle_eagleIndexLoadingPromise === "undefined") {
    window.__pixiv2eagle_eagleIndexLoadingPromise = null;
}

// 异步构建 Eagle 索引 (单例模式)
export async function ensureEagleIndex(forceRefresh = false) {
    // 如果强制刷新，清除缓存
    if (forceRefresh) {
        invalidateEagleIndex();
    }

    // 优先使用内存中的索引
    if (window.__pixiv2eagle_globalEagleIndex) return window.__pixiv2eagle_globalEagleIndex;
    if (window.__pixiv2eagle_eagleIndexLoadingPromise) return window.__pixiv2eagle_eagleIndexLoadingPromise;

    // 尝试从持久化存储加载索引
    const pixivFolderId = getFolderId();
    if (!forceRefresh && pixivFolderId) {
        try {
            const cachedData = loadEagleIndexCache();
            if (cachedData && cachedData.index && cachedData.expireTime && cachedData.pixivFolderId) {
                const now = Date.now();
                // 检查是否过期且文件夹ID匹配
                if (now < cachedData.expireTime && cachedData.pixivFolderId === pixivFolderId) {
                    // 索引未过期，反序列化并返回
                    const index = deserializeIndex(cachedData.index);
                    window.__pixiv2eagle_globalEagleIndex = index;
                    dbg(`从缓存加载 Eagle 索引，包含 ${index.size} 位画师`);
                    return index;
                } else {
                    // 索引已过期或文件夹ID不匹配，清除缓存
                    if (now >= cachedData.expireTime) {
                        dbg("索引已过期，重新构建...");
                    } else {
                        dbg("文件夹ID不匹配，重新构建索引...");
                    }
                    invalidateEagleIndex();
                }
            }
        } catch (e) {
            warn("加载缓存索引失败:", e);
            invalidateEagleIndex();
        }
    }

    dbg("正在构建全局 Eagle 索引...");
    window.__pixiv2eagle_eagleIndexLoadingPromise = (async () => {
        const index = new Map();
        if (!pixivFolderId) return index;

        try {
            const folderList = await gmFetch("http://localhost:41595/api/folder/list");
            if (folderList.status && Array.isArray(folderList.data)) {
                const findFolder = (folders, id) => {
                    for (const f of folders) {
                        if (f.id === id) return f;
                        if (f.children) {
                            const res = findFolder(f.children, id);
                            if (res) return res;
                        }
                    }
                    return null;
                };
                const root = findFolder(folderList.data, pixivFolderId);

                if (root && root.children) {
                    for (const artistFolder of root.children) {
                        const desc = artistFolder.description || "";
                        const match = desc.match(/pid\s*=\s*(\d+)/);
                        if (match) {
                            const artistUid = match[1];
                            const pids = new Set();

                            // 递归遍历所有子孙节点查找 PID (支持类型文件夹、系列文件夹等嵌套结构)
                            const traverse = (nodes) => {
                                for (const node of nodes) {
                                    const subDesc = (node.description || "").trim();
                                    // 只要备注是纯数字，就认为是作品 PID
                                    if (subDesc && /^\d+$/.test(subDesc)) {
                                        pids.add(subDesc);
                                    }
                                    // 继续递归子文件夹
                                    if (node.children && node.children.length > 0) {
                                        traverse(node.children);
                                    }
                                }
                            };

                            if (artistFolder.children) {
                                traverse(artistFolder.children);
                            }
                            index.set(artistUid, { id: artistFolder.id, pids });
                        }
                    }
                }
                dbg(`全局 Eagle 索引构建完成，包含 ${index.size} 位画师`);

                // 持久化索引到存储
                try {
                    const expireTime = Date.now() + INDEX_EXPIRE_TIME;
                    const serializedIndex = serializeIndex(index);
                    saveEagleIndexCache({
                        index: serializedIndex,
                        expireTime: expireTime,
                        pixivFolderId: pixivFolderId,
                    });
                    dbg(`索引已保存，将在 ${new Date(expireTime).toLocaleString()} 过期`);
                } catch (e) {
                    warn("保存索引失败:", e);
                }
            }
        } catch (e) {
            err("构建 Eagle 索引失败:", e);
        }
        return index;
    })();

    try {
        window.__pixiv2eagle_globalEagleIndex = await window.__pixiv2eagle_eagleIndexLoadingPromise;
    } catch (e) {
        err(e);
        window.__pixiv2eagle_eagleIndexLoadingPromise = null; // 允许重试
    }
    return window.__pixiv2eagle_globalEagleIndex;
}

bindEagleIndexRefresh({ invalidateEagleIndex, ensureEagleIndex });
