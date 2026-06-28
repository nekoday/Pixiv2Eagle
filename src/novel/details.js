"use strict";

import { dbg, err } from "../tampermonkey/logger.js";
import {
    NOVEL_DESC_SELECTOR,
    NOVEL_AUTHOR_CONTAINER_SELECTOR,
    NOVEL_CONTENT_SELECTOR,
    NOVEL_TEXT_SPAN_SELECTOR,
    NOVEL_SERIES_SECTION_SELECTOR,
    NOVEL_SERIES_LINK_SELECTOR,
    NOVEL_SERIES_TITLE_SELECTOR,
    NOVEL_CHAPTER_NUMBER_LINK_SELECTOR,
    NOVEL_TAG_ITEM_SELECTOR,
    NOVEL_PUBLISH_DATE_CONTAINER_SELECTOR,
} from "../config/selectors/index.js";
import {
    findNovelTitle,
    findNovelCover,
    findNovelTagsContainer,
} from "./resolvers.js";

export async function getNovelDetails(novelId) {
    try {
        const titleEl = findNovelTitle();
        const title = titleEl ? titleEl.textContent.trim() : `Novel_${novelId}`;

        const descEl = document.querySelector(NOVEL_DESC_SELECTOR);
        const description = descEl ? descEl.textContent.trim() : "";

        const coverImg = findNovelCover();
        const coverUrl = coverImg ? coverImg.src : null;

        let authorId = null;
        let authorName = null;
        let authorLink = null;

        const authorContainer = document.querySelector(NOVEL_AUTHOR_CONTAINER_SELECTOR);

        if (authorContainer) {
            if (authorContainer.tagName === "A") {
                authorLink = authorContainer;
            } else {
                authorLink = authorContainer.querySelector('a[href^="/users/"]');
            }

            if (authorLink) {
                authorId = authorLink.getAttribute("data-gtm-value") || authorLink.getAttribute("data-gtm-user-id");
                if (!authorId && authorLink.href) {
                    const hrefMatch = authorLink.href.match(/\d+/);
                    authorId = hrefMatch ? hrefMatch[0] : null;
                }

                authorName = authorLink.textContent?.trim() || "";

                if (!authorName || authorName === "") {
                    const authorNameDiv = authorLink.querySelector("div");
                    if (authorNameDiv) {
                        authorName = authorNameDiv.innerText?.trim() || authorNameDiv.textContent?.trim() || "";
                    }
                }

                if ((!authorName || authorName === "") && authorId) {
                    const specificLink = document.querySelector(`a.sc-76df3bd1-6.hQXkzZ[href*="/users/${authorId}"], a.sc-76df3bd1-6.hQXkzZ[data-gtm-value="${authorId}"], a.sc-76df3bd1-6.hQXkzZ[data-gtm-user-id="${authorId}"]`);
                    if (specificLink) {
                        const linkText = specificLink.textContent?.trim() || specificLink.innerText?.trim() || "";
                        if (linkText && linkText.length > 0 && !linkText.includes("查看") && !linkText.includes("作品") && !linkText.includes("目录") && !specificLink.querySelector("figure")) {
                            authorName = linkText;
                        }
                    }

                    if (!authorName || authorName === "") {
                        const allUserLinks = document.querySelectorAll(`a[href*="/users/${authorId}"], a[data-gtm-value="${authorId}"], a[data-gtm-user-id="${authorId}"]`);
                        for (const link of allUserLinks) {
                            const linkText = link.textContent?.trim() || link.innerText?.trim() || "";
                            const isInvalidText = !linkText || linkText.length === 0 ||
                                link.querySelector("figure") ||
                                linkText.includes("查看") ||
                                linkText.includes("作品") ||
                                linkText.includes("目录") ||
                                linkText.includes("关注") ||
                                linkText.includes("粉丝");
                            if (!isInvalidText) {
                                authorName = linkText;
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (!authorLink) {
            const fallbackLink = document.querySelector('a[href^="/users/"][data-gtm-value], a[href^="/users/"][data-gtm-user-id]');
            if (fallbackLink) {
                authorLink = fallbackLink;
                authorId = fallbackLink.getAttribute("data-gtm-value") || fallbackLink.getAttribute("data-gtm-user-id");
                if (!authorId && fallbackLink.href) {
                    const hrefMatch = fallbackLink.href.match(/\d+/);
                    authorId = hrefMatch ? hrefMatch[0] : null;
                }
                authorName = fallbackLink.textContent?.trim() || "";

                if ((!authorName || authorName === "") && authorId) {
                    const specificLink = document.querySelector(`a.sc-76df3bd1-6.hQXkzZ[href*="/users/${authorId}"], a.sc-76df3bd1-6.hQXkzZ[data-gtm-value="${authorId}"], a.sc-76df3bd1-6.hQXkzZ[data-gtm-user-id="${authorId}"]`);
                    if (specificLink) {
                        const linkText = specificLink.textContent?.trim() || specificLink.innerText?.trim() || "";
                        if (linkText && linkText.length > 0 && !linkText.includes("查看") && !linkText.includes("作品") && !linkText.includes("目录") && !specificLink.querySelector("figure")) {
                            authorName = linkText;
                        }
                    }

                    if (!authorName || authorName === "") {
                        const allUserLinks = document.querySelectorAll(`a[href*="/users/${authorId}"], a[data-gtm-value="${authorId}"], a[data-gtm-user-id="${authorId}"]`);
                        for (const link of allUserLinks) {
                            const linkText = link.textContent?.trim() || link.innerText?.trim() || "";
                            const isInvalidText = !linkText || linkText.length === 0 ||
                                link.querySelector("figure") ||
                                linkText.includes("查看") ||
                                linkText.includes("作品") ||
                                linkText.includes("目录") ||
                                linkText.includes("关注") ||
                                linkText.includes("粉丝");
                            if (!isInvalidText) {
                                authorName = linkText;
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (!authorName || authorName === "") {
            authorName = "Unknown";
        }

        if (authorName && authorName !== "Unknown") {
            dbg("提取到作者名:", authorName, "作者UID:", authorId);
        } else {
            dbg("未提取到作者名，使用默认值:", authorName);
        }

        const seriesSection = document.querySelector(NOVEL_SERIES_SECTION_SELECTOR);
        let seriesId = null;
        let seriesTitle = null;
        let chapterNumber = null;

        if (seriesSection) {
            const seriesTitleElement = document.querySelector(NOVEL_SERIES_TITLE_SELECTOR);
            if (seriesTitleElement) {
                let rawSeriesTitle = seriesTitleElement.textContent.trim();
                if (rawSeriesTitle.startsWith("系列")) {
                    seriesTitle = rawSeriesTitle.substring(2).trim();
                } else {
                    seriesTitle = rawSeriesTitle;
                }
            }

            const chapterNumberLink = document.querySelector(NOVEL_CHAPTER_NUMBER_LINK_SELECTOR);
            if (chapterNumberLink) {
                const linkText = chapterNumberLink.textContent.trim();
                const numberMatch = linkText.match(/#(\d+)/);
                if (numberMatch) {
                    chapterNumber = `#${numberMatch[1]}`;
                }
            }

            const seriesLink = document.querySelector(NOVEL_SERIES_LINK_SELECTOR);
            if (seriesLink) {
                const match = seriesLink.getAttribute("href").match(/\/novel\/series\/(\d+)/);
                if (match) {
                    seriesId = match[1];
                    if (!seriesTitle) {
                        let rawSeriesTitle = seriesLink.textContent.trim();
                        if (rawSeriesTitle.startsWith("系列")) {
                            seriesTitle = rawSeriesTitle.substring(2).trim();
                        } else {
                            seriesTitle = rawSeriesTitle;
                        }
                    }
                }
            }
        }

        let contentContainer = document.querySelector(NOVEL_CONTENT_SELECTOR);

        if (!contentContainer) {
            const partialSelectors = [
                "div.sc-ejfMa-d",
                'div[class*="sc-ejfMa"]',
                'div[class*="ejfMa"]',
            ];

            for (const selector of partialSelectors) {
                contentContainer = document.querySelector(selector);
                if (contentContainer) {
                    break;
                }
            }
        }

        if (!contentContainer) {
            const allDivs = document.querySelectorAll("div");
            for (const div of allDivs) {
                const paragraphs = div.querySelectorAll("p");
                if (paragraphs.length > 5) {
                    const textLength = Array.from(paragraphs).reduce((sum, p) => sum + (p.textContent?.length || 0), 0);
                    if (textLength > 100) {
                        contentContainer = div;
                        break;
                    }
                }
            }
        }

        let content = "";
        const images = [];
        let hasImages = false;

        if (contentContainer) {
            const imgElements = Array.from(contentContainer.querySelectorAll("img"));
            hasImages = imgElements.length > 0;

            if (hasImages) {
                imgElements.forEach((img, index) => {
                    const src = img.src || img.getAttribute("data-src") || "";
                    const alt = img.alt || img.getAttribute("alt") || "";
                    if (src) {
                        images.push({
                            src: src,
                            alt: alt,
                            index: index,
                        });
                    }
                });
            }

            const textSpans = contentContainer.querySelectorAll(NOVEL_TEXT_SPAN_SELECTOR);

            if (textSpans.length > 0) {
                const contentParts = [];

                for (let i = 0; i < textSpans.length; i++) {
                    const span = textSpans[i];
                    const text = span.textContent.trim();
                    if (text) {
                        contentParts.push(text);
                    }

                    let nextSibling = span.nextSibling;
                    while (nextSibling) {
                        if (nextSibling.nodeType === Node.ELEMENT_NODE) {
                            if (nextSibling.tagName === "BR") {
                                contentParts.push("\n\n");
                                break;
                            } else if (nextSibling.matches && nextSibling.matches(NOVEL_TEXT_SPAN_SELECTOR)) {
                                break;
                            }
                        }
                        nextSibling = nextSibling.nextSibling;
                    }
                }

                content = contentParts.join("");
            } else {
                const paragraphs = Array.from(contentContainer.querySelectorAll("p"));
                content = paragraphs.map((p) => p.textContent).join("\n");
            }
        }

        const tagsContainer = findNovelTagsContainer();
        const tags = [];
        if (tagsContainer) {
            let tagItems = tagsContainer.querySelectorAll(NOVEL_TAG_ITEM_SELECTOR);

            if (tagItems.length === 0) {
                tagItems = tagsContainer.querySelectorAll("ul li");
                dbg("标签项提取: 使用通用的ul li选择器");
            }

            for (const tagItem of tagItems) {
                const tagText = tagItem.textContent?.trim();
                if (tagText) {
                    tags.push(tagText);
                }
            }
            dbg("提取到小说标签:", tags);
        } else {
            dbg("未找到标签容器");
        }

        let publishDate = null;
        const dateContainer = document.querySelector(NOVEL_PUBLISH_DATE_CONTAINER_SELECTOR);
        if (dateContainer) {
            const timeEl = dateContainer.querySelector("time");
            if (timeEl) {
                const datetime = timeEl.getAttribute("datetime");
                if (datetime) {
                    publishDate = datetime;
                    dbg("提取到出版日期:", publishDate);
                }
            }
        }

        return {
            id: novelId,
            title,
            description,
            coverUrl,
            authorId,
            authorName,
            seriesId,
            seriesTitle,
            chapterNumber,
            content,
            images,
            hasImages,
            tags,
            publishDate,
            illustType: "novel",
        };
    } catch (error) {
        err("获取小说信息失败:", error);
        throw error;
    }
}
