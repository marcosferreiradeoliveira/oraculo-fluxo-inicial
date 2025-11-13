import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  Brain, 
  BookOpen, 
  Headphones, 
  User, 
  HelpCircle,
  Sparkles,
  Menu,
  X,
  Plus,
  TrendingUp,
  PlayCircle,
  ExternalLink
} from 'lucide-react';
import logo from '@/assets/logo.png';

const menuItems = [
  { title: 'Início', url: '/', icon: Home },
  { title: 'Criar Projeto', url: '/oraculo-ai', icon: Plus },
  { title: 'Executar Projeto', url: 'https://execucaofinanceira.web.app/', icon: PlayCircle, external: true },
  { title: 'Inteligência de Mercado', url: '/inteligencia-mercado', icon: TrendingUp },
  { title: 'Conta', url: '/conta', icon: User },
  { title: 'Suporte', url: '/suporte', icon: HelpCircle },
];

export function DashboardSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Atualizar estado de mobile ao redimensionar
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fechar menu ao navegar em dispositivos móveis
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Fechar com ESC
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Botão do menu móvel */}
      {isMobile && (
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-oraculo-blue to-oraculo-purple rounded-full flex items-center justify-center text-white shadow-lg z-40"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      )}

      {/* Overlay */}
      {isOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Menu lateral */}
      <div 
        ref={menuRef}
        className={`fixed md:static z-30 w-64 min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 text-white flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo/Brand Section */}
        <div className="p-6 border-b border-purple-800/30">
          <div className="flex items-center space-x-3">
            <img 
              src={logo} 
              alt="Oráculo Cultural" 
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold">Oráculo</h1>
              <p className="text-sm text-purple-300">Cultural</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-6 overflow-y-auto">
          <ul className="space-y-2 px-4">
            {menuItems.map((item) => (
              <li key={item.title}>
                {item.external ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 hover:bg-purple-800/30 hover:translate-x-1"
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.title}</span>
                    </div>
                    <ExternalLink className="h-4 w-4 text-purple-300" />
                  </a>
                ) : (
                  <NavLink
                    to={item.url}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-oraculo-blue to-oraculo-purple shadow-lg'
                          : 'hover:bg-purple-800/30 hover:translate-x-1'
                      }`
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.title}</span>
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-purple-800/30 mt-auto">
          <div className="text-center text-sm text-purple-300">
            <p> 2024 Oráculo Cultural</p>
          </div>
        </div>
      </div>
    </>
  );
}
