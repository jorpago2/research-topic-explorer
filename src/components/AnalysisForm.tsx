import type { FormEvent } from "react";
import type { OpenAlexSubfield } from "../types/domain";
import type { DocumentTypeMode } from "../types/domain";

interface AnalysisFormProps {
  subfields: OpenAlexSubfield[];
  categoryId: string;
  year: number;
  documentTypeMode: DocumentTypeMode;
  loading: boolean;
  categoryReady: boolean;
  onCategoryChange: (value: string) => void;
  onYearChange: (value: number) => void;
  onDocumentTypeChange: (value: DocumentTypeMode) => void;
  onAnalyze: () => void;
}

export function AnalysisForm(props: AnalysisFormProps) {
  const years = Array.from({ length: 16 }, (_, index) => new Date().getFullYear() - index);
  function submit(event: FormEvent) {
    event.preventDefault();
    props.onAnalyze();
  }
  return (
    <section className="analysis-shell" aria-labelledby="analysis-heading">
      <div className="analysis-intro">
        <h1 id="analysis-heading">Explore an OpenAlex research subfield</h1>
        <p>Discover its journal set, rank primary topics, trace five-year change, and map topic co-occurrence.</p>
      </div>
      <form className="analysis-form" onSubmit={submit}>
        <label className="field field-category">
          <span className="field-label">OpenAlex subfield</span>
          <select value={props.categoryId} onChange={(event) => props.onCategoryChange(event.target.value)} disabled={props.loading || !props.subfields.length}>
            <option value="">Select a subfield</option>
            {props.subfields.map((subfield) => (
              <option key={subfield.id} value={subfield.id}>
                {subfield.displayName}{subfield.field ? ` · ${subfield.field.displayName}` : ""}
              </option>
            ))}
          </select>
          <span className="field-helper">OpenAlex taxonomy · 254 subfields</span>
        </label>
        <label className="field">
          <span className="field-label">Publication year</span>
          <select value={props.year} onChange={(event) => props.onYearChange(Number(event.target.value))} disabled={props.loading}>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <span className="field-helper">Used for publications, not taxonomy</span>
        </label>
        <label className="field">
          <span className="field-label">Document types</span>
          <select value={props.documentTypeMode} onChange={(event) => props.onDocumentTypeChange(event.target.value as DocumentTypeMode)} disabled={props.loading}>
            <option value="article-review">Articles + reviews</option>
            <option value="all">All OpenAlex work types</option>
          </select>
          <span className="field-helper">Applied to every result</span>
        </label>
        <button className="primary-button analyze-button" type="submit" disabled={props.loading || !props.categoryId || !props.categoryReady} aria-busy={props.loading}>
          {props.loading ? "Analyzing…" : props.categoryId && !props.categoryReady ? "Loading subfield…" : "Analyze"}
        </button>
      </form>
    </section>
  );
}
