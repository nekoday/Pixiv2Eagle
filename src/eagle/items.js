"use strict";

import { getUseUploadDate, getSaveDescription } from "../tampermonkey/setting.js";
import { err } from "../tampermonkey/logger.js";
import { gmFetch } from "../tampermonkey/request.js";
import {
    EAGLE_ITEM_LIST_LIMIT,
    EAGLE_ITEM_LIST_MAX_PAGES,
    EAGLE_ITEM_INFO_CONCURRENCY,
} from "../config/constants.js";

// 查询 Eagle 中是否已保存指定作品
export async function isArtworkSavedInEagle(artworkId, folderId) {
    if (!folderId) {
        return { saved: false, itemId: null };
    }

    const artworkUrl = `https://www.pixiv.net/artworks/${artworkId}`;
    const limit = EAGLE_ITEM_LIST_LIMIT;

    try {
        let offset = 0;
        let loopCount = 0;

        while (loopCount < EAGLE_ITEM_LIST_MAX_PAGES) {
            const params = new URLSearchParams({
                folders: folderId,
                limit: limit.toString(),
                offset: offset.toString(),
            });

            const data = await gmFetch(`http://localhost:41595/api/item/list?${params.toString()}`);
            if (!data || !data.status) break;

            const items = Array.isArray(data.data)
                ? data.data
                : Array.isArray(data.data?.items)
                ? data.data.items
                : [];

            // 1. 快速检查：直接对比列表返回的 url
            let matched = items.find((item) => item.url === artworkUrl);

            // 2. 深度检查：如果列表没找到，遍历调用 /api/item/info 获取详细信息对比
            // (优化：解决列表接口可能返回不完整或缓存数据的问题)
            if (!matched && items.length > 0) {
                const concurrency = EAGLE_ITEM_INFO_CONCURRENCY; // 并发数限制
                for (let i = 0; i < items.length; i += concurrency) {
                    const chunk = items.slice(i, i + concurrency);
                    const results = await Promise.all(
                        chunk.map(async (item) => {
                            try {
                                const infoData = await gmFetch(`http://localhost:41595/api/item/info?id=${item.id}`);
                                if (infoData && infoData.data && infoData.data.url === artworkUrl) {
                                    return item;
                                }
                            } catch (e) {
                                // 忽略单个获取失败
                            }
                            return null;
                        })
                    );

                    matched = results.find((r) => r);
                    if (matched) break;
                }
            }

            if (matched) {
                return {
                    saved: true,
                    itemId: matched.id,
                };
            }

            if (items.length === 0) break; // 空页：避免继续翻页
            if (items.length < limit) break;
            offset += items.length;
            loopCount += 1;
        }
    } catch (error) {
        err("检测作品保存状态失败:", error);
    }

    return { saved: false, itemId: null };
}

/**
 * 统计 folderId 内 url 匹配 https://www.pixiv.net/artworks/{artworkId} 的 item 数量。
 * @param {string} artworkId
 * @param {string} folderId
 * @returns {Promise<number>}
 */
export async function countArtworkItemsInFolder(artworkId, folderId) {
    if (!folderId) {
        return 0;
    }

    const artworkUrl = `https://www.pixiv.net/artworks/${artworkId}`;
    const limit = EAGLE_ITEM_LIST_LIMIT;

    try {
        let offset = 0;
        let loopCount = 0;
        let count = 0;

        while (loopCount < EAGLE_ITEM_LIST_MAX_PAGES) {
            const params = new URLSearchParams({
                folders: folderId,
                limit: limit.toString(),
                offset: offset.toString(),
            });

            const data = await gmFetch(`http://localhost:41595/api/item/list?${params.toString()}`);
            if (!data || !data.status) break;

            const items = Array.isArray(data.data)
                ? data.data
                : Array.isArray(data.data?.items)
                ? data.data.items
                : [];

            const fastMatchedIds = new Set();
            for (const item of items) {
                if (item.url === artworkUrl) {
                    fastMatchedIds.add(item.id);
                    count += 1;
                }
            }

            const needDeepCheck = items.filter((item) => !fastMatchedIds.has(item.id));
            if (needDeepCheck.length > 0) {
                const concurrency = EAGLE_ITEM_INFO_CONCURRENCY;
                for (let i = 0; i < needDeepCheck.length; i += concurrency) {
                    const chunk = needDeepCheck.slice(i, i + concurrency);
                    const results = await Promise.all(
                        chunk.map(async (item) => {
                            try {
                                const infoData = await gmFetch(`http://localhost:41595/api/item/info?id=${item.id}`);
                                if (infoData && infoData.data && infoData.data.url === artworkUrl) {
                                    return item.id;
                                }
                            } catch (e) {
                                // 忽略单个获取失败
                            }
                            return null;
                        })
                    );
                    for (const id of results) {
                        if (id) count += 1;
                    }
                }
            }

            if (items.length === 0) break;
            if (items.length < limit) break;
            offset += items.length;
            loopCount += 1;
        }

        return count;
    } catch (error) {
        err("统计作品数量失败:", error);
        return 0;
    }
}

