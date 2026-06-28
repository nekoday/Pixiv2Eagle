"use strict";

export function getNovelId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("id");
}
