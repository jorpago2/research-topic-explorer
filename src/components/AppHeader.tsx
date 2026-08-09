import { ExternalLink, Network } from "lucide-react";

interface AppHeaderProps {
  onMethodology: () => void;
  serviceAvailable?: boolean;
}

export function AppHeader({ onMethodology, serviceAvailable }: AppHeaderProps) {
  const repositoryUrl = import.meta.env.VITE_GITHUB_REPOSITORY_URL;
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true"><Network size={18} strokeWidth={2} /></span>
        <div>
          <p className="brand-name">Research Topic Explorer</p>
          <p className="brand-subtitle">Open bibliometric analysis with OpenAlex</p>
        </div>
      </div>
      <nav className="header-actions" aria-label="Application links">
        <span className={`service-status ${serviceAvailable ? "available" : "unknown"}`} title={serviceAvailable ? "Research data service available" : "Research data service status unavailable"}><span aria-hidden="true" /> API</span>
        <button className="text-button" type="button" onClick={onMethodology}>Methodology</button>
        {repositoryUrl ? (
          <a className="icon-link" href={repositoryUrl} target="_blank" rel="noreferrer" aria-label="Open project repository">
            <ExternalLink size={19} aria-hidden="true" />
          </a>
        ) : null}
      </nav>
    </header>
  );
}
