// What the offline line and the "open once" screen show has one right answer per state (user-flows §4, O1 and O2).
// A wrong answer either hides that the app isn't saved yet (the student walks into a dead zone thinking it's safe)
// or blocks a working app with a full-screen message. Every phase and every view is reached at least once here.
import { describe, expect, it } from 'vitest';
import { nextPhase, offlineView, type SaveEvent, type SavePhase } from './status';

describe('nextPhase', () => {
  it('starts saving when the first registration finds no copy yet', () => {
    expect(nextPhase('checking', 'registered-saving')).toBe('saving');
    expect(nextPhase('not-saved', 'registered-saving')).toBe('saving');
  });

  it('knows a copy made on an earlier visit is already saved', () => {
    expect(nextPhase('checking', 'registered-saved')).toBe('saved');
  });

  it('marks the first save as finished during this visit', () => {
    expect(nextPhase('saving', 'installed')).toBe('saved-now');
    // The install can finish before the registration call reports back.
    expect(nextPhase('checking', 'installed')).toBe('saved-now');
  });

  it('keeps a finished first save when the registration reports back late', () => {
    expect(nextPhase('saved-now', 'registered-saved')).toBe('saved-now');
    expect(nextPhase('saved-now', 'registered-saving')).toBe('saved-now');
  });

  it('never calls an update installing over an old copy a first save', () => {
    expect(nextPhase('saved', 'installed')).toBe('saved');
    expect(nextPhase('saved', 'registered-saving')).toBe('saved');
  });

  it('falls back to not saved when registering or installing fails', () => {
    expect(nextPhase('checking', 'failed')).toBe('not-saved');
    expect(nextPhase('saving', 'failed')).toBe('not-saved');
  });

  it('keeps a saved copy when a later update fails', () => {
    expect(nextPhase('saved', 'failed')).toBe('saved');
    expect(nextPhase('saved-now', 'failed')).toBe('saved-now');
  });

  it('stays unsupported whatever happens', () => {
    const events: SaveEvent[] = ['registered-saving', 'registered-saved', 'installed', 'failed'];
    for (const event of events) expect(nextPhase('unsupported', event)).toBe('unsupported');
  });
});

describe('offlineView', () => {
  it('asks for one open with internet when nothing is saved and there is no signal (O1)', () => {
    expect(offlineView('not-saved', false, false)).toBe('open-once-online');
    expect(offlineView('saving', false, false)).toBe('open-once-online');
  });

  it('shows the saving line while the first copy downloads with signal (O2)', () => {
    expect(offlineView('saving', true, false)).toBe('saving');
  });

  it('shows "Ready offline" once, right after the first save, until its 3 s are up (O2)', () => {
    expect(offlineView('saved-now', true, false)).toBe('ready-offline');
    expect(offlineView('saved-now', false, false)).toBe('ready-offline');
    expect(offlineView('saved-now', true, true)).toBe('none');
  });

  it('shows nothing once the app is saved, online or not', () => {
    expect(offlineView('saved', true, false)).toBe('none');
    expect(offlineView('saved', false, false)).toBe('none');
  });

  it('shows nothing with signal when a save failed: the next open tries again', () => {
    expect(offlineView('not-saved', true, false)).toBe('none');
  });

  it('shows nothing before the registration answers, so a saved app never flashes O1', () => {
    expect(offlineView('checking', false, false)).toBe('none');
    expect(offlineView('checking', true, false)).toBe('none');
  });

  it('never promises a save the browser cannot make', () => {
    expect(offlineView('unsupported', false, false)).toBe('none');
    expect(offlineView('unsupported', true, false)).toBe('none');
  });

  it('gives every phase a view', () => {
    const phases: SavePhase[] = ['unsupported', 'checking', 'not-saved', 'saving', 'saved-now', 'saved'];
    for (const phase of phases) expect(offlineView(phase, true, false)).toMatch(/^(none|saving|ready-offline)$/);
  });
});
