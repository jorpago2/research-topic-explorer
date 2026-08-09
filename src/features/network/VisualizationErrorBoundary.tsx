import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { InlineNotification } from "@carbon/react";

export class VisualizationErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Deliberately avoid logging third-party error objects in production.
  }
  render() {
    if (this.state.failed) {
      return <InlineNotification kind="error" lowContrast hideCloseButton title="Visualization unavailable" subtitle="The generated VOSviewer JSON is still available for download." />;
    }
    return this.props.children;
  }
}
