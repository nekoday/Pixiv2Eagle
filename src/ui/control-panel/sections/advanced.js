"use strict";

import { set } from "../../../tampermonkey/settings-api.js";
import { showToast } from "../../toast.js";
import { pushAction } from "../action-log.js";
import { createPixivStyledButton } from "../../button.js";

/**
 * @param {HTMLInputElement} input
 * @param {string} text
 */
function insertAtCursor(input, text) {
    const len = input.value.length;
    const start = typeof input.selectionStart === "number" ? input.selectionStart : len;
    const end = typeof input.selectionEnd === "number" ? input.selectionEnd : len;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const pos = start + text.length;
    input.setSelectionRange(pos, pos);
    input.focus();
}

const TEMPLATE_CHIPS = [
    { label: "$uid", literal: "$uid" },
    { label: "$name", literal: "$name" },
    { label: "-", literal: "-" },
    { label: "_", literal: "_" },
];

export function mountAdvancedSection(container) {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "高级";
    fieldset.appendChild(legend);

    const hint = document.createElement("div");
    hint.className = "p2e-control-panel__section-title";
    hint.textContent = "画师文件夹名称模板（$uid / $name）";
    fieldset.appendChild(hint);

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "$name";

    const toolbar = document.createElement("div");
    toolbar.className = "p2e-template-toolbar";
    for (const chip of TEMPLATE_CHIPS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "p2e-template-chip";
        btn.textContent = chip.label;
        btn.addEventListener("click", () => insertAtCursor(input, chip.literal));
        toolbar.appendChild(btn);
    }
    fieldset.appendChild(toolbar);

    const applyBtn = createPixivStyledButton("应用", "primary");
    applyBtn.type = "button";
    const row = document.createElement("div");
    row.className = "p2e-control-panel__input-row";
    row.appendChild(input);
    row.appendChild(applyBtn);
    fieldset.appendChild(row);

    const timeoutTitle = document.createElement("div");
    timeoutTitle.className = "p2e-control-panel__section-title";
    timeoutTitle.textContent = "Eagle 落盘等待超时（秒）";
    fieldset.appendChild(timeoutTitle);

    const timeoutInput = document.createElement("input");
    timeoutInput.type = "number";
    timeoutInput.min = "1";
    timeoutInput.step = "1";
    timeoutInput.placeholder = "120";

    const timeoutApply = createPixivStyledButton("应用", "primary");
    timeoutApply.type = "button";
    const timeoutRow = document.createElement("div");
    timeoutRow.className = "p2e-control-panel__input-row";
    timeoutRow.appendChild(timeoutInput);
    timeoutRow.appendChild(timeoutApply);
    fieldset.appendChild(timeoutRow);

    timeoutApply.addEventListener("click", () => {
        const sec = Number(timeoutInput.value);
        if (!Number.isFinite(sec) || sec <= 0) {
            showInlineError(timeoutRow, "请输入正整数秒数");
            return;
        }
        const result = set("eagleSavePollTimeoutMs", Math.round(sec * 1000));
        if (!result.ok) {
            showInlineError(timeoutRow, result.error);
            pushAction({ label: "设置落盘超时", status: "error", message: result.error });
            return;
        }
        showInlineError(timeoutRow, "");
        showToast(`落盘等待超时已设置为 ${Math.round(sec)} 秒`, "success");
        pushAction({ label: "设置落盘超时", status: "success" });
    });

    applyBtn.addEventListener("click", () => {
        const result = set("folderNameTemplate", input.value);
        if (!result.ok) {
            showInlineError(row, result.error);
            pushAction({ label: "设置画师模板", status: "error", message: result.error });
            return;
        }
        showInlineError(row, "");
        showToast(`模板已设置为 ${input.value.trim()}`, "success");
        pushAction({ label: "设置画师模板", status: "success" });
    });

    container.appendChild(fieldset);

    return {
        render(snapshot) {
            input.value = snapshot.settings.folderNameTemplate;
            timeoutInput.value = String(Math.round(snapshot.settings.eagleSavePollTimeoutMs / 1000));
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
