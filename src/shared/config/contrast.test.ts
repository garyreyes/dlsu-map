import { describe, expect, it } from 'vitest';
import { compositeOver, contrastRatio, parseColor, relativeLuminance } from './contrast';

describe('parseColor', () => {
  it('reads #rgb, #rrggbb, rgb() and rgba()', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#17201b')).toEqual({ r: 23, g: 32, b: 27, a: 1 });
    expect(parseColor('rgba(0, 64, 32, 0.13)')).toEqual({ r: 0, g: 64, b: 32, a: 0.13 });
    expect(parseColor('rgb(1 2 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 });
  });
  it('rejects anything else', () => {
    expect(() => parseColor('oklch(0.5 0.1 150)')).toThrow();
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white, either order', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 10);
  });
  it('is 1 for the same colour', () => {
    expect(contrastRatio('#175f3c', '#175f3c')).toBeCloseTo(1, 10);
  });
  it('matches known values', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});

describe('compositeOver', () => {
  it('blends a translucent colour over an opaque one', () => {
    expect(compositeOver('rgba(0, 0, 0, 0.5)', '#ffffff')).toEqual({ r: 128, g: 128, b: 128, a: 1 });
    expect(compositeOver('#ff0000', '#00ff00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(compositeOver('rgba(255, 255, 255, 0)', '#123456')).toEqual({ r: 18, g: 52, b: 86, a: 1 });
  });
});
