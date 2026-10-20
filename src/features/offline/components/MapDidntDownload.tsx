import { CloudDownload } from 'lucide-react';
import { useState } from 'react';
import { canReachSite } from '@/shared/data/reach';
import { MapProblem } from '@/shared/ui/MapProblem';
import { useOnline } from './useOfflineStatus';

/**
 * The map's chunk didn't download, so there's no saved copy to fall back on. A reload with no real connection would
 * land on the browser's error page and lose the app, so "Try again" checks the site answers first, and the button
 * only shows while the phone reports signal at all.
 */
export function MapDidntDownload() {
  const online = useOnline();
  const [unreachable, setUnreachable] = useState(false);

  const tryAgain = () => {
    void canReachSite().then((ok) => {
      if (ok) window.location.reload();
      else setUnreachable(true);
    });
  };

  let line = 'Search still works.';
  if (!online) line = 'Connect to Wi-Fi or mobile data to load it. Search still works.';
  else if (unreachable) line = "Still can't reach the site. Check your Wi-Fi or data, then try again.";

  return (
    <MapProblem
      icon={<CloudDownload className="size-10" strokeWidth={2} />}
      title="The map didn't download"
      line={line}
      action={online ? { label: 'Try again', onClick: tryAgain } : undefined}
    />
  );
}
