import { Column, Grid, InlineNotification } from "@carbon/react";

export function ErrorNotice({ message }: { message: string }) {
  return (
    <Grid className="rte-notice-grid">
      <Column sm={4} md={8} lg={16}>
        <InlineNotification kind="error" lowContrast hideCloseButton title="Analysis could not be completed" subtitle={message} />
      </Column>
    </Grid>
  );
}
