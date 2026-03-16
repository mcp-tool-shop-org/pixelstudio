<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

Un studio de création de sprites axé sur la qualité, pour une édition précise des pixels, une animation image par image, et une assistance future pour la création de mouvements.

GlyphStudio est une application de bureau développée avec **Tauri v2**, **React** et **Rust**. Elle est conçue autour d'une règle simple : l'éditeur doit conserver le contrôle de l'œuvre, et l'automatisation doit rester subordonnée à l'artiste.

## État actuel

GlyphStudio est un éditeur de bureau fonctionnel, avec 32 étapes disponibles et 2 776 tests réussis.

### Éditeur de zone de dessin (backend en Rust)
- Zone de dessin avec rendu précis des pixels (voisin le plus proche)
- Calques avec visibilité, verrouillage, opacité, renommage, réorganisation
- Dessin basé sur des traits avec annuler/refaire
- Sélection rectangulaire, actions de presse-papiers et flux de travail de transformation
- Chronologie multi-images avec annuler/refaire isolé par image
- Superpositions "peau de poisson" pour l'édition d'images adjacentes
- Commandes de lecture avec FPS et support de la boucle
- Assistance pour les mouvements avec génération de propositions précises
- Système d'ancrage avec hiérarchie, atténuation et modèles de mouvements secondaires
- Préférences de mouvement avec application groupée sur plusieurs images
- Définitions de clips avec point de pivot, étiquettes et validation
- Exportation de feuilles de sprites avec manifeste (formats d'exécution natifs et génériques)
- Catalogue d'éléments avec miniatures, recherche et regroupement
- Sauvegarde/chargement du projet, récupération automatique et migration du schéma

### Compositeur de scènes (frontend + Rust)
- Composition de scènes avec instances d'éléments, ordre Z, visibilité, opacité, parallaxe
- Système de caméra avec panoramique, zoom, animation par image clé et dérivation de plans
- Système de création de personnages avec emplacements, préférences, validation et pont vers la scène
- Annuler/refaire de la scène avec historique complet et restauration en cas d'échec de synchronisation
- Provenance persistante avec inspection détaillée de 20 types d'opérations
- Comparaison et aperçu de restauration de scènes

### Éditeur de sprites (frontend uniquement)
- Éditeur de pixels autonome avec outils de crayon, gomme, remplissage, pipette
- Édition multi-calques avec visibilité, renommage et réorganisation par calque
- Composition alpha avec aperçu de trait en temps réel sur tous les calques
- Gestion des images avec peau de poisson, lecture, barre de défilement et durée par image
- Sélection rectangulaire avec copier/couper/coller/supprimer
- Importation/exportation de feuilles de sprites avec aplatissement multi-calques
- Panneau de palette avec sélecteur de couleurs et échange de premier plan/arrière-plan

Ce n'est pas un simple outil pour navigateur ou une machine à prompts. C'est un éditeur de bureau natif où Rust gère la vérité des pixels de la zone de dessin, et le frontend gère la vérité des pixels des sprites.

## Philosophie du produit

GlyphStudio est construit autour de quatre principes :

1. **Édition déterministe**
Chaque modification de pixel doit être conforme, inspectable et réversible.

2. **Intelligence artificielle subordonnée**
L'automatisation doit aider au flux de travail sans remplacer le contrôle créatif.

3. **Structure axée sur l'animation**
Les images, les opérations de chronologie, la peau de poisson et la lecture sont des concepts fondamentaux de l'éditeur, et non des ajouts ultérieurs.

4. **État fiable**
La sauvegarde/chargement, l'autosave, la récupération, l'annuler/refaire et la migration sont considérés comme des fonctionnalités du produit, et non comme des tâches de maintenance.

## Architecture

### Frontend (React + TypeScript)
- 17+ stores Zustand organisés par domaine
- Rendu HTML de la zone de dessin pour les deux éditeurs
- Interface utilisateur de l'éditeur de zone de dessin : calques, chronologie, sélection, lecture, constructeur de personnages, compositeur de scènes
- Éditeur de sprites : édition de pixels autonome avec tampons de pixels gérés par le frontend
- Composition alpha via `flattenLayers` pour l'édition de sprites multi-calques

### Backend (Rust)
- Tampons de pixels et composition de calques pour l'éditeur de canevas.
- Transactions de traits avec aperçus avant/après.
- Sessions de sélection/transformation.
- Persistance du projet, sauvegarde automatique, récupération en cas de plantage.
- Pipelines d'exportation (PNG, feuille de sprites, découpe, regroupement).
- Moteur de composition de scène avec caméra et lecture.
- Catalogue d'éléments avec génération de miniatures.
- 166 commandes Tauri implémentées.

### Interface utilisateur de bureau
- Tauri v2

## Structure de monorepo

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

## Étapes implémentées

### Étapes 1 à 3 : Base de l'éditeur
Canevas, calques, outils de dessin, annuler/refaire, sélection, transformations, chronologie, superposition d'images, lecture, opérations sur les images, exportation PNG/en bande, persistance du projet, sauvegarde automatique, récupération en cas de plantage.

### Étape 4A : Assistance pour l'animation
Sessions d'animation contraintes, génération de propositions déterministe, aperçu avec des bandes d'images miniatures, sécurité des sessions, application des propositions à la chronologie.

### Étapes 5 à 8 : Amélioration de l'animation
Points d'ancrage avec hiérarchie et atténuation, modèles d'animation secondaires (vent, oscillation, balancement, bruissement), bac à sable d'animation avec métriques d'analyse, préréglages d'animation avec application en lot.

### Étapes 9 à 10 : Découpes, exportation, base de la scène
Définitions de découpes avec point de pivot/étiquettes/validation, exportation de feuilles de sprites avec manifestes, catalogue d'éléments avec miniatures, regroupement, composition de scène avec instances et ordre de superposition.

### Étapes 11 à 14 : Système de personnages
Créations de personnages avec 12 emplacements pour les régions du corps, sélecteur de préréglages avec niveaux de compatibilité, validation de la création, bibliothèque de créations avec persistance, pont entre le personnage et la scène avec placement d'instantanés.

### Étapes 15 à 16 : Édition de scène
Caméra de scène avec panoramique/zoom, images clés de la caméra avec interpolation, annuler/refaire de la scène avec historique complet des instantanés, restauration en cas d'échec de la synchronisation du serveur.

### Étapes 17 à 24 : Provenance et inspection
Provenance de la scène persistante avec 20 types d'opérations, inspection détaillée avec aperçus avant/après capturés, résumés structurés de valeurs, moteur de comparaison de scènes, restauration des flux de travail d'aperçu.

### Étapes 25 à 26 : Restauration et restauration sélective
Contrat de restauration de scène avec dérivation pure, restauration sélective par domaine (instances, caméra, images clés, lecture), configuration de la lecture via une interface claire avec annuler/refaire.

### Étapes 27 à 28 : Éditeur de sprites
Éditeur de sprites uniquement côté client : contrat de document, canevas de pixels avec crayon/gomme/remplissage/pipette, images avec superposition d'images, sélection avec presse-papiers, importation/exportation de feuilles de sprites, raccourcis clavier, zoom/grille, panneau de palette.

### Étape 29 : Aperçu de l'animation
Contrat du lecteur d'animation, interface utilisateur de lecture avec barre de défilement et raccourci Espace, édition de la durée de l'image en ligne avec préréglages, suppression de la superposition d'images pendant la lecture.

### Étape 30 : Calques et flux de travail des calques
Type de calque SpriteLayer, tampons de pixels indexés par layerId, composition alpha des calques aplatés, suivi de l'activeLayerId, panneau de calques avec CRUD/visibilité/renommage/réorganisation, composition des traits préliminaires sur tous les calques visibles, exportation multi-calques.

## Exécution de l'application

### Prérequis
- Node.js 20+
- pnpm 9+
- Rust 1.75+ (via [rustup](https://rustup.rs/))
- Prérequis de Tauri v2 pour votre plateforme

### Installation

```bash
pnpm install
```

### Exécuter l'application de bureau

```bash
pnpm dev
```

### Vérification du typage

```bash
pnpm typecheck
```

### Vérification Rust

```bash
cd apps/desktop/src-tauri
cargo check
```

## Prise en charge de l'exportation

### Éditeur de canevas (Rust)
- **Image PNG actuelle** — image composite unique
- **Séquence PNG** — fichiers numérotés (name_0001.png, name_0002.png, ...)
- **Bande de sprites** — bande d'images unique, horizontale ou verticale
- **Feuille de clips** — feuille de sprites provenant des définitions de clips, avec un fichier manifest optionnel
- **Feuille de tous les clips** — feuille combinée de tous les clips valides
- **Bundle d'assets** — dossier ou fichier zip contenant des images, des fichiers manifest et une miniature de prévisualisation
- **Bundle de catalogue** — regroupement de plusieurs assets avec des sous-dossiers pour chaque asset

### Éditeur de sprites (interface utilisateur)
- **Bande de sprites** — bande horizontale avec toutes les calques visibles aplaties pour chaque image
- **Image actuelle** — image aplatie des calques visibles

Les exportations utilisent uniquement les calques visibles et composés. L'effet "onion skin", l'état de lecture et les superpositions temporaires de l'éditeur ne sont pas inclus dans la sortie.

## Documentation

Consultez le [manuel](site/src/content/docs/handbook/) pour plus de détails :

- [Premiers pas](site/src/content/docs/handbook/getting-started.md)
- [Architecture](site/src/content/docs/handbook/architecture.md)
- [Référence de l'API](site/src/content/docs/handbook/reference.md)

## Feuille de route

Priorités à court terme :

- Mode de palette indexée avec règles de contraste et édition des dégradés
- Intégration de l'assistance par IA (Ollama local + ComfyUI pour les tâches de génération limitées)
- Espace de travail d'analyse de la locomotion avec superpositions de foulée/contact/centre de masse
- Moteur de validation avec actions de correction

## Objectifs non poursuivis

GlyphStudio ne vise pas à être :

- Un éditeur d'images générique
- Une application simple pour navigateur
- Un wrapper pour les invites d'IA qui devine l'art
- Une toile où l'état de l'interface utilisateur et la réalité du backend divergent

## Sécurité

GlyphStudio est une application **exclusivement pour ordinateur de bureau**. Elle ne fait aucune requête réseau, ne collecte aucune donnée télémétrique et ne gère aucun secret.

- **Données consultées :** fichiers de sprites locaux (.glyph, .pxs, .png), fichiers d'enregistrement automatique/de récupération dans le répertoire des données de l'application.
- **Données NON consultées :** aucun réseau, aucun cloud, aucune API distante, aucun compte utilisateur.
- **Permissions :** accès au système de fichiers limité aux répertoires sélectionnés par l'utilisateur via les boîtes de dialogue de fichiers natives Tauri v2.
- **Aucune donnée télémétrique** n'est collectée ou envoyée.

Consultez [SECURITY.md](SECURITY.md) pour signaler les vulnérabilités.

## Licence

[MIT](LICENSE)

---

Développé par <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
