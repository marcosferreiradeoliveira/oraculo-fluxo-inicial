import React from 'react';
import Loader from './Loader';

export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="text-center">
        <Loader />
        <p className="text-gray-600 text-lg mt-4 animate-pulse">
          Carregando...
        </p>
      </div>
    </div>
  );
}
