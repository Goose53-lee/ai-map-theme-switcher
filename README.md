# ai-map-theme-switcher

Adobe Illustrator 矢量地图双向深浅色主题极速切换 Skill（支持直接通过 Git 仓库安装到 NewMax / Claude Code）。

![Adobe Illustrator 矢量地图深浅色切换示意图](./assets/map-theme-flip.png)

## 这东西拿来干什么

给 Adobe Illustrator 里的矢量地图做深浅色双版一键切换。

平时画完浅色底图，叫一声就能直接翻出对应的深色版；反过来从深色还原回浅色，或者不用管当前是哪一版、让它自己认出底色反手切换，都行。过程中只动填色、描边、线宽和透明度，图形轮廓和坐标丝毫不动。

## 为什么会做这个工具

在WESTWELL画港口、堆场这些业务地图的时候，每次交付通常都要出浅色、深色两套图：先在 Illustrator 里磨出一版浅色底图，紧接着再照着规范改出一版深色。以前全靠人手改，干久了发现真正卡住效率的，主要是两件挺磨人的事：

**1. 怕改错位，返工成本高**
深浅两版地图的尺寸、坐标和轮廓必须严丝合缝，叠在一起不能有任何偏移。可手动在画布里一层层找颜色、点编组，鼠标稍微一抖就容易误拖、删错或者把路径拉变形；有时候画的时候没察觉，等两张图叠起来对位才发现错开了，回头排查非常费神。

**2. 图层太重，纯手工全是重复体力活**
一张港口或堆场地图，动辄两三万条路径，主图层里套着子图层，里面还混着大量不能碰的 CAD 工程线，颜色也常常同时夹杂着 RGB、CMYK 和父级透明度。每次拿“选择相同外观”一遍遍点选、核对、避开工程线，半天时间全耗在这种既枯燥又容易手滑的重复操作上。

后来我就琢磨，既然配色规范和保留规则本身是确定的，那这套机械劳动其实完全不该让人来扛。于是我把平时画图踩过的坑和积累的规范拆开梳理了一遍，做成了这个 Skill——核心想法很简单：**把图形位置和尺寸死死锁住不动，把繁琐又易错的批量换色全部交给脚本自动跑完。**

## 做这个工具时我重点抠了哪几个细节

真正写脚本去跑真实项目地图的时候，才发现远不是“把 A 颜色换成 B 颜色”这么简单，后面陆陆续续踩坑、优化了好几轮，才把体验打磨顺滑：

- **只改外观属性，保住像素级对齐**：从头到尾只读写 `fillColor`、`strokeColor`、`strokeWidth` 和 `opacity`，绝不碰锚点、路径坐标和编组结构。改完后的深浅两版叠在一起，边界严丝合缝，彻底免掉“改完色还要重新对位”的心智负担。
- **绕开“图层名依赖”，按实际视觉效果去换**：最初图省事按图层名（比如“箱子”“路”）去匹配，结果一遇到新画的图命名不规范、或者子图层嵌套太深（Illustrator 的 `pageItems` 默认不穿透 `Sublayers`），就会漏换。后来干脆推翻重来，改成全可见层递归穿透，先把 RGB/CMYK/Gray/Spot 统一转成等效色彩、把父容器透明度拍平算准真实显示效果，再优先对照 1109 规范精确换色；遇到规范外新加的色块，就按面积占比和感知明度自动算出对应深浅色。
- **三层短路跳过几万条 CAD 工程线，把耗时压到几秒钟**：真实地图里真正卡死脚本的往往是密密麻麻的 CAD 辅助线，全量读一遍内存直接飙高、AI 跟着假死。后来在引擎里加了三层拦截——先按容器名关键词秒跳过，再对未命名分组做首/中/尾抽样指纹判定，最后在主循环最前面拦截散落工程线和 `X-Ray` 检测设备，3 万+ 路径的复杂大图也能在 3～5 秒内跑完。
- **防呆与兜底机制**：为了防止平时顺手点错把原稿覆盖了，首次运行会自动存一份 `*_备份.ai`（已存在时绝不二次覆盖）；文档已经在 Illustrator 里开着就直接切过去改，不重复开关文件；脚本跑之前先给当前画面做一次明度投票，确认九成以上已经是目标主题就直接早停，避免反复跑脚本把半透明图层越涂越乱。

## 一键安装为  Skill

在 Agent 对话中直接发送仓库地址并要求安装：

> 安装这个 Skill：https://github.com/Goose53-lee/ai-map-theme-switcher

或手动克隆到全局 Skill 目录：

```bash
git clone https://github.com/Goose53-lee/ai-map-theme-switcher.git ~/.newmax/skills/ai-map-theme-switcher
chmod +x ~/.newmax/skills/ai-map-theme-switcher/scripts/run_switch.sh
```

## 仓库结构（标准 Skill 布局）

```text
ai-map-theme-switcher/
├── assets/
│   └── map-theme-flip.png         # 工作原理示意图
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
