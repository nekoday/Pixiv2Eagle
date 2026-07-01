"use strict";

import { SETTING_KEYS, SETTING_DEFAULTS } from "../tampermonkey/setting.js";

function getDebugMode() {
    return GM_getValue(SETTING_KEYS.DEBUG_MODE, SETTING_DEFAULTS[SETTING_KEYS.DEBUG_MODE]);
}

// ========== Toast 通知系统 ==========
// 右上角四色滑入式 toast，替代 alert()。最多 3 条堆叠，success/info/warning 3s、error 5s 自动消失。

const TOAST_CONFIG = {
    success: { className: "p2e-toast p2e-toast--success", icon: "✅", duration: 3000, dismissible: false },
    error:   { className: "p2e-toast p2e-toast--error", icon: "❌", duration: 5000, dismissible: true },
    info:    { className: "p2e-toast p2e-toast--info", icon: "ℹ️", duration: 3000, dismissible: false },
    warning: { className: "p2e-toast p2e-toast--warning", icon: "⚠️", duration: 3000, dismissible: false },
};
const TOAST_MAX_VISIBLE = 3;
const TOAST_SLIDE_MS = 300;

function getToastContainer() {
    let container = document.getElementById("p2e-toast-container");
    if (container) return container;
    container = document.createElement("div");
    container.id = "p2e-toast-container";
    document.body.appendChild(container);
    return container;
}

function dismissToast(element) {
    element.classList.remove("p2e-toast--enter");
    element.classList.add("p2e-toast--exit");
    setTimeout(() => {
        if (element.parentNode) element.parentNode.removeChild(element);
    }, TOAST_SLIDE_MS);
}

/**
 * 显示一条 toast 通知
 * @param {string} message
 * @param {"success"|"error"|"info"|"warning"} [type="info"]
 */
export function showToast(message, type = "info") {
    if (!document.body) return;
    const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
    const container = getToastContainer();

    while (container.children.length >= TOAST_MAX_VISIBLE) {
        const oldest = container.firstElementChild;
        if (oldest) dismissToast(oldest);
        else break;
    }

    const toast = document.createElement("div");
    toast.className = config.className;

    const iconSpan = document.createElement("span");
    iconSpan.textContent = config.icon;
    toast.appendChild(iconSpan);

    const msgSpan = document.createElement("span");
    msgSpan.textContent = message;
    msgSpan.className = "p2e-toast__msg";
    toast.appendChild(msgSpan);

    if (config.dismissible) {
        const closeBtn = document.createElement("span");
        closeBtn.textContent = "×";
        closeBtn.className = "p2e-toast__close";
        closeBtn.addEventListener("click", () => dismissToast(toast));
        toast.appendChild(closeBtn);
    }

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("p2e-toast--enter");
    });

    setTimeout(() => dismissToast(toast), config.duration);
}

export function showMessage(message, forceShow = false) {
    if (getDebugMode() || forceShow) {
        showToast(message, "info");
    }
}
