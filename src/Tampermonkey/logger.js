"use strict";

import { SETTING_KEYS, SETTING_DEFAULTS } from "./setting.js";

function getDebugMode() {
    return GM_getValue(SETTING_KEYS.DEBUG_MODE, SETTING_DEFAULTS[SETTING_KEYS.DEBUG_MODE]);
}

export function dbg(msg, ...args) {
    if (getDebugMode()) console.log("[Pixiv2Eagle]", msg, ...args);
}

export function warn(msg, ...args) {
    console.warn("[Pixiv2Eagle]", msg, ...args);
}

export function err(msg, ...args) {
    console.error("[Pixiv2Eagle]", msg, ...args);
}
