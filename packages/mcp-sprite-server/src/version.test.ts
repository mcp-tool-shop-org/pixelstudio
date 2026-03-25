import { describe, it, expect } from 'vitest';
import { VERSION, NAME } from './version.js';

describe('version', () => {
  it('exports a semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('is at least 1.0.0', () => {
    const major = parseInt(VERSION.split('.')[0], 10);
    expect(major).toBeGreaterThanOrEqual(1);
  });

  it('exports the package name', () => {
    expect(NAME).toBe('@glyphstudio/mcp-sprite-server');
  });
});
