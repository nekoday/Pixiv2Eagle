"use strict";

import { exportSettingsBlob, importSettingsBlob } from "../../../tampermonkey/settings-api.js";
import { showToast } from "../../toast.js";
import { pushAction } from "../action-log.js";
import { createPixivStyledButton } from "../../button.js";

export function mountConfigBackupSection(container) {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "配置备份";
    fieldset.appendChild(legend);

    const exportTitle = document.createElement("div");
    exportTitle.className = "p2e-control-panel__section-title";
    exportTitle.textContent = "导出配置";
    fieldset.appendChild(exportTitle);

    const exportTextarea = document.createElement("textarea");
    exportTextarea.className = "p2e-control-panel__textarea";
    exportTextarea.rows = 4;
    exportTextarea.readOnly = true;
    exportTextarea.placeholder = "点击「生成配置」后显示备份文本";
    fieldset.appendChild(exportTextarea);

    const exportActions = document.createElement("div");
    exportActions.className = "p2e-control-panel__backup-actions";

    const generateBtn = createPixivStyledButton("生成配置", "primary");
    generateBtn.type = "button";
    const copyBtn = createPixivStyledButton("复制");
    copyBtn.type = "button";
    exportActions.appendChild(generateBtn);
    exportActions.appendChild(copyBtn);
    fieldset.appendChild(exportActions);

    const importTitle = document.createElement("div");
    importTitle.className = "p2e-control-panel__section-title";
    importTitle.textContent = "导入配置";
    fieldset.appendChild(importTitle);

    const importTextarea = document.createElement("textarea");
    importTextarea.className = "p2e-control-panel__textarea";
    importTextarea.rows = 4;
    importTextarea.placeholder = "粘贴配置文本";
    fieldset.appendChild(importTextarea);

    const importActions = document.createElement("div");
    importActions.className = "p2e-control-panel__backup-actions";
    const importBtn = createPixivStyledButton("导入配置", "primary");
    importBtn.type = "button";
    importActions.appendChild(importBtn);
    fieldset.appendChild(importActions);

    generateBtn.addEventListener("click", () => {
        try {
            const blob = exportSettingsBlob();
            exportTextarea.value = blob;
            showToast("配置已生成", "success");
            pushAction({ label: "导出配置", status: "success" });
        } catch (e) {
            const msg = e && e.message ? e.message : String(e);
            showToast(msg, "error");
            pushAction({ label: "导出配置", status: "error", message: msg });
        }
    });

    copyBtn.addEventListener("click", async () => {
        const text = exportTextarea.value.trim();
        if (!text) {
            showToast("请先生成配置", "warning");
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            showToast("已复制到剪贴板", "success");
        } catch {
            showToast("复制失败", "error");
        }
    });

    importBtn.addEventListener("click", () => {
        const blob = importTextarea.value;
        const result = importSettingsBlob(blob);

        if (!result.ok) {
            showToast(result.error, "error");
            pushAction({ label: "导入配置", status: "error", message: result.error });
            return;
        }

        if (result.versionWarning) {
            showToast(result.versionWarning, "warning");
        }

        if (result.imported.length > 0) {
            showToast(`已导入 ${result.imported.length} 项设置`, "success");
        } else if (result.skipped.length > 0) {
            showToast("没有可导入的有效项", "warning");
        }

        if (result.skipped.length > 0) {
            showToast(`${result.skipped.length} 项校验失败已跳过`, "warning");
        }

        if (result.skipped.length > 0) {
            pushAction({ label: "导入配置", status: "success", message: "部分项已跳过" });
        } else if (result.imported.length > 0) {
            pushAction({ label: "导入配置", status: "success" });
        }
    });

    container.appendChild(fieldset);

    return {
        render() {
            // blob 为一次性操作，无需绑定 snapshot
        },
    };
}
