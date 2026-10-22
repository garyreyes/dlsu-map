import { describe, expect, it } from 'vitest';
import { isIos, shouldShowInstallHint, type InstallHintInput } from './install';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1';
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

describe('isIos', () => {
  it('is true for iPhone Safari', () => {
    expect(isIos(IPHONE_SAFARI, 5)).toBe(true);
  });
  it('is true for iPhone Chrome (CriOS)', () => {
    expect(isIos(IPHONE_CHROME, 5)).toBe(true);
  });
  it('is true for an iPad that reports a Mac user agent but has a touch screen', () => {
    expect(isIos(MAC_SAFARI, 5)).toBe(true);
  });
  it('is false for a desktop Mac with no touch screen', () => {
    expect(isIos(MAC_SAFARI, 0)).toBe(false);
  });
  it('is false for Android Chrome', () => {
    expect(isIos(ANDROID_CHROME, 5)).toBe(false);
  });
  it('is false for Windows Chrome', () => {
    expect(isIos(WINDOWS_CHROME, 0)).toBe(false);
  });
});

describe('shouldShowInstallHint', () => {
  const show: InstallHintInput = { ios: true, standalone: false, saved: true, dismissed: false };

  it('shows only on iOS, not installed, after the first save, not closed before', () => {
    expect(shouldShowInstallHint(show)).toBe(true);
  });
  it('hides when not iOS', () => {
    expect(shouldShowInstallHint({ ...show, ios: false })).toBe(false);
  });
  it('hides when already opened from the Home Screen', () => {
    expect(shouldShowInstallHint({ ...show, standalone: true })).toBe(false);
  });
  it('hides before the first save', () => {
    expect(shouldShowInstallHint({ ...show, saved: false })).toBe(false);
  });
  it('hides once dismissed', () => {
    expect(shouldShowInstallHint({ ...show, dismissed: true })).toBe(false);
  });
});
