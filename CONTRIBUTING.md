# Contributing

Thank you for helping. This map is used by people deciding how to keep safe,
so the bar is accuracy first, then speed on cheap phones, then everything else.

## Ground rules

- **No made-up data.** Every number on the site must come from a named
  official source, a peer-reviewed method, or a measurement anyone can repeat
  (e.g. a satellite scene ID). Put the source in the code and on the About page.
- **Ranges, not single numbers,** for anything modelled. Say what was assumed.
- **Not a warning.** Never word anything so it could be read as an official
  alert or forecast.
- **Both languages.** Any text a person reads needs English and Nepali
  (`src/i18n.js`). If you can't write the Nepali, say so in the pull request
  and a maintainer will help.
- **Phones first.** Check your change at 360 px wide. Don't add weight to the
  first load: new code that most visitors don't need goes in a lazy chunk.

## Setting up

You need Node.js 20+ (22 recommended, see `.nvmrc`). Rust with the
`wasm32-unknown-unknown` target is only needed if you change `wasm/`.

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests
```

Browser checks (both languages, phone and desktop, scenarios, print):

```bash
npm run build && npx vite preview --port 4173 &
npm i --no-save playwright && npx playwright install chromium
node e2e/check.mjs http://localhost:4173/
```

If you change the scenario maths, change **both** `src/scenario.js` (the
reference) and `wasm/src/lib.rs`, run `npm run wasm`, and keep
`test/wasm.test.js` passing: the two must give the same results.

## Pull requests

1. Fork the repository and create a branch from `main` (`feat/…`, `fix/…`, `docs/…`).
2. Keep the change focused: one fix or feature per pull request.
3. Run `npm test`, `npm run build` and the browser checks above.
4. Open the pull request and fill in the template. CI must pass, and the
   maintainer reviews every change before it is merged into `main`.

Write commit messages in plain English: a short first line saying what changed,
then why if it isn't obvious.

## Reporting problems

- **Wrong or stale data, a wrong place name, a lake missing:** open a
  "Data problem" issue with the source that shows the right value.
- **Bugs:** open a "Bug" issue with the page, device and browser.
- **Security issues:** don't open a public issue; see `SECURITY.md`.

By contributing you agree that your contribution is licensed under the
project's MIT License, and that you will follow the `CODE_OF_CONDUCT.md`.
