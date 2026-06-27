"use strict";

import { gmFetch } from "../Tampermonkey/request.js";
import { err } from "../Tampermonkey/logger.js";
import { SETTING_KEYS, SETTING_DEFAULTS } from "../Tampermonkey/setting.js";
import { createArtistFolder } from "./folder.js";

class ArtistMatcher {
    constructor(template) {
        this.template = template;
        this.regex = this.createRegex(template);
    }

    /**
     * 根据模板创建正则表达式
     * @param {string} template - 模板字符串，如 "$uid_$name" 或 "pid = $uid"
     * @returns {RegExp} 生成的正则表达式
     */
    createRegex(template) {
        // 转义正则表达式特殊字符，但保留占位符
        let regexStr = template
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // 转义特殊字符
            .replace(/\\\$uid/g, "(\\d+)") // $uid 匹配数字
            .replace(/\\\$name/g, "(.+?)"); // $name 匹配任意字符（非贪婪）

        return new RegExp(`^${regexStr}$`);
    }

    /**
     * 检测字符串是否匹配指定的画师（仅比较 uid）
     * @param {string} str - 待检测的字符串
     * @param {number|string} uid - 画师 ID
     * @returns {boolean} 是否匹配
     */
    match(str, uid) {
        const extracted = this.extract(str);
        if (!extracted || !extracted.uid) {
            return false;
        }
        return extracted.uid.toString() === uid.toString();
    }

    /**
     * 从字符串中提取画师信息
     * @param {string} str - 待解析的字符串
     * @returns {Object|null} 包含 uid 和 name 的对象，如果不匹配则返回 null
     */
    extract(str) {
        const match = str.match(this.regex);
        if (!match) {
            return null;
        }

        const result = {};
        const uidMatch = this.template.match(/\$uid/g);
        const nameMatch = this.template.match(/\$name/g);

        let groupIndex = 1;

        // 按照模板中的顺序提取字段
        if (this.template.indexOf("$uid") < this.template.indexOf("$name")) {
            if (uidMatch) result.uid = match[groupIndex++];
            if (nameMatch) result.name = match[groupIndex++];
        } else {
            if (nameMatch) result.name = match[groupIndex++];
            if (uidMatch) result.uid = match[groupIndex++];
        }

        return result;
    }

    /**
     * 使用指定字段生成对应的字符串
     * @param {number|string} uid - 画师ID
     * @param {string} name - 画师名称
     * @returns {string} 根据模板生成的字符串
     */
    generate(uid, name) {
        return this.template.replace(/\$uid/g, uid).replace(/\$name/g, name);
    }

    /**
     * 更新模板
     * @param {string} newTemplate - 新的模板字符串
     */
    updateTemplate(newTemplate) {
        this.template = newTemplate;
        this.regex = this.createRegex(newTemplate);
    }
}

// 设置画师文件夹匹配模板串
export function setArtistMatcher() {
    const template = prompt(
        "请输入画师文件夹匹配模板，$uid 为画师 ID，$name 为画师名称。\n默认值：$name",
        GM_getValue(SETTING_KEYS.FOLDER_NAME_TEMPLATE, SETTING_DEFAULTS[SETTING_KEYS.FOLDER_NAME_TEMPLATE])
    );
    if (template === null) return;
    GM_setValue(SETTING_KEYS.FOLDER_NAME_TEMPLATE, template);
    alert(`✅ 模板字符串已设置为 ${template}`);
}

// 根据用户模板串创建 ArtistMatcher 实例
export function getArtistMatcher() {
    return new ArtistMatcher(
        GM_getValue(SETTING_KEYS.FOLDER_NAME_TEMPLATE, SETTING_DEFAULTS[SETTING_KEYS.FOLDER_NAME_TEMPLATE])
    );
}

// 查找画师文件夹（不创建）
export async function findArtistFolder(pixivFolderId, artistId) {
    // 递归查找文件夹
    function findFolderRecursively(folders, targetId) {
        for (const folder of folders) {
            if (folder.id === targetId) {
                return folder;
            }
            if (folder.children && folder.children.length > 0) {
                const found = findFolderRecursively(folder.children, targetId);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    // 在文件夹中查找画师文件夹（通过画师 ID）
    function findArtistFolderInFolder(folder, artistId) {
        if (!folder || !folder.children) return null;

        const artistFolder = folder.children.find((childFolder) => {
            const description = childFolder.description || "";
            const match = description.match(/pid\s*=\s*(\d+)/);
            return match && match[1] === artistId;
        });

        if (artistFolder) {
            return {
                existed: true,
                id: artistFolder.id,
                name: artistFolder.name,
                children: artistFolder.children,
            };
        }
        return null;
    }

    // 在指定的 Pixiv 文件夹中查找画师文件夹
    async function findArtistFolderInPixivFolder(pixivFolderId, artistId) {
        try {
            // 获取所有文件夹列表
            const data = await gmFetch("http://localhost:41595/api/folder/list");
            if (!data.status || !Array.isArray(data.data)) {
                throw new Error("无法获取文件夹列表");
            }

            // 递归查找 Pixiv 主文件夹
            const pixivFolder = findFolderRecursively(data.data, pixivFolderId);
            if (!pixivFolder) {
                throw new Error("找不到指定的 Pixiv 文件夹，请检查输入的文件夹 ID 是否正确");
            }

            // 在 Pixiv 文件夹中查找画师文件夹
            return findArtistFolderInFolder(pixivFolder, artistId);
        } catch (error) {
            err("在 Pixiv 文件夹中查找画师文件夹失败:", error);
            throw error;
        }
    }

    // 在根目录查找画师文件夹
    async function findArtistFolderInRoot(artistId) {
        try {
            const rootFolders = await gmFetch("http://localhost:41595/api/folder/list");
            if (!rootFolders.status || !Array.isArray(rootFolders.data)) {
                throw new Error("无法获取根目录文件夹列表");
            }

            const existingFolder = rootFolders.data.find((folder) => {
                const description = folder.description || "";
                const match = description.match(/pid\s*=\s*(\d+)/);
                return match && match[1] === artistId;
            });

            if (existingFolder) {
                return {
                    existed: true,
                    id: existingFolder.id,
                    name: existingFolder.name,
                    children: existingFolder.children,
                };
            }
            return null;
        } catch (error) {
            err("在根目录查找画师文件夹失败:", error);
            throw error;
        }
    }

    if (pixivFolderId) {
        return await findArtistFolderInPixivFolder(pixivFolderId, artistId);
    } else {
        return await findArtistFolderInRoot(artistId);
    }
}

// 查找或创建画师专属文件夹
export async function getArtistFolder(pixivFolderId, artistId, artistName) {
    // 先查找
    const found = await findArtistFolder(pixivFolderId, artistId);
    if (found) return found;
    // 没找到则创建
    return await createArtistFolder(artistName, artistId, pixivFolderId);
}
