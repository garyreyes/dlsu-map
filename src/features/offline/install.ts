// The "Add to Home Screen" hint (shown after the first save, until the student closes it) for iPhone and iPad (user-flows §4, D10). Pure, so every case is tested
// without a real phone; components/useInstallHint.ts feeds it. Android needs no hint: Chrome offers to install.

/** What decides the hint. `ios`: the phone is an iPhone or iPad, in any browser. `standalone`: already opened from
 *  the Home Screen. `saved`: the first offline copy is complete. `dismissed`: the student closed the hint before. */
export interface InstallHintInput {
  ios: boolean;
  standalone: boolean;
  saved: boolean;
  dismissed: boolean;
}

/** Whether a user agent and touch-point count are an iPhone or iPad. iPadOS reports a Mac user agent, so a "Mac"
 *  with a touch screen counts as an iPad. */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/** Whether to show the hint: on iOS, not yet installed, only after the first save, until closed (then never again). */
export function shouldShowInstallHint(input: InstallHintInput): boolean {
  return input.ios && !input.standalone && input.saved && !input.dismissed;
}
