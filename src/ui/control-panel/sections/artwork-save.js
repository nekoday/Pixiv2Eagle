"use strict";

import { set } from "../../../tampermonkey/settings-api.js";
import { showToast } from "../../toast.js";

const SUBFOLDER_LABELS = {
    off: "关闭",
    "multi-page": "仅多页",
    always: "始终",
};

const TOGGLE_TOAST_LABELS = {
    useUploadDate: "使用投稿时间作为添加日期",
    saveDescription: "保存作品描述",
    saveByType: "按类型保存",
    autoCheckSavedStatus: "自动检测作品保存状态",
};

const HELP_TEXTS = {
    useUploadDate: "保存到 Eagle 时使用 Pixiv 投稿日期，而非保存当天的日期。",
    saveDescription: "将 Pixiv 作品说明写入 Eagle 条目的描述字段。",
    saveByType: "在画师文件夹下按插画、漫画、小说分别建立子文件夹。",
    autoCheckSavedStatus: "打开作品详情页时，自动检查并标记是否已保存到 Eagle。",
    createSubFolder: "控制是否为作品在画师文件夹下创建独立子文件夹；「仅多页」只对多页作品生效。",
};

/**
 * @param {HTMLElement} labelContainer
 * @param {string} text
 */
function appendHelpTrigger(labelContainer, text) {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "p2e-help-trigger";
    trigger.setAttribute("aria-label", "说明");
    trigger.textContent = "?";
    const tooltip = document.createElement("span");
    tooltip.className = "p2e-help-tooltip";
    tooltip.textContent = text;
    trigger.appendChild(tooltip);
    labelContainer.appendChild(trigger);
}

/**
 * @param {string} label
 * @param {keyof TOGGLE_TOAST_LABELS} key
 * @param {string} helpText
 */
function createToggleRow(label, key, helpText) {
    const row = document.createElement("div");
    row.className = "p2e-control-panel__row";
    const labelWrap = document.createElement("span");
    labelWrap.className = "p2e-control-panel__label-with-help";
    labelWrap.appendChild(document.createTextNode(label));
    appendHelpTrigger(labelWrap, helpText);
    const toggleLabel = document.createElement("label");
    toggleLabel.className = "p2e-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "p2e-toggle__input";
    input.addEventListener("change", () => {
        const result = set(key, input.checked);
        if (result.ok) {
            const name = TOGGLE_TOAST_LABELS[key];
            showToast(
                input.checked ? `已开启：${name}` : `已关闭：${name}`,
                "info"
            );
        }
    });
    toggleLabel.appendChild(input);
    row.appendChild(labelWrap);
    row.appendChild(toggleLabel);
    return { row, input };
}

export function mountArtworkSaveSection(container) {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "插画 / 漫画保存";
    fieldset.appendChild(legend);

    const uploadDate = createToggleRow(
        "使用投稿时间作为添加日期",
        "useUploadDate",
        HELP_TEXTS.useUploadDate
    );
    const saveDesc = createToggleRow(
        "保存作品描述",
        "saveDescription",
        HELP_TEXTS.saveDescription
    );
    const saveByType = createToggleRow(
        "按类型保存",
        "saveByType",
        HELP_TEXTS.saveByType
    );
    const autoCheck = createToggleRow(
        "自动检测作品保存状态",
        "autoCheckSavedStatus",
        HELP_TEXTS.autoCheckSavedStatus
    );

    fieldset.appendChild(uploadDate.row);
    fieldset.appendChild(saveDesc.row);
    fieldset.appendChild(saveByType.row);
    fieldset.appendChild(autoCheck.row);

    const subRow = document.createElement("div");
    subRow.className = "p2e-control-panel__row";
    const subLabelWrap = document.createElement("span");
    subLabelWrap.className = "p2e-control-panel__label-with-help";
    subLabelWrap.appendChild(document.createTextNode("多页作品子文件夹"));
    appendHelpTrigger(subLabelWrap, HELP_TEXTS.createSubFolder);
    subRow.appendChild(subLabelWrap);

    const subSelect = document.createElement("select");
    subSelect.className = "p2e-control-panel__select";
    subSelect.dataset.setting = "createSubFolder";
    for (const [value, optionLabel] of Object.entries(SUBFOLDER_LABELS)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = optionLabel;
        subSelect.appendChild(option);
    }
    subSelect.addEventListener("change", () => {
        const result = set("createSubFolder", subSelect.value);
        if (result.ok) {
            const label = SUBFOLDER_LABELS[subSelect.value] || subSelect.value;
            showToast(`子文件夹：${label}`, "info");
        }
    });
    subRow.appendChild(subSelect);
    fieldset.appendChild(subRow);

    container.appendChild(fieldset);

    const inputs = {
        useUploadDate: uploadDate.input,
        saveDescription: saveDesc.input,
        saveByType: saveByType.input,
        autoCheckSavedStatus: autoCheck.input,
    };

    return {
        render(snapshot) {
            inputs.useUploadDate.checked = snapshot.settings.useUploadDate;
            inputs.saveDescription.checked = snapshot.settings.saveDescription;
            inputs.saveByType.checked = snapshot.settings.saveByType;
            inputs.autoCheckSavedStatus.checked = snapshot.settings.autoCheckSavedStatus;
            const mode = SUBFOLDER_LABELS[snapshot.settings.createSubFolder]
                ? snapshot.settings.createSubFolder
                : "off";
            subSelect.value = mode;
        },
    };
}
