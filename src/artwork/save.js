"use strict";

import {
    getFolderId,
    getCreateSubFolder,
    getSaveByType,
} from "../Tampermonkey/setting.js";
import { err } from "../Tampermonkey/logger.js";
import { showMessage } from "../ui/toast.js";
import { checkEagle } from "../eagle/client.js";
import { createEagleFolder, getSeriesFolder } from "../eagle/folder.js";
import { getArtistFolder } from "../eagle/artist.js";
import { getTypeFolderInfo, getOrCreateTypeFolder } from "../eagle/type-folder.js";
import { saveToEagle } from "../eagle/items.js";
import { invalidateEagleIndex } from "../eagle/index-cache.js";
import { getArtworkId } from "./id.js";
import { getArtworkDetails } from "./details.js";

// 保存当前作品到 Eagle
export async function saveCurrentArtwork() {
    const folderId = getFolderId();
    const folderInfo = folderId ? `Pixiv 文件夹 ID: ${folderId}` : "未设置 Pixiv 文件夹 ID";

    const eagleStatus = await checkEagle();
    if (!eagleStatus.running) {
        showMessage(`${folderInfo}\nEagle 未启动，请先启动 Eagle 应用！`, true);
        return;
    }

    const artworkId = getArtworkId();
    if (!artworkId) {
        showMessage("无法获取作品 ID", true);
        return;
    }

    try {
        const details = await getArtworkDetails(artworkId);

        const artistFolder = await getArtistFolder(folderId, details.userId, details.userName);
        let targetFolderId = artistFolder.id;
        let parentFolderObj = artistFolder;

        if (getSaveByType()) {
            const typeInfo = getTypeFolderInfo(details.illustType);
            const typeFolder = await getOrCreateTypeFolder(artistFolder, typeInfo);
            if (typeFolder) {
                targetFolderId = typeFolder.id;
                parentFolderObj = typeFolder;
            }
        }

        if (details.illustType === 1 && details.seriesNavData) {
            const seriesId = details.seriesNavData.seriesId;
            const seriesTitle = details.seriesNavData.title;
            const seriesFolder = await getSeriesFolder(parentFolderObj, details.userId, seriesId, seriesTitle);
            targetFolderId = seriesFolder.id;
        }

        if (
            details.illustType === 1 ||
            (getCreateSubFolder() === "multi-page" && details.pageCount > 1) ||
            getCreateSubFolder() === "always"
        ) {
            targetFolderId = await createEagleFolder(details.illustTitle, targetFolderId, artworkId);
        }

        await saveToEagle(details.originalUrls, targetFolderId, details, artworkId);

        invalidateEagleIndex();

        const message = [
            `✅ ${details.illustType === 2 ? "动图已转换为 GIF 并" : "图片已成功"}保存到 Eagle`,
            "----------------------------",
            folderInfo,
            `画师专属文件夹: ${artistFolder.name} (ID: ${artistFolder.id})`,
            "----------------------------",
            `Eagle版本: ${eagleStatus.version}`,
            "----------------------------",
            `作品ID: ${artworkId}`,
            `作者: ${details.userName} (ID: ${details.userId})`,
            `作品名称: ${details.illustTitle}`,
            `作品类型： ${details.illustType === 2 ? "动图 (ugoira)" : details.illustType === 1 ? "漫画" : "插画"}`,
            `页数: ${details.pageCount}`,
            `上传时间: ${details.uploadDate}`,
            `标签: ${details.tags.join(", ")}`,
        ].join("\n");

        showMessage(message);
    } catch (error) {
        err(error);
        showMessage(`${folderInfo}\n保存图片失败: ${error.message}`, true);
    }
}
