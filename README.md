# Research Topic Explorer

Research Topic Explorer is a public, reproducible bibliometric workbench for ranking, trending, and mapping the OpenAlex Topics represented by an owner-supplied journal category. The browser application is static and deploys to a GitHub Pages project path; a narrowly scoped Cloudflare Worker adds the owner's OpenAlex API key only to server-to-server requests.

> Journal-category membership is supplied by the site's category dataset. Publication records and topic classifications come from OpenAlex. The resulting topic rankings are OpenAlex-based analyses of the selected journal set and are not Clarivate Citation Topics or official JCR analytics.

No Clarivate/JCR content is scraped or bundled by this repository. The production catalog is deliberately empty until the repository owner supplies a legitimately obtained category file.

## What it does

- Resolves normalized, checksum-valid ISSNs to deduplicated OpenAlex Source IDs and reports journal-level coverage, including unresolved inputs.
- Ranks all OpenAlex primary topics for a publication year using `group_by=primary_topic.id`; each classified work contributes once to the ranking.
- Shows counts, shares, classification coverage, hierarchy metadata, five-year trends, year-over-year growth, and a journal breakdown.
- Builds a bounded topic co-occurrence network and renders it with the official `vosviewer-online` React component.
- Exports topic rankings, trends, and journals as CSV and the network as VOSviewer JSON.
- Stores shareable analysis controls in query parameters without browser storage.

## Architecture

```text
GitHub Pages (React + TypeScript + Vite)
        |
        | validated HTTPS operations only
        v
Cloudflare Worker (CORS, validation, rate limit, cache, secret)
        |
        | api_key added server-side
        v
OpenAlex REST API
```

There is no login, application database, generic proxy, arbitrary upstream path, arbitrary filter, or browser-to-OpenAlex request. Browser code and Worker code are separated, and browser code cannot import Worker configuration.

## Compatibility choices

Versions are locked in `package-lock.json`. `vosviewer-online@1.2.4` declares React 17 or 18 peer support, so this project intentionally uses `react@18.3.1` and `react-dom@18.3.1`, together with `mobx@6.16.1` and `mobx-react-lite@3.4.3`. The visualization package is lazy-loaded only when the Network tab needs it. Source maps are disabled for production builds.

The VOSviewer dependency tree currently includes an older `qrcode.react` peer declaration. It produces an installation peer warning with React 18, but the required VOSviewer package itself declares React 18 support and the integration is covered by build, integration, and E2E tests. `dompurify` is overridden to a patched release; `npm audit` reports no known vulnerabilities at the time of this implementation.

## Prerequisites

- Node.js 20.19 or newer
- A Cloudflare account with Workers enabled
- An OpenAlex API key
- A legitimate journal-category dataset that you are permitted to use and, if applicable, redistribute

## Local setup

Install locked dependencies:

```bash
npm ci
```

Copy `.env.example` to `.env` and keep only public values there:

```dotenv
VITE_API_BASE_URL=http://localhost:8787
VITE_BASE_PATH=/
VITE_GITHUB_REPOSITORY_URL=
```

Copy `worker/.dev.vars.example` to `worker/.dev.vars`, then add the real key locally:

```dotenv
OPENALEX_API_KEY=replace-with-local-secret
```

Both files containing local secrets are ignored. Never prefix the OpenAlex key with `VITE_`.

Run the Worker and frontend in separate terminals:

```bash
npm run dev:worker
npm run dev
```

The default Worker allowlist accepts exactly `http://localhost:5173`.

## Category data

Category definitions live in `public/data/categories/`. Start from `category.template.json`, create a separate definition file, and add it to `index.json`:

```json
{
  "schemaVersion": 1,
  "categories": [
    {
      "id": "jcr-2024-optics",
      "name": "Optics",
      "taxonomy": "JCR",
      "edition": "2024",
      "file": "jcr-2024-optics.json"
    }
  ]
}
```

The category edition and analyzed publication year are independent. Journal names are preserved for coverage reporting. Multiple ISSNs are normalized and deduplicated; invalid checksums fail validation instead of being silently discarded.

Validate all indexed production files with:

```bash
npm run validate:categories
```

The synthetic fixture in `tests/fixtures/` is for automated tests only and is explicitly not a JCR dataset.

## Methodology

- **Category rule:** the owner-supplied category defines only the journal set.
- **Journal assignment:** works are filtered by `primary_location.source.id`.
- **Counting rule:** the topic ranking groups on `primary_topic.id`, giving each classified work exactly one primary-topic count.
- **Document types:** the default is OpenAlex `article` plus `review`; choosing all types omits the type filter.
- **Publication year:** OpenAlex `publication_year`, independently selected from category edition metadata.
- **XPAC:** every works query explicitly sets `include_xpac=false`.
- **Trends:** grouped annual counts are used; growth is shown only when the previous-year topic count is at least 20 documents.
- **Network:** nodes are the top 20, 30, or 40 primary topics. For each seed node, matching works are grouped by all attached `topics.id`; links therefore mean topic co-occurrence within works, not citation or semantic similarity. Edges below strength 5 are removed and at most 250 remain.
- **Coverage:** analyses may proceed with partial source resolution, but unresolved journals remain visible and are excluded from the reported analyzed set.

