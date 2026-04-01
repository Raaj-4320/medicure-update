import React from 'react';
import { appLogger } from '../utils/observability';

type Props = {
  children: React.ReactNode;
  page: string;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    appLogger.log({
      category: 'RENDER_ERROR',
      event: 'component_crash_caught',
      status: 'failure',
      page: this.props.page,
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      scope: 'AppErrorBoundary',
      message: 'A component crashed and fallback UI was rendered.',
      meta: {
        componentStackTop: info.componentStack?.split('\n').slice(0, 2).join(' | '),
      },
      error: appLogger.errorSummary(error),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="max-w-lg bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-6 text-sm">
            <p className="font-bold mb-1">This page failed to load.</p>
            <p>Check logs for route/component failure.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
