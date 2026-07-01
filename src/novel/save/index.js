"use strict";

import {
    getFolderId,
    getSaveByType,
    getNovelSavePath,
    getNovelSaveFormat,
} from "../../tampermonkey/setting.js";
import { dbg, err } from "../../tampermonkey/logger.js";
import { gmFetch } from "../../tampermonkey/request.js";
import { showMessage } from "../../ui/toast.js";
import { checkEagle } from "../../eagle/client.js";
import { createEagleFolder } from "../../eagle/folder.js";
import { getArtistFolder } from "../../eagle/artist.js";
import { getTypeFolderInfo, getOrCreateTypeFolder } from "../../eagle/type-folder.js";
import { waitForFolderCountPersist } from "../../eagle/save-poller.js";
import { blobToDataURL } from "../../artwork/ugoira/convert.js";
import { getNovelId } from "../id.js";
import { getNovelDetails } from "../details.js";
import { combineNovelContent } from "../content.js";
import { downloadFile } from "../download.js";
import { generateEPUB } from "./epub.js";
import { prepareNovelTextOrMarkdownItems } from "./text-markdown.js";
import { publishSaved } from "../../shared/marking/saved-event-bus.js";
import { createSaveProgressTask } from "../../ui/save-progress/index.js";
import { SAVE_STAGE } from "../../ui/save-progress/types.js";

