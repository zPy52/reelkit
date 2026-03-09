import { describe, expect, it } from 'vitest';
import { anchorOffset, parseDim, resolvePlacement } from '@/renderer/placement';

describe('placement math', () => {
  it('parses percentages relative to the target dimension', () => {
    expect(parseDim('25%', 800)).toBe(200);
    expect(parseDim(120, 800)).toBe(120);
  });

  it('returns the correct anchor offsets', () => {
    expect(anchorOffset('top-left', 200, 100)).toEqual([0, 0]);
    expect(anchorOffset('center', 200, 100)).toEqual([100, 50]);
    expect(anchorOffset('bottom-right', 200, 100)).toEqual([200, 100]);
  });

  it('resolves canvas placement from intrinsic media size and percentages', () => {
    const placement = resolvePlacement(
      {
        x: '50%',
        y: '50%',
        width: '40%',
        height: '20%',
        anchor: 'center',
        rotation: 12,
        opacity: 0.6,
      },
      1000,
      600,
      320,
      180,
    );

    expect(placement).toEqual({
      x: 300,
      y: 240,
      width: 400,
      height: 120,
      rotation: 12,
      opacity: 0.6,
    });
  });
});
