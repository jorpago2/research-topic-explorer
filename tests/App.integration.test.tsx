import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

vi.mock("vosviewer-online", () => ({ VOSviewerOnline: ({ data }: { data: unknown }) => <div data-testid="vosviewer">{JSON.stringify(data)}</div> }));

function envelope(data: unknown) { return Response.json({ ok: true, data }); }

const localJifDataset = {
  schemaVersion: 1,
  provider: "Clarivate",
  metric: "Journal Impact Factor",
  edition: "2026",
  sourceNote: "Local test fixture",
  journals: [{ journalName: "Optics Express", eissn: "1094-4087", index: "SCIE", citations: 100, jif: 4.8, previousJif: 4.6, quartile: "Q1", edition: "2026", provider: "Clarivate" }],
};

beforeEach(() => {
  window.history.replaceState(null, "", "/?category=3107&year=2024&types=article,review&tab=overview&nodes=20");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/health")) return envelope({ status: "ok", version: "v1" });
    if (url.endsWith("/v1/openalex-subfields")) return envelope({ subfields: [{ id: "3107", displayName: "Optics", field: { id: "31", displayName: "Physics and Astronomy" }, domain: { id: "3", displayName: "Physical Sciences" } }] });
    if (url.endsWith("/v1/openalex-subfield-sources")) return envelope({ sources: [{ id: "S1", displayName: "Optics Express", issnL: "1094-4087", issns: ["1094-4087"], type: "journal", worksCount: 1000 }], nextCursor: null });
    if (url.endsWith("/v1/group-primary-topics")) return envelope({ meta: { documentCount: 100, nextCursor: null }, groups: [{ id: "T1", displayName: "Metasurfaces", count: 60 }, { id: "T2", displayName: "Integrated photonics", count: 40 }] });
    if (url.endsWith("/v1/topic-details")) return envelope({ topics: ["T1", "T2"].map((id, index) => ({ id, displayName: index ? "Integrated photonics" : "Metasurfaces", description: "Fixture topic", keywords: ["optics"], subfield: { id: "sub1", displayName: "Optics" }, field: { id: "field1", displayName: "Physics" }, domain: { id: "domain1", displayName: "Physical Sciences" } })) });
    if (url.endsWith("/v1/group-category-years")) return envelope({ meta: { documentCount: 300, nextCursor: null }, groups: [2020, 2021, 2022, 2023, 2024].map((year) => ({ id: String(year), displayName: String(year), count: 100 })) });
    if (url.endsWith("/v1/group-topic-years")) {
      const body = JSON.parse(String(init?.body)) as { topicId: string };
      return envelope({ meta: { documentCount: 100, nextCursor: null }, groups: [2020, 2021, 2022, 2023, 2024].map((year, index) => ({ id: String(year), displayName: String(year), count: (body.topicId === "T1" ? 20 : 10) + index * 5 })) });
    }
    if (url.endsWith("/v1/group-sources")) return envelope({ meta: { documentCount: 100, nextCursor: null }, groups: [{ id: "S1", displayName: "Optics Express", count: 100 }] });
    if (url.endsWith("/v1/group-topic-cooccurrence")) return envelope({ meta: { documentCount: 60, nextCursor: null }, groups: [{ id: "T2", displayName: "Integrated photonics", count: 20 }] });
    throw new Error(`Unexpected fetch: ${url}`);
  }));
  Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:test"), configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
});

function renderApp() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><App /></QueryClientProvider>);
}

describe("application workflow", () => {
  it("loads a category, analyzes ranking, and exposes all result views", async () => {
    renderApp();
    await screen.findByRole("option", { name: /Optics/ });
    const analyzeButton = await screen.findByRole("button", { name: "Analyze" });
    await waitFor(() => expect(analyzeButton).toBeEnabled());
    const jifFile = new File([JSON.stringify(localJifDataset)], "jif-2026-local.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Choose JIF JSON"), { target: { files: [jifFile] } });
    expect(await screen.findByText(/1 journal records/)).toBeInTheDocument();
    fireEvent.click(analyzeButton);
    expect(await screen.findByRole("heading", { name: "Optics · 2024" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Metasurfaces/ })).toBeInTheDocument();
    expect(window.location.search).toContain("category=3107");

    fireEvent.click(screen.getByRole("tab", { name: "Trends" }));
    expect(await screen.findByRole("heading", { name: "Topic trends" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Loading grouped/)).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("tab", { name: "Journals" }));
    expect(await screen.findByText("Optics Express", { selector: 'td[data-label="Journal"]' })).toBeInTheDocument();
    expect(screen.getByText("4.8", { selector: 'td[data-label="JIF"]' })).toBeInTheDocument();
    expect(screen.getByText(/1\/1 current Sources matched/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Network" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate network" }));
    expect(await screen.findByTestId("vosviewer")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Methodology" }));
    expect(screen.getByText(/not official JCR analytics/)).toBeInTheDocument();
  });
});
