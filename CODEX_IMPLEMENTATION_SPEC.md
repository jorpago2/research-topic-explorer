# Research Topic Explorer — Codex Implementation Specification

## 0. Instruction to Codex

Build the application described in this document as a production-ready public web application.

Do not reinterpret the architecture unless a documented technical incompatibility makes a requirement impossible. If that happens, preserve the product behavior and security properties, document the deviation in the repository README, and choose the smallest possible change.

The application must be:

- Publicly usable by anyone without login.
- Hosted as a static React application on GitHub Pages.
- Backed by a small Cloudflare Worker that protects the site owner's OpenAlex API key.
- Based on OpenAlex for publication/topic data.
- Able to analyze a journal category such as **JCR Optics** for a selected publication year such as **2024**.
- Able to visualize a topic co-occurrence network using the official **VOSviewer Online React component**.
- Designed so the OpenAlex API key is never present in the GitHub Pages bundle, browser storage, browser network requests, HTML, source maps, logs, or public repository.
- Designed to minimize OpenAlex API consumption through aggregation, batching, caching, and conservative limits.

The initial implementation should prioritize correctness, reproducibility, understandable methodology, and a polished research-tool user experience over unnecessary features.

---

# 1. Product Goal

Create a web application that answers questions such as:

> What research topics were most published in the JCR category "Optics" in 2024?

and:

> Which topics are growing fastest within Optics?

and:

> How are the main research topics in Optics related to each other?

The core workflow is:

1. Select a journal category.
2. Select a publication year.
3. Analyze publications from journals belonging to that category.
4. Use OpenAlex Topics to rank the research topics represented in those publications.
5. Show topic counts, shares, trends, and a network visualization.
6. Allow the user to export the results.

The application should be useful for researchers, librarians, research managers, bibliometricians, and anyone exploring scientific fields.

---

# 2. Critical Methodological Distinction

This distinction must be preserved throughout the code and UI.

## 2.1 What JCR does in this application

A JCR category is used **only to define a journal set**.

For example:

```text
JCR category: Optics
        ↓
journals in that category
        ↓
ISSNs
        ↓
OpenAlex Sources
```

The application does not use Clarivate Citation Topics.

## 2.2 What OpenAlex does

OpenAlex provides:

- source/journal identifiers,
- publication records,
- publication years,
- work types,
- primary topics,
- additional topics,
- topic hierarchy metadata.

Therefore:

```text
JCR category
     ↓
journal membership / ISSNs
     ↓
OpenAlex source IDs
     ↓
OpenAlex works
     ↓
OpenAlex Topics
```

## 2.3 Mandatory methodology disclaimer

The UI must clearly state something equivalent to:

> Journal-category membership is supplied by the site's category dataset. Publication records and topic classifications come from OpenAlex. The resulting topic rankings are OpenAlex-based analyses of the selected journal set and are not Clarivate Citation Topics or official JCR analytics.

Do not label OpenAlex Topics as "JCR topics".

---

# 3. JCR Category Data and Licensing Boundary

Do not scrape Clarivate/JCR.

Do not implement automatic extraction from the JCR website.

Do not assume that a complete Clarivate category dataset may be redistributed.

The application must instead consume a repository-owner-supplied category catalog.

Codex must build the **category ingestion and validation layer**, but category membership itself is an external input supplied by the repository owner.

The code should make it straightforward to add legitimate category files later.

## 3.1 Category file schema

Store category definitions under:

```text
public/data/categories/
```

Example:

```text
public/data/categories/index.json
public/data/categories/jcr-2024-optics.json
```

`index.json`:

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

Individual category file:

```json
{
  "schemaVersion": 1,
  "id": "jcr-2024-optics",
  "name": "Optics",
  "taxonomy": "JCR",
  "edition": "2024",
  "sourceNote": "Category membership supplied by the repository owner.",
  "journals": [
    {
      "name": "Journal name",
      "issns": [
        "1234-5678",
        "8765-4321"
      ]
    }
  ]
}
```

Requirements:

- A journal can have multiple ISSNs.
- Normalize ISSNs before resolving them.
- Deduplicate repeated ISSNs.
- Deduplicate OpenAlex Sources after resolution.
- Keep the original journal name for the coverage report.
- Do not assume that one ISSN always maps perfectly to one journal record.
- Do not silently discard unresolved journals.

## 3.2 Category edition vs publication year

Treat these as independent concepts.

Example:

```text
Category definition: JCR Optics, edition 2024
Publication year analyzed: 2024
```

The UI should expose publication year as the main analysis selector.

If category edition metadata exists, show it in methodology/details.

---

# 4. High-Level Architecture

Use this architecture:

```text
┌──────────────────────────────────────────────────────────┐
│ GitHub Pages                                             │
│                                                          │
│ React + TypeScript + Vite                                │
│                                                          │
│ - category selector                                      │
│ - publication year selector                              │
│ - OpenAlex result aggregation                            │
│ - charts and tables                                      │
│ - VOSviewer Online React integration                     │
│ - CSV / JSON export                                      │
└────────────────────────────┬─────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
┌──────────────────────────────────────────────────────────┐
│ Cloudflare Worker                                        │
│                                                          │
│ - validates allowed operations                           │
│ - validates all input                                    │
│ - enforces conservative limits                           │
│ - caches identical requests                              │
│ - adds OPENALEX_API_KEY                                  │
│ - calls OpenAlex                                         │
│ - sanitizes responses/errors                             │
└────────────────────────────┬─────────────────────────────┘
                             │
                             │ server-to-server
                             ▼
┌──────────────────────────────────────────────────────────┐
│ OpenAlex API                                             │
└──────────────────────────────────────────────────────────┘
```

There is no application database.

There is no user login.

There is no custom backend server.

GitHub Pages remains completely static.

The Cloudflare Worker exists only to securely mediate the limited OpenAlex operations needed by the application.

---

# 5. Security Requirement: OpenAlex API Key

This is a non-negotiable requirement.

The OpenAlex API key must exist only as a **Cloudflare Worker secret**.

The key must never be:

- prefixed with `VITE_`,
- put in a React environment variable,
- injected into the frontend at build time,
- committed to Git,
- included in a GitHub Pages artifact,
- stored in localStorage,
- stored in sessionStorage,
- placed in a query string sent by the browser,
- exposed in source maps,
- returned in a Worker response,
- included in Worker error messages,
- included in application logs.

Cloudflare configuration must use a secret named:

```text
OPENALEX_API_KEY
```

For local Worker development, use an ignored `.dev.vars` or equivalent secret file.

Add secret files to `.gitignore`.

Production setup should use Cloudflare Wrangler's secret mechanism or the Cloudflare dashboard's Secret variable type.

Do not store the key as a normal Wrangler `vars` value.

---

# 6. Do Not Build a Generic OpenAlex Proxy

This is also non-negotiable.

Do **not** implement:

```text
/api/proxy?url=https://api.openalex.org/...
```

Do not accept arbitrary OpenAlex paths.

Do not accept arbitrary OpenAlex filter strings.

Do not accept arbitrary external URLs.

That would allow the public site to become an unrestricted proxy using the owner's API quota.

