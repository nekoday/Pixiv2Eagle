"use strict";

import { EAGLE_SAVE_BUTTON_ID } from "./constants.js";

export function createMonitorConfig(handlers) {
    return [
        {
            urlSuffix: "/artworks",
            observeID: EAGLE_SAVE_BUTTON_ID,
            handler: () => {
                handlers.addButton();
                handlers.markSavedInRecommendationArea();
            },
        },
        {
            urlSuffix: "/novel/show.php",
            observeID: EAGLE_SAVE_BUTTON_ID,
            handler: () => {
                handlers.addNovelButton();
            },
        },
        {
            urlSuffix: "/novel/series",
            observeID: null,
            handler: () => {
                handlers.markSavedInNovelSeries();
            },
        },
        {
            urlSuffix: "/user",
            observeID: null,
            handler: handlers.debouncedMarkSavedInArtistList,
        },
    ];
}
