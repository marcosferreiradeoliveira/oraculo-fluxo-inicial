
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EnvDebug } from "./components/EnvDebug";
import GoogleTagManager from "./components/GoogleTagManager";
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
import PodcastDetalhes from './pages/PodcastDetalhes';
import CadastrarGuia from './pages/CadastrarGuia';
import CadastroPremium from './pages/CadastroPremium';
import GerarTextos from './pages/GerarTextos';

const queryClient = new QueryClient();

import { useEffect } from "react";
import { analytics } from "./lib/firebase";
import { logEvent } from "firebase/analytics";

function AnalyticsListener() {
  const location = useLocation();
  useEffect(() => {
    if (analytics) {
      logEvent(analytics, 'page_view', {
        page_path: location.pathname + location.search,
      });
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
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/oraculo-ai" element={<OraculoAI />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/podcast" element={<Podcast />} />
          <Route path="/infograficos" element={<Infograficos />} />
          <Route path="/conta" element={<Conta />} />
          <Route path="/suporte" element={<Suporte />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/cadastro-premium" element={<CadastroPremium />} />
          <Route path="/criar-projeto" element={<CriarProjeto />} />
          <Route path="/projeto/:id" element={<Projeto />} />
          <Route path="/projeto/:id/alterar-com-ia" element={<AlterarComIA />} />
          <Route path="/projeto/:id/gerar-textos" element={<GerarTextos />} />
          <Route path="/editar-edital/:id" element={<EditarEdital />} />
          <Route path="/cadastrar-episodio" element={<CadastrarEpisodio />} />
          <Route path="/podcast/:id" element={<PodcastDetalhes />} />
          <Route path="/cadastrar-guia" element={<CadastrarGuia />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
