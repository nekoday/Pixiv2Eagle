"use strict";

import {
    getFolderId,
    getSaveByType,
    getNovelSavePath,
    getNovelSaveFormat,
} from "../../Tampermonkey/setting.js";
import { dbg, err } from "../../Tampermonkey/logger.js";
import { gmFetch } from "../../Tampermonkey/request.js";
import { showMessage } from "../../ui/toast.js";
import { EAGLE_SAVE_BUTTON_ID } from "../../config/constants.js";
import { checkEagle } from "../../eagle/client.js";
import { createEagleFolder } from "../../eagle/folder.js";
import { getArtistFolder } from "../../eagle/artist.js";
import { getTypeFolderInfo, getOrCreateTypeFolder } from "../../eagle/type-folder.js";
import { blobToDataURL } from "../../artwork/ugoira/convert.js";
import { getNovelId } from "../id.js";
import { getNovelDetails } from "../details.js";
import { combineNovelContent } from "../content.js";
import { downloadFile } from "../download.js";
import { createEPUBProgressWindow, generateEPUB } from "./epub.js";
import { saveNovelAsTextOrMarkdown } from "./text-markdown.js";
import { updateNovelSaveButtonIfSaved } from "../ui/saved-state.js";

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
        const errorMsg = `${folderInfo}\nEagle 未启动，请先启动 Eagle 应用！`;
        showMessage(errorMsg, true);
        return;
    }

    const novelId = getNovelId();
    if (!novelId) {
        showMessage("无法获取小说 ID", true);
        return;
    }

    try {
        const details = await getNovelDetails(novelId);
        if (!details.authorId) {
            throw new Error("无法获取作者信息");
        }

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

        if (details.coverUrl) {
            await gmFetch("http://localhost:41595/api/item/addFromURLs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: [{
                        url: details.coverUrl,
                        name: "cover.jpg",
                        website: `https://www.pixiv.net/novel/show.php?id=${details.id}`,
                        tags: [],
                        headers: { referer: "https://www.pixiv.net/" },
                    }],
                    folderId: chapterFolderId,
                }),
            });
        }

        if (details.description) {
            const descBlob = new Blob([details.description], { type: "text/plain" });
            const descDataUrl = await blobToDataURL(descBlob);
            const base64 = descDataUrl.split(",")[1];

            await gmFetch("http://localhost:41595/api/item/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "简介",
                    ext: "txt",
                    base64: base64,
                    website: `https://www.pixiv.net/novel/show.php?id=${details.id}`,
                    annotation: details.id,
                    tags: [],
                    folderId: chapterFolderId,
                }),
            });
        }

        if (details.content) {
            const saveFormat = getNovelSaveFormat();

            if (saveFormat === "epub") {
                const progressWindow = createEPUBProgressWindow();
                try {
                    const combinedContent = combineNovelContent(details);

                    let epubBlob;
                    try {
                        epubBlob = await generateEPUB(details, combinedContent, progressWindow);
                    } catch (genError) {
                        throw genError;
                    }

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

                    const novelUrl = `https://www.pixiv.net/novel/show.php?id=${details.id}`;
                    const epubTags = details.tags || [];
                    dbg("保存 EPUB 文件，标签:", epubTags);
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
                } catch (error) {
                    err("生成或保存 EPUB 失败:", error);
                    throw error;
                } finally {
                    if (progressWindow) {
                        progressWindow.close();
                    }
                }
            } else {
                await saveNovelAsTextOrMarkdown(details, null, chapterFolderId);
            }
        }

        showMessage(`✅ 小说 "${details.title}" 已保存到 Eagle`);

        const saveButton = document.querySelector(`#${EAGLE_SAVE_BUTTON_ID} div:last-child`);
        if (saveButton) {
            saveButton.textContent = "已保存";
            updateNovelSaveButtonIfSaved(saveButton);
        }
    } catch (error) {
        err(error);
        showMessage(`保存小说失败: ${error.message}`, true);
    }
}
