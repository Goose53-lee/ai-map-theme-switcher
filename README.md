# ai-map-theme-switcher

Adobe Illustrator 矢量地图双向深浅色主题极速切换 Skill（支持直接通过 Git 仓库安装到 NewMax / Claude Code）。

## 这东西拿来干什么

给 Adobe Illustrator 里的矢量地图做深浅色双版切换。先画完浅色底图，叫一声就翻出深色版；反过来从深往浅翻，或者让它自己认出当前底色反手切换，都行。只动填色、描边、线宽和透明度，图形轮廓和坐标丝毫不动。

## 为什么非做这个 Skill 不可

平时的画图流程，常常是先用 Illustrator 做出一版浅色地图，紧接着就得出一版配色对应的深色地图。以前全靠人手改，麻烦就卡在两处。

头一处是怕对不上。深浅两版地图的尺寸和位置必须严丝合缝，可人手在画布里挨个选颜色、点编组，鼠标一抖就容易误拖、误删或者拉变形，等两张图叠在一起才发现位置错开了。

第二处是纯耗工夫。港口、堆场地图动辄三万多条路径，图层套着子图层，里面还混着几万条不能碰的 CAD 工程线，再夹杂 RGB、CMYK 和父级透明度。拿“选择相同外观”一遍遍点选、核对、避开工程线，全是枯燥又磨人的重复活。把这套规则做成 Skill，就是为了保住图元绝对不错位，顺手把人从这套繁琐无聊的体力活里摘出来。

## 它真正解了哪几件事

- **尺寸位置零错位**：脚本只读写颜色与透明度属性，不碰任何锚点、路径和编组坐标。改出来的深浅两版叠在一起，像素级对齐。
- **整张大图几秒收工**：引擎用三层拦截直接绕开几万条 CAD 工程线，递归穿透所有可见图层与子图层，先拍平父级透明度再按 1109 规范精确换色；连色板外的新增色块也能按面积和明度自动跟上，同时锁死 `X-Ray` 设备和工程线不被误伤。
- **原稿兜底、不乱涂抹**：首次运行自动留一份 `*_备份.ai` 原稿，后面不再覆盖；已经开着的文档直接切过去处理，不重复开关；测出九成以上已经是目标主题就自动收手，防止反复改色把图改花。

## 一键安装为 NewMax Skill

在 NewMax 对话中直接发送仓库地址并要求安装：

> 安装这个 Skill：https://github.com/Goose53-lee/ai-map-theme-switcher

或手动克隆到全局 Skill 目录：

```bash
git clone https://github.com/Goose53-lee/ai-map-theme-switcher.git ~/.newmax/skills/ai-map-theme-switcher
chmod +x ~/.newmax/skills/ai-map-theme-switcher/scripts/run_switch.sh
```

## 仓库结构（标准 Skill 布局）

```text
ai-map-theme-switcher/
├── SKILL.md                       # Skill 元数据、触发词与执行规范
├── scripts/
│   ├── run_switch.sh              # 统一调度脚本（备份、文件锁、AppleScript 会话与幂等早停）
│   ├── palette_constants.jsx      # 调色板单例、跨色域归一化、自适应映射与三层 CAD 短路引擎
│   ├── ensure_document.jsx        # 物理路径标准化匹配并置顶激活
│   ├── detect_current_theme.jsx   # 全可见层视觉明度投票探测
│   ├── unified_theme_switch.jsx   # 单遍全层穿透与基于展示效果双向换色
│   └── verify_and_save.jsx        # 同口径残余审计与无损保存
├── references/
│   └── palette-spec.md            # 1109 对偶双向色彩映射表与不可变图元规则
├── LICENSE
└── README.md
```

## 运行环境

- macOS
- Adobe Illustrator（通过 AppleScript `do javascript` 调用 ExtendScript）

## 命令行单独调用

```bash
# 自动探测当前激活文档并切换为相反主题
./scripts/run_switch.sh auto

# 将指定浅色地图转为深色（自动创建 *_备份.ai）
./scripts/run_switch.sh dark "/path/to/map.ai"

# 强制重扫指定文件为浅色（跳过幂等早停）
./scripts/run_switch.sh light "/path/to/map.ai" --force
```
