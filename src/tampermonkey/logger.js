"use strict";

import { getDebugMode } from "./setting.js";

export function dbg(msg, ...args) {
    if (getDebugMode()) console.log("[Re_Pixiv2Eagle]", msg, ...args);
}

export function warn(msg, ...args) {
    console.warn("[Re_Pixiv2Eagle]", msg, ...args);
}

export function err(msg, ...args) {
    console.error("[Re_Pixiv2Eagle]", msg, ...args);
}