Instead, expose a small set of explicit operations with strongly validated request bodies.

---

# 7. Recommended Repository Structure

Use a single repository.

Suggested structure:

```text
/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── categories/
│   │   ├── source-resolution/
│   │   ├── topic-ranking/
│   │   ├── trends/
│   │   ├── network/
│   │   └── export/
│   ├── lib/
│   ├── types/
│   ├── styles/
│   ├── main.tsx
│   └── App.tsx
│
├── public/
│   └── data/
│       └── categories/
│           ├── index.json
│           └── ...
│
├── worker/
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   ├── openalex/
│   │   ├── cache/
│   │   ├── validation/
│   │   └── types/
│   ├── wrangler.jsonc
│   ├── tsconfig.json
│   └── package.json
│
├── scripts/
│   └── validate-category-data.ts
│
├── tests/
├── .github/
│   └── workflows/
│       ├── pages.yml
│       └── worker.yml
│
├── vite.config.ts
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

If a simpler package layout is easier, keep one root `package.json`, but retain clear separation between browser code and Worker code.

Browser code must never import Worker secret/config modules.

---

# 8. Frontend Technology

Use:

- React
- TypeScript
- Vite
- the official `vosviewer-online` React package
- TanStack Query for request state and client-side query caching
- Zod or an equivalent runtime schema validator
- a lightweight chart library such as Recharts for bar/line charts
- modern CSS, CSS modules, or Tailwind; choose one system and use it consistently

Avoid unnecessary global state libraries.

Most state can be:

- URL/query state,
- component state,
- TanStack Query state.

## 8.1 VOSviewer package compatibility

Do not blindly install the newest React version if the VOSviewer Online package's peer dependencies require a particular supported React range.

Before implementation:

1. inspect `vosviewer-online` peer dependencies,
2. select a compatible stable React version,
3. lock dependencies in the package lockfile,
4. document the selected versions in the README.

The VOSviewer Online React component is a required part of the product.

---

# 9. GitHub Pages Compatibility

The frontend must work as a project GitHub Pages site, for example:

```text
https://username.github.io/research-topic-explorer/
```

Do not assume the application is served from `/`.

Configure the Vite base path correctly.

Prefer one of:

- a build-time `VITE_BASE_PATH`, or
- deriving the repository name in the Pages workflow.

Avoid browser-history routes that require server rewrites.

This application can remain a single-page interface with tabs and URL query parameters.

Use query parameters for shareable analysis state, for example:

```text
?category=jcr-2024-optics&year=2024&types=article,review&tab=topics
```

The app must reload successfully when opened directly at the GitHub Pages project URL with those query parameters.

---

# 10. Public Configuration

The frontend needs only non-sensitive configuration.

Example:

```text
VITE_API_BASE_URL=https://research-topic-api.example.workers.dev
```

This value is public and may safely be embedded in the frontend.

Do not confuse this with a secret.

---

# 11. Cloudflare Worker Responsibilities

The Worker should:

1. Validate the browser origin.
2. Handle CORS.
3. Validate the route.
4. Validate the request body.
5. Normalize IDs and parameters.
6. Reject unsupported operations.
7. Generate an OpenAlex request itself.
8. Add `OPENALEX_API_KEY` server-side.
9. Fetch OpenAlex.
10. Cache reusable responses.
11. Remove or sanitize sensitive/error data.
12. Return a stable application-specific response.

The Worker should be small and auditable.

---

# 12. Worker CORS Policy

Allow only configured origins such as:

```text
https://USERNAME.github.io
http://localhost:5173
```

Support exact origin allowlisting.

Return:

```text
Access-Control-Allow-Origin: <validated origin>
Vary: Origin
```

Handle `OPTIONS` preflight.

Do not use:

```text
Access-Control-Allow-Origin: *
```

for production.

Important: CORS is not sufficient protection against non-browser abuse. Endpoint restriction, caching, request validation, and rate limiting are still required.

---

# 13. Worker Abuse Protection

Implement conservative controls.

## 13.1 Input limits

Recommended initial limits:

```text
ISSNs per source-resolution request: 500
OpenAlex source IDs per atomic grouping request: 100
Topic IDs per topic-details request: 40
Network nodes: maximum 40
Publication-year range: maximum 15 years
Request body size: keep small and reject obviously excessive payloads
```

The OpenAlex API currently allows OR filters containing up to 100 values, so browser-side source chunking must use a maximum chunk size of 100.

Do not rely on this constant forever; isolate it in configuration.

## 13.2 ID validation

OpenAlex Source ID:

```regex
^S\d+$
```

OpenAlex Topic ID:

```regex
^T\d+$
```

ISSN after normalization:

```regex
^\d{4}-[\dX]{4}$
```

Use a proper ISSN normalization/check routine if practical.

Publication year:

- integer,
- reasonable scholarly range,
- not beyond the current calendar year.

## 13.3 Rate limiting

Add per-client rate limiting using the appropriate Cloudflare Worker mechanism available to the project.

Use a conservative default such as approximately:

```text
30 API requests per minute per client
```

The exact implementation may be adjusted to the current Cloudflare Free-plan capabilities.

The application must still function comfortably for a normal interactive user.

## 13.4 Upstream concurrency

Limit Worker-to-OpenAlex concurrency.

Never create an unbounded `Promise.all()` based on user input.

---

# 14. Worker Caching

Caching is important because the application will be public and uses one shared OpenAlex API key.

Cache sanitized Worker responses using a deterministic cache key built from:

- route,
- normalized source IDs,
- normalized ISSNs,
- publication year/range,
- document type selection,
- topic ID,
- cursor,
- application cache schema version.

Never include the OpenAlex API key in the cache key.

Suggested TTLs:

```text
Source resolution:            30 days
Past-year topic aggregations: 7 days
Past-year trend aggregations: 7 days
Past-year network queries:    7 days
Current-year aggregations:    6–24 hours
Topic metadata:               30 days
```

Make TTL values constants.

Return an optional non-sensitive header such as:

```text
X-App-Cache: HIT
```

or:

```text
X-App-Cache: MISS
```

for diagnostics.

---

# 15. OpenAlex Usage Rules

All OpenAlex requests originate from the Worker.

Use the API key as an `api_key` query parameter only in the server-to-server request.

Use the OpenAlex REST API.

Use list/filter/group operations instead of downloading all works whenever possible.

Use `primary_location.source.id` to identify the journal in which the work is primarily published.

Explicitly keep XPAC excluded unless the methodology is intentionally changed later.

For reproducibility, the application should send:

```text
include_xpac=false
```

on works queries.

---

# 16. Source Resolution

A category contains journal ISSNs.

OpenAlex analysis should use OpenAlex Source IDs.

Therefore source resolution is:

```text
category journals
    ↓
ISSNs
    ↓
OpenAlex Sources
    ↓
