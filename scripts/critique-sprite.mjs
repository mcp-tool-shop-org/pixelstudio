#!/usr/bin/env node
/**
 * Visual AI Critique Loop — Stage 38
 *
 * Sends a sprite PNG (upscaled 8x nearest-neighbor) to a local Ollama
 * vision model and returns structured critique based on the rubric.
 *
 * Usage:
 *   node scripts/critique-sprite.mjs <path-to-png> [--model llava:13b] [--save]
 *
 * Options:
 *   --model <name>   Ollama model to use (default: llava:13b)
 *   --save           Save critique to docs/visual-recovery/critiques/
 *   --revision <n>   Revision number for saved filename
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { basename, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRITIQUES_DIR = resolve(__dirname, '..', 'docs', 'visual-recovery', 'critiques');

const CRITIQUE_PROMPT = `You are a pixel art critic evaluating a sprite for a sprite editor tool.

This is a sprite image upscaled with nearest-neighbor scaling so each pixel is clearly visible. Evaluate it honestly and critically.

Answer these questions in order:

1. FIRST GLANCE: What does this image read as on first glance? (one sentence — be specific: "a knight", "a blob", "a robot", etc.)

2. BIGGEST PROBLEM: What is the single biggest visual problem? (one sentence)

3. TOP 3 CHANGES: List exactly 3 concrete changes that would improve it most. Be specific about which pixels/areas need work, not vague.

4. SILHOUETTE TEST: If all interior color was removed and only the outline remained, would the shape still read as the intended subject? Why or why not?

5. SCORES (rate 1-5 each):
   - First-glance read:
   - Silhouette:
   - Proportion:
   - Pose/stance:
   - Value separation:
   - Material cues:
   - Noise/cluster quality:

6. VERDICT: Should this ship as-is? (yes/no and why)

Be harsh and specific. Reject vague praise. If it looks bad, say so plainly.`;

async function upscalePng(inputPath, scale = 8) {
  // Dynamic import to handle fast-png from the mcp-sprite-server package
  let encode, decode;
  try {
    const fastPng = await import('fast-png');
    encode = fastPng.encode;
    decode = fastPng.decode;
  } catch {
    // Try from mcp-sprite-server node_modules
    const fastPngPath = resolve(__dirname, '..', 'packages', 'mcp-sprite-server', 'node_modules', 'fast-png', 'lib', 'index.js');
    const fastPng = await import(`file:///${fastPngPath.replace(/\\/g, '/')}`);
    encode = fastPng.encode;
    decode = fastPng.decode;
  }

  const png = decode(readFileSync(inputPath));
  const sw = png.width * scale;
  const sh = png.height * scale;
  const out = new Uint8ClampedArray(sw * sh * 4);

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const sx = Math.floor(x / scale);
      const sy = Math.floor(y / scale);
      const si = (sy * png.width + sx) * 4;
      const di = (y * sw + x) * 4;
      out[di] = png.data[si];
      out[di + 1] = png.data[si + 1];
      out[di + 2] = png.data[si + 2];
      out[di + 3] = png.data[si + 3];
    }
  }

  return Buffer.from(encode({ width: sw, height: sh, data: out, channels: 4, depth: 8 }));
}

async function critiqueSprite(imagePath, model = 'llava:13b') {
  // Upscale to 8x so the vision model can see individual pixels
  const upscaled = await upscalePng(imagePath, 8);
  const base64 = upscaled.toString('base64');

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: CRITIQUE_PROMPT,
      images: [base64],
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 1024,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

// ── CLI ──

const args = process.argv.slice(2);
const imagePath = args.find(a => !a.startsWith('--'));
const model = args.includes('--model') ? args[args.indexOf('--model') + 1] : 'llava:13b';
const save = args.includes('--save');
const revisionIdx = args.indexOf('--revision');
const revision = revisionIdx >= 0 ? args[revisionIdx + 1] : 'latest';

if (!imagePath) {
  console.error('Usage: node scripts/critique-sprite.mjs <path-to-png> [--model llava:13b] [--save] [--revision N]');
  process.exit(1);
}

if (!existsSync(imagePath)) {
  console.error(`File not found: ${imagePath}`);
  process.exit(1);
}

console.log(`Critiquing: ${imagePath}`);
console.log(`Model: ${model}`);
console.log(`Upscaling 8x for vision model...`);
console.log('---');

try {
  const critique = await critiqueSprite(imagePath, model);
  console.log(critique);

  if (save) {
    mkdirSync(CRITIQUES_DIR, { recursive: true });
    const slug = basename(imagePath, '.png');
    const filename = `${slug}-rev${revision}-${new Date().toISOString().slice(0, 10)}.md`;
    const content = `# Critique: ${slug} (revision ${revision})

**Date:** ${new Date().toISOString()}
**Model:** ${model}
**Source:** ${imagePath}

---

${critique}
`;
    const outPath = resolve(CRITIQUES_DIR, filename);
    writeFileSync(outPath, content, 'utf-8');
    console.log(`\n--- Saved to: ${outPath}`);
  }
} catch (err) {
  console.error('Critique failed:', err.message);
  process.exit(1);
}
