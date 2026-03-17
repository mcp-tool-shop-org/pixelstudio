import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TransformBar } from '../components/TransformBar';
import { useSelectionStore } from '@glyphstudio/state';

function seedTransform(overrides?: Partial<{
  isTransforming: boolean;
  sourceX: number; sourceY: number;
  payloadWidth: number; payloadHeight: number;
  offsetX: number; offsetY: number;
}>) {
  const o = overrides ?? {};
  const isTransforming = o.isTransforming ?? true;
  useSelectionStore.setState({
    isTransforming,
    transformPreview: isTransforming ? {
      sourceX: o.sourceX ?? 4,
      sourceY: o.sourceY ?? 8,
      payloadWidth: o.payloadWidth ?? 16,
      payloadHeight: o.payloadHeight ?? 10,
      offsetX: o.offsetX ?? 2,
      offsetY: o.offsetY ?? 3,
      payloadData: [],
    } : null,
  });
}

describe('TransformBar', () => {
  afterEach(cleanup);

  it('renders nothing when not transforming', () => {
    seedTransform({ isTransforming: false });
    const { container } = render(<TransformBar />);
    expect(container.firstChild).toBeNull();
  });

  it('shows bar when transforming', () => {
    seedTransform();
    render(<TransformBar />);
    expect(screen.getByText('Transform')).toBeInTheDocument();
  });

  describe('numeric HUD', () => {
    it('shows HUD when transformPreview exists', () => {
      seedTransform();
      render(<TransformBar />);
      expect(screen.getByTestId('transform-bar-hud')).toBeInTheDocument();
    });

    it('no HUD when not transforming', () => {
      seedTransform({ isTransforming: false });
      render(<TransformBar />);
      expect(screen.queryByTestId('transform-bar-hud')).toBeNull();
    });

    it('HUD x shows sourceX + offsetX', () => {
      seedTransform({ sourceX: 10, offsetX: 5 });
      render(<TransformBar />);
      expect(screen.getByTestId('hud-x').textContent).toContain('15');
    });

    it('HUD y shows sourceY + offsetY', () => {
      seedTransform({ sourceY: 3, offsetY: 7 });
      render(<TransformBar />);
      expect(screen.getByTestId('hud-y').textContent).toContain('10');
    });

    it('HUD size shows payloadWidth × payloadHeight', () => {
      seedTransform({ payloadWidth: 24, payloadHeight: 12 });
      render(<TransformBar />);
      expect(screen.getByTestId('hud-size').textContent).toContain('24');
      expect(screen.getByTestId('hud-size').textContent).toContain('12');
    });

    it('HUD reflects zero offset as sourceX/Y directly', () => {
      seedTransform({ sourceX: 8, sourceY: 4, offsetX: 0, offsetY: 0 });
      render(<TransformBar />);
      expect(screen.getByTestId('hud-x').textContent).toContain('8');
      expect(screen.getByTestId('hud-y').textContent).toContain('4');
    });
  });

  describe('action buttons', () => {
    it('renders all 4 transform buttons', () => {
      seedTransform();
      render(<TransformBar />);
      expect(screen.getByText('Flip H')).toBeInTheDocument();
      expect(screen.getByText('Flip V')).toBeInTheDocument();
      expect(screen.getByText('Rot CW')).toBeInTheDocument();
      expect(screen.getByText('Rot CCW')).toBeInTheDocument();
    });

    it('renders Commit and Cancel buttons', () => {
      seedTransform();
      render(<TransformBar />);
      expect(screen.getByText('Commit')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });
});
