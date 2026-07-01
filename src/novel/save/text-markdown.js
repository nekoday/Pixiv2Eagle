"use strict";

import { getNovelSavePath } from "../../tampermonkey/setting.js";
import { combineNovelContent } from "../content.js";
import { downloadNovelFiles, getFilePaths } from "../download.js";

/**
 * 准备 txt/md 小说文件并返回待 add 到 Eagle 的 items（不在此处 POST）。
 * @returns {Promise<Array<{ path: string, name: string, website: string, annotation: string, tags: string[], folderId: string }>>}
 */
export async function prepareNovelTextOrMarkdownItems(details, combinedContent, chapterFolderId) {
    if (!combinedContent) {
        combinedContent = combineNovelContent(details);
    }

    let titleWithNumber = details.title;
    if (details.chapterNumber) {
        titleWithNumber = `${details.chapterNumber} ${details.title}`;
    }

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

    return items;
}
