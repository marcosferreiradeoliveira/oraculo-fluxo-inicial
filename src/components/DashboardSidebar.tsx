
import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Brain, 
  BookOpen, 
  Headphones, 
  BarChart3, 
  User, 
  HelpCircle,
  Sparkles
} from 'lucide-react';

const menuItems = [
  { title: 'Início', url: '/', icon: Home },
  { title: 'Oráculo AI', url: '/oraculo-ai', icon: Brain },
  { title: 'Biblioteca de Guias', url: '/biblioteca', icon: BookOpen },
  { title: 'Podcast', url: '/podcast', icon: Headphones },
  { title: 'Conta', url: '/conta', icon: User },
  { title: 'Suporte', url: '/suporte', icon: HelpCircle },
];

export function DashboardSidebar() {
  return (
    <div className="w-64 min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 text-white flex flex-col">
      {/* Logo/Brand Section */}
      <div className="p-6 border-b border-purple-800/30">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-oraculo-magenta to-oraculo-gold rounded-lg flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Oráculo</h1>
            <p className="text-sm text-purple-300">Cultural</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 py-6">
        <ul className="space-y-2 px-4">
          {menuItems.map((item) => (
            <li key={item.title}>
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
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-purple-800/30">
        <div className="text-center text-sm text-purple-300">
          <p>© 2024 Oráculo Cultural</p>
        </div>
      </div>
    </div>
  );
}
