<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

Un estudio de creación de sprites diseñado para la edición precisa de píxeles, animación cuadro por cuadro y futura asistencia en la creación de movimientos.

GlyphStudio es una aplicación de escritorio construida con **Tauri v2**, **React** y **Rust**. Está diseñada en torno a una regla simple: el editor debe mantener el control de la obra de arte, y la automatización debe estar subordinada al artista.

## Estado actual

GlyphStudio es un editor de escritorio funcional con 30 etapas completadas y 1149 pruebas superadas.

### Editor de lienzo (backend en Rust)
- Lienzo de píxeles determinista con renderizado de vecinos más cercanos.
- Capas con visibilidad, bloqueo, opacidad, cambio de nombre, reordenación.
- Dibujo basado en trazos con deshacer/rehacer.
- Selección rectangular, acciones de portapapeles y flujo de trabajo de transformación.
- Línea de tiempo de múltiples fotogramas con aislamiento de deshacer/rehacer por fotograma.
- Superposiciones de "piel de cebolla" para la edición de fotogramas adyacentes.
- Controles de reproducción con soporte para FPS y bucle.
- Asistencia para movimientos con generación de propuestas deterministas.
- Sistema de anclajes con jerarquía, degradado y plantillas de movimiento secundario.
- Presets de movimiento con aplicación por lotes en todos los fotogramas.
- Definiciones de recorte con punto de pivote, etiquetas y validación.
- Exportación de láminas de sprites con manifiesto (formatos de ejecución nativos y genéricos).
- Catálogo de recursos con miniaturas, búsqueda y empaquetado.
- Guardado/carga de proyectos, recuperación automática y migración de esquema.

### Compositor de escenas (frontend + Rust)
- Composición de escenas con instancias de recursos, ordenación en profundidad, visibilidad, opacidad, paralaje.
- Sistema de cámara con paneo, zoom, animación de fotogramas clave y derivación de tomas.
- Sistema de construcción de personajes con ranuras, presets, validación y puente de escena.
- Deshacer/rehacer de escenas con historial completo de instantáneas y reversión en caso de fallo de sincronización.
- Seguimiento de origen persistente con inspección detallada de 20 tipos de operaciones.
- Flujos de trabajo de comparación y restauración de escenas.

### Editor de sprites (solo frontend)
- Editor de píxeles independiente con herramientas de lápiz, borrador, relleno y cuentagotas.
- Edición de múltiples capas con visibilidad, cambio de nombre y reordenación por capa.
- Composición alfa con vista previa de trazos en tiempo real en todas las capas.
- Gestión de fotogramas con "piel de cebolla", reproducción, barra de desplazamiento y duración por fotograma.
- Selección rectangular con copiar/cortar/pegar/eliminar.
- Importación/exportación de láminas de sprites con aplanamiento de múltiples capas.
- Panel de paleta con selector de color e intercambio de primer plano/fondo.

Esto no es un simple programa para navegador ni una máquina tragamonedas. Es un editor de escritorio nativo donde Rust controla la verdad de los píxeles del lienzo y el frontend controla la verdad de los píxeles del sprite.

## Filosofía del producto

GlyphStudio se basa en cuatro principios:

1. **Edición determinista**
Cada mutación de píxel debe ser legal, inspeccionable y reversible.

2. **Inteligencia artificial subordinada**
La automatización debe ayudar al flujo de trabajo sin reemplazar el control creativo.

3. **Estructura centrada en la animación**
Los fotogramas, las operaciones de la línea de tiempo, la "piel de cebolla" y la reproducción son conceptos centrales del editor, no añadidos posteriormente.

4. **Estado confiable**
El guardado/carga, el autoguardado, la recuperación, el deshacer/rehacer y la migración se tratan como características del producto, no como tareas de limpieza.

## Arquitectura

### Frontend (React + TypeScript)
- Más de 17 tiendas de Zustand organizadas por dominio.
- Renderizador de lienzo HTML para ambos editores.
- Interfaz de usuario del editor de lienzo: capas, línea de tiempo, selección, reproducción, constructor de personajes, compositor de escenas.
- Editor de sprites: editor de píxeles independiente con búferes de píxeles propiedad del frontend.
- Composición alfa a través de `flattenLayers` para la edición de sprites de múltiples capas.

### Backend (Rust)
- Buffers de píxeles y composición de capas para el editor de lienzo.
- Transacciones de trazo con previsualizaciones antes y después.
- Sesiones de selección/transformación.
- Persistencia del proyecto, autoguardado, recuperación en caso de fallos.
- Canales de exportación (PNG, hoja de sprites, recorte, paquete).
- Motor de composición de escenas con cámara y reproducción.
- Catálogo de recursos con generación de miniaturas.
- 166 comandos de Tauri implementados.

### Entorno de escritorio
- Tauri v2

## Estructura de monorepositorio

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

## Etapas implementadas

### Etapas 1–3: Base del editor
Lienzo, capas, herramientas de dibujo, deshacer/rehacer, selección, transformaciones, línea de tiempo, vista previa de fotogramas, reproducción, operaciones de fotogramas, exportación PNG/en tira, persistencia del proyecto, autoguardado, recuperación en caso de fallos.

### Etapa 4A: Asistencia para animación
Sesiones de animación con límites, generación determinista de propuestas, previsualización con tiras de fotogramas, seguridad de la sesión, confirmación de la propuesta en la línea de tiempo.

### Etapas 5–8: Refinamiento de la animación
Anclajes con jerarquía y degradado, plantillas de animación secundaria (viento, balanceo, oscilación, crujido), entorno de pruebas de animación con métricas de análisis, preajustes de animación con aplicación por lotes.

