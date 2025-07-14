
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import OraculoAI from "./pages/OraculoAI";
import Biblioteca from "./pages/Biblioteca";
import Podcast from "./pages/Podcast";
import Infograficos from "./pages/Infograficos";
import Conta from "./pages/Conta";
import Suporte from "./pages/Suporte";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/oraculo-ai" element={<OraculoAI />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/podcast" element={<Podcast />} />
          <Route path="/infograficos" element={<Infograficos />} />
          <Route path="/conta" element={<Conta />} />
          <Route path="/suporte" element={<Suporte />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