export async function saveCurrentNovel() {
    const folderId = getFolderId();
    const folderInfo = folderId ? `Pixiv 文件夹 ID: ${folderId}` : "未设置 Pixiv 文件夹 ID";

    let eagleStatus;
    try {
        eagleStatus = await checkEagle();
    } catch (error) {
        showMessage(`${folderInfo}\n检查 Eagle 状态时出错: ${error.message}`, true);
        return;
    }
    if (!eagleStatus || !eagleStatus.running) {
        showMessage(`${folderInfo}\nEagle 未启动，请先启动 Eagle 应用！`, true);
        return;
    }

    const novelId = getNovelId();
    if (!novelId) {
        showMessage("无法获取小说 ID", true);
        return;
    }

    let task;
    try {
        task = createSaveProgressTask({ artworkId: novelId, title: "加载中…", pageCount: 1 });
        task.reportStage(SAVE_STAGE.FETCHING, { current: 0, total: 1 });

        const details = await getNovelDetails(novelId);
        if (!details.authorId) {
            throw new Error("无法获取作者信息");
        }
        task.updateArtworkInfo({ title: details.title, pageCount: 1 });
        task.reportStage(SAVE_STAGE.FETCHING, { current: 1, total: 1 });

        task.reportStage(SAVE_STAGE.FOLDER, { current: 0, total: 1 });

        const artistFolder = await getArtistFolder(folderId, details.authorId, details.authorName);
        let targetParentId = artistFolder.id;
        let parentFolderObj = artistFolder;

        if (getSaveByType()) {
            const typeInfo = getTypeFolderInfo("novel");
            const typeFolder = await getOrCreateTypeFolder(artistFolder, typeInfo);
            if (typeFolder) {
                targetParentId = typeFolder.id;
                parentFolderObj = typeFolder;
            }
        }

        if (details.seriesId) {
            const seriesUrl = `https://www.pixiv.net/novel/series/${details.seriesId}`;
            let seriesFolderId = null;

            if (parentFolderObj && parentFolderObj.children) {
                const existingSeries = parentFolderObj.children.find((c) => c.description === seriesUrl);
                if (existingSeries) {
                    seriesFolderId = existingSeries.id;
                    parentFolderObj = existingSeries;
                }
            }

            if (!seriesFolderId) {
                let cleanSeriesTitle = details.seriesTitle;
                if (cleanSeriesTitle.startsWith("系列")) {
                    cleanSeriesTitle = cleanSeriesTitle.substring(2).trim();
                }
                const seriesFolderName = `系列:${cleanSeriesTitle}`;
                seriesFolderId = await createEagleFolder(seriesFolderName, targetParentId, seriesUrl);
                if (parentFolderObj && parentFolderObj.children) {
                    const newSeriesObj = { id: seriesFolderId, name: seriesFolderName, description: seriesUrl, children: [] };
                    parentFolderObj.children.push(newSeriesObj);
                    parentFolderObj = newSeriesObj;
                }
            }
            targetParentId = seriesFolderId;
        }

        let folderName = details.title;
        if (details.chapterNumber) {
            folderName = `${details.chapterNumber} ${details.title}`;
        }
        const chapterFolderId = await createEagleFolder(folderName, targetParentId, details.id);

        task.reportStage(SAVE_STAGE.FOLDER, { current: 1, total: 1 });

        const novelUrl = `https://www.pixiv.net/novel/show.php?id=${details.id}`;

        /** @type {Array<() => Promise<void>>} */
        const addOps = [];

        if (details.coverUrl) {
            addOps.push(async () => {
                await gmFetch("http://localhost:41595/api/item/addFromURLs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        items: [{
                            url: details.coverUrl,
                            name: "cover.jpg",
                            website: novelUrl,
                            tags: [],
                            headers: { referer: "https://www.pixiv.net/" },
                        }],
                        folderId: chapterFolderId,
                    }),
                });
            });
        }

        if (details.description) {
            addOps.push(async () => {
                const descBlob = new Blob([details.description], { type: "text/plain" });
                const descDataUrl = await blobToDataURL(descBlob);
                const base64 = descDataUrl.split(",")[1];
                await gmFetch("http://localhost:41595/api/item/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "简介",
                        ext: "txt",
                        base64,
                        website: novelUrl,
                        annotation: details.id,
                        tags: [],
                        folderId: chapterFolderId,
                    }),
                });
            });
        }

        if (details.content) {
            const saveFormat = getNovelSaveFormat();

            if (saveFormat === "epub") {
                task.reportStage(SAVE_STAGE.CONVERTING, { current: 0, total: 1 });
                const combinedContent = combineNovelContent(details);
                const epubBlob = await generateEPUB(
                    details,
                    combinedContent,
                    (percent) => task.reportStage(SAVE_STAGE.CONVERTING, { current: percent, total: 100 }),
                    task.signal,
                );
                task.reportStage(SAVE_STAGE.CONVERTING, { current: 1, total: 1 });

                let titleWithNumber = details.title;
                if (details.chapterNumber) {
                    titleWithNumber = `${details.chapterNumber} ${details.title}`;
                }
                const safeTitle = titleWithNumber.replace(/[\\/:*?"<>|]/g, "_");
                const epubFilename = `${safeTitle}.epub`;
                downloadFile(epubBlob, epubFilename);

                await new Promise((resolve) => setTimeout(resolve, 2000));

                const basePath = getNovelSavePath();
                let epubPath;
                if (basePath) {
                    const separator = basePath.includes("\\") ? "\\" : "/";
                    const normalizedBasePath = basePath.endsWith("\\") || basePath.endsWith("/")
                        ? basePath.slice(0, -1)
                        : basePath;
                    epubPath = `${normalizedBasePath}${separator}${epubFilename}`;
                } else {
                    epubPath = prompt(
                        `请输入 EPUB 文件的完整路径：\n\n文件名：${epubFilename}\n\n示例：C:\\Users\\YourName\\Downloads\\${epubFilename}`,
                        "",
                    );
                    if (!epubPath) {
                        throw new Error("未提供 EPUB 文件路径");
                    }
                    epubPath = epubPath.trim();
                }

                const epubTags = details.tags || [];
                dbg("保存 EPUB 文件，标签:", epubTags);
                addOps.push(async () => {
                    const addResult = await gmFetch("http://localhost:41595/api/item/addFromPath", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            path: epubPath,
                            name: epubFilename,
                            website: novelUrl,
                            annotation: details.id,
                            tags: epubTags,
                            folderId: chapterFolderId,
                        }),
                    });
                    if (!addResult || !addResult.status) {
                        err("添加 EPUB 文件失败:", epubPath, addResult);
                        throw new Error("添加 EPUB 文件到 Eagle 失败");
                    }
                });
            } else {
                const textItems = await prepareNovelTextOrMarkdownItems(details, null, chapterFolderId);
                for (const item of textItems) {
                    addOps.push(async () => {
                        const addResult = await gmFetch("http://localhost:41595/api/item/addFromPath", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(item),
                        });
                        if (!addResult || !addResult.status) {
                            err("添加文件失败:", item.path, addResult);
                            throw new Error(`添加文件到 Eagle 失败: ${item.name || item.path}`);
                        }
                    });
                }
            }
        }

        const total = addOps.length;
        if (total > 0) {
            task.reportStage(SAVE_STAGE.UPLOADING, { current: 0, total });
            for (let i = 0; i < total; i++) {
                if (task.signal.aborted) {
                    const abortErr = new Error("保存已取消");
                    abortErr.name = "AbortError";
                    throw abortErr;
                }
                await addOps[i]();
                task.reportSubmitProgress({ current: i + 1, total });
                await waitForFolderCountPersist({
                    folderId: chapterFolderId,
                    baselineCount: 0,
                    target: i + 1,
                    signal: task.signal,
                    onProgress: (persisted) => task.reportEagleProgress({ current: Math.min(persisted, total), total }),
                });
            }
        }

        publishSaved({
            kind: "novel",
            id: novelId,
            userId: details.authorId,
            folderId: chapterFolderId,
            savedAt: Date.now(),
        });
        task.complete({ folderId: chapterFolderId });
    } catch (error) {
        err(error);
        if (error.name === "AbortError") {
            if (task && !task.signal.aborted) task.abort();
            return;
        }
        if (task) {
            task.fail(`保存小说失败: ${error.message}`.replace(/\n/g, " "));
        } else {
            showMessage(`保存小说失败: ${error.message}`, true);
        }
    }
}
