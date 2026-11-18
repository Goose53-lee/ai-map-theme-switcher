#target illustrator
// verify_and_save.jsx
// 全可见图层双向视觉残留审计与安全落盘
// 严格复用 MAP_LIB（隐藏项跳过、三层 CAD 短路、固定设备保护），彻底杜绝假残留触发重试死循环

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

    var residualCount = 0;
    var targetMatchCount = 0;
    var checkedCount = 0;
    var skippedCadContainers = 0;

    function checkItem(it, semantic, parentOpacityFactor) {
        if (!it || it.hidden) return;
        var t = it.typename;
        var ownOp = (typeof it.opacity === "number") ? it.opacity : 100;
        var effFactor = parentOpacityFactor * (ownOp / 100);
        var effOp = Math.round(effFactor * 100);

        var curSemantic = LIB.checkSemanticName(it.name);
        if (curSemantic === "unknown" || curSemantic === "general") {
            curSemantic = semantic;
        }

        if (t === "GroupItem") {
            if (LIB.isCADOrProtectedContainer(it)) {
                skippedCadContainers++;
                return;
            }
            var items = it.pageItems;
            for (var i = 0; i < items.length; i++) {
                checkItem(items[i], curSemantic, effFactor);
            }
        } else if (t === "CompoundPathItem") {
            var paths = it.pathItems;
            for (var c = 0; c < paths.length; c++) {
                checkItem(paths[c], curSemantic, effFactor);
            }
        } else if (t === "PathItem") {
            // 第三层：单体 CAD 路径跳过
            if (!it.filled && it.stroked) {
                var srgbPre = LIB.normalizeColor(it.strokeColor);
                if (LIB.isProtectedEngineeringColor(srgbPre)) return;
                if (!it.closed && it.strokeWidth <= 0.35 && !LIB.isMapRoadNeutralStroke(srgbPre) &&
                    !LIB.rgbClose(srgbPre, 196, 151, 78, 12) && !LIB.rgbClose(srgbPre, 170, 121, 24, 12)) {
                    return;
                }
            }

            checkedCount++;

            if (it.filled) {
                var frgb = LIB.normalizeColor(it.fillColor);
                if (frgb && !LIB.isProtectedEngineeringColor(frgb) && !LIB.isFixedEquipmentFill(frgb, it, curSemantic)) {
                    var fLum = LIB.getLuminance(frgb.r, frgb.g, frgb.b);
                    if (isDark) {
                        // 目标深色：若仍为中高明度实色且非纯白微透（>= 105 且有效透明度 > 85，且非极白微透），计为残留
                        if (frgb.r >= 245 && frgb.g >= 245 && frgb.b >= 245) {
                            if (effOp > 50) residualCount++;
                            else targetMatchCount++;
                        } else if (fLum >= 105 && effOp > 85 && !LIB.rgbClose(frgb, 100, 123, 145, 6)) {
                            residualCount++;
                        } else if (LIB.rgbClose(frgb, 52, 69, 94, 6) || LIB.rgbClose(frgb, 68, 86, 104, 6) ||
                                   LIB.rgbClose(frgb, 25, 31, 53, 6) || LIB.rgbClose(frgb, 52, 73, 99, 6)) {
                            targetMatchCount++;
                        }
                    } else {
                        // 目标浅色：若仍为暗调或非纯白微透（fLum < 135 或 effOp < 90），计为残留
                        if (fLum < 135 || (effOp < 90 && !(frgb.r >= 245 && frgb.g >= 245 && frgb.b >= 245))) {
                            residualCount++;
                        } else if (LIB.rgbClose(frgb, 195, 210, 226, 6) || LIB.rgbClose(frgb, 208, 223, 234, 6) ||
                                   LIB.rgbClose(frgb, 221, 229, 237, 6) || LIB.rgbClose(frgb, 186, 196, 211, 6)) {
                            targetMatchCount++;
                        }
                    }
                }
            }

            if (it.stroked && !it.filled) {
                var srgb = LIB.normalizeColor(it.strokeColor);
                if (srgb && !LIB.isProtectedEngineeringColor(srgb)) {
                    if (LIB.rgbClose(srgb, 209, 215, 222, 10)) {
                        if (isDark && effOp > 50) residualCount++;
                        else if (!isDark && effOp < 80) residualCount++;
                        else targetMatchCount++;
                    } else if (!LIB.rgbClose(srgb, 196, 151, 78, 12) && !LIB.rgbClose(srgb, 170, 121, 24, 12)) {
                        var sLum = LIB.getLuminance(srgb.r, srgb.g, srgb.b);
                        if (isDark && sLum >= 150) residualCount++;
                        else if (!isDark && sLum < 120) residualCount++;
                    }
                }
            }
        }
    }

    function checkLayer(lyr, parentSemantic) {
        if (!lyr || !lyr.visible) return;
        if (LIB.isCADOrProtectedContainer(lyr)) {
            skippedCadContainers++;
            return;
        }
        var lyrSem = LIB.checkSemanticName(lyr.name);
        if (lyrSem === "unknown" || lyrSem === "general") {
            lyrSem = parentSemantic;
        }
        var items = lyr.pageItems;
        for (var p = 0; p < items.length; p++) {
            checkItem(items[p], lyrSem, 1.0);
        }
        var subs = lyr.layers;
        for (var s = 0; s < subs.length; s++) {
            checkLayer(subs[s], lyrSem);
        }
    }

    for (var l = 0; l < doc.layers.length; l++) {
        checkLayer(doc.layers[l], "general");
    }

    // 仅在文档有未保存修改或普通保存时执行 doc.save()
    var saveOk = false;
    var saveErr = "";
    try {
        doc.save();
        saveOk = true;
    } catch(err) {
        saveErr = LIB.jsonEscape(err.toString());
    }

    var elapsed = new Date().getTime() - t0;
    return '{"status":"ok","verify":true,"target_theme":"' + targetTheme +
           '","checked_count":' + checkedCount +
           ',"skipped_cad_containers":' + skippedCadContainers +
           ',"residual_count":' + residualCount +
           ',"target_matches":' + targetMatchCount +
           ',"saved":' + saveOk +
           ',"save_error":"' + saveErr +
           '","elapsed_ms":' + elapsed + '}';
})();
