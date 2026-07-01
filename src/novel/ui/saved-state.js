"use strict";

import {
    getFolderId,
    getSaveByType,
} from "../../tampermonkey/setting.js";
import { warn, err } from "../../tampermonkey/logger.js";
import { openEagleFolder } from "../../eagle/deep-link.js";
import { findArtistFolder } from "../../eagle/artist.js";
import { getTypeFolderInfo } from "../../eagle/type-folder.js";
import { EAGLE_SAVE_BUTTON_ID } from "../../config/constants.js";
import { getNovelId } from "../id.js";
import { getNovelDetails } from "../details.js";

export async function updateNovelSaveButtonIfSaved(saveButton) {
    const novelId = getNovelId();
    if (!novelId) return;

    try {
        const details = await getNovelDetails(novelId);
        if (!details.authorId) return;

        let artistFolder = null;
        try {
            artistFolder = await findArtistFolder(getFolderId(), details.authorId);
        } catch (e) {
            warn("查找画师文件夹失败 (可能是 Pixiv 文件夹 ID 设置错误或文件夹不存在):", e);
            return;
        }

        if (!artistFolder) return;

        let searchRoots = [artistFolder];

        if (getSaveByType()) {
            const typeInfo = getTypeFolderInfo("novel");
            if (artistFolder.children) {
                const typeFolder = artistFolder.children.find((c) => c.description === typeInfo.description);
                if (typeFolder) {
                    searchRoots.push(typeFolder);
                }
            }
        }

        if (details.seriesId) {
            const seriesUrl = `https://www.pixiv.net/novel/series/${details.seriesId}`;
            const seriesFolders = [];

            for (const root of searchRoots) {
                if (root.children) {
                    const sFolder = root.children.find((c) => c.description === seriesUrl);
                    if (sFolder) seriesFolders.push(sFolder);
                }
            }

            if (seriesFolders.length > 0) {
                searchRoots = seriesFolders;
            }
        }

        let foundFolder = null;
        for (const root of searchRoots) {
            if (root.children) {
                const chapter = root.children.find((c) => c.description === novelId);
                if (chapter) {
                    foundFolder = chapter;
                    break;
                }
            }
        }

        if (foundFolder) {
            saveButton.textContent = "已保存";
            saveButton.classList.add("p2e-btn--saved");
            saveButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                openEagleFolder(foundFolder.id);
            };
        }
    } catch (error) {
        err("Check saved status failed:", error);
    }
}

/**
 * 保存事件增量更新：小说详情页按钮变「已保存」。
 * @param {{ kind: string, id: string }} payload
 */
export function handleSavedEventForNovelDetail(payload) {
    const { kind, id } = payload;
    if (kind !== "novel") return;
    if (!id) return;

    const novelId = getNovelId();
    if (!novelId || id !== novelId) return;

    const wrapper = document.getElementById(EAGLE_SAVE_BUTTON_ID);
    if (!wrapper) return;

    const saveButton = wrapper.querySelector("div:last-child");
    if (!saveButton) return;

    if (saveButton.textContent === "已保存" || saveButton.classList.contains("p2e-btn--saved")) return;

    updateNovelSaveButtonIfSaved(saveButton);
}
