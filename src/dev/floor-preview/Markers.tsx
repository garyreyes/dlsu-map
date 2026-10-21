import { Line } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Indoor } from '@/shared/data/indoor';
import type { TestRoute } from './test-route';

/** Tool colours, apart from the map palette like the rest of P1: doors green, stairs orange, the elevator violet,
 *  the test route magenta. */
const DOOR = '#2ecc71';
const STAIRS = '#fb8c00';
const ELEVATOR = '#b388ff';
const ROUTE = '#ff3df2';

interface Props {
  indoor: Indoor;
  floor: number;
  base: number;
  route: TestRoute | null;
}

/** One floor's rooms (code at the label, a dot on each door), stairs and elevators, and the test route's part on it. */
export function Markers({ indoor, floor, base, route }: Props) {
  const { points, floors } = indoor.graph;
  const at = (p: number): [number, number, number] => [points[2 * p] ?? 0, base, -(points[2 * p + 1] ?? 0)];
  const rooms = indoor.rooms.filter((r) => r.floor === floor);
  const stops = indoor.verticals.flatMap((v) =>
    v.stops.filter((s) => s.floor === floor).map((s) => ({ id: v.id, kind: v.kind, point: s.point })),
  );
  // Rooms with several codes (ST104/ST106) share a label point; one sprite each would stack.
  const labels = new Map<string, { codes: string[]; label: [number, number] }>();
  for (const r of rooms) {
    const key = r.label.join(',');
    labels.set(key, { codes: [...(labels.get(key)?.codes ?? []), r.code], label: r.label });
  }
  const runs = routeRuns(route?.points ?? [], (p) => floors[p] === floor);
  return (
    <>
      {[...new Set(rooms.flatMap((r) => r.doors))].map((d) => (
        <mesh key={`d${String(d)}`} position={add(at(d), 0.3)}>
          <cylinderGeometry args={[0.35, 0.35, 0.6, 12]} />
          <meshBasicMaterial color={DOOR} />
        </mesh>
      ))}
      {stops.map((s) => (
        <mesh key={s.id} position={add(at(s.point), 1)}>
          <boxGeometry args={[1.6, 2, 1.6]} />
          <meshBasicMaterial color={s.kind === 'stairs' ? STAIRS : ELEVATOR} />
        </mesh>
      ))}
      {[...labels.values()].map((l) => (
        <Label key={l.codes.join('/')} text={l.codes.join('/')} position={[l.label[0], base + 3, -l.label[1]]} />
      ))}
      {runs.map((run, i) => (
        <Line key={i} points={run.map((p) => add(at(p), 0.4))} color={ROUTE} lineWidth={5} />
      ))}
    </>
  );
}

const add = ([x, y, z]: [number, number, number], up: number): [number, number, number] => [x, y + up, z];

/** The route split into the runs that stay on this floor; a run of one point (a stair stop) is dropped. */
function routeRuns(route: readonly number[], here: (p: number) => boolean): number[][] {
  const runs: number[][] = [[]];
  for (const p of route) {
    if (here(p)) runs.at(-1)?.push(p);
    else if (runs.at(-1)?.length) runs.push([]);
  }
  return runs.filter((r) => r.length > 1);
}

/** A room code as a camera-facing sprite, drawn with the system font on a canvas: nothing is fetched (D5). */
function Label({ text, position }: { text: string; position: [number, number, number] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    if (ctx) {
      ctx.font = '600 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(text, 128, 32, 248);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, 128, 32, 248);
    }
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [text]);
  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );
  return (
    <sprite position={position} scale={[6, 1.5, 1]}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  );
}
