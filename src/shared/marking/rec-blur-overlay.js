"use strict";

/** 悬停解除时加在 overlay 上的共用 class（theme.js 定义样式） */
export const REC_BLUR_OVERLAY_REVEALED_CLASS = "p2e-rec-blur-overlay--revealed";

/**
 * @param {HTMLElement} li
 * @param {{ overlayClass: string, revealedClass?: string, positionDatasetKey?: string }} options
 * @returns {HTMLElement}
 */
export function ensureBlurOverlay(li, options) {
    const {
        overlayClass,
        revealedClass = REC_BLUR_OVERLAY_REVEALED_CLASS,
        positionDatasetKey,
    } = options;

    let overlay = li.querySelector(`.${overlayClass}`);
    if (overlay) return overlay;

    const computed = getComputedStyle(li);
    if (computed.position === "static" || !computed.position) {
        li.style.position = "relative";
        if (positionDatasetKey) {
            li.dataset[positionDatasetKey] = "1";
        }
    }

    overlay = document.createElement("div");
    overlay.className = overlayClass;
    Object.assign(overlay.style, {
        position: "absolute",
        inset: "0",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        backgroundColor: "rgba(0, 0, 0, 0.15)",
        zIndex: "10",
        pointerEvents: "auto",
        transition: "opacity 0.15s ease, backdrop-filter 0.15s ease",
    });

    const reveal = () => overlay.classList.add(revealedClass);
    const conceal = () => overlay.classList.remove(revealedClass);
    overlay.addEventListener("mouseenter", reveal);
    overlay.addEventListener("mouseleave", conceal);
    li.addEventListener("mouseenter", reveal);
    li.addEventListener("mouseleave", conceal);

    li.appendChild(overlay);
    return overlay;
}

/**
 * @param {HTMLElement} li
 * @param {string} overlayClass
 */
export function removeBlurOverlay(li, overlayClass) {
    li.querySelector(`.${overlayClass}`)?.remove();
}
