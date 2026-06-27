"use strict";

import { createEagleFolder } from "./folder.js";

// 获取类型文件夹信息
export function getTypeFolderInfo(illustType) {
    // illustType: 0=illust, 1=manga, 2=ugoira, "novel"=novel
    // 映射: 0,2 -> 插画 (illustrations), 1 -> 漫画 (manga)
    if (illustType === 1) {
        return { name: "漫画", description: "manga" };
    } else if (illustType === "novel") {
        return { name: "小说", description: "novels" };
    } else {
        // 默认为插画 (包括 ugoira)
        return { name: "插画", description: "illustrations" };
    }
}

// 查找或创建类型文件夹
export async function getOrCreateTypeFolder(artistFolder, typeInfo) {
    if (!artistFolder || !artistFolder.children) return null;

    let typeFolder = artistFolder.children.find((c) => c.description === typeInfo.description);
    if (!typeFolder) {
        const newId = await createEagleFolder(typeInfo.name, artistFolder.id, typeInfo.description);
        typeFolder = { id: newId, name: typeInfo.name, description: typeInfo.description, children: [] };
        // 更新本地缓存的结构
        artistFolder.children.push(typeFolder);
    }
    return typeFolder;
}