### Etapas 9–10: Recortes, exportación, base de la escena
Definiciones de recorte con punto de pivote/etiquetas/validación, exportación de hojas de sprites con manifiestos, catálogo de recursos con miniaturas, empaquetado, composición de escenas con instancias y ordenación en profundidad.

### Etapas 11–14: Sistema de personajes
Construcciones de personajes con 12 ranuras para regiones del cuerpo, selector de preajustes con niveles de compatibilidad, validación de la construcción, biblioteca de construcciones con persistencia, puente de personaje a escena con colocación de instantáneas.

### Etapas 15–16: Edición de escenas
Cámara de escena con paneo/zoom, fotogramas clave de la cámara con interpolación, deshacer/rehacer de la escena con historial completo de instantáneas, reversión en caso de fallo de la sincronización del backend.

### Etapas 17–24: Origen e inspección
Origen de la escena persistido con 20 tipos de operaciones, inspección detallada con fragmentos capturados antes y después, resúmenes de valores estructurados, motor de comparación de escenas, flujos de trabajo de previsualización de restauración.

### Etapas 25–26: Restauración y restauración selectiva
Contrato de restauración de escenas con derivación pura, restauración selectiva por dominio (instancias, cámara, fotogramas clave, reproducción), configuración de reproducción a través de una interfaz limpia con deshacer/rehacer.

### Etapas 27–28: Editor de sprites
Editor de sprites solo para la interfaz de usuario: contrato del documento, lienzo de píxeles con lápiz/borrador/relleno/cuentagotas, fotogramas con vista previa de fotogramas, selección con portapapeles, importación/exportación de hojas de sprites, atajos de teclado, zoom/cuadrícula, panel de paleta.

### Etapa 29: Previsualización de animación
Contrato del reproductor de animación, interfaz de usuario de reproducción con barra de desplazamiento y atajo de espacio, edición de la duración del fotograma en línea con preajustes, supresión de la vista previa de fotogramas durante la reproducción.

### Etapa 30: Capas y flujo de trabajo de capas
Tipo de capa SpriteLayer, buffers de píxeles con clave de layerId, composición alfa de flattenLayers, seguimiento de activeLayerId, panel de capas con operaciones CRUD/visibilidad/renombrar/reordenar, composición de trazos preliminares en todas las capas visibles, exportación de capas múltiples.

## Ejecución de la aplicación

### Requisitos previos
- Node.js 20+
- pnpm 9+
- Rust 1.75+ (a través de [rustup](https://rustup.rs/))
- Requisitos previos de Tauri v2 para tu plataforma

### Instalación

```bash
pnpm install
```

### Ejecutar la aplicación de escritorio

```bash
pnpm dev
```

### Verificación de tipos

```bash
pnpm typecheck
```

### Verificación de Rust

```bash
cd apps/desktop/src-tauri
cargo check
```

## Soporte de exportación

### Editor de lienzo (Rust)
- **Imagen PNG del fotograma actual** — imagen compuesta única.
- **Secuencia PNG** — archivos numerados (name_0001.png, name_0002.png, ...).
- **Tira de sprites** — tira de imagen única, horizontal o vertical.
- **Hoja de clips** — hoja de sprites creada a partir de definiciones de clips, con un manifiesto opcional.
- **Hoja de todos los clips** — hoja combinada de todos los clips válidos.
- **Paquete de recursos** — carpeta o archivo ZIP que contiene imágenes, manifiestos y una miniatura de vista previa.
- **Paquete de catálogo** — empaquetado de múltiples recursos con subcarpetas para cada recurso.

### Editor de sprites (interfaz de usuario)
- **Tira de sprites** — tira horizontal con todas las capas visibles combinadas para cada fotograma.
- **Fotograma actual** — combinación de las capas visibles.

Las exportaciones utilizan solo las capas visibles combinadas. El efecto de "piel de cebolla", el estado de reproducción y las superposiciones temporales del editor no se incluyen en la salida.

## Documentación

Consulte el [manual](site/src/content/docs/handbook/) para obtener más detalles:

- [Primeros pasos](site/src/content/docs/handbook/getting-started.md)
- [Arquitectura](site/src/content/docs/handbook/architecture.md)
- [Referencia de la API](site/src/content/docs/handbook/reference.md)

## Hoja de ruta

Prioridades a corto plazo:

- Modo de paleta indexada con reglas de contraste y edición de rampas.
- Integración de asistencia de IA (Ollama local + ComfyUI para tareas de generación limitadas).
- Espacio de trabajo de análisis de movimiento con superposiciones de zancada/contacto/centro de masa.
- Motor de validación con acciones de corrección.

## Objetivos no incluidos

GlyphStudio no pretende ser:

- Un editor de imágenes genérico.
- Una aplicación sencilla para navegadores.
- Un envoltorio de indicaciones de IA que adivina el arte.
- Un lienzo confuso donde el estado de la interfaz de usuario y la verdad del backend se desincronizan.

## Seguridad

GlyphStudio es una aplicación **solo para escritorio**. No realiza solicitudes de red, recopila datos de telemetría ni maneja secretos.

- **Datos accedidos:** archivos de sprites locales (.glyph, .pxs, .png), archivos de autoguardado/recuperación en el directorio de datos de la aplicación.
- **Datos NO accedidos:** no hay red, no hay nube, no hay API remotas, no hay cuentas de usuario.
- **Permisos:** acceso al sistema de archivos limitado a los directorios seleccionados por el usuario a través de los diálogos de archivos nativos de Tauri v2.
- No se recopila ni se envía **telemetría**.

Consulte [SECURITY.md](SECURITY.md) para informar sobre vulnerabilidades.

## Licencia

[MIT](LICENSE)

---

Creado por <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>.
