# Deployment — Netlify

The dashboard is a fully static SPA. There is no server, no database, and no
runtime API: `npm run build` type-checks, bundles, and copies `public/` into
`dist/`, and Netlify serves `dist/` as files. Everything below follows from
that.

## Site settings

`netlify.toml` is committed and authoritative — it carries the build command,
publish directory, Node version, redirects, and cache headers. When you connect
the repo, Netlify reads all of it. **Leave the build fields blank in the
Netlify UI**; anything typed there overrides the file and silently drifts from
what is in version control.

| Setting | Value | Source |
| --- | --- | --- |
| Build command | `npm run build` | `netlify.toml` |
| Publish directory | `dist` | `netlify.toml` |
| Node version | 20 | `netlify.toml` |
| Install command | *(default — Netlify runs `npm ci`)* | lockfile |

### Environment variables

**None are required.** `.env.example` documents `VITE_DATA_SOURCE`,
`VITE_API_BASE_URL`, and `VITE_USE_MATURITY_BANDS`, but as of this commit none
of them are read at runtime — `getDataSource()` always constructs
`StaticDataSource`, and `VITE_USE_MATURITY_BANDS` appears only in
`src/vite-env.d.ts`. They are forward-declarations for a later phase. Setting
them in the Netlify UI will not change the deployed build.

## First deploy

1. Push this repository to GitHub.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Confirm the build fields are blank or match the table above, then deploy.

The first build takes noticeably longer than later ones — the deploy uploads
~2,800 data files on top of the bundle. Subsequent deploys only upload changed
files.

## The committed-data invariant

**`public/data/` is committed to the repository, including the 2,804
per-facility shards in `public/data/facilities/`. Do not add it to
`.gitignore`.**

It is generated output, so ignoring it is the intuitive call, and it was
ignored before the first deploy was prepared. It cannot be:

- The ETL's input, `etl/data/`, is *not* in the repository — it holds raw
  assessment extracts.
- `npm run build` does not invoke the ETL. It only copies `public/` verbatim.

So nothing in CI can regenerate this data. Ignored, the build still succeeds
and the deploy still looks healthy — the dashboard, the explorer, and the state
pages all render, because their aggregates load from files that *were*
committed. Only `/facility/:uuid` breaks, on a request path that returns a 404
after the page has already rendered its shell. The failure is invisible from
the build log and from the home page.

### Refreshing the data

Regenerate locally and commit the result — there is no CI path for this:

```bash
npm run data:refresh
npm run data:validate
git add public/data && git commit -m "data: refresh from <source>"
```

Requires `etl/data/` to be populated locally; see `docs/DATA_DICTIONARY.md`.

## Why the 404 redirects come first

`netlify.toml` sends `/data/*` and `/geo/*` to an explicit 404 *above* the SPA
fallback. Netlify takes the first matching rule, and because neither is
`force`d, a file that exists still wins and is served normally — the rules only
catch paths with nothing behind them.

Without them, a missing data file falls through to `/*` → `index.html` with a
**200**, `res.json()` chokes on the markup, and a missing-file problem surfaces
in the UI as `Unexpected token '<'`. Keep them ordered ahead of the fallback.

## Post-deploy checks

The build log is not sufficient — the failure modes above are all runtime. On
the deploy preview:

1. **Home page** renders with national figures.
2. **A facility scorecard** — open any facility from the assessment table. This
   is the check that catches missing shards; nothing else exercises them.
3. **Explorer** loads and filters.
4. **A hard refresh on a deep route** (e.g. reload while on
   `/assessment?state=Kano`) returns the app, not a 404 — confirms the SPA
   fallback.
5. **A deliberate 404**: request `/data/does-not-exist.json` directly. It must
   return **404**, not `index.html` with a 200.
6. **Cache headers**: confirm a file under `/assets/` comes back with
   `Cache-Control: public, max-age=31536000, immutable`, and that the two
   `/geo/*.geojson` files are served compressed — they are 1.8 MB and 2.0 MB
   raw against 877 kB and 623 kB gzipped, and `netlify.toml` declares their
   `Content-Type` as JSON specifically to get them onto the compression
   allowlist.

## Known advisories

`npm audit` reports one moderate issue against production dependencies as of
this commit. It is not a deploy blocker; it is recorded here so the choice is
deliberate rather than forgotten:

- **`echarts` <6.1.0** — XSS. The fix is a major version bump. The charts
  render ETL-generated data, not user input.

**Resolved:** the `react-router` advisories (open redirect via backslash in
`<Link>`/`useNavigate`, GHSA-wrjc-x8rr-h8h6; plus an SSR-hydration issue that
never applied to a static SPA) by upgrading to `react-router-dom` 7.18.2.

Do not trust `npm audit`'s remediation advice on this one if it resurfaces. It
reports *fix available via `npm audit fix`*, implying a patch inside the 6.x
line; running it is a no-op that prints "up to date" while leaving the finding
in place. The advisory range is `6.0.0 - 7.17.0` and 6.30.4 was the final 6.x
release, so no patched 6.x exists — the only fixed version is 7.18.0 or later,
which is a major upgrade.

The upgrade was behaviour-neutral here because the app uses only the
declarative router core — `BrowserRouter`, `Routes`/`Route`, `Outlet`, `Link`,
`NavLink`, `Navigate`, `useNavigate`, `useParams`, `useSearchParams`,
`useLocation`. There are no data-router APIs (`createBrowserRouter`, loaders,
actions, `Form`, `useRouteError`), which is where a v6→v7 migration usually
costs something. The one v7 default that changes matching semantics,
`v7_relativeSplatPath`, is inert here: the only splat route is `path="*"` and
its target is the absolute `/`.

Note that react-router 7 declares `engines.node >= 20`, so the `NODE_VERSION`
pin in `netlify.toml` is now a hard floor rather than a preference.

Deliberately not configured: a `Content-Security-Policy`. The PDF and image
export path (`jspdf`, `html2canvas`) and ECharts rely on inline styles, so a
policy strict enough to be worth adding needs to be developed against those
export flows rather than bolted on at deploy time.
