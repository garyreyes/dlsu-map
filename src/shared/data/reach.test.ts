// "Try again" reloads only when this says yes, and a wrong yes loses the app to the browser's error page. Each way
// the site can fail to answer is asserted as a plain false.
import { describe, expect, it } from 'vitest';
import { canReachSite } from './reach';

const json = (type = 'application/json') => new Response('{}', { status: 200, headers: { 'content-type': type } });

describe('canReachSite', () => {
  it('asks the site itself for the campus file, past every cache, without downloading it', async () => {
    const calls: [string, RequestInit][] = [];
    const ok = await canReachSite((input, init) => {
      calls.push([input, init]);
      return Promise.resolve(json());
    });
    expect(ok).toBe(true);
    expect(calls).toEqual([['/data/campus.json', { method: 'HEAD', cache: 'no-store' }]]);
  });

  it('accepts a JSON content type with a charset', async () => {
    expect(await canReachSite(() => Promise.resolve(json('application/json; charset=utf-8')))).toBe(true);
  });

  it('is false with no answer at all (no signal)', async () => {
    expect(await canReachSite(() => Promise.reject(new TypeError('Failed to fetch')))).toBe(false);
  });

  it('is false for an error status', async () => {
    expect(await canReachSite(() => Promise.resolve(new Response(null, { status: 503 })))).toBe(false);
  });

  it("is false when something else answers, like a Wi-Fi login page that isn't our JSON", async () => {
    expect(await canReachSite(() => Promise.resolve(json('text/html')))).toBe(false);
  });
});
