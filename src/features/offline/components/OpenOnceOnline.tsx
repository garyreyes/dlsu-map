import { WifiOff } from 'lucide-react';

/**
 * O1: the app isn't saved on this phone and there's no signal, so it can't finish loading (user-flows §4). It
 * replaces the whole app. There's no reload button on purpose: with no signal and no saved copy, a reload lands on
 * the browser's own offline page and loses the app. useOfflineStatus reloads by itself when signal returns.
 */
export function OpenOnceOnline() {
  return (
    <main
      aria-labelledby="open-once-title"
      className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-surface px-8 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] text-center"
    >
      <WifiOff className="size-10 flex-none text-ink-3" strokeWidth={2} aria-hidden />
      {/* An alert, so a screen reader announces it when it replaces the app. */}
      <div role="alert" className="max-w-sm">
        <h1 id="open-once-title" className="m-0 text-lg font-[650] text-balance text-ink">
          Open this once with internet to save the map
        </h1>
        <p className="mt-2 mb-0 text-ink-2">
          Connect to Wi-Fi or mobile data. The map loads by itself, and after that it works with no signal.
        </p>
      </div>
    </main>
  );
}
