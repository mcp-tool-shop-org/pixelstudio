<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

Studio di creazione di sprite incentrato sulla precisione, per la modifica pixel per pixel, l'animazione fotogramma per fotogramma e, in futuro, l'assistenza alla creazione di movimenti.

GlyphStudio è un'applicazione desktop sviluppata con **Tauri v2**, **React** e **Rust**. È progettata attorno a una semplice regola: l'editor deve mantenere il controllo sull'opera d'arte, e l'automazione deve rimanere subordinata all'artista.

## Stato attuale

GlyphStudio è un editor desktop funzionante con 32 fasi disponibili e 2.776 test superati.

### Editor della tela (backend in Rust)
- Tela pixel con rendering a vicinanza del vicino
- Livelli con visibilità, blocco, opacità, ridenominazione, riordino
- Disegno basato su tratti con annulla/riprova
- Selezione rettangolare, operazioni di clipboard e flusso di lavoro di trasformazione
- Timeline multi-fotogramma con isolamento annulla/riprova per ogni fotogramma
- Sovrapposizioni "pellicola" per la modifica di fotogrammi adiacenti
- Controlli di riproduzione con supporto per FPS e loop
- Assistenza alla creazione di movimenti con generazione di proposte deterministiche
- Sistema di ancoraggi con gerarchia, attenuazione e modelli di movimento secondario
- Impostazioni predefinite per i movimenti con applicazione in batch su più fotogrammi
- Definizioni di clip con punto di pivot, tag e convalida
- Esportazione di sprite sheet con manifest (formati di runtime nativi e generici)
- Catalogo risorse con miniature, ricerca e confezionamento
- Salvataggio/caricamento del progetto, ripristino automatico e migrazione dello schema

### Compositore di scene (frontend + Rust)
- Composizione di scene con istanze di risorse, ordinamento degli z, visibilità, opacità, parallasse
- Sistema di telecamere con panoramica, zoom, animazione keyframe e derivazione di riprese
- Sistema di creazione di personaggi con slot, impostazioni predefinite, convalida e collegamento alla scena
- Annulla/riprova della scena con cronologia completa e ripristino in caso di errore di sincronizzazione
- Provenienza persistente con possibilità di esaminare in dettaglio 20 tipi di operazioni
- Confronto e anteprima di ripristino delle scene

### Editor di sprite (solo frontend)
- Editor di pixel autonomo con strumenti matita, gomma, riempimento, contagocce
- Modifica multi-livello con visibilità, ridenominazione e riordino per ogni livello
- Composizione alfa con anteprima in tempo reale dei tratti su tutti i livelli
- Gestione dei fotogrammi con pellicola, riproduzione, barra di scorrimento e durata per fotogramma
- Selezione rettangolare con copia/taglia/incolla/elimina
- Importazione/esportazione di sprite sheet con appiattimento multi-livello
- Pannello della tavolozza con selettore di colori e scambio tra primo piano e sfondo

Questo non è un semplice strumento per il browser o una macchina slot. È un editor desktop nativo in cui Rust gestisce la verità dei pixel della tela, mentre il frontend gestisce la verità dei pixel dello sprite.

## Filosofia del prodotto

GlyphStudio è costruito attorno a quattro principi:

1. **Modifica deterministica**
Ogni modifica di un pixel deve essere valida, verificabile e reversibile.

2. **Intelligenza artificiale subordinata**
L'automazione deve assistere il flusso di lavoro senza sostituire il controllo creativo.

3. **Struttura incentrata sull'animazione**
Fotogrammi, operazioni sulla timeline, pellicola e riproduzione sono concetti fondamentali dell'editor, non aggiunte successive.

4. **Stato affidabile**
Salvataggio/caricamento, salvataggio automatico, ripristino, annulla/riprova e migrazione sono trattati come funzionalità del prodotto, non come semplici attività di pulizia.

## Architettura

