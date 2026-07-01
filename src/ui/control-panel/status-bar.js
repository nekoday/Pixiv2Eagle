"use strict";

import { set } from "../../tampermonkey/settings-api.js";
import { showToast } from "../toast.js";

/**
 * @param {HTMLElement} container
 * @param {{ onRefreshEagle: () => Promise<void> }} options
 * @returns {{ render: (snapshot: import("../../tampermonkey/settings-api.js").getSnapshot extends () => infer R ? R : never) => void, destroy: () => void }}
 */
export function createStatusBar(container, { onRefreshEagle }) {
    const root = document.createElement("div");
    root.className = "p2e-status-bar";
    container.appendChild(root);

    let refreshTimer = null;

    function formatExpire(ts) {
        if (!ts) return "—";
        if (Date.now() >= ts) return "已过期";
        return new Date(ts).toLocaleString();
    }

    function render(snapshot) {
        root.textContent = "";
        const rows = [
            ["Eagle", snapshot.eagle.connected
                ? `已连接 v${snapshot.eagle.version}`
                : "未连接"],
            ["Pixiv 文件夹", snapshot.settings.pixivFolderId || "未设置"],
            ["索引", snapshot.eagle.indexState],
            ["画师数", String(snapshot.eagle.indexArtistCount)],
            ["缓存", snapshot.eagle.indexCacheValid ? "有效" : "无效 / 已过期"],
            ["缓存过期", formatExpire(snapshot.eagle.indexExpiresAt)],
        ];

        for (const [label, value] of rows) {
            const labelEl = document.createElement("div");
            labelEl.className = "p2e-status-bar__label";
            labelEl.textContent = label;
            const valueEl = document.createElement("div");
            valueEl.className = "p2e-status-bar__value";
            if (label === "Eagle" && !snapshot.eagle.connected) {
                valueEl.classList.add("p2e-status-bar__value--error");
            }
            valueEl.textContent = value;
            root.appendChild(labelEl);
            root.appendChild(valueEl);
        }

        const debugRow = document.createElement("div");
        debugRow.className = "p2e-control-panel__row";
        debugRow.style.gridColumn = "1 / -1";
        const debugLabel = document.createElement("span");
        debugLabel.textContent = "调试模式";
        const toggleLabel = document.createElement("label");
        toggleLabel.className = "p2e-toggle";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "p2e-toggle__input";
        input.checked = snapshot.settings.debugMode;
        input.addEventListener("change", () => {
            const result = set("debugMode", input.checked);
            if (result.ok) {
                showToast(
                    input.checked ? "调试模式已开启" : "调试模式已关闭",
                    "info"
                );
            }
        });
        toggleLabel.appendChild(input);
        debugRow.appendChild(debugLabel);
        debugRow.appendChild(toggleLabel);
        root.appendChild(debugRow);
    }

    async function startRefresh() {
        await onRefreshEagle();
        refreshTimer = window.setInterval(() => {
            onRefreshEagle();
        }, 30000);
    }

    startRefresh();

    return {
        render,
        destroy() {
            if (refreshTimer) clearInterval(refreshTimer);
        },
    };
}
