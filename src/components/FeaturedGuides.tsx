
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp } from 'lucide-react';

const featuredGuides = [
  {
    title: 'Guia Funarte Ações Continuadas 2025',
    description: 'Estratégias completas para aprovação em editais de ações continuadas',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=200&fit=crop',
    badge: 'MAIS POPULAR',
    badgeColor: 'bg-oraculo-gold'
  },
  {
    title: 'Guia Editais de Literatura SECEC-RJ',
    description: 'Decodificando os critérios de avaliação dos editais literários do Rio',
    image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&h=200&fit=crop',
    badge: 'NOVO',
    badgeColor: 'bg-oraculo-magenta'
  },
  {
    title: 'Guia PNAB - O que você precisa saber',
    description: 'Tudo sobre o Plano Nacional Aldir Blanc e como se preparar',
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=300&h=200&fit=crop',
    badge: 'TENDÊNCIA',
    badgeColor: 'bg-oraculo-blue'
  }
];

export function FeaturedGuides() {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Decodificando os Editais do Momento</h2>
        <div className="flex items-center text-oraculo-blue">
          <TrendingUp className="h-5 w-5 mr-2" />
          <span className="text-sm font-medium">Em destaque</span>
        </div>
      </div>
      
      <div className="flex space-x-6 overflow-x-auto pb-4">
        {featuredGuides.map((guide) => (
          <Card key={guide.title} className="flex-shrink-0 w-80 card-hover cursor-pointer group">
            <div className="relative">
              <img 
                src={guide.image} 
                alt={guide.title}
                className="w-full h-48 object-cover rounded-t-lg"
              />
              <Badge className={`absolute top-3 left-3 ${guide.badgeColor} text-white`}>
                {guide.badge}
              </Badge>
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full p-1">
                <Star className="h-4 w-4 text-oraculo-gold fill-current" />
              </div>
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-oraculo-blue transition-colors">
                {guide.title}
              </h3>
              <p className="text-sm text-gray-600">{guide.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
