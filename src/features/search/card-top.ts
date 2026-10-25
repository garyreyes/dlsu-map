// Where the phone search card's top edge sits (D55, v2-A1). Pure. Tests: card-top.test.ts.

/** The map strip left above the card is a third of the visible height... */
const STRIP_SHARE = 0.33;
/** ...but the card is never shorter than 260px (the bar plus a few rows), which wins on a short screen. A minimum
 * strip would never apply: a third drops under ~96px only below 291px, where the card's minimum already rules. */
const CARD_MIN = 260;

/** The card's top, in px from the top of the visible area. Fixed from the visible height, so it doesn't jump as
 * results change. */
export function cardTop(visibleHeight: number): number {
  return Math.max(0, Math.min(Math.round(visibleHeight * STRIP_SHARE), visibleHeight - CARD_MIN));
}
