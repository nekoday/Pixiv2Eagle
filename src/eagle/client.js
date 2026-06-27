"use strict";

import { gmFetch } from "../Tampermonkey/request.js";
import { err } from "../Tampermonkey/logger.js";
import { EAGLE_CHECK_TIMEOUT } from "../config/constants.js";

// 检查 Eagle 是否运行
export async function checkEagle() {
    try {
        const data = await gmFetch("http://localhost:41595/api/application/info", {
            timeout: EAGLE_CHECK_TIMEOUT,
        });

        return {
            running: true,
            version: data.data.version,
        };
    } catch (error) {
        const msg = (error && error.message) ? error.message : String(error);
        if (msg.includes("timed out")) {
            err("Eagle API 调用超时（5秒）");
        } else {
            err("Eagle 未启动或无法连接:", error);
        }
        return {
            running: false,
            version: null,
        };
    }
}
