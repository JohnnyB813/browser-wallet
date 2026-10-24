import React from "react";
import Button from "./Button";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  /** Shown when the app could not render. */
  title?: string;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * A last stop for a render that throws.
 *
 * Without this, a throw during render unmounts the whole tree and the
 * document shows nothing but the black page background. That is a dead
 * panel: the user has no way back except reloading, and in a docked
 * sidebar they may not realise the panel is still there.
 *
 * This catches the throw, says what happened, and offers a way out.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // The console is the only place the stack is. Keep it.
    console.error("[warthog] render failed:", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  private handleReload = (): void => {
    try {
      location.reload();
    } catch {
      // ignore
    }
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="container min-h-screen py-8 flex flex-col items-center justify-center text-center">
        <h1 className="text-white text-lg font-semibold mb-2">
          {this.props.title ?? "Something went wrong"}
        </h1>
        <p className="text-white/60 text-xs mb-4 max-w-sm leading-relaxed">
          The wallet could not draw this screen. Reloading usually fixes it.
        </p>
        <p className="text-white/30 text-[11px] font-mono mb-6 max-w-sm break-words">
          {error.message}
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button variant="primary" onClick={this.handleReload}>
            Reload the wallet
          </Button>
          <Button variant="outline" onClick={this.handleReset}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
