"use strict";

import { getFolderId, getUseUploadDate, getSaveDescription } from "../Tampermonkey/setting.js";
import { dbg, err } from "../Tampermonkey/logger.js";
import { gmFetch } from "../Tampermonkey/request.js";
import { removeChapterNumber } from "../shared/chapter-title.js";
import {
    EAGLE_ITEM_LIST_LIMIT,
    EAGLE_ITEM_LIST_MAX_PAGES,
    EAGLE_ITEM_INFO_CONCURRENCY,
} from "../config/constants.js";
import { SERIES_NAV_BUTTON_SELECTOR } from "../config/selectors/index.js";
import { findArtistFolder } from "./artist.js";
import { getTypeFolderInfo } from "./type-folder.js";
import { getArtworkDetails } from "../artwork/details.js";
import { convertUgoiraToGifBlob, blobToDataURL } from "../artwork/ugoira/convert.js";

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

// 在画师文件夹中查找指定系列文件夹（不创建）
export function findSeriesFolderInArtist(artistFolder, artistId, seriesId) {
    if (!artistFolder || !artistFolder.children) return null;

    // 调试：打印所有子文件夹的描述，帮助排查匹配失败原因
    dbg(`正在画师文件夹中查找系列 ${seriesId}，子文件夹数量: ${artistFolder.children.length}`);

    return artistFolder.children.find((folder) => {
        const description = (folder.description || "").trim();
        // 宽松匹配：允许 http/https，允许末尾斜杠，允许描述中包含额外空白
        // 同时也尝试匹配仅包含 URL 的情况
        const urlPattern = new RegExp(`https?:\\/\\/www\\.pixiv\\.net\\/user\\/${artistId}\\/series\\/${seriesId}\\/?`);
        const match = description.match(urlPattern);

        if (description) {
            dbg(`检查文件夹: ${folder.name}, 描述: ${description}, 匹配结果: ${!!match}`);
        }

        return !!match;
    });
}

