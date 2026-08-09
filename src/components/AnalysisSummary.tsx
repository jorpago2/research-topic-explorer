import type { AnalysisResult } from "../types/domain";

const number = new Intl.NumberFormat();
const percent = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });

export function AnalysisSummary({ analysis }: { analysis: AnalysisResult }) {
  return (
    <section className="result-summary" aria-labelledby="result-heading">
      <div className="result-title">
        <div>
          <h2 id="result-heading">{analysis.category.name} · {analysis.year}</h2>
          <p>{analysis.category.taxonomy}{analysis.metadata.sourceSetTruncated ? " · 100-journal safety cap applied" : ""}</p>
        </div>
        <p className="generated-time">Generated <time dateTime={analysis.metadata.generatedAt}>{new Date(analysis.metadata.generatedAt).toLocaleString()}</time></p>
      </div>
      <dl className="summary-metrics">
        <div><dt>Analyzed documents</dt><dd>{number.format(analysis.analyzedDocuments)}</dd></div>
        <div><dt>Journals in set</dt><dd>{analysis.coverage.uniqueSources.length}</dd></div>
        <div><dt>Primary topics</dt><dd>{number.format(analysis.ranking.length)}</dd></div>
        <div><dt>Classification</dt><dd>{percent.format(analysis.classificationCoverage)}</dd></div>
      </dl>
    </section>
  );
}
