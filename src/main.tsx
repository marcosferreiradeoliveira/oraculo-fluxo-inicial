import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { firebaseInit } from './lib/firebase';
import ErrorBoundary from './components/ErrorBoundary';

firebaseInit();

// Tela de carregamento
const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Carregando...</p>
    </div>
  </div>
);

// Componente de erro
const ErrorFallback = ({ onReload }: { onReload: () => void }) => (
  <div className="flex items-center justify-center min-h-screen p-4">
    <div className="text-center max-w-md">
      <h1 className="text-2xl font-bold text-red-600 mb-2">Erro</h1>
      <p className="mb-4 text-gray-600">
        Ocorreu um erro ao carregar a aplicação.
      </p>
      <button 
        onClick={onReload}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        Tentar Novamente
      </button>
    </div>
  </div>
);

// Inicialização segura da aplicação
const initApp = async () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;">Erro: Elemento root não encontrado</div>';
    return;
  }

  const root = createRoot(rootElement);

  const safeRender = (content: React.ReactNode) => {
    try {
      root.render(
        <React.StrictMode>
          <ErrorBoundary 
            fallback={
              <ErrorFallback 
                onReload={() => window.location.reload()} 
              />
            }
          >
            {content}
          </ErrorBoundary>
        </React.StrictMode>
      );
    } catch (error) {
      console.error('Erro ao renderizar:', error);
      rootElement.innerHTML = '<div style="padding: 20px; text-align: center;">Erro ao carregar a aplicação</div>';
    }
  };

  try {
    // Mostra tela de carregamento
    safeRender(<LoadingScreen />);

    // Inicializa Firebase
    try {
      await firebaseInit;
    } catch (error) {
      console.warn('Firebase não inicializado:', error);
    }

    // Renderiza o app principal
    safeRender(<App />);
  } catch (error) {
    console.error('Falha na inicialização:', error);
    safeRender(
      <ErrorFallback 
        onReload={() => window.location.reload()} 
      />
    );
  }
};

// Inicializa a aplicação
initApp().catch(console.error);