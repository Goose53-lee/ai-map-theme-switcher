#target illustrator
// palette_constants.jsx
// 共享核心库：双主题色彩单例、跨色彩空间归一化、双向自适应映射、三层 CAD 短路与受保护图元判定
// 注意：严格使用 ExtendScript ES3 语法

(function() {
    function makeRGB(r, g, b) {
        var c = new RGBColor();
        c.red = r;
        c.green = g;
        c.blue = b;
        return c;
    }

    // ==================== 浅色主题色彩单例 (Light Theme Singletons) ====================
    var LIGHT_PALETTE = {
        BOX_PURPLE: makeRGB(195, 210, 226),        // 堆场色块1 (#C3D2E2)
        BOX_ALT: makeRGB(208, 223, 234),           // 堆场色块2 (#D0DFEA)
        BOX_GRAY: makeRGB(221, 229, 237),          // 堆场色块3 (#DDE5ED)
        GRID_LINE: makeRGB(209, 215, 222),         // 网格细线 (#D1D7DE)
        ROAD_LINE: makeRGB(255, 255, 255),         // 道路主线/标线 (#FFFFFF)
        ROAD_SURFACE: makeRGB(221, 229, 237),      // 次干道路面 (#DDE5ED)
        ROAD_SURFACE_ALT: makeRGB(234, 239, 244),  // 次干道路面备选 (#EAEFF4)
        ZEBRA: makeRGB(255, 255, 255),             // 斑马线 (#FFFFFF)
        ARROW: makeRGB(255, 255, 255),             // 车道方向箭头 (#FFFFFF)
        TEXT_LABEL: makeRGB(107, 128, 149),        // 编号/点位文字 (#6B8095)
        TEXT_BLACK: makeRGB(16, 17, 17),           // 纯黑文字 (#101111)
        NUM_CIRCLE: makeRGB(255, 255, 255),        // 编号底圆 (#FFFFFF)
        BASE_GROUND: makeRGB(255, 255, 255),       // 堆场大底色 (#FFFFFF)
        BASE_BOTTOM: makeRGB(186, 196, 211),       // 整个大底部 (#BAC4D3)
        PARKING_FILL: makeRGB(186, 196, 211),      // 停车位填充 (#BAC4D3)
        PARKING_STROKE: makeRGB(255, 255, 255),    // 停车位描边 (#FFFFFF)
        WARNING_GOLD: makeRGB(196, 151, 78),       // 禁行警戒框 (#C4974E)
        RESTRICTED_FILL: makeRGB(186, 196, 211),   // 禁行斜纹底 (#BAC4D3)
        BUILDING_FILL_1: makeRGB(197, 226, 240),   // 建筑房亭1 (#C5E2F0)
        BUILDING_FILL_2: makeRGB(247, 245, 218),   // 建筑房亭2 (#F7F5DA)
        BUILDING_STROKE: makeRGB(228, 233, 239),   // 建筑房亭描边 (#E4E9EF)
        ROAD_GRID_FILL: makeRGB(209, 215, 222),    // 道路隔离网格填充 (#D1D7DE)
        ROAD_GRID_STROKE: makeRGB(209, 215, 222)   // 道路隔离网格描边 (#D1D7DE)
    };

    // ==================== 深色主题色彩单例 (Dark Theme Singletons) ====================
    var DARK_PALETTE = {
        BOX_PURPLE: makeRGB(52, 69, 94),           // 堆场色块1 (#34455E, 75%)
        BOX_GRAY: makeRGB(68, 86, 104),            // 堆场色块2/3 (#445668, 75%)
        BOX_MID: makeRGB(45, 58, 76),              // 中等灰蓝自适配 (#2D3A4C, 75%)
        GRID_LINE: makeRGB(209, 215, 222),         // 网格细线 (#D1D7DE, 30%)
        ROAD_LINE: makeRGB(79, 83, 107),           // 道路主线描边 (#4F536B)
        ROAD_SURFACE: makeRGB(52, 73, 99),         // 次干道路面 (#344963, 75%)
        ZEBRA: makeRGB(79, 81, 86),                // 斑马线 (#4F5156, 75%)
        ARROW: makeRGB(255, 255, 255),             // 车道方向箭头 (#FFFFFF, 20%)
        TEXT_LABEL: makeRGB(108, 133, 150),        // 编号/点位文字 (#6C8596)
        NUM_CIRCLE: makeRGB(255, 255, 255),        // 编号底圆 (#FFFFFF, 8%)
        BASE_GROUND: makeRGB(255, 255, 255),       // 堆场大底色 (#FFFFFF, 8%)
        BASE_BOTTOM: makeRGB(25, 31, 53),          // 整个大底部 (#191F35, 100%)
        PARKING_FILL: makeRGB(25, 31, 53),         // 停车位填充 (#191F35)
        PARKING_STROKE: makeRGB(83, 95, 109),      // 停车位描边 (#535F6D)
        WARNING_GOLD: makeRGB(170, 121, 24),       // 禁行警戒框 (#AA7918)
        RESTRICTED_FILL: makeRGB(83, 95, 109),     // 禁行斜纹底 (#535F6D, 10%)
        BUILDING_FILL: makeRGB(100, 123, 145),     // 建筑房亭填充 (#647B91)
        BUILDING_STROKE: makeRGB(79, 83, 107),     // 建筑房亭描边 (#4F536B)
        ROAD_GRID_FILL: makeRGB(209, 215, 222),    // 道路隔离网格填充 (#D1D7DE, 30%)
        ROAD_GRID_STROKE: makeRGB(209, 215, 222)   // 道路隔离网格描边 (#D1D7DE, 30%)
    };

    // ==================== 基础工具函数 ====================
    function jsonEscape(str) {
        if (str === null || typeof str === "undefined") return "";
        return String(str)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, "\\\"")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t");
    }

    function getLuminance(r, g, b) {
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    function rgbClose(rgb, r, g, b, tol) {
        if (!rgb) return false;
        var t = (typeof tol === "number") ? tol : 5;
        return Math.abs(rgb.r - r) <= t && Math.abs(rgb.g - g) <= t && Math.abs(rgb.b - b) <= t;
    }

    // 跨色彩空间归一化：支持 RGBColor / CMYKColor / GrayColor / SpotColor
    function normalizeColor(c) {
        if (!c) return null;
        var t = "";
        try { t = c.typename; } catch(e) { return null; }

        if (t === "RGBColor") {
            return {
                r: Math.round(c.red),
                g: Math.round(c.green),
                b: Math.round(c.blue)
            };
        }
        if (t === "GrayColor") {
            var v = Math.round(255 * (1 - (c.gray / 100)));
            if (v < 0) v = 0;
            if (v > 255) v = 255;
            return { r: v, g: v, b: v };
        }
        if (t === "CMYKColor") {
            var cy = c.cyan / 100;
            var ma = c.magenta / 100;
            var ye = c.yellow / 100;
            var bk = c.black / 100;
            var rr = Math.round(255 * (1 - cy) * (1 - bk));
            var gg = Math.round(255 * (1 - ma) * (1 - bk));
            var bb = Math.round(255 * (1 - ye) * (1 - bk));
            return {
                r: Math.max(0, Math.min(255, rr)),
                g: Math.max(0, Math.min(255, gg)),
                b: Math.max(0, Math.min(255, bb))
            };
        }
        if (t === "SpotColor") {
            try {
                var base = normalizeColor(c.spot.color);
                if (!base) return null;
                var tint = (typeof c.tint === "number") ? (c.tint / 100) : 1;
                if (tint < 0) tint = 0;
                if (tint > 1) tint = 1;
                return {
                    r: Math.round(255 - (255 - base.r) * tint),
                    g: Math.round(255 - (255 - base.g) * tint),
                    b: Math.round(255 - (255 - base.b) * tint)
                };
            } catch(e2) {
                return null;
            }
        }
        return null;
    }

    // ==================== 受保护图元与 CAD 识别 ====================
    // 判断是否为 AutoCAD 经典工程色 / 作业路径保护色（纯绿、纯红、纯黄、纯青、洋红、暗红等）
    function isProtectedEngineeringColor(rgb) {
        if (!rgb) return false;
        var r = rgb.r, g = rgb.g, b = rgb.b;
        // 1. 纯绿/亮绿作业路径 (0, 255, 0)
        if (r <= 35 && g >= 180 && b <= 35) return true;
        // 2. 纯红/小红点辅助线 (255, 0, 0 / 255, 29, 37)
        if (r >= 180 && g <= 45 && b <= 50) return true;
        // 3. 纯黄/亮黄工程线 (255, 241, 0)
        if (r >= 200 && g >= 200 && b <= 40) return true;
        // 4. 亮青/蓝青测量线 (0, 255, 255)
        if (r <= 40 && g >= 190 && b >= 190) return true;
        // 5. 洋红/紫红工程线 (255, 0, 255)
        if (r >= 190 && g <= 45 && b >= 190) return true;
        // 6. 暗红/棕红工程路径 (如 151, 51, 35)
        if (r >= 120 && r <= 190 && g <= 70 && b <= 55) return true;
        return false;
    }

    // 判断是否为纯正地图骨架中性/灰蓝色（用于避免把未命名“道路标线组”误判成 CAD 容器）
    function isMapRoadNeutralStroke(rgb) {
        if (!rgb) return false;
        // 纯白标线
        if (rgb.r >= 240 && rgb.g >= 240 && rgb.b >= 240) return true;
        // 深蓝灰道路线 (#4F536B) 或 深灰蓝车位描边 (#535F6D)
        if (rgbClose(rgb, 79, 83, 107, 10) || rgbClose(rgb, 83, 95, 109, 10)) return true;
        // 浅灰网格线 (#D1D7DE)
        if (rgbClose(rgb, 209, 215, 222, 12)) return true;
        return false;
    }

    // 语义分类识别（用于语义辅助提示与避免将道路白线组误短路为 CAD）
    function checkSemanticName(name) {
        if (!name) return "unknown";
        var n = String(name).toLowerCase().replace(/^\s+|\s+$/g, "");
        if (!n) return "unknown";
        if (n.indexOf("大底") !== -1 || n.indexOf("背景") !== -1 || n === "bg" || n === "background" || n === "base" || n === "baseground") {
            return "base_bottom";
        }
        if (n === "堆场" || n.indexOf("堆场底") !== -1 || n === "yard" || n === "ground") {
            return "yard_ground";
        }
        if (n.indexOf("编号") !== -1 || n.indexOf("label") !== -1 || n.indexOf("number") !== -1) {
            return "labels";
        }
        if (n.indexOf("方向") !== -1 || n.indexOf("箭头") !== -1 || n.indexOf("arrow") !== -1 || n.indexOf("direction") !== -1) {
            return "directions";
        }
        if (n.indexOf("禁行") !== -1 || n.indexOf("restricted") !== -1 || n.indexOf("warning") !== -1 || n.indexOf("hazard") !== -1) {
            return "restricted";
        }
        if (n.indexOf("车位") !== -1 || n.indexOf("parking") !== -1) {
            return "parking";
        }
        if (n.indexOf("箱") !== -1 || n.indexOf("container") !== -1 || n.indexOf("cargo") !== -1 || n.indexOf("box") !== -1 || n.indexOf("stack") !== -1) {
            return "boxes";
        }
        if (n === "路" || n.indexOf("道路") !== -1 || n.indexOf("车道") !== -1 || n.indexOf("主路") !== -1 || n.indexOf("road") !== -1 || n.indexOf("lane") !== -1 || n.indexOf("street") !== -1) {
            return "roads";
        }
        return "general";
    }

    // 第一层 + 第二层：CAD / 工程路径容器零成本极速短路判定
    // 兼顾：1) 名称关键词 2) 跨深层首/中/尾分散采样指纹（不逐个枚举全量子项）
    function isCADOrProtectedContainer(container) {
        if (!container) return false;

        var rawName = String(container.name || "");
        var lowerName = rawName.toLowerCase().replace(/^\s+|\s+$/g, "");
        if (lowerName) {
            // 第一层：名称明确为 CAD / 工程 / 路径 / 参考层
            if (/cad|dwg|dxf|defpoints|track|agv|航道|作业线|工程|需求|参考|中心线/.test(lowerName)) {
                return true;
            }
            if (lowerName === "路径" || lowerName === "routes" || lowerName === "route") {
                return true;
            }
            // 若容器显式属于地图业务语义（如 路/道路/车道/箱/车位/大底），不做无名指纹短路，交由单体保护拦截内部的单条工程线
            var sem = checkSemanticName(rawName);
            if (sem !== "unknown" && sem !== "general") {
                return false;
            }
        }

        // 第二层：无名或通用容器指纹采样（首/中/尾分散采样，覆盖深层嵌套 <= 5 层）
        try {
            var samples = [];
            function sampleFromContainer(node, depth) {
                if (!node || depth > 5 || samples.length >= 12) return;
                // 优先直接从 pathItems 取首/中/尾样本
                try {
                    var paths = node.pathItems;
                    if (paths && paths.length > 0) {
                        var plen = paths.length;
                        var step = Math.max(1, Math.floor(plen / 4));
                        for (var pi = 0; pi < plen && samples.length < 12; pi += step) {
                            samples.push(paths[pi]);
                        }
                        if (plen > 1 && samples.length < 12) {
                            samples.push(paths[plen - 1]);
                        }
                    }
                } catch(e1) {}

                if (samples.length >= 12) return;

                // 若当前层路径不足，向首/中/尾子 GroupItem 下探（跳过全量遍历）
                try {
                    var grps = node.groupItems;
                    if (grps && grps.length > 0) {
                        var glen = grps.length;
                        var idxs = [0];
                        if (glen > 2) idxs.push(Math.floor(glen / 2));
                        if (glen > 1) idxs.push(glen - 1);
                        for (var gi = 0; gi < idxs.length && samples.length < 12; gi++) {
                            sampleFromContainer(grps[idxs[gi]], depth + 1);
                        }
                    }
                } catch(e2) {}

                // 若是 Layer 且有子图层但直接路径不足，少量探测首/尾子图层
                if (samples.length < 4) {
                    try {
                        var subLyrs = node.layers;
                        if (subLyrs && subLyrs.length > 0) {
                            var sLen = subLyrs.length;
                            var sStep = Math.max(1, Math.floor(sLen / 3));
                            for (var si = 0; si < sLen && samples.length < 12; si += sStep) {
                                if (subLyrs[si].visible) {
                                    sampleFromContainer(subLyrs[si], depth + 1);
                                }
                            }
                        }
                    } catch(e3) {}
                }
            }

            sampleFromContainer(container, 0);

            if (samples.length >= 4) {
                var cadVotes = 0;
                for (var i = 0; i < samples.length; i++) {
                    var it = samples[i];
                    if (it.hidden) continue;
                    var isStrokeOnly = (!it.filled && it.stroked);
                    if (!isStrokeOnly) continue;

                    var srgb = normalizeColor(it.strokeColor);
                    if (isMapRoadNeutralStroke(srgb)) {
                        // 地图白线 / 深蓝灰道路线 / 网格线，绝不计为 CAD
                        continue;
                    }
                    var isCadColor = isProtectedEngineeringColor(srgb);
                    var isThinOrUnclosedCad = (!it.closed && it.strokeWidth <= 0.35);
                    if (isCadColor || isThinOrUnclosedCad) {
                        cadVotes++;
                    }
                }
                if ((cadVotes / samples.length) >= 0.75) {
                    return true;
                }
            }
        } catch(err) {}

        return false;
    }

    // 禁行区内部固定检测设备色判定（避免误改 X-Ray 等设备部件，同时不与 #BAC4D3 冲突）
    function isFixedEquipmentFill(rgb, it, semantic) {
        if (!rgb) return false;
        // 188,195,207 / 164,173,188 / 126,134,145
        if (rgbClose(rgb, 164, 173, 188, 3) || rgbClose(rgb, 126, 134, 145, 3)) {
            return true;
        }
        // (188, 195, 207) 非常接近大底/斜纹底 (186, 196, 211)，仅在禁行区内且不具白描边 0.35pt 的小部件时判定为固定设备
        if (semantic === "restricted" && rgbClose(rgb, 188, 195, 207, 2)) {
            if (!it.stroked || it.strokeWidth <= 0.2) {
                return true;
            }
        }
        return false;
    }

    // 双向自适应色块映射：未知填充色 -> 目标主题暗调或浅调
    function adaptiveMapFill(rgb, targetTheme, isLargeBg) {
        if (isLargeBg) {
            return (targetTheme === "dark")
                ? { color: DARK_PALETTE.BASE_BOTTOM, opacity: 100 }
                : { color: LIGHT_PALETTE.BASE_BOTTOM, opacity: 100 };
        }
        if (targetTheme === "dark") {
            // 浅/中明度块压暗为冷调深蓝/灰蓝 75%
            if (rgb.b >= rgb.r + 4) {
                return { color: DARK_PALETTE.BOX_PURPLE, opacity: 75 };
            }
            var lum = getLuminance(rgb.r, rgb.g, rgb.b);
            if (lum < 165) {
                return { color: DARK_PALETTE.BOX_MID, opacity: 75 };
            }
            return { color: DARK_PALETTE.BOX_GRAY, opacity: 75 };
        } else {
            // 深色块提亮为 1109 浅色阶梯 100%
            if (rgb.b >= rgb.r + 12) {
                return { color: LIGHT_PALETTE.BOX_PURPLE, opacity: 100 };
            }
            if (rgb.b >= rgb.r + 4) {
                return { color: LIGHT_PALETTE.BOX_ALT, opacity: 100 };
            }
            return { color: LIGHT_PALETTE.BOX_GRAY, opacity: 100 };
        }
    }

    // 获取当前激活画板面积参考
    function getArtboardMetrics(doc) {
        try {
            var idx = doc.artboards.getActiveArtboardIndex();
            var rect = doc.artboards[idx].artboardRect; // [left, top, right, bottom]
            var w = Math.abs(rect[2] - rect[0]);
            var h = Math.abs(rect[1] - rect[3]);
            return { width: w, height: h, area: w * h };
        } catch(e) {
            return { width: 1200, height: 800, area: 960000 };
        }
    }

    function isLargeBackgroundItem(it, abMetrics) {
        try {
            var b = it.visibleBounds; // [left, top, right, bottom]
            var w = Math.abs(b[2] - b[0]);
            var h = Math.abs(b[1] - b[3]);
            var area = w * h;
            if (abMetrics && abMetrics.area > 0) {
                if (area >= abMetrics.area * 0.18) return true;
                if (w >= abMetrics.width * 0.45 && h >= abMetrics.height * 0.45) return true;
            }
            if (w >= 550 && h >= 380) return true;
        } catch(e) {}
        return false;
    }

    function isZebraSmallStrip(it) {
        try {
            var b = it.visibleBounds;
            var w = Math.abs(b[2] - b[0]);
            var h = Math.abs(b[1] - b[3]);
            return (w < 22 && h < 22);
        } catch(e) {
            return false;
        }
    }

    // 导出到全局单例
    $.global.MAP_LIB = {
        version: "2.0",
        LIGHT: LIGHT_PALETTE,
        DARK: DARK_PALETTE,
        makeRGB: makeRGB,
        jsonEscape: jsonEscape,
        getLuminance: getLuminance,
        rgbClose: rgbClose,
        normalizeColor: normalizeColor,
        isProtectedEngineeringColor: isProtectedEngineeringColor,
        isMapRoadNeutralStroke: isMapRoadNeutralStroke,
        checkSemanticName: checkSemanticName,
        isCADOrProtectedContainer: isCADOrProtectedContainer,
        isFixedEquipmentFill: isFixedEquipmentFill,
        adaptiveMapFill: adaptiveMapFill,
        getArtboardMetrics: getArtboardMetrics,
        isLargeBackgroundItem: isLargeBackgroundItem,
        isZebraSmallStrip: isZebraSmallStrip
    };
})();
