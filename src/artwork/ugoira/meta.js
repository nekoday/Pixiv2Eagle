"use strict";

import { err } from "../../tampermonkey/logger.js";
import { gmFetch, gmFetchBinary } from "../../tampermonkey/request.js";

// 获取动图（ugoira）元数据
export async function getUgoiraMeta(artworkId) {
    try {
        const data = await gmFetch(`https://www.pixiv.net/ajax/illust/${artworkId}/ugoira_meta?lang=zh`, {
            headers: { referer: "https://www.pixiv.net/" },
            timeout: 10000,
        });
        if (!data || !data.body || !data.body.originalSrc || !Array.isArray(data.body.frames)) {
            throw new Error("无法获取动图元数据");
        }
        return {
            originalSrc: data.body.originalSrc,
            frames: data.body.frames,
        };
    } catch (error) {
        err("获取动图元数据失败:", error);
        throw error;
    }
}

// 下载 ugoira 的 zip 数据
export async function downloadUgoiraZip(zipUrl) {
    const buffer = await gmFetchBinary(zipUrl, {
        responseType: "arraybuffer",
        headers: { referer: "https://www.pixiv.net/" },
    });
    if (!buffer) throw new Error("下载 ugoira 压缩包失败");
    return buffer;
}

// 将 Uint8Array 解码成 Image 对象
export function decodeImageFromU8(u8, mime) {
    return new Promise((resolve, reject) => {
        const blob = new Blob([u8], { type: mime });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };
        img.src = url;
    });
}
