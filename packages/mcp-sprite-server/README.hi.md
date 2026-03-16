<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.md">English</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

एक MCP सर्वर जो GlyphStudio स्प्राइट एडिटर को LLM (बड़े भाषा मॉडल) के लिए एक प्रोग्रामेबल सतह के रूप में उपलब्ध कराता है। दस्तावेज़ बनाएं, पिक्सेल बनाएं, फ्रेम और लेयर प्रबंधित करें, प्लेबैक को नियंत्रित करें - ये सभी [मॉडल कॉन्टेक्स्ट प्रोटोकॉल](https://modelcontextprotocol.io/) टूल के माध्यम से, जो वास्तविक डोमेन और स्थिति तर्क को कॉल करते हैं। यहां कोई पुनः कार्यान्वित रास्टर नहीं है, और कोई समानांतर ब्रह्मांड भी नहीं है।

## क्यों?

LLM स्प्राइट का वर्णन तो कर सकते हैं, लेकिन उन्हें बनाना नहीं आता। यह सर्वर इस अंतर को पाटता है: एक एजेंट `sprite_draw_pixels` को निर्देशांक और रंगों के साथ कॉल करता है, और वास्तविक GlyphStudio इंजन उन्हें वास्तविक पिक्सेल बफर पर लागू करता है, जिसमें वास्तविक अनडू, वास्तविक लेयर और वास्तविक फ्रेम अलगाव होता है। परिणाम एक `.glyph` फ़ाइल है जिसे आप डेस्कटॉप एडिटर में खोल सकते हैं और मैन्युअल रूप से काम करना जारी रख सकते हैं।

## शुरुआत कैसे करें

### क्लाउड डेस्कटॉप / क्लाउड कोड

अपने MCP कॉन्फ़िगरेशन में जोड़ें (`claude_desktop_config.json` या `.mcp.json`):

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

### stdio (सीधा)

```bash
npx tsx packages/mcp-sprite-server/src/cli.ts
```

## उपकरण सूची (53 उपकरण)

### सत्र (3)

| उपकरण | विवरण |
|------|-------------|
| `sprite_session_new` | एक नया संपादन सत्र बनाएं |
| `sprite_session_list` | सक्रिय सत्रों की सूची देखें |
| `sprite_session_close` | एक सत्र को नष्ट करें और उसकी मेमोरी को खाली करें |

### दस्तावेज़ (5)

| उपकरण | विवरण |
|------|-------------|
| `sprite_document_new` | एक खाली दस्तावेज़ बनाएं (नाम, चौड़ाई, ऊंचाई) |
| `sprite_document_open` | JSON से एक `.glyph` फ़ाइल लोड करें |
| `sprite_document_save` | दस्तावेज़ को `.glyph` JSON के रूप में सीरियल करें |
| `sprite_document_close` | सत्र को नष्ट किए बिना दस्तावेज़ बंद करें |
| `sprite_document_summary` | संरचित दस्तावेज़ सारांश प्राप्त करें (फ्रेम, लेयर, आयाम) |

### फ्रेम (4)

| उपकरण | विवरण |
|------|-------------|
| `sprite_frame_add` | सक्रिय फ्रेम के बाद एक नया फ्रेम जोड़ें |
| `sprite_frame_remove` | आईडी द्वारा एक फ्रेम हटाएं |
| `sprite_frame_set_active` | इंडेक्स द्वारा सक्रिय फ्रेम सेट करें |
| `sprite_frame_set_duration` | मिलीसेकंड में फ्रेम की अवधि सेट करें |

### लेयर (5)

| उपकरण | विवरण |
|------|-------------|
| `sprite_layer_add` | सक्रिय फ्रेम में एक खाली लेयर जोड़ें |
| `sprite_layer_remove` | आईडी द्वारा एक लेयर हटाएं |
| `sprite_layer_set_active` | ड्रॉइंग के लिए सक्रिय लेयर सेट करें |
| `sprite_layer_toggle_visibility` | लेयर की दृश्यता को टॉगल करें |
| `sprite_layer_rename` | एक लेयर का नाम बदलें |

### पैलट (4)

| उपकरण | विवरण |
|------|-------------|
| `sprite_palette_set_foreground` | फ्रंटग्राउंड रंग इंडेक्स सेट करें |
| `sprite_palette_set_background` | बैकग्राउंड रंग इंडेक्स सेट करें |
| `sprite_palette_swap` | फ्रंटग्राउंड और बैकग्राउंड को बदलें |
| `sprite_palette_list` | RGBA मानों के साथ सभी पैलेट रंगों की सूची देखें |

### ड्रॉइंग / रास्टर (5)

| उपकरण | विवरण |
|------|-------------|
| `sprite_draw_pixels` | बैच में पिक्सेल बनाएं - `[{x, y, rgba}]` सरणी, एक बफर क्लोन |
| `sprite_draw_line` | दो बिंदुओं के बीच ब्रेसेनहम रेखा |
| `sprite_fill` | एक सीड पिक्सेल से निरंतर फ्लड फिल |
| `sprite_erase_pixels` | बैच में पिक्सेल को पारदर्शी करें |
| `sprite_sample_pixel` | एक निर्देशांक पर पिक्सेल RGBA पढ़ें (कोई बदलाव नहीं) |

### चयन / क्लिपबोर्ड (9)

| उपकरण | विवरण |
|------|-------------|
| `sprite_selection_set_rect` | एक आयताकार चयन बनाएं |
| `sprite_selection_clear` | चयन मार्की को साफ़ करें (पिक्सेल अपरिवर्तित) |
| `sprite_selection_get` | वर्तमान चयन आयत और आयाम प्राप्त करें |
| `sprite_selection_copy` | चयन को क्लिपबोर्ड बफर में कॉपी करें |
| `sprite_selection_cut` | चयन को काटें (पहले कॉपी करें, फिर पिक्सेल हटाएं) |
| `sprite_selection_paste` | क्लिपबोर्ड को (0,0) पर एक फ्लोटिंग चयन के रूप में पेस्ट करें |
| `sprite_selection_flip_horizontal` | चयन सामग्री को क्षैतिज रूप से पलटें |
| `sprite_selection_flip_vertical` | चयन सामग्री को लंबवत रूप से पलटें |
| `sprite_selection_commit` | सक्रिय लेयर पर फ्लोटिंग चयन को ब्लिट करें |

### उपकरण सेटिंग्स (10)

| उपकरण | विवरण |
|------|-------------|
| `sprite_tool_set` | उपकरण बदलें (पेंसिल / इरेज़र / फिल / आईड्रॉपर / सेलेक्ट) |
| `sprite_tool_get` | वर्तमान उपकरण कॉन्फ़िगरेशन प्राप्त करें |
| `sprite_tool_set_brush_size` | ब्रश व्यास सेट करें (1–64) |
| `sprite_tool_set_brush_shape` | ब्रश आकार सेट करें (वर्ग / वृत्त) |
| `sprite_tool_set_pixel_perfect` | पिक्सेल-परफेक्ट स्ट्रोक मोड को टॉगल करें |
| `sprite_onion_set` | ऑनियन स्किन को कॉन्फ़िगर करें (सक्षम, पहले/बाद की गणना, अस्पष्टता) |
| `sprite_onion_get` | वर्तमान ऑनियन स्किन कॉन्फ़िगरेशन प्राप्त करें |
| `sprite_canvas_set_zoom` | ज़ूम स्तर सेट करें (1–64) |
| `sprite_canvas_set_pan` | पैन ऑफ़सेट सेट करें |
| `sprite_canvas_reset_view` | डिफ़ॉल्ट ज़ूम और पैन पर रीसेट करें |

### प्लेबैक - ऑथर्ड कॉन्फ़िगरेशन (2)

| उपकरण | विवरण |
|------|-------------|
| `sprite_playback_get_config` | लूप सेटिंग और प्रति-फ्रेम अवधि प्राप्त करें |
| `sprite_playback_set_config` | लूप मोड सेट करें (दस्तावेज़ में सहेजा गया) |

### प्लेबैक — क्षणिक पूर्वावलोकन (6)

| उपकरण | विवरण |
|------|-------------|
| `sprite_preview_play` | एनीमेशन पूर्वावलोकन शुरू करें |
| `sprite_preview_stop` | एनीमेशन पूर्वावलोकन बंद करें |
| `sprite_preview_get_state` | पूर्वावलोकन स्थिति प्राप्त करें (प्लेइंग, फ्रेम इंडेक्स, लूपिंग) |
| `sprite_preview_set_frame` | किसी विशिष्ट फ्रेम इंडेक्स पर जाएं |
| `sprite_preview_step_next` | एक फ्रेम आगे बढ़ें |
| `sprite_preview_step_prev` | एक फ्रेम पीछे बढ़ें |

## संसाधन

| यूआरआई पैटर्न | विवरण |
|-------------|-------------|
| `sprite://session/{id}/document` | पूरे दस्तावेज़ का सारांश (फ्रेम, लेयर, आयाम, पैलेट) |
| `sprite://session/{id}/state` | संक्षिप्त सत्र स्थिति (टूल, चयन, प्लेबैक, पूर्वावलोकन, 'डर्टी' फ़्लैग) |

## परिणाम स्वरूप

प्रत्येक टूल एक समान JSON एन्वलप लौटाता है:

```jsonc
// Success — shape varies per tool
{ "ok": true, "sessionId": "session_1" }
{ "ok": true, "bounds": { "minX": 0, "minY": 0, "maxX": 7, "maxY": 0, "pixelCount": 8 } }

// Error — always code + message
{ "ok": false, "code": "no_document", "message": "No document open" }
{ "ok": false, "code": "out_of_bounds", "message": "Pixel (20, 5) outside 16×16 canvas" }
```

त्रुटि कोड: `no_session`, `no_document`, `no_frame`, `no_layer`, `no_selection`, `out_of_bounds`, `invalid_input`, `empty_clipboard`.

## उदाहरण: 2-फ्रेम स्प्राइट बनाएं

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

## डिजाइन नियम

1. **वास्तविक तर्क** — प्रत्येक टूल `@glyphstudio/domain` और `@glyphstudio/state` को कॉल करता है। कोई समानांतर रास्टर कार्यान्वयन नहीं, कोई पुनर्निर्मित फ्लड फिल नहीं, कोई शैडो स्टेट नहीं।

2. **बैच ड्राइंग** — `sprite_draw_pixels` `{x, y, rgba}` प्रविष्टियों की एक सरणी स्वीकार करता है। बफर को एक बार क्लोन किया जाता है, सभी पिक्सेल लागू किए जाते हैं, और फिर बफर को प्रतिबद्ध किया जाता है। एक कॉल, एक स्टेट अपडेट।

3. **रचित बनाम क्षणिक** — प्लेबैक कॉन्फ़िगरेशन (लूपिंग, फ्रेम अवधि) एक रचित स्थिति है जो दस्तावेज़ में बनी रहती है। पूर्वावलोकन नियंत्रण (प्ले/स्टॉप/स्क्रब) क्षणिक यूआई स्थिति हैं जो कभी भी सहेजी गई फ़ाइल को नहीं छूती हैं।

4. **सत्र अलगाव** — प्रत्येक सत्र को अपना हेडलेस ज़ुस्टेंड स्टोर इंस्टेंस मिलता है। सत्र एक-दूसरे को नहीं देख सकते हैं या एक-दूसरे में हस्तक्षेप नहीं कर सकते हैं।

5. **मानक परिणाम स्वरूप** — `{ ok: true, ...data }` या `{ ok: false, code, message }`. कोई कच्चा अपवाद नहीं, कोई अव्यवस्थित स्ट्रिंग नहीं।

## आर्किटेक्चर

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

## सुरक्षा

यह सर्वर स्थानीय रूप से stdio पर चलता है। यह नेटवर्क अनुरोध नहीं करता है, आने वाले कनेक्शन स्वीकार नहीं करता है, या फ़ाइलों तक नहीं पहुंचता है, जब तक कि क्लाइंट स्पष्ट रूप से टूल कॉल के माध्यम से फ़ाइल सामग्री को पास नहीं करता है।

- डिफ़ॉल्ट रूप से **कोई नेटवर्क आउटगोइंग नहीं**
- **कोई टेलीमेट्री नहीं**
- **कोई फ़ाइल सिस्टम एक्सेस नहीं** — दस्तावेज़ों को JSON स्ट्रिंग के रूप में इनपुट/आउटपुट किया जाता है
- स्टैक ट्रेस कभी भी प्रदर्शित नहीं किए जाते हैं — केवल संरचित त्रुटि परिणाम

भेद्यता रिपोर्टिंग के लिए [SECURITY.md](../../SECURITY.md) देखें।

## लाइसेंस

[MIT](../../LICENSE)

---

<a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a> द्वारा निर्मित।
