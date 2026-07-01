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
    --p2e-warning: #FF9800;
    --p2e-warning-border: #EF6C00;
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
    --p2e-warning: #FB8C00;
    --p2e-warning-border: #E65100;
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

.p2e-toast--warning {
    background: var(--p2e-warning);
    border-left-color: var(--p2e-warning-border);
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

/* ========== 保存进度 Toast ========== */
#p2e-save-progress-container {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 999998;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
}

.p2e-save-toast {
    pointer-events: auto;
    width: max-content;
    max-width: min(420px, calc(100vw - 32px));
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--p2e-bg-surface);
    color: var(--p2e-text);
    border: 1px solid var(--p2e-border);
    box-shadow: 0 4px 12px var(--p2e-shadow);
    font-size: 14px;
    line-height: 1.4;
}

.p2e-save-toast__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    font-weight: 600;
}

.p2e-save-toast__close {
    cursor: pointer;
    font-size: 18px;
    font-weight: bold;
    color: var(--p2e-text-muted);
    background: none;
    border: none;
    padding: 0 4px;
    line-height: 1;
}

.p2e-save-toast__close:hover {
    color: var(--p2e-text);
}

.p2e-save-toast__meta {
    color: var(--p2e-text-muted);
    font-size: 13px;
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.p2e-save-toast__page-row,
.p2e-save-toast__frame-row {
    font-size: 13px;
    color: var(--p2e-text-muted);
    margin-bottom: 4px;
}

.p2e-save-toast__frame-section {
    margin-top: 8px;
}

.p2e-save-toast__frame-section[hidden] {
    display: none;
}

.p2e-save-toast__work-row {
    font-size: 13px;
    font-weight: 600;
    color: var(--p2e-text);
    margin-bottom: 6px;
}

.p2e-save-toast__work-row[hidden] {
    display: none;
}

.p2e-save-toast__submit-section {
    margin-bottom: 8px;
}

.p2e-save-toast__submit-section[hidden] {
    display: none;
}

.p2e-save-toast__percent {
    font-size: 12px;
    color: var(--p2e-text-muted);
    text-align: right;
    margin-top: 4px;
}

.p2e-save-toast--success .p2e-save-toast__header {
    color: var(--p2e-success);
}

.p2e-save-toast--error .p2e-save-toast__header {
    color: var(--p2e-error);
}

.p2e-save-toast--cancelled .p2e-save-toast__header {
    color: var(--p2e-info);
}

.p2e-save-toast__footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
}

.p2e-save-toast__open-btn {
    padding: 6px 14px;
    font-size: 13px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    background: var(--p2e-accent);
    color: var(--p2e-accent-text);
}

.p2e-save-toast__open-btn:hover {
    background: var(--p2e-accent-hover);
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

/* ========== 控制面板 FAB ========== */
#p2e-control-fab {
    position: fixed;
    z-index: 999998;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--p2e-accent);
    color: var(--p2e-accent-text);
    border: none;
    box-shadow: 0 2px 8px var(--p2e-shadow);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    user-select: none;
    touch-action: none;
}

#p2e-control-fab.p2e-control-fab--collapsed {
    width: 24px;
    height: 64px;
    border-radius: 4px 0 0 4px;
    font-size: 12px;
    writing-mode: vertical-rl;
}

#p2e-control-fab:hover {
    background: var(--p2e-accent-hover);
}

/* ========== 控制面板模态扩展 ========== */
.p2e-modal.p2e-control-panel {
    min-width: 400px;
    max-width: 640px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    padding: 0;
}

.p2e-control-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--p2e-border);
}

.p2e-control-panel__header .p2e-modal__title {
    margin: 0;
}

.p2e-control-panel__close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--p2e-text-muted);
    line-height: 1;
}

.p2e-control-panel__body {
    overflow-y: auto;
    padding: 16px 24px 24px;
}

.p2e-control-panel__section-title {
    font-size: 14px;
    font-weight: 600;
    margin: 16px 0 8px;
    color: var(--p2e-text);
}

.p2e-control-panel fieldset {
    border: 1px solid var(--p2e-border);
    border-radius: 8px;
    margin: 0 0 12px;
    padding: 12px 16px;
}

.p2e-control-panel legend {
    font-size: 13px;
    font-weight: 600;
    padding: 0 4px;
}

.p2e-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}

.p2e-toggle__input {
    appearance: none;
    width: 40px;
    height: 22px;
    background: var(--p2e-border);
    border-radius: 11px;
    position: relative;
    cursor: pointer;
    transition: background 0.2s;
}

.p2e-toggle__input:checked {
    background: var(--p2e-accent);
}

