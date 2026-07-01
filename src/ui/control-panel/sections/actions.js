"use strict";

import { refreshEagleIndexFromPanel } from "../../../tampermonkey/settings-api.js";
import { saveCurrentArtwork } from "../../../artwork/save.js";
import { getArtworkId } from "../../../artwork/id.js";
import { showToast } from "../../toast.js";
import { pushAction } from "../action-log.js";
import { createPixivStyledButton } from "../../button.js";

export function mountActionsSection(container) {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "快捷操作";
    fieldset.appendChild(legend);

    const saveBtn = createPixivStyledButton("保存当前作品", "primary");
    saveBtn.type = "button";
    const refreshBtn = createPixivStyledButton("强制更新索引");
    refreshBtn.type = "button";

    const hint = document.createElement("div");
    hint.className = "p2e-inline-error";
    hint.style.visibility = "hidden";

    const stack = document.createElement("div");
    stack.className = "p2e-control-panel__action-stack";
    stack.appendChild(saveBtn);
    stack.appendChild(refreshBtn);
    fieldset.appendChild(stack);
    fieldset.appendChild(hint);

    saveBtn.addEventListener("click", async () => {
        pushAction({ label: "保存当前作品", status: "pending" });
        try {
            await saveCurrentArtwork();
            pushAction({ label: "保存当前作品", status: "success" });
        } catch (e) {
            const msg = e && e.message ? e.message : String(e);
            pushAction({ label: "保存当前作品", status: "error", message: msg });
            showToast(msg, "error");
        }
    });

    refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = "更新中…";
        pushAction({ label: "强制更新索引", status: "pending" });
        const result = await refreshEagleIndexFromPanel();
        refreshBtn.disabled = false;
        refreshBtn.textContent = "强制更新索引";
        if (result.ok) {
            pushAction({ label: "强制更新索引", status: "success" });
            showToast("Eagle 索引已强制更新完成", "success");
        } else {
            pushAction({ label: "强制更新索引", status: "error", message: result.error });
            showToast(`强制更新索引失败: ${result.error}`, "error");
        }
    });

    container.appendChild(fieldset);

    return {
        render() {
            const onArtworkPage = !!getArtworkId();
            saveBtn.style.opacity = onArtworkPage ? "1" : "0.5";
            saveBtn.disabled = !onArtworkPage;
            hint.style.visibility = onArtworkPage ? "hidden" : "visible";
            hint.textContent = onArtworkPage ? "" : "当前页面不是作品详情页";
        },
    };
}
