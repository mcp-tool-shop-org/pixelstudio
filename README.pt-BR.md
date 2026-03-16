<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
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

Um estúdio de sprites focado na criação, para edição determinística de pixels, animação quadro a quadro e, no futuro, assistência na movimentação.

GlyphStudio é um aplicativo para desktop construído com **Tauri v2**, **React** e **Rust**. Ele foi projetado com uma regra simples: o editor deve manter o controle da obra de arte, e a automação deve permanecer subordinada ao artista.

## Status Atual

GlyphStudio é um editor para desktop funcional, com 30 fases implementadas e 1.149 testes aprovados.

### Editor de Canvas (backend em Rust)
- Canvas de pixels determinístico com renderização por vizinho mais próximo
- Camadas com visibilidade, bloqueio, opacidade, renomeação, reordenação
- Desenho baseado em traços com desfazer/refazer
- Seleção retangular, ações de área de transferência e fluxo de trabalho de transformação
- Linha do tempo multi-quadro com isolamento de desfazer/refazer por quadro
- Sobreposições de "pele de cebola" para edição de quadros adjacentes
- Controles de reprodução com suporte a FPS e loop
- Assistência de movimento com geração determinística de sugestões
- Sistema de âncoras com hierarquia, atenuação e modelos de movimento secundário
- Predefinições de movimento com aplicação em lote em vários quadros
- Definições de recorte com ponto de pivô, tags e validação
- Exportação de folhas de sprites com manifesto (formatos de tempo de execução nativos e genéricos)
- Catálogo de recursos com miniaturas, pesquisa e empacotamento
- Salvamento/carregamento de projetos, recuperação automática e migração de esquema

### Compositor de Cenas (frontend + Rust)
- Composição de cenas com instâncias de recursos, ordem de camadas, visibilidade, opacidade, paralaxe
- Sistema de câmera com panorâmica, zoom, animação por keyframe e derivação de cena
- Sistema de construção de personagens com slots, predefinições, validação e ponte para a cena
- Desfazer/refazer de cenas com histórico completo e reversão em caso de falha na sincronização
- Rastreabilidade persistida com inspeção detalhada de 20 tipos de operações
- Comparação e visualização de restauração de cenas

### Editor de Sprites (apenas frontend)
- Editor de pixels autônomo com ferramentas de lápis, borracha, preenchimento e conta-gotas
- Edição multi-camada com visibilidade, renomeação e reordenação por camada
- Composição alfa com visualização de rascunho em tempo real de cada traço em todas as camadas
- Gerenciamento de quadros com "pele de cebola", reprodução, barra de rolagem e duração por quadro
- Seleção retangular com copiar/recortar/colar/excluir
- Importação/exportação de folhas de sprites com achatamento multi-camada
- Painel de paleta com seletor de cores e troca de primeiro plano/fundo

Este não é um brinquedo para navegador ou uma máquina de slots com inteligência artificial. É um editor para desktop nativo, onde o Rust controla a verdade dos pixels do canvas e o frontend controla a verdade dos pixels do sprite.

## Filosofia do Produto

GlyphStudio é construído em torno de quatro princípios:

1. **Edição determinística**
Toda mutação de pixel deve ser legal, inspecionável e reversível.

2. **Inteligência artificial subordinada**
A automação deve auxiliar no fluxo de trabalho sem substituir o controle criativo.

3. **Estrutura focada na animação**
Quadros, operações da linha do tempo, "pele de cebola" e reprodução são conceitos centrais do editor, e não meros acréscimos.

4. **Estado confiável**
Salvar/carregar, salvamento automático, recuperação, desfazer/refazer e migração são tratados como recursos do produto, e não como tarefas de limpeza.

## Arquitetura

### Frontend (React + TypeScript)
- 17+ armazenamentos Zustand organizados por domínio
- Renderizador de canvas HTML para ambos os editores
- UI do editor de canvas: camadas, linha do tempo, seleção, reprodução, construtor de personagens, compositor de cenas
- Editor de sprites: editor de pixels autônomo com buffers de pixels gerenciados pelo frontend
- Composição alfa via `flattenLayers` para edição de sprites multi-camada

### Backend (Rust)
- Buffers de pixels e composição de camadas para o editor de tela.
- Transações de contorno com visualizações "antes/depois".
- Sessões de seleção/transformação.
- Persistência do projeto, salvamento automático, recuperação em caso de falha.
- Pipelines de exportação (PNG, folha de sprites, recorte, pacote).
- Motor de composição de cena com câmera e reprodução.
- Catálogo de recursos com geração de miniaturas.
- 166 comandos Tauri implementados.

### Interface de Desktop
- Tauri v2

## Estrutura de Monorepo

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

## Estágios Implementados

### Estágios 1–3 — Base do Editor
Tela, camadas, ferramentas de desenho, desfazer/refazer, seleção, transformações, linha do tempo, sobreposição de quadros, reprodução, operações de quadro, exportação PNG/strip, persistência do projeto, salvamento automático, recuperação em caso de falha.

### Estágio 4A — Assistência para Movimento
Sessões de movimento limitadas, geração determinística de propostas, visualização com miniaturas de quadros, segurança da sessão, confirmação da proposta na linha do tempo.

### Estágios 5–8 — Refinamento do Movimento
Pontos de ancoragem com hierarquia e atenuação, modelos de movimento secundários (vento, balanço, oscilação, ondulação), ambiente de teste de movimento com métricas de análise, predefinições de movimento com aplicação em lote.

