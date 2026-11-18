#target illustrator
// unified_theme_switch.jsx
// 核心单遍统一全量扫描 + 三层 CAD 路径极速短路 + 基于视觉展示效果的双向切换引擎
// 彻底解决“按图层名分流漏换新方块”、“无深转浅自适应”与“重复遍历耗时”问题

(function() {
    var t0 = new Date().getTime();
    if (app.documents.length === 0) return '{"error":"没有打开文档"}';
    var LIB = $.global.MAP_LIB;
    if (!LIB) return '{"error":"MAP_LIB 未加载，请先加载 palette_constants.jsx"}';

    var doc = app.activeDocument;
    var targetTheme = "dark";
    if (typeof $.global.MAP_TARGET_THEME !== "undefined" && $.global.MAP_TARGET_THEME) {
        targetTheme = String($.global.MAP_TARGET_THEME).toLowerCase();
    }
    var isDark = (targetTheme === "dark");
    var abMetrics = LIB.getArtboardMetrics(doc);

    var stats = {
        inspected: 0,
        skipped_cad_containers: 0,
        skipped_cad_paths: 0,
        skipped_protected: 0,
        base_bottom: 0,
        white_tuned: 0,
        boxes_standard: 0,
        boxes_adaptive: 0,
        road_surface: 0,
        buildings: 0,
        parking: 0,
        restricted: 0,
        warning_lines: 0,
        road_lines: 0,
        grid_lines: 0,
        strokes_adaptive: 0,
        texts: 0
    };

    // 单体填充视觉效果处理
    function handlePathFill(it, frgb, effOp, semantic) {
        // 0. 禁行区内部固定检测设备色（188,195,207 / 164,173,188 / 126,134,145）
        if (LIB.isFixedEquipmentFill(frgb, it, semantic)) {
            stats.skipped_protected++;
            return;
        }
        // 受保护工程纯色（红绿黄青洋红等）
        if (LIB.isProtectedEngineeringColor(frgb)) {
            stats.skipped_protected++;
            return;
        }

        var fLum = LIB.getLuminance(frgb.r, frgb.g, frgb.b);

        // 1. 道路隔离网格（填充+描边均约为 #D1D7DE）
        if (it.stroked && LIB.rgbClose(frgb, 209, 215, 222, 6)) {
            var srgbG = LIB.normalizeColor(it.strokeColor);
            if (LIB.rgbClose(srgbG, 209, 215, 222, 8)) {
                it.fillColor = isDark ? LIB.DARK.ROAD_GRID_FILL : LIB.LIGHT.ROAD_GRID_FILL;
                it.strokeColor = isDark ? LIB.DARK.ROAD_GRID_STROKE : LIB.LIGHT.ROAD_GRID_STROKE;
                it.strokeWidth = 1.0;
                it.opacity = isDark ? 30 : 100;
                stats.grid_lines++;
                return;
            }
        }

        // 2. 路边建筑 / 闸口房亭 (197,226,240 或 247,245,218 <---> 100,123,145)
        if (LIB.rgbClose(frgb, 197, 226, 240, 6) ||
            LIB.rgbClose(frgb, 247, 245, 218, 6) ||
            LIB.rgbClose(frgb, 100, 123, 145, 6)) {
            if (isDark) {
                it.fillColor = LIB.DARK.BUILDING_FILL;
                it.stroked = true;
                it.strokeColor = LIB.DARK.BUILDING_STROKE;
                it.strokeWidth = 0.5;
                it.opacity = 100;
            } else {
                it.fillColor = LIB.LIGHT.BUILDING_FILL_1;
                it.stroked = true;
                it.strokeColor = LIB.LIGHT.BUILDING_STROKE;
                it.strokeWidth = 0.5;
                it.opacity = 100;
            }
            stats.buildings++;
            return;
        }

        // 3. 禁行斜纹底 / 警示底区 (语义=restricted 且颜色为 #BAC4D3 或 #535F6D)
        if (semantic === "restricted" &&
            (LIB.rgbClose(frgb, 186, 196, 211, 6) || LIB.rgbClose(frgb, 83, 95, 109, 6))) {
            it.fillColor = isDark ? LIB.DARK.RESTRICTED_FILL : LIB.LIGHT.RESTRICTED_FILL;
            it.stroked = true;
            it.strokeColor = isDark ? LIB.DARK.ARROW : LIB.LIGHT.PARKING_STROKE;
            it.strokeWidth = 0.35;
            it.opacity = isDark ? 10 : 100;
            stats.restricted++;
            return;
        }

        // 4. 停车位 (语义=parking，或带白/灰蓝描边的 #BAC4D3 / #191F35 小块)
        if (semantic === "parking" &&
            (LIB.rgbClose(frgb, 186, 196, 211, 8) || LIB.rgbClose(frgb, 25, 31, 53, 8))) {
            if (isDark) {
                it.fillColor = LIB.DARK.PARKING_FILL;
                it.stroked = true;
                it.strokeColor = LIB.DARK.PARKING_STROKE;
                it.strokeWidth = 0.5;
                it.opacity = 100;
            } else {
                it.fillColor = LIB.LIGHT.PARKING_FILL;
                it.stroked = true;
                it.strokeColor = LIB.LIGHT.PARKING_STROKE;
                it.strokeWidth = 0.35;
                it.opacity = 100;
            }
            stats.parking++;
            return;
        }

        // 5. 大底背景 / 浅灰蓝大底 (#BAC4D3 <---> #191F35)
        if (LIB.rgbClose(frgb, 186, 196, 211, 6) || LIB.rgbClose(frgb, 25, 31, 53, 6)) {
            if (semantic === "base_bottom" || LIB.isLargeBackgroundItem(it, abMetrics)) {
                it.fillColor = isDark ? LIB.DARK.BASE_BOTTOM : LIB.LIGHT.BASE_BOTTOM;
                it.opacity = 100;
                stats.base_bottom++;
            } else {
                // 小块 #BAC4D3 / #191F35（如未命名停车位等）
                it.fillColor = isDark ? LIB.DARK.PARKING_FILL : LIB.LIGHT.PARKING_FILL;
                if (it.stroked) {
                    it.strokeColor = isDark ? LIB.DARK.PARKING_STROKE : LIB.LIGHT.PARKING_STROKE;
                    it.strokeWidth = isDark ? 0.5 : 0.35;
                }
                it.opacity = 100;
                stats.parking++;
            }
            return;
        }

        // 6. 斑马线深色块复原 (#4F5156 75% -> #FFFFFF 100%)
        if (LIB.rgbClose(frgb, 79, 81, 86, 6)) {
            if (isDark) {
                it.fillColor = LIB.DARK.ZEBRA;
                it.opacity = 75;
            } else {
                it.fillColor = LIB.LIGHT.ZEBRA;
                it.opacity = 100;
            }
            stats.white_tuned++;
            return;
        }

        // 7. 纯白 / 极高亮色块（#FFFFFF >= 245）
        if (frgb.r >= 245 && frgb.g >= 245 && frgb.b >= 245) {
            if (isDark) {
                it.fillColor = LIB.DARK.BASE_GROUND; // #FFFFFF
                if (semantic === "roads" && !it.stroked && LIB.isZebraSmallStrip(it)) {
                    // 斑马线小条带 -> 低反差深灰 75%
                    it.fillColor = LIB.DARK.ZEBRA;
                    it.opacity = 75;
                } else if (semantic === "directions" || (effOp > 15 && effOp <= 45)) {
                    // 箭头或明确中透高光 -> 20%
                    it.opacity = 20;
                } else if (semantic === "yard_ground" || semantic === "labels" || LIB.isLargeBackgroundItem(it, abMetrics)) {
                    // 堆场大底 / 编号底圆 / 导流底圆 -> 8%
                    it.opacity = 8;
                } else {
                    // 默认纯白圆底/图标 -> 8%（若位于路网内且较小可能是箭头，保留20%策略按语义）
                    it.opacity = (semantic === "roads") ? 20 : 8;
                }
            } else {
                it.fillColor = LIB.LIGHT.BASE_GROUND;
                it.opacity = 100;
            }
            stats.white_tuned++;
            return;
        }

        // 8. 次干道路面 (#DDE5ED / #EAEFF4 / #344963)
        // 注意：#344963 (52,73,99) 仅在 semantic === "roads" 时归为路面；若位于堆场箱子等非道路层，交由下方色块逻辑还原，避免把深色箱子误判为路面
        if (LIB.rgbClose(frgb, 234, 239, 244, 6) ||
            (semantic === "roads" && (LIB.rgbClose(frgb, 221, 229, 237, 6) || LIB.rgbClose(frgb, 52, 73, 99, 6)))) {
            it.fillColor = isDark ? LIB.DARK.ROAD_SURFACE : LIB.LIGHT.ROAD_SURFACE;
            it.opacity = isDark ? 75 : 100;
            stats.road_surface++;
            return;
        }

        // 9. 标准 1109 堆场箱子色块（精确命中）
        // 箱子1: #C3D2E2 (195,210,226) <---> #34455E (52,69,94) 75%
        if (LIB.rgbClose(frgb, 195, 210, 226, 6) || LIB.rgbClose(frgb, 52, 69, 94, 6)) {
            it.fillColor = isDark ? LIB.DARK.BOX_PURPLE : LIB.LIGHT.BOX_PURPLE;
            it.opacity = isDark ? 75 : 100;
            stats.boxes_standard++;
            return;
        }
        // 箱子2: #D0DFEA (208,223,234) / 箱子3: #DDE5ED (221,229,237) <---> #445668 (68,86,104) 75%
        if (LIB.rgbClose(frgb, 208, 223, 234, 6) ||
            LIB.rgbClose(frgb, 221, 229, 237, 6) ||
            LIB.rgbClose(frgb, 68, 86, 104, 6) ||
            LIB.rgbClose(frgb, 45, 58, 76, 6) ||
            LIB.rgbClose(frgb, 52, 73, 99, 6)) {
            if (isDark) {
                it.fillColor = LIB.DARK.BOX_GRAY;
                it.opacity = 75;
            } else {
                it.fillColor = LIB.rgbClose(frgb, 208, 223, 234, 6) ? LIB.LIGHT.BOX_ALT : LIB.LIGHT.BOX_GRAY;
                it.opacity = 100;
            }
            stats.boxes_standard++;
            return;
        }

        // 10. 未知新方块 / 非标色块（双向自适应，消除颜色空间/命名/尺寸阈值盲区）
        if (isDark) {
            // 转深色：识别所有未切换的中高明度实色/浅色块 (fLum >= 105) 或高透色块
            if (fLum >= 105 || effOp > 85) {
                // 若本身已是低明度暗色 (fLum < 105)，只需确保不过亮，不强行破坏已有深色
                if (fLum >= 105) {
                    var isLarge = (semantic === "base_bottom") || (fLum >= 160 && LIB.isLargeBackgroundItem(it, abMetrics));
                    var mappedDark = LIB.adaptiveMapFill(frgb, "dark", isLarge);
                    it.fillColor = mappedDark.color;
                    it.opacity = mappedDark.opacity;
                    if (isLarge) stats.base_bottom++;
                    else stats.boxes_adaptive++;
                }
            }
        } else {
            // 转浅色：补齐深转浅自适应，识别所有暗调方块 (fLum < 135) 或微透中色块 (effOp < 90 且非纯白)
            if (fLum < 135 || effOp < 90) {
                var isLargeL = (semantic === "base_bottom") || (fLum < 80 && LIB.isLargeBackgroundItem(it, abMetrics));
                var mappedLight = LIB.adaptiveMapFill(frgb, "light", isLargeL);
                it.fillColor = mappedLight.color;
                it.opacity = mappedLight.opacity;
                if (isLargeL) stats.base_bottom++;
                else stats.boxes_adaptive++;
            }
        }
    }

    // 单体描边视觉效果处理
    function handlePathStroke(it, srgb, effOp, semantic) {
        if (LIB.isProtectedEngineeringColor(srgb)) {
            stats.skipped_protected++;
            return;
        }

        // 1. 禁行警戒框（亮金 196,151,78 0.5pt <---> 暗金 170,121,24 1pt）
        if (LIB.rgbClose(srgb, 196, 151, 78, 12) || LIB.rgbClose(srgb, 170, 121, 24, 12)) {
            it.strokeColor = isDark ? LIB.DARK.WARNING_GOLD : LIB.LIGHT.WARNING_GOLD;
            it.strokeWidth = isDark ? 1.0 : 0.5;
            it.opacity = 100;
            stats.warning_lines++;
            return;
        }

        // 2. 网格线 (#D1D7DE 209,215,222)
        if (LIB.rgbClose(srgb, 209, 215, 222, 10)) {
            it.strokeColor = isDark ? LIB.DARK.GRID_LINE : LIB.LIGHT.GRID_LINE;
            it.opacity = isDark ? 30 : 100;
            stats.grid_lines++;
            return;
        }

        // 3. 道路主线 / 车位线描边 (#FFFFFF <---> #4F536B / #535F6D)
        if (srgb.r >= 242 && srgb.g >= 242 && srgb.b >= 242) {
            if (!it.filled) {
                if (isDark) {
                    it.strokeColor = (semantic === "parking") ? LIB.DARK.PARKING_STROKE : LIB.DARK.ROAD_LINE;
                    it.strokeWidth = Math.max(0.4, it.strokeWidth);
                    it.opacity = 100;
                } else {
                    it.strokeColor = LIB.LIGHT.ROAD_LINE;
                    it.opacity = 100;
                }
                stats.road_lines++;
            } else if (semantic === "parking" || semantic === "restricted") {
                it.strokeColor = isDark ? ((semantic === "parking") ? LIB.DARK.PARKING_STROKE : LIB.LIGHT.PARKING_STROKE) : LIB.LIGHT.PARKING_STROKE;
                if (semantic === "parking" && isDark) it.strokeWidth = 0.5;
            }
            return;
        }

        if (LIB.rgbClose(srgb, 79, 83, 107, 8) || LIB.rgbClose(srgb, 83, 95, 109, 8)) {
            if (!it.filled) {
                if (isDark) {
                    it.strokeColor = (semantic === "parking") ? LIB.DARK.PARKING_STROKE : LIB.DARK.ROAD_LINE;
                    it.opacity = 100;
                } else {
                    it.strokeColor = LIB.LIGHT.ROAD_LINE;
                    if (it.strokeWidth > 0.45 && semantic !== "parking") {
                        it.strokeWidth = 0.45;
                    } else if (semantic === "parking") {
                        it.strokeWidth = 0.35;
                    }
                    it.opacity = 100;
                }
                stats.road_lines++;
            }
            return;
        }

        // 4. 其它非保护未知描边双向自适应
        if (!it.filled) {
            var sLum = LIB.getLuminance(srgb.r, srgb.g, srgb.b);
            if (isDark && sLum >= 150) {
                it.strokeColor = LIB.DARK.ROAD_LINE;
                it.opacity = 100;
                stats.strokes_adaptive++;
            } else if (!isDark && sLum < 120) {
                it.strokeColor = LIB.LIGHT.ROAD_LINE;
                it.opacity = 100;
                stats.strokes_adaptive++;
            }
        }
    }

    // 统一递归穿透：支持有效透明度拍平（Group/CompoundPath 透明度传给子项并复位容器为 100%）
    function sweepItem(it, parentSemantic, parentOpacityFactor) {
        if (!it || it.hidden) return;
        var t = it.typename;

        var wasLocked = false;
        try {
            wasLocked = it.locked;
            if (wasLocked) it.locked = false;
        } catch(e) {}

        var ownOp = (typeof it.opacity === "number") ? it.opacity : 100;
        var effFactor = parentOpacityFactor * (ownOp / 100);
        var effOp = Math.round(effFactor * 100);

        var semantic = LIB.checkSemanticName(it.name);
        if (semantic === "unknown" || semantic === "general") {
            semantic = parentSemantic;
        }

        try {
            if (t === "GroupItem") {
                // 第二层：无名/深层 CAD 编组 0ms 短路跳过
                if (LIB.isCADOrProtectedContainer(it)) {
                    stats.skipped_cad_containers++;
                    return;
                }
                // 若容器自身带非100%透明度，拍平传给子元素后将容器复原为100%，保证有效展示效果精准
                if (ownOp !== 100) {
                    try { it.opacity = 100; } catch(eOp) {}
                }
                var items = it.pageItems;
                for (var i = 0; i < items.length; i++) {
                    sweepItem(items[i], semantic, effFactor);
                }
            } else if (t === "CompoundPathItem") {
                if (ownOp !== 100) {
                    try { it.opacity = 100; } catch(eOp2) {}
                }
                var paths = it.pathItems;
                for (var c = 0; c < paths.length; c++) {
                    sweepItem(paths[c], semantic, effFactor);
                }
            } else if (t === "TextFrame") {
                stats.inspected++;
                try {
                    var contentStr = String(it.contents || "");
                    if (contentStr.toLowerCase().indexOf("x-ray") !== -1) {
                        stats.skipped_protected++;
                        return;
                    }
                    var tfc = it.textRange.characterAttributes.fillColor;
                    var trgb = LIB.normalizeColor(tfc);
                    if (trgb && !LIB.isProtectedEngineeringColor(trgb)) {
                        var tLum = LIB.getLuminance(trgb.r, trgb.g, trgb.b);
                        if (isDark) {
                            if (tLum < 125 || LIB.rgbClose(trgb, 107, 128, 149, 15) || trgb.r >= 240) {
                                it.textRange.characterAttributes.fillColor = LIB.DARK.TEXT_LABEL;
                                stats.texts++;
                            }
                        } else {
                            if (LIB.rgbClose(trgb, 108, 133, 150, 15) || trgb.r >= 200 || tLum > 140) {
                                it.textRange.characterAttributes.fillColor = LIB.LIGHT.TEXT_LABEL;
                                stats.texts++;
                            }
                        }
                        if (ownOp !== 100) it.opacity = 100;
                    }
                } catch(te) {}
            } else if (t === "PathItem") {
                // 第三层：散落单体 CAD 路径极速前哨拦截（绝不读取 visibleBounds）
                if (!it.filled && it.stroked) {
                    var srgbPre = LIB.normalizeColor(it.strokeColor);
                    if (LIB.isProtectedEngineeringColor(srgbPre)) {
                        stats.skipped_cad_paths++;
                        return;
                    }
                    if (!it.closed && it.strokeWidth <= 0.35 && !LIB.isMapRoadNeutralStroke(srgbPre) &&
                        !LIB.rgbClose(srgbPre, 196, 151, 78, 12) && !LIB.rgbClose(srgbPre, 170, 121, 24, 12)) {
                        stats.skipped_cad_paths++;
                        return;
                    }
                }

                stats.inspected++;
                // 将上级传递下来的有效透明度先还原到当前路径（后续处理函数按需要重设或保持）
                if (parentOpacityFactor !== 1.0) {
                    it.opacity = Math.max(0, Math.min(100, effOp));
                }

                if (it.filled) {
                    var frgb = LIB.normalizeColor(it.fillColor);
                    if (frgb) {
                        handlePathFill(it, frgb, effOp, semantic);
                    }
                }
                if (it.stroked) {
                    var srgb = LIB.normalizeColor(it.strokeColor);
                    if (srgb) {
                        handlePathStroke(it, srgb, effOp, semantic);
                    }
                }
            }
        } finally {
            if (wasLocked) {
                try { it.locked = true; } catch(el) {}
            }
        }
    }

    function sweepLayer(lyr, parentSemantic) {
        if (!lyr || !lyr.visible) return;
        // 第一/二层：CAD 图层入口零成本短路
        if (LIB.isCADOrProtectedContainer(lyr)) {
            stats.skipped_cad_containers++;
            return;
        }

        var lyrLocked = false;
        try {
            lyrLocked = lyr.locked;
            if (lyrLocked) lyr.locked = false;
        } catch(e) {}

        var lyrSemantic = LIB.checkSemanticName(lyr.name);
        if (lyrSemantic === "unknown" || lyrSemantic === "general") {
            lyrSemantic = parentSemantic;
        }

        try {
            var pItems = lyr.pageItems;
            for (var p = 0; p < pItems.length; p++) {
                sweepItem(pItems[p], lyrSemantic, 1.0);
            }
            var subLyrs = lyr.layers;
            for (var s = 0; s < subLyrs.length; s++) {
                sweepLayer(subLyrs[s], lyrSemantic);
            }
        } finally {
            if (lyrLocked) {
                try { lyr.locked = true; } catch(e2) {}
            }
        }
    }

    // 顶层全部可见图层统一扫描
    for (var l = 0; l < doc.layers.length; l++) {
        sweepLayer(doc.layers[l], "general");
    }

    var elapsed = new Date().getTime() - t0;
    return '{"status":"ok","engine":"unified_v2","target_theme":"' + targetTheme +
           '","elapsed_ms":' + elapsed +
           ',"inspected":' + stats.inspected +
           ',"skipped_cad_containers":' + stats.skipped_cad_containers +
           ',"skipped_cad_paths":' + stats.skipped_cad_paths +
           ',"skipped_protected":' + stats.skipped_protected +
           ',"base_bottom":' + stats.base_bottom +
           ',"white_tuned":' + stats.white_tuned +
           ',"boxes_standard":' + stats.boxes_standard +
           ',"boxes_adaptive":' + stats.boxes_adaptive +
           ',"road_surface":' + stats.road_surface +
           ',"buildings":' + stats.buildings +
           ',"parking":' + stats.parking +
           ',"restricted":' + stats.restricted +
           ',"warning_lines":' + stats.warning_lines +
           ',"road_lines":' + stats.road_lines +
           ',"grid_lines":' + stats.grid_lines +
           ',"strokes_adaptive":' + stats.strokes_adaptive +
           ',"texts":' + stats.texts + '}';
})();