// 查找已保存作品所在的文件夹（包含系列与子文件夹描述）
export async function findSavedFolderForArtwork(artworkId) {
    try {
        const details = await getArtworkDetails(artworkId);
        const pixivFolderId = getFolderId();
        const artistFolder = await findArtistFolder(pixivFolderId, details.userId);
        if (!artistFolder) return null;

        dbg(`开始查找作品: ${artworkId}, 标题: ${details.title}`);

        // 检查当前页面是否为漫画系列（通过"加入追更列表"按钮判断）
        const isSeriesPage = !!document.querySelector(SERIES_NAV_BUTTON_SELECTOR);

        // 默认在画师文件夹检查，如有系列或当前为系列页面则进入系列文件夹
        let currentFolder = artistFolder;

        // 如果开启了按类型保存，或者为了兼容性，检查类型文件夹
        // 注意：这里我们不强制切换 currentFolder，而是增加搜索路径
        // 但为了保持逻辑简单，我们先尝试定位到最具体的文件夹

        // 尝试定位系列文件夹
        if (details.seriesNavData || isSeriesPage) {
            const seriesId =
                details.seriesNavData?.seriesId || (location.pathname.match(/\/series\/(\d+)/) || [])[1];
            if (seriesId) {
                // 1. 在画师根目录下找系列
                let seriesFolder = findSeriesFolderInArtist(artistFolder, details.userId, seriesId);

                // 2. 如果没找到，且可能在类型文件夹下（如“漫画”文件夹）
                if (!seriesFolder && artistFolder.children) {
                    const typeFolders = artistFolder.children.filter((c) =>
                        ["illustrations", "manga", "novels"].includes(c.description)
                    );
                    for (const tf of typeFolders) {
                        seriesFolder = findSeriesFolderInArtist(tf, details.userId, seriesId);
                        if (seriesFolder) break;
                    }
                }

                if (seriesFolder) {
                    currentFolder = seriesFolder;
                }
            }
        } else {
            // 如果不是系列，可能是单幅插画，检查是否在类型文件夹中
            // 优先检查类型文件夹
            if (artistFolder.children) {
                const typeInfo = getTypeFolderInfo(details.illustType);
                const typeFolder = artistFolder.children.find((c) => c.description === typeInfo.description);
                if (typeFolder) {
                    // 如果找到了类型文件夹，我们应该检查它里面的 items
                    // 但我们也应该检查画师根目录，以防旧数据
                    // 这里我们暂时只切换 currentFolder 如果它确实包含该作品?
                    // 不，isArtworkSavedInEagle 只检查一个文件夹。
                    // 我们需要更灵活的检查。

                    // 策略：先检查类型文件夹，再检查画师文件夹
                    const savedInType = await isArtworkSavedInEagle(artworkId, typeFolder.id);
                    if (savedInType.saved) {
                        return { folder: typeFolder, itemId: savedInType.itemId };
                    }
                    // 如果没在类型文件夹找到，继续使用 artistFolder (currentFolder) 进行后续检查
                }
            }
        }

        // 先检查当前文件夹中的作品
        const savedResult = await isArtworkSavedInEagle(artworkId, currentFolder.id);
        if (savedResult.saved) {
            return { folder: currentFolder, itemId: savedResult.itemId || null };
        }

        // 再检查当前文件夹及其所有子文件夹中的 description 是否等于作品 ID（递归）
        function findInSubfolders(folder) {
            if (!folder || !folder.children) return null;
            for (const child of folder.children) {
                const desc = (child.description || "").trim();
                if (desc === String(artworkId)) {
                    return child;
                }
                // 递归查找更深层的子文件夹
                const found = findInSubfolders(child);
                if (found) return found;
            }
            return null;
        }
        const savedChild = findInSubfolders(currentFolder);
        if (savedChild) {
            return { folder: savedChild, itemId: null };
        }

        // 3. 尝试通过标题在画师文件夹及其子文件夹中搜索 (弥补上述检查可能遗漏的情况)
        if (details.illustTitle) {
            try {
                // 收集画师文件夹及其所有子文件夹的 ID
                const allFolderIds = [artistFolder.id];
                function collectFolderIds(folder) {
                    if (folder.children) {
                        folder.children.forEach((child) => {
                            allFolderIds.push(child.id);
                            collectFolderIds(child);
                        });
                    }
                }
                collectFolderIds(artistFolder);

                // 移除标题中的序号部分，以便进行模糊匹配
                const searchKeyword = removeChapterNumber(details.illustTitle);

                dbg(
                    `尝试通过标题搜索: "${searchKeyword}" (原标题: "${details.illustTitle}"), 搜索范围: ${allFolderIds.length} 个文件夹`
                );

                const params = new URLSearchParams({
                    folders: allFolderIds.join(","),
                    keyword: searchKeyword,
                    limit: "50",
                });
                // 注意：Eagle 的 keyword 搜索是模糊匹配
                const searchUrl = `http://localhost:41595/api/item/list?${params.toString()}`;
                const data = await gmFetch(searchUrl);

                if (data && data.status === "success") {
                    const items = Array.isArray(data.data) ? data.data : data.data?.items || [];
                    const artworkUrl = `https://www.pixiv.net/artworks/${artworkId}`;

                    dbg(`标题搜索结果: 找到 ${items.length} 个项目`);

                    // 优先检查 URL 匹配
                    let matched = items.find((item) => item.url === artworkUrl);

                    // 如果没有直接匹配，尝试获取详细信息验证 (深度检查)
                    if (!matched && items.length > 0) {
                        dbg(`列表 URL 未匹配，尝试深度检查 ${items.length} 个项目...`);
                        const concurrency = 5;
                        for (let i = 0; i < items.length; i += concurrency) {
                            const chunk = items.slice(i, i + concurrency);
                            const results = await Promise.all(
                                chunk.map(async (item) => {
                                    try {
                                        const infoData = await gmFetch(
                                            `http://localhost:41595/api/item/info?id=${item.id}`
                                        );
                                        if (infoData && infoData.data && infoData.data.url === artworkUrl) {
                                            return item;
                                        }
                                    } catch (e) {
                                        return null;
                                    }
                                    return null;
                                })
                            );
                            matched = results.find((r) => r);
                            if (matched) break;
                        }
                    }

                    if (matched) {
                        dbg(`✅ 通过标题搜索找到已保存作品:`, matched.id);
                        return { folder: artistFolder, itemId: matched.id };
                    } else {
                        dbg(`❌ 标题搜索未找到匹配 URL 的作品`);
                    }
                }
            } catch (error) {
                err("通过标题搜索失败:", error);
            }
        } else {
            dbg(`❌ 无法获取作品标题，跳过标题搜索`);
        }

        return null;
    } catch (error) {
        err("定位已保存作品文件夹失败:", error);
        return null;
    }
}

// 保存图片到 Eagle
export async function saveToEagle(imageUrls, folderId, details, artworkId) {
    async function getUgoiraUrl(artworkId) {
        const gifBlob = await convertUgoiraToGifBlob(artworkId);
        const [base64, dataURL] = await (async () => {
            const du = await blobToDataURL(gifBlob);
            const comma = du.indexOf(",");
            return [du.substring(comma + 1), du];
        })();
        return dataURL;
    }

    // 如果是动图（ugoira），先转换为 GIF 并保存
    const isUgoira = details.illustType === 2;
    if (isUgoira) {
        imageUrls = [await getUgoiraUrl(artworkId)];
    }

    const baseTitle = details.illustTitle;
    const isMultiPage = imageUrls.length > 1;
    const artworkUrl = `https://www.pixiv.net/artworks/${artworkId}`;

    // 根据设置决定是否使用投稿时间
    const useUploadDate = getUseUploadDate();
    const modificationTime = useUploadDate ? new Date(details.uploadDate).getTime() : undefined;

    // 根据设置决定是否保存描述
    const shouldSaveDescription = getSaveDescription();
    const annotation = shouldSaveDescription ? details.description : undefined;

    // 批量添加图片
    const data = await gmFetch("http://localhost:41595/api/item/addFromURLs", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            items: imageUrls.map((url, index) => ({
                url,
                name: isMultiPage ? `${baseTitle}_${index}` : baseTitle,
                website: artworkUrl,
                tags: details.tags,
                ...(annotation && { annotation }),
                ...(modificationTime && { modificationTime }),
                ...(!isUgoira && {
                    headers: {
                        referer: "https://www.pixiv.net/",
                    },
                }),
            })),
            folderId,
        }),
    });

    if (!data.status) {
        throw new Error("保存图片失败");
    }

    return data.data;
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