### Frontend (React + TypeScript)
- 17+ store di Zustand organizzati per dominio
- Renderer HTML per la tela per entrambi gli editor
- Interfaccia utente dell'editor della tela: livelli, timeline, selezione, riproduzione, costruttore di personaggi, compositore di scene
- Editor di sprite: editor di pixel autonomo con buffer di pixel gestiti dal frontend
- Composizione alfa tramite `flattenLayers` per la modifica di sprite multi-livello

### Backend (Rust)
- Buffer di pixel e composizione dei livelli per l'editor di tela.
- Transazioni di tratto con anteprime "prima/dopo".
- Sessioni di selezione/trasformazione.
- Persistenza del progetto, salvataggio automatico, ripristino in caso di crash.
- Pipeline di esportazione (PNG, sprite sheet, clip, bundle).
- Motore di composizione della scena con telecamera e riproduzione.
- Catalogo di risorse con generazione di miniature.
- 166 comandi Tauri implementati.

### Shell desktop
- Tauri v2

## Struttura monorepo

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

## Fasi implementate

### Fasi 1–3 — Fondamenti dell'editor
Tela, livelli, strumenti di disegno, annulla/riprova, selezione, trasformazioni, timeline, onion skin, riproduzione, operazioni sui fotogrammi, esportazione PNG/strip, persistenza del progetto, salvataggio automatico, ripristino in caso di crash.

### Fase 4A — Assistenza per l'animazione
Sessioni di animazione vincolate, generazione deterministica di proposte, anteprima con miniature dei fotogrammi, sicurezza delle sessioni, commit delle proposte nella timeline.

### Fasi 5–8 — Rifinitura dell'animazione
Ancore con gerarchia e attenuazione, modelli di animazione secondari (vento, oscillazione, dondolio, fruscio), sandbox di animazione con metriche di analisi, preset di animazione con applicazione in batch.

### Fasi 9–10 — Clip, Esportazione, Fondamenti della scena
Definizioni di clip con pivot/tag/validazione, esportazione di sprite sheet con manifest, catalogo di risorse con miniature, confezionamento di bundle, composizione della scena con istanze e ordinamento degli z-layer.

### Fasi 11–14 — Sistema dei personaggi
Creazione di personaggi con 12 slot per le regioni del corpo, selettore di preset con livelli di compatibilità, validazione della creazione, libreria di creazioni con persistenza, ponte tra personaggio e scena con posizionamento di snapshot.

### Fasi 15–16 — Modifica della scena
Telecamera della scena con panoramica/zoom, keyframe della telecamera con interpolazione, annulla/riprova della scena con cronologia completa degli snapshot, rollback in caso di errore di sincronizzazione del backend.

### Fasi 17–24 — Provenienza e ispezione
Provenienza della scena persistente con 20 tipi di operazioni, ispezione dettagliata con sezioni "prima/dopo" catturate, riepiloghi strutturati dei valori, motore di confronto delle scene, ripristino delle anteprime.

### Fasi 25–26 — Ripristino e ripristino selettivo
Contratto di ripristino della scena con derivazione pura, ripristino selettivo per dominio (istanze, telecamera, keyframe, riproduzione), configurazione della riproduzione tramite interfaccia chiara con annulla/riprova.

### Fasi 27–28 — Editor di sprite
Editor di sprite solo frontend: contratto del documento, tela di pixel con matita/gomma/riempimento/pipetta, fotogrammi con onion skin, selezione con clipboard, importazione/esportazione di sprite sheet, scorciatoie da tastiera, zoom/griglia, pannello della tavolozza.

### Fase 29 — Anteprima dell'animazione
Contratto del lettore di animazione, interfaccia utente di riproduzione con barra di scorrimento e scorciatoia Space, modifica della durata del fotogramma in linea con preset, soppressione dell'onion skin durante la riproduzione.

