"use strict";

import { err } from "../../tampermonkey/logger.js";
import { gmFetch } from "../../tampermonkey/request.js";
import { getNovelSavePath } from "../../tampermonkey/setting.js";
import { showMessage } from "../../ui/toast.js";
import { combineNovelContent } from "../content.js";
import { downloadNovelFiles, getFilePaths } from "../download.js";

export async function saveNovelAsTextOrMarkdown(details, combinedContent, chapterFolderId) {
    if (!combinedContent) {
        combinedContent = combineNovelContent(details);
    }

    let titleWithNumber = details.title;
    if (details.chapterNumber) {
        titleWithNumber = `${details.chapterNumber} ${details.title}`;
    }

    showMessage("正在下载小说文件，请选择保存位置...", false);
    const downloadedFiles = await downloadNovelFiles(combinedContent, titleWithNumber, details.id);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const basePath = getNovelSavePath();
    const filePaths = await getFilePaths(downloadedFiles.novelFilename, downloadedFiles.imageFilenames, basePath);

    const novelExt = combinedContent.format === "md" ? "md" : "txt";
    const safeTitle = titleWithNumber.replace(/[\\/:*?"<>|]/g, "_");
    const novelUrl = `https://www.pixiv.net/novel/show.php?id=${details.id}`;

    const items = [];

    items.push({
        path: filePaths.novelPath,
        name: `${safeTitle}.${novelExt}`,
        website: novelUrl,
        annotation: details.id,
        tags: details.tags || [],
        folderId: chapterFolderId,
    });

    if (filePaths.imagePaths.length > 0 && combinedContent.images) {
        for (let i = 0; i < filePaths.imagePaths.length; i++) {
            const imagePath = filePaths.imagePaths[i];
            const imageInfo = combinedContent.images[i];

            if (imagePath && imageInfo) {
                items.push({
                    path: imagePath,
                    name: imageInfo.filename,
                    website: novelUrl,
                    annotation: details.id,
                    tags: details.tags || [],
                    folderId: chapterFolderId,
                });
            }
        }
    }

    if (items.length > 0) {
        try {
            for (const item of items) {
                const addResult = await gmFetch("http://localhost:41595/api/item/addFromPath", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(item),
                });

                if (!addResult || !addResult.status) {
                    err("添加文件失败:", item.path, addResult);
                    throw new Error(`添加文件到 Eagle 失败: ${item.name || item.path}`);
                }
            }
        } catch (error) {
            err("添加小说文件到 Eagle 失败:", error);
            throw error;
        }
    }
}