function buildAddFromURLsItem(url, index, imageUrls, details, artworkId) {
    const baseTitle = details.illustTitle;
    const isMultiPage = imageUrls.length > 1;
    const artworkUrl = `https://www.pixiv.net/artworks/${artworkId}`;
    const useUploadDate = getUseUploadDate();
    const modificationTime = useUploadDate ? new Date(details.uploadDate).getTime() : undefined;
    const shouldSaveDescription = getSaveDescription();
    const annotation = shouldSaveDescription ? details.description : undefined;

    return {
        url,
        name: isMultiPage ? `${baseTitle}_${index}` : baseTitle,
        website: artworkUrl,
        tags: details.tags,
        ...(annotation && { annotation }),
        ...(modificationTime && { modificationTime }),
        ...(url.startsWith("data:") ? {} : {
            headers: { referer: "https://www.pixiv.net/" },
        }),
    };
}

// 保存图片到 Eagle
export async function saveToEagle(imageUrls, folderId, details, artworkId) {
    const data = await gmFetch("http://localhost:41595/api/item/addFromURLs", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            items: imageUrls.map((url, index) => buildAddFromURLsItem(url, index, imageUrls, details, artworkId)),
            folderId,
        }),
    });

    if (!data.status) {
        throw new Error("保存图片失败");
    }

    return data.data;
}

/**
 * 逐张提交，每张提交成功后通过注入的 waitForPersist 等待落盘确认。
 *
 * @param {string[]} imageUrls
 * @param {string} folderId
 * @param {object} details
 * @param {string} artworkId
 * @param {{
 *   onSubmitProgress?: (p: { current: number, total: number }) => void,
 *   onEagleProgress?: (p: { current: number, total: number }) => void,
 *   signal?: AbortSignal,
 *   baselineCount?: number,
 *   waitForPersist?: (args: {
 *     pageIndex: number,
 *     pageTotal: number,
 *     baselineCount: number,
 *     signal?: AbortSignal,
 *     onEagleProgress?: (p: { current: number, total: number }) => void,
 *   }) => Promise<void>,
 * }} [options]
 */
export async function saveToEagleSequential(imageUrls, folderId, details, artworkId, options = {}) {
    const { onSubmitProgress, onEagleProgress, signal, baselineCount = 0, waitForPersist } = options;
    const total = imageUrls.length;
    if (total === 0) {
        throw new Error("无图片可上传");
    }

    for (let i = 0; i < total; i++) {
        if (signal?.aborted) {
            const abortErr = new Error("保存已取消");
            abortErr.name = "AbortError";
            throw abortErr;
        }

        const url = imageUrls[i];
        const data = await gmFetch("http://localhost:41595/api/item/addFromURLs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: [buildAddFromURLsItem(url, i, imageUrls, details, artworkId)],
                folderId,
            }),
        });

        if (!data.status) {
            throw new Error(total > 1 ? `第 ${i + 1} 张提交失败` : "保存图片失败");
        }

        onSubmitProgress?.({ current: i + 1, total });

        if (waitForPersist) {
            await waitForPersist({
                pageIndex: i,
                pageTotal: total,
                baselineCount,
                signal,
                onEagleProgress,
            });
        }
    }

    const { itemId } = await isArtworkSavedInEagle(artworkId, folderId);
    return { itemId };
}

// 获取指定 Eagle 文件夹下所有 items（分页）
export async function getAllEagleItemsInFolder(folderId) {
    const limit = 200;
    let offset = 0;
    const items = [];

    while (true) {
        const params = new URLSearchParams({ folders: folderId, limit: String(limit), offset: String(offset) });
        const data = await gmFetch(`http://localhost:41595/api/item/list?${params.toString()}`);
        if (!data || !data.status) break;

        const pageItems = Array.isArray(data.data)
            ? data.data
            : Array.isArray(data.data?.items)
            ? data.data.items
            : [];
        if (!pageItems || pageItems.length === 0) break;

        items.push(...pageItems);
        if (pageItems.length < limit) break;
        offset += pageItems.length;
    }

    return items;
}
