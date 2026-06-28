"use strict";

import { getFolderId } from "../tampermonkey/setting.js";
import { dbg, err } from "../tampermonkey/logger.js";
import { gmFetch } from "../tampermonkey/request.js";
import { removeChapterNumber } from "../shared/chapter-title.js";
import { SERIES_NAV_BUTTON_SELECTOR } from "../config/selectors/index.js";
import { findArtistFolder } from "../eagle/artist.js";
import { getTypeFolderInfo } from "../eagle/type-folder.js";
import { isArtworkSavedInEagle } from "../eagle/items.js";
import { findMangaSeriesFolderInArtistTree } from "../manga/series/folder.js";
import { getArtworkDetails } from "./details.js";

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
                const seriesFolder = findMangaSeriesFolderInArtistTree(artistFolder, details.userId, seriesId);
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
