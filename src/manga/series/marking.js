"use strict";

import { err } from "../../Tampermonkey/logger.js";
import { findArtistFolder } from "../../eagle/artist.js";
import { getAllEagleItemsInFolder } from "../../eagle/items.js";
import { findMangaSeriesFolderInArtistTree } from "./folder.js";
import { addUpdateSeriesButton } from "./ui-update-button.js";

/** markSavedInArtistList 中 /series/ 页面分支：扩展 urlSet 与 folderDescSet */
export async function enrichMarkingContextForMangaSeriesPage({
    pixivFolderId,
    artistId,
    urlSet,
    folderDescSet,
    folderDescMap,
    log,
}) {
    addUpdateSeriesButton();

    log("检测到系列页面，开始处理系列文件夹");
    try {
        const seriesMatch = location.pathname.match(/\/series\/(\d+)/);
        const seriesId = seriesMatch ? seriesMatch[1] : null;
        log("系列ID:", seriesId);
        if (!seriesId) return;

        const updatedArtistFolder = await findArtistFolder(pixivFolderId, artistId);
        if (!updatedArtistFolder) {
            log("系列页面但无法重新获取画师文件夹");
            return;
        }

        log("已重新获取画师文件夹，查找系列文件夹");
        const seriesFolder = findMangaSeriesFolderInArtistTree(updatedArtistFolder, artistId, seriesId);

        if (seriesFolder) {
            log(
                "找到系列文件夹:",
                seriesFolder.id,
                "，名称:",
                seriesFolder.name,
                "，将递归检查其 items 与子文件夹描述"
            );

            async function collectSeriesFolderItems(folder) {
                if (!folder || !folder.id) return;
                try {
                    const folderItems = await getAllEagleItemsInFolder(folder.id);
                    log("系列文件夹", folder.id, "中 items 数量:", folderItems ? folderItems.length : 0);
                    for (const it of folderItems || []) if (it && it.url) urlSet.add(it.url);
                } catch (e) {
                    err("拉取系列文件夹 items 失败:", folder.id, e);
                }
                if (!folder.children || folder.children.length === 0) return;
                for (const child of folder.children) {
                    const d = (child.description || "").trim();
                    if (d) {
                        folderDescSet.add(d);
                        folderDescMap[d] = child.id;
                    }
                    await collectSeriesFolderItems(child);
                }
            }
            await collectSeriesFolderItems(seriesFolder);
            log("系列页面递归收集完成，urlSet 大小:", urlSet.size, "，folderDescSet 大小:", folderDescSet.size);
        } else {
            log("系列页面但未在 Eagle 中找到对应系列文件夹（seriesId:", seriesId, "）");
            log(
                "画师文件夹子目录列表:",
                updatedArtistFolder.children.map((c) => `${c.name} (${c.description})`).join(", ")
            );
        }
    } catch (e) {
        err("处理系列页面时出错:", e);
    }
}
