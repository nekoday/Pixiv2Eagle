"use strict";

/**
 * 移除标题中的序号部分（#数字 或 第数字话）
 * @param {string} title - 原始标题
 * @returns {string} 处理后的标题
 */
export function removeChapterNumber(title) {
    const numMatch = title.match(/#(\d+)/) || title.match(/第(\d+)[话話]/) || title.match(/^(\d+)$/);
    if (numMatch) {
        const cleaned = title.replace(numMatch[0], "").trim();
        return cleaned || title;
    }
    return title;
}
