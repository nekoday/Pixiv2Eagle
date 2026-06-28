"use strict";

import { gmFetchText } from "../Tampermonkey/request.js";
import { USE_DOMESTIC_CDN } from "../config/constants.js";

let __gifWorkerURL = null;

// 动态加载 JSZip 库到用户脚本沙箱
export async function ensureJSZipLoaded() {
    if (window.JSZip) {
        return;
    }
    const jsZipUrl = USE_DOMESTIC_CDN
        ? "https://cdn.jsdmirror.com/npm/jszip@3.1.5/dist/jszip.min.js"
        : "https://cdn.jsdelivr.net/npm/jszip@3.1.5/dist/jszip.min.js";
    let code;
    try {
        code = await gmFetchText(jsZipUrl);
        if (!code || code.length === 0) {
            throw new Error(`JSZip 代码加载失败：代码为空 (URL: ${jsZipUrl})`);
        }
    } catch (fetchError) {
        throw new Error(`JSZip 代码加载失败：${fetchError?.message || "未知错误"} (URL: ${jsZipUrl})`);
    }

    try {
        eval(code);
    } catch (evalError) {
        throw new Error(`JSZip 代码执行失败：${evalError?.message || "未知错误"}`);
    }

    if (!window.JSZip) {
        throw new Error("JSZip 加载失败：eval 后 window.JSZip 不存在");
    }
}

export async function ensureFflateLoaded() {
    if (window.fflate) return;
    const fflateUrl = USE_DOMESTIC_CDN
        ? "https://cdn.jsdmirror.com/npm/fflate@0.8.2/umd/index.min.js"
        : "https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.min.js";
    const code = await gmFetchText(fflateUrl);
    eval(code);
    if (!window.fflate) throw new Error("fflate 加载失败");
}

export async function ensureGifLibLoaded() {
    if (!window.GIF) {
        const gifJsUrl = USE_DOMESTIC_CDN
            ? "https://cdn.jsdmirror.com/npm/gif.js@0.2.0/dist/gif.min.js"
            : "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.min.js";
        const code = await gmFetchText(gifJsUrl);
        eval(code);
    }
    if (!__gifWorkerURL) {
        const gifWorkerUrl = USE_DOMESTIC_CDN
            ? "https://cdn.jsdmirror.com/npm/gif.js@0.2.0/dist/gif.worker.js"
            : "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js";
        const workerCode = await gmFetchText(gifWorkerUrl);
        __gifWorkerURL = URL.createObjectURL(new Blob([workerCode], { type: "text/javascript" }));
    }
    if (!window.GIF || !__gifWorkerURL) throw new Error("gif.js 加载失败");
}

export function getGifWorkerURL() {
    return __gifWorkerURL;
}
