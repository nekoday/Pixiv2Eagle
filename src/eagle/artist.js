"use strict";

import { gmFetch } from "../Tampermonkey/request.js";
import { err } from "../Tampermonkey/logger.js";
import { createArtistFolder } from "./folder.js";

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