### Fase 30 — Livelli e flusso di lavoro dei livelli
Tipo SpriteLayer, buffer di pixel con chiave layerId, composizione alpha flattenLayers, tracciamento activeLayerId, pannello dei livelli con CRUD/visibilità/rinomina/riordino, composizione delle pennellate in bozza su tutti i livelli visibili, esportazione multi-livello.

## Esecuzione dell'app

### Prerequisiti
- Node.js 20+
- pnpm 9+
- Rust 1.75+ (tramite [rustup](https://rustup.rs/))
- Prerequisiti di Tauri v2 per la tua piattaforma

### Installazione

```bash
pnpm install
```

### Esegui l'app desktop

```bash
pnpm dev
```

### Controllo dei tipi

```bash
pnpm typecheck
```

### Controllo Rust

```bash
cd apps/desktop/src-tauri
cargo check
```

## Supporto per l'esportazione

### Editor di tela (Rust)
- **Immagine PNG del frame corrente** — immagine composita singola.
- **Sequenza PNG** — file numerati (name_0001.png, name_0002.png, ...).
- **Striscia di sprite** — striscia orizzontale o verticale di un'unica immagine.
- **Foglio di clip** — foglio di sprite derivato dalle definizioni dei clip, con un file manifest opzionale.
- **Foglio di tutti i clip** — foglio combinato di tutti i clip validi.
- **Pacchetto di risorse** — cartella o file zip contenente immagini, file manifest e miniature di anteprima.
- **Pacchetto di catalogazione** — pacchetto multi-risorsa con sottocartelle per ogni risorsa.

### Editor di sprite (interfaccia utente)
- **Striscia di sprite** — striscia orizzontale con tutti i livelli visibili appiattiti per ogni frame.
- **Frame corrente** — immagine composita appiattita dei livelli visibili.

Le esportazioni utilizzano solo i livelli visibili compositi. L'effetto "onion skin", lo stato di riproduzione e le sovrapposizioni temporanee dell'editor non sono inclusi nell'output.

## Documentazione

Consultare il [manuale](site/src/content/docs/handbook/) per maggiori dettagli:

- [Guida introduttiva](site/src/content/docs/handbook/getting-started.md)
- [Architettura](site/src/content/docs/handbook/architecture.md)
- [Riferimento API](site/src/content/docs/handbook/reference.md)

## Roadmap (Piano di sviluppo)

Priorità a breve termine:

- Modalità tavolozza indicizzata con regole di contrasto e modifica della scala di grigi.
- Integrazione dell'assistente AI (Ollama locale + ComfyUI per attività di generazione limitate).
- Ambiente di analisi della locomozione con sovrapposizioni di passo/contatto/CoM.
- Motore di validazione con azioni di correzione.

## Obiettivi non previsti

GlyphStudio non mira a essere:

- Un editor di immagini generico.
- Un'applicazione "giocattolo" pensata principalmente per il browser.
- Un wrapper per prompt AI che indovina il contenuto artistico.
- Una tela "morbida" dove lo stato dell'interfaccia utente e la realtà del backend divergono.

## Sicurezza

GlyphStudio è un'applicazione **solo per desktop**. Non effettua richieste di rete, non raccoglie dati di telemetria e non gestisce informazioni sensibili.

- **Dati accessibili:** file di sprite locali (.glyph, .pxs, .png), file di salvataggio automatico/ripristino nella directory dei dati dell'applicazione.
- **Dati NON accessibili:** nessuna connessione di rete, nessun servizio cloud, nessuna API remota, nessun account utente.
- **Permessi:** accesso al file system limitato alle directory selezionate dall'utente tramite le finestre di dialogo native di file di Tauri v2.
- **Nessuna telemetria** viene raccolta o inviata.

Consultare [SECURITY.md](SECURITY.md) per segnalare eventuali vulnerabilità.

## Licenza

[MIT](LICENSE)

---

Creato da <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
