"use strict";

import { set } from "../../../tampermonkey/settings-api.js";
import { showToast } from "../../toast.js";

const THEMES = [
    { value: "light", label: "浅色" },
    { value: "dark", label: "深色" },
    { value: "system", label: "跟随系统" },
];

export function mountAppearanceSection(container) {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "外观";
    fieldset.appendChild(legend);

    const row = document.createElement("div");
    row.className = "p2e-segmented";
    const buttons = {};
    for (const theme of THEMES) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "p2e-segmented__btn";
        btn.textContent = theme.label;
        btn.addEventListener("click", () => {
            const result = set("uiTheme", theme.value);
            if (result.ok) {
                const label = THEMES.find((t) => t.value === theme.value).label;
                showToast(`界面主题：${label}`, "info");
            }
        });
        row.appendChild(btn);
        buttons[theme.value] = btn;
    }
    fieldset.appendChild(row);
    container.appendChild(fieldset);

    return {
        render(snapshot) {
            for (const theme of THEMES) {
                buttons[theme.value].classList.toggle(
                    "p2e-segmented__btn--active",
                    snapshot.settings.uiTheme === theme.value
                );
            }
        },
    };
}