### Estágios 9–10 — Recortes, Exportação, Base da Cena
Definições de recorte com ponto de pivô/tags/validação, exportação de folha de sprites com metadados, catálogo de recursos com miniaturas, empacotamento, composição de cena com instâncias e ordenação em profundidade.

### Estágios 11–14 — Sistema de Personagens
Construção de personagens com 12 slots para regiões do corpo, seletor de predefinições com níveis de compatibilidade, validação da construção, biblioteca de construções com persistência, ponte de personagem para cena com posicionamento de instantâneos.

### Estágios 15–16 — Edição de Cena
Câmera de cena com panorâmica/zoom, keyframes da câmera com interpolação, desfazer/refazer da cena com histórico completo de instantâneos, reversão em caso de falha na sincronização do backend.

### Estágios 17–24 — Proveniência e Inspeção
Proveniência da cena persistida com 20 tipos de operação, inspeção detalhada com fatias "antes/depois" capturadas, resumos estruturados de valores, motor de comparação de cenas, fluxos de trabalho de visualização de restauração.

### Estágios 25–26 — Restauração e Restauração Seletiva
Contrato de restauração da cena com derivação pura, restauração seletiva por domínio (instâncias, câmera, keyframes, reprodução), configuração de reprodução por meio de uma interface clara com desfazer/refazer.

### Estágios 27–28 — Editor de Sprites
Editor de sprites apenas para a interface: contrato do documento, tela de pixels com lápis/borracha/preenchimento/conta-gotas, quadros com sobreposição de quadros, seleção com área de transferência, importação/exportação de folha de sprites, atalhos de teclado, zoom/grade, painel de paleta.

### Estágio 29 — Visualização de Animação
Contrato do reprodutor de animação, interface de reprodução com barra de rolagem e atalho de espaço, edição da duração do quadro na linha, supressão da sobreposição de quadros durante a reprodução.

### Estágio 30 — Camadas e Fluxo de Trabalho de Camadas
Tipo de camada SpriteLayer, buffers de pixels indexados por layerId, composição alfa de camadas achatadas, rastreamento de activeLayerId, painel de camadas com CRUD/visibilidade/renomear/reordenar, composição de traçado em camadas em todas as camadas visíveis, exportação de várias camadas.

## Executando o Aplicativo

### Pré-requisitos
- Node.js 20+
- pnpm 9+
- Rust 1.75+ (via [rustup](https://rustup.rs/))
- Pré-requisitos do Tauri v2 para sua plataforma

### Instalação

```bash
pnpm install
```

### Executar aplicativo de desktop

```bash
pnpm dev
```

### Verificação de tipo

```bash
pnpm typecheck
```

### Verificação Rust

```bash
cd apps/desktop/src-tauri
cargo check
```

## Suporte de Exportação

### Editor de Tela (Rust)
- **Imagem PNG do quadro atual** — imagem composta única.
- **Sequência PNG** — arquivos numerados (name_0001.png, name_0002.png, ...).
- **Tira de sprites** — tira horizontal ou vertical de uma única imagem.
- **Folha de clipes** — folha de sprites criada a partir de definições de clipes, com um manifesto opcional.
- **Folha de todos os clipes** — folha combinada de todos os clipes válidos.
- **Pacote de recursos** — pasta ou arquivo zip contendo imagens, manifestos e uma miniatura de visualização.
- **Pacote de catálogo** — empacotamento de vários recursos, com subpastas para cada recurso.

### Editor de sprites (interface do usuário)
- **Tira de sprites** — tira horizontal com todas as camadas visíveis combinadas para cada quadro.
- **Quadro atual** — combinação das camadas visíveis.

As exportações utilizam apenas as camadas visíveis combinadas. O efeito de "pele de cebola", o estado de reprodução e as sobreposições temporárias do editor não são incluídos na saída.

## Documentação

Consulte o [manual](site/src/content/docs/handbook/) para obter detalhes mais aprofundados:

- [Primeiros Passos](site/src/content/docs/handbook/getting-started.md)
- [Arquitetura](site/src/content/docs/handbook/architecture.md)
- [Referência da API](site/src/content/docs/handbook/reference.md)

## Roteiro

Prioridades de curto prazo:

- Modo de paleta indexada com regras de contraste e edição de rampas.
- Integração de assistente de IA (Ollama local + ComfyUI para tarefas de geração limitadas).
- Ambiente de análise de locomoção com sobreposições de passada/contato/CoM.
- Motor de validação com ações de correção.

## Objetivos não incluídos

O GlyphStudio não tem como objetivo ser:

- Um editor de imagens genérico.
- Um aplicativo simples para navegadores.
- Um "wrapper" de prompts de IA que adivinha a arte.
- Uma tela confusa onde o estado da interface do usuário e a verdade do backend se desviam.

## Segurança

O GlyphStudio é um aplicativo **exclusivo para desktop**. Ele não faz solicitações de rede, coleta dados de telemetria ou lida com segredos.

- **Dados acessados:** arquivos de sprite locais (.glyph, .pxs, .png), arquivos de salvamento automático/recuperação no diretório de dados do aplicativo.
- **Dados NÃO acessados:** nenhuma rede, nenhuma nuvem, nenhuma API remota, nenhuma conta de usuário.
- **Permissões:** acesso ao sistema de arquivos limitado a diretórios selecionados pelo usuário, através de diálogos nativos de arquivo Tauri v2.
- **Nenhuma telemetria** é coletada ou enviada.

Consulte [SECURITY.md](SECURITY.md) para relatar vulnerabilidades.

## Licença

[MIT](LICENSE)

---

Desenvolvido por <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>.
