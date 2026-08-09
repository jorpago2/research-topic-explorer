import { Column, Grid, InlineNotification, Tile } from "@carbon/react";
import type { AnalysisResult, DocumentTypeMode } from "../../types/domain";

export function MethodologyTab({ analysis, fallbackMode }: { analysis?: AnalysisResult; fallbackMode: DocumentTypeMode }) {
  const types = analysis?.documentTypeMode ?? fallbackMode;
  const sections = [
    ["Journal set", "OpenAlex articles and reviews are filtered by primary_topic.subfield.id and grouped by journal Source. The 100 Sources with the most matching works form the bounded journal set."],
    ["Topic ranking", "Works are grouped by primary_topic.id. Each classified document contributes once to the ranking; shares use all analyzed documents as the denominator."],
    ["Topic relationships", "Network nodes come from the primary-topic ranking. Edges represent topic co-occurrence within matching works, not citations or semantic similarity."],
    ["Journal assignment", "Works are assigned through primary_location.source.id. Alternate locations do not expand the journal set, and OpenAlex XPAC records are excluded."],
    ["Publication filter", `Publication year uses OpenAlex publication_year. Current document types: ${types === "article-review" ? "articles + reviews" : "all OpenAlex work types"}.`],
    ["JIF enrichment", "JIF comes from a user-selected local JSON file and is matched by eISSN after classification. The file remains in browser memory and is never uploaded."],
    ["Reproducibility", "Exports record the OpenAlex Subfield, year, document types, Source IDs, journal-set rule, safety cap, counting method, optional JIF edition, and generation time."],
  ];
  return (
    <div id="panel-methodology" className="rte-tab-panel">
      <Grid className="rte-panel-grid">
        <Column sm={4} md={8} lg={12}>
          <h3>How this analysis is constructed</h3>
          <InlineNotification kind="warning" lowContrast hideCloseButton title="Important distinction" subtitle="Journal-set membership and topic classifications come from OpenAlex. Journal Impact Factor is separate Clarivate metadata and these results are not official JCR analytics." />
        </Column>
      </Grid>
      <Grid narrow className="rte-method-grid">
        {sections.map(([title, body]) => <Column key={title} sm={4} md={4} lg={4}><Tile className="rte-method-tile"><h4>{title}</h4><p>{body}</p></Tile></Column>)}
      </Grid>
      <Grid className="rte-panel-grid">
        <Column sm={4} md={8} lg={16}>
          <Tile className="rte-method-flow"><p>OpenAlex Subfield</p><span aria-hidden="true">→</span><p>Primary-topic works</p><span aria-hidden="true">→</span><p>Top journal Sources</p><span aria-hidden="true">→</span><p>Selected-year works</p><span aria-hidden="true">→</span><p>OpenAlex Topics</p></Tile>
        </Column>
      </Grid>
    </div>
  );
}
