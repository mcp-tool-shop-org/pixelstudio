<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

Servidor MCP que expone el editor de sprites de GlyphStudio como una superficie programable para modelos de lenguaje grandes (LLM). Crea documentos, dibuja píxeles, gestiona fotogramas y capas, controla la reproducción: todo a través de herramientas del [Protocolo de Contexto de Modelo](https://modelcontextprotocol.io/) que interactúan con la lógica y el estado reales. No hay rasterización reimplementada, ni un universo paralelo.

## ¿Por qué?

Los LLM pueden describir sprites, pero no pueden dibujarlos. Este servidor cierra esa brecha: un agente llama a `sprite_draw_pixels` con coordenadas y colores, y el motor real de GlyphStudio los aplica a un búfer de píxeles real, con deshacer real, capas reales y aislamiento de fotogramas real. El resultado es un archivo `.glyph` que puedes abrir en el editor de escritorio y seguir trabajando manualmente.

## Cómo empezar

### Claude Desktop / Claude Code

Añade esto a tu configuración de MCP (`claude_desktop_config.json` o `.mcp.json`):

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

### stdio (directo)

```bash
npx tsx packages/mcp-sprite-server/src/cli.ts
```

## Inventario de herramientas (53 herramientas)

### Sesión (3)

| Herramienta | Descripción |
|------|-------------|
| `sprite_session_new` | Crea una nueva sesión de edición |
| `sprite_session_list` | Lista las sesiones activas |
| `sprite_session_close` | Destruye una sesión y libera su almacenamiento |

### Documento (5)

| Herramienta | Descripción |
|------|-------------|
| `sprite_document_new` | Crea un documento vacío (nombre, ancho, alto) |
| `sprite_document_open` | Carga un archivo `.glyph` desde JSON |
| `sprite_document_save` | Serializa el documento como JSON `.glyph` |
| `sprite_document_close` | Cierra el documento sin destruir la sesión |
| `sprite_document_summary` | Obtén un resumen estructurado del documento (fotogramas, capas, dimensiones) |

### Fotograma (4)

| Herramienta | Descripción |
|------|-------------|
| `sprite_frame_add` | Añade un nuevo fotograma después del fotograma activo |
| `sprite_frame_remove` | Elimina un fotograma por ID |
| `sprite_frame_set_active` | Establece el fotograma activo por índice |
| `sprite_frame_set_duration` | Establece la duración del fotograma en milisegundos |

### Capa (5)

| Herramienta | Descripción |
|------|-------------|
| `sprite_layer_add` | Añade una capa vacía al fotograma activo |
| `sprite_layer_remove` | Elimina una capa por ID |
| `sprite_layer_set_active` | Establece la capa activa para el dibujo |
| `sprite_layer_toggle_visibility` | Alterna la visibilidad de la capa |
| `sprite_layer_rename` | Renombra una capa |

### Paleta (4)

| Herramienta | Descripción |
|------|-------------|
| `sprite_palette_set_foreground` | Establece el índice del color de primer plano |
| `sprite_palette_set_background` | Establece el índice del color de fondo |
| `sprite_palette_swap` | Intercambia el color de primer plano y el color de fondo |
| `sprite_palette_list` | Lista todos los colores de la paleta con sus valores RGBA |

### Dibujo / Raster (5)

| Herramienta | Descripción |
|------|-------------|
| `sprite_draw_pixels` | Dibuja píxeles por lotes — array `[{x, y, rgba}]`, una sola copia del búfer |
| `sprite_draw_line` | Línea de Bresenham entre dos puntos |
| `sprite_fill` | Relleno contiguo desde un píxel semilla |
| `sprite_erase_pixels` | Borra píxeles por lotes para hacerlos transparentes |
| `sprite_sample_pixel` | Lee el valor RGBA de un píxel en una coordenada (sin modificar) |

### Selección / Portapapeles (9)

| Herramienta | Descripción |
|------|-------------|
| `sprite_selection_set_rect` | Crea una selección rectangular |
| `sprite_selection_clear` | Borra el contorno de la selección (los píxeles no se modifican) |
| `sprite_selection_get` | Obtén el rectángulo y las dimensiones de la selección actual |
| `sprite_selection_copy` | Copia la selección al búfer del portapapeles |
| `sprite_selection_cut` | Recorta la selección (copia y luego borra los píxeles) |
| `sprite_selection_paste` | Pega el contenido del portapapeles como una selección flotante en (0,0) |
| `sprite_selection_flip_horizontal` | Invierte horizontalmente el contenido de la selección |
| `sprite_selection_flip_vertical` | Invierte verticalmente el contenido de la selección |
| `sprite_selection_commit` | Aplica la selección flotante a la capa activa |

### Configuración de la herramienta (10)

| Herramienta | Descripción |
|------|-------------|
| `sprite_tool_set` | Cambia la herramienta (lápiz / borrador / relleno / cuentagotas / selección) |
| `sprite_tool_get` | Obtén la configuración actual de la herramienta |
| `sprite_tool_set_brush_size` | Establece el diámetro del pincel (1–64) |
| `sprite_tool_set_brush_shape` | Establece la forma del pincel (cuadrado / círculo) |
| `sprite_tool_set_pixel_perfect` | Activa el modo de trazo preciso a píxel |
| `sprite_onion_set` | Configura el efecto de "piel de cebolla" (activado, número de fotogramas antes/después, opacidad) |
| `sprite_onion_get` | Obtén la configuración actual del efecto de "piel de cebolla" |
| `sprite_canvas_set_zoom` | Establece el nivel de zoom (1–64) |
| `sprite_canvas_set_pan` | Establece el desplazamiento de la vista |
| `sprite_canvas_reset_view` | Restablece el zoom y el desplazamiento a los valores predeterminados |

### Reproducción — Configuración predefinida (2)

| Herramienta | Descripción |
|------|-------------|
| `sprite_playback_get_config` | Obtén la configuración de bucle y las duraciones por fotograma |
| `sprite_playback_set_config` | Establece el modo de bucle (se guarda en el documento) |

### Reproducción — Vista previa temporal (6)

| Herramienta | Descripción |
|------|-------------|
| `sprite_preview_play` | Iniciar la vista previa de la animación |
| `sprite_preview_stop` | Detener la vista previa de la animación |
| `sprite_preview_get_state` | Obtener el estado de la vista previa (reproduciendo, índice de fotograma, bucle) |
| `sprite_preview_set_frame` | Ir a un índice de fotograma específico |
| `sprite_preview_step_next` | Avanzar un fotograma |
| `sprite_preview_step_prev` | Retroceder un fotograma |

## Recursos

| Patrón de URI | Descripción |
|-------------|-------------|
| `sprite://session/{id}/document` | Resumen completo del documento (fotogramas, capas, dimensiones, paleta) |
| `sprite://session/{id}/state` | Estado de la sesión compacto (herramienta, selección, reproducción, vista previa, indicador de modificación) |

## Formato del resultado

Cada herramienta devuelve un envoltorio JSON consistente:

```jsonc
// Success — shape varies per tool
{ "ok": true, "sessionId": "session_1" }
{ "ok": true, "bounds": { "minX": 0, "minY": 0, "maxX": 7, "maxY": 0, "pixelCount": 8 } }

// Error — always code + message
{ "ok": false, "code": "no_document", "message": "No document open" }
{ "ok": false, "code": "out_of_bounds", "message": "Pixel (20, 5) outside 16×16 canvas" }
```

Códigos de error: `no_session`, `no_document`, `no_frame`, `no_layer`, `no_selection`, `out_of_bounds`, `invalid_input`, `empty_clipboard`.

## Ejemplo: Crear un sprite de 2 fotogramas

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

## Principios de diseño

1. **Lógica real** — Cada herramienta llama a `@glyphstudio/domain` y `@glyphstudio/state`. No hay implementaciones rasterizadas paralelas, ni algoritmos de relleno reimplementados, ni estado de sombra.

2. **Dibujo por lotes** — `sprite_draw_pixels` acepta un array de entradas `{x, y, rgba}`. El búfer se clona una vez, se aplican todos los píxeles y luego se confirma el búfer. Una llamada, una actualización de estado.

3. **Configuración vs. temporal** — La configuración de reproducción (bucle, duraciones de fotogramas) es un estado configurado que persiste en el documento. Los controles de vista previa (reproducir/detener/saltar) son un estado de la interfaz de usuario temporal que nunca modifica el archivo guardado.

4. **Aislamiento de la sesión** — Cada sesión obtiene su propia instancia independiente de la tienda Zustand. Las sesiones no pueden ver ni interferir entre sí.

5. **Formato de resultado estándar** — `{ ok: true, ...data }` o `{ ok: false, code, message }`. No hay excepciones sin procesar, ni cadenas no estructuradas.

## Arquitectura

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

## Seguridad

Este servidor se ejecuta localmente a través de stdio. No realiza solicitudes de red, no acepta conexiones entrantes ni accede a archivos, a menos que el cliente pase explícitamente el contenido de los archivos a través de llamadas a herramientas.

- **Sin salida de red** por defecto
- **Sin telemetría**
- **Sin acceso al sistema de archivos** — los documentos se pasan de entrada y de salida como cadenas JSON
- Los rastreos de pila nunca se muestran — solo se muestran resultados de error estructurados

Consulte [SECURITY.md](../../SECURITY.md) para informar de vulnerabilidades.

## Licencia

[MIT](../../LICENSE)

---

Creado por <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
