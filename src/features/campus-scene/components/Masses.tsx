import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, type RefObject } from 'react';
import { BufferAttribute, BufferGeometry, Color, MeshLambertMaterial, type Mesh } from 'three';
import type { Campus } from '@/shared/data/campus';
import { CITY_OPACITY, SELECTED_TINT, type MapPalette } from '@/shared/config/palette';
import { ribbonPositions } from '@/shared/three/ribbons';
import { buildMassing, selectionGroups, type Massing } from '../massing';
import { useTapPick } from './useTapPick';
import { RIBBON_WIDTH, viaductBlocks } from '../ribbons';

type Lines = readonly (readonly number[])[];

function massGeometry({ positions, normals, colors }: Massing) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.computeBoundingSphere();
  return g;
}

function ribbonGeometry(lines: Lines, width: number, lift: number) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(ribbonPositions(lines, width, lift), 3));
  g.computeBoundingSphere();
  return g;
}

const linesOf = (campus: Campus, kind: Campus['paths'][number]['kind']) =>
  campus.paths.filter((p) => p.kind === kind).map((p) => p.line);

// One builder per mesh, at module level so useCampusGeometry's memo only reruns when the campus changes.
const buildings = (c: Campus) => buildMassing(c.buildings.map((b) => ({ id: b.slug, volumes: b.volumes })));
const bridges = (c: Campus) => massGeometry(buildMassing([{ id: 'bridges', volumes: c.bridges }]));
const city = (c: Campus) =>
  massGeometry(
    buildMassing([
      {
        id: 'city',
        volumes: [
          ...c.city.map((b) => ({ outline: b.outline, base: 0, top: b.top })),
          ...viaductBlocks(linesOf(c, 'rail')),
        ],
      },
    ]),
  );
const roads = (c: Campus) => ribbonGeometry(linesOf(c, 'road'), RIBBON_WIDTH.road, 0.05);
const streets = (c: Campus) => ribbonGeometry(linesOf(c, 'street'), RIBBON_WIDTH.street, 0.06);
const footpaths = (c: Campus) => ribbonGeometry(linesOf(c, 'foot'), RIBBON_WIDTH.foot, 0.08);

/** A geometry built once per campus and freed from the GPU when it's replaced or unmounted. */
function useCampusGeometry(build: (c: Campus) => BufferGeometry, campus: Campus) {
  const geometry = useMemo(() => build(campus), [build, campus]);
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  return geometry;
}

const noHit = () => null;

interface Props {
  campus: Campus;
  palette: MapPalette;
}

interface CampusProps extends Props {
  /** The selected building's slug: drawn with SELECTED_TINT. */
  selected: string | null;
  /** A tap on a campus building (its slug) or on anything else (null). */
  onTap: (slug: string | null) => void;
  /** The campus mesh, for taps here and for what hides the floor band (CampusMap). */
  massRef: RefObject<Mesh | null>;
}

/**
 * The campus as a massing model (D13): every building one pale colour shaped by light, bridges the same. Lambert
 * shading with the wall-foot darkening baked into vertex colours; no outlines, windows or textures. The selected
 * building is the one exception, a 22% lean toward Campus Green, drawn through a second material on its triangles.
 */
export function CampusMasses({ campus, palette, selected, onTap, massRef }: CampusProps) {
  const { geometry, owners } = useMemo(() => {
    const m = buildings(campus);
    return { geometry: massGeometry(m), owners: m.owners };
  }, [campus]);
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  const materials = useMemo(() => {
    const tint = new Color(palette.building).lerp(new Color(SELECTED_TINT.color), SELECTED_TINT.mix);
    return [
      new MeshLambertMaterial({ vertexColors: true, color: palette.building }),
      new MeshLambertMaterial({ vertexColors: true, color: tint }),
    ];
  }, [palette]);
  useEffect(
    () => () => {
      for (const m of materials) m.dispose();
    },
    [materials],
  );

  // With two materials, three.js draws only what the groups cover, so they're set before the first frame.
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    geometry.clearGroups();
    const triangles = geometry.getAttribute('position').count / 3;
    for (const g of selectionGroups(owners, selected, triangles)) geometry.addGroup(g.start, g.count, g.materialIndex);
    invalidate();
  }, [geometry, owners, selected, invalidate]);

  useTapPick(massRef, owners, onTap);
  const bridgeGeometry = useCampusGeometry(bridges, campus);
  return (
    <>
      <mesh ref={massRef} geometry={geometry} material={materials} />
      <mesh geometry={bridgeGeometry} raycast={noHit}>
        <meshLambertMaterial vertexColors color={palette.building} />
      </mesh>
    </>
  );
}

/**
 * The city around the campus, see-through and tinted toward the ground so the campus leads (DESIGN.md), plus the
 * LRT viaduct over Taft Avenue. Drawn after the campus so campus buildings show through it; never tappable.
 */
export function CityMasses({ campus, palette }: Props) {
  const geometry = useCampusGeometry(city, campus);
  const color = useMemo(() => new Color(palette.building).lerp(new Color(palette.ground), palette.cityMix), [palette]);
  return (
    <mesh geometry={geometry} renderOrder={5} raycast={noHit}>
      <meshLambertMaterial vertexColors color={color} transparent opacity={CITY_OPACITY} depthWrite={false} />
    </mesh>
  );
}

/** Streets and paths as thin unlit lines on the ground (D13): roads, then streets, then footpaths on top. */
export function PathLines({ campus, palette }: Props) {
  const roadGeometry = useCampusGeometry(roads, campus);
  const streetGeometry = useCampusGeometry(streets, campus);
  const footGeometry = useCampusGeometry(footpaths, campus);
  return (
    <>
      <mesh geometry={roadGeometry} renderOrder={1} raycast={noHit}>
        <meshBasicMaterial color={palette.road} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh geometry={streetGeometry} renderOrder={2} raycast={noHit}>
        <meshBasicMaterial color={palette.road} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <mesh geometry={footGeometry} renderOrder={3} raycast={noHit}>
        <meshBasicMaterial color={palette.path} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
    </>
  );
}
