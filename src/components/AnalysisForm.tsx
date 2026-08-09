import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button, Column, ComboBox, Grid, Select, SelectItem } from "@carbon/react";
import type { AnalysisScope, DocumentTypeMode, OpenAlexSubfield, TopicHierarchyNode } from "../types/domain";

const UNCLASSIFIED_ID = "unclassified";
const UNCLASSIFIED_DOMAIN: TopicHierarchyNode = { id: UNCLASSIFIED_ID, displayName: "Unclassified domain" };
const UNCLASSIFIED_FIELD: TopicHierarchyNode = { id: UNCLASSIFIED_ID, displayName: "Unclassified field" };

interface AnalysisFormProps {
  subfields: OpenAlexSubfield[];
  categoryId: string;
  year: number;
  analysisScope: AnalysisScope;
  documentTypeMode: DocumentTypeMode;
  loading: boolean;
  categoryReady: boolean;
  onCategoryChange: (value: string) => void;
  onYearChange: (value: number) => void;
  onAnalysisScopeChange: (value: AnalysisScope) => void;
  onDocumentTypeChange: (value: DocumentTypeMode) => void;
  onAnalyze: () => void;
}

export function AnalysisForm(props: AnalysisFormProps) {
  const years = Array.from({ length: 16 }, (_, index) => new Date().getFullYear() - index);
  const selectedSubfield = props.subfields.find((subfield) => subfield.id === props.categoryId) ?? null;
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [selectedFieldId, setSelectedFieldId] = useState("");

  useEffect(() => {
    if (!selectedSubfield) return;
    setSelectedDomainId(hierarchyId(selectedSubfield.domain));
    setSelectedFieldId(hierarchyId(selectedSubfield.field));
  }, [selectedSubfield]);
  const domains = useMemo(
    () => uniqueNodes(props.subfields.map((subfield) => subfield.domain ?? UNCLASSIFIED_DOMAIN)),
    [props.subfields],
  );
  const fields = useMemo(
    () => uniqueNodes(
      props.subfields
        .filter((subfield) => hierarchyId(subfield.domain) === selectedDomainId)
        .map((subfield) => subfield.field ?? UNCLASSIFIED_FIELD),
    ),
    [props.subfields, selectedDomainId],
  );
  const visibleSubfields = useMemo(
    () => props.subfields
      .filter((subfield) => hierarchyId(subfield.domain) === selectedDomainId && hierarchyId(subfield.field) === selectedFieldId)
      .sort(compareSubfields),
    [props.subfields, selectedDomainId, selectedFieldId],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    props.onAnalyze();
  }

  function selectFirstSubfield(candidates: OpenAlexSubfield[]) {
    const first = [...candidates].sort(compareSubfields)[0];
    if (!first) return;
    setSelectedDomainId(hierarchyId(first.domain));
    setSelectedFieldId(hierarchyId(first.field));
    props.onCategoryChange(first.id);
  }

  function changeDomain(domainId: string) {
    setSelectedDomainId(domainId);
    selectFirstSubfield(props.subfields.filter((subfield) => hierarchyId(subfield.domain) === domainId));
  }

  function changeField(fieldId: string) {
    setSelectedFieldId(fieldId);
    selectFirstSubfield(props.subfields.filter(
      (subfield) => hierarchyId(subfield.domain) === selectedDomainId && hierarchyId(subfield.field) === fieldId,
    ));
  }

  return (
    <section aria-labelledby="analysis-heading" className="rte-analysis">
      <Grid className="rte-hero-grid">
        <Column sm={4} md={8} lg={10}>
          <p className="rte-eyebrow">OPEN BIBLIOMETRIC ANALYSIS</p>
          <h1 id="analysis-heading">Explore an OpenAlex research subfield</h1>
          <p className="rte-lead">Discover its journal set, rank primary topics, compare periods, and map topic co-occurrence.</p>
        </Column>
      </Grid>
      <form onSubmit={submit}>
        <Grid className="rte-taxonomy-grid">
          <Column sm={4} md={4} lg={4}>
            <Select
              id="openalex-domain"
              labelText="OpenAlex domain"
              helperText={`${domains.length} domains available`}
              value={selectedDomainId}
              onChange={(event) => changeDomain(event.target.value)}
              disabled={props.loading || !props.subfields.length}
            >
              <SelectItem value="" text="Select a domain" />
              {domains.map((domain) => <SelectItem key={domain.id} value={domain.id} text={domain.displayName} />)}
            </Select>
          </Column>
          <Column sm={4} md={4} lg={5}>
            <Select
              id="openalex-field"
              labelText="OpenAlex field"
              helperText={`${fields.length} fields in this domain`}
              value={selectedFieldId}
              onChange={(event) => changeField(event.target.value)}
              disabled={props.loading || !fields.length}
            >
              <SelectItem value="" text="Select a field" />
              {fields.map((field) => <SelectItem key={field.id} value={field.id} text={field.displayName} />)}
            </Select>
          </Column>
          <Column sm={4} md={8} lg={7}>
            <ComboBox
              id="openalex-subfield"
              titleText="OpenAlex subfield"
              helperText={`${visibleSubfields.length} subfields in this field · search by name or ID`}
              placeholder="Search and select a subfield"
              items={visibleSubfields}
              itemToString={(subfield) => subfield?.displayName ?? ""}
              selectedItem={selectedSubfield}
              shouldFilterItem={({ item, inputValue }) => {
                const query = (inputValue ?? "").trim().toLocaleLowerCase();
                const selectedLabel = selectedSubfield?.displayName.toLocaleLowerCase();
                if (query && query === selectedLabel) return true;
                return !query || item.displayName.toLocaleLowerCase().includes(query) || item.id.toLocaleLowerCase().includes(query);
              }}
              onChange={({ selectedItem }) => {
                props.onCategoryChange(selectedItem?.id ?? "");
              }}
              disabled={props.loading || !visibleSubfields.length}
              autoAlign
            />
          </Column>
        </Grid>
        <Grid className="rte-form-grid">
          <Column sm={4} md={8} lg={6}>
            <Select
              id="analysis-scope"
              labelText="Analysis scope"
              helperText={props.analysisScope === "strict-subfield" ? "Only works whose primary topic belongs to this exact OpenAlex subfield" : "All selected-year works from the discovered journals"}
              value={props.analysisScope}
              onChange={(event) => props.onAnalysisScopeChange(event.target.value as AnalysisScope)}
              disabled={props.loading}
            >
              <SelectItem value="strict-subfield" text="Strict selected subfield" />
              <SelectItem value="journal-set" text="Entire journal set" />
            </Select>
          </Column>
          <Column sm={4} md={3} lg={3}>
            <Select id="publication-year" labelText="Publication year" helperText="Independent of the taxonomy" value={String(props.year)} onChange={(event) => props.onYearChange(Number(event.target.value))} disabled={props.loading}>
              {years.map((year) => <SelectItem key={year} value={String(year)} text={String(year)} />)}
            </Select>
          </Column>
          <Column sm={4} md={5} lg={4}>
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

function hierarchyId(node: TopicHierarchyNode | null): string {
  return node?.id ?? UNCLASSIFIED_ID;
}

function uniqueNodes(nodes: TopicHierarchyNode[]): TopicHierarchyNode[] {
  return [...new Map(nodes.map((node) => [node.id, node])).values()]
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

function compareSubfields(left: OpenAlexSubfield, right: OpenAlexSubfield): number {
  return left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id);
}
