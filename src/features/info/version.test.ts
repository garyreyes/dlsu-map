import { describe, expect, it } from 'vitest';
import { readableDate, versionText } from './version';

describe('readableDate', () => {
  it('writes the day without a leading zero and the month as a word', () => {
    expect(readableDate('2026-10-23')).toBe('23 Oct 2026');
    expect(readableDate('2027-01-05')).toBe('5 Jan 2027');
    expect(readableDate('2026-12-31')).toBe('31 Dec 2026');
  });

  it('returns anything that is not a date as it came', () => {
    expect(readableDate('dev')).toBe('dev');
    expect(readableDate('2026-13-01')).toBe('2026-13-01');
    expect(readableDate('2026-00-01')).toBe('2026-00-01');
  });
});

describe('versionText', () => {
  it('names the commit and the build date', () => {
    expect(versionText('3e305bc', '2026-10-23')).toBe('Version 3e305bc · built 23 Oct 2026');
  });
});
