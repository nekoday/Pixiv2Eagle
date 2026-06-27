"use strict";

import { SETTING_KEYS, SETTING_DEFAULTS } from "../Tampermonkey/setting.js";

function getDebugMode() {
    return GM_getValue(SETTING_KEYS.DEBUG_MODE, SETTING_DEFAULTS[SETTING_KEYS.DEBUG_MODE]);
}

// ========== Toast 通知系统 ==========
// 右上角三色滑入式 toast，替代 alert()。最多 3 条堆叠，success/info 3s、error 5s 自动消失。

// toast 类型配置
const TOAST_CONFIG = {
    success: { bg: "#4CAF50", border: "#2E7D32", icon: "✅", duration: 3000, dismissible: false },
    error:   { bg: "#f44336", border: "#C62828", icon: "❌", duration: 5000, dismissible: true },
    info:    { bg: "#0096fa", border: "#0277BD", icon: "ℹ️", duration: 3000, dismissible: false },
};
const TOAST_MAX_VISIBLE = 3;
const TOAST_SLIDE_MS = 300; // 入场/出场动画时长

// 惰性获取/创建 toast 容器
function getToastContainer() {
    let container = document.getElementById("p2e-toast-container");
    if (container) return container;
    container = document.createElement("div");
    container.id = "p2e-toast-container";
    container.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 999998;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
    `;
    document.body.appendChild(container);
    return container;
}

// 触发 toast 出场动画并移除
function dismissToast(element) {
    element.style.transform = "translateX(120%)";
    element.style.opacity = "0";
    setTimeout(() => {
        if (element.parentNode) element.parentNode.removeChild(element);
    }, TOAST_SLIDE_MS);
}

/**
 * 显示一条 toast 通知
 * @param {string} message - 消息文本
 * @param {"success"|"error"|"info"} type - 通知类型（缺省 "info"）
 */
export function showToast(message, type = "info") {
    if (!document.body) return; // 降级：body 不存在时静默退出
    const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
    const container = getToastContainer();

    // 堆叠上限：超过 3 条时移除最早的
    while (container.children.length >= TOAST_MAX_VISIBLE) {
        const oldest = container.firstElementChild;
        if (oldest) dismissToast(oldest);
        else break;
    }

    const toast = document.createElement("div");
    toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 240px;
        max-width: 360px;
        padding: 12px 16px;
        background: ${config.bg};
        border-left: 4px solid ${config.border};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        color: #fff;
        font-size: 14px;
        line-height: 1.4;
        pointer-events: auto;
        transform: translateX(120%);
        opacity: 0;
        transition: transform ${TOAST_SLIDE_MS}ms ease, opacity ${TOAST_SLIDE_MS}ms ease;
    `;

    const iconSpan = document.createElement("span");
    iconSpan.textContent = config.icon;
    toast.appendChild(iconSpan);

    const msgSpan = document.createElement("span");
    msgSpan.textContent = message;
    msgSpan.style.flex = "1";
    toast.appendChild(msgSpan);

    // error 型带手动关闭按钮
    if (config.dismissible) {
        const closeBtn = document.createElement("span");
        closeBtn.textContent = "×";
        closeBtn.style.cssText = `
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
            opacity: 0.8;
            margin-left: 4px;
        `;
        closeBtn.addEventListener("mouseenter", () => { closeBtn.style.opacity = "1"; });
        closeBtn.addEventListener("mouseleave", () => { closeBtn.style.opacity = "0.8"; });
        closeBtn.addEventListener("click", () => dismissToast(toast));
        toast.appendChild(closeBtn);
    }

    container.appendChild(toast);

    // 下一帧触发入场动画
    requestAnimationFrame(() => {
        toast.style.transform = "translateX(0)";
        toast.style.opacity = "1";
    });

    // 到时自动出场
    setTimeout(() => dismissToast(toast), config.duration);
}

// 显示消息（根据调试模式决定是否显示）——内部委托 showToast（P2 改造）
export function showMessage(message, forceShow = false) {
    if (getDebugMode() || forceShow) {
        showToast(message, "info");
    }
}
