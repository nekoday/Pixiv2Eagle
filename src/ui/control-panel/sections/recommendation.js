"use strict";

import { set } from "../../../tampermonkey/settings-api.js";
import { showToast } from "../../toast.js";

const MODE_LABELS = {
    remove: "完全隐藏",
    blur: "模糊（悬停查看）",
};

const SAVED_MODE_LABELS = {
    mark: "标记",
    blur: "模糊（悬停查看）",
    hide: "完全隐藏",
};

const HELP_TEXTS = {
    filterRecSameAuthor:
        "在作品详情页「相关作品」区隐藏与当前画师相同的推荐项；不影响侧栏「其他作品」。",
    filterRecSameAuthorMode:
        "完全隐藏：同作者条目不占位；模糊：条目可见但遮罩模糊，鼠标悬停临时查看。",
    filterRecSavedMode:
        "仅作用于「相关作品」区。标记：已保存显示 ✅；模糊：已保存条目遮罩且仍显示 ✅，悬停查看；隐藏：已保存条目不占位且无 ✅。功能始终开启，无法关闭。",
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

export function mountRecommendationSection(container) {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "推荐区";
    fieldset.appendChild(legend);

    const filterRow = document.createElement("div");
    filterRow.className = "p2e-control-panel__row";
    const filterLabelWrap = document.createElement("span");
    filterLabelWrap.className = "p2e-control-panel__label-with-help";
    filterLabelWrap.appendChild(document.createTextNode("过滤同作者推荐"));
    appendHelpTrigger(filterLabelWrap, HELP_TEXTS.filterRecSameAuthor);
    filterRow.appendChild(filterLabelWrap);

    const filterToggleLabel = document.createElement("label");
    filterToggleLabel.className = "p2e-toggle";
    const filterInput = document.createElement("input");
    filterInput.type = "checkbox";
    filterInput.className = "p2e-toggle__input";
    filterInput.addEventListener("change", () => {
        const result = set("filterRecSameAuthor", filterInput.checked);
        if (result.ok) {
            showToast(
                filterInput.checked ? "已开启：过滤同作者推荐" : "已关闭：过滤同作者推荐",
                "info"
            );
        }
    });
    filterToggleLabel.appendChild(filterInput);
    filterRow.appendChild(filterToggleLabel);
    fieldset.appendChild(filterRow);

    const modeRow = document.createElement("div");
    modeRow.className = "p2e-control-panel__row";
    const modeLabelWrap = document.createElement("span");
    modeLabelWrap.className = "p2e-control-panel__label-with-help";
    modeLabelWrap.appendChild(document.createTextNode("隐藏方式"));
    appendHelpTrigger(modeLabelWrap, HELP_TEXTS.filterRecSameAuthorMode);
    modeRow.appendChild(modeLabelWrap);

    const modeSelect = document.createElement("select");
    modeSelect.className = "p2e-control-panel__select";
    modeSelect.dataset.setting = "filterRecSameAuthorMode";
    for (const [value, optionLabel] of Object.entries(MODE_LABELS)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = optionLabel;
        modeSelect.appendChild(option);
    }
    modeSelect.addEventListener("change", () => {
        const result = set("filterRecSameAuthorMode", modeSelect.value);
        if (result.ok) {
            const label = MODE_LABELS[modeSelect.value] || modeSelect.value;
            showToast(`隐藏方式：${label}`, "info");
        }
    });
    modeRow.appendChild(modeSelect);
    fieldset.appendChild(modeRow);

    const savedModeRow = document.createElement("div");
    savedModeRow.className = "p2e-control-panel__row";
    const savedModeLabelWrap = document.createElement("span");
    savedModeLabelWrap.className = "p2e-control-panel__label-with-help";
    savedModeLabelWrap.appendChild(document.createTextNode("已保存作品"));
    appendHelpTrigger(savedModeLabelWrap, HELP_TEXTS.filterRecSavedMode);
    savedModeRow.appendChild(savedModeLabelWrap);

    const savedModeSelect = document.createElement("select");
    savedModeSelect.className = "p2e-control-panel__select";
    savedModeSelect.dataset.setting = "filterRecSavedMode";
    for (const [value, optionLabel] of Object.entries(SAVED_MODE_LABELS)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = optionLabel;
        savedModeSelect.appendChild(option);
    }
    savedModeSelect.addEventListener("change", () => {
        const result = set("filterRecSavedMode", savedModeSelect.value);
        if (result.ok) {
            const label = SAVED_MODE_LABELS[savedModeSelect.value] || savedModeSelect.value;
            showToast(`已保存作品：${label}`, "info");
        }
    });
    savedModeRow.appendChild(savedModeSelect);
    fieldset.appendChild(savedModeRow);

    container.appendChild(fieldset);

    return {
        render(snapshot) {
            filterInput.checked = snapshot.settings.filterRecSameAuthor;
            const mode = MODE_LABELS[snapshot.settings.filterRecSameAuthorMode]
                ? snapshot.settings.filterRecSameAuthorMode
                : "remove";
            modeSelect.value = mode;
            modeSelect.disabled = !snapshot.settings.filterRecSameAuthor;
            const savedMode = SAVED_MODE_LABELS[snapshot.settings.filterRecSavedMode]
                ? snapshot.settings.filterRecSavedMode
                : "mark";
            savedModeSelect.value = savedMode;
        },
    };
}
