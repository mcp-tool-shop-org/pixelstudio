<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="../../assets/logo.png" alt="GlyphStudio MCP Server" width="400" />
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/glyphstudio/actions"><img src="https://img.shields.io/github/actions/workflow/status/mcp-tool-shop-org/glyphstudio/ci.yml?branch=main&style=flat-square&label=CI" alt="CI"></a>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/MCP-53%20tools-blueviolet?style=flat-square" alt="53 MCP Tools">
  <img src="https://img.shields.io/badge/tests-100%20passing-brightgreen?style=flat-square" alt="Tests">
</p>

# @glyphstudio/mcp-sprite-server

一个 MCP 服务器，它将 GlyphStudio 完整的精灵编辑器暴露为一个可编程的表面，供大型语言模型 (LLM) 使用。您可以创建文档、绘制像素、管理帧和图层、控制播放——所有这些都通过 [Model Context Protocol](https://modelcontextprotocol.io/) 工具实现，这些工具调用真实的领域和状态逻辑。它没有重新实现的栅格图像处理，也没有虚构的平行宇宙。

## 为什么？

大型语言模型可以描述精灵，但无法绘制它们。这个服务器弥补了这一差距：一个代理调用 `sprite_draw_pixels` 函数，提供坐标和颜色，而 GlyphStudio 引擎会将这些信息应用到真实的像素缓冲区，并支持撤销、图层和帧隔离。结果是一个 `.glyph` 文件，您可以在桌面编辑器中打开它，并继续手动进行编辑。

## 快速入门

### Claude Desktop / Claude Code

将以下内容添加到您的 MCP 配置文件 (`claude_desktop_config.json` 或 `.mcp.json`):

```json
{
  "mcpServers": {
    "glyphstudio": {
      "command": "npx",
      "args": ["tsx", "packages/mcp-sprite-server/src/cli.ts"],
      "cwd": "/path/to/glyphstudio"
    }
  }
}
```

### stdio (直接)

```bash
npx tsx packages/mcp-sprite-server/src/cli.ts
```

## 工具清单 (53 个工具)

### 会话 (3)

| 工具 | 描述 |
|------|-------------|
| `sprite_session_new` | 创建一个新的编辑会话 |
| `sprite_session_list` | 列出当前活动会话 |
| `sprite_session_close` | 销毁一个会话并释放其存储空间 |

### 文档 (5)

| 工具 | 描述 |
|------|-------------|
| `sprite_document_new` | 创建一个空白文档 (名称、宽度、高度) |
| `sprite_document_open` | 从 JSON 加载 `.glyph` 文件 |
| `sprite_document_save` | 将文档序列化为 `.glyph` JSON 格式 |
| `sprite_document_close` | 关闭文档，但不销毁会话 |
| `sprite_document_summary` | 获取文档的结构化摘要 (帧、图层、尺寸) |

### 帧 (4)

| 工具 | 描述 |
|------|-------------|
| `sprite_frame_add` | 在当前帧之后添加一个新的帧 |
| `sprite_frame_remove` | 通过 ID 移除一个帧 |
| `sprite_frame_set_active` | 通过索引设置当前活动帧 |
| `sprite_frame_set_duration` | 设置帧的持续时间（毫秒） |

### 图层 (5)

| 工具 | 描述 |
|------|-------------|
| `sprite_layer_add` | 在当前帧中添加一个新的图层 |
| `sprite_layer_remove` | 通过 ID 移除一个图层 |
| `sprite_layer_set_active` | 设置用于绘制的当前活动图层 |
| `sprite_layer_toggle_visibility` | 切换图层的可见性 |
| `sprite_layer_rename` | 重命名一个图层 |

### 调色板 (4)

| 工具 | 描述 |
|------|-------------|
| `sprite_palette_set_foreground` | 设置前景色索引 |
| `sprite_palette_set_background` | 设置背景色索引 |
| `sprite_palette_swap` | 交换前景色和背景色 |
| `sprite_palette_list` | 列出所有调色板颜色及其 RGBA 值 |

### 绘图 / 栅格 (5)

| 工具 | 描述 |
|------|-------------|
| `sprite_draw_pixels` | 批量绘制像素 — `[{x, y, rgba}]` 数组，创建一个缓冲区副本 |
| `sprite_draw_line` | 绘制两点之间的布莱森汉姆线 |
| `sprite_fill` | 从种子像素进行连续区域填充 |
| `sprite_erase_pixels` | 批量擦除像素，使其变为透明 |
| `sprite_sample_pixel` | 读取指定坐标处的像素 RGBA 值（不进行修改） |

### 选择 / 剪贴板 (9)

| 工具 | 描述 |
|------|-------------|
| `sprite_selection_set_rect` | 创建一个矩形选择区域 |
| `sprite_selection_clear` | 清除选择区域（像素不变） |
| `sprite_selection_get` | 获取当前选择区域的矩形和尺寸 |
| `sprite_selection_copy` | 将选择区域复制到剪贴板 |
| `sprite_selection_cut` | 剪切选择区域（复制像素后再清除） |
| `sprite_selection_paste` | 将剪贴板内容粘贴为浮动选择区域，位置为 (0,0) |
| `sprite_selection_flip_horizontal` | 水平翻转选择区域内容 |
| `sprite_selection_flip_vertical` | 垂直翻转选择区域内容 |
| `sprite_selection_commit` | 将浮动选择区域覆盖到当前活动图层 |

### 工具设置 (10)

| 工具 | 描述 |
|------|-------------|
| `sprite_tool_set` | 切换工具 (铅笔 / 橡皮擦 / 填充 / 滴管 / 选择) |
| `sprite_tool_get` | 获取当前工具的配置 |
| `sprite_tool_set_brush_size` | 设置笔刷直径 (1–64) |
| `sprite_tool_set_brush_shape` | 设置笔刷形状 (方形 / 圆形) |
| `sprite_tool_set_pixel_perfect` | 切换像素级精确绘制模式 |
| `sprite_onion_set` | 配置骨骼动画 (启用、前/后帧数、透明度) |
| `sprite_onion_get` | 获取当前骨骼动画配置 |
| `sprite_canvas_set_zoom` | 设置缩放级别 (1–64) |
| `sprite_canvas_set_pan` | 设置平移偏移量 |
| `sprite_canvas_reset_view` | 重置为默认缩放和平移 |

### 播放 — 预设配置 (2)

| 工具 | 描述 |
|------|-------------|
| `sprite_playback_get_config` | 获取循环设置和每个帧的持续时间 |
| `sprite_playback_set_config` | 设置循环模式 (保存在文档中) |

### 播放 — 瞬时预览 (6)

| 工具 | 描述 |
|------|-------------|
| `sprite_preview_play` | 开始动画预览 |
| `sprite_preview_stop` | 停止动画预览 |
| `sprite_preview_get_state` | 获取预览状态（播放中、帧索引、循环） |
| `sprite_preview_set_frame` | 跳转到指定帧索引 |
| `sprite_preview_step_next` | 前进一帧 |
| `sprite_preview_step_prev` | 后退一帧 |

## 资源

| URI 模式 | 描述 |
|-------------|-------------|
| `sprite://session/{id}/document` | 完整文档摘要（帧数、图层、尺寸、调色板） |
| `sprite://session/{id}/state` | 精简会话状态（工具、选择、播放、预览、脏标志） |

## 结果形状

每个工具都返回一个一致的 JSON 结构：

```jsonc
// Success — shape varies per tool
{ "ok": true, "sessionId": "session_1" }
{ "ok": true, "bounds": { "minX": 0, "minY": 0, "maxX": 7, "maxY": 0, "pixelCount": 8 } }

// Error — always code + message
{ "ok": false, "code": "no_document", "message": "No document open" }
{ "ok": false, "code": "out_of_bounds", "message": "Pixel (20, 5) outside 16×16 canvas" }
```

错误代码：`no_session`、`no_document`、`no_frame`、`no_layer`、`no_selection`、`out_of_bounds`、`invalid_input`、`empty_clipboard`。

## 示例：创建 2 帧精灵

```text
1. sprite_session_new
   → { ok: true, sessionId: "session_1" }

2. sprite_document_new { sessionId: "session_1", name: "Hero", width: 16, height: 16 }
   → { ok: true, documentId: "...", frameCount: 1, layerCount: 1 }

3. sprite_draw_pixels { sessionId: "session_1", pixels: [
     { x: 7, y: 0, rgba: [255, 0, 0, 255] },
     { x: 8, y: 0, rgba: [255, 0, 0, 255] },
     { x: 7, y: 1, rgba: [200, 0, 0, 255] },
     { x: 8, y: 1, rgba: [200, 0, 0, 255] }
   ]}
   → { ok: true, bounds: { minX: 7, minY: 0, maxX: 8, maxY: 1, pixelCount: 4 } }

4. sprite_fill { sessionId: "session_1", x: 7, y: 8, rgba: [0, 100, 200, 255] }
   → { ok: true, filled: 42 }

5. sprite_frame_add { sessionId: "session_1" }
   → { ok: true, frameId: "...", frameCount: 2, activeFrameIndex: 1 }

6. sprite_draw_line { sessionId: "session_1", x0: 0, y0: 0, x1: 15, y1: 15, rgba: [255, 255, 255, 255] }
   → { ok: true, bounds: { minX: 0, minY: 0, maxX: 15, maxY: 15, pixelCount: 16 } }

7. sprite_playback_set_config { sessionId: "session_1", isLooping: true }
   → { ok: true }

8. sprite_document_save { sessionId: "session_1" }
   → { ok: true, json: "..." }
```

## 设计原则

1. **真实逻辑** — 每个工具都调用 `@glyphstudio/domain` 和 `@glyphstudio/state`。 没有并行光栅实现，没有重新实现的填充算法，没有阴影状态。

2. **批量绘图** — `sprite_draw_pixels` 接受一个 `{x, y, rgba}` 元素的数组。 缓冲区只克隆一次，所有像素都应用到缓冲区，然后提交缓冲区。 仅一次调用，一次状态更新。

3. **作者状态与瞬时状态** — 播放配置（循环、帧持续时间）是持久存储在文档中的作者状态。 预览控件（播放/停止/跳转）是瞬时 UI 状态，不会影响保存的文件。

4. **会话隔离** — 每个会话都拥有独立的无头 Zustand 状态存储实例。 会话之间不能互相看到或干扰。

5. **标准结果形状** — `{ ok: true, ...data }` 或 `{ ok: false, code, message }`。 没有原始异常，没有非结构化字符串。

## 架构

```text
┌─────────────────────────────────────────────┐
│  MCP Client (Claude, etc.)                  │
└──────────────┬──────────────────────────────┘
               │ stdio / JSON-RPC
┌──────────────▼──────────────────────────────┐
│  MCP Server (server.ts)                     │
│  ├─ Tool handlers (53 tools)                │
│  ├─ Resource handlers (2 resources)         │
│  └─ Session manager (multi-session)         │
├─────────────────────────────────────────────┤
│  Store Adapter (storeAdapter.ts)            │
│  Headless Zustand store per session         │
├─────────────────────────────────────────────┤
│  @glyphstudio/state    @glyphstudio/domain  │
│  Raster ops, stores    Types, contracts     │
└─────────────────────────────────────────────┘
```

## 安全性

此服务器在本地通过标准输入/输出运行。 它不进行网络请求，不接受传入连接，也不访问文件，除非客户端明确通过工具调用传递文件内容。

- 默认情况下，**没有网络出站连接**
- **没有遥测数据**
- **没有文件系统访问权限** — 文档以 JSON 字符串的形式进出
- 堆栈跟踪永远不会暴露 — 仅提供结构化的错误结果

有关漏洞报告，请参阅 [SECURITY.md](../../SECURITY.md)。

## 许可证

[MIT](../../LICENSE)

---

由 <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a> 构建。
