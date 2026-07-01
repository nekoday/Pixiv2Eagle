"use strict";

import {
    getFolderId,
    getCreateSubFolder,
    getSaveByType,
} from "../tampermonkey/setting.js";
import { err } from "../tampermonkey/logger.js";
import { showMessage } from "../ui/toast.js";
import { checkEagle } from "../eagle/client.js";
import { createEagleFolder, getSeriesFolder } from "../eagle/folder.js";
import { getArtistFolder } from "../eagle/artist.js";
import { getTypeFolderInfo, getOrCreateTypeFolder } from "../eagle/type-folder.js";
import { saveToEagleSequential, getAllEagleItemsInFolder } from "../eagle/items.js";
import { publishSaved } from "../shared/marking/saved-event-bus.js";
import { waitForArtworkPersist, waitForFolderCountPersist } from "../eagle/save-poller.js";
import { convertUgoiraToGifBlob, blobToDataURL } from "./ugoira/convert.js";
import { getArtworkId } from "./id.js";
import { getArtworkDetails } from "./details.js";
import { createSaveProgressTask } from "../ui/save-progress/index.js";
import { SAVE_STAGE } from "../ui/save-progress/types.js";

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

    let task;
    try {
        task = createSaveProgressTask({
            artworkId,
            title: "加载中…",
            pageCount: 1,
        });
        task.reportStage(SAVE_STAGE.FETCHING, { current: 0, total: 1 });

        const details = await getArtworkDetails(artworkId);
        task.updateArtworkInfo({ title: details.illustTitle, pageCount: details.pageCount });
        task.reportStage(SAVE_STAGE.FETCHING, { current: 1, total: 1 });

        task.reportStage(SAVE_STAGE.FOLDER, { current: 0, total: 1 });

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

        task.reportStage(SAVE_STAGE.FOLDER, { current: 1, total: 1 });

        let imageUrls = details.originalUrls;
        if (details.illustType === 2) {
            task.reportStage(SAVE_STAGE.CONVERTING, { current: 0, total: 1 });
            const gifBlob = await convertUgoiraToGifBlob(artworkId, {
                signal: task.signal,
                onFrameProgress: ({ current, total }) => {
                    task.reportStage(SAVE_STAGE.CONVERTING, { current, total });
                    task.reportFrameProgress({ current, total });
                },
            });
            task.reportStage(SAVE_STAGE.CONVERTING, { current: 1, total: 1 });
            imageUrls = [await blobToDataURL(gifBlob)];
        }

        const pageTotal = imageUrls.length;

        // 多页：上传前在目标文件夹采集 baseline（不复用会话缓存）；单页用 isArtworkSavedInEagle 确认
        let baselineCount = 0;
        if (pageTotal > 1) {
            const baselineItems = await getAllEagleItemsInFolder(targetFolderId);
            baselineCount = baselineItems.length;
        }

        task.reportStage(SAVE_STAGE.UPLOADING, { current: 0, total: pageTotal });

        const waitForPersist = ({ pageIndex, pageTotal: pt, baselineCount: base, signal, onEagleProgress }) => {
            if (pt === 1) {
                return waitForArtworkPersist({
                    artworkId,
                    folderId: targetFolderId,
                    signal,
                    onProgress: () => onEagleProgress?.({ current: 1, total: 1 }),
                });
            }
            return waitForFolderCountPersist({
                folderId: targetFolderId,
                baselineCount: base,
                target: pageIndex + 1,
                signal,
                onProgress: (persisted) => onEagleProgress?.({ current: Math.min(persisted, pt), total: pt }),
            });
        };

        const { itemId } = await saveToEagleSequential(imageUrls, targetFolderId, details, artworkId, {
            signal: task.signal,
            baselineCount,
            onSubmitProgress: ({ current, total }) => {
                task.reportSubmitProgress({ current, total });
            },
            onEagleProgress: ({ current, total }) => {
                task.reportEagleProgress({ current, total });
            },
            waitForPersist,
        });

        const kind = details.illustType === 1 && details.seriesNavData ? "manga-chapter" : "artwork";
        publishSaved({
            kind,
            id: artworkId,
            userId: details.userId,
            folderId: targetFolderId,
            itemId,
            savedAt: Date.now(),
        });
        task.complete({ folderId: targetFolderId, itemId, pageCount: pageTotal, openSavedArtwork: true });
    } catch (error) {
        err(error);
        if (error.name === "AbortError") {
            if (!task.signal.aborted) task.abort();
            throw error;
        }
        const msg = error.message || "保存失败";
        task.fail(`${folderInfo}\n${msg}`.replace(/\n/g, " "));
        throw error;
    }
}
