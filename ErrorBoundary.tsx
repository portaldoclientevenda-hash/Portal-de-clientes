import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Ocorreu um erro inesperado na aplicação.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let friendlyMessage = 'Não foi possível concluir esta operação. Tente recarregar a página.';
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          if (String(parsed.error).toLowerCase().includes('offline')) {
            friendlyMessage = 'Sem conexão, tente novamente.';
          } else if (String(parsed.error).toLowerCase().includes('permission')) {
            friendlyMessage = 'Acesso bloqueado pelas regras de privacidade do banco de dados.';
          }
        }
      } catch {
        if (this.state.message.toLowerCase().includes('offline')) {
          friendlyMessage = 'Sem conexão, tente novamente.';
        }
      }

      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Ops, algo interrompeu a tela</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{friendlyMessage}</p>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar Portal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
