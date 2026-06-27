"use strict";

import { err } from "../Tampermonkey/logger.js";
import { gmFetch } from "../Tampermonkey/request.js";

// 获取作品页面信息
export async function getArtworkPages(artworkId) {
    try {
        const data = await gmFetch(`https://www.pixiv.net/ajax/illust/${artworkId}/pages?lang=zh`, {
            headers: { referer: "https://www.pixiv.net/" },
            timeout: 10000,
        });

        if (!data.body || !Array.isArray(data.body)) {
            throw new Error("无法获取作品页面信息");
        }

        return {
            pageCount: data.body.length,
            originalUrls: data.body.map((page) => page.urls.original),
        };
    } catch (error) {
        err("获取作品页面信息失败:", error);
        throw error;
    }
}
