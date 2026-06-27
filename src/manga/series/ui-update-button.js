"use strict";

import { createPixivStyledButton } from "../../ui/button.js";
import { waitForElement } from "../../ui/dom.js";
import { MANGA_SERIES_HEADER_SELECTOR } from "../../config/selectors/index.js";
import { updateSeriesChapters } from "./update-chapters.js";

export async function addUpdateSeriesButton() {
    if (!location.pathname.includes("/series/")) return;

    const firstStoryBtn = await waitForElement(".gtm-manga-series-first-story", 5000);
    if (!firstStoryBtn) {
        const header = await waitForElement(MANGA_SERIES_HEADER_SELECTOR);
        if (!header) return;
        if (document.getElementById("eagle-update-series-btn")) return;

        const btn = createPixivStyledButton("更新系列序号");
        btn.id = "eagle-update-series-btn";
        btn.style.marginLeft = "10px";
        btn.onclick = updateSeriesChapters;
        header.appendChild(btn);
        return;
    }

    const container = firstStoryBtn.parentElement;
    if (!container) return;

    if (document.getElementById("eagle-update-series-btn")) return;

    const btn = createPixivStyledButton("更新系列漫画的序号");
    btn.id = "eagle-update-series-btn";
    btn.style.backgroundColor = "#0096fa";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.fontWeight = "bold";
    btn.style.marginLeft = "16px";
    btn.style.height = "32px";
    btn.style.padding = "0 16px";

    btn.onmouseenter = () => {
        btn.style.backgroundColor = "#0075c5";
    };
    btn.onmouseleave = () => {
        btn.style.backgroundColor = "#0096fa";
        btn.style.color = "#fff";
    };
    btn.onmousedown = () => {
        btn.style.backgroundColor = "#005c9c";
    };
    btn.onmouseup = () => {
        btn.style.backgroundColor = "#0075c5";
    };

    btn.onclick = updateSeriesChapters;

    container.insertBefore(btn, firstStoryBtn.nextSibling);

    const computedStyle = window.getComputedStyle(container);
    if (computedStyle.display !== "flex") {
        container.style.display = "flex";
        container.style.alignItems = "center";
    }
    container.style.width = "100%";
}
