import { Button, Header, HeaderName } from "@carbon/react";

interface AppHeaderProps {
  onMethodology: () => void;
  serviceAvailable?: boolean;
}

export function AppHeader({ onMethodology, serviceAvailable }: AppHeaderProps) {
  const repositoryUrl = import.meta.env.VITE_GITHUB_REPOSITORY_URL;
  return (
    <Header aria-label="Research Topic Explorer">
      <HeaderName href={import.meta.env.BASE_URL} prefix="OpenAlex">
        Topic Explorer
      </HeaderName>
      <div className="rte-header-actions">
        <span className="rte-api-status">API {serviceAvailable ? "available" : "status unknown"}</span>
        <Button kind="ghost" size="sm" type="button" onClick={onMethodology}>Methodology</Button>
        {repositoryUrl ? <Button className="rte-repository-action" kind="ghost" size="sm" as="a" href={repositoryUrl} target="_blank" rel="noreferrer">Repository</Button> : null}
      </div>
    </Header>
  );
}
