import { MonitorX } from 'lucide-react';
import { useEffect } from 'react';
import { MapProblem } from '@/shared/ui/MapProblem';

/**
 * The scene couldn't start: no WebGL, or it threw. Reloading won't fix either, so there's no button; it says what
 * still works instead (text-only mode, S11, comes later). Tells the parent so "Loading the campus…" goes away.
 */
export function MapFailed({ onShow }: { onShow: () => void }) {
  useEffect(onShow, [onShow]);
  return (
    <MapProblem
      icon={<MonitorX className="size-10" strokeWidth={2} />}
      title="This phone can't show the 3D map"
      line="You can still search for rooms and buildings."
    />
  );
}
