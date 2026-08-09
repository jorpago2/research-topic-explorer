import type { AnalysisResult, DocumentTypeMode } from "../../types/domain";

export function MethodologyTab({ analysis, fallbackMode }: { analysis?: AnalysisResult; fallbackMode: DocumentTypeMode }) {
  const types = analysis?.documentTypeMode ?? fallbackMode;
  return (
    <div id="panel-methodology" role="tabpanel" aria-labelledby="tab-methodology" className="tab-panel methodology-panel">
      <section className="methodology-lead">
        <h3>How this analysis is constructed</h3>
        <p className="methodology-disclaimer"><strong>Important distinction.</strong> Journal-set membership and topic classifications come from OpenAlex. Journal Impact Factor, when present, is separate Clarivate metadata. It does not determine membership, topic counts, trends, or network links; these results are not official JCR analytics.</p>
      </section>
      <div className="methodology-grid">
        <section><h4>Journal set</h4><p>OpenAlex articles and reviews are filtered by <code>primary_topic.subfield.id</code> and grouped by journal Source. The 100 Sources with the most matching works form the bounded journal set. Sources must be journals with an ISSN.</p></section>
        <section><h4>Topic ranking</h4><p>Works are grouped by <code>primary_topic.id</code>. A work has one primary topic, so each classified document contributes once to the ranking. Shares use all analyzed documents as the denominator.</p></section>
        <section><h4>Topic relationships</h4><p>Network nodes come from the primary-topic ranking. Edges use every OpenAlex topic attached to a matching work and therefore represent topic co-occurrence, not primary-topic overlap.</p></section>
        <section><h4>Journal assignment</h4><p>Works are assigned through <code>primary_location.source.id</code>. Alternate locations do not expand the journal set. OpenAlex XPAC records are explicitly excluded.</p></section>
        <section><h4>Publication filter</h4><p>Publication year uses OpenAlex <code>publication_year</code>. Current document types: <strong>{types === "article-review" ? "articles + reviews" : "all OpenAlex work types"}</strong>.</p></section>
        <section><h4>JIF enrichment</h4><p>JIF is loaded from a user-selected local JSON file and matched after classification using eISSN. The file stays in browser memory for the current tab and is never uploaded. Missing JIF values remain missing and never exclude a journal.</p></section>
        <section><h4>Reproducibility</h4><p>Exports contain OpenAlex Subfield ID, year, document types, Source IDs, journal-set rule, safety cap, counting method, JIF edition when present, and generation time.</p></section>
      </div>
      <section className="methodology-flow" aria-label="Data methodology flow"><span>OpenAlex Subfield</span><b aria-hidden="true">→</b><span>Primary-topic works</span><b aria-hidden="true">→</b><span>Top journal Sources</span><b aria-hidden="true">→</b><span>Selected-year works</span><b aria-hidden="true">→</b><span>OpenAlex Topics</span></section>
    </div>
  );
}
