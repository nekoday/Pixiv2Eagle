"use strict";

import { err } from "../tampermonkey/logger.js";
import { gmFetchBinary } from "../tampermonkey/request.js";
import { NOVEL_IMAGE_DOWNLOAD_DELAY_MS } from "../config/constants.js";

export function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function downloadImageToLocal(imageUrl, filename) {
    try {
        const imageData = await gmFetchBinary(imageUrl, {
            headers: {
                referer: "https://www.pixiv.net/",
            },
        });
        const blob = new Blob([imageData], { type: "image/jpeg" });
        downloadFile(blob, filename);
        return true;
    } catch (error) {
        err(`下载图片失败 ${imageUrl}:`, error);
        return false;
    }
}

export function downloadNovelFile(content, filename, format) {
    const mimeType = format === "md" ? "text/markdown" : "text/plain";
    const blob = new Blob([content], { type: mimeType });
    downloadFile(blob, filename);
}

export async function downloadNovelFiles(combinedContent, novelTitle, novelId) {
    const safeTitle = novelTitle.replace(/[\\/:*?"<>|]/g, "_");
    const fileExtension = combinedContent.format === "md" ? "md" : "txt";
    const filename = `${safeTitle}.${fileExtension}`;

    downloadNovelFile(combinedContent.content, filename, combinedContent.format);

    const imagePaths = [];
    if (combinedContent.images && combinedContent.images.length > 0) {
        const downloadImages = confirm(`检测到 ${combinedContent.images.length} 张图片，是否下载？\n\n请确保所有文件（文本和图片）都下载到同一目录中。`);

        if (downloadImages) {
            for (let i = 0; i < combinedContent.images.length; i++) {
                const image = combinedContent.images[i];
                await new Promise((resolve) => setTimeout(resolve, NOVEL_IMAGE_DOWNLOAD_DELAY_MS));
                const success = await downloadImageToLocal(image.url, image.filename);
                if (success) {
                    imagePaths.push(image.filename);
                }
            }
        }
    }

    return {
        novelFilename: filename,
        imageFilenames: imagePaths,
    };
}

export async function getFilePaths(novelFilename, imageFilenames, basePath) {
    const paths = {
        novelPath: null,
        imagePaths: [],
    };

    if (basePath) {
        const separator = basePath.includes("\\") ? "\\" : "/";
        const normalizedBasePath = basePath.endsWith("\\") || basePath.endsWith("/")
            ? basePath.slice(0, -1)
            : basePath;
        paths.novelPath = `${normalizedBasePath}${separator}${novelFilename}`;
        imageFilenames.forEach((filename) => {
            paths.imagePaths.push(`${normalizedBasePath}${separator}${filename}`);
        });
        return paths;
    }

    const novelPath = prompt(
        `请输入小说文件的完整路径：\n\n文件名：${novelFilename}\n\n示例：C:\\Users\\YourName\\Downloads\\${novelFilename}`,
        "",
    );

    if (!novelPath) {
        throw new Error("未提供小说文件路径");
    }

    paths.novelPath = novelPath.trim();

    const lastBackslash = novelPath.lastIndexOf("\\");
    const lastSlash = novelPath.lastIndexOf("/");
    const lastSeparator = Math.max(lastBackslash, lastSlash);
    const novelDir = lastSeparator >= 0 ? novelPath.substring(0, lastSeparator) : novelPath;
    const separator = lastBackslash > lastSlash ? "\\" : "/";

    if (imageFilenames.length > 0) {
        const defaultPaths = imageFilenames.map((f) => `${novelDir}${separator}${f}`).join("; ");
        const imagePathsInput = prompt(
            `请确认图片文件路径（用分号分隔，或留空使用默认路径）：\n\n图片文件名：${imageFilenames.join(", ")}\n\n默认路径：${defaultPaths}`,
            imageFilenames.map((f) => `${novelDir}${separator}${f}`).join(";"),
        );

        if (imagePathsInput) {
            paths.imagePaths = imagePathsInput.split(";").map((p) => p.trim()).filter((p) => p);
        } else {
            imageFilenames.forEach((filename) => {
                paths.imagePaths.push(`${novelDir}${separator}${filename}`);
            });
        }
    }

    return paths;
}
