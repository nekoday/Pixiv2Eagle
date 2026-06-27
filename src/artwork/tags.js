"use strict";

// 处理标签
export function processTags(tags, isOriginal, aiType) {
    if (!Array.isArray(tags)) return [];

    const processedTags = [];
    const tagSet = new Set();

    const addTagIfNotExists = (tag) => {
        if (!tagSet.has(tag)) {
            tagSet.add(tag);
            processedTags.push(tag);
            return true;
        }
        return false;
    };

    if (aiType === 2) {
        addTagIfNotExists("AI生成");
    }

    if (isOriginal) {
        addTagIfNotExists("原创");
    }

    tags.forEach((tagInfo) => {
        const tag = tagInfo.tag;
        addTagIfNotExists(tag);

        if (tagInfo.translation && tagInfo.translation.en) {
            const enTag = tagInfo.translation.en;
            addTagIfNotExists(enTag);
        }
    });

    return processedTags;
}
