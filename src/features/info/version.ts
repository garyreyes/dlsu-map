const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-10-23` → `23 Oct 2026`, the same on every phone whatever its language or time zone. Anything else is
 *  returned as it came, so a bad date shows up as itself rather than as a wrong one. */
export function readableDate(iso: string): string {
  const [, year, mm, dd] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) ?? [];
  const month = MONTHS[Number(mm) - 1];
  if (!year || !dd || !month) return iso;
  return `${String(Number(dd))} ${month} ${year}`;
}

/** The ⓘ sheet's version line: the commit it was built from and when (10b). */
export function versionText(commit: string, built: string): string {
  return `Version ${commit} · built ${readableDate(built)}`;
}
