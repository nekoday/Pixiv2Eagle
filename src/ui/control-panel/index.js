"use strict";

import { getSnapshot, subscribe, refreshEagleState } from "../../tampermonkey/settings-api.js";
import { mountFab } from "./fab.js";
import { createControlPanelModal, isControlPanelOpen, focusControlPanel } from "./modal.js";
import { createStatusBar } from "./status-bar.js";
import { mountActionLog, subscribeActionLog } from "./action-log.js";
import { mountEagleFolderSection } from "./sections/eagle-folder.js";
import { mountArtworkSaveSection } from "./sections/artwork-save.js";
import { mountNovelSection } from "./sections/novel.js";
import { mountRecommendationSection } from "./sections/recommendation.js";
import { mountAppearanceSection } from "./sections/appearance.js";
import { mountAdvancedSection } from "./sections/advanced.js";
import { mountConfigBackupSection } from "./sections/config-backup.js";
import { mountActionsSection } from "./sections/actions.js";

let fabHandle = null;
let modalApi = null;
let sectionRenderers = [];
let statusBar = null;
let panelInitialized = false;

function dispatchSnapshot() {
    const snapshot = getSnapshot();
    if (statusBar) statusBar.render(snapshot);
    for (const render of sectionRenderers) {
        render(snapshot);
    }
}

function openPanel() {
    if (isControlPanelOpen()) {
        focusControlPanel();
        return;
    }

    modalApi = createControlPanelModal({
        title: "Re_Pixiv2Eagle 控制面板",
        onClose: () => {
            modalApi = null;
            if (statusBar) {
                statusBar.destroy();
                statusBar = null;
            }
            sectionRenderers = [];
        },
    });

    const body = modalApi.bodyEl;

    statusBar = createStatusBar(body, { onRefreshEagle: refreshEagleState });
    sectionRenderers.push(
        mountEagleFolderSection(body).render,
        mountArtworkSaveSection(body).render,
        mountNovelSection(body).render,
        mountRecommendationSection(body).render,
        mountAppearanceSection(body).render,
        mountAdvancedSection(body).render,
        mountConfigBackupSection(body).render,
        mountActionsSection(body).render,
    );

    const logTitle = document.createElement("div");
    logTitle.className = "p2e-control-panel__section-title";
    logTitle.textContent = "最近操作";
    body.appendChild(logTitle);
    const logList = document.createElement("div");
    logList.className = "p2e-action-log__list";
    body.appendChild(logList);
    mountActionLog(logList);
    subscribeActionLog(() => mountActionLog(logList));

    refreshEagleState().then(dispatchSnapshot);
    dispatchSnapshot();
}

function togglePanel() {
    if (isControlPanelOpen()) {
        modalApi.close();
    } else {
        openPanel();
    }
}

export function openControlPanel() {
    openPanel();
}

export function initControlPanel() {
    if (panelInitialized) return;
    panelInitialized = true;

    fabHandle = mountFab({ onTogglePanel: togglePanel });
    subscribe(() => dispatchSnapshot());
}
