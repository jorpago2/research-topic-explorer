import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

export class VisualizationErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Deliberately avoid logging third-party error objects in production.
  }
  render() {
    if (this.state.failed) {
      return <div className="network-fallback" role="alert"><strong>The network visualization could not be initialized.</strong><p>You can still download the generated VOSviewer JSON.</p></div>;
    }
    return this.props.children;
  }
}
