"use strict";

// 底层封装：返回完整 GM response 对象（不直接被业务调用）
// 不在此处做 HTTP 状态码检查——gmFetch/gmFetchBinary 在各自包装层检查，gmFetchText 保持原状不检查
function gmRequest(url, options = {}) {
    const timeout = options.timeout || 15000;
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: options.method || "GET",
            url: url,
            headers: options.headers || {},
            data: options.body,
            responseType: options.responseType || "json",
            timeout,
            onload: function (response) {
                resolve(response); // 始终返回完整 response，交由包装层取字段并决定是否抛错
            },
            onerror: function (error) {
                reject(error);
            },
            ontimeout: function () {
                reject(new Error(`Request timed out after ${timeout}ms: ${url}`));
            },
        });
    });
}

// 封装 GM_xmlhttpRequest 为 Promise（JSON）——4xx/5xx 抛错（保持原状）
export function gmFetch(url, options = {}) {
    return gmRequest(url, { responseType: "json", timeout: 15000, ...options })
        .then((response) => {
            const status = typeof response.status === "number" ? response.status : 200;
            if (status >= 400) {
                throw new Error(`HTTP ${status} when requesting ${url}`);
            }
            return response.response;
        });
}

// 封装 GM_xmlhttpRequest 获取二进制数据（ArrayBuffer/Blob）——4xx/5xx 抛错（保持原状）
export function gmFetchBinary(url, options = {}) {
    return gmRequest(url, { responseType: "arraybuffer", timeout: 20000, ...options })
        .then((response) => {
            const status = typeof response.status === "number" ? response.status : 200;
            if (status >= 400) {
                throw new Error(`HTTP ${status} when requesting ${url}`);
            }
            return response.response;
        });
}

// 封装 GM_xmlhttpRequest 获取文本
export function gmFetchText(url, options = {}) {
    return gmRequest(url, { responseType: "text", timeout: 15000, ...options })
        .then((response) => response.responseText || response.response);
}
