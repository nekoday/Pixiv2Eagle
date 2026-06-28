"use strict";

import { gmFetch } from "../tampermonkey/request.js";
import { err } from "../tampermonkey/logger.js";
import { getArtistMatcher } from "./artist-matcher.js";

// 创建 Eagle 文件夹
export async function createEagleFolder(folderName, parentId = null, description = "") {
    try {
        const data = await gmFetch("http://localhost:41595/api/folder/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                folderName: folderName,
                ...(parentId && { parent: parentId }),
            }),
        });

        if (!data.status) {
            throw new Error("创建文件夹失败");
        }

        const newFolderId = data.data.id;

        // 如果有描述，更新文件夹描述
        if (description) {
            const updateData = await gmFetch("http://localhost:41595/api/folder/update", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    folderId: newFolderId,
                    newDescription: description,
                }),
            });

            if (!updateData.status) {
                throw new Error("更新文件夹描述失败");
            }
        }

        return newFolderId;
    } catch (error) {
        err("创建文件夹失败:", error);
        throw error;
    }
}

// 创建画师专属文件夹
export async function createArtistFolder(artistName, artistId, parentId = null) {
    const artistMatcher = getArtistMatcher();
    const folderName = artistMatcher.generate(artistId, artistName);

    try {
        const newFolderId = await createEagleFolder(folderName, parentId, `pid = ${artistId}`);
        return {
            existed: false,
            id: newFolderId,
            name: artistName,
            children: [],
        };
    } catch (error) {
        err("创建画师文件夹失败:", error);
        throw error;
    }
}

// 查找系列文件夹
export async function getSeriesFolder(artistFolder, artistId, seriesId, seriesName) {
    const existingFolder = artistFolder.children.find((folder) => {
        const description = folder.description || "";
        const match = description.match(/^https?:\/\/www\.pixiv\.net\/user\/(\d+)\/series\/(\d+)\/?$/);
        return match && match[1] === artistId && match[2] === seriesId;
    });

    if (existingFolder) {
        return {
            existed: true,
            id: existingFolder.id,
            name: existingFolder.name,
            children: existingFolder.children,
        };
    }

    const newSeriesFolderId = await createEagleFolder(
        seriesName,
        artistFolder.id,
        `https://www.pixiv.net/user/${artistId}/series/${seriesId}`
    );
    return {
        existed: false,
        id: newSeriesFolderId,
        name: seriesName,
        children: [],
    };
}
