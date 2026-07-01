"use strict";

import { dbg, err } from "./tampermonkey/logger.js";
import { registerMenuCommands } from "./tampermonkey/menu.js";
import { initTheme } from "./ui/theme.js";
import { initControlPanel } from "./ui/control-panel/index.js";
import { createMonitorConfig } from "./config/monitor.js";
import { observeUrlChanges } from "./routing/observe-url.js";
import { handlePageChange } from "./routing/handle-page.js";
import { ensureEagleIndex } from "./eagle/index-cache.js";
import { addButton } from "./artwork/ui/save-button.js";
import { markSavedInRecommendationArea } from "./artwork/ui/recommendation-mark.js";
import { addNovelButton } from "./novel/ui/save-button.js";
import { markSavedInNovelSeries } from "./novel/series/marking.js";
import { debouncedMarkSavedInArtistList } from "./artist-list/marking.js";
import { initSavedEventBus } from "./shared/marking/saved-event-bus.js";

registerMenuCommands();
initTheme();
initControlPanel();
initSavedEventBus();

const monitorConfig = createMonitorConfig({
    addButton,
    markSavedInRecommendationArea,
    addNovelButton,
    markSavedInNovelSeries,
    debouncedMarkSavedInArtistList,
});

try {
    dbg("脚本已启动，当前URL:", location.pathname);

    ensureEagleIndex();

    for (const monitorInfo of monitorConfig) {
        if (location.pathname.includes(monitorInfo.urlSuffix)) {
            dbg("初始加载时触发处理器:", monitorInfo.urlSuffix);
            handlePageChange(monitorInfo);
        }
    }
    observeUrlChanges(monitorConfig);
} catch (error) {
    err("脚本启动失败:", error);
}