All computations use grouped OpenAlex API responses rather than downloading individual work records. Browser aggregation chunks Source IDs in groups of at most 100, follows every cursor page, merges Topic IDs, and limits concurrent requests to two.

## Worker security and limits

The Worker accepts only these application operations:

```text
GET  /health
POST /v1/resolve-sources
POST /v1/group-primary-topics
POST /v1/topic-details
POST /v1/group-topic-years
POST /v1/group-category-years
POST /v1/group-sources
POST /v1/group-topic-cooccurrence
```

It enforces exact-origin CORS, a 32 KiB request body cap, schema validation, ISSN checksums, `S\d+`/`T\d+` identifiers, reasonable years, a maximum 15-year range, 500 ISSNs, 100 source IDs, and 40 topic IDs. The Cloudflare rate-limit binding defaults to 30 requests per 60 seconds per origin/client key. Topic metadata uses a bounded four-request upstream pool; no unbounded user-derived `Promise.all` is used.

Sanitized responses are cached with deterministic keys that exclude the API key. Source and topic metadata use 30-day TTLs; historical aggregations use seven days; current-year aggregations use 12 hours. Responses may include `X-App-Cache: HIT|MISS`.

The Worker emits no application logs containing request bodies, upstream URLs, client IP addresses, or secrets. Cloudflare platform telemetry may still be configured by the account owner; review account-level settings before production use.

## Cloudflare deployment

Create the secret through Wrangler; do not put it in `vars` or GitHub repository configuration:

```bash
npx wrangler secret put OPENALEX_API_KEY --config worker/wrangler.jsonc
```

Set the exact production origin when deploying (a project Pages site has origin `https://USERNAME.github.io`, without the repository path):

```bash
npx wrangler deploy --config worker/wrangler.jsonc \
  --var "ALLOWED_ORIGINS:https://USERNAME.github.io,http://localhost:5173"
```

Choose a `namespace_id` in `worker/wrangler.jsonc` that is unique within the Cloudflare account if `1001` is already used. The Worker workflow expects these GitHub settings:

- Secret `CLOUDFLARE_API_TOKEN` with Worker deployment permission
- Secret `CLOUDFLARE_ACCOUNT_ID`
- Repository variable `WORKER_ALLOWED_ORIGINS`, for example `https://USERNAME.github.io`

The OpenAlex key is provisioned directly in Cloudflare and is not a GitHub secret. Running a Worker deployment does not insert the key into the repository or frontend artifact.

## GitHub Pages deployment

Set repository variable `VITE_API_BASE_URL` to the deployed Worker origin, for example `https://research-topic-explorer-api.example.workers.dev`. Enable GitHub Pages with **GitHub Actions** as its source, then push to `main` or run the Pages workflow manually.

The workflow derives `VITE_BASE_PATH` as `/<repository-name>/`, so assets and direct project-page reloads work at:

```text
https://USERNAME.github.io/research-topic-explorer/?category=...&year=2024&types=article,review&tab=overview
```

## Verification

```bash
npm run typecheck
npm run test:run
npm run build
npm run test:security
npm run test:e2e
npm audit
```

`test:security` checks the built frontend and browser source for the Worker secret name, an actual `OPENALEX_API_KEY` environment value if provided to the test process, and direct OpenAlex API usage. Worker tests also verify origin rejection, unsupported routes, validation, rate limiting, sanitized upstream failures, and that the server-to-server API key never appears in responses.

## Reproducibility metadata

CSV and JSON downloads carry or derive the category ID/name/taxonomy/edition, analyzed publication year, selected work types, normalized Source IDs, analyzed and classified counts, counting/network rules, XPAC exclusion, and generation timestamp. API cache contents are accelerators, not a database of record.

## Known limits

- No legitimate production category membership is included; that is a licensing input owned by the deployer.
- Results inherit OpenAlex coverage and classification quality and can change as OpenAlex updates records.
- The official VOSviewer bundle is large (about 1.55 MB compressed in the current build), but is split into a lazy chunk and is not loaded for ranking, trends, or journal views.
- A shared public API key still has budget and abuse risk. The closed routes, aggregation, caching, rate limiting, and conservative UI limits reduce that risk but cannot eliminate non-browser abuse.
- There is no cross-session result database; reproducibility depends on exported metadata and the state of OpenAlex at generation time.

## Attribution

Publication, source, and topic data come from [OpenAlex](https://openalex.org/). Network rendering uses [VOSviewer Online](https://app.vosviewer.com/) and its official React package. This software is released under the MIT License; third-party packages and data retain their own terms.

