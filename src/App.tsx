
declare global {
  interface Window {
    dataLayer: any[];
  }
}

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EnvDebug } from "./components/EnvDebug";
import GoogleTagManager, { GoogleTagManagerRouteTracker } from "./components/GoogleTagManager";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import OraculoAI from "./pages/OraculoAI";
import Biblioteca from "./pages/Biblioteca";
import Podcast from "./pages/Podcast";
import Infograficos from "./pages/Infograficos";
import Conta from "./pages/Conta";
import Suporte from "./pages/Suporte";
import Cadastro from "./pages/Cadastro";
import CriarProjeto from "./pages/CriarProjeto";
import Projeto from "./pages/Projeto";
import AlterarComIA from "./pages/AlterarComIA";
import EditarEdital from './pages/EditarEdital';
import CadastrarEpisodio from './pages/CadastrarEpisodio';
import EditarEpisodio from './pages/EditarEpisodio';
import PodcastDetalhes from './pages/PodcastDetalhes';
import CadastrarGuia from './pages/CadastrarGuia';
import EditarGuia from './pages/EditarGuia';
import DetalhesGuiaEspecial from './pages/DetalhesGuiaEspecial';
import CadastroPremium from './pages/CadastroPremium';
import ContatoPremium from './pages/ContatoPremium';
import GerenciarAssinatura from './pages/GerenciarAssinatura';
import GerarTextos from './pages/GerarTextos';
import PreencherAnexos from './pages/PreencherAnexos';
import CriarOrcamento from './pages/CriarOrcamento';
import CriarCronograma from './pages/CriarCronograma';
import DocumentosInscricao from './pages/DocumentosInscricao';
import ResumoProjeto from './pages/ResumoProjeto';
import Termos from './pages/Termos';
import Privacidade from './pages/Privacidade';
import DetalhesEdital from './pages/DetalhesEdital';
import InteligenciaMercado from './pages/InteligenciaMercado';
import ConfirmarEmail from './pages/ConfirmarEmail';
import EditaisAbertos from './pages/EditaisAbertos';
import Portfolio from './pages/Portfolio';
import { ProtectedRoute } from './components/ProtectedRoute';

const queryClient = new QueryClient();

import { useEffect } from "react";
import { analytics } from "./lib/firebase";
import { logEvent } from "firebase/analytics";

function AnalyticsListener() {
  const location = useLocation();
  useEffect(() => {
    // Firebase Analytics
    if (analytics) {
      logEvent(analytics, 'page_view', {
        page_path: location.pathname + location.search,
      });
    }

    // Ensure dataLayer exists for GTM
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer || [];
    }
  }, [location]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GoogleTagManager />
      <Toaster />
      <Sonner />
      <EnvDebug />
      <BrowserRouter>
        <AnalyticsListener />
        <GoogleTagManagerRouteTracker />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/cadastro" element={<Cadastro />} />
          {/* COMENTADO: Rota de confirmação de email */}
          {/* <Route path="/confirmar-email" element={<ConfirmarEmail />} /> */}
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/oraculo-ai" element={<ProtectedRoute><OraculoAI /></ProtectedRoute>} />
          <Route path="/biblioteca" element={<ProtectedRoute><Biblioteca /></ProtectedRoute>} />
          <Route path="/podcast" element={<Podcast />} />
          <Route path="/inteligencia-mercado" element={<InteligenciaMercado />} />
          <Route path="/editais-abertos" element={<EditaisAbertos />} />
          <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
          <Route path="/infograficos" element={<ProtectedRoute><Infograficos /></ProtectedRoute>} />
          <Route path="/conta" element={<ProtectedRoute><Conta /></ProtectedRoute>} />
          <Route path="/suporte" element={<Suporte />} />
          <Route path="/cadastro-premium" element={<CadastroPremium />} />
          <Route path="/contato-premium" element={<ProtectedRoute><ContatoPremium /></ProtectedRoute>} />
          <Route path="/gerenciar-assinatura" element={<ProtectedRoute><GerenciarAssinatura /></ProtectedRoute>} />
          <Route path="/criar-projeto" element={<ProtectedRoute><CriarProjeto /></ProtectedRoute>} />
          {/* Rotas específicas de projeto devem vir antes da rota genérica /projeto/:id */}
          <Route path="/projeto/:id/alterar-com-ia" element={<ProtectedRoute><AlterarComIA /></ProtectedRoute>} />
          <Route path="/projeto/:id/gerar-textos" element={<ProtectedRoute><GerarTextos /></ProtectedRoute>} />
          <Route path="/projeto/:id/criar-orcamento" element={<ProtectedRoute><CriarOrcamento /></ProtectedRoute>} />
          <Route path="/projeto/:id/criar-cronograma" element={<ProtectedRoute><CriarCronograma /></ProtectedRoute>} />
          <Route path="/projeto/:id/documentos-inscricao" element={<ProtectedRoute><DocumentosInscricao /></ProtectedRoute>} />
          <Route path="/projeto/:id/preencher-anexos" element={<ProtectedRoute><PreencherAnexos /></ProtectedRoute>} />
          <Route path="/projeto/:id/resumo" element={<ProtectedRoute><ResumoProjeto /></ProtectedRoute>} />
          <Route path="/projeto/:id" element={<ProtectedRoute><Projeto /></ProtectedRoute>} />
          <Route path="/editar-edital/:id" element={<ProtectedRoute><EditarEdital /></ProtectedRoute>} />
          <Route path="/edital/:id" element={<DetalhesEdital />} />
          <Route path="/cadastrar-episodio" element={<ProtectedRoute><CadastrarEpisodio /></ProtectedRoute>} />
          <Route path="/editar-episodio/:id" element={<ProtectedRoute><EditarEpisodio /></ProtectedRoute>} />
          <Route path="/podcast/:id" element={<PodcastDetalhes />} />
          <Route path="/cadastrar-guia" element={<ProtectedRoute><CadastrarGuia /></ProtectedRoute>} />
          <Route path="/editar-guia/:id" element={<ProtectedRoute><EditarGuia /></ProtectedRoute>} />
          <Route path="/guia-especial/:id" element={<DetalhesGuiaEspecial />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
