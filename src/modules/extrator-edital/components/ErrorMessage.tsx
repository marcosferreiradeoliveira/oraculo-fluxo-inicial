
import React from 'react';

interface ErrorMessageProps {
  message: string;
  onRetry: () => void;
  showRetry: boolean;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry, showRetry }) => {
  return (
    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg relative flex flex-col items-center justify-center text-center min-h-[200px]" role="alert">
      <strong className="font-bold block mb-2">Ops! Algo deu errado.</strong>
      <span className="block">{message}</span>
      {showRetry && (
        <button
          onClick={onRetry}
          className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-200"
        >
          Tentar Novamente
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
