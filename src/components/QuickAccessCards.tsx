import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

const YOUTUBE_EMBED_URL = 'https://www.youtube.com/embed/3bCt7Hjb5tk?autoplay=1&mute=1';

export function QuickAccessCards() {
  const navigate = useNavigate();
  const location = useLocation();

  const scrollToEditais = () => {
    if (location.pathname === '/') {
      document.getElementById('editais-abertos')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/#editais-abertos');
    }
  };

  return (
    <section className="mb-12">
      <Card className="border-2 border-oraculo-blue/20 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-oraculo-blue/5 to-oraculo-purple/5 p-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Vídeo YouTube: autoplay + mute */}
            <div className="order-2 md:order-1 aspect-video w-full rounded-xl overflow-hidden shadow-lg bg-black">
              <iframe
                src={YOUTUBE_EMBED_URL}
                title="Oráculo Cultural"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full min-h-[280px] md:min-h-[320px]"
              />
            </div>

            {/* Título + botão */}
            <div className="flex-1 order-1 md:order-2">
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Ganhe mais editais com inteligência artificial
              </h3>
              <p className="text-gray-600 text-base md:text-lg font-normal mb-6">
                Avalie seu projeto como um parecerista com IA, gere textos, orçamento, cronograma e muito mais!
              </p>

              <Button
                onClick={scrollToEditais}
                className="w-full md:w-auto px-12 py-7 text-xl font-semibold bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                Começar Agora
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
