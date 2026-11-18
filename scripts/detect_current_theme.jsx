#target illustrator
// detect_current_theme.jsx
// 全可见图层视觉明度采样探测：接入三层 CAD 短路 + 跨色彩空间归一化 + 有效透明度合成
// 彻底修复“单一图层抽样遗漏”与“0票默认判dark导致反向死循环”问题

(function() {
    if (app.documents.length === 0) {
        return '{"error":"没有打开任何 Illustrator 文档"}';
    }
    var LIB = $.global.MAP_LIB;
    if (!LIB) {
        return '{"error":"MAP_LIB 未加载，请先加载 palette_constants.jsx"}';
    }

    var doc = app.activeDocument;
    var darkVotes = 0;
    var lightVotes = 0;
    var sampled = 0;
    var skippedCadContainers = 0;
    var MAX_SAMPLES = 240;

    function sampleItem(it, parentOpacityFactor) {
        if (sampled >= MAX_SAMPLES || !it || it.hidden) return;
        var effFactor = parentOpacityFactor * ((typeof it.opacity === "number") ? (it.opacity / 100) : 1);

        var t = it.typename;
        if (t === "GroupItem") {
            if (LIB.isCADOrProtectedContainer(it)) {
                skippedCadContainers++;
                return;
            }
            var items = it.pageItems;
            var len = items.length;
            var step = (len > 40) ? Math.max(1, Math.floor(len / 20)) : 1;
            for (var i = 0; i < len && sampled < MAX_SAMPLES; i += step) {
                sampleItem(items[i], effFactor);
            }
        } else if (t === "CompoundPathItem") {
            if (it.pathItems && it.pathItems.length > 0) {
                sampleItem(it.pathItems[0], effFactor);
            }
        } else if (t === "PathItem") {
            // 第三层：单体 CAD 工程线前哨拦截
            if (!it.filled && it.stroked) {
                var srgbFast = LIB.normalizeColor(it.strokeColor);
                if (LIB.isProtectedEngineeringColor(srgbFast)) return;
                if (!it.closed && it.strokeWidth <= 0.35 && !LIB.isMapRoadNeutralStroke(srgbFast)) return;
            }

            sampled++;
            var effOp = Math.round(effFactor * 100);

            if (it.filled) {
                var frgb = LIB.normalizeColor(it.fillColor);
                if (frgb && !LIB.isProtectedEngineeringColor(frgb)) {
                    var fLum = LIB.getLuminance(frgb.r, frgb.g, frgb.b);

                    // 1109 强特征优先高权重计票
                    if (LIB.rgbClose(frgb, 25, 31, 53, 6) ||
                        ((LIB.rgbClose(frgb, 52, 69, 94, 6) || LIB.rgbClose(frgb, 68, 86, 104, 6) || LIB.rgbClose(frgb, 52, 73, 99, 6)) && effOp <= 90)) {
                        darkVotes += 3;
                    } else if ((LIB.rgbClose(frgb, 195, 210, 226, 6) || LIB.rgbClose(frgb, 208, 223, 234, 6) ||
                                LIB.rgbClose(frgb, 221, 229, 237, 6) || LIB.rgbClose(frgb, 186, 196, 211, 6)) && effOp >= 85) {
                        lightVotes += 3;
                    } else if (frgb.r >= 242 && frgb.g >= 242 && frgb.b >= 242) {
                        // 纯白底/高光：深色模式下常为 8%~20% 微透，浅色模式下为实色 >= 85%
                        if (effOp <= 35) darkVotes += 2;
                        else if (effOp >= 85) lightVotes += 1;
                    } else {
                        // 通用视觉明度投票（支持任意新方块）
                        if (fLum < 120) {
                            darkVotes += 1;
                        } else if (fLum >= 145 && effOp >= 80) {
                            lightVotes += 1;
                        } else if (effOp <= 40 && fLum >= 145) {
                            darkVotes += 1;
                        }
                    }
                }
            }

            if (it.stroked) {
                var srgb = LIB.normalizeColor(it.strokeColor);
                if (srgb && !LIB.isProtectedEngineeringColor(srgb)) {
                    var sLum = LIB.getLuminance(srgb.r, srgb.g, srgb.b);
                    if (LIB.rgbClose(srgb, 209, 215, 222, 10)) {
                        if (effOp <= 50) darkVotes += 1;
                        else if (effOp >= 85) lightVotes += 1;
                    } else if (LIB.rgbClose(srgb, 79, 83, 107, 8) || LIB.rgbClose(srgb, 83, 95, 109, 8)) {
                        darkVotes += 2;
                    } else if (srgb.r >= 242 && srgb.g >= 242 && srgb.b >= 242 && effOp >= 80) {
                        lightVotes += 1;
                    } else if (sLum < 115) {
                        darkVotes += 1;
                    } else if (sLum >= 165 && effOp >= 80) {
                        lightVotes += 1;
                    }
                }
            }
        }
    }

    function sampleLayer(lyr, parentOpacityFactor) {
        if (sampled >= MAX_SAMPLES || !lyr || !lyr.visible) return;
        if (LIB.isCADOrProtectedContainer(lyr)) {
            skippedCadContainers++;
            return;
        }
        var effFactor = parentOpacityFactor;

        // 优先抽样直接子项
        try {
            var items = lyr.pageItems;
            var len = items.length;
            var step = (len > 30) ? Math.max(1, Math.floor(len / 15)) : 1;
            for (var i = 0; i < len && sampled < MAX_SAMPLES; i += step) {
                sampleItem(items[i], effFactor);
            }
        } catch(e) {}

        // 递归所有可见子图层
        try {
            for (var s = 0; s < lyr.layers.length && sampled < MAX_SAMPLES; s++) {
                sampleLayer(lyr.layers[s], effFactor);
            }
        } catch(e2) {}
    }

    for (var l = 0; l < doc.layers.length && sampled < MAX_SAMPLES; l++) {
        sampleLayer(doc.layers[l], 1.0);
    }

    var totalVotes = darkVotes + lightVotes;
    var currentTheme = "unknown";
    var recommendTarget = "dark";
    var confidence = 0;

    if (totalVotes > 0) {
        if (darkVotes > lightVotes) {
            currentTheme = "dark";
            recommendTarget = "light";
            confidence = (darkVotes / totalVotes) * 100;
        } else if (lightVotes > darkVotes) {
            currentTheme = "light";
            recommendTarget = "dark";
            confidence = (lightVotes / totalVotes) * 100;
        } else {
            currentTheme = "mixed";
            recommendTarget = "dark";
            confidence = 50;
        }
    }

    return '{"doc_name":"' + LIB.jsonEscape(doc.name) +
           '","current_theme":"' + currentTheme +
           '","confidence":"' + confidence.toFixed(1) + '%' +
           '","confidence_num":' + confidence.toFixed(1) +
           ',"recommend_target":"' + recommendTarget +
           '","sampled_count":' + sampled +
           ',"skipped_cad_containers":' + skippedCadContainers +
           ',"dark_votes":' + darkVotes +
           ',"light_votes":' + lightVotes + '}';
})();
