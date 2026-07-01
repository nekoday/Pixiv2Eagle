"use strict";

import { set } from "../../../tampermonkey/settings-api.js";
import { showToast } from "../../toast.js";
import { pushAction } from "../action-log.js";
import { createPixivStyledButton } from "../../button.js";

const FORMATS = [
    { value: "txt", label: "TXT" },
    { value: "md", label: "MD" },
    { value: "epub", label: "EPUB" },
];

export function mountNovelSection(container) {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "小说";
    fieldset.appendChild(legend);

    const pathInput = document.createElement("input");
    pathInput.type = "text";
    pathInput.placeholder = "保存路径（留空则运行时提示）";
    const applyPath = createPixivStyledButton("应用", "primary");
    applyPath.type = "button";
    const pathRow = document.createElement("div");
    pathRow.className = "p2e-control-panel__input-row";
    pathRow.appendChild(pathInput);
    pathRow.appendChild(applyPath);
    fieldset.appendChild(pathRow);

    applyPath.addEventListener("click", () => {
        const result = set("novelSavePath", pathInput.value);
        if (!result.ok) {
            showInlineError(pathRow, result.error);
            pushAction({ label: "设置小说路径", status: "error", message: result.error });
            return;
        }
        showInlineError(pathRow, "");
        showToast("小说保存路径已更新", "success");
        pushAction({ label: "设置小说路径", status: "success" });
    });

    const formatRow = document.createElement("div");
    formatRow.className = "p2e-segmented";
    const formatButtons = {};
    for (const fmt of FORMATS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "p2e-segmented__btn";
        btn.textContent = fmt.label;
        btn.dataset.value = fmt.value;
        btn.addEventListener("click", () => {
            const result = set("novelSaveFormat", fmt.value);
            if (result.ok) {
                showToast(`小说格式：${fmt.label}`, "info");
            }
        });
        formatRow.appendChild(btn);
        formatButtons[fmt.value] = btn;
    }
    fieldset.appendChild(formatRow);

    container.appendChild(fieldset);

    return {
        render(snapshot) {
            pathInput.value = snapshot.settings.novelSavePath;
            for (const fmt of FORMATS) {
                formatButtons[fmt.value].classList.toggle(
                    "p2e-segmented__btn--active",
                    snapshot.settings.novelSaveFormat === fmt.value
                );
            }
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
