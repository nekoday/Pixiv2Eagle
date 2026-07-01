"use strict";

import { SAVE_STAGE } from "./types.js";

// uploading 阶段「全局加权」口径仅作向后兼容保留；实际 UI 主条走 calcLocalPercent（落盘本地比）。
export const UPLOAD_SUBMIT_WEIGHT = 0.4;
export const UPLOAD_EAGLE_WEIGHT = 0.6;

/** @type {Record<"normal"|"ugoira", Record<string, { start: number, length: number }>>} */
const WEIGHTS = {
    normal: {
        [SAVE_STAGE.FETCHING]: { start: 0, length: 5 },
        [SAVE_STAGE.FOLDER]: { start: 5, length: 10 },
        [SAVE_STAGE.UPLOADING]: { start: 15, length: 85 },
        [SAVE_STAGE.DONE]: { start: 100, length: 0 },
    },
    ugoira: {
        [SAVE_STAGE.FETCHING]: { start: 0, length: 5 },
        [SAVE_STAGE.FOLDER]: { start: 5, length: 10 },
        [SAVE_STAGE.CONVERTING]: { start: 15, length: 30 },
        [SAVE_STAGE.UPLOADING]: { start: 45, length: 55 },
        [SAVE_STAGE.DONE]: { start: 100, length: 0 },
    },
};

/**
 * 本地百分比：current / total，钳制 [0,100]，四舍五入。
 * @param {number} current
 * @param {number} total
 * @returns {number}
 */
export function calcLocalPercent(current, total) {
    if (!total || total <= 0) return 0;
    const ratio = Math.min(Math.max(current ?? 0, 0) / total, 1);
    return Math.round(ratio * 100);
}

/**
 * 非 uploading 阶段（fetching / folder / converting）的全局阶段加权主条百分比。
 * uploading 阶段由调用方改用 calcLocalPercent（落盘本地比），不经此函数。
 *
 * @param {boolean} isUgoira
 * @param {import("./types.js").SaveProgressStage} stage
 * @param {{ current?: number, total?: number }} [step]
 * @returns {number}
 */
export function calcMainPercent(isUgoira, stage, step) {
    const weights = isUgoira ? WEIGHTS.ugoira : WEIGHTS.normal;
    const weight = weights[stage];
    if (!weight) {
        return 0;
    }
    if (stage === SAVE_STAGE.DONE) {
        return 100;
    }
    const { start, length } = weight;
    if (!step?.total || step.total <= 0) {
        return start;
    }
    const ratio = Math.min(Math.max(step.current ?? 0, 0) / step.total, 1);
    return Math.round(start + ratio * length);
}

/**
 * @param {{ current?: number, total?: number }} [step]
 * @returns {number}
 */
export function calcFramePercent(step) {
    if (!step?.total || step.total <= 0) {
        return 0;
    }
    const ratio = Math.min(Math.max(step.current ?? 0, 0) / step.total, 1);
    return Math.round(ratio * 100);
}
