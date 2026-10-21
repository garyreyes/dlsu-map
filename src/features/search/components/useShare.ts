import { useCallback, useEffect, useState } from 'react';
import type { RoomHit } from '../search-index';
import { shareLink, shareTitle } from '../share';

export type ShareStatus = 'idle' | 'copied' | 'failed';

/** How long "Link copied" stays, in ms. */
const SAID_FOR = 2000;

/**
 * Share on a room card (user-flows §3.4, D40): the phone's share sheet with only the destination's link. Where there
 * is no share sheet (desktop, some in-app browsers) or it refuses, the link is copied instead and the card says so.
 * Closing the share sheet without sharing says nothing.
 */
export function useShare(room: RoomHit) {
  // `n` counts each time something is said, so a second "Link copied" restarts its 2 s.
  const [said, setSaid] = useState<{ status: ShareStatus; n: number }>({ status: 'idle', n: 0 });
  const say = useCallback((status: ShareStatus) => {
    setSaid((s) => ({ status, n: s.n + 1 }));
  }, []);
  useEffect(() => {
    if (said.status === 'idle') return;
    const t = window.setTimeout(() => {
      setSaid((s) => ({ ...s, status: 'idle' }));
    }, SAID_FOR);
    return () => {
      window.clearTimeout(t);
    };
  }, [said]);

  const share = useCallback(async () => {
    const url = shareLink(window.location.origin, room.code);
    if ('share' in navigator) {
      try {
        await navigator.share({ text: shareTitle(room), url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // closed without sharing
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      say('copied');
    } catch {
      say('failed');
    }
  }, [room, say]);

  return { status: said.status, share };
}
