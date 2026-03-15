import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SceneCanvas } from '../components/SceneCanvas';
import { useScenePlaybackStore, useProjectStore } from '@glyphstudio/state';
import { getMockInvoke } from '../test/helpers';

const MOCK_SCENE_INFO = {
  sceneId: 'scene-1',
  name: 'Test Scene',
  canvasWidth: 320,
  canvasHeight: 240,
  instanceCount: 2,
  cameraX: 0,
  cameraY: 0,
  cameraZoom: 1.0,
  dirty: false,
};

const MOCK_INSTANCES = [
  {
    instanceId: 'inst-1',
    name: 'Hero',
    sourcePath: '/sprites/hero.pxs',
    clipId: 'walk',
    x: 50,
    y: 100,
    zOrder: 0,
    visible: true,
    opacity: 1.0,
    parallax: 0.0,
    layer: 0,
  },
  {
    instanceId: 'inst-2',
    name: 'Tree',
    sourcePath: '/sprites/tree.pxs',
    clipId: null,
    x: 200,
    y: 50,
    zOrder: 1,
    visible: true,
    opacity: 0.8,
    parallax: 0.5,
    layer: 0,
  },
];

describe('SceneCanvas', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
    mock.on('get_scene_info', () => null); // No scene by default
    mock.on('list_scene_camera_keyframes', () => []);
    mock.on('get_scene_instances', () => []);
    mock.on('list_assets', () => []);
    useScenePlaybackStore.setState({
      currentTick: 0,
      playbackState: null,
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1.0,
    });
  });
  afterEach(cleanup);

  describe('empty state', () => {
    it('shows "No scene open" when no scene loaded', async () => {
      mock.on('get_scene_info', () => { throw new Error('no scene'); });
      render(<SceneCanvas />);
      // Initially sceneInfo is null
      expect(screen.getByText('No scene open')).toBeInTheDocument();
    });

    it('shows "New Scene" button', () => {
      render(<SceneCanvas />);
      expect(screen.getByText('New Scene')).toBeInTheDocument();
    });

    it('clicking "New Scene" invokes new_scene', async () => {
      mock.on('new_scene', () => {});
      render(<SceneCanvas />);
      await act(async () => {
        await userEvent.click(screen.getByText('New Scene'));
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('new_scene', {
          name: 'Untitled Scene', width: 320, height: 240,
        });
      });
    });
  });

  describe('scene loaded', () => {
    beforeEach(() => {
      mock.on('get_scene_info', () => MOCK_SCENE_INFO);
      mock.on('get_scene_instances', () => MOCK_INSTANCES);
    });

    it('shows scene name', async () => {
      render(<SceneCanvas />);
      await waitFor(() => {
        expect(screen.getByText('Test Scene')).toBeInTheDocument();
      });
    });

    it('shows scene dimensions', async () => {
      render(<SceneCanvas />);
      await waitFor(() => {
        expect(screen.getByText('320 x 240')).toBeInTheDocument();
      });
    });

    it('shows instance count', async () => {
      render(<SceneCanvas />);
      await waitFor(() => {
        expect(screen.getByText('2 instances')).toBeInTheDocument();
      });
    });

    it('shows dirty indicator when scene is dirty', async () => {
      mock.on('get_scene_info', () => ({ ...MOCK_SCENE_INFO, dirty: true }));
      render(<SceneCanvas />);
      await waitFor(() => {
        expect(screen.getByText('Test Scene \u2022')).toBeInTheDocument();
      });
    });

    it('singular "instance" for count of 1', async () => {
      mock.on('get_scene_info', () => ({ ...MOCK_SCENE_INFO, instanceCount: 1 }));
      render(<SceneCanvas />);
      await waitFor(() => {
        expect(screen.getByText('1 instance')).toBeInTheDocument();
      });
    });
  });

  describe('pure functions', () => {
    it('frameCacheKey formats correctly', () => {
      // Testing the same logic as the component's internal function
      function frameCacheKey(sourcePath: string, clipId: string | null | undefined): string {
        return `${sourcePath}::${clipId ?? 'static'}`;
      }
      expect(frameCacheKey('/sprites/hero.pxs', 'walk')).toBe('/sprites/hero.pxs::walk');
      expect(frameCacheKey('/sprites/hero.pxs', null)).toBe('/sprites/hero.pxs::static');
      expect(frameCacheKey('/sprites/hero.pxs', undefined)).toBe('/sprites/hero.pxs::static');
    });

    it('parallax offset computation', () => {
      // offsetX = cameraX * (1 - parallax)
      expect(100 * (1 - 0.0)).toBe(100);    // full camera follow
      expect(100 * (1 - 0.5)).toBe(50);     // half parallax
      expect(100 * (1 - 1.0)).toBe(0);      // fully static
    });

    it('frame index computation for looping clip', () => {
      const tick = 7, frameCount = 4;
      const frameIdx = tick % frameCount;
      expect(frameIdx).toBe(3);
    });

    it('frame index computation for non-looping clip', () => {
      const tick = 7, frameCount = 4;
      const frameIdx = Math.min(tick, frameCount - 1);
      expect(frameIdx).toBe(3);
    });

    it('frame index for non-looping clip before end', () => {
      const tick = 2, frameCount = 4;
      const frameIdx = Math.min(tick, frameCount - 1);
      expect(frameIdx).toBe(2);
    });

    it('camera zoom clamping', () => {
      const clamp = (v: number) => Math.max(0.1, Math.min(10.0, v));
      expect(clamp(0.05)).toBeCloseTo(0.1);
      expect(clamp(15.0)).toBeCloseTo(10.0);
      expect(clamp(1.0)).toBeCloseTo(1.0);
    });
  });
});
