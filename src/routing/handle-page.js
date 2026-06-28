"use strict";

import {
    PAGE_OBSERVER_TIMEOUT_MS,
    PAGE_RETRY_INTERVAL_MS,
    PAGE_RETRY_MAX_COUNT,
} from "../config/constants.js";

// 模块级：记录每个 monitorInfo 当前活跃的观察器，防止重复注入堆积
const activePageObservers = new WeakMap();

// 处理页面变化
export function handlePageChange(monitorInfo) {
    // 若该 monitor 已有活跃观察器，先清理（防止 SPA 连续导航时观察器堆积）
    const existing = activePageObservers.get(monitorInfo);
    if (existing) {
        existing.observer.disconnect();
        clearInterval(existing.intervalId);
    }

    // 立即尝试执行处理函数（添加页面元素）
    monitorInfo.handler();

    // observeID 为 null 的 monitor 仅执行一次 handler + 有限次退避重试，不建观察器
    if (monitorInfo.observeID === null) {
        let retryCount = 0;
        const retry = () => {
            if (retryCount >= PAGE_RETRY_MAX_COUNT) return;
            retryCount++;
            monitorInfo.handler();
            setTimeout(retry, PAGE_RETRY_INTERVAL_MS);
        };
        setTimeout(retry, PAGE_RETRY_INTERVAL_MS);
        return;
    }

    // 设置一个观察器来监视 DOM 变化
    let intervalId;
    const observer = new MutationObserver((mutations, obs) => {
        // 检查是否存在指定 ID 的元素，若不存在则添加
        const button = document.getElementById(monitorInfo.observeID);
        if (!button) {
            monitorInfo.handler();
        } else {
            // 按钮已存在：立即清理观察器与计时器，无需等超时
            obs.disconnect();
            clearInterval(intervalId);
            activePageObservers.delete(monitorInfo);
        }
    });

    // 配置观察器
    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    // 同时设置一个间隔检查
    let checkCount = 0;
    intervalId = setInterval(() => {
        const button = document.getElementById(monitorInfo.observeID);
        if (!button) {
            monitorInfo.handler();
        } else {
            clearInterval(intervalId);
            observer.disconnect();
            activePageObservers.delete(monitorInfo);
            return;
        }

        checkCount++;
        if (checkCount >= PAGE_RETRY_MAX_COUNT) {
            // PAGE_RETRY_INTERVAL_MS * PAGE_RETRY_MAX_COUNT 后停止检查
            clearInterval(intervalId);
            observer.disconnect();
            activePageObservers.delete(monitorInfo);
        }
    }, PAGE_RETRY_INTERVAL_MS);

    // 记录活跃观察器，供下次重入清理
    activePageObservers.set(monitorInfo, { observer, intervalId });

    // PAGE_OBSERVER_TIMEOUT_MS 后停止观察（兜底，避免无限观察）
    setTimeout(() => {
        observer.disconnect();
        clearInterval(intervalId);
        activePageObservers.delete(monitorInfo);
    }, PAGE_OBSERVER_TIMEOUT_MS);
}