deduplicated Source IDs
```

## 16.1 Worker endpoint

Implement:

```text
POST /v1/resolve-sources
```

Request:

```json
{
  "issns": [
    "1234-5678",
    "8765-4321"
  ]
}
```

The Worker should split ISSNs into batches no larger than the current OpenAlex OR-filter limit.

Use OpenAlex's Sources endpoint and ISSN filter to resolve multiple ISSNs efficiently.

Return a normalized structure such as:

```json
{
  "sources": [
    {
      "id": "S123456789",
      "displayName": "Example Journal",
      "issnL": "1234-5678",
      "issns": [
        "1234-5678",
        "8765-4321"
      ],
      "type": "journal"
    }
  ],
  "unresolvedIssns": [
    "9999-9999"
  ]
}
```

Never return the upstream request URL if it contains the API key.

## 16.2 Client-side journal coverage report

After resolution, map results back to the input journals.

Display:

- journals in category,
- journals resolved to OpenAlex,
- journals unresolved,
- unique OpenAlex Sources,
- coverage percentage by journal count.

Provide an expandable "Coverage details" panel.

Allow the analysis to proceed with partial coverage, but clearly warn the user when coverage is incomplete.

Example:

```text
OpenAlex coverage: 118 / 121 journals resolved (97.5%)
```

Do not pretend unresolved journals were analyzed.

---

# 17. Document-Type Filter

Default to:

```text
article + review
```

using OpenAlex Work types:

```text
article
review
```

Provide a selector:

```text
Document types
● Articles + reviews
○ All OpenAlex work types
```

Optionally allow advanced multi-selection later.

Every result must carry the selected document-type methodology.

If "All types" is selected, omit the `type` filter rather than constructing a huge OR list.

---

# 18. Topic Ranking Methodology

The primary ranking must use:

```text
group_by=primary_topic.id
```

Reason:

- each work has one primary topic,
- each document is therefore counted once,
- ranking totals are intuitive,
- topic shares have a clear denominator.

The application should call these **OpenAlex primary topics** in methodology/help text.

## 18.1 Atomic Worker endpoint

Implement:

```text
POST /v1/group-primary-topics
```

This endpoint handles at most 100 OpenAlex Source IDs per request.

Request:

```json
{
  "sourceIds": [
    "S123",
    "S456"
  ],
  "year": 2024,
  "types": [
    "article",
    "review"
  ],
  "cursor": "*"
}
```

The Worker creates an upstream works query conceptually equivalent to:

```text
filter=
  publication_year:2024,
  type:article|review,
  primary_location.source.id:S123|S456

group_by=primary_topic.id
include_xpac=false
cursor=*
```

The exact encoding must be generated using `URL` and `URLSearchParams`, never manual string concatenation of untrusted input.

Return:

```json
{
  "meta": {
    "documentCount": 12345,
    "nextCursor": "...",
    "costUsd": 0.0001
  },
  "groups": [
    {
      "topicId": "T123",
      "displayName": "Example Topic",
      "count": 532
    }
  ]
}
```

Do not return the OpenAlex API key.

`costUsd` may be included because it is not secret and can be useful for development, but it does not need to be shown to normal users.

## 18.2 Browser-side aggregation

A JCR category may contain more than 100 OpenAlex Sources.

The frontend must:

1. chunk unique Source IDs into arrays of at most 100,
2. request all pages of primary-topic groups for each chunk,
3. merge counts by Topic ID,
4. sum document counts across source chunks,
5. sort topics by count descending.

Do not assume one group page contains all topics.

OpenAlex grouping supports paging; implement it.

Use a controlled concurrency limit, for example two requests at a time.

## 18.3 Ranking result shape

Normalize to:

```ts
interface TopicRankingRow {
  topicId: string;
  name: string;
  count: number;
  share: number;
  rank: number;
}
```

Where:

```text
share = topic count / analyzed document count
```

Also calculate:

```text
classifiedDocumentCount = sum(primary-topic counts)
classificationCoverage = classifiedDocumentCount / analyzedDocumentCount
```

Normally this should be close to 100%, but preserve the metric for transparency.

---

# 19. Topic Metadata

The ranking group response provides an ID/name/count but not all hierarchy metadata needed by the UI.

For visible top topics, obtain full topic metadata.

Implement:

```text
POST /v1/topic-details
```

Request:

```json
{
  "topicIds": [
    "T123",
    "T456"
  ]
}
```

Maximum 40 topic IDs per request.

The Worker can retrieve topic singleton objects in a bounded parallel batch.

Return only fields needed by the application:

```json
{
  "topics": [
    {
      "id": "T123",
      "displayName": "Example Topic",
      "description": "…",
      "keywords": [
        "…"
      ],
      "subfield": {
        "id": "…",
        "displayName": "…"
      },
      "field": {
        "id": "…",
        "displayName": "…"
      },
      "domain": {
        "id": "…",
        "displayName": "…"
      }
    }
  ]
}
```

Do not expose irrelevant OpenAlex fields.

Cache topic details aggressively.

---

# 20. Overview Screen

After analysis, show a compact summary header.

Example:

```text
OPTICS · 2024
JCR category definition: 2024 edition

24,381
articles & reviews

118 / 121
journals resolved

342
primary topics

97.5%
journal coverage
```

Then show:

## 20.1 Top Topics bar chart

Default: top 15 or top 20.

Horizontal bars work well for long topic names.

Each row shows:

- rank,
- topic name,
- document count,
- share of analyzed documents.

Hover/focus shows:

- exact count,
- exact share,
- OpenAlex field/subfield if loaded.

## 20.2 Full topic table

Columns:

```text
Rank
Topic
Documents
Share
Subfield
Field
```

Features:

- sortable,
- text search,
- pagination or virtualization if necessary,
- click topic to select it for details/trends,
- accessible table semantics.

Default sort:

```text
Documents descending
```

---

# 21. Trends

The Trends view should answer:

> Which topics are growing?

and:

> How has the publication volume of a topic changed over time?

Do not fetch all documents.

Use grouped OpenAlex queries.

## 21.1 Default range

When analyzing publication year `Y`, default trend range:

```text
Y - 4 through Y
```

Example:

```text
2020–2024
```

Allow the user to adjust the range, up to the configured maximum.

## 21.2 Topics included

Default to the top 10 topics from the selected-year ranking.

Allow up to 12 selected topics in one trend chart.

## 21.3 Atomic Worker endpoint

Implement:

```text
POST /v1/group-topic-years
```

Request:

```json
{
  "sourceIds": [
    "S123",
    "S456"
  ],
  "topicId": "T123",
  "startYear": 2020,
  "endYear": 2024,
  "types": [
    "article",
    "review"
  ]
}
```

Maximum 100 Source IDs per request.

Use a works query conceptually equivalent to:

```text
filter=
  publication_year:2020-2024,
  type:article|review,
  primary_location.source.id:S123|S456,
  primary_topic.id:T123

