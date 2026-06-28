"use strict";

import { getUiTheme } from "../tampermonkey/setting.js";

const STYLE_ID = "p2e-theme-styles";

let mediaQuery = null;
let mediaListener = null;

const THEME_CSS = `
:root,
[data-p2e-theme="light"] {
    --p2e-text: #333;
    --p2e-text-muted: #666;
    --p2e-bg: transparent;
    --p2e-bg-surface: #fff;
    --p2e-bg-badge: rgba(255, 255, 255, 0.95);
    --p2e-border: #d6d6d6;
    --p2e-accent: #0096fa;
    --p2e-accent-hover: #0075c5;
    --p2e-accent-active: #005c9c;
    --p2e-accent-text: #fff;
    --p2e-success: #4CAF50;
    --p2e-success-hover: #43a047;
    --p2e-success-border: #2E7D32;
    --p2e-error: #f44336;
    --p2e-error-hover: #d32f2f;
    --p2e-error-border: #C62828;
    --p2e-info: #0096fa;
    --p2e-info-border: #0277BD;
    --p2e-overlay: rgba(0, 0, 0, 0.5);
    --p2e-shadow: rgba(0, 0, 0, 0.15);
    --p2e-shadow-modal: rgba(0, 0, 0, 0.3);
    --p2e-progress-track: #e0e0e0;
    --p2e-toast-text: #fff;
}

[data-p2e-theme="dark"] {
    --p2e-text: #e0e0e0;
    --p2e-text-muted: #aaa;
    --p2e-bg: transparent;
    --p2e-bg-surface: #2d2d2d;
    --p2e-bg-badge: rgba(45, 45, 45, 0.95);
    --p2e-border: #555;
    --p2e-accent: #1a8cd8;
    --p2e-accent-hover: #1578bd;
    --p2e-accent-active: #106499;
    --p2e-accent-text: #fff;
    --p2e-success: #43a047;
    --p2e-success-hover: #388e3c;
    --p2e-success-border: #2e7d32;
    --p2e-error: #e53935;
    --p2e-error-hover: #c62828;
    --p2e-error-border: #b71c1c;
    --p2e-info: #1a8cd8;
    --p2e-info-border: #1565c0;
    --p2e-overlay: rgba(0, 0, 0, 0.7);
    --p2e-shadow: rgba(0, 0, 0, 0.4);
    --p2e-shadow-modal: rgba(0, 0, 0, 0.5);
    --p2e-progress-track: #444;
    --p2e-toast-text: #fff;
}

/* ========== 按钮 ========== */
.p2e-btn {
    cursor: pointer;
    font-size: 14px;
    padding: 8px 16px;
    border-radius: 999px;
    color: var(--p2e-text);
    background-color: var(--p2e-bg);
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s ease;
    border: 1px solid var(--p2e-border);
    box-sizing: border-box;
}

.p2e-btn:hover {
    background-color: var(--p2e-accent);
    color: var(--p2e-accent-text);
    border-color: var(--p2e-accent);
}

.p2e-btn:active {
    background-color: var(--p2e-accent-hover);
    border-color: var(--p2e-accent-hover);
}

.p2e-btn--primary {
    background-color: var(--p2e-accent);
    color: var(--p2e-accent-text);
    border: none;
    font-weight: bold;
}

.p2e-btn--primary:hover {
    background-color: var(--p2e-accent-hover);
    border-color: var(--p2e-accent-hover);
}

.p2e-btn--primary:active {
    background-color: var(--p2e-accent-active);
    border-color: var(--p2e-accent-active);
}

.p2e-btn--saved,
.p2e-btn--saved:hover,
.p2e-btn--saved:active {
    background-color: var(--p2e-success);
    color: var(--p2e-accent-text);
    border-color: var(--p2e-success);
}

.p2e-btn--saved:hover {
    background-color: var(--p2e-success-hover);
    border-color: var(--p2e-success-hover);
}

/* ========== Toast ========== */
#p2e-toast-container {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 999998;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
}

.p2e-toast {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 240px;
    max-width: 360px;
    padding: 12px 16px;
    border-left: 4px solid;
    border-radius: 8px;
    box-shadow: 0 4px 12px var(--p2e-shadow);
    color: var(--p2e-toast-text);
    font-size: 14px;
    line-height: 1.4;
    pointer-events: auto;
    transform: translateX(120%);
    opacity: 0;
    transition: transform 300ms ease, opacity 300ms ease;
}

.p2e-toast--success {
    background: var(--p2e-success);
    border-left-color: var(--p2e-success-border);
}

.p2e-toast--error {
    background: var(--p2e-error);
    border-left-color: var(--p2e-error-border);
}

.p2e-toast--info {
    background: var(--p2e-info);
    border-left-color: var(--p2e-info-border);
}

.p2e-toast__msg {
    flex: 1;
}

.p2e-toast__close {
    cursor: pointer;
    font-size: 18px;
    font-weight: bold;
    opacity: 0.8;
    margin-left: 4px;
}

.p2e-toast__close:hover {
    opacity: 1;
}

.p2e-toast--enter {
    transform: translateX(0);
    opacity: 1;
}

.p2e-toast--exit {
    transform: translateX(120%);
    opacity: 0;
}

/* ========== 徽章与标记 ========== */
.eagle-saved-badge {
    background-color: var(--p2e-bg-badge);
    color: var(--p2e-text);
}

.eagle-saved-mark {
    color: var(--p2e-text);
}

/* ========== EPUB 进度模态框 ========== */
.p2e-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--p2e-overlay);
    z-index: 999999;
    display: flex;
    justify-content: center;
    align-items: center;
}

.p2e-modal {
    background: var(--p2e-bg-surface);
    color: var(--p2e-text);
    border-radius: 8px;
    padding: 24px;
    min-width: 400px;
    max-width: 600px;
    box-shadow: 0 4px 20px var(--p2e-shadow-modal);
}

.p2e-modal__title {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--p2e-text);
}

.p2e-modal__progress-container {
    margin-bottom: 16px;
}

.p2e-modal__progress-track {
    width: 100%;
    height: 8px;
    background: var(--p2e-progress-track);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
}

.p2e-modal__progress-fill {
    height: 100%;
    width: 0%;
    background: var(--p2e-success);
    transition: width 0.3s ease;
}

.p2e-modal__progress-text {
    font-size: 14px;
    color: var(--p2e-text-muted);
    margin-top: 8px;
}

.p2e-modal__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
}

.p2e-modal__cancel-btn {
    padding: 8px 16px;
    background: var(--p2e-error);
    color: var(--p2e-accent-text);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s ease;
}

.p2e-modal__cancel-btn:hover:not(:disabled) {
    background: var(--p2e-error-hover);
}

.p2e-modal__cancel-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
`;

/**
 * 将用户偏好解析为实际主题
 * @param {"light"|"dark"|"system"} preference
 * @returns {"light"|"dark"}
 */
export function resolveTheme(preference) {
    if (preference === "light" || preference === "dark") {
        return preference;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * 应用主题到 document.documentElement.dataset.p2eTheme
 * @param {"light"|"dark"|"system"} [preference]
 * @returns {"light"|"dark"}
 */
export function applyTheme(preference) {
    const pref = preference ?? getUiTheme();
    const resolved = resolveTheme(pref);
    document.documentElement.dataset.p2eTheme = resolved;
    return resolved;
}

function onSystemThemeChange() {
    if (getUiTheme() === "system") {
        applyTheme("system");
    }
}

/**
 * 注入全局样式、应用当前主题、监听系统主题变化
 */
export function initTheme() {
    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = THEME_CSS;
        (document.head || document.documentElement).appendChild(style);
    }
    applyTheme();
    if (!mediaQuery) {
        mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        mediaListener = onSystemThemeChange;
        mediaQuery.addEventListener("change", mediaListener);
    }
}
