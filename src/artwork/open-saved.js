"use strict";

import { openInEagle } from "../eagle/deep-link.js";
import { isArtworkSavedInEagle, countArtworkItemsInFolder } from "../eagle/items.js";
import { checkEagle } from "../eagle/client.js";
import { showToast } from "../ui/toast.js";

const NOT_FOUND_MSG = "无法在 Eagle 中找到该作品，请稍后重试";
const EAGLE_DOWN_MSG = "Eagle 未启动，请先启动 Eagle 应用！";

/**
 * 按实际上传文件数打开 Eagle item（单 p）或文件夹（多 p）。
 *
 * @param {{
 *   artworkId: string,
 *   folderId: string,
 *   itemId?: string | null,
 *   pageCount?: number,
 *   mode: "toast" | "detail",
 * }} params
 */
export async function openSavedArtworkInEagle({
    artworkId,
    folderId,
    itemId = null,
    pageCount,
    mode,
}) {
    if (!folderId || !artworkId) {
        showToast(NOT_FOUND_MSG, "error");
        return;
    }

    try {
        const eagleStatus = await checkEagle();
        if (!eagleStatus?.running) {
            showToast(EAGLE_DOWN_MSG, "error");
            return;
        }
    } catch {
        showToast(EAGLE_DOWN_MSG, "error");
        return;
    }

    let isMultiPage;

    if (mode === "toast") {
        isMultiPage = (pageCount ?? 1) > 1;
    } else {
        let itemCount = await countArtworkItemsInFolder(artworkId, folderId);
        if (itemCount === 0) {
            if (itemId) {
                openInEagle({ itemId, folderId });
                return;
            }
            const { saved, itemId: foundId } = await isArtworkSavedInEagle(artworkId, folderId);
            if (saved && foundId) {
                openInEagle({ itemId: foundId, folderId });
                return;
            }
            showToast(NOT_FOUND_MSG, "error");
            return;
        }
        isMultiPage = itemCount > 1;
    }

    if (isMultiPage) {
        openInEagle({ folderId });
        return;
    }

    let resolvedItemId = itemId;
    if (!resolvedItemId) {
        const { saved, itemId: foundId } = await isArtworkSavedInEagle(artworkId, folderId);
        if (saved && foundId) resolvedItemId = foundId;
    }

    if (resolvedItemId) {
        openInEagle({ itemId: resolvedItemId, folderId });
        return;
    }

    showToast(NOT_FOUND_MSG, "error");
}
