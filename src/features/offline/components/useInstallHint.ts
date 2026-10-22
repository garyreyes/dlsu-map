import { useCallback, useState } from 'react';
import { isIos, shouldShowInstallHint } from '../install';

/** localStorage key: set once the student closes the hint, so it never comes back. */
const KEY = 'dlsu-map.install-hint-dismissed';

// Storage can be missing or throw (private modes, blocked site data). A failure only means the hint may show again.
function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // Not remembered; the state below still hides it for this page.
  }
}

function isStandalone(): boolean {
  const nav = navigator as { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

/** The iPhone/iPad "Add to Home Screen" hint (user-flows §4): `show` it after the first save until closed;
 *  `dismiss` closes it for good. */
export function useInstallHint(saved: boolean): { show: boolean; dismiss: () => void } {
  const [dismissed, setDismissed] = useState(readDismissed);
  const dismiss = useCallback(() => {
    writeDismissed();
    setDismissed(true);
  }, []);
  const show = shouldShowInstallHint({
    ios: isIos(navigator.userAgent, navigator.maxTouchPoints),
    standalone: isStandalone(),
    saved,
    dismissed,
  });
  return { show, dismiss };
}
