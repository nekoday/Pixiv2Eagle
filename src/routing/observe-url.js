"use strict";

import { handlePageChange } from "./handle-page.js";

// 监听 URL 变化
export function observeUrlChanges(monitorConfig) {
    const handler = () => {
        for (const monitorInfo of monitorConfig) {
            if (location.pathname.includes(monitorInfo.urlSuffix)) {
                handlePageChange(monitorInfo);
            }
        }
    };

    // 监听 popstate 事件（后退/前进按钮触发）
    // 用 once 守卫避免脚本被同页面重复注入时叠加监听
    if (!window.__pixiv2eagle_popstateBound) {
        window.addEventListener("popstate", () => {
            handler();
        });
        window.__pixiv2eagle_popstateBound = true;
    }

    // 重写 history.pushState（带重注册守卫）
    if (!history.pushState.__pixiv2eagle_wrapped) {
        const originalPushState = history.pushState;
        const wrappedPushState = function () {
            originalPushState.apply(this, arguments);
            handler();
        };
        wrappedPushState.__pixiv2eagle_wrapped = true;
        history.pushState = wrappedPushState;
    }

    // 重写 history.replaceState（带重注册守卫）
    if (!history.replaceState.__pixiv2eagle_wrapped) {
        const originalReplaceState = history.replaceState;
        const wrappedReplaceState = function () {
            originalReplaceState.apply(this, arguments);
            handler();
        };
        wrappedReplaceState.__pixiv2eagle_wrapped = true;
        history.replaceState = wrappedReplaceState;
    }
}
