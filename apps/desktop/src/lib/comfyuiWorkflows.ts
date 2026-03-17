/**
 * ComfyUI workflow templates for pixel art sprite generation.
 *
 * These are API-format workflows (node graph as JSON).
 * The user provides a prompt and size; we fill the template.
 *
 * Default checkpoint: "pixelArtDiffusion14_v14.safetensors"
 * Users should install a pixel art checkpoint in ComfyUI/models/checkpoints.
 */

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  defaultPrompt: string;
  negativePrompt: string;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'pixel-character',
    name: 'Pixel Character',
    description: 'Single character sprite, centered, transparent-ready',
    defaultPrompt: 'pixel art character sprite, front view, full body, centered, clean pixel art style, detailed, high quality',
    negativePrompt: 'blurry, photograph, realistic, 3d render, text, watermark, border, frame, multiple characters, background clutter',
  },
  {
    id: 'pixel-prop',
    name: 'Pixel Prop',
    description: 'Item, weapon, or object sprite',
    defaultPrompt: 'pixel art item sprite, centered, clean pixel art style, detailed, high quality, game asset',
    negativePrompt: 'blurry, photograph, realistic, 3d render, text, watermark, border, frame, character, person, background clutter',
  },
  {
    id: 'pixel-tileset',
    name: 'Pixel Tile',
    description: 'Seamless tileable texture',
    defaultPrompt: 'pixel art tileable texture, seamless, top-down view, clean pixel art style, detailed, game asset',
    negativePrompt: 'blurry, photograph, realistic, 3d render, text, watermark, border, frame, character, person, non-seamless edges',
  },
];

/**
 * Build a ComfyUI API-format workflow JSON for txt2img generation.
 *
 * This produces a standard KSampler → VAEDecode → SaveImage pipeline.
 * Generation happens at 512×512 (for diffusion quality) and the frontend
 * downscales to the target sprite size after import.
 *
 * @param prompt - positive prompt text
 * @param negative - negative prompt text
 * @param checkpoint - model filename in ComfyUI/models/checkpoints/
 * @param seed - random seed (-1 for random)
 * @param steps - sampling steps (default 20)
 * @param cfg - classifier-free guidance scale (default 7)
 */
export function buildTxt2ImgWorkflow(
  prompt: string,
  negative: string,
  checkpoint: string,
  seed: number = -1,
  steps: number = 20,
  cfg: number = 7,
): Record<string, unknown> {
  const actualSeed = seed === -1 ? Math.floor(Math.random() * 2 ** 32) : seed;

  return {
    // Node 1: Load Checkpoint
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: checkpoint,
      },
    },
    // Node 2: CLIP Text Encode (Positive)
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: prompt,
        clip: ['1', 1],
      },
    },
    // Node 3: CLIP Text Encode (Negative)
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: negative,
        clip: ['1', 1],
      },
    },
    // Node 4: Empty Latent Image (512x512)
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: 512,
        height: 512,
        batch_size: 1,
      },
    },
    // Node 5: KSampler
    '5': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
        seed: actualSeed,
        steps,
        cfg,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1.0,
      },
    },
    // Node 6: VAE Decode
    '6': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['5', 0],
        vae: ['1', 2],
      },
    },
    // Node 7: Save Image
    '7': {
      class_type: 'SaveImage',
      inputs: {
        images: ['6', 0],
        filename_prefix: 'glyphstudio',
      },
    },
  };
}

export const DEFAULT_CHECKPOINT = 'pixelArtDiffusion14_v14.safetensors';
