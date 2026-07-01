"use strict";

import { isArtworkSavedInEagle, getAllEagleItemsInFolder } from "./items.js";
import { getEagleSavePollTimeoutMs } from "../tampermonkey/setting.js";

const POLL_INTERVAL_MS = 1000;

function makeAbortError(message = "保存已取消") {
    const e = new Error(message);
    e.name = "AbortError";
    return e;
}

/**
 * 可被 AbortSignal 提前中断的 sleep。
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
 */
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(makeAbortError());
            return;
        }
        const timer = setTimeout(() => {
            if (signal) signal.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        function onAbort() {
            clearTimeout(timer);
            reject(makeAbortError());
        }
        if (signal) signal.addEventListener("abort", onAbort, { once: true });
    });
}

/**
 * 单页 / 单 item 场景：轮询 isArtworkSavedInEagle 直到 saved 或超时。
 *
 * @param {{
 *   artworkId: string,
 *   folderId: string,
 *   signal?: AbortSignal,
 *   onProgress?: (j: number, N: number) => void,
 * }} params
 * @returns {Promise<{ itemId?: string }>}
 */
export async function waitForArtworkPersist({ artworkId, folderId, signal, onProgress }) {
    const deadline = Date.now() + getEagleSavePollTimeoutMs();
    for (;;) {
        if (signal?.aborted) throw makeAbortError();
        const { saved, itemId } = await isArtworkSavedInEagle(artworkId, folderId);
        if (saved) {
            onProgress?.(1, 1);
            return { itemId };
        }
        if (Date.now() >= deadline) {
            throw new Error("落盘等待超时");
        }
        await sleep(POLL_INTERVAL_MS, signal);
    }
}

/**
 * 多 item 场景：baseline + 文件夹计数，轮询直到落盘项数达到 target 或超时。
 *
 * 通过条件：getAllEagleItemsInFolder(folderId).length - baselineCount >= target。
 *
 * @param {{
 *   folderId: string,
 *   baselineCount: number,
 *   target: number,
 *   signal?: AbortSignal,
 *   onProgress?: (persisted: number) => void,
 * }} params
 * @returns {Promise<{ count: number }>}
 */
export async function waitForFolderCountPersist({ folderId, baselineCount, target, signal, onProgress }) {
    const deadline = Date.now() + getEagleSavePollTimeoutMs();
    for (;;) {
        if (signal?.aborted) throw makeAbortError();
        const items = await getAllEagleItemsInFolder(folderId);
        const persisted = Math.max(0, items.length - baselineCount);
        onProgress?.(persisted);
        if (persisted >= target) {
            return { count: items.length };
        }
        if (Date.now() >= deadline) {
            throw new Error(`落盘等待超时（已确认 ${persisted}/${target}）`);
        }
        await sleep(POLL_INTERVAL_MS, signal);
    }
}
