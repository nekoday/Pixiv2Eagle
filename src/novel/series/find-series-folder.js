"use strict";

import { dbg } from "../../Tampermonkey/logger.js";

/**
 * 在画师文件夹（或 novels 子文件夹）中查找小说系列文件夹
 * @param {object} artistFolder - Eagle 文件夹节点
 * @param {string} seriesId - Pixiv novel series id
 * @returns {object|null}
 */
export function findNovelSeriesFolder(artistFolder, seriesId) {
    if (!artistFolder || !artistFolder.children) return null;

    const urlPattern = new RegExp(
        `https?:\\/\\/www\\.pixiv\\.net\\/novel\\/series\\/${seriesId}\\/?`
    );

    function searchInFolder(folder) {
        if (!folder.children) return null;
        return folder.children.find((child) => {
            const description = (child.description || "").trim();
            const match = description.match(urlPattern);
            if (description) {
                dbg(`检查小说系列文件夹: ${child.name}, 描述: ${description}, 匹配: ${!!match}`);
            }
            return !!match;
        });
    }

    let found = searchInFolder(artistFolder);
    if (found) return found;

    const novelsFolder = artistFolder.children.find((c) => c.description === "novels");
    if (novelsFolder) {
        found = searchInFolder(novelsFolder);
    }
    return found || null;
}
