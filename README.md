# Research Topic Explorer

Explore the research topics, publication trends, citation-normalized impact, journals, countries, institutions, and topic relationships within an OpenAlex research subfield.

## [Open the live application](https://jorpago2.github.io/research-topic-explorer/)

No account or installation is required. The application is public and works in a modern desktop or mobile browser.

Prefer a concrete starting point? [Analyze Electrical and Electronic Engineering in 2025](https://jorpago2.github.io/research-topic-explorer/?category=2208&year=2025&scope=strict&types=article%2Creview&tab=overview&nodes=30&normalization=association) using strict scope and the default article-and-review filter.

> **Methodology boundary:** journal-set membership, publication records, and topic classifications come from OpenAlex. Optional Journal Impact Factor (JIF) metadata is supplied locally by the user and remains separate. Results are not Clarivate Citation Topics, JCR categories, or official JCR analytics.

## What can I investigate?

Research Topic Explorer can help answer questions such as:

- What primary research topics dominate an OpenAlex Subfield in a selected year?
- Which topics are gaining or losing share of the publication corpus?
- Which topics show growing, mature, or declining publication patterns?
- What proportion of a topic's publications belongs to OpenAlex's citation-normalized top 10% or top 1%?
- Which countries and institutions increased their output most between two comparable periods?
- Which topics frequently occur together in the same publications?
- Which journals define the analyzed set, and how much does each journal contribute?

The default example is **Electrical and Electronic Engineering**, but the selector provides the complete OpenAlex hierarchy of Domains, Fields, and Subfields.

## Quick start

1. [Open the application](https://jorpago2.github.io/research-topic-explorer/).
2. Select an **OpenAlex Domain**, **Field**, and **Subfield**.
3. Choose the analysis scope:
   - **Strict selected subfield** is recommended for a focused analysis. It retains only works whose primary topic belongs to the selected Subfield.
   - **Entire journal set** includes every matching work published by the discovered journals, so adjacent disciplines may appear.
4. Select the publication year and document types. The default is **articles and reviews**.
5. Select **Analyze**.
6. Explore the result tabs or download the data for further analysis.

The application stores the selected controls in the URL. You can bookmark or share the resulting address without creating an account.

## Guide to the result tabs

| Tab | What it shows | Recommended use |
| --- | --- | --- |
| **Overview** | Primary-topic ranking, document counts, corpus shares, classification coverage, Topic hierarchy, and evidence publications | Identify the most represented topics and inspect representative publications |
| **Trends** | Annual output, equal-period comparisons, lifecycle signals, normalized citation impact, and emerging countries/institutions | Distinguish sustained field changes from a single-year fluctuation |
| **Network** | Bounded Topic co-occurrence map rendered with VOSviewer Online | Explore clusters and relationships between the leading topics |
| **Journals** | Analyzed OpenAlex Sources and their publication contribution | Check the operational journal set and understand its coverage |
| **Methodology** | Scope, filters, counting rules, limits, and reproducibility metadata | Verify exactly what was counted before interpreting or reporting results |

## How to interpret the results

### Journal set and analysis scope

OpenAlex does not provide JCR categories. The application therefore uses an explicit, reproducible operational rule:

1. Select an OpenAlex Subfield.
2. Find the ISSN-bearing journals with the most OpenAlex articles and reviews whose primary topic belongs to that Subfield.
3. Retain at most the leading 100 journals.
4. Use those fixed OpenAlex Source IDs for the completed analysis.

The **100-journal cap** is displayed in the interface. It keeps a public analysis bounded and reproducible, but it means the journal set is not an exhaustive list of every journal that may publish work in the field.

In **Strict selected subfield** mode, every final works query also retains the selected OpenAlex Subfield filter. In **Entire journal set** mode, the application analyzes all matching works from those journals. The latter is intentionally broader and can include topics from neighboring disciplines.

### Primary-topic ranking

The main ranking uses `primary_topic.id`. A work has at most one OpenAlex primary Topic, so each classified publication contributes once to the ranking. Topic share is:

```text
Topic primary-publication count / analyzed publication count
```

The interface also reports classification coverage. OpenAlex Topics are algorithmic classifications and should not be described as "JCR topics."

### Topic lifecycle radar

Lifecycle labels are transparent analytical signals, not predictions:

- **Emerging:** low output in the previous period, increasing corpus share, positive recent slope, and positive acceleration.
- **Growing:** increasing corpus share and a positive recent slope.
- **Mature:** substantial activity without a sufficiently strong growing or declining signal.
- **Declining:** decreasing corpus share and a negative recent slope.
- **Insufficient evidence:** the recent period contains too few documents or the corpus is incomplete.

The comparison uses two adjacent periods of equal length. A signal requires at least 50 recent documents; the exact thresholds and values are shown in the Methodology tab and CSV export. Treat the labels as screening indicators that require subject-matter interpretation.

### Citation-normalized impact

For one selected Topic, the application shows the percentage of matching works flagged by OpenAlex as belonging to the citation-normalized:

- top 10%;
- top 1%.

This is not a mean citation count, Journal Impact Factor, or journal ranking. The denominator contains all matching Topic works. Citation data for very recent publications can still evolve, so current-year comparisons should be interpreted cautiously.

### Emerging countries and institutions

The actor comparison ranks positive publication-count gains between the same two periods used by the trend analysis. It is run only when the user selects **Analyze actors** because these groupings are more expensive.

Country and institution counts are **participations**, not mutually exclusive documents. A publication with authors from three countries contributes to all three country groups. Each period is limited to OpenAlex's top 100 groups, so lower-volume actors may be absent.

### Topic network

The network links Topics that occur in the same works. A link therefore represents **co-occurrence**, not citation flow, author collaboration, causal influence, or semantic equivalence.

The application supports raw counts, VOS association strength, cosine, and Jaccard weighting. Links require at least five co-occurring works, the network contains at most 40 nodes and 250 edges, and rendering uses the official `vosviewer-online` React component.

## Export and reproducibility

The application can export:

- primary-topic rankings as CSV;
- annual trends and period comparisons as CSV;
- lifecycle signals as CSV;
- normalized-impact series as CSV;
- country and institution comparisons as CSV;
- journal contributions as CSV;
- the co-occurrence network as VOSviewer-compatible JSON.

Exports carry or derive the selected OpenAlex Subfield, analysis scope, publication year, document types, Source IDs, counting rules, XPAC exclusion, truncation state, optional local JIF edition, and generation timestamp.

OpenAlex records and classifications can change. For research reporting, preserve the exported data, the shared URL, and the generation date rather than relying only on a later rerun.

## Optional private JIF enrichment

The public application does not distribute Clarivate data. If you possess a legitimate, locally prepared JIF JSON file, select **Choose JIF JSON** to enrich the Journals table.

- The file is parsed only in the current browser tab.
- It is never uploaded to the Worker or OpenAlex.
- It is not written to local storage, session storage, or IndexedDB.
- Reloading or closing the tab removes the enrichment.
- JIF never changes the journal set, Topic ranking, trend analysis, or network.

The repository includes a local extraction workflow for the repository owner's PDF. Private source files and generated JIF tables are ignored by Git and excluded from the public build.

## Important limitations

- Results inherit OpenAlex's publication coverage, source matching, and Topic-classification quality.
- OpenAlex classifications and citation information may be revised over time.
- The operational journal set is bounded to 100 Sources and is not an official disciplinary journal list.
- Strict scope follows the OpenAlex Subfield boundary; it cannot subdivide concepts that OpenAlex combines within one Subfield.
- Current-year output and citation-normalized impact may be incomplete.
- Lifecycle labels are descriptive heuristics, not forecasts of future research importance.
- Country and institution counts can exceed the number of publications because multi-actor works contribute to multiple groups.
- Co-occurrence links do not demonstrate scientific dependence or citation relationships.
- The public Worker has conservative rate limits. If a limit is reached, wait briefly before retrying rather than repeatedly submitting the same analysis.
- There is no cross-session result database. Preserve exports when reproducibility matters.

## Data sources and attribution

Publication, journal, Topic, hierarchy, authorship, institution, country, and citation-normalized data come from [OpenAlex](https://openalex.org/). Network rendering uses [VOSviewer Online](https://app.vosviewer.com/) and its official React package.

This software is released under the MIT License. OpenAlex, Clarivate, VOSviewer, and all third-party packages and datasets retain their own terms and licenses.

---

## For maintainers and contributors

### Architecture

```text
GitHub Pages: React + TypeScript + Vite + IBM Carbon
        |
        | closed, validated HTTPS operations
        v
Cloudflare Worker: CORS + validation + rate limit + cache + secret
        |
        | api_key added server-side
        v
OpenAlex REST API
```

There is no login, application database, generic proxy, arbitrary upstream path, arbitrary filter, or browser-to-OpenAlex request. The OpenAlex key exists only as the Cloudflare secret `OPENALEX_API_KEY`. The production frontend has source maps disabled and cannot import Worker configuration.

### Locked compatibility choices

Dependencies are locked in `package-lock.json`. The main compatibility choices are:

- `react@18.3.1` and `react-dom@18.3.1`;
- `@carbon/react@1.113.0` with Carbon Sass tokens and local IBM Plex fonts;
- `vosviewer-online@1.2.4`, lazy-loaded only for the Network tab;
- `mobx@6.16.1` and `mobx-react-lite@3.4.3` for VOSviewer compatibility.

The VOSviewer dependency tree includes an older `qrcode.react` peer declaration, which produces a peer warning with React 18. The required VOSviewer package declares React 18 support, and the integration is covered by build, integration, and end-to-end tests. `dompurify` is overridden to a patched version.

### Local development

Requirements:

- Node.js 20.19 or newer;
- a Cloudflare account with Workers enabled;
- an OpenAlex API key;
- `pdftotext` from Poppler only for local JIF PDF extraction.

Install the locked dependencies:

```bash
npm ci
```

Copy `.env.example` to `.env` and keep only public frontend values there:

```dotenv
VITE_API_BASE_URL=http://localhost:8787
VITE_BASE_PATH=/
VITE_GITHUB_REPOSITORY_URL=
```

Copy `worker/.dev.vars.example` to `worker/.dev.vars`, then add the development secret:

```dotenv
OPENALEX_API_KEY=replace-with-local-secret
```

Never prefix the OpenAlex key with `VITE_`. Secret files are ignored by Git.

Run the Worker and frontend in separate terminals:

```bash
npm run dev:worker
npm run dev
```

The default Worker allowlist accepts exactly `http://localhost:5173`.

### Closed Worker operations

```text
GET  /health
POST /v1/resolve-sources
POST /v1/group-primary-topics
POST /v1/topic-details
POST /v1/topic-evidence
POST /v1/group-topic-years
POST /v1/group-category-years
POST /v1/topic-impact-years
POST /v1/topic-actors
POST /v1/group-sources
POST /v1/group-topic-cooccurrence
POST /v1/openalex-subfields
POST /v1/openalex-subfield-sources
```

The Worker enforces exact-origin CORS, a 32 KiB body limit, Zod validation, ISSN checksums, bounded Source and Topic ID arrays, a maximum 15-year range, fixed actor dimensions, controlled upstream concurrency, deterministic caching, and a Cloudflare rate-limit binding. It never accepts arbitrary URLs, OpenAlex paths, filters, or groupings.

All works queries set `include_xpac=false`. Source arrays are limited to 100 IDs per atomic request; Topic metadata accepts at most 40 IDs; network size is limited to 40 nodes. Historical aggregations use a seven-day TTL, current-year aggregations use 12 hours, and Source/Topic metadata uses 30 days. Cache keys never contain the OpenAlex API key.

### Local JIF extraction

With the private PDF available locally:

```bash
npm run extract:jif
```

The script writes `data-private/jif-2026-local.json`, validates eISSN checksums, rejects suspiciously incomplete extraction, and refuses output paths beneath `public/data/`. It does not use fuzzy journal-name matching.

### Cloudflare deployment

Provision the OpenAlex key directly as a Worker secret:

```bash
npx wrangler secret put OPENALEX_API_KEY --config worker/wrangler.jsonc
```

Deploy with the exact production origin. A GitHub Pages project URL has origin `https://USERNAME.github.io`, without the repository path:

```bash
npx wrangler deploy --config worker/wrangler.jsonc \
  --var "ALLOWED_ORIGINS:https://USERNAME.github.io,http://localhost:5173"
```

Do not place the OpenAlex key in Wrangler `vars`, GitHub repository variables, frontend environment files, or build arguments.

### GitHub Pages deployment

Set repository variable `VITE_API_BASE_URL` to the deployed Worker origin and select **GitHub Actions** as the Pages source. The workflow derives `VITE_BASE_PATH` from the repository name, so the project works from a non-root Pages path and preserves query parameters on direct reload.

### Verification

```bash
npm run typecheck
npm run test:run
npm run build
npm run test:security
npm run test:e2e
npm audit
```

`test:security` inspects the browser source and production bundle for secret names, direct OpenAlex requests, forbidden browser storage, and private JIF data. Worker tests also cover origin rejection, unsupported routes, validation, rate limiting, fixed filters, bounded operations, sanitized upstream failures, and API-key non-disclosure.

## License

[MIT](LICENSE)
