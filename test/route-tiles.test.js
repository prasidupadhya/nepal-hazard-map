import { it, expect } from 'vitest';
import { loadRoute, tileLoader } from './load-route.js';
import { tracePath, glof } from '../src/scenario.js';
import { LAKES } from '../src/lakes.js';
import { BOX } from '../src/grid.js';

it('paths from loaded tiles equal the full-grid oracle (lakes + 300 random starts)', async () => {
  const full = await loadRoute(), load = tileLoader();
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const starts = [...LAKES.map((l) => l.ll), ...Array.from({ length: 300 }, () => [BOX.w + rnd() * (BOX.e - BOX.w), BOX.s + rnd() * (BOX.n - BOX.s)])];
  for (const ll of starts) {
    const fresh = tileLoader(); // a cold loader must also be enough on its own
    const { grid } = await fresh(...ll);
    const a = tracePath(full, ...ll), b = tracePath(grid, ...ll);
    expect(b.length).toBe(a.length);
    expect(b.at(-1)).toEqual(a.at(-1));
    await load(...ll); // shared loader accumulates tiles like the site does
  }
  const { grid } = await load(...LAKES[0].ll);
  expect(glof(tracePath(grid, ...LAKES[0].ll), [43, 86])).toEqual(glof(tracePath(full, ...LAKES[0].ll), [43, 86]));
}, 120000);
