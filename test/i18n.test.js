import { it, expect, vi } from 'vitest';
vi.stubGlobal('document', { documentElement: {} });
const { setLang, when, num, age, t, T } = await import('../src/i18n.js');
it('dates are Nepal Time (UTC+05:45) in both languages', () => {
  setLang('en'); expect(when('2025-04-25T06:11:26Z')).toBe('25 Apr 2025, 11:56 NPT');
  expect(when('2026-11-22T18:20:00Z')).toBe('23 Nov 2026, 00:05 NPT');       // crosses midnight
  setLang('ne'); expect(when('2025-04-25T06:11:26Z')).toBe('२०२५ अप्रिल २५, ११:५६ (नेपाली समय)');
});
it('numbers and ages use Devanagari digits in Nepali', () => {
  setLang('ne'); expect(num(1234.5, 1)).toBe('१,२३४.५'); expect(age('2026-11-22T10:00:00Z', Date.parse('2026-11-22T12:30:00Z'))).toBe('२ घण्टा अघि');
  setLang('en'); expect(num(1234.5, 1)).toBe('1,234.5');
});
it('every English UI string has a Nepali translation', () => {
  const walk = (en, ne, path) => { for (const k of Object.keys(en)) { const p = path + '.' + k; if (typeof en[k] === 'object') walk(en[k], ne[k] || {}, p); else expect(ne[k], p).toBeTruthy(); } };
  walk(T.en, T.ne, '');
});
