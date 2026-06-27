"use strict";

import { dbg, err, warn } from "../Tampermonkey/logger.js";
import { gmFetch } from "../Tampermonkey/request.js";
import { MANGA_SERIES_INFO_SELECTOR } from "../config/selectors/index.js";
import { processTags } from "./tags.js";
import { getArtworkPages } from "./pages.js";

// 获取作品详细信息
export async function getArtworkDetails(artworkId) {
    try {
        const [basicInfo, pagesInfo] = await Promise.all([
            gmFetch(`https://www.pixiv.net/ajax/illust/${artworkId}?lang=zh`, {
                headers: { referer: "https://www.pixiv.net/" },
                timeout: 10000,
            }),
            getArtworkPages(artworkId),
        ]);

        if (!basicInfo.body) {
            throw new Error("无法获取作品信息");
        }

        function formatDescription(desc) {
            const replaceOperations = [
                { regex: /<br\s*\/?>/gi, replace: "\n" },
                { regex: /<\/?\s*strong>/gi, replace: "" },
                {
                    regex: /<a\s+href="(https:\/\/twitter\.com\/([^"]+))"\s+target="_blank">twitter\/\2<\/a>/gi,
                    replace: "$1",
                },
                {
                    regex: /<a\s+href="(https:\/\/www\.pixiv\.net\/artworks\/(\d+))">illust\/\2<\/a>/gi,
                    replace: "$1",
                },
                { regex: /<a\s+href="(https:\/\/www\.pixiv\.net\/users\/(\d+))">user\/\2<\/a>/gi, replace: "$1" },
            ];

            for (const { regex, replace } of replaceOperations) {
                desc = desc.replace(regex, replace);
            }

            return desc.trim();
        }

        const getTitle = (title) => {
            if (title === "") return artworkId;
            if (["无题", "無題", "무제", "Untitled"].includes(title)) return `${artworkId}_${title}`;
            return title;
        };

        const details = {
            userName: basicInfo.body.userName,
            userId: basicInfo.body.userId,
            illustTitle: getTitle(basicInfo.body.illustTitle),
            description: formatDescription(basicInfo.body.description),
            pageCount: pagesInfo.pageCount,
            originalUrls: pagesInfo.originalUrls,
            uploadDate: basicInfo.body.uploadDate,
            tags: processTags(basicInfo.body.tags.tags, basicInfo.body.isOriginal, basicInfo.body.aiType),
            illustType: basicInfo.body.illustType,
            seriesNavData: basicInfo.body.seriesNavData,
        };

        if (details.illustType === 1) {
            try {
                const seriesInfoEl = document.querySelector(MANGA_SERIES_INFO_SELECTOR);
                if (seriesInfoEl) {
                    const text = seriesInfoEl.textContent.trim();
                    const lastHashIndex = text.lastIndexOf("#");
                    if (lastHashIndex !== -1) {
                        const chapterNum = text.substring(lastHashIndex + 1).trim();
                        if (/\d/.test(chapterNum)) {
                            details.illustTitle = `#${chapterNum} ${details.illustTitle}`;
                            dbg(`已优化漫画标题: ${details.illustTitle}`);
                        }
                    }
                }
            } catch (e) {
                warn("尝试优化漫画标题失败:", e);
            }
        }

        return details;
    } catch (error) {
        err("获取作品信息失败:", error);
        throw error;
    }
}
