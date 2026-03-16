<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

GlyphStudioのスプライトエディターを、LLM（大規模言語モデル）が操作可能なインターフェースとして提供するMCPサーバーです。ドキュメントの作成、ピクセルの描画、フレームとレイヤーの管理、再生制御など、すべて[Model Context Protocol](https://modelcontextprotocol.io/)のツールを通じて行われ、実際のドメインロジックと状態を呼び出します。再実装されたラスター画像や、別の仮想空間は存在しません。

## なぜ

LLMはスプライトを記述できますが、描画することはできません。このサーバーは、そのギャップを埋めます。エージェントが`sprite_draw_pixels`を呼び出し、座標と色を指定すると、GlyphStudioのエンジンが、実際のピクセルバッファに適用します。これにより、アンドゥ機能、レイヤー、フレームの分離が実現されます。結果として得られるのは、デスクトップエディターで開いて、手動で作業を続けることができる`.glyph`ファイルです。

## クイックスタート

### Claude Desktop / Claude Code

MCPの設定ファイル（`claude_desktop_config.json`または`.mcp.json`）に追加します。

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

## ツール一覧 (53ツール)

### セッション (3)

| ツール | 説明 |
|------|-------------|
| `sprite_session_new` | 新しい編集セッションを作成 |
| `sprite_session_list` | アクティブなセッションを一覧表示 |
| `sprite_session_close` | セッションを破棄し、関連するストレージを解放 |

### ドキュメント (5)

| ツール | 説明 |
|------|-------------|
| `sprite_document_new` | 空白のドキュメントを作成 (名前、幅、高さ) |
| `sprite_document_open` | JSONファイルから`.glyph`ファイルを読み込み |
| `sprite_document_save` | ドキュメントを`.glyph`形式のJSONとしてシリアライズ |
| `sprite_document_close` | セッションを破棄せずにドキュメントを閉じる |
| `sprite_document_summary` | 構造化されたドキュメントの概要を取得 (フレーム、レイヤー、寸法) |

### フレーム (4)

| ツール | 説明 |
|------|-------------|
| `sprite_frame_add` | アクティブなフレームの後に新しいフレームを追加 |
| `sprite_frame_remove` | IDでフレームを削除 |
| `sprite_frame_set_active` | インデックスでアクティブなフレームを設定 |
| `sprite_frame_set_duration` | フレームの持続時間をミリ秒で設定 |

### レイヤー (5)

| ツール | 説明 |
|------|-------------|
| `sprite_layer_add` | アクティブなフレームに新しいレイヤーを追加 |
| `sprite_layer_remove` | IDでレイヤーを削除 |
| `sprite_layer_set_active` | 描画に使用するアクティブなレイヤーを設定 |
| `sprite_layer_toggle_visibility` | レイヤーの表示/非表示を切り替え |
| `sprite_layer_rename` | レイヤーの名前を変更 |

### パレット (4)

| ツール | 説明 |
|------|-------------|
| `sprite_palette_set_foreground` | 前景色のインデックスを設定 |
| `sprite_palette_set_background` | 背景色のインデックスを設定 |
| `sprite_palette_swap` | 前景と背景の色を入れ替え |
| `sprite_palette_list` | すべてのパレットの色をRGBA値とともに一覧表示 |

### 描画 / ラスター (5)

| ツール | 説明 |
|------|-------------|
| `sprite_draw_pixels` | ピクセルの一括描画 — `[{x, y, rgba}]`配列、バッファのクローン |
| `sprite_draw_line` | 2点間のブレンハム線 |
| `sprite_fill` | シードピクセルからの連続的な洪水塗り |
| `sprite_erase_pixels` | ピクセルの一括削除 (透明化) |
| `sprite_sample_pixel` | 座標におけるピクセルのRGBA値を読み取る (変更なし) |

### 選択 / クリップボード (9)

| ツール | 説明 |
|------|-------------|
| `sprite_selection_set_rect` | 長方形の選択領域を作成 |
| `sprite_selection_clear` | 選択領域をクリア (ピクセルは変更されない) |
| `sprite_selection_get` | 現在の選択領域の矩形と寸法を取得 |
| `sprite_selection_copy` | 選択領域をクリップボードバッファにコピー |
| `sprite_selection_cut` | 選択領域を切り取り (コピーしてからピクセルをクリア) |
| `sprite_selection_paste` | クリップボードの内容を、(0,0)の位置に浮動選択領域として貼り付け |
| `sprite_selection_flip_horizontal` | 選択領域の内容を水平方向に反転 |
| `sprite_selection_flip_vertical` | 選択領域の内容を垂直方向に反転 |
| `sprite_selection_commit` | 浮動選択領域をアクティブなレイヤーに転写 |

### ツール設定 (10)

| ツール | 説明 |
|------|-------------|
| `sprite_tool_set` | ツールを切り替え (鉛筆 / 消しゴム / 塗りつぶし / アイシードロップ / 選択) |
| `sprite_tool_get` | 現在のツールの設定を取得 |
| `sprite_tool_set_brush_size` | ブラシの直径を設定 (1–64) |
| `sprite_tool_set_brush_shape` | ブラシの形状を設定 (四角形 / 円) |
| `sprite_tool_set_pixel_perfect` | ピクセル単位のストロークモードを切り替え |
| `sprite_onion_set` | オンニスキンを設定 (有効/無効、前/後のピクセル数、透明度) |
| `sprite_onion_get` | 現在のオンニスキン設定を取得 |
| `sprite_canvas_set_zoom` | ズームレベルを設定 (1–64) |
| `sprite_canvas_set_pan` | パンオフセットを設定 |
| `sprite_canvas_reset_view` | デフォルトのズームとパンにリセット |

### 再生 — 構成 (2)

| ツール | 説明 |
|------|-------------|
| `sprite_playback_get_config` | ループ設定と各フレームの持続時間を取得 |
| `sprite_playback_set_config` | ループモードを設定 (ドキュメントに永続化) |

### 再生 — 一時プレビュー (6)

| ツール | 説明 |
|------|-------------|
| `sprite_preview_play` | アニメーションプレビュー開始 |
| `sprite_preview_stop` | アニメーションプレビュー停止 |
| `sprite_preview_get_state` | プレビューの状態を取得 (再生中、フレームインデックス、ループ) |
| `sprite_preview_set_frame` | 特定のフレームインデックスに移動 |
| `sprite_preview_step_next` | 1フレーム進む |
| `sprite_preview_step_prev` | 1フレーム戻る |

## リソース

| URIパターン | 説明 |
|-------------|-------------|
| `sprite://session/{id}/document` | ドキュメント全体の概要 (フレーム数、レイヤー数、寸法、パレット) |
| `sprite://session/{id}/state` | セッションの状態 (ツール、選択、再生、プレビュー、変更フラグ) |

## 結果の形状

すべてのツールは、一貫したJSON形式で結果を返します。

```jsonc
// Success — shape varies per tool
{ "ok": true, "sessionId": "session_1" }
{ "ok": true, "bounds": { "minX": 0, "minY": 0, "maxX": 7, "maxY": 0, "pixelCount": 8 } }

// Error — always code + message
{ "ok": false, "code": "no_document", "message": "No document open" }
{ "ok": false, "code": "out_of_bounds", "message": "Pixel (20, 5) outside 16×16 canvas" }
```

エラーコード: `no_session`, `no_document`, `no_frame`, `no_layer`, `no_selection`, `out_of_bounds`, `invalid_input`, `empty_clipboard`.

## 例: 2フレームのスプライトを作成

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

## 設計原則

1. **実際のロジック** — すべてのツールは `@glyphstudio/domain` と `@glyphstudio/state` を使用します。並列ラスタ処理の実装、再実装された洪水塗りアルゴリズム、シャドウ状態はありません。

2. **バッチ描画** — `sprite_draw_pixels` は、`{x, y, rgba}` のエントリを含む配列を受け取ります。バッファは1回複製され、すべてのピクセルが適用され、その後バッファが確定されます。1回の呼び出しで、1つの状態更新です。

3. **作成済みと一時的** — 再生設定 (ループ、フレーム期間) は、ドキュメントに永続的に保存される作成済みの状態です。プレビューコントロール (再生/停止/移動) は、保存されたファイルに影響を与えない一時的なUIの状態です。

4. **セッションの分離** — 各セッションは、独自のヘッドレスZustandストアインスタンスを持ちます。セッションは互いに見たり干渉したりできません。

5. **標準的な結果の形状** — `{ ok: true, ...data }` または `{ ok: false, code, message }`。生の例外や構造化されていない文字列はありません。

## アーキテクチャ

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

## セキュリティ

このサーバーは、ローカルでstdio経由で実行されます。ネットワークリクエストを行ったり、受信接続を受け入れたり、ファイルにアクセスしたりしません。ただし、クライアントがツール呼び出しを通じてファイルの内容を明示的に渡す場合は除きます。

- デフォルトでは、ネットワークへのアクセスはありません
- テレメトリー機能はありません
- ファイルシステムへのアクセスはありません — ドキュメントはJSON文字列として送受信されます
- スタックトレースは一切表示されません — 構造化されたエラー結果のみ

脆弱性に関する報告は、[SECURITY.md](../../SECURITY.md) を参照してください。

## ライセンス

[MIT](../../LICENSE)

---

<a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a> が作成しました。
