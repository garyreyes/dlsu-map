import { describe, expect, it } from 'vitest';
import { cardTop } from './card-top';

describe('cardTop', () => {
  it('leaves a third of the visible height as map', () => {
    expect(cardTop(844)).toBe(279);
    expect(cardTop(450)).toBe(149);
  });

  it('shrinks the map strip before the card', () => {
    expect(cardTop(388)).toBe(128);
    expect(cardTop(360)).toBe(100);
  });

  it('keeps the card at least 260px tall, which wins on a short screen', () => {
    expect(cardTop(330)).toBe(70);
    expect(cardTop(260)).toBe(0);
  });

  it('never goes above the top', () => {
    expect(cardTop(200)).toBe(0);
    expect(cardTop(0)).toBe(0);
  });
});
