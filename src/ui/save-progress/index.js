"use strict";

import { SAVE_STAGE } from "./types.js";
import { calcMainPercent, calcFramePercent, calcLocalPercent } from "./progress-calc.js";
import { createSaveProgressToastView } from "./toast-view.js";

/** @type {Map<string, { aborted: boolean, view: ReturnType<typeof createSaveProgressToastView> }>} */
const tasks = new Map();

/**
 * @param {{ artworkId: string, title: string, pageCount: number }} params
 */
export function createSaveProgressTask({ artworkId, title, pageCount }) {
    const taskId = `${artworkId}-${Date.now()}`;
    const controller = new AbortController();
    let isUgoira = false;
    let currentStage = SAVE_STAGE.FETCHING;
    let pageCurrent = 0;
    let pageTotal = Math.max(1, pageCount);
    let submitCurrent = 0;
    let submitTotal = 0;
    let eagleCurrent = 0;
    let eagleTotal = 0;

    const state = { aborted: false };
    const view = createSaveProgressToastView(() => task.abort());
    view.updateArtworkInfo(artworkId, title);
    tasks.set(taskId, { ...state, view });

    function refreshUploading() {
        view.setProgressState({
            stage: SAVE_STAGE.UPLOADING,
            submitCurrent,
            submitTotal,
            submitPercent: calcLocalPercent(submitCurrent, submitTotal),
            eagleCurrent,
            eagleTotal,
            eaglePercent: calcLocalPercent(eagleCurrent, eagleTotal),
        });
    }

    function refreshStage(extra = {}) {
        const mainPercent = calcMainPercent(isUgoira, currentStage, {
            current: extra.current ?? pageCurrent,
            total: extra.total ?? pageTotal,
        });
        view.setProgressState({
            stage: currentStage,
            pageCurrent: extra.pageCurrent ?? pageCurrent,
            pageTotal: extra.pageTotal ?? pageTotal,
            mainPercent,
            frameCurrent: extra.frameCurrent ?? 0,
            frameTotal: extra.frameTotal ?? 0,
            framePercent: extra.framePercent ?? 0,
        });
    }

    function refreshProgress(extra = {}) {
        if (currentStage === SAVE_STAGE.UPLOADING) {
            refreshUploading();
        } else {
            refreshStage(extra);
        }
    }

    const task = {
        signal: controller.signal,

        reportStage(stage, { current, total, message } = {}) {
            if (state.aborted) return;
            currentStage = stage;
            if (stage === SAVE_STAGE.CONVERTING) isUgoira = true;
            if (stage === SAVE_STAGE.UPLOADING) {
                if (total !== undefined) {
                    submitTotal = total;
                    eagleTotal = total;
                    submitCurrent = current ?? 0;
                    eagleCurrent = 0;
                }
                refreshUploading();
                void message;
                return;
            }
            if (current !== undefined && total !== undefined && stage !== SAVE_STAGE.CONVERTING) {
                pageCurrent = current;
                pageTotal = total;
            }
            refreshStage({ current, total });
            void message;
        },

        reportFrameProgress({ current, total }) {
            if (state.aborted) return;
            refreshStage({
                current,
                total,
                frameCurrent: current,
                frameTotal: total,
                framePercent: calcFramePercent({ current, total }),
            });
        },

        reportSubmitProgress({ current, total }) {
            if (state.aborted || currentStage !== SAVE_STAGE.UPLOADING) return;
            submitCurrent = current;
            submitTotal = total;
            refreshUploading();
        },

        reportEagleProgress({ current, total }) {
            if (state.aborted || currentStage !== SAVE_STAGE.UPLOADING) return;
            eagleCurrent = current;
            eagleTotal = total;
            refreshUploading();
        },

        updateArtworkInfo({ title: t, pageCount: pc }) {
            if (state.aborted) return;
            pageTotal = Math.max(1, pc);
            view.updateArtworkInfo(artworkId, t);
            refreshProgress();
        },

        complete({ folderId, itemId, pageCount, openSavedArtwork } = {}) {
            if (state.aborted) return;
            tasks.delete(taskId);
            view.setSuccess({
                folderId,
                itemId,
                artworkId,
                pageCount,
                openSavedArtwork,
            });
        },

        fail(message) {
            if (state.aborted) return;
            state.aborted = true;
            tasks.delete(taskId);
            view.setError(message);
        },

        abort() {
            if (state.aborted) return;
            state.aborted = true;
            controller.abort();
            tasks.delete(taskId);
            view.setCancelled();
        },
    };

    refreshStage({ current: 0, total: 1, pageCurrent: 0, pageTotal });
    return task;
}

/**
 * 批量保存聚合任务：单一 toast，内部切换当前作品 + 双轨条。
 * @param {{ totalWorks: number, initialTitle?: string, initialArtworkId?: string, headerText?: string }} params
 */
export function createBatchSaveProgressTask({ totalWorks, initialTitle = "加载中…", initialArtworkId = "", headerText = "批量保存中" }) {
    const taskId = `batch-${Date.now()}`;
    const controller = new AbortController();
    let submitCurrent = 0;
    let submitTotal = 0;
    let eagleCurrent = 0;
    let eagleTotal = 0;

    const state = { aborted: false };
    const view = createSaveProgressToastView(() => task.abort());
    view.setHeaderText(headerText);
    view.setWorkIndex(0, totalWorks);
    view.updateArtworkInfo(initialArtworkId, initialTitle);
    tasks.set(taskId, { ...state, view });

    function refreshUploading() {
        view.setProgressState({
            stage: SAVE_STAGE.UPLOADING,
            submitCurrent,
            submitTotal,
            submitPercent: calcLocalPercent(submitCurrent, submitTotal),
            eagleCurrent,
            eagleTotal,
            eaglePercent: calcLocalPercent(eagleCurrent, eagleTotal),
        });
    }

    const task = {
        signal: controller.signal,

        reportWorkIndex({ current, total }) {
            if (state.aborted) return;
            view.setWorkIndex(current, total);
        },

        beginWork({ artworkId, title, pageCount }) {
            if (state.aborted) return;
            submitCurrent = 0;
            submitTotal = Math.max(1, pageCount);
            eagleCurrent = 0;
            eagleTotal = Math.max(1, pageCount);
            view.updateArtworkInfo(artworkId, title);
            refreshUploading();
        },

        reportSubmitProgress({ current, total }) {
            if (state.aborted) return;
            submitCurrent = current;
            submitTotal = total;
            refreshUploading();
        },

        reportEagleProgress({ current, total }) {
            if (state.aborted) return;
            eagleCurrent = current;
            eagleTotal = total;
            refreshUploading();
        },

        complete({ folderId, itemId } = {}) {
            if (state.aborted) return;
            tasks.delete(taskId);
            view.setSuccess({ folderId, itemId });
        },

        fail(message) {
            if (state.aborted) return;
            state.aborted = true;
            tasks.delete(taskId);
            view.setError(message);
        },

        abort() {
            if (state.aborted) return;
            state.aborted = true;
            controller.abort();
            tasks.delete(taskId);
            view.setCancelled();
        },
    };

    return task;
}
