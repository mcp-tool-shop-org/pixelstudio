<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="assets/logo.png" alt="GlyphStudio" width="400" />
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/glyphstudio/actions"><img src="https://img.shields.io/github/actions/workflow/status/mcp-tool-shop-org/glyphstudio/ci.yml?branch=main&style=flat-square&label=CI" alt="CI"></a>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-informational?style=flat-square" alt="Platforms">
  <img src="https://img.shields.io/badge/tauri-v2-orange?style=flat-square" alt="Tauri v2">
  <img src="https://img.shields.io/badge/tests-2776%20passing-brightgreen?style=flat-square" alt="Tests">
  <a href="https://mcp-tool-shop-org.github.io/glyphstudio/"><img src="https://img.shields.io/badge/Landing_Page-live-blue?style=flat-square" alt="Landing Page"></a>
</p>

GlyphStudio是一款专为像素级编辑、逐帧动画和未来运动辅助而设计的精灵素材制作工具。

GlyphStudio是一款桌面应用程序，使用**Tauri v2**、**React**和**Rust**构建。它的设计理念是：编辑器应始终控制美术作品，自动化功能应始终服从于艺术家。

## 当前状态

GlyphStudio是一款可用的桌面编辑器，包含32个已完成的阶段，并已通过2776个测试。

### 画布编辑器（Rust后端）
- 具有最近邻插值渲染的确定性像素画布
- 具有可见性、锁定、不透明度、重命名、重新排序功能的图层
- 基于笔画的绘图，支持撤销/重做
- 矩形选择、剪贴板操作和变换工作流程
- 多帧时间轴，支持每个帧的独立撤销/重做
- 邻近帧编辑的透明图层叠加
- 具有帧速率（FPS）和循环功能的播放控制
- 具有确定性建议生成的运动辅助功能
- 具有层级关系、衰减和辅助运动模板的锚点系统
- 具有批量应用于帧的运动预设
- 具有关键点、标签和验证的裁剪定义
- 具有清单（原生和通用运行时格式）的精灵图导出
- 具有缩略图、搜索和打包功能的资源目录
- 项目保存/加载、自动保存恢复以及模式迁移

### 场景合成器（前端 + Rust）
- 具有资源实例、Z轴顺序、可见性、不透明度和视差的场景合成
- 具有平移、缩放、关键帧动画和镜头衍生的相机系统
- 具有插槽、预设、验证和场景桥接的角色构建系统
- 具有完整快照历史记录和同步失败时的回滚的场景撤销/重做
- 具有可深入检查的20种操作类型的持久化溯源信息
- 场景比较和恢复预览工作流程

### 精灵编辑器（仅前端）
- 自包含的像素编辑器，具有铅笔、橡皮擦、填充、取色器工具
- 多图层编辑，支持每个图层的可见性、重命名和重新排序
- 实时草图预览的透明图层合成，适用于多图层精灵编辑
- 帧管理，具有透明图层、播放、滑块和每个帧的持续时间功能
- 矩形选择，支持复制/剪切/粘贴/删除
- 支持多图层扁平化的精灵图导入/导出
- 调色板面板，具有颜色选择器和前景/背景交换功能

这并非一个浏览器小工具或提示生成器。它是一个原生的桌面编辑器，其中Rust负责画布像素的真实性，而前端负责精灵像素的真实性。

## 产品理念

GlyphStudio围绕四个原则构建：

1. **确定性编辑**
每个像素的修改都应遵循规则、可检查且可逆。

2. **辅助型人工智能**
自动化应辅助工作流程，而不能取代创造性控制。

3. **以动画为核心的结构**
帧、时间轴操作、透明图层和播放是核心的编辑器概念，而不是事后添加的功能。

4. **可靠的状态**
保存/加载、自动保存、恢复、撤销/重做和迁移被视为产品功能，而不是清理工作。

## 架构

### 前端（React + TypeScript）
- 17多个按领域组织的Zustand状态管理
- 用于两个编辑器的HTML画布渲染器
- 画布编辑器UI：图层、时间轴、选择、播放、角色构建器、场景合成器
- 精灵编辑器：具有前端拥有像素缓冲区的自包含像素编辑功能
- 通过`flattenLayers`实现的透明图层合成，用于多图层精灵编辑

### 后端（Rust）
- 具有权威像素缓冲区和图层合成功能的画布编辑器
- 带有前后补丁的笔触操作
- 选择/变换操作
- 项目持久化、自动保存、崩溃恢复
- 导出流水线（PNG、精灵图、裁剪、打包）
- 带有摄像机和播放功能的场景合成引擎
- 带有缩略图生成的资源目录
- 实现了 166 个 Tauri 命令

### 桌面 Shell
- Tauri v2

## 单仓库结构

```text
glyphstudio/
  apps/desktop/
    src/
    src-tauri/
  packages/
    domain/
    api-contract/
    state/
  site/
```

## 已实现的阶段

### 阶段 1–3 — 编辑器基础
画布、图层、绘图工具、撤销/重做、选择、变换、时间轴、洋葱皮效果、播放、帧操作、PNG/序列帧导出、项目持久化、自动保存、崩溃恢复。

