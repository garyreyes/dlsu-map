// The goal room's label pin on the cut floor (8▸): a Campus Green plate with the room's code in white, on a short stem
// that ends at the room's door, like the selected building label (DESIGN.md, Map labels; Indoor Cut). It is a sprite
// textured from a canvas, not drei <Text> (a CDN font) or <Html> (a React root per label, which StrictMode breaks), so
// it works offline and needs no DOM layer. Screen-sized, so it reads at any zoom. Decorative: the step text names the
// room. Never tappable.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, LinearFilter, SRGBColorSpace, Vector3, type Plane, type Sprite } from 'three';
import { CAMPUS_GREEN } from '@/shared/config/palette';

const noHit = () => null;

/** Drawn after the route line (12, 13). */
const PIN_ORDER = 14;
/** Plate and stem, CSS px on screen; the plate is a map label's 8px radius and 16px bold text (DESIGN.md). */
const PIN = { padX: 8, padY: 3, text: 16, radius: 8, stem: 22, stemWidth: 2, shadow: 6 } as const;
/** Canvas pixels per CSS px, so the text stays sharp on a phone screen. */
const SCALE = 3;

interface Drawn {
  texture: CanvasTexture;
  /** CSS px. */
  width: number;
  height: number;
}

/** A rounded-rectangle path, by hand: ctx.roundRect throws on Safari before 16. */
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the pin: plate on top, stem below, with room around them for the shadow. The stem's tip is the bottom middle. */
function drawPin(code: string, family: string): Drawn {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `700 ${String(PIN.text * SCALE)}px ${family}`;
  if (ctx) ctx.font = font;
  const textWidth = ctx ? ctx.measureText(code).width / SCALE : code.length * 10;
  const plateW = Math.ceil(textWidth + 2 * PIN.padX);
  const plateH = PIN.text + 2 * PIN.padY;
  const width = plateW + 2 * PIN.shadow;
  const height = plateH + PIN.stem + 2 * PIN.shadow;
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  if (ctx) {
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = CAMPUS_GREEN;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    // Shadow sizes are in canvas pixels and ignore the context's scale, so scale them by hand.
    ctx.shadowBlur = PIN.shadow * SCALE;
    ctx.shadowOffsetY = SCALE;
    roundedRect(ctx, PIN.shadow, PIN.shadow, plateW, plateH, PIN.radius);
    ctx.fill();
    ctx.fillRect(width / 2 - PIN.stemWidth / 2, PIN.shadow + plateH - 1, PIN.stemWidth, PIN.stem + 1);
    ctx.shadowColor = 'transparent';
    ctx.font = `700 ${String(PIN.text)}px ${family}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code, width / 2, PIN.shadow + plateH / 2 + 1);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return { texture, width, height };
}

interface Props {
  code: string;
  /** Where the room's door is, in data coordinates (x east, y north), and the floor's slab height. */
  at: readonly [number, number];
  base: number;
  /** The cut plane: the pin hides once the cut slides below its door. */
  plane: Plane;
}

export function GoalPin({ code, at, base, plane }: Props) {
  const sprite = useRef<Sprite>(null);
  const camera = useThree((s) => s.camera);
  const viewHeight = useThree((s) => s.size.height);
  const point = useMemo(() => new Vector3(at[0], base + 0.1, -at[1]), [at, base]);
  const drawn = useMemo(() => drawPin(code, getComputedStyle(document.body).fontFamily || 'sans-serif'), [code]);
  useEffect(
    () => () => {
      drawn.texture.dispose();
    },
    [drawn],
  );
  // A sprite with sizeAttenuation off is `scale` of the view's height, times 2 tan(fov / 2) for a perspective camera.
  const fov = 'fov' in camera ? (camera.fov * Math.PI) / 180 : 1;
  const unit = (2 * Math.tan(fov / 2)) / viewHeight;
  useFrame(() => {
    if (sprite.current) sprite.current.visible = plane.distanceToPoint(point) >= 0;
  });
  return (
    <sprite
      ref={sprite}
      position={point}
      center={[0.5, PIN.shadow / drawn.height]}
      scale={[drawn.width * unit, drawn.height * unit, 1]}
      renderOrder={PIN_ORDER}
      raycast={noHit}
    >
      <spriteMaterial
        map={drawn.texture}
        sizeAttenuation={false}
        transparent
        depthTest={false}
        depthWrite={false}
        fog={false}
      />
    </sprite>
  );
}
