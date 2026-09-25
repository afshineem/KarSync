import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 dir-rtl text-right">
          <div className="bg-slate-800 border border-rose-500/30 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertCircle className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-100">خطایی رخ داده است</h2>
              <p className="text-sm text-slate-400 font-medium">
                سیستم با یک خطای غیرمنتظره مواجه شد. لطفاً صفحه را بارگذاری مجدد کنید یا دکمه تلاش مجدد را بزنید.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/80 rounded-xl p-3 text-xs text-rose-300 font-mono text-left max-h-36 overflow-y-auto border border-rose-900/40">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                بارگذاری مجدد صفحه
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Home className="w-4 h-4" />
                تلاش مجدد
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
