"use strict";

import { set } from "../../../tampermonkey/settings-api.js";
import { showToast } from "../../toast.js";
import { pushAction } from "../action-log.js";
import { createPixivStyledButton } from "../../button.js";

export function mountEagleFolderSection(container) {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "Eagle 与文件夹";
    fieldset.appendChild(legend);

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "文件夹 ID 或 Eagle 链接";
    const applyBtn = createPixivStyledButton("应用", "primary");
    applyBtn.type = "button";

    const row = document.createElement("div");
    row.className = "p2e-control-panel__input-row";
    row.appendChild(input);
    row.appendChild(applyBtn);
    fieldset.appendChild(row);

    function apply() {
        const result = set("pixivFolderId", input.value);
        if (!result.ok) {
            showInlineError(row, result.error);
            pushAction({ label: "设置 Pixiv 文件夹", status: "error", message: result.error });
            return;
        }
        showInlineError(row, "");
        const msg = input.value.trim() === "" ? "已清空文件夹 ID" : "文件夹 ID 已更新";
        showToast(msg, "success");
        pushAction({ label: "设置 Pixiv 文件夹", status: "success" });
    }

    applyBtn.addEventListener("click", apply);

    container.appendChild(fieldset);

    return {
        render(snapshot) {
            input.value = snapshot.settings.pixivFolderId;
        },
    };
}

function showInlineError(el, message) {
    let errEl = el.parentElement.querySelector(".p2e-inline-error");
    if (!message) {
        if (errEl) errEl.remove();
        return;
    }
    if (!errEl) {
        errEl = document.createElement("div");
        errEl.className = "p2e-inline-error";
        el.parentElement.appendChild(errEl);
    }
    errEl.textContent = message;
}
