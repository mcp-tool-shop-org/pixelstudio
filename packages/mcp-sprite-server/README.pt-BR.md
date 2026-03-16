<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
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

Servidor MCP que expõe o editor de sprites GlyphStudio completo como uma superfície programável para LLMs. Crie documentos, desenhe pixels, gerencie quadros e camadas, controle a reprodução — tudo através de ferramentas do [Model Context Protocol](https://modelcontextprotocol.io/) que interagem com a lógica e o estado reais. Sem reimplementação de rasterização, sem universo paralelo.

## Por que

LLMs podem descrever sprites, mas não podem desenhá-los. Este servidor preenche essa lacuna: um agente chama `sprite_draw_pixels` com coordenadas e cores, e o motor GlyphStudio real aplica esses valores a um buffer de pixels real, com desfazer, camadas e isolamento de quadros reais. O resultado é um arquivo `.glyph` que você pode abrir no editor de desktop e continuar trabalhando manualmente.

## Como começar

### Claude Desktop / Claude Code

Adicione à sua configuração MCP (`claude_desktop_config.json` ou `.mcp.json`):

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

### stdio (direto)

```bash
npx tsx packages/mcp-sprite-server/src/cli.ts
```

## Inventário de ferramentas (53 ferramentas)

### Sessão (3)

| Ferramenta | Descrição |
|------|-------------|
| `sprite_session_new` | Cria uma nova sessão de edição |
| `sprite_session_list` | Lista as sessões ativas |
| `sprite_session_close` | Destrói uma sessão e libera seu armazenamento |

### Documento (5)

| Ferramenta | Descrição |
|------|-------------|
| `sprite_document_new` | Cria um documento em branco (nome, largura, altura) |
| `sprite_document_open` | Carrega um arquivo `.glyph` a partir de JSON |
| `sprite_document_save` | Serializa o documento como JSON `.glyph` |
| `sprite_document_close` | Fecha o documento sem destruir a sessão |
| `sprite_document_summary` | Obtém um resumo estruturado do documento (quadros, camadas, dimensões) |

### Quadro (4)

| Ferramenta | Descrição |
|------|-------------|
| `sprite_frame_add` | Adiciona um novo quadro após o quadro ativo |
| `sprite_frame_remove` | Remove um quadro por ID |
| `sprite_frame_set_active` | Define o quadro ativo por índice |
| `sprite_frame_set_duration` | Define a duração do quadro em milissegundos |

### Camada (5)

| Ferramenta | Descrição |
|------|-------------|
| `sprite_layer_add` | Adiciona uma camada em branco ao quadro ativo |
| `sprite_layer_remove` | Remove uma camada por ID |
| `sprite_layer_set_active` | Define a camada ativa para desenho |
| `sprite_layer_toggle_visibility` | Alterna a visibilidade da camada |
| `sprite_layer_rename` | Renomeia uma camada |

### Paleta (4)

| Ferramenta | Descrição |
|------|-------------|
| `sprite_palette_set_foreground` | Define o índice da cor de primeiro plano |
| `sprite_palette_set_background` | Define o índice da cor de fundo |
| `sprite_palette_swap` | Troca as cores de primeiro plano e fundo |
| `sprite_palette_list` | Lista todas as cores da paleta com valores RGBA |

### Desenho / Raster (5)

| Ferramenta | Descrição |
|------|-------------|
| `sprite_draw_pixels` | Desenha pixels em lote — array `[{x, y, rgba}]`, cria um clone do buffer |
| `sprite_draw_line` | Desenha uma linha de Bresenham entre dois pontos |
| `sprite_fill` | Preenchimento contínuo a partir de um pixel inicial |
| `sprite_erase_pixels` | Apaga pixels em lote para transparente |
| `sprite_sample_pixel` | Lê o valor RGBA de um pixel em uma coordenada (sem modificação) |

### Seleção / Área de transferência (9)

| Ferramenta | Descrição |
|------|-------------|
| `sprite_selection_set_rect` | Cria uma seleção retangular |
| `sprite_selection_clear` | Limpa a área de seleção (pixels não são alterados) |
| `sprite_selection_get` | Obtém o retângulo e as dimensões da seleção atual |
| `sprite_selection_copy` | Copia a seleção para o buffer da área de transferência |
| `sprite_selection_cut` | Recorta a seleção (copia e depois limpa os pixels) |
| `sprite_selection_paste` | Cola a área de transferência como uma seleção flutuante em (0,0) |
| `sprite_selection_flip_horizontal` | Inverte horizontalmente o conteúdo da seleção |
| `sprite_selection_flip_vertical` | Inverte verticalmente o conteúdo da seleção |
| `sprite_selection_commit` | Aplica a seleção flutuante à camada ativa |

### Configurações da ferramenta (10)

| Ferramenta | Descrição |
|------|-------------|
| `sprite_tool_set` | Alterna a ferramenta (lápis / borracha / preencher / conta-gotas / selecionar) |
| `sprite_tool_get` | Obtém a configuração atual da ferramenta |
| `sprite_tool_set_brush_size` | Define o diâmetro do pincel (1–64) |
| `sprite_tool_set_brush_shape` | Define a forma do pincel (quadrado / círculo) |
| `sprite_tool_set_pixel_perfect` | Alterna o modo de traço preciso |
| `sprite_onion_set` | Configura o efeito de "pele de cebola" (ativado, contagem de quadros antes/depois, opacidade) |
| `sprite_onion_get` | Obtém a configuração atual do efeito de "pele de cebola" |
| `sprite_canvas_set_zoom` | Define o nível de zoom (1–64) |
| `sprite_canvas_set_pan` | Define o deslocamento de panorâmica |
| `sprite_canvas_reset_view` | Reseta para o zoom e a panorâmica padrão |

### Reprodução — Configuração Autorizada (2)

| Ferramenta | Descrição |
|------|-------------|
| `sprite_playback_get_config` | Obtém a configuração de loop e as durações de cada quadro |
| `sprite_playback_set_config` | Define o modo de loop (persiste no documento) |

### Reprodução — Visualização Temporária (6)

| Ferramenta | Descrição |
|------|-------------|
| `sprite_preview_play` | Iniciar a visualização da animação |
| `sprite_preview_stop` | Parar a visualização da animação |
| `sprite_preview_get_state` | Obter o estado da visualização (reproduzindo, índice do quadro, loop) |
| `sprite_preview_set_frame` | Ir para um índice de quadro específico |
| `sprite_preview_step_next` | Avançar um quadro |
| `sprite_preview_step_prev` | Retroceder um quadro |

## Recursos

| Padrão de URI | Descrição |
|-------------|-------------|
| `sprite://session/{id}/document` | Resumo completo do documento (quadros, camadas, dimensões, paleta) |
| `sprite://session/{id}/state` | Estado da sessão compactado (ferramenta, seleção, reprodução, visualização, indicador de modificação) |

## Formato do Resultado

Cada ferramenta retorna um envelope JSON consistente:

```jsonc
// Success — shape varies per tool
{ "ok": true, "sessionId": "session_1" }
{ "ok": true, "bounds": { "minX": 0, "minY": 0, "maxX": 7, "maxY": 0, "pixelCount": 8 } }

// Error — always code + message
{ "ok": false, "code": "no_document", "message": "No document open" }
{ "ok": false, "code": "out_of_bounds", "message": "Pixel (20, 5) outside 16×16 canvas" }
```

Códigos de erro: `no_session`, `no_document`, `no_frame`, `no_layer`, `no_selection`, `out_of_bounds`, `invalid_input`, `empty_clipboard`.

## Exemplo: Criar um Sprite de 2 Quadros

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

## Princípios de Design

1. **Lógica real** — Cada ferramenta chama `@glyphstudio/domain` e `@glyphstudio/state`. Não há implementações rasterizadas paralelas, nem algoritmos de preenchimento de área reimplementados, nem estado de sombra.

2. **Desenho em lote** — `sprite_draw_pixels` aceita um array de entradas `{x, y, rgba}`. O buffer é clonado uma vez, todos os pixels são aplicados e, em seguida, o buffer é confirmado. Uma chamada, uma única atualização de estado.

3. **Configuração vs. temporário** — A configuração de reprodução (loop, durações dos quadros) é um estado persistente no documento. Os controles de visualização (reproduzir/parar/navegar) são um estado da interface do usuário temporário que nunca afeta o arquivo salvo.

4. **Isolamento da sessão** — Cada sessão recebe sua própria instância independente do armazenamento Zustand. As sessões não podem ver ou interferir umas nas outras.

5. **Formato de resultado padrão** — `{ ok: true, ...data }` ou `{ ok: false, code, message }`. Sem exceções brutas, sem strings não estruturadas.

## Arquitetura

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

## Segurança

Este servidor é executado localmente através do stdio. Ele não faz solicitações de rede, não aceita conexões de entrada nem acessa arquivos, a menos que o cliente passe explicitamente o conteúdo do arquivo por meio de chamadas de ferramentas.

- **Sem saída de rede** por padrão
- **Sem telemetria**
- **Sem acesso ao sistema de arquivos** — os documentos são passados para dentro e para fora como strings JSON
- Os rastreamentos da pilha nunca são expostos — apenas resultados de erro estruturados

Consulte [SECURITY.md](../../SECURITY.md) para relatar vulnerabilidades.

## Licença

[MIT](../../LICENSE)

---

Criado por <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
