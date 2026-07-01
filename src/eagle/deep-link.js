"use strict";

export const EAGLE_ORIGIN = "http://localhost:41595";

export function buildEagleFolderUrl(folderId) {
    return `${EAGLE_ORIGIN}/folder?id=${folderId}`;
}

export function buildEagleItemUrl(itemId) {
    return `${EAGLE_ORIGIN}/item?id=${itemId}`;
}

/** @param {{ folderId?: string, itemId?: string }} [params] */
export function openInEagle({ folderId, itemId } = {}) {
    if (itemId) {
        window.location.href = buildEagleItemUrl(itemId);
        return;
    }
    if (folderId) {
        window.location.href = buildEagleFolderUrl(folderId);
    }
}

export function openEagleFolder(folderId) {
    openInEagle({ folderId });
}

export function openEagleItem(itemId) {
    openInEagle({ itemId });
}
