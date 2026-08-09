import type { AnalysisResult, DocumentTypeMode } from "../../types/domain";

export function MethodologyTab({ analysis, fallbackMode }: { analysis?: AnalysisResult; fallbackMode: DocumentTypeMode }) {
  const types = analysis?.documentTypeMode ?? fallbackMode;
  return (
    <div id="panel-methodology" role="tabpanel" aria-labelledby="tab-methodology" className="tab-panel methodology-panel">
      <section className="methodology-lead">
        <h3>How this analysis is constructed</h3>
        <p className="methodology-disclaimer"><strong>Important distinction.</strong> Journal-category membership is supplied by the site’s category dataset. Publication records and topic classifications come from OpenAlex. The resulting rankings are OpenAlex-based analyses of the selected journal set and are not Clarivate Citation Topics or official JCR analytics.</p>
      </section>
      <div className="methodology-grid">
        <section><h4>Journal set</h4><p>The selected category defines journals and ISSNs only. The application normalizes ISSNs, resolves them to OpenAlex Sources, deduplicates sources, and reports every unresolved journal.</p></section>
        <section><h4>Topic ranking</h4><p>Works are grouped by <code>primary_topic.id</code>. A work has one primary topic, so each classified document contributes once to the ranking. Shares use all analyzed documents as the denominator.</p></section>
        <section><h4>Topic relationships</h4><p>Network nodes come from the primary-topic ranking. Edges use every OpenAlex topic attached to a matching work and therefore represent topic co-occurrence, not primary-topic overlap.</p></section>
        <section><h4>Journal assignment</h4><p>Works are assigned through <code>primary_location.source.id</code>. Alternate locations do not expand the journal set. OpenAlex XPAC records are explicitly excluded.</p></section>
        <section><h4>Publication filter</h4><p>Publication year uses OpenAlex <code>publication_year</code>. Current document types: <strong>{types === "article-review" ? "articles + reviews" : "all OpenAlex work types"}</strong>.</p></section>
        <section><h4>Reproducibility</h4><p>Exports contain category ID, taxonomy, edition when available, year, document types, resolved Source IDs, coverage, counting method, and generation time.</p></section>
      </div>
      <section className="methodology-flow" aria-label="Data methodology flow"><span>Category dataset</span><b aria-hidden="true">→</b><span>ISSNs</span><b aria-hidden="true">→</b><span>OpenAlex Sources</span><b aria-hidden="true">→</b><span>Works</span><b aria-hidden="true">→</b><span>OpenAlex Topics</span></section>
    </div>
  );
}
