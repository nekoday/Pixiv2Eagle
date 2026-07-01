"use strict";

import { SAVE_STAGE } from "./types.js";
import { openInEagle } from "../../eagle/deep-link.js";
import { openSavedArtworkInEagle } from "../../artwork/open-saved.js";

const TITLE_MAX = 30;
const AUTO_DISMISS = { success: 10000, error: 5000, cancelled: 3000 };
const CANCELLED_TEXT = "已取消（Eagle 可能仍在下载已提交部分）";

let containerEl = null;

function getContainer() {
    if (containerEl && document.body.contains(containerEl)) return containerEl;
    containerEl = document.getElementById("p2e-save-progress-container");
    if (containerEl) return containerEl;
    containerEl = document.createElement("div");
    containerEl.id = "p2e-save-progress-container";
    document.body.appendChild(containerEl);
    return containerEl;
}

function truncateTitle(title) {
    if (!title) return "";
    return title.length > TITLE_MAX ? title.slice(0, TITLE_MAX) + "…" : title;
}

function setProgressFill(fillEl, percent) {
    fillEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
}

/**
 * @param {() => void} onAbort — 用户点 × 时调用 task.abort()
 * @returns 视图控制器
 */
export function createSaveProgressToastView(onAbort) {
    const root = document.createElement("div");
    root.className = "p2e-save-toast";

    const header = document.createElement("div");
    header.className = "p2e-save-toast__header";
    const headerText = document.createElement("span");
    headerText.textContent = "保存中";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "p2e-save-toast__close";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "取消");
    let closeClickHandler = () => onAbort();
    closeBtn.addEventListener("click", closeClickHandler);

    function bindCloseToRemove() {
        closeBtn.removeEventListener("click", closeClickHandler);
        closeClickHandler = () => remove();
        closeBtn.addEventListener("click", closeClickHandler);
    }
    header.appendChild(headerText);
    header.appendChild(closeBtn);

    const workIndexRow = document.createElement("div");
    workIndexRow.className = "p2e-save-toast__work-row";
    workIndexRow.hidden = true;

    const meta = document.createElement("div");
    meta.className = "p2e-save-toast__meta";

    const submitSection = document.createElement("div");
    submitSection.className = "p2e-save-toast__submit-section";
    submitSection.hidden = true;
    const submitRow = document.createElement("div");
    submitRow.className = "p2e-save-toast__page-row";
    const submitTrack = document.createElement("div");
    submitTrack.className = "p2e-modal__progress-track";
    const submitFill = document.createElement("div");
    submitFill.className = "p2e-modal__progress-fill";
    submitTrack.appendChild(submitFill);
    const submitPercent = document.createElement("div");
    submitPercent.className = "p2e-save-toast__percent";
    submitSection.appendChild(submitRow);
    submitSection.appendChild(submitTrack);
    submitSection.appendChild(submitPercent);

    const pageRow = document.createElement("div");
    pageRow.className = "p2e-save-toast__page-row";

    const mainTrack = document.createElement("div");
    mainTrack.className = "p2e-modal__progress-track";
    const mainFill = document.createElement("div");
    mainFill.className = "p2e-modal__progress-fill";
    mainTrack.appendChild(mainFill);
    const mainPercent = document.createElement("div");
    mainPercent.className = "p2e-save-toast__percent";

    const frameSection = document.createElement("div");
    frameSection.className = "p2e-save-toast__frame-section";
    frameSection.hidden = true;
    const frameRow = document.createElement("div");
    frameRow.className = "p2e-save-toast__frame-row";
    const frameTrack = document.createElement("div");
    frameTrack.className = "p2e-modal__progress-track";
    const frameFill = document.createElement("div");
    frameFill.className = "p2e-modal__progress-fill";
    frameTrack.appendChild(frameFill);
    const framePercent = document.createElement("div");
    framePercent.className = "p2e-save-toast__percent";
    frameSection.appendChild(frameRow);
    frameSection.appendChild(frameTrack);
    frameSection.appendChild(framePercent);

    root.appendChild(header);
    root.appendChild(workIndexRow);
    root.appendChild(meta);
    root.appendChild(submitSection);
    root.appendChild(pageRow);
    root.appendChild(mainTrack);
    root.appendChild(mainPercent);
    root.appendChild(frameSection);

    getContainer().appendChild(root);

    let dismissTimer = null;

    function clearDismissTimer() {
        if (dismissTimer) {
            clearTimeout(dismissTimer);
            dismissTimer = null;
        }
    }

    function remove() {
        clearDismissTimer();
        if (root.parentNode) root.parentNode.removeChild(root);
    }

    function scheduleDismiss(ms) {
        clearDismissTimer();
        dismissTimer = setTimeout(remove, ms);
    }

    function hideProgressRows() {
        workIndexRow.hidden = true;
        submitSection.hidden = true;
        pageRow.hidden = true;
        mainTrack.hidden = true;
        mainPercent.hidden = true;
        frameSection.hidden = true;
    }

    return {
        setHeaderText(text) {
            headerText.textContent = text;
        },
        setWorkIndex(current, total) {
            workIndexRow.hidden = false;
            workIndexRow.textContent = `作品 ${current} / ${total}`;
        },
        updateArtworkInfo(artworkId, title) {
            meta.textContent = `#${artworkId}  ${truncateTitle(title)}`;
        },
        setProgressState(s) {
            pageRow.hidden = false;
            mainTrack.hidden = false;
            mainPercent.hidden = false;

            if (s.stage === SAVE_STAGE.UPLOADING) {
                // 双轨：副条（提交，上）+ 主条（落盘，下）
                submitSection.hidden = false;
                frameSection.hidden = true;
                submitRow.textContent = `提交 ${s.submitCurrent} / ${s.submitTotal}`;
                setProgressFill(submitFill, s.submitPercent);
                submitPercent.textContent = `${s.submitPercent}%`;
                pageRow.textContent = `落盘 ${s.eagleCurrent} / ${s.eagleTotal}`;
                setProgressFill(mainFill, s.eaglePercent);
                mainPercent.textContent = `${s.eaglePercent}%`;
                return;
            }

            // 非 uploading：单条阶段加权主条 + 可选帧副条
            submitSection.hidden = true;
            pageRow.textContent = `分 p ${s.pageCurrent} / ${s.pageTotal}`;
            setProgressFill(mainFill, s.mainPercent);
            mainPercent.textContent = `${s.mainPercent}%`;
            const showFrame = s.stage === SAVE_STAGE.CONVERTING;
            frameSection.hidden = !showFrame;
            if (showFrame) {
                frameRow.textContent = `帧 ${s.frameCurrent} / ${s.frameTotal}`;
                setProgressFill(frameFill, s.framePercent);
                framePercent.textContent = `${s.framePercent}%`;
            }
        },
        setSuccess({ folderId, itemId, artworkId, pageCount, openSavedArtwork }) {
            clearDismissTimer();
            root.className = "p2e-save-toast p2e-save-toast--success";
            hideProgressRows();
            headerText.textContent = "✓ 保存成功";
            bindCloseToRemove();

            const footer = document.createElement("div");
            footer.className = "p2e-save-toast__footer";
            const openBtn = document.createElement("button");
            openBtn.type = "button";
            openBtn.className = "p2e-save-toast__open-btn";
            openBtn.textContent = "打开";
            openBtn.addEventListener("click", () => {
                if (openSavedArtwork) {
                    openSavedArtworkInEagle({
                        artworkId,
                        folderId,
                        itemId,
                        pageCount,
                        mode: "toast",
                    });
                } else {
                    openInEagle({ itemId, folderId });
                }
            });
            footer.appendChild(openBtn);
            root.appendChild(footer);
            scheduleDismiss(AUTO_DISMISS.success);
        },
        setError(message) {
            clearDismissTimer();
            root.className = "p2e-save-toast p2e-save-toast--error";
            hideProgressRows();
            headerText.textContent = message;
            bindCloseToRemove();
            scheduleDismiss(AUTO_DISMISS.error);
        },
        setCancelled() {
            clearDismissTimer();
            root.className = "p2e-save-toast p2e-save-toast--cancelled";
            hideProgressRows();
            headerText.textContent = CANCELLED_TEXT;
            bindCloseToRemove();
            scheduleDismiss(AUTO_DISMISS.cancelled);
        },
        remove,
    };
}
