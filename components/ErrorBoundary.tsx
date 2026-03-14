import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'Unknown error';
      let isFirestoreError = false;
      
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.operationType) {
          isFirestoreError = true;
          errorMessage = parsed.error;
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-exclamation-triangle text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Что-то пошло не так</h1>
            <p className="text-slate-600 mb-6">
              {isFirestoreError 
                ? "У вас нет прав на выполнение этого действия (ошибка безопасности базы данных)."
                : "Произошла непредвиденная ошибка в приложении."}
            </p>
            <div className="bg-slate-100 p-4 rounded-xl text-left overflow-auto max-h-40 mb-6">
              <code className="text-xs text-slate-700 font-mono">{errorMessage}</code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-colors w-full"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
