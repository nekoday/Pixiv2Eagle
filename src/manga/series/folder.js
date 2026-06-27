"use strict";

import { dbg } from "../../Tampermonkey/logger.js";

const TYPE_FOLDER_DESCRIPTIONS = ["illustrations", "manga", "novels"];

/** 在画师（或类型）文件夹中查找漫画系列文件夹（不创建） */
export function findMangaSeriesFolder(artistFolder, artistId, seriesId) {
    if (!artistFolder || !artistFolder.children) return null;

    dbg(`正在画师文件夹中查找系列 ${seriesId}，子文件夹数量: ${artistFolder.children.length}`);

    return artistFolder.children.find((folder) => {
        const description = (folder.description || "").trim();
        const urlPattern = new RegExp(
            `https?:\\/\\/www\\.pixiv\\.net\\/user\\/${artistId}\\/series\\/${seriesId}\\/?`
        );
        const match = description.match(urlPattern);

        if (description) {
            dbg(`检查文件夹: ${folder.name}, 描述: ${description}, 匹配结果: ${!!match}`);
        }

        return !!match;
    });
}

/** 在画师根目录及类型子文件夹中查找漫画系列文件夹 */
export function findMangaSeriesFolderInArtistTree(artistFolder, artistId, seriesId) {
    let seriesFolder = findMangaSeriesFolder(artistFolder, artistId, seriesId);

    if (!seriesFolder && artistFolder?.children) {
        const typeFolders = artistFolder.children.filter((c) =>
            TYPE_FOLDER_DESCRIPTIONS.includes(c.description)
        );
        for (const tf of typeFolders) {
            seriesFolder = findMangaSeriesFolder(tf, artistId, seriesId);
            if (seriesFolder) break;
        }
    }

    return seriesFolder;
}

/** @deprecated 兼容旧名，Phase 7 小说系列改用 findNovelSeriesFolder */
export { findMangaSeriesFolder as findSeriesFolderInArtist };