group_by=publication_year
include_xpac=false
```

The frontend merges counts across source chunks.

## 21.4 Category totals by year

Implement:

```text
POST /v1/group-category-years
```

This groups the same selected journal set by publication year without a topic filter.

This allows calculation of:

```text
topic share in year =
topic documents in year / category documents in year
```

The trend UI should offer:

```text
Metric
● Documents
○ Share of category
```

## 21.5 Growth calculations

For each topic:

```text
YoY growth =
(currentCount - previousCount) / previousCount
```

Rules:

- if previous count is zero, display "—" rather than infinity,
- do not rank tiny topics as "fastest growing" without a minimum base.

Use an initial minimum-base rule such as:

```text
previous-year documents >= 20
```

Make it a constant.

"Fastest growing" should be calculated among topics already present in the analyzed ranking dataset, not by running expensive global discovery queries.

---

# 22. Journal Breakdown

Add a lightweight Journals section.

Implement:

```text
POST /v1/group-sources
```

Request:

```json
{
  "sourceIds": [
    "S123",
    "S456"
  ],
  "year": 2024,
  "types": [
    "article",
    "review"
  ],
  "cursor": "*"
}
```

Upstream concept:

```text
filter=
  publication_year:2024,
  type:article|review,
  primary_location.source.id:S123|S456

group_by=primary_location.source.id
include_xpac=false
```

Merge source groups across chunks.

Show:

```text
Journal
Documents
Share of analyzed documents
```

This is useful for understanding whether one or two journals dominate the category.

---

# 23. Topic Network

The Network view is a major feature.

Use the official VOSviewer Online React component.

The network represents **co-occurrence of OpenAlex Topics within works from the selected journal set and publication year**.

## 23.1 Node selection

Nodes should be based on the primary-topic ranking.

Default:

```text
Top 30 primary topics
```

Options:

```text
20
30
40
```

Maximum:

```text
40
```

Node document weight is the primary-topic publication count from the ranking.

## 23.2 Edge meaning

For a node topic `A`, query works in the selected journal set/year in which:

```text
topics.id = A
```

Then group those works by:

```text
topics.id
```

For another selected node topic `B`, the resulting count for `B` is the number of works containing both A and B.

That is the raw co-occurrence strength.

This uses the full OpenAlex `topics` array for relationships while retaining `primary_topic` for node ranking.

This methodological difference must be documented.

## 23.3 Atomic Worker endpoint

Implement:

```text
POST /v1/group-topic-cooccurrence
```

Request:

```json
{
  "sourceIds": [
    "S123",
    "S456"
  ],
  "seedTopicId": "T123",
  "year": 2024,
  "types": [
    "article",
    "review"
  ],
  "cursor": "*"
}
```

Maximum 100 Source IDs per request.

Conceptual upstream query:

```text
filter=
  publication_year:2024,
  type:article|review,
  primary_location.source.id:S123|S456,
  topics.id:T123

group_by=topics.id
include_xpac=false
```

Page through groups as needed.

## 23.4 Client network construction

Given selected node IDs:

```text
T1, T2, ... TN
```

For each seed topic except the final one:

1. get its topic co-occurrence groups across all source chunks,
2. merge counts,
3. retain only target topic IDs that are also in the selected node set,
4. only create an edge when target index > seed index.

This avoids duplicate A-B / B-A edges.

Edge:

```ts
interface TopicEdge {
  sourceId: string;
  targetId: string;
  strength: number;
}
```

Remove self-links.

## 23.5 Edge pruning

A full 40-node graph can have up to 780 edges.

Prune weak links for readability.

Use both:

```text
minimum raw co-occurrence threshold
```

and:

```text
maximum number of rendered edges
```

Suggested initial values:

```text
min strength = 5
max edges = 250
```

Sort links by strength descending before applying the maximum.

Expose an advanced UI control later if useful.

## 23.6 Avoid excessive network requests

Network generation is more expensive than the ranking.

Only generate it when the user opens the Network tab or presses:

```text
Generate network
```

Do not eagerly generate the network on page load.

Show progress such as:

```text
Building network 12 / 29 topics…
```

Use controlled concurrency.

Cache atomic Worker responses.

If the Worker/OpenAlex budget is exhausted, fail gracefully and preserve all already-loaded ranking/trend data.

---

# 24. VOSviewer Online Integration

Install the official React component package:

```bash
npm install vosviewer-online
```

Use:

```tsx
import { VOSviewerOnline } from "vosviewer-online";
```

and provide network data through its `data` prop.

Do not build a fake VOSviewer clone.

## 24.1 Lazy loading

VOSviewer is a large visualization dependency.

Lazy-load it only when the Network tab is opened.

Wrap it in an Error Boundary.

## 24.2 VOSviewer JSON

Build data in the native VOSviewer JSON structure.

Conceptual shape:

```json
{
  "network": {
    "items": [
      {
        "id": "T123",
        "label": "Optical Metasurfaces",
        "x": 0.5,
        "y": -0.2,
        "cluster": 1,
        "weights": {
          "Documents": 1421
        },
        "scores": {
          "Share (%)": 5.4,
          "Growth (%)": 18.2
        }
      }
    ],
    "links": [
      {
        "source_id": "T123",
        "target_id": "T456",
        "strength": 287
      }
    ],
    "clusters": [
      {
        "cluster": 1,
        "label": "Optics"
      }
    ]
  },
  "info": {
    "title": "Optics — OpenAlex topic network — 2024",
    "description": "Topic co-occurrence network for the selected journal category."
  }
}
```

## 24.3 Initial coordinates

Provide valid initial `x` and `y` coordinates.

Use a deterministic client-side force layout or another deterministic layout based on the links.

A practical implementation is `d3-force`.

Requirements:

- deterministic seed/initial placement,
- finite numeric positions,
- no NaN coordinates,
- stable enough that reloading the same dataset produces similar initial placement.

VOSviewer Online may then update layout/clustering interactively.

## 24.4 Initial clusters

Use OpenAlex Subfield metadata as a clear initial cluster assignment.

Map each distinct Subfield ID to a VOSviewer integer cluster ID starting from 1.

This gives interpretable initial colors.

The VOSviewer interface may later allow the user to update clustering.

## 24.5 VOSviewer item description

Include useful metadata in item descriptions:

```text
Topic
Documents
Share
Subfield
Field
Domain
Selected-year growth
```

Do not insert untrusted HTML.

Escape/sanitize all text used in descriptions.

## 24.6 Component UI

On desktop, prefer the normal VOSviewer UI so users can interact with layout and clustering controls.

Network container:

```text
width: 100%
min-height: approximately 600px
height: approximately 70vh
```

On small screens, provide a reasonable minimum and a notice that the network is easier to explore on a larger display.

---

# 25. Export Features

All exports are generated in the browser from already-loaded data.

No server endpoint is needed.

Provide:

## 25.1 Topic ranking CSV

Columns:

```text
rank
topic_id
topic
documents
share
subfield
field
domain
category_id
category_name
category_taxonomy
category_edition
publication_year
document_types
```

## 25.2 Trend CSV

Columns:

```text
topic_id
topic
year
documents
category_documents
share
yoy_growth
```

## 25.3 Journal CSV

Columns:

```text
source_id
journal
documents
share
```

## 25.4 VOSviewer JSON

Download exactly the JSON object passed to the VOSviewer component.

Suggested filename:

```text
optics-2024-openalex-topic-network.json
```

---

# 26. Main User Interface

Use a clean academic/research aesthetic.

Avoid a marketing-heavy landing page.

The analysis controls should be immediately visible.

## 26.1 Header

Example:

```text
Research Topic Explorer
Explore research topics across journal categories using OpenAlex
```

Include:

- Methodology
- About / GitHub link if repository URL is configured

## 26.2 Analysis controls

Desktop:

```text
Category                    Publication year        Document types

