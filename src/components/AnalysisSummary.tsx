import { Column, Grid, Tag, Tile } from "@carbon/react";
import type { AnalysisResult } from "../types/domain";

const number = new Intl.NumberFormat();
const percent = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });

export function AnalysisSummary({ analysis }: { analysis: AnalysisResult }) {
  const metrics = [
    ["Analyzed documents", number.format(analysis.analyzedDocuments)],
    ["Journals in set", String(analysis.coverage.uniqueSources.length)],
    ["Primary topics", number.format(analysis.ranking.length)],
    ["Classification", percent.format(analysis.classificationCoverage)],
  ];
  return (
    <>
      <Grid className="rte-result-heading-grid">
        <Column sm={4} md={6} lg={12}>
          <Tag>{analysis.category.taxonomy}</Tag>
          <h2 id="result-heading">{analysis.category.name} · {analysis.year}</h2>
          {analysis.metadata.sourceSetTruncated ? <p className="rte-secondary-text">100-journal safety cap applied</p> : null}
        </Column>
        <Column sm={4} md={2} lg={4} className="rte-generated-time">
          <p>Generated</p>
          <time dateTime={analysis.metadata.generatedAt}>{new Date(analysis.metadata.generatedAt).toLocaleString()}</time>
        </Column>
      </Grid>
      <Grid narrow className="rte-metric-grid">
        {metrics.map(([label, value]) => (
          <Column key={label} sm={4} md={4} lg={4}>
            <Tile className="rte-metric-tile"><p>{label}</p><strong>{value}</strong></Tile>
          </Column>
        ))}
      </Grid>
    </>
  );
}
