import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error?: Error }
> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    window.dispatchEvent(
      new CustomEvent("ba-mate-research-event", {
        detail: { type: "error", successful: false },
      }),
    );
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error-screen">
        <section role="alert">
          <i>
            <AlertTriangle />
          </i>
          <span className="eyebrow">Local workspace recovery</span>
          <h1>BA Mate could not render this view</h1>
          <p>
            Your persisted workspace has not been removed. Reload the interface
            to reopen the last saved local state.
          </p>
          <details>
            <summary>Technical detail</summary>
            <code>{this.state.error.message}</code>
          </details>
          <button className="button primary" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> Reload BA Mate
          </button>
        </section>
      </main>
    );
  }
}
