"use strict";

import { getAutoCheckSavedStatus } from "../../Tampermonkey/setting.js";
import { dbg, err } from "../../Tampermonkey/logger.js";
import { createPixivStyledButton } from "../../ui/button.js";
import { waitForElement } from "../../ui/dom.js";
import {
    EAGLE_SAVE_BUTTON_ID,
} from "../../config/constants.js";
import {
    NOVEL_SAVE_BUTTON_SECTION_SELECTOR,
    NOVEL_AUTHOR_CONTAINER_SELECTOR,
} from "../../config/selectors/index.js";
import {
    findNovelTitle,
    findNovelTagsContainer,
} from "../resolvers.js";
import { saveCurrentNovel } from "../save/index.js";
import { updateNovelSaveButtonIfSaved } from "./saved-state.js";

let addNovelButtonLock = false;

export async function addNovelButton() {
    if (addNovelButtonLock) {
        return;
    }

    const oldWrapper = document.getElementById(EAGLE_SAVE_BUTTON_ID);
    if (oldWrapper) {
        return;
    }

    addNovelButtonLock = true;

    let targetSection = await waitForElement(NOVEL_SAVE_BUTTON_SECTION_SELECTOR, 3000);

    if (!targetSection) {
        dbg("主选择器失败，尝试备用方案...");

        const titleElement = findNovelTitle();
        if (titleElement) {
            let parent = titleElement.parentElement;
            let attempts = 0;
            while (parent && attempts < 10) {
                const sections = parent.querySelectorAll("section");
                for (const section of sections) {
                    if (section.querySelector("button") || section.querySelector('a[role="button"]')) {
                        targetSection = section;
                        dbg("通过标题定位到目标区域:", section.className);
                        break;
                    }
                }
                if (targetSection) break;
                parent = parent.parentElement;
                attempts++;
            }
        }

        if (!targetSection) {
            const tagsContainer = findNovelTagsContainer();
            if (tagsContainer) {
                targetSection = tagsContainer.parentElement;
                dbg("通过标签容器定位到目标区域");
            }
        }

        if (!targetSection) {
            const authorContainer = document.querySelector(NOVEL_AUTHOR_CONTAINER_SELECTOR);
            if (authorContainer) {
                let parent = authorContainer.parentElement;
                let attempts = 0;
                while (parent && attempts < 10) {
                    if (parent.tagName === "SECTION") {
                        targetSection = parent;
                        dbg("通过作者信息定位到目标区域");
                        break;
                    }
                    parent = parent.parentElement;
                    attempts++;
                }
            }
        }
    }

    if (!targetSection) {
        err("无法找到小说保存按钮插入位置，请检查页面结构");
        addNovelButtonLock = false;
        return;
    }

    const doubleCheckButton = document.getElementById(EAGLE_SAVE_BUTTON_ID);
    if (doubleCheckButton) {
        addNovelButtonLock = false;
        return;
    }

    const buttonWrapper = document.createElement("div");
    buttonWrapper.id = EAGLE_SAVE_BUTTON_ID;
    buttonWrapper.style.display = "flex";
    buttonWrapper.style.alignItems = "center";
    buttonWrapper.style.justifyContent = "center";
    buttonWrapper.style.gap = "8px";
    buttonWrapper.style.marginTop = "16px";

    const saveButton = createPixivStyledButton("保存到 Eagle");
    saveButton.addEventListener("click", function () {
        saveCurrentNovel();
    });

    buttonWrapper.appendChild(saveButton);
    targetSection.appendChild(buttonWrapper);

    if (getAutoCheckSavedStatus()) {
        updateNovelSaveButtonIfSaved(saveButton);
    }

    addNovelButtonLock = false;
}
