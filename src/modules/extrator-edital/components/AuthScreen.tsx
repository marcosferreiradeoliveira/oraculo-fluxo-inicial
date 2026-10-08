import React, { useState } from 'react';
import LoginForm from './LoginForm';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);

  const toggleMode = () => {
    setIsLogin(!isLogin);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-md mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-cyan-600 mb-2">
            Analisador de Edital
          </h1>
          <p className="text-lg text-gray-600">
            Faça login para acessar a análise de editais com IA
          </p>
        </header>

        <LoginForm onToggleMode={toggleMode} isLogin={isLogin} />

        <footer className="text-center mt-8 text-gray-500 text-sm">
          <p>Powered by Google Gemini API & Firebase</p>
        </footer>
      </div>
    </div>
  );
}
