import { describe, it, expect } from 'vitest';

describe('harness smoke test', () => {
  it('vitest + happy-dom is functional', () => {
    expect(document.createElement('div')).toBeTruthy();
  });
});
