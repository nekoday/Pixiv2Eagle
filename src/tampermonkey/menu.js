"use strict";

import { openControlPanel } from "../ui/control-panel/index.js";
import { refreshEagleIndexFromPanel, set, getSnapshot } from "./settings-api.js";
import { pushAction } from "../ui/control-panel/action-log.js";
import { showToast } from "../ui/toast.js";

async function handleForceRefreshEagleIndex() {
    pushAction({ label: "强制更新索引", status: "pending" });
    const result = await refreshEagleIndexFromPanel();
    if (result.ok) {
        pushAction({ label: "强制更新索引", status: "success" });
        showToast("Eagle 索引已强制更新完成", "success");
    } else {
        pushAction({ label: "强制更新索引", status: "error", message: result.error });
        showToast(`强制更新索引失败: ${result.error}`, "error");
    }
}

function toggleDebugMode() {
    const current = getSnapshot().settings.debugMode;
    const next = !current;
    set("debugMode", next);
    const stateText = next ? "开启 ✅" : "关闭 ❌";
    pushAction({ label: "调试模式", status: "success", message: stateText });
    showToast(`调试模式已${next ? "开启" : "关闭"}`, "info");
}

export function registerMenuCommands() {
    GM_registerMenuCommand("⚙️ 打开控制面板", openControlPanel);
    GM_registerMenuCommand("🔄 强制更新 Eagle 索引", handleForceRefreshEagleIndex);
    GM_registerMenuCommand("🧪 切换：调试模式", toggleDebugMode);
}
