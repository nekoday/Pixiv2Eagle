"use strict";

import {
    NOVEL_CONTENT_SELECTOR,
    NOVEL_TEXT_SPAN_SELECTOR,
} from "../config/selectors/index.js";

export function combineNovelContent(details) {
    if (!details.hasImages || !details.images || details.images.length === 0) {
        return {
            content: details.content,
            format: "txt",
            images: [],
        };
    }

    const contentContainer = document.querySelector(NOVEL_CONTENT_SELECTOR);
    if (!contentContainer) {
        return {
            content: details.content,
            format: "md",
            images: [],
        };
    }

    let markdownContent = "";

    const imageUrlToIndex = new Map();
    details.images.forEach((img, index) => {
        imageUrlToIndex.set(img.src, index);
    });

    let imageIndex = 0;

    const childNodes = Array.from(contentContainer.childNodes);
    let currentParagraph = "";

    for (const node of childNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(NOVEL_TEXT_SPAN_SELECTOR)) {
            const text = node.textContent.trim();
            if (text) {
                currentParagraph += text;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR") {
            if (currentParagraph.trim()) {
                markdownContent += currentParagraph.trim() + "\n\n";
                currentParagraph = "";
            }
        } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "IMG") {
            const src = node.src || node.getAttribute("data-src") || "";
            const alt = node.alt || node.getAttribute("alt") || "";

            if (src && imageUrlToIndex.has(src)) {
                if (currentParagraph.trim()) {
                    markdownContent += currentParagraph.trim() + "\n\n";
                    currentParagraph = "";
                }

                const idx = imageUrlToIndex.get(src);
                const urlMatch = src.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
                const ext = urlMatch ? urlMatch[1].toLowerCase() : "jpg";
                const filename = `image_${idx}.${ext}`;

                markdownContent += `![${alt}](${filename})\n\n`;
                imageIndex++;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const imagesInElement = Array.from(node.querySelectorAll("img"));

            if (imagesInElement.length > 0) {
                if (currentParagraph.trim()) {
                    markdownContent += currentParagraph.trim() + "\n\n";
                    currentParagraph = "";
                }

                for (const img of imagesInElement) {
                    const src = img.src || img.getAttribute("data-src") || "";
                    const alt = img.alt || img.getAttribute("alt") || "";

                    if (src && imageUrlToIndex.has(src)) {
                        const idx = imageUrlToIndex.get(src);
                        const urlMatch = src.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
                        const ext = urlMatch ? urlMatch[1].toLowerCase() : "jpg";
                        const filename = `image_${idx}.${ext}`;

                        markdownContent += `![${alt}](${filename})\n\n`;
                        imageIndex++;
                    }
                }
            }
        }
    }

    if (currentParagraph.trim()) {
        markdownContent += currentParagraph.trim() + "\n\n";
    }

    if (!markdownContent.trim()) {
        return {
            content: details.content,
            format: "txt",
            images: [],
        };
    }

    const imageInfo = details.images.map((img, index) => {
        const urlMatch = img.src.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
        const ext = urlMatch ? urlMatch[1].toLowerCase() : "jpg";
        return {
            url: img.src,
            filename: `image_${index}.${ext}`,
            alt: img.alt,
        };
    });

    return {
        content: markdownContent.trim(),
        format: "md",
        images: imageInfo,
    };
}
