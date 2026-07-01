"use strict";

let openInstance = null;

/**
 * @param {{ title: string, onClose: () => void }} options
 * @returns {{ bodyEl: HTMLElement, close: () => void, isOpen: () => boolean }}
 */
export function createControlPanelModal({ title, onClose }) {
    if (openInstance) {
        openInstance.overlay.focus();
        return openInstance.api;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const overlay = document.createElement("div");
    overlay.className = "p2e-modal-overlay";
    overlay.tabIndex = -1;

    const modal = document.createElement("div");
    modal.className = "p2e-modal p2e-control-panel";

    const header = document.createElement("div");
    header.className = "p2e-control-panel__header";

    const titleEl = document.createElement("h3");
    titleEl.className = "p2e-modal__title";
    titleEl.textContent = title;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "p2e-control-panel__close";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "关闭");

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    const bodyEl = document.createElement("div");
    bodyEl.className = "p2e-control-panel__body";

    modal.appendChild(header);
    modal.appendChild(bodyEl);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close() {
        document.removeEventListener("keydown", onKeyDown);
        document.body.style.overflow = prevOverflow;
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        openInstance = null;
        onClose();
    }

    function onKeyDown(e) {
        if (e.key === "Escape") close();
    }

    closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", onKeyDown);

    const api = { bodyEl, close, isOpen: () => openInstance !== null };
    openInstance = { overlay, api };
    overlay.focus();
    return api;
}

/** @returns {boolean} */
export function isControlPanelOpen() {
    return openInstance !== null;
}

/** 面板已打开时聚焦现有模态，避免叠层 */
export function focusControlPanel() {
    if (openInstance) {
        openInstance.overlay.focus();
    }
}
