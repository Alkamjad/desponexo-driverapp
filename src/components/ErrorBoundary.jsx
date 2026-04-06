import React from 'react';
import { AlertCircle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-slate-800/80 backdrop-blur-xl border border-red-500/30 rounded-2xl p-8 text-center">
              <div className="mb-4">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Fehler aufgetreten</h1>
              <p className="text-slate-400 mb-6">
                Ein unerwarteter Fehler ist aufgetreten. Bitte aktualisiere die Seite oder navigiere zur Startseite.
              </p>
              
              {this.state.error && (
                <details className="mb-6 text-left">
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 mb-2">
                    Debug-Info
                  </summary>
                  <pre className="bg-slate-900/50 p-3 rounded text-xs text-red-300 overflow-auto max-h-48">
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  Aktualisieren
                </Button>
                <Button
                  onClick={() => window.location.href = createPageUrl('Dashboard')}
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Home
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;