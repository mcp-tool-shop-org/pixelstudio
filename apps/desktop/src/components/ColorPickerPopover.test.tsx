import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPickerPopover } from './ColorPickerPopover';
import type { RgbaColor } from '@glyphstudio/state';

const RED: RgbaColor = { r: 255, g: 0, b: 0, a: 255 };
const MID: RgbaColor = { r: 128, g: 64, b: 32, a: 255 };

afterEach(cleanup);

describe('ColorPickerPopover', () => {
  it('renders the popover', () => {
    render(<ColorPickerPopover color={RED} onChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('color-picker-popover')).toBeInTheDocument();
  });

  it('renders R, G, B sliders', () => {
    render(<ColorPickerPopover color={MID} onChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('cpp-slider-r')).toBeInTheDocument();
    expect(screen.getByTestId('cpp-slider-g')).toBeInTheDocument();
    expect(screen.getByTestId('cpp-slider-b')).toBeInTheDocument();
  });

  it('displays current channel values', () => {
    render(<ColorPickerPopover color={MID} onChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('64')).toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
  });

  it('calls onChange when R slider changes', () => {
    const onChange = vi.fn();
    render(<ColorPickerPopover color={MID} onChange={onChange} onClose={vi.fn()} />);
    const slider = screen.getByTestId('cpp-slider-r');
    fireEvent.change(slider, { target: { value: '200' } });
    expect(onChange).toHaveBeenCalledWith({ r: 200, g: 64, b: 32, a: 255 });
  });

  it('calls onChange when G slider changes', () => {
    const onChange = vi.fn();
    render(<ColorPickerPopover color={MID} onChange={onChange} onClose={vi.fn()} />);
    const slider = screen.getByTestId('cpp-slider-g');
    fireEvent.change(slider, { target: { value: '99' } });
    expect(onChange).toHaveBeenCalledWith({ r: 128, g: 99, b: 32, a: 255 });
  });

  it('calls onChange when B slider changes', () => {
    const onChange = vi.fn();
    render(<ColorPickerPopover color={MID} onChange={onChange} onClose={vi.fn()} />);
    const slider = screen.getByTestId('cpp-slider-b');
    fireEvent.change(slider, { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith({ r: 128, g: 64, b: 10, a: 255 });
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(<ColorPickerPopover color={RED} onChange={vi.fn()} onClose={onClose} />);
    await act(async () => {
      await userEvent.keyboard('{Escape}');
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onChange with parsed hex on blur', () => {
    const onChange = vi.fn();
    render(<ColorPickerPopover color={RED} onChange={onChange} onClose={vi.fn()} />);
    const hexInput = screen.getByTestId('cpp-hex');
    fireEvent.change(hexInput, { target: { value: '00ff80' } });
    fireEvent.blur(hexInput);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ r: 0, g: 255, b: 128 }));
  });

  it('calls onChange with parsed hex on Enter', () => {
    const onChange = vi.fn();
    render(<ColorPickerPopover color={RED} onChange={onChange} onClose={vi.fn()} />);
    const hexInput = screen.getByTestId('cpp-hex');
    fireEvent.change(hexInput, { target: { value: '4488cc' } });
    fireEvent.keyDown(hexInput, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ r: 0x44, g: 0x88, b: 0xcc }));
  });

  it('does not call onChange for invalid hex', () => {
    const onChange = vi.fn();
    render(<ColorPickerPopover color={RED} onChange={onChange} onClose={vi.fn()} />);
    const hexInput = screen.getByTestId('cpp-hex');
    fireEvent.change(hexInput, { target: { value: 'zzz' } });
    fireEvent.blur(hexInput);
    expect(onChange).not.toHaveBeenCalled();
  });
});
