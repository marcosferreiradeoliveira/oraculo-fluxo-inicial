import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
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
  ExternalLink,
  Calendar,
  LogOut
} from 'lucide-react';
import logo from '@/assets/logo.png';
import { Badge } from '@/components/ui/badge';
import { trackMenuIntent } from '@/lib/analytics';

type MenuItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  menuItem: string; // canonical: "inicio" | "editais" | "perfil" | etc
  external?: boolean;
  outline?: boolean;
};

const menuItems: MenuItem[] = [
  { title: 'Início', url: '/', icon: Home, menuItem: 'inicio' },
  { title: 'Meus Projetos', url: '/oraculo-ai', icon: Plus, menuItem: 'meus_projetos' },
  { title: 'Editais Abertos', url: '/editais-abertos', icon: Calendar, menuItem: 'editais' },
  { title: 'Conta', url: '/conta', icon: User, menuItem: 'perfil' },
  { title: 'Suporte', url: '/suporte', icon: HelpCircle, menuItem: 'suporte' },
  { title: 'Prestação de Contas', url: 'https://execucaofinanceira.web.app/', icon: PlayCircle, menuItem: 'prestacao_contas', external: true, outline: true },
  { title: 'Inteligência de Mercado', url: '/inteligencia-mercado', icon: TrendingUp, menuItem: 'inteligencia_mercado', outline: true },
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
                    onClick={() => trackMenuIntent({ menu_item: item.menuItem, destination: item.url, cta_type: 'external_link' })}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                      item.outline 
                        ? 'border-2 border-purple-400/50 hover:border-purple-400 hover:bg-purple-800/20' 
                        : 'hover:bg-purple-800/30'
                    } hover:translate-x-1`}
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
                    onClick={() => trackMenuIntent({ menu_item: item.menuItem, destination: item.url, cta_type: 'nav_link' })}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-oraculo-blue to-oraculo-purple shadow-lg'
                          : item.outline
                          ? 'border-2 border-purple-400/50 hover:border-purple-400 hover:bg-purple-800/20'
                          : 'hover:bg-purple-800/30'
                      } hover:translate-x-1`
                    }
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.title}</span>
                    </div>
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout ao pé do menu — visível em todas as telas */}
        <div className="px-4 pb-3 border-t border-purple-800/30">
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="flex items-center justify-center w-full gap-2 px-4 py-3 rounded-lg text-white bg-red-600/90 hover:bg-red-600 border border-red-500/50 font-medium transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sair da conta
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-purple-800/30">
          <div className="text-center text-sm text-purple-300">
            <p> 2026 Oráculo Cultural</p>
          </div>
        </div>
      </div>
    </>
  );
}
