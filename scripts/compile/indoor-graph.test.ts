// buildGraph joins a building's hallway lines into one walkable graph per floor and hangs doors, stairs, elevators and
// entrances off it (8a). Exact points and links: a graph that misses one join still looks like a graph.
import { describe, expect, it } from 'vitest';
import { buildGraph, reachable, type Attach, type GraphFloor } from './indoor-graph.ts';

const floor = (n: number, ...hallways: number[][]): GraphFloor => ({
  floor: n,
  hallways: hallways.map((h) => Array.from({ length: h.length / 2 }, (_, i) => [h[2 * i] ?? 0, h[2 * i + 1] ?? 0])),
});
const door = (n: number, x: number, y: number, within = 3): Attach => ({
  floor: n,
  point: [x, y],
  kind: 'door',
  within,
});

/** The links as `a b kind` strings with each end's point (ends in text order, as a link has no direction), so a test
 *  reads as a picture of the graph. */
function picture(points: readonly number[], links: readonly (readonly [number, number, string])[]): string[] {
  const at = (i: number) => `${String(points[2 * i])},${String(points[2 * i + 1])}`;
  return links.map(([a, b, kind]) => `${[at(a), at(b)].sort().join(' ')} ${kind}`).sort();
}

describe('buildGraph', () => {
  it('makes one link per hallway segment, with each point once', () => {
    const { graph } = buildGraph([floor(1, [0, 0, 10, 0, 10, 5])], []);
    expect(graph.points).toStrictEqual([0, 0, 10, 0, 10, 5]);
    expect(graph.floors).toStrictEqual([1, 1, 1]);
    expect(picture(graph.points, graph.links)).toStrictEqual(['0,0 10,0 hall', '10,0 10,5 hall']);
  });

  it('joins two hallways where they cross', () => {
    const { graph } = buildGraph([floor(1, [0, 5, 10, 5], [5, 0, 5, 10])], []);
    expect(picture(graph.points, graph.links)).toStrictEqual([
      '0,5 5,5 hall',
      '10,5 5,5 hall',
      '5,0 5,5 hall',
      '5,10 5,5 hall',
    ]);
  });

  it('joins a hallway that ends short of another, within 1 m', () => {
    const { graph } = buildGraph([floor(1, [0, 0, 10, 0], [4, 0.6, 4, 8])], []);
    expect(picture(graph.points, graph.links)).toStrictEqual([
      '0,0 4,0 hall',
      '10,0 4,0 hall',
      '4,0 4,0.6 hall',
      '4,0.6 4,8 hall',
    ]);
    expect(reachable(graph, 0).size).toBe(5);
  });

  it('leaves a hallway that ends more than 1 m short on its own', () => {
    const { graph } = buildGraph([floor(1, [0, 0, 10, 0], [4, 1.5, 4, 8])], []);
    expect(graph.links).toHaveLength(2);
    expect(reachable(graph, 0).size).toBe(2);
  });

  it('never joins two floors, even where they overlap', () => {
    const { graph } = buildGraph([floor(1, [0, 0, 10, 0]), floor(2, [5, -5, 5, 5])], []);
    expect(graph.floors).toStrictEqual([1, 1, 2, 2]);
    expect(graph.links).toHaveLength(2);
  });

  it('hangs a door off the nearest point of its floor, and says how far it was', () => {
    const { graph, nodes, distances } = buildGraph([floor(1, [0, 0, 10, 0]), floor(2, [0, 2, 10, 2])], [door(1, 3, 2)]);
    expect(distances).toStrictEqual([2]);
    expect(picture(graph.points, graph.links)).toStrictEqual([
      '0,0 3,0 hall',
      '0,2 10,2 hall',
      '10,0 3,0 hall',
      '3,0 3,2 door',
    ]);
    const node = nodes[0] ?? -1;
    expect([graph.points[2 * node], graph.points[2 * node + 1], graph.floors[node]]).toStrictEqual([3, 2, 1]);
  });

  it('links a stair to its hallway as walking on that floor, and an entrance as an entrance', () => {
    const attach: Attach[] = [
      { floor: 1, point: [2, 1], kind: 'hall', within: 3 },
      { floor: 1, point: [8, -1], kind: 'entrance', within: 5 },
    ];
    const { graph } = buildGraph([floor(1, [0, 0, 10, 0])], attach);
    expect(picture(graph.points, graph.links)).toContain('2,0 2,1 hall');
    expect(picture(graph.points, graph.links)).toContain('8,-1 8,0 entrance');
  });

  it('shares the hallway point when two doors face each other', () => {
    const { graph } = buildGraph([floor(1, [0, 0, 10, 0])], [door(1, 5, 1), door(1, 5, -1)]);
    expect(graph.points.length / 2).toBe(5);
    expect(picture(graph.points, graph.links)).toStrictEqual([
      '0,0 5,0 hall',
      '10,0 5,0 hall',
      '5,-1 5,0 door',
      '5,0 5,1 door',
    ]);
  });

  it('puts a door that is on the hallway on it, with no link of its own', () => {
    const { graph, nodes, distances } = buildGraph([floor(1, [0, 0, 10, 0])], [door(1, 4, 0)]);
    expect(distances).toStrictEqual([0]);
    expect(picture(graph.points, graph.links)).toStrictEqual(['0,0 4,0 hall', '10,0 4,0 hall']);
    expect(graph.points[2 * (nodes[0] ?? -1)]).toBe(4);
  });

  it('leaves out an attachment that is too far, or on a floor with no hallway', () => {
    const { graph, nodes, distances } = buildGraph([floor(1, [0, 0, 10, 0])], [door(1, 5, 4), door(3, 5, 0)]);
    expect(nodes).toStrictEqual([null, null]);
    expect(distances).toStrictEqual([4, Infinity]);
    expect(graph.points).toStrictEqual([0, 0, 10, 0]);
  });

  it('rounds points to 0.1 m, as the rest of the compiled data', () => {
    const { graph } = buildGraph([floor(1, [0.04, 0, 10.26, 0])], [door(1, 3.333, 1)]);
    expect(graph.points).toStrictEqual([0, 0, 10.3, 0, 3.3, 1, 3.3, 0]);
  });
});

describe('reachable', () => {
  it('walks links both ways', () => {
    const { graph } = buildGraph([floor(1, [0, 0, 10, 0, 10, 5]), floor(2, [0, 0, 1, 0])], []);
    expect([...reachable(graph, 2)].sort()).toStrictEqual([0, 1, 2]);
  });
});
