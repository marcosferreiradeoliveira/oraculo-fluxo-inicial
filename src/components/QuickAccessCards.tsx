import React, { useState } from 'react';
import { Sparkles, CheckCircle2, Zap, Brain, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import CriarImage from '@/assets/Criar.jpeg';

export function QuickAccessCards() {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  
  const features = [
    'Análise inteligente do seu projeto contra os critérios do edital',
    'Geração automática de textos otimizados (justificativa, objetivos, metodologia)',
    'Sugestões personalizadas de melhorias baseadas no seu portfolio',
    'Avaliação de aderência com nota estimada',
    'Aplicação instantânea das sugestões da IA'
  ];
  
  return (
    <section className="mb-12">
      {/* Box Explicativo Principal */}
      <Card className="border-2 border-oraculo-blue/20 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-oraculo-blue/5 to-oraculo-purple/5 p-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Imagem ou Placeholder */}
            <div className="order-2 md:order-1">
              {!imageError ? (
                <img 
                  src={CriarImage}
                  alt="Inteligência Artificial Oráculo Cultural"
                  className="w-full h-auto rounded-xl shadow-lg"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full aspect-square rounded-xl shadow-lg bg-gradient-to-br from-oraculo-blue via-purple-500 to-oraculo-purple p-8 flex flex-col items-center justify-center text-white">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex items-center justify-center">
                      <Brain className="h-12 w-12" />
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex items-center justify-center">
                      <Zap className="h-12 w-12" />
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex items-center justify-center">
                      <Target className="h-12 w-12" />
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex items-center justify-center">
                      <Sparkles className="h-12 w-12" />
                    </div>
                  </div>
                  <h4 className="text-2xl font-bold text-center">IA Cultural</h4>
                  <p className="text-sm text-white/80 text-center mt-2">Powered by GPT-4</p>
                </div>
              )}
            </div>
            
            {/* Conteúdo */}
            <div className="flex-1 order-1 md:order-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="md:hidden w-12 h-12 bg-gradient-to-r from-oraculo-blue to-oraculo-purple rounded-xl flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900">
                  Transforme seu projeto com Inteligência Artificial
                </h3>
              </div>
              
              <p className="text-gray-600 text-lg mb-6">
                O Oráculo Cultural utiliza IA de última geração para analisar, otimizar e aumentar as chances de aprovação do seu projeto cultural. Veja como podemos ajudar:
              </p>
              
              {/* Lista de features */}
              <div className="space-y-3 mb-8">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-oraculo-blue flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 text-base">{feature}</span>
                  </div>
                ))}
              </div>
              
              {/* Botão CTA Grande */}
              <Button
                onClick={() => navigate('/oraculo-ai')}
                className="w-full md:w-auto px-12 py-6 text-xl font-semibold bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Sparkles className="h-6 w-6 mr-3" />
                Começar Agora
              </Button>
              
              <p className="text-sm text-gray-500 mt-4">
                ✨ Experimente gratuitamente ou faça upgrade para desbloquear recursos premium
              </p>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