.p2e-toggle__input::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
}

.p2e-toggle__input:checked::after {
    transform: translateX(18px);
}

.p2e-inline-error {
    color: var(--p2e-error);
    font-size: 12px;
    margin-top: 4px;
}

.p2e-status-bar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 16px;
    padding: 12px;
    background: var(--p2e-bg-badge);
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 12px;
}

.p2e-status-bar__label {
    color: var(--p2e-text-muted);
}

.p2e-status-bar__value--error {
    color: var(--p2e-error);
}

.p2e-status-bar__badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    background: var(--p2e-border);
}

.p2e-status-bar__badge--on {
    background: var(--p2e-success);
    color: var(--p2e-accent-text);
}

.p2e-action-log__list {
    font-size: 12px;
    max-height: 120px;
    overflow-y: auto;
}

.p2e-action-log__item {
    padding: 4px 0;
    border-bottom: 1px solid var(--p2e-border);
}

.p2e-action-log__item--success {
    color: var(--p2e-success);
}

.p2e-action-log__item--error {
    color: var(--p2e-error);
}

.p2e-action-log__item--pending {
    color: var(--p2e-text-muted);
}

.p2e-action-log__empty {
    color: var(--p2e-text-muted);
    font-size: 12px;
}

.p2e-segmented {
    display: inline-flex;
    gap: 4px;
    flex-wrap: wrap;
}

.p2e-segmented__btn {
    padding: 4px 12px;
    font-size: 13px;
    border: 1px solid var(--p2e-border);
    border-radius: 4px;
    background: var(--p2e-bg-surface);
    color: var(--p2e-text);
    cursor: pointer;
}

.p2e-segmented__btn--active {
    background: var(--p2e-accent);
    color: var(--p2e-accent-text);
    border-color: var(--p2e-accent);
}

.p2e-control-panel__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
}

.p2e-control-panel__input-row {
    display: flex;
    gap: 8px;
    margin-top: 4px;
}

.p2e-control-panel__input-row input[type="text"] {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--p2e-border);
    border-radius: 4px;
    background: var(--p2e-bg-surface);
    color: var(--p2e-text);
    font-size: 13px;
}

.p2e-control-panel__textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border: 1px solid var(--p2e-border);
    border-radius: 4px;
    background: var(--p2e-bg-surface);
    color: var(--p2e-text);
    font-size: 12px;
    font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace;
    line-height: 1.4;
    resize: vertical;
    min-height: 72px;
    margin-top: 8px;
}

.p2e-control-panel__textarea[readonly] {
    opacity: 0.9;
    cursor: default;
}

.p2e-control-panel__backup-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
}

.p2e-control-panel__select {
    padding: 6px 10px;
    border: 1px solid var(--p2e-border);
    border-radius: 4px;
    background: var(--p2e-bg-surface);
    color: var(--p2e-text);
    font-size: 13px;
    cursor: pointer;
}

.p2e-control-panel__label-with-help {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.p2e-help-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 600;
    color: var(--p2e-text-muted);
    background: transparent;
    border: 1px solid var(--p2e-border);
    cursor: help;
    position: relative;
    flex-shrink: 0;
}

.p2e-help-trigger:hover {
    color: var(--p2e-accent);
    border-color: var(--p2e-accent);
}

.p2e-help-tooltip {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 6px);
    transform: translateX(-50%);
    width: max-content;
    max-width: 240px;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: normal;
    line-height: 1.45;
    white-space: normal;
    color: var(--p2e-text);
    background: var(--p2e-bg-surface);
    border: 1px solid var(--p2e-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px var(--p2e-shadow);
    z-index: 10;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.15s ease, visibility 0.15s ease;
}

.p2e-help-trigger:hover .p2e-help-tooltip,
.p2e-help-trigger:focus-visible .p2e-help-tooltip {
    opacity: 1;
    visibility: visible;
}

.p2e-template-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
}

.p2e-template-chip {
    padding: 4px 10px;
    font-size: 13px;
    font-family: monospace;
    border: 1px solid var(--p2e-border);
    border-radius: 4px;
    background: var(--p2e-bg-surface);
    color: var(--p2e-text);
    cursor: pointer;
}

.p2e-template-chip:hover {
    background: var(--p2e-accent);
    color: var(--p2e-accent-text);
    border-color: var(--p2e-accent);
}

.p2e-control-panel__action-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.p2e-control-panel__action-stack .p2e-btn {
    width: 100%;
    box-sizing: border-box;
}

/* ========== 推荐区过滤遮罩（同作者 / 已保存共用） ========== */
.p2e-rec-blur-overlay--revealed {
    opacity: 0 !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
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
