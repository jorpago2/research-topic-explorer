import type { FormEvent } from "react";
import { Button, Column, Grid, Select, SelectItem } from "@carbon/react";
import type { DocumentTypeMode, OpenAlexSubfield } from "../types/domain";

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
    <section aria-labelledby="analysis-heading" className="rte-analysis">
      <Grid className="rte-hero-grid">
        <Column sm={4} md={8} lg={10}>
          <p className="rte-eyebrow">OPEN BIBLIOMETRIC ANALYSIS</p>
          <h1 id="analysis-heading">Explore an OpenAlex research subfield</h1>
          <p className="rte-lead">Discover its journal set, rank primary topics, trace five-year change, and map topic co-occurrence.</p>
        </Column>
      </Grid>
      <form onSubmit={submit}>
        <Grid className="rte-form-grid">
          <Column sm={4} md={8} lg={6}>
            <Select
              id="openalex-subfield"
              labelText="OpenAlex subfield"
              helperText={`OpenAlex taxonomy · ${props.subfields.length} subfields available`}
              value={props.categoryId}
              onChange={(event) => props.onCategoryChange(event.target.value)}
              disabled={props.loading || !props.subfields.length}
            >
              <SelectItem value="" text="Select a subfield" />
              {props.subfields.map((subfield) => <SelectItem key={subfield.id} value={subfield.id} text={`${subfield.displayName}${subfield.field ? ` · ${subfield.field.displayName}` : ""}`} />)}
            </Select>
          </Column>
          <Column sm={4} md={4} lg={3}>
            <Select id="publication-year" labelText="Publication year" helperText="Independent of the taxonomy" value={yearToString(props.year)} onChange={(event) => props.onYearChange(Number(event.target.value))} disabled={props.loading}>
              {years.map((year) => <SelectItem key={year} value={String(year)} text={String(year)} />)}
            </Select>
          </Column>
          <Column sm={4} md={4} lg={4}>
            <Select id="document-types" labelText="Document types" helperText="Applied to every result" value={props.documentTypeMode} onChange={(event) => props.onDocumentTypeChange(event.target.value as DocumentTypeMode)} disabled={props.loading}>
              <SelectItem value="article-review" text="Articles + reviews" />
              <SelectItem value="all" text="All OpenAlex work types" />
            </Select>
          </Column>
          <Column sm={4} md={8} lg={3} className="rte-form-action">
            <Button type="submit" size="lg" disabled={props.loading || !props.categoryId || !props.categoryReady}>
              {props.loading ? "Analyzing…" : props.categoryId && !props.categoryReady ? "Loading subfield…" : "Analyze"}
            </Button>
          </Column>
        </Grid>
      </form>
    </section>
  );
}

function yearToString(year: number): string {
  return String(year);
}
