# Research Topic Explorer

Research Topic Explorer is a public, reproducible bibliometric workbench for ranking, trending, and mapping the OpenAlex Topics represented by an OpenAlex Subfield journal set. The browser application is static and deploys to a GitHub Pages project path; a narrowly scoped Cloudflare Worker adds the owner's OpenAlex API key only to server-to-server requests.

> Journal-set membership, publication records, and topic classifications come from OpenAlex. Journal Impact Factor (JIF), when enabled, is separate owner-supplied Clarivate metadata matched by eISSN. JIF does not affect membership or analytical results, which are not official JCR analytics.

No Clarivate/JCR website is scraped. The repository does not include the supplied PDF or an extracted JIF table by default.

## What it does

- Loads the current OpenAlex Subfield catalog and automatically derives an ISSN-bearing journal set from primary-topic work groups.
- Supports two explicit analysis scopes: **Strict selected subfield** filters the final corpus by `primary_topic.subfield.id`, while **Entire journal set** analyzes every selected-year work from the discovered journals.
- Ranks OpenAlex primary topics for a publication year using `group_by=primary_topic.id`; each classified work contributes once to the ranking.
- Shows counts, shares, classification coverage, hierarchy metadata, five-year trends, year-over-year growth, and a journal breakdown.
- Builds a bounded topic co-occurrence network and renders it with the official `vosviewer-online` React component.
- Exports topic rankings, trends, and journals as CSV and the network as VOSviewer JSON.
- Stores shareable analysis controls in query parameters without browser storage.

## Architecture

```text
GitHub Pages (React + TypeScript + Vite + IBM Carbon)
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

Versions are locked in `package-lock.json`. The interface uses `@carbon/react@1.113.0`, Carbon Sass tokens and locally bundled IBM Plex fonts; the previous application stylesheet and token file were removed rather than layered beneath Carbon. `vosviewer-online@1.2.4` declares React 17 or 18 peer support, so this project intentionally uses `react@18.3.1` and `react-dom@18.3.1`, together with `mobx@6.16.1` and `mobx-react-lite@3.4.3`. The visualization package is lazy-loaded only when the Network tab needs it. Source maps are disabled for production builds.

The VOSviewer dependency tree currently includes an older `qrcode.react` peer declaration. It produces an installation peer warning with React 18, but the required VOSviewer package itself declares React 18 support and the integration is covered by build, integration, and E2E tests. `dompurify` is overridden to a patched release; `npm audit` reports no known vulnerabilities at the time of this implementation.

## Prerequisites

- Node.js 20.19 or newer
- A Cloudflare account with Workers enabled
- An OpenAlex API key
- `pdftotext` (Poppler) only when extracting an owner-supplied JIF PDF

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

## OpenAlex journal classification

The selector uses the OpenAlex hierarchy [`Domain → Field → Subfield → Topic`](https://developers.openalex.org/api-reference/subfields). The Worker filters all OpenAlex articles and reviews by `primary_topic.subfield.id`, requires an ISSN-bearing journal as the primary Source, and groups the matching works by Source. Membership may overlap across Subfields.

The Worker requests a non-paginated group page of 100 Sources, which OpenAlex returns by matching-work count. Cursor paging is deliberately not used because OpenAlex sorts paged groups by key rather than count. The 100-Source limit keeps a complete primary-topic analysis plus a normal network generation within the public Worker's interactive request budget. This produces a reproducible, bounded journal set without manual classification. It is an OpenAlex-derived operational definition, not a JCR category.

The analyzed publication year is independent of this Source-level taxonomy. The selected Source IDs are fixed for topic rankings, trends, journal breakdowns, and network construction in a completed analysis. In the default **Strict selected subfield** scope, every final works query also includes the selected `primary_topic.subfield.id`. The optional **Entire journal set** scope omits that final filter and preserves the broader journal-set interpretation used by older shared URLs.

Shareable URLs record the scope as `scope=strict` or `scope=journals`. Existing URLs without `scope` retain journal-set behavior; new analyses default to strict scope.

The older owner-supplied category ingestion layer remains in `public/data/categories/` for compatibility and validation, but it is no longer used by the main selector.

## Private local JIF enrichment

The local PDF is parsed automatically by eISSN. Extraction writes only to ignored private storage:

```bash
npm run extract:jif
```

This generates `data-private/jif-2026-local.json`. The file is not bundled or committed. The parser rejects a suspiciously incomplete extraction and never falls back to fuzzy journal-name matching.

Open the application, select **Choose JIF JSON**, and choose that generated file. The browser validates the complete schema and keeps the parsed data only in the current tab's memory. It does not upload the file, call the Worker with JIF data, or write to local storage, session storage, or IndexedDB. Reloading or closing the tab removes the enrichment.

The UI then shows JIF and quartile in the Journals tab and in a user-initiated local CSV export. Missing JIF remains blank and never excludes a journal. The source/provider and edition stay explicit. The supplied PDF yielded 21,648 unique, checksum-valid eISSN records; rows without a valid eISSN cannot be linked automatically with adequate confidence. The extraction script refuses any output path beneath `public/data/`.

## Methodology

- **Journal-set rule:** the 100 journals with the most OpenAlex articles/reviews whose primary topic belongs to the selected Subfield define the set; membership is not inferred from JIF.
- **Analysis scope:** strict scope retains only works whose primary topic belongs to the selected Subfield; journal-set scope retains all matching works from the discovered Sources. The selected scope applies consistently to rankings, trends, journal counts, and network queries.
- **Journal assignment:** works are filtered by `primary_location.source.id`.
- **Counting rule:** the topic ranking groups on `primary_topic.id`, giving each classified work exactly one primary-topic count.
- **Document types:** the default is OpenAlex `article` plus `review`; choosing all types omits the type filter.
- **Publication year:** OpenAlex `publication_year`, independently selected from the taxonomy.
- **XPAC:** every works query explicitly sets `include_xpac=false`.
- **Trends:** grouped annual counts are used; growth is shown only when the previous-year topic count is at least 20 documents.
- **Network:** nodes are the top 20, 30, or 40 primary topics. For each seed node, matching works are grouped by all attached `topics.id`; links therefore mean topic co-occurrence within works, not citation or semantic similarity. Edges below strength 5 are removed and at most 250 remain.
- **JIF:** optional, locally loaded Clarivate metadata is matched after classification by exact eISSN and does not change any result.

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
POST /v1/openalex-subfields
POST /v1/openalex-subfield-sources
```

