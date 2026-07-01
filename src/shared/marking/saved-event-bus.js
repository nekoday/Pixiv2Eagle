"use strict";

import { patchEagleIndex } from "../../eagle/index-cache.js";
import { handleSavedEventForArtworkDetail } from "../../artwork/ui/save-button.js";
import { handleSavedEventForRecommendation } from "../../artwork/ui/recommendation-mark.js";
import { handleSavedEventForArtistList } from "../../artist-list/marking.js";
import { handleSavedEventForNovelDetail } from "../../novel/ui/saved-state.js";
import { handleSavedEventForNovelSeries } from "../../novel/series/marking.js";

export const SAVED_EVENT_NAME = "p2e:saved";
export const BROADCAST_CHANNEL_NAME = "p2e-saved";
export const GM_RECENT_SAVES_KEY = "p2e_recent_saves";
export const RECENT_SAVES_MAX = 50;

/**
 * @typedef {'artwork' | 'novel' | 'manga-chapter'} SavedKind
 */

/**
 * @typedef {{
 *   kind: SavedKind,
 *   id: string,
 *   userId?: string,
 *   folderId: string,
 *   itemId?: string,
 *   savedAt: number,
 * }} SavedPayload
 */

/** @type {Set<(payload: SavedPayload) => void>} */
const listeners = new Set();

/** @type {Set<string>} */
const processedKeys = new Set();

/** @type {BroadcastChannel | null | undefined} */
let broadcastChannel = null;

let initialized = false;

/**
 * @param {SavedPayload} payload
 * @returns {string}
 */
function payloadDedupKey(payload) {
    return `${payload.kind}:${payload.id}:${payload.savedAt}`;
}

/**
 * @param {unknown} raw
 * @returns {SavedPayload[]}
 */
function parseRecentSaves(raw) {
    if (!raw) return [];
    try {
        const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

/**
 * @returns {SavedPayload[]}
 */
function readRecentSaves() {
    return parseRecentSaves(GM_getValue(GM_RECENT_SAVES_KEY, "[]"));
}

/**
 * @param {SavedPayload} payload
 */
function pushRecentSave(payload) {
    const saves = readRecentSaves();
    const entryKey = `${payload.kind}:${payload.id}`;
    const filtered = saves.filter((s) => `${s.kind}:${s.id}` !== entryKey);
    filtered.push(payload);
    while (filtered.length > RECENT_SAVES_MAX) {
        filtered.shift();
    }
    GM_setValue(GM_RECENT_SAVES_KEY, JSON.stringify(filtered));
}

/**
 * @param {SavedPayload} payload
 */
function dispatchToListeners(payload) {
    if (!payload || !payload.kind || !payload.id) return;

    const key = payloadDedupKey(payload);
    if (processedKeys.has(key)) return;
    processedKeys.add(key);

    for (const listener of listeners) {
        try {
            listener(payload);
        } catch {
            // 订阅者错误不阻断其他订阅者
        }
    }
}

/**
 * @param {(event: MessageEvent) => void} onMessage
 * @returns {BroadcastChannel | null}
 */
function ensureBroadcastChannel(onMessage) {
    if (broadcastChannel === undefined) return null;
    if (broadcastChannel) {
        if (onMessage) broadcastChannel.onmessage = onMessage;
        return broadcastChannel;
    }
    try {
        if (typeof BroadcastChannel !== "undefined") {
            broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
            if (onMessage) broadcastChannel.onmessage = onMessage;
            return broadcastChannel;
        }
    } catch {
        // BroadcastChannel 不可用时静默跳过
    }
    broadcastChannel = undefined;
    return null;
}

/**
 * 注册保存事件订阅。
 * @param {(payload: SavedPayload) => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribeSaved(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * 保存落盘确认后调用。
 * 顺序：补 savedAt → patchEagleIndex → GM 环形缓冲 → BroadcastChannel → CustomEvent
 * @param {SavedPayload} payload
 */
export function publishSaved(payload) {
    /** @type {SavedPayload} */
    const normalized = { ...payload };
    if (!normalized.savedAt) {
        normalized.savedAt = Date.now();
    }

    if (normalized.userId && normalized.id) {
        patchEagleIndex({
            userId: normalized.userId,
            pid: normalized.id,
            folderId: normalized.folderId,
        });
    }

    pushRecentSave(normalized);

    const channel = ensureBroadcastChannel(null);
    if (channel) {
        try {
            channel.postMessage(normalized);
        } catch {
            // 跨 tab 广播失败时依赖 GM 回放
        }
    }

    document.dispatchEvent(
        new CustomEvent(SAVED_EVENT_NAME, { detail: normalized })
    );
}

/**
 * 启动 BroadcastChannel、document/GM 监听与 recentSaves 回放。
 * 先注册全部 handler，再回放 GM 缓冲，避免启动时丢失事件。
 */
export function initSavedEventBus() {
    if (initialized) return;
    initialized = true;

    subscribeSaved(handleSavedEventForArtworkDetail);
    subscribeSaved(handleSavedEventForRecommendation);
    subscribeSaved(handleSavedEventForArtistList);
    subscribeSaved(handleSavedEventForNovelDetail);
    subscribeSaved(handleSavedEventForNovelSeries);

    ensureBroadcastChannel((event) => {
        if (event.data) dispatchToListeners(event.data);
    });

    document.addEventListener(SAVED_EVENT_NAME, (event) => {
        if (event.detail) dispatchToListeners(event.detail);
    });

    GM_addValueChangeListener(GM_RECENT_SAVES_KEY, (_name, _oldValue, newValue, remote) => {
        if (!remote) return;
        for (const payload of parseRecentSaves(newValue)) {
            dispatchToListeners(payload);
        }
    });

    for (const payload of readRecentSaves()) {
        dispatchToListeners(payload);
    }
}
