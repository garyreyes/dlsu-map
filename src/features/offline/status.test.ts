// What the offline line and the "open once" screen show has one right answer per state (user-flows §4, O1 and O2).
// A wrong answer either hides that the app isn't saved yet (the student walks into a dead zone thinking it's safe)
// or blocks a working app with a full-screen message. Every phase and every view is reached at least once here.
import { describe, expect, it } from 'vitest';
import { nextPhase, offlineView, shouldOfferUpdate, type SaveEvent, type SavePhase } from './status';

describe('shouldOfferUpdate', () => {
  // A reload mid-route would throw away the route (O4), so the prompt waits for home or Arrived.
  it('offers the reload on home and on Arrived once a new version is waiting', () => {
    expect(shouldOfferUpdate(true, 'home')).toBe(true);
    expect(shouldOfferUpdate(true, 'arrived')).toBe(true);
  });

  it('never offers it anywhere else, such as mid-route', () => {
    expect(shouldOfferUpdate(true, 'other')).toBe(false);
  });

  it('offers nothing when no new version is waiting', () => {
    expect(shouldOfferUpdate(false, 'home')).toBe(false);
    expect(shouldOfferUpdate(false, 'arrived')).toBe(false);
    expect(shouldOfferUpdate(false, 'other')).toBe(false);
  });
});

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

  it('treats a browser that refuses to register (private modes) as unable to save, not as a failed try', () => {
    expect(nextPhase('checking', 'refused')).toBe('unsupported');
    expect(nextPhase('not-saved', 'refused')).toBe('unsupported');
    expect(nextPhase('saved', 'refused')).toBe('saved');
  });

  it('stays unsupported whatever happens', () => {
    const events: SaveEvent[] = ['registered-saving', 'registered-saved', 'installed', 'failed', 'refused'];
    for (const event of events) expect(nextPhase('unsupported', event)).toBe('unsupported');
  });
});

describe('offlineView', () => {
  const online = { online: true, startedOffline: false, readyNoteDone: false };
  const lostSignal = { online: false, startedOffline: false, readyNoteDone: false };
  const openedOffline = { online: false, startedOffline: true, readyNoteDone: false };

  it('asks for one open with internet only when the app was opened with no signal and nothing downloaded (O1)', () => {
    expect(offlineView('not-saved', openedOffline)).toBe('open-once-online');
  });

  it('never blocks the app when the worker did download: the "no signal" reading at start was wrong', () => {
    expect(offlineView('saving', openedOffline)).toBe('saving-paused');
  });

  it('keeps the app and says saving is paused when signal drops after it opened', () => {
    expect(offlineView('saving', lostSignal)).toBe('saving-paused');
    expect(offlineView('not-saved', lostSignal)).toBe('saving-paused');
  });

  it('shows the saving line while the first copy downloads with signal (O2)', () => {
    expect(offlineView('saving', online)).toBe('saving');
  });

  it('shows "Ready offline" once, right after the first save, until its 3 s are up (O2)', () => {
    expect(offlineView('saved-now', online)).toBe('ready-offline');
    expect(offlineView('saved-now', lostSignal)).toBe('ready-offline');
    expect(offlineView('saved-now', { ...online, readyNoteDone: true })).toBe('none');
  });

  it('shows nothing once the app is saved, online or not', () => {
    expect(offlineView('saved', online)).toBe('none');
    expect(offlineView('saved', lostSignal)).toBe('none');
    expect(offlineView('saved', openedOffline)).toBe('none');
  });

  it('says so when a save failed with signal, instead of leaving the student to assume it worked', () => {
    expect(offlineView('not-saved', online)).toBe('not-saved');
  });

  it('shows nothing before the registration answers, so a saved app never flashes O1', () => {
    expect(offlineView('checking', online)).toBe('none');
    expect(offlineView('checking', openedOffline)).toBe('none');
  });

  it('warns, whatever the signal, when the browser can never save the app', () => {
    expect(offlineView('unsupported', online)).toBe('cannot-save');
    expect(offlineView('unsupported', lostSignal)).toBe('cannot-save');
    expect(offlineView('unsupported', openedOffline)).toBe('cannot-save');
  });

  it('reaches every view', () => {
    const phases: SavePhase[] = ['unsupported', 'checking', 'not-saved', 'saving', 'saved-now', 'saved'];
    const views = new Set(
      phases.flatMap((phase) => [online, lostSignal, openedOffline].map((when) => offlineView(phase, when))),
    );
    expect([...views].sort()).toEqual(
      ['cannot-save', 'none', 'not-saved', 'open-once-online', 'ready-offline', 'saving', 'saving-paused'].sort(),
    );
  });
});
