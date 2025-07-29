import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Headphones, BookText, BarChart3, Clock } from 'lucide-react';

interface ContentItem {
  id: string;
  title: string;
  type: string;
  icon: React.ElementType;
  duration: string;
  date: string;
  color: string;
}

const recentContent: ContentItem[] = [
  {
    id: 'p3uoC5mDd4Sib1r8cBzL', 
    title: 'Acessibilidade Atitudinal: O Diferencial na Avaliação',
    type: 'PODCAST',
    icon: Headphones,
    duration: '42 min',
    date: '2 dias atrás',
    color: 'text-oraculo-purple'
  },
  {
    id: '1',
    title: 'O Guia do Orçamento Perfeito',
    type: 'EBOOK',
    icon: BookText,
    duration: '15 páginas',
    date: '3 dias atrás',
    color: 'text-oraculo-blue'
  },
  {
    id: '2',
    title: 'O Ecossistema do Fomento no Brasil',
    type: 'INFOGRÁFICO',
    icon: BarChart3,
    duration: 'Visualização',
    date: '5 dias atrás',
    color: 'text-oraculo-magenta'
  },
  {
    id: '3',
    title: 'Contrapartidas Sociais que Fazem a Diferença',
    type: 'PODCAST',
    icon: Headphones,
    duration: '38 min',
    date: '1 semana atrás',
    color: 'text-oraculo-purple'
  },
  {
    id: '4',
    title: 'Prestação de Contas: Guia Prático',
    type: 'EBOOK',
    icon: BookText,
    duration: '22 páginas',
    date: '1 semana atrás',
    color: 'text-oraculo-blue'
  },
  {
    id: '5',
    title: 'Mapeamento de Editais 2024',
    type: 'INFOGRÁFICO',
    icon: BarChart3,
    duration: 'Interativo',
    date: '2 semanas atrás',
    color: 'text-oraculo-magenta'
  }
];

export function RecentContent() {
  const navigate = useNavigate();

  const handleItemClick = (item: ContentItem) => {
    if (item.type === 'PODCAST') {
      navigate(`/podcast/${item.id}`);
    }
  };

  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Novidades na Plataforma</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recentContent.map((item) => (
          <Card 
            key={item.id} 
            className={`card-hover cursor-pointer group ${item.type === 'PODCAST' ? 'hover:border-oraculo-purple' : ''}`}
            onClick={() => handleItemClick(item)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg bg-gray-50 group-hover:bg-gray-100 transition-colors`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <Badge variant="secondary" className="text-xs">
                  {item.type}
                </Badge>
              </div>
              
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-oraculo-blue transition-colors line-clamp-2">
                {item.title}
              </h3>
              
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{item.duration}</span>
                <div className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>{item.date}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
