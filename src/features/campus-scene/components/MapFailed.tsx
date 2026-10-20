import { useEffect } from 'react';
import { MAP_FAILED, MapMessage } from '@/shared/ui/MapMessage';

/** The map failed (no WebGL, or the scene threw). Tells the parent so "Loading the campus…" goes away. */
export function MapFailed({ onShow }: { onShow: () => void }) {
  useEffect(onShow, [onShow]);
  return <MapMessage text={MAP_FAILED} />;
}
