// src/lib/analytics.ts
// Sistema centralizado de tracking de eventos para análise de negócio

import { analytics } from './firebase';
import { logEvent } from 'firebase/analytics';

declare global {
  interface Window {
    dataLayer: any[];
    mixpanel: any;
  }
}

/**
 * Função utilitária para enviar eventos tanto para Firebase Analytics quanto para GTM e Mixpanel
 */
const trackEvent = (eventName: string, eventParams: Record<string, any> = {}) => {
  // Firebase Analytics
  if (analytics) {
    try {
      logEvent(analytics, eventName, eventParams);
    } catch (error) {
      console.error(`[Analytics] Erro ao enviar evento ${eventName}:`, error);
    }
  }

  // Google Tag Manager (dataLayer)
  if (typeof window !== 'undefined' && window.dataLayer) {
    try {
      window.dataLayer.push({
        event: eventName,
        ...eventParams,
        page_path: window.location.pathname + window.location.search,
        page_title: document.title || 'Oráculo Cultural',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[GTM] Erro ao enviar evento ${eventName}:`, error);
    }
  }

  // Mixpanel
  if (typeof window !== 'undefined' && window.mixpanel) {
    try {
      window.mixpanel.track(eventName, {
        ...eventParams,
        page_path: window.location.pathname + window.location.search,
        page_title: document.title || 'Oráculo Cultural',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[Mixpanel] Erro ao enviar evento ${eventName}:`, error);
    }
  }
};

// ==========================================
// EVENTOS DE PROJETOS
// ==========================================

/**
 * Projeto criado
 */
export const trackProjectCreated = (params: {
  projectId?: string;
  projectName?: string;
  hasEdital?: boolean;
  editalId?: string;
  planType?: string;
}) => {
  trackEvent('project_created', {
    project_id: params.projectId,
    project_name: params.projectName,
    has_edital: params.hasEdital,
    edital_id: params.editalId,
    plan_type: params.planType,
  });
};

/**
 * Projeto visualizado
 */
export const trackProjectViewed = (params: {
  projectId: string;
  hasAnalysis?: boolean;
  hasTexts?: boolean;
  planType?: string;
}) => {
  trackEvent('project_viewed', {
    project_id: params.projectId,
    has_analysis: params.hasAnalysis,
    has_texts: params.hasTexts,
    plan_type: params.planType,
  });
};

/**
 * Projeto excluído
 */
export const trackProjectDeleted = (params: {
  projectId: string;
  projectName?: string;
  hadAnalysis?: boolean;
}) => {
  trackEvent('project_deleted', {
    project_id: params.projectId,
    project_name: params.projectName,
    had_analysis: params.hadAnalysis,
  });
};

// ==========================================
// EVENTOS DE ANÁLISE COM IA
// ==========================================

/**
 * Início de análise com IA
 */
export const trackAnalysisStarted = (params: {
  projectId: string;
  planType?: string;
  isFirstAnalysis?: boolean;
}) => {
  trackEvent('analysis_started', {
    project_id: params.projectId,
    plan_type: params.planType,
    is_first_analysis: params.isFirstAnalysis,
  });
};

/**
 * Análise com IA concluída com sucesso
 * 🔴 CRÍTICO: Core value - IA funciona?
 */
export const trackAnalysisCompleted = (params: {
  projectId: string;
  durationSeconds?: number;
  hasSuggestions?: boolean;
  suggestionsCount?: number;
  planType?: string;
}) => {
  // Evento original
  trackEvent('analysis_completed', {
    project_id: params.projectId,
    duration_seconds: params.durationSeconds,
    has_suggestions: params.hasSuggestions,
    suggestions_count: params.suggestionsCount,
    plan_type: params.planType,
  });
  
  // Evento crítico renomeado conforme especificação
  trackEvent('projeto_ia_analise_completa', {
    projeto_id: params.projectId,
    tempo_processamento: params.durationSeconds,
    tem_sugestoes: params.hasSuggestions,
    quantidade_sugestoes: params.suggestionsCount,
    tipo_plano: params.planType,
  });
};

/**
 * Análise com IA falhou
 */
export const trackAnalysisFailed = (params: {
  projectId: string;
  error?: string;
  planType?: string;
}) => {
  trackEvent('analysis_failed', {
    project_id: params.projectId,
    error: params.error,
    plan_type: params.planType,
  });
};

/**
 * Sugestão de melhoria aplicada
 * 🟠 ALTA: Retenção - usuário vê valor
 */
export const trackSuggestionApplied = (params: {
  projectId: string;
  suggestionIndex: number;
  suggestionText?: string;
  planType?: string;
  tipoSugestao?: string; // "justificativa" | "objetivos" | "metodologia"
}) => {
  // Evento original
  trackEvent('suggestion_applied', {
    project_id: params.projectId,
    suggestion_index: params.suggestionIndex,
    suggestion_length: params.suggestionText?.length || 0,
    plan_type: params.planType,
  });
  
  // Evento de alta prioridade renomeado conforme especificação
  trackEvent('projeto_sugestao_aplicada', {
    projeto_id: params.projectId,
    tipo_sugestao: params.tipoSugestao,
    quantidade_sugestoes_aplicadas: 1, // Incrementar se aplicando múltiplas
    tipo_plano: params.planType,
  });
};

// ==========================================
// EVENTOS DE GERAÇÃO DE TEXTOS
// ==========================================

/**
 * Geração de texto iniciada
 */
export const trackTextGenerationStarted = (params: {
  projectId: string;
  textType?: string; // 'justificativa', 'objetivos', 'cronograma', etc
  planType?: string;
}) => {
  trackEvent('text_generation_started', {
    project_id: params.projectId,
    text_type: params.textType,
    plan_type: params.planType,
  });
};

/**
 * Geração de texto concluída
 */
export const trackTextGenerationCompleted = (params: {
  projectId: string;
  textType?: string;
  durationSeconds?: number;
  textLength?: number;
  planType?: string;
}) => {
  trackEvent('text_generation_completed', {
    project_id: params.projectId,
    text_type: params.textType,
    duration_seconds: params.durationSeconds,
    text_length: params.textLength,
    plan_type: params.planType,
  });
};

// ==========================================
// EVENTOS DE ASSINATURA/PREMIUM
// ==========================================

/**
 * Página de planos visualizada
 */
export const trackPricingViewed = (params: {
  source?: string; // 'upgrade_prompt', 'menu', 'home', etc
  currentPlan?: string;
}) => {
  trackEvent('pricing_viewed', {
    source: params.source,
    current_plan: params.currentPlan,
  });
};

/**
 * Início do processo de assinatura
 */
export const trackSubscriptionStarted = (params: {
  planType: string;
  isAnnual?: boolean;
  planPrice?: number;
  source?: string;
}) => {
  trackEvent('subscription_started', {
    plan_type: params.planType,
    is_annual: params.isAnnual,
    plan_price: params.planPrice,
    source: params.source,
  });
};

/**
 * Assinatura concluída (conversão)
 * 🔴 CRÍTICO: Receita direta
 */
export const trackSubscriptionCompleted = (params: {
  planType: string;
  isAnnual?: boolean;
  planPrice?: number;
  transactionId?: string;
}) => {
  // Evento original
  trackEvent('subscription_completed', {
    plan_type: params.planType,
    is_annual: params.isAnnual,
    plan_price: params.planPrice,
    transaction_id: params.transactionId,
    value: params.planPrice, // Para análise de receita
    currency: 'BRL',
  });
  
  // Evento crítico renomeado conforme especificação
  trackEvent('premium_pagamento_sucesso', {
    tipo_plano: params.planType,
    valor_plano: params.planPrice,
    duracao_plano: params.isAnnual ? 'anual' : 'mensal',
    transaction_id: params.transactionId,
    value: params.planPrice,
    currency: 'BRL',
  });
};

/**
 * Cancelamento de assinatura
 */
export const trackSubscriptionCancelled = (params: {
  planType: string;
  reason?: string;
}) => {
  trackEvent('subscription_cancelled', {
    plan_type: params.planType,
    reason: params.reason,
  });
};

// ==========================================
// EVENTOS DE PORTFOLIO
// ==========================================

/**
 * Item de portfolio adicionado
 */
export const trackPortfolioItemAdded = (params: {
  hasPhoto?: boolean;
  hasClipping?: boolean;
  extractionMethod?: 'manual' | 'ai';
}) => {
  trackEvent('portfolio_item_added', {
    has_photo: params.hasPhoto,
    has_clipping: params.hasClipping,
    extraction_method: params.extractionMethod,
  });
};

/**
 * Extração com IA do portfolio iniciada
 */
export const trackPortfolioExtractionStarted = () => {
  trackEvent('portfolio_extraction_started', {});
};

/**
 * Extração com IA do portfolio concluída
 */
export const trackPortfolioExtractionCompleted = (params: {
  success: boolean;
  extractedFields?: string[];
}) => {
  trackEvent('portfolio_extraction_completed', {
    success: params.success,
    extracted_fields: params.extractedFields?.join(',') || '',
  });
};

// ==========================================
// EVENTOS DE NEWSLETTER/MARKETING
// ==========================================

/**
 * Inscrição na newsletter
 * 🟠 ALTA: Lista de emails
 */
export const trackNewsletterSubscribed = (params: {
  source: string; // 'home', 'editais_abertos_page', etc
  email?: string;
  isLoggedIn?: boolean;
}) => {
  // Evento original
  trackEvent('newsletter_subscribed', {
    source: params.source,
    is_logged_in: params.isLoggedIn,
  });
  
  // Evento de alta prioridade renomeado conforme especificação
  trackEvent('email_edital_cadastro', {
    origem_conversao: params.source,
    is_logged_in: params.isLoggedIn,
    // email: masked (não enviar email completo por privacidade)
  });
};

// ==========================================
// EVENTOS DE NAVEGAÇÃO
// ==========================================

/**
 * Edital visualizado
 * 🔴 CRÍTICO: Engajamento com oferta
 */
export const trackEditalViewed = (params: {
  editalId: string;
  editalName?: string;
  editalOrgao?: string; // FUNARTE, RioFilme, Cattalini, AMBEV, etc
  valorEdital?: string;
  dataEncerramento?: string | Date;
}) => {
  // Evento original
  trackEvent('edital_viewed', {
    edital_id: params.editalId,
    edital_name: params.editalName,
  });
  
  // Evento crítico renomeado conforme especificação
  trackEvent('edital_visualizar_detalhes', {
    edital_id: params.editalId,
    edital_nome: params.editalName,
    edital_orgao: params.editalOrgao,
    valor_edital: params.valorEdital,
    data_encerramento: params.dataEncerramento ? 
      (typeof params.dataEncerramento === 'string' ? params.dataEncerramento : params.dataEncerramento.toISOString()) : 
      undefined,
  });
};

/**
 * Link externo clicado
 */
export const trackExternalLinkClicked = (params: {
  url: string;
  linkText?: string;
  source?: string;
}) => {
  trackEvent('external_link_clicked', {
    link_url: params.url,
    link_text: params.linkText,
    source: params.source,
  });
};

/**
 * Clique no menu de navegação
 */
export const trackMenuClick = (params: {
  section: string; // "Início" | "Meus Projetos" | "Editais Abertos" | etc
  url: string;
}) => {
  trackEvent('evento_menu_click', {
    section: params.section,
    url: params.url,
  });
};

// ==========================================
// EVENTOS DE ENGAGEMENT
// ==========================================

/**
 * Funcionalidade específica acessada
 */
export const trackFeatureAccessed = (params: {
  featureName: string;
  featureType?: string;
}) => {
  trackEvent('feature_accessed', {
    feature_name: params.featureName,
    feature_type: params.featureType,
  });
};

/**
 * Busca realizada
 */
export const trackSearchPerformed = (params: {
  searchTerm: string;
  resultsCount?: number;
  source?: string;
}) => {
  trackEvent('search_performed', {
    search_term: params.searchTerm,
    results_count: params.resultsCount,
    source: params.source,
  });
};

// ==========================================
// EVENTOS DE GUIAS E CONTEÚDO
// ==========================================

/**
 * Guia baixado
 * 🟠 ALTA: Qualificação de lead
 */
export const trackGuiaDownloaded = (params: {
  guiaNome: string; // "PNAB" | "RioFilme" | "Aldir_Blanc"
  tamanhoArquivo?: number;
  conversaoTipo?: string; // "lead" se email foi capturado antes
}) => {
  trackEvent('guia_baixado', {
    guia_nome: params.guiaNome,
    tamanho_arquivo: params.tamanhoArquivo,
    conversao_tipo: params.conversaoTipo,
  });
};

/**
 * Guia visualizado
 */
export const trackGuiaViewed = (params: {
  guiaNome: string;
}) => {
  trackEvent('guia_visualizado', {
    guia: params.guiaNome,
  });
};

// ==========================================
// EVENTOS DE AUTENTICAÇÃO
// ==========================================

/**
 * Login bem-sucedido
 * 🟡 MÉDIA: Funnel básico
 */
export const trackLoginSuccess = (params: {
  tipoLogin: 'email' | 'social';
}) => {
  trackEvent('login_sucesso', {
    tipo_login: params.tipoLogin,
  });
};

/**
 * Logout do usuário
 * 🔵 BAIXA: Informativo
 */
export const trackLogout = () => {
  trackEvent('logout_usuario', {});
  
  // Mixpanel: Reset user identification on logout
  if (typeof window !== 'undefined' && window.mixpanel) {
    try {
      window.mixpanel.reset();
    } catch (error) {
      console.error('[Mixpanel] Erro ao resetar usuário:', error);
    }
  }
};

// ==========================================
// IDENTIFICAÇÃO DE USUÁRIOS (Mixpanel)
// ==========================================

/**
 * Identifica um usuário no Mixpanel
 * Deve ser chamado quando o usuário faz login ou quando o estado de autenticação muda
 */
export const identifyMixpanelUser = (userId: string, userProperties?: {
  email?: string;
  name?: string;
  planType?: string;
  isPremium?: boolean;
  [key: string]: any;
}) => {
  if (typeof window !== 'undefined' && window.mixpanel) {
    try {
      // Identificar o usuário
      window.mixpanel.identify(userId);
      
      // Adicionar propriedades ao perfil do usuário
      if (userProperties) {
        window.mixpanel.people.set({
          $email: userProperties.email,
          $name: userProperties.name,
          planType: userProperties.planType,
          isPremium: userProperties.isPremium,
          ...userProperties,
        });
      }
      
      console.log('[Mixpanel] Usuário identificado:', userId);
    } catch (error) {
      console.error('[Mixpanel] Erro ao identificar usuário:', error);
    }
  }
};
