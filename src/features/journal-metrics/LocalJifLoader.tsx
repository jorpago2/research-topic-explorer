import { useRef } from "react";
import { CheckCircle2, FileUp, LockKeyhole, X } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <section className="local-jif-panel" aria-labelledby="local-jif-heading">
      <div className="local-jif-icon" aria-hidden="true"><LockKeyhole size={20} /></div>
      <div className="local-jif-copy">
        <h2 id="local-jif-heading">Private JIF enrichment</h2>
        <p>Select the prepared JSON file to add Clarivate JIF metadata. The file is read only in this browser tab and is never uploaded or stored.</p>
        <div className="local-jif-status" role="status" aria-live="polite">
          {props.dataset ? (
            <span className="local-jif-loaded">
              <CheckCircle2 size={16} aria-hidden="true" />
              {props.dataset.edition} edition · {props.dataset.journals.length.toLocaleString()} journal records
              {props.fileName ? ` · ${props.fileName}` : ""}
              {props.matchedSources !== null && props.totalSources !== null ? ` · ${props.matchedSources}/${props.totalSources} current Sources matched` : ""}
            </span>
          ) : <span>No private JIF file loaded.</span>}
          {props.error ? <span className="local-jif-error">{props.error}{props.dataset ? " The previously validated file remains loaded." : ""}</span> : null}
        </div>
      </div>
      <div className="local-jif-actions">
        <input
          id="local-jif-file"
          ref={fileInputRef}
          className="sr-only"
          type="file"
          aria-label="Choose JIF JSON"
          accept=".json,application/json"
          disabled={props.disabled}
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (file) await props.onFile(file);
            input.value = "";
          }}
        />
        <button type="button" className="secondary-button file-button" disabled={props.disabled} onClick={() => fileInputRef.current?.click()}>
          <FileUp size={16} aria-hidden="true" /> {props.loading ? "Validating…" : props.dataset ? "Replace file" : "Choose JIF JSON"}
        </button>
        {props.dataset ? <button type="button" className="text-button local-jif-clear" onClick={props.onClear} disabled={props.disabled}><X size={16} aria-hidden="true" /> Remove</button> : null}
      </div>
    </section>
  );
}
