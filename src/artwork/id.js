"use strict";

// 获取作品 ID
export function getArtworkId() {
    const match = location.pathname.match(/^\/artworks\/(\d+)/);
    return match ? match[1] : null;
}