### 阶段 4A — 运动辅助
受限的运动操作、确定性的提案生成、带有迷你序列帧预览、操作安全、提案提交到时间轴。

### 阶段 5–8 — 运动优化
带有层级和衰减的锚点、辅助运动模板（风、摆动、摇摆、沙沙声）、带有分析指标的运动沙箱、带有批量应用的运动预设。

### 阶段 9–10 — 裁剪、导出、场景基础
带有中心点/标签/验证的裁剪定义、带有清单的精灵图导出、带有缩略图的资源目录、打包、带有实例和 Z 顺序的场景合成。

### 阶段 11–14 — 角色系统
带有 12 个身体区域插槽的角色构建、带有兼容性等级的预设选择器、构建验证、带有持久化的角色构建库、角色到场景的桥接，带有快照放置。

### 阶段 15–16 — 场景编辑
带有平移/缩放的场景摄像机、带有插值的摄像机关键帧、带有完整快照历史的场景撤销/重做、在后端同步失败时回滚。

### 阶段 17–24 — 溯源与检查
带有 20 种操作类型的持久化场景溯源、带有捕获前后片段的深入检查、结构化的值摘要、场景比较引擎、恢复预览工作流程。

### 阶段 25–26 — 恢复与选择性恢复
带有纯推导的场景恢复协议、按域的选择性恢复（实例、摄像机、关键帧、播放）、通过合法的接口进行播放配置，并支持撤销/重做。

### 阶段 27–28 — 精灵编辑器
仅前端的精灵编辑器：文档协议、带有铅笔/橡皮擦/填充/取样器的像素画布、带有洋葱皮效果的帧、带有剪贴板的选择、精灵图导入/导出、键盘快捷键、缩放/网格、调色板面板。

### 阶段 29 — 动画预览
动画播放器协议、带有滑块和空格快捷键的播放 UI、带有预设的内联帧持续时间编辑、播放期间抑制洋葱皮效果。

### 阶段 30 — 图层和图层工作流程
SpriteLayer 类型、基于 layerId 的像素缓冲区、扁平化图层 alpha 合成、跟踪 activeLayerId、带有 CRUD/可见性/重命名/重新排序的图层面板、所有可见图层上的草稿笔触合成、多图层导出。

## 运行应用程序

### 先决条件
- Node.js 20+
- pnpm 9+
- Rust 1.75+ (通过 [rustup](https://rustup.rs/))
- 适用于您平台的 Tauri v2 的先决条件

### 安装

```bash
pnpm install
```

### 运行桌面应用程序

```bash
pnpm dev
```

### 类型检查

```bash
pnpm typecheck
```

### Rust 检查

```bash
cd apps/desktop/src-tauri
cargo check
```

## 导出支持

### 画布编辑器 (Rust)
- **当前帧 PNG** — 单个合成图像
- **PNG 序列** — 编号的文件（name_0001.png, name_0002.png, ...）
- **精灵图条** — 水平或垂直的单张图像条
- **剪辑表** — 从剪辑定义生成的精灵图表，可选包含清单文件
- **所有剪辑表** — 包含所有有效剪辑的合并表
- **资源包** — 包含图像、清单文件和预览缩略图的文件夹或 ZIP 文件
- **目录包** — 多资源打包，每个资源包含子文件夹

### 精灵编辑器（前端）
- **精灵图条** — 水平条，包含所有可见图层，每个帧都已合并
- **当前帧** — 可见图层的合并视图

导出时仅使用合并的可视图层。透明叠加、播放状态和临时的编辑器覆盖层不包含在输出中。

## 文档

请参阅[手册](site/src/content/docs/handbook/)以获取更详细的信息：

- [入门](site/src/content/docs/handbook/getting-started.md)
- [架构](site/src/content/docs/handbook/architecture.md)
- [API 参考](site/src/content/docs/handbook/reference.md)

## 路线图

近期优先级：

- 具有约束规则和渐变编辑功能的索引调色板模式
- AI 辅助集成（本地 Ollama + ComfyUI，用于受限的生成任务）
- 运动分析工作区，带有步幅/接触/重心叠加
- 验证引擎，包含修复操作

## 不属于目标范围

GlyphStudio 的目标不是：

- 一个通用的图像编辑器
- 一个以浏览器为优先的简单应用
- 一个猜测艺术风格的 AI 提示包装器
- 一个前端状态和后端真实数据容易分离的画布

## 安全性

GlyphStudio 是一款**仅限桌面**应用程序。它不进行网络请求，不收集遥测数据，也不处理敏感信息。

- **访问数据：** 本地精灵文件（.glyph, .pxs, .png），应用程序数据目录中的自动保存/恢复文件
- **不访问数据：** 无网络，无云，无远程 API，无用户帐户
- **权限：** 文件系统访问范围限制在用户选择的目录，通过 Tauri v2 原生文件对话框实现
- **不收集或发送任何遥测数据**

请参阅[SECURITY.md](SECURITY.md)以报告漏洞。

## 许可证

[MIT](LICENSE)

---

由 <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a> 构建。
