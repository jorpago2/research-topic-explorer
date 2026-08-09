import { Column, Grid } from "@carbon/react";

export function Footer() {
  return (
    <footer className="rte-footer">
      <Grid className="rte-footer-grid">
        <Column sm={4} md={4} lg={8}><p>OpenAlex data · VOSviewer Online · MIT licensed</p></Column>
        <Column className="rte-footer-end" sm={4} md={4} lg={8}><p>Classification: OpenAlex · Optional JIF: locally loaded Clarivate data</p></Column>
      </Grid>
    </footer>
  );
}
