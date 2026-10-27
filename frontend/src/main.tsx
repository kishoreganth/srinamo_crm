import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';
import { useThemeStore } from './stores/theme.store';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crash:', error, info.componentStack);
  }

  handleReset = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    this.setState({ error: null });
    window.location.href = '/login';
  };

  render() {
    if (this.state.error) {
      return (
        <div className="page-bg" style={{ padding: 40, fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 600, margin: '80px auto', color: 'var(--text)' }}>
          <h1 style={{ color: 'var(--danger)', fontSize: 24, marginBottom: 12 }}>Something went wrong</h1>
          <pre style={{ background: 'var(--status-maintenance-bg)', color: 'var(--status-maintenance-fg)', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={this.handleReset}
            style={{ marginTop: 16, padding: '10px 20px', background: 'var(--accent)', color: 'var(--accent-foreground)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
          >
            Clear Session &amp; Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ThemedToaster() {
  const mode = useThemeStore((state) => state.mode);
  return <Toaster theme={mode === 'system' ? 'system' : mode} position="top-right" richColors closeButton />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
        <ThemedToaster />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
