"use strict";

import { decodeImageFromU8, downloadUgoiraZip, getUgoiraMeta } from "./meta.js";
import { ensureFflateLoaded, ensureGifLibLoaded, getGifWorkerURL } from "./lib-loader.js";

export async function blobToDataURL(blob) {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// 将动图转换为 GIF Blob
export async function convertUgoiraToGifBlob(artworkId, { onFrameProgress, signal } = {}) {
    await ensureFflateLoaded();
    await ensureGifLibLoaded();

    const meta = await getUgoiraMeta(artworkId);
    const zipBuf = await downloadUgoiraZip(meta.originalSrc);
    const entries = window.fflate.unzipSync(new Uint8Array(zipBuf));

    if (!entries || !meta.frames || meta.frames.length === 0) {
        throw new Error("动图数据不完整");
    }

    const frameTotal = meta.frames.length;

    function checkAborted() {
        if (signal?.aborted) {
            const err = new Error("保存已取消");
            err.name = "AbortError";
            throw err;
        }
    }

    function reportFrame(index) {
        onFrameProgress?.({ current: index + 1, total: frameTotal });
    }

    const guessMime = (name) => (name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");

    const first = meta.frames[0];
    const firstBytes = entries[first.file];
    if (!firstBytes) throw new Error("压缩包中缺少帧文件: " + first.file);
    const firstImg = await decodeImageFromU8(firstBytes, guessMime(first.file));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = firstImg.width;
    canvas.height = firstImg.height;

    const gif = new window.GIF({
        workers: 2,
        quality: 10,
        width: canvas.width,
        height: canvas.height,
        workerScript: getGifWorkerURL(),
    });

    checkAborted();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(firstImg, 0, 0);
    gif.addFrame(ctx, { copy: true, delay: Math.max(20, first.delay || 100) });
    reportFrame(0);

    for (let i = 1; i < meta.frames.length; i++) {
        checkAborted();
        const f = meta.frames[i];
        const bytes = entries[f.file];
        if (!bytes) throw new Error("压缩包中缺少帧文件: " + f.file);
        const img = await decodeImageFromU8(bytes, guessMime(f.file));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        gif.addFrame(ctx, { copy: true, delay: Math.max(20, f.delay || 100) });
        reportFrame(i);
    }

    checkAborted();
    const blob = await new Promise((resolve) => {
        gif.on("finished", (b) => resolve(b));
        gif.render();
    });
    return blob;
}
