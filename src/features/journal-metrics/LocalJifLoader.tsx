import { Button, Column, FileUploaderButton, Grid, InlineLoading, InlineNotification, Tile } from "@carbon/react";
import type { JifDataset } from "../../types/domain";

interface LocalJifLoaderProps {
  dataset: JifDataset | null;
  fileName: string | null;
  loading: boolean;
  disabled: boolean;
  error: string | null;
  matchedSources: number | null;
  totalSources: number | null;
  onFile: (file: File) => Promise<void>;
  onClear: () => void;
}

export function LocalJifLoader(props: LocalJifLoaderProps) {
  const status = props.dataset
    ? `${props.dataset.edition} edition · ${props.dataset.journals.length.toLocaleString()} journal records${props.fileName ? ` · ${props.fileName}` : ""}${props.matchedSources !== null && props.totalSources !== null ? ` · ${props.matchedSources}/${props.totalSources} current Sources matched` : ""}`
    : "No private JIF file loaded.";
  return (
    <Grid className="rte-jif-grid">
      <Column sm={4} md={8} lg={16}>
        <Tile className="rte-jif-tile">
          <div className="rte-jif-copy">
            <p className="rte-eyebrow">LOCAL DATA</p>
            <h2>Private JIF enrichment</h2>
            <p>Select the prepared JSON file to add Clarivate JIF metadata. It remains in this browser tab and is never uploaded or stored.</p>
            {props.dataset || props.loading ? <InlineLoading status={props.loading ? "active" : "finished"} description={props.loading ? "Validating local JIF data…" : status} /> : <p className="rte-secondary-text">{status}</p>}
          </div>
          <div className="rte-jif-actions">
            <FileUploaderButton
              id="local-jif-file"
              accept={[".json", "application/json"]}
              buttonKind="secondary"
              size="md"
              disabled={props.disabled}
              disableLabelChanges
              labelText={props.dataset ? "Replace JIF JSON" : "Choose JIF JSON"}
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                if (file) await props.onFile(file);
                input.value = "";
              }}
            />
            {props.dataset ? <Button kind="ghost" size="md" type="button" onClick={props.onClear} disabled={props.disabled}>Remove</Button> : null}
          </div>
          {props.error ? <InlineNotification className="rte-jif-error" kind="error" lowContrast hideCloseButton title="JIF file rejected" subtitle={`${props.error}${props.dataset ? " The previously validated file remains loaded." : ""}`} /> : null}
        </Tile>
      </Column>
    </Grid>
  );
}
