"use strict";

import { getAutoCheckSavedStatus } from "../../tampermonkey/setting.js";
import { err } from "../../tampermonkey/logger.js";
import { createPixivStyledButton } from "../../ui/button.js";
import { waitForElement, waitForSectionWithin } from "../../ui/dom.js";
import {
    EAGLE_SAVE_BUTTON_ID,
    EAGLE_OPEN_ITEM_BUTTON_ID,
} from "../../config/constants.js";
import { checkEagle } from "../../eagle/client.js";
import { countArtworkItemsInFolder } from "../../eagle/items.js";
import { findSavedFolderForArtwork } from "../find-saved-folder.js";
import { openSavedArtworkInEagle } from "../open-saved.js";
import { getArtworkId } from "../id.js";
import { saveCurrentArtwork } from "../save.js";
import { openArtistFolderFromArtworkPage } from "../artist-info.js";
import { addMoveToSubfolderButton } from "./move-subfolder.js";

export async function updateSaveButtonIfSaved(saveButton) {
    async function attachOpenArtworkButton(savedInfo) {
        if (document.getElementById(EAGLE_OPEN_ITEM_BUTTON_ID)) return;

        const wrapper = saveButton.parentElement;
        const artworkIdForOpen = artworkId;

        const openButton = createPixivStyledButton("🔍");
        openButton.id = EAGLE_OPEN_ITEM_BUTTON_ID;
        openButton.title = "在 Eagle 中打开此作品";
        openButton.onclick = () => {
            void openSavedArtworkInEagle({
                artworkId: artworkIdForOpen,
                folderId: savedInfo.folder.id,
                itemId: savedInfo.itemId,
                mode: "detail",
            });
        };

        try {
            const itemCount = await countArtworkItemsInFolder(artworkIdForOpen, savedInfo.folder.id);
            if (itemCount > 1) {
                openButton.title = "在 Eagle 中打开作品文件夹";
            }
        } catch {
            // 计数失败保留默认单 p title
        }

        wrapper.insertBefore(openButton, saveButton.nextSibling);
    }

    const artworkId = getArtworkId();
    if (!artworkId) return;

    try {
        const eagleStatus = await checkEagle();
        if (!eagleStatus.running) return;

        const savedInfo = await findSavedFolderForArtwork(artworkId);

        if (savedInfo && savedInfo.folder) {
            saveButton.textContent = "✅ 此作品已保存";
            await attachOpenArtworkButton(savedInfo);
        }
    } catch (error) {
        err("检测保存状态时出错:", error);
    }
}

export async function addButton() {
    const oldWrapper = document.getElementById(EAGLE_SAVE_BUTTON_ID);
    if (oldWrapper) {
        oldWrapper.remove();
    }

    const mainElement = await waitForElement("main");
    if (!mainElement) return;

    const outerSection = await waitForSectionWithin(mainElement);
    if (!outerSection) return;

    const targetSection = await waitForSectionWithin(outerSection);
    if (!targetSection) return;

    if (document.getElementById(EAGLE_SAVE_BUTTON_ID)) return;

    const lastDiv = targetSection.querySelector("div:last-of-type");
    if (!lastDiv) return;

    const buttonWrapper = document.createElement("div");
    buttonWrapper.id = EAGLE_SAVE_BUTTON_ID;
    buttonWrapper.className = lastDiv.className;
    buttonWrapper.style.display = "flex";
    buttonWrapper.style.alignItems = "center";
    buttonWrapper.style.justifyContent = "center";
    buttonWrapper.style.gap = "8px";

    const saveButton = createPixivStyledButton("保存到 Eagle");
    saveButton.title = "将当前作品保存到 Eagle";
    saveButton.addEventListener("click", saveCurrentArtwork);

    const openFolderButton = createPixivStyledButton("打开画师文件夹");
    openFolderButton.addEventListener("click", openArtistFolderFromArtworkPage);

    buttonWrapper.appendChild(openFolderButton);
    buttonWrapper.appendChild(saveButton);
    targetSection.appendChild(buttonWrapper);

    if (getAutoCheckSavedStatus()) updateSaveButtonIfSaved(saveButton);

    addMoveToSubfolderButton();
}

export function handleSavedEventForArtworkDetail(payload) {
    const { kind, id } = payload;
    if (kind !== "artwork" && kind !== "manga-chapter") return;

    const artworkId = getArtworkId();
    if (!artworkId || id !== artworkId) return;

    const wrapper = document.getElementById(EAGLE_SAVE_BUTTON_ID);
    if (!wrapper) return;

    let saveButton = null;
    for (const child of wrapper.children) {
        if (child.id === EAGLE_OPEN_ITEM_BUTTON_ID) continue;
        const text = child.textContent;
        if (text === "保存到 Eagle" || text === "✅ 此作品已保存") {
            saveButton = child;
            break;
        }
    }
    if (!saveButton) return;

    if (saveButton.textContent === "✅ 此作品已保存") return;

    updateSaveButtonIfSaved(saveButton);
}
