import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('OnlyFap render error', error, info.componentStack); }
  render() {
    if (this.state.failed) {
      return this.props.fallback ?? (
        <div role="alert" className="panel mx-auto my-10 max-w-md p-6 text-center text-sm">
          This part of the page failed to load. Refresh to try again.
        </div>
      );
    }
    return this.props.children;
  }
}
