
import React, { useRef, useState } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { DocumentIcon } from './icons/DocumentIcon';

interface FileUploadProps {
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
  file: File | null;
  disabled: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, onAnalyze, file, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const selectedFile = files[0];
      if (selectedFile.type === "application/pdf") {
        onFileChange(selectedFile);
      } else {
        alert("Por favor, selecione um arquivo PDF.");
        onFileChange(null);
      }
    }
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${isDragging ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFileSelect(e.target.files)}
          accept=".pdf"
          className="hidden"
          disabled={disabled}
        />
        <div className="flex flex-col items-center justify-center text-center text-gray-600">
          {!file ? (
            <>
              <UploadIcon className="w-12 h-12 mb-4 text-gray-400" />
              <p className="font-semibold text-gray-700">Arraste e solte o edital em PDF aqui</p>
              <p className="text-sm">ou <span className="text-purple-600 font-medium">clique para selecionar</span></p>
            </>
          ) : (
            <>
              <DocumentIcon className="w-12 h-12 mb-4 text-purple-600"/>
              <p className="font-semibold text-gray-800">Arquivo selecionado:</p>
              <p className="text-sm text-gray-600 break-all">{file.name}</p>
            </>
          )}
        </div>
      </div>
      <button
        onClick={onAnalyze}
        disabled={!file || disabled}
        className="mt-6 w-full sm:w-auto text-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-12 py-3 transition-all duration-300 shadow-lg hover:shadow-cyan-500/50 disabled:shadow-none"
      >
        Analisar Edital
      </button>
    </div>
  );
};

export default FileUpload;
