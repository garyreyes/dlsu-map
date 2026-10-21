// The loader is the only door between the network and the scene (ARCHITECTURE §6). If it let a bad response
// through, the map would draw garbage or crash on a phone with no message; if it named the wrong reason, the error
// screen would point the student the wrong way. Each failure kind is asserted by its exact reason.
import { describe, expect, it } from 'vitest';
import { loadCampus, loadIndoor, type LoadResult } from './load';
import sample from './campus.sample.json';
import indoorSample from './indoor.sample.json';

const json = (body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': type } });

/** A fetch stand-in that records the URL it was asked for and answers with `respond`. */
function fakeFetch(respond: () => Response | Promise<Response>) {
  const urls: string[] = [];
  const impl = (input: RequestInfo | URL) => {
    urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return Promise.resolve().then(respond);
  };
  return { impl, urls };
}

const reasonOf = (result: LoadResult<unknown>) => (result.ok ? 'ok' : result.reason);

describe('loadCampus', () => {
  it('fetches /data/campus.json and returns the parsed campus', async () => {
    const { impl, urls } = fakeFetch(() => json(sample));
    const result = await loadCampus(impl);
    expect(urls).toEqual(['/data/campus.json']);
    expect(result).toEqual({ ok: true, data: sample });
  });

  it('accepts a JSON content type with a charset', async () => {
    const result = await loadCampus(fakeFetch(() => json(sample, 'application/json; charset=utf-8')).impl);
    expect(reasonOf(result)).toBe('ok');
  });

  it('reports offline when the fetch itself fails', async () => {
    const result = await loadCampus(fakeFetch(() => Promise.reject(new TypeError('Failed to fetch'))).impl);
    expect(reasonOf(result)).toBe('offline');
  });

  it('reports offline, not a throw, when the fetch throws before returning a promise', async () => {
    const result = await loadCampus(() => {
      throw new TypeError('Failed to fetch');
    });
    expect(reasonOf(result)).toBe('offline');
  });

  it('accepts the content type in any case', async () => {
    const result = await loadCampus(fakeFetch(() => json(sample, 'Application/JSON')).impl);
    expect(reasonOf(result)).toBe('ok');
  });

  it('reports http when the server answers with an error status', async () => {
    const result = await loadCampus(fakeFetch(() => new Response('gone', { status: 404 })).impl);
    expect(reasonOf(result)).toBe('http');
  });

  // Cloudflare's single-page-app fallback answers a missing file with index.html and status 200 (PROJECT_FACTS).
  it('reports not-json when a 200 response is the HTML fallback page', async () => {
    const page = new Response('<!doctype html><html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
    const result = await loadCampus(fakeFetch(() => page).impl);
    expect(reasonOf(result)).toBe('not-json');
  });

  it('reports not-json when the response has no content type', async () => {
    const result = await loadCampus(fakeFetch(() => new Response(JSON.stringify(sample), { status: 200 })).impl);
    expect(reasonOf(result)).toBe('not-json');
  });

  it('reports invalid when the body is not parseable JSON', async () => {
    const cut = new Response('{"snapshot": "2026-', { status: 200, headers: { 'content-type': 'application/json' } });
    const result = await loadCampus(fakeFetch(() => cut).impl);
    expect(reasonOf(result)).toBe('invalid');
  });

  it('reports invalid when the JSON does not match the campus schema', async () => {
    const result = await loadCampus(fakeFetch(() => json({ ...sample, buildings: [] })).impl);
    expect(reasonOf(result)).toBe('invalid');
  });
});

// The floor builder (6c) and the indoor view load one building at a time. Same door, same reasons; the slug is
// checked before it goes into the path.
describe('loadIndoor', () => {
  it('fetches /data/buildings/<slug>.json and returns the parsed floors', async () => {
    const { impl, urls } = fakeFetch(() => json(indoorSample));
    const result = await loadIndoor('strc', impl);
    expect(urls).toEqual(['/data/buildings/strc.json']);
    expect(result).toEqual({ ok: true, data: indoorSample });
  });

  it('reports invalid, without fetching, for a slug that is not a building slug', async () => {
    for (const slug of ['', '../campus', 'strc/../x', 'STRC', 'strc.json', 'a b']) {
      const { impl, urls } = fakeFetch(() => json(indoorSample));
      expect(reasonOf(await loadIndoor(slug, impl))).toBe('invalid');
      expect(urls).toEqual([]);
    }
  });

  it('reports invalid when the file is for another building', async () => {
    const result = await loadIndoor('velasco', fakeFetch(() => json(indoorSample)).impl);
    expect(reasonOf(result)).toBe('invalid');
  });

  it('reports invalid when the JSON does not match the floor schema', async () => {
    const result = await loadIndoor('strc', fakeFetch(() => json({ ...indoorSample, floors: [] })).impl);
    expect(reasonOf(result)).toBe('invalid');
  });

  it('reports http for a building with no floor file yet', async () => {
    const result = await loadIndoor('strc', fakeFetch(() => new Response('gone', { status: 404 })).impl);
    expect(reasonOf(result)).toBe('http');
  });

  it('reports not-json when a missing file comes back as the HTML fallback page', async () => {
    const page = new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } });
    const result = await loadIndoor('strc', fakeFetch(() => page).impl);
    expect(reasonOf(result)).toBe('not-json');
  });

  it('reports offline when the fetch fails', async () => {
    const result = await loadIndoor('strc', fakeFetch(() => Promise.reject(new TypeError('Failed to fetch'))).impl);
    expect(reasonOf(result)).toBe('offline');
  });
});