It enforces exact-origin CORS, a 32 KiB request body cap, schema validation, ISSN checksums, `S\d+`/`T\d+` identifiers, reasonable years, a maximum 15-year range, 500 ISSNs, 100 source IDs, and 40 topic IDs. The Cloudflare rate-limit binding defaults to 60 requests per 60 seconds per origin/client key; this was raised from 30 after a production Optics analysis demonstrated that exhaustive group paging plus an interactive network could legitimately exceed 30. Topic metadata uses a bounded four-request upstream pool; no unbounded user-derived `Promise.all` is used.

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
https://USERNAME.github.io/research-topic-explorer/?category=3107&year=2024&types=article,review&tab=overview
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

CSV and JSON downloads carry or derive the OpenAlex Subfield ID/name, analysis scope, journal-set rule, truncation flag, analyzed publication year, selected work types, Source IDs, analyzed and classified counts, counting/network rules, XPAC exclusion, optional JIF edition/provider, and generation timestamp. API cache contents are accelerators, not a database of record.

## Known limits

- OpenAlex primary-topic assignments are non-exclusive at journal-set level and can change when OpenAlex updates its records.
- Strict scope follows the official OpenAlex Subfield boundary exactly; it cannot separate concepts combined in one OpenAlex category, such as atomic and molecular physics with optics.
- The 100-Source cap favors journals with the most matching primary-topic articles/reviews and is reported in methodology metadata.
- Clarivate JIF data is never loaded from the public deployment. Users must select a legitimate local dataset, which remains in browser memory for the current tab only.
- Results inherit OpenAlex coverage and classification quality and can change as OpenAlex updates records.
- The official VOSviewer bundle is large (about 1.55 MB compressed in the current build), but is split into a lazy chunk and is not loaded for ranking, trends, or journal views.
- A shared public API key still has budget and abuse risk. The closed routes, aggregation, caching, rate limiting, and conservative UI limits reduce that risk but cannot eliminate non-browser abuse.
- There is no cross-session result database; reproducibility depends on exported metadata and the state of OpenAlex at generation time.

## Attribution

Publication, source, and topic data come from [OpenAlex](https://openalex.org/). Network rendering uses [VOSviewer Online](https://app.vosviewer.com/) and its official React package. This software is released under the MIT License; third-party packages and data retain their own terms.