[ Optics              ▼ ]   [ 2024             ▼ ] [ Articles + reviews ▼ ]

                                                     [ Analyze ]
```

Mobile: stack vertically.

## 26.3 Category selector

Searchable.

Show metadata in the option:

```text
Optics
JCR · 2024 edition
```

## 26.4 Loading state

The analysis consists of multiple phases.

Show meaningful progress:

```text
1. Resolving journals…
2. Analyzing primary topics…
3. Loading topic metadata…
4. Preparing results…
```

Do not show only an indefinite spinner.

## 26.5 Results tabs

Use:

```text
Overview
Trends
Network
Journals
Methodology
```

Keep tab state in the URL query parameters.

---

# 27. Topic Detail Interaction

Clicking a topic row or bar should open a detail drawer/panel.

Show:

```text
Topic name
OpenAlex Topic ID

Documents in selected year
Share of selected category
Rank

Domain
Field
Subfield

Description
Keywords
```

If trend data is already loaded, show a small trend chart.

Do not make expensive additional queries simply to open the drawer unless needed.

---

# 28. URL State and Shareability

Persist these parameters in the URL:

```text
category
year
document types
active tab
network node count
selected topic when practical
```

Example:

```text
?category=jcr-2024-optics&year=2024&types=article,review&tab=network&nodes=30
```

On initial load:

1. parse URL,
2. validate values,
3. fall back to safe defaults,
4. do not automatically launch an expensive network generation solely because an untrusted URL requests it unless the base ranking is loaded first.

---

# 29. Client Request Layer

Create a typed API client.

Suggested modules:

```text
src/lib/api/client.ts
src/lib/api/schemas.ts
src/lib/api/errors.ts
```

All calls go to:

```text
VITE_API_BASE_URL
```

Never call:

```text
https://api.openalex.org
```

from browser code.

Add a test that searches the compiled frontend bundle for:

```text
api.openalex.org
```

The frontend bundle should not need the OpenAlex host at all.

---

# 30. Controlled Concurrency and Retry Behavior

Use conservative request orchestration.

Suggested client limits:

```text
normal grouped requests: concurrency 2–3
network requests: concurrency 2
```

Retry:

- transient 5xx: limited exponential backoff,
- 429: respect retry information when available and do not hammer the endpoint,
- 400/422: no retry,
- aborted request: no retry.

Use `AbortController` when the user changes category/year during an analysis.

Do not allow stale responses from a previous analysis to overwrite the current selection.

TanStack Query keys must contain all relevant analysis parameters.

---

# 31. Error States

Translate technical errors into useful UI messages.

Examples:

### Category has no journals

```text
This category does not contain any journal identifiers.
```

### No OpenAlex sources resolved

```text
None of the journals in this category could be matched to OpenAlex Sources.
```

### Partial source coverage

Warning, not fatal:

```text
3 journals could not be matched in OpenAlex. Results are based on the remaining 118 journals.
```

### OpenAlex rate/quota issue

```text
The research data service is temporarily rate-limited. Please try again later.
```

Do not expose:

- API key,
- raw Worker stack trace,
- raw Cloudflare internals,
- full upstream URLs containing secrets.

### VOSviewer failure

Keep ranking/trend results usable.

Show:

```text
The network visualization could not be initialized.
You can still download the generated VOSviewer JSON.
```

---

# 32. Performance Requirements

Targets:

- Initial app bundle should not include VOSviewer if the Network tab has not been opened.
- Category index should be small.
- Load individual category details on demand.
- Use OpenAlex group operations instead of downloading all works.
- Cache source resolution.
- Cache topic metadata.
- Cache Worker aggregation requests.
- Avoid rendering thousands of DOM rows at once.
- Keep table/page sizes reasonable.

Network generation is allowed to take longer than ranking, but it must show progress and remain cancelable.

---

# 33. Accessibility

Minimum requirements:

- semantic labels for all form controls,
- keyboard-accessible tabs,
- visible focus states,
- charts accompanied by underlying accessible tables,
- do not communicate growth solely by color,
- sufficient contrast,
- responsive layout,
- screen-reader text for loading progress,
- buttons must have descriptive labels.

VOSviewer itself is a third-party visualization; surrounding controls and summaries must remain accessible.

---

# 34. Responsive Design

Desktop is the primary research workflow.

Support tablet and mobile.

Recommended behavior:

### Desktop

- full summary dashboard,
- charts + tables,
- VOSviewer around 70vh.

### Mobile

- stacked controls,
- horizontally scrollable tables only when necessary,
- smaller charts,
- network remains available but includes a note recommending a larger screen.

Do not remove essential analysis functionality on mobile.

---

# 35. Methodology Page/Tab

This is an important product feature.

Explain:

## Data sources

- category journal membership: site-provided category dataset,
- publications: OpenAlex,
- topics: OpenAlex Topics,
- network visualization: VOSviewer Online.

## Counting rule

For ranking:

```text
One work → one primary topic
```

Therefore a document is counted once in the topic ranking.

## Network rule

For network relationships:

```text
All OpenAlex topics attached to a work are used to calculate topic co-occurrence.
```

## Journal assignment

Use:

```text
primary_location.source
```

rather than arbitrary alternate locations.

## Publication year

Use OpenAlex `publication_year`.

## Document types

State whether:

```text
article + review
```

or:

```text
all work types
```

was selected.

## XPAC

State that XPAC is excluded for consistent default OpenAlex behavior.

## Coverage

Explain that not every category journal/ISSN may resolve to an OpenAlex Source.

## Important disclaimer

Repeat that the result is not an official Clarivate/JCR topic analysis.

---

# 36. Reproducibility Metadata

Every completed analysis should produce a metadata object.

Example:

```ts
interface AnalysisMetadata {
  generatedAt: string;
  categoryId: string;
  categoryName: string;
  taxonomy: string;
  categoryEdition?: string;
  publicationYear: number;
  documentTypes: string[];
  totalInputJournals: number;
  resolvedJournals: number;
  resolvedSourceIds: string[];
  analyzedDocuments: number;
  classifiedDocuments: number;
  topicCountingMethod: "openalex-primary-topic";
  networkMethod: "openalex-topic-cooccurrence";
  includeXpac: false;
}
```

Include relevant metadata in exported files.

Do not include the OpenAlex API key.

---

# 37. Data Normalization Utilities

Implement and test pure utilities for:

```text
normalizeIssn()
deduplicateIssns()
chunkArray()
normalizeOpenAlexId()
mergeGroupedCounts()
calculateShare()
calculateYoYGrowth()
buildCoverageReport()
buildTopicRanking()
buildTopicNetwork()
buildVosviewerJson()
slugifyExportFilename()
```

Keep these functions independent from React where possible.

---

# 38. Worker Route Definitions

Recommended public routes:

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

Do not add a general `/openalex/*` passthrough route.

Version the API from the beginning with `/v1/`.

---

# 39. Worker Response Envelope

Use consistent success/error structures.

Success:

```json
{
  "ok": true,
  "data": {
  }
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "OPENALEX_RATE_LIMITED",
    "message": "The research data service is temporarily rate-limited."
  }
}
```

Possible application error codes:

```text
INVALID_REQUEST
ORIGIN_NOT_ALLOWED
CATEGORY_INPUT_TOO_LARGE
OPENALEX_BAD_REQUEST
OPENALEX_RATE_LIMITED
OPENALEX_UNAVAILABLE
INTERNAL_ERROR
```

Never return raw stack traces in production.

---

# 40. Logging

Worker production logs may contain:

- route name,
- response status,
- request duration,
- number of source IDs,
- publication year,
- cache hit/miss,
- upstream status.

Worker logs must not contain:

- OpenAlex API key,
- full upstream URL with query parameters containing the key,
- full request bodies when unnecessary,
- secrets.

If logging an upstream request, log a sanitized representation without `api_key`.

---

# 41. OpenAlex Budget Awareness

The application uses one site-owner API key.

Design as though the API budget is scarce even if the free allowance is adequate.

Principles:

1. use `group_by`,
2. use source-ID batching,
3. use the maximum safe OR batch size,
4. cache identical requests,
5. lazy-load network generation,
6. avoid full work pagination,
7. avoid OpenAlex search when IDs are already known,
8. reuse ranking results,
9. reuse topic metadata,
10. do not poll the API.

Optionally implement a private development-only diagnostic for OpenAlex rate-limit status.

Do not return the API key if using the OpenAlex rate-limit endpoint, because that upstream response may include key-related information.

---

# 42. Current OpenAlex Constraints to Account For

At implementation time, verify these values against official OpenAlex documentation rather than scattering magic numbers through the code.

The design currently assumes:

- API access uses an API key.
- Works can be filtered by `publication_year`.
- Works can be filtered by `primary_location.source.id`.
- Works can be filtered by `primary_topic.id`.
- Works can be filtered by `topics.id`.
- Works can be grouped by `primary_topic.id`.
- Works can be grouped by `topics.id`.
- Works can be grouped by `publication_year`.
- OR values can be batched in a filter.
- Grouped results can require pagination.
- OpenAlex Source records can be resolved through ISSN.
- OpenAlex Topics contain domain, field, and subfield metadata.

Centralize API limits/config in:

```text
worker/src/openalex/constants.ts
```

Do not hardcode the same limit in multiple files.

---

# 43. Current VOSviewer Assumptions to Verify

Before coding the network component, verify against the current official VOSviewer Online repository/documentation:

- package name is `vosviewer-online`,
- React component export is `VOSviewerOnline`,
- the `data` prop accepts native VOSviewer JSON,
- network JSON uses:
  - `network.items`,
  - `network.links`,
  - optional `network.clusters`,
- item fields include:
  - `id`,
  - `label`,
  - `x`,
  - `y`,
  - `cluster`,
  - `weights`,
  - `scores`,
- link fields include:
  - `source_id`,
  - `target_id`,
  - `strength`.

If the package API has changed, adapt to the official current API but retain native VOSviewer integration.

---

# 44. Testing Strategy

Use:

- unit tests,
- Worker route tests,
- frontend integration tests,
- Playwright end-to-end tests.

## 44.1 Unit tests

Test:

### ISSN handling

```text
"12345678" → "1234-5678"
"1234-567X" preserved
duplicates removed
invalid ISSNs rejected/flagged
```

### Chunking

```text
201 source IDs
→ 100 + 100 + 1
```

### Merging topic counts

Input:

```text
chunk A:
T1 = 20
T2 = 10

chunk B:
T1 = 15
T3 = 5
```

Expected:

```text
T1 = 35
T2 = 10
T3 = 5
```

### Shares

Correct denominator.

### Growth

Handle:

- positive growth,
- negative growth,
- zero previous year,
- missing year.

### Network

- no self edges,
- no duplicate reverse edges,
- weak-edge pruning,
- max-edge limit,
- valid VOSviewer IDs,
- finite x/y coordinates.

## 44.2 Worker tests

Mock OpenAlex.

Test:

- valid request adds API key upstream,
- API key never appears downstream,
- invalid source ID rejected,
- >100 source IDs rejected by atomic grouping routes,
- arbitrary filter cannot be injected,
- arbitrary URL cannot be supplied,
- unknown route returns 404,
- wrong origin rejected,
- allowed origin gets correct CORS headers,
- OPTIONS works,
- upstream 429 becomes application 429/error code,
- upstream 5xx becomes sanitized application error,
- cache key is deterministic,
- key is absent from logged/snapshotted values.

## 44.3 Frontend integration tests

Mock Worker responses.

Test full workflow:

```text
load category
→ resolve sources
→ show coverage
→ get topic ranking
→ render bar chart/table
→ load trend
→ load network
→ export
```

## 44.4 End-to-end tests

Playwright:

1. app loads under a non-root base path,
2. category/year can be selected,
3. mocked analysis completes,
4. URL state updates,
5. results tabs work,
6. CSV download works,
7. VOSviewer container renders,
8. network JSON download works,
9. responsive layout does not break.

Do not make normal CI depend on a live OpenAlex API key.

Optional live smoke tests may be manually triggered when a secret is available.

---

# 45. Secret-Leak Tests

Add explicit security checks.

After building the frontend:

```text
dist/
```

search for:

```text
OPENALEX_API_KEY
```

and for the actual secret if the CI environment is ever configured with it.

The frontend build must not have access to the secret at all, so this should be structurally impossible.

Also search frontend source for direct use of:

```text
api.openalex.org
```

A documentation string may exist in README, but runtime browser code must never call it.

Browser DevTools during an analysis should show:

```text
GitHub Pages → Cloudflare Worker
```

and never:

```text
GitHub Pages → OpenAlex API directly
```

---

# 46. GitHub Pages Deployment

Use GitHub Actions as the Pages publishing source.

Workflow responsibilities:

1. checkout,
2. install dependencies using lockfile,
3. typecheck,
4. run frontend tests,
5. build Vite frontend with correct Pages base,
6. upload Pages artifact,
7. deploy Pages artifact.

Use GitHub's official Pages Actions.

The workflow must not need `OPENALEX_API_KEY`.

Only public configuration such as `VITE_API_BASE_URL` belongs in the frontend build.

Store the Worker URL as a GitHub repository variable or another non-secret configuration mechanism.

---

# 47. Cloudflare Worker Deployment

Create an independent Worker deployment workflow or document a manual deployment command.

Worker deployment credentials may be GitHub Secrets, for example Cloudflare deployment credentials.

That is different from exposing the OpenAlex key to the frontend.

Prefer keeping `OPENALEX_API_KEY` configured directly as a Cloudflare Worker secret.

Worker deployment flow:

```text
npm install
npm test
npm run typecheck
wrangler deploy
```

`wrangler.jsonc` should declare required secret names if supported by the current Wrangler version.

Do not put secret values in `wrangler.jsonc`.

---

# 48. Local Development

Provide a simple developer workflow.

Example:

Terminal A:

```bash
npm run dev:worker
```

Terminal B:

```bash
npm run dev
```

Frontend dev URL:

```text
http://localhost:5173
```

Local Worker:

```text
http://localhost:<worker-port>
```

Local Worker secret file:

```text
worker/.dev.vars
```

Example:

```text
OPENALEX_API_KEY=...
```

This file must be ignored by Git.

Provide:

```text
worker/.dev.vars.example
```

containing only:

```text
OPENALEX_API_KEY=
```

---

# 49. Category Data Validation Script

Implement:

```bash
npm run validate:categories
```

It should validate:

- index schema,
- category files exist,
- IDs unique,
- file IDs match index IDs,
- category name present,
- journal names present,
- at least one ISSN per journal,
- ISSNs parse/normalize,
- duplicate ISSNs reported,
- duplicate journals optionally warned,
- edition is string if present.

The script should fail CI on malformed production category data.

Do not validate whether a journal truly belongs to JCR; that is provenance responsibility of the supplied dataset.

---

# 50. README Requirements

Write a thorough README containing:

## What the project does

Example use case:

```text
JCR Optics + publication year 2024
→ OpenAlex primary-topic ranking
→ topic trends
→ VOSviewer topic network
```

## Architecture

Explain GitHub Pages + Cloudflare Worker + OpenAlex.

## Why the Worker exists

Explicitly explain that a secret API key cannot be safely embedded in a static GitHub Pages frontend.

## Setup

- install dependencies,
- add category data,
- create OpenAlex key,
- configure Worker secret,
- deploy Worker,
- configure frontend Worker URL,
- deploy GitHub Pages.

## Category-data note

Explain that JCR category membership is external input and is not scraped by the project.

## Methodology

Explain primary-topic ranking and topic co-occurrence.

## Security

Explain secret handling.

## Development

Commands.

## Deployment

Commands and GitHub Actions.

## Tests

Commands.

## Attribution

Credit OpenAlex and VOSviewer Online appropriately.

---

# 51. Visual Design Direction

Aim for a modern scientific dashboard.

Characteristics:

- light, neutral background,
- strong typography,
- compact controls,
- generous whitespace,
- restrained color,
- data visualization as the visual focus,
- no oversized marketing hero,
- no gradients unless extremely subtle,
- no glassmorphism,
- no unnecessary animation.

Example hierarchy:

```text
Research Topic Explorer

Analyze a journal category

[Category] [Year] [Document types] [Analyze]

────────────────────────────────────────────

Optics · 2024

24,381 documents   118/121 journals   342 topics

[Overview] [Trends] [Network] [Journals] [Methodology]

Top topics
████████ Optical Metasurfaces
██████   Fiber Optic Sensors
█████    Integrated Photonics
...
```

Use a responsive max-width layout, while allowing the Network tab to use more horizontal space.

---

# 52. Suggested React Component Structure

Possible structure:

```text
<App>
  <AppHeader />

  <AnalysisForm>
    <CategorySelect />
    <YearSelect />
    <DocumentTypeSelect />
    <AnalyzeButton />
  </AnalysisForm>

  <AnalysisProgress />

  <CoverageBanner />

  <AnalysisSummary />

  <ResultsTabs>
    <OverviewTab>
      <TopTopicsChart />
      <TopicsTable />
      <TopicDetailsDrawer />
    </OverviewTab>

    <TrendsTab>
      <TrendControls />
      <TopicsTrendChart />
      <FastestGrowingTable />
    </TrendsTab>

    <NetworkTab>
      <NetworkControls />
      <NetworkProgress />
      <VosviewerNetwork />
    </NetworkTab>

    <JournalsTab>
      <JournalsTable />
    </JournalsTab>

    <MethodologyTab />
  </ResultsTabs>
</App>
```

Do not put all analysis logic into `App.tsx`.

---

# 53. Feature Modules

Recommended feature boundaries:

## categories

- fetch category index,
- fetch selected category,
- validate schema.

## source-resolution

- flatten ISSNs,
- call Worker,
- map sources back to journals,
- build coverage report.

## topic-ranking

- source chunking,
- grouped paging,
- merge counts,
- ranking.

## trends

- selected topics,
- topic-year queries,
- category-year totals,
- growth.

## network

- co-occurrence orchestration,
- edge construction,
- pruning,
- layout,
- VOSviewer JSON.

## export

- CSV serialization,
- VOSviewer JSON download,
- reproducibility metadata.

---

# 54. Analysis State Model

Use an immutable analysis key derived from:

```text
category ID
publication year
document types
resolved source IDs
```

If category/year/document type changes, invalidate dependent results.

Do not reuse a network generated for a different filter combination.

Example:

```ts
type AnalysisKey = {
  categoryId: string;
  publicationYear: number;
  documentTypes: "article-review" | "all";
};
```

Resolved source IDs become data associated with that key.

---

# 55. Network Progress Model

Because network generation has many atomic grouped requests, expose progress.

Example state:

```ts
interface NetworkBuildProgress {
  completedSeeds: number;
  totalSeeds: number;
  status:
    | "idle"
    | "loading"
    | "layout"
    | "ready"
    | "error";
}
```

Display:

```text
Querying topic relationships 17 / 29
```

then:

```text
Calculating network layout…
```

The user must be able to cancel network generation by changing filters or pressing a cancel button.

---

# 56. Result Caching in the Browser

TanStack Query memory caching is mandatory.

Persisting large results to localStorage is not necessary for MVP.

If persistent caching is added, prefer IndexedDB and version the cache schema.

Do not store sensitive data because there should be none in browser results.

Worker caching remains the primary shared cache.

---

# 57. Downloads and Filenames

Generate safe deterministic filenames.

Examples:

```text
optics-2024-topic-ranking.csv
optics-2020-2024-topic-trends.csv
optics-2024-journals.csv
optics-2024-vosviewer-network.json
```

Use lowercase safe slugs.

Browser exports should work entirely offline once analysis data is loaded.

---

# 58. Empty Results

A valid category/year can have zero matching documents.

Show:

```text
No OpenAlex articles or reviews were found for the resolved journals in 2024.
```

Do not render fake zeros across a full dashboard.

Provide suggestions:

- try "All work types",
- choose another publication year,
- inspect journal coverage.

---

# 59. Data Quality Messaging

Use concise, non-alarmist quality indicators.

Coverage card:

```text
Journal matching
118 of 121 category journals matched to OpenAlex
```

Classification card:

```text
Topic classification
99.8% of analyzed documents had a primary topic
```

The UI should make it easy to distinguish:

- category journal coverage,
- OpenAlex topic classification coverage.

---

# 60. MVP Scope

The MVP is complete when the following workflow works:

```text
load public GitHub Pages site
→ choose category
→ choose year
→ choose article+review or all types
→ resolve ISSNs to OpenAlex Sources
→ show coverage
→ calculate exact primary-topic ranking across all resolved sources
→ show top-topic chart and table
→ show five-year trends for top topics
→ show journal breakdown
→ generate a top-30 topic co-occurrence network
→ render it using VOSviewer Online React component
→ download ranking CSV
→ download trends CSV
→ download journal CSV
→ download VOSviewer JSON
```

Do not add authentication, accounts, a database, or user profiles.

---

# 61. Out of Scope for MVP

Do not implement yet:

- full bibliographic export of every work,
- citation-normalized metrics,
- author rankings,
- institution rankings,
- country rankings,
- AI-generated topic summaries,
- semantic OpenAlex search,
- custom user accounts,
- server database,
- JCR scraping,
- automated Clarivate login,
- Scopus category support,
- user-uploaded private category files,
- scheduled background analyses,
- PDF downloading.

Keep architecture extensible but do not delay the MVP for these features.

---

# 62. Possible Phase 2 Features

Document but do not implement unless the MVP is complete:

- compare two categories,
- compare two years side by side,
- emerging-topic detection,
- topic detail page with top journals,
- institution/author breakdown,
- custom journal-set import,
- OpenAlex native field/subfield mode,
- shareable static snapshots,
- image export of charts,
- more sophisticated network threshold controls,
- citation metrics,
- normalized growth metrics.

---

# 63. Acceptance Criteria

The project is accepted when all of the following are true.

## Deployment

- Frontend deploys successfully to GitHub Pages.
- Frontend works from a repository subpath.
- Worker deploys to Cloudflare.
- Public app requires no login.

## Security

- OpenAlex API key exists only as a Cloudflare secret.
- The key is absent from the GitHub repository.
- The key is absent from the GitHub Pages build.
- Browser requests never contain the OpenAlex API key.
- Browser code never directly calls OpenAlex.
- Worker is not a generic OpenAlex proxy.
- Worker validates IDs and limits request size.
- Worker returns sanitized errors.

## Data workflow

- Category data loads.
- ISSNs resolve to OpenAlex Sources.
- Unresolved journals are visible.
- Source IDs are deduplicated.
- Categories containing more than 100 source IDs work via chunking.
- Grouped responses are fully paginated.
- Counts from chunks are merged correctly.

## Ranking

- Primary topic ranking works.
- One work is conceptually counted once through `primary_topic`.
- Counts sort descending.
- Shares are correct.
- Top-topic table and chart agree.

## Trends

- Five-year default trend works.
- Topic counts merge across source chunks.
- Category totals merge across source chunks.
- Share-of-category mode works.
- Zero-base growth is handled safely.

## Network

- Top 20/30/40 node selection works.
- Co-occurrence queries are lazy.
- Duplicate reverse edges are absent.
- Weak links are pruned.
- VOSviewer JSON is valid.
- Official VOSviewer Online React component renders the data.
- Network JSON can be downloaded.

## User experience

- Loading progress is meaningful.
- Partial coverage is clearly disclosed.
- Errors are understandable.
- Mobile layout is usable.
- Methodology is visible.
- Analysis state is reflected in the URL.

## Tests

- unit tests pass,
- Worker tests pass,
- frontend integration tests pass,
- Playwright tests pass,
- category validation passes,
- frontend production build passes.

---

# 64. Implementation Order

Codex should implement in this order.

## Milestone 1 — Repository and deployment skeleton

- React + TypeScript + Vite.
- Worker project.
- GitHub Pages workflow.
- Worker deployment configuration.
- basic `/health`.
- frontend can call Worker health endpoint.

## Milestone 2 — Category catalog

- category schemas,
- loader,
- category validation script,
- development fixture,
- category selector.

Do not fabricate a full JCR dataset.

## Milestone 3 — Source resolution

- Worker source-resolution route,
- frontend source chunking/normalization,
- coverage report,
- tests.

## Milestone 4 — Topic ranking

- grouped primary-topic Worker route,
- cursor paging,
- source chunk aggregation,
- ranking chart/table,
- topic metadata,
- exports.

## Milestone 5 — Trends

- topic-year Worker route,
- category-year Worker route,
- trend chart,
- growth calculations,
- trend export.

## Milestone 6 — Journals

- grouped journal route,
- journal table,
- export.

## Milestone 7 — Network

- topic co-occurrence route,
- lazy network orchestration,
- edge pruning,
- deterministic coordinates,
- VOSviewer JSON builder,
- official VOSviewer component,
- JSON export.

## Milestone 8 — Hardening

- caching,
- rate limiting,
- cancellation,
- accessibility,
- responsive polish,
- error handling,
- secret leak tests,
- final README.

---

# 65. Development Fixture

Because the production JCR category membership is owner-supplied, create a clearly labeled non-production fixture for automated tests.

For example:

```text
tests/fixtures/category.sample.json
```

It may contain a very small set of journals/ISSNs selected only to test the workflow.

The fixture must not be presented as a complete or authoritative JCR category.

The production UI should only list category files contained in the production category index.

---

# 66. Documentation References Codex Should Verify

Before finalizing implementation, verify current behavior against the official sources below.

Do not rely solely on old blog posts or third-party examples.

### OpenAlex

Verify:

- Authentication & Pricing
- Filtering
- Grouping
- Works API reference
- Sources API reference
- Topics API reference
- Work Types reference
- Key Concepts

### VOSviewer Online

Verify:

- official GitHub repository `neesjanvaneck/VOSviewer-Online`
- React component integration
- VOSviewer JSON file format
- VOSviewer Online control panel / layout behavior

### Cloudflare Workers

Verify:

- Worker Secrets
- Worker runtime limits
- rate limiting
- CORS proxy examples
- Wrangler configuration

### GitHub

Verify:

- GitHub Pages deployment with GitHub Actions
- Pages artifact upload/deploy Actions
- project-site base-path behavior

If any documented platform limit has changed, update central configuration and README accordingly.

---

# 67. Final Product Definition

The finished application should feel like a lightweight open bibliometric explorer:

```text
Research Topic Explorer

Category
[JCR · Optics]

Publication year
[2024]

Document types
[Articles + reviews]

[Analyze]

──────────────────────────────────────────────

Optics · 2024

24,381 documents
118 / 121 journals matched
342 OpenAlex primary topics

[Overview] [Trends] [Network] [Journals] [Methodology]

TOP TOPICS

1. Optical Metasurfaces           1,421   5.83%
2. Fiber Optic Sensors            1,103   4.52%
3. Integrated Photonics             987   4.05%
4. Quantum Optics                   821   3.37%
...

FASTEST GROWING

Topic                         2023    2024    Growth
...
```

The numeric values above are illustrative only and must never be hardcoded as real results.

The actual application must calculate all results from OpenAlex for the category data supplied by the repository owner.

---

# 68. Non-Negotiable Summary

If there is any ambiguity during implementation, preserve these rules:

1. **React + TypeScript frontend on GitHub Pages.**
2. **Cloudflare Worker is the only path to OpenAlex.**
3. **The owner's OpenAlex API key remains a Cloudflare secret.**
4. **No generic OpenAlex proxy.**
5. **JCR/category data only defines the journal set.**
6. **OpenAlex provides publication and topic data.**
7. **Topic ranking uses `primary_topic.id`.**
8. **Topic network uses co-occurrence from `topics.id`.**
9. **VOSviewer Online must be integrated using its official React component.**
10. **Use grouped queries, batching, caching, and lazy network loading to conserve API usage.**
11. **Do not scrape JCR.**
12. **Show coverage and methodology transparently.**
13. **The app must be publicly usable without login or user API keys.**
14. **All major outputs must be exportable.**
15. **Security tests must prove the OpenAlex key never reaches the browser.**

Build the MVP end-to-end before adding non-essential features.
