import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Loader2, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { EditalLandingConfig } from '@/lib/editalLandingPages';
import { DEMO_MODULO1, executarAvaliacaoDemonstracao, PROJETO_EXEMPLO } from '@/lib/projetoDemonstracao';
import { persistEditalLandingDemoSession } from '@/lib/avaliarProjetoDemoSession';
import { stashRemarketingLandingMeta, syncEditalRemarketingToBrevo } from '@/lib/brevoRemarketing';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'lead' | 'descricao' | 'analisando' | 'preview';

type EnginePersist = {
  step: Step;
  nomeProjeto: string;
  email: string;
  descricao: string;
};

function storageKey(slug: string) {
  return `edital_landing_engine_${slug}`;
}

type Props = {
  config: EditalLandingConfig;
  editalSlug: string;
};

export function EditalLandingEvalEngine({ config, editalSlug }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('lead');
  const [nomeProjeto, setNomeProjeto] = useState('');
  const [email, setEmail] = useState('');
  const [descricao, setDescricao] = useState('');
  const [statusIA, setStatusIA] = useState('');
  const [subEtapas, setSubEtapas] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(editalSlug));
      if (!raw) return;
      const p = JSON.parse(raw) as EnginePersist;
      if (p.nomeProjeto) setNomeProjeto(p.nomeProjeto);
      if (p.email) setEmail(p.email);
      if (p.descricao) setDescricao(p.descricao);
      if (p.step === 'preview') setStep('preview');
    } catch {
      /* ignore */
    }
  }, [editalSlug]);

  const persistEngine = useCallback(
    (patch: Partial<EnginePersist>) => {
      const next: EnginePersist = {
        step,
        nomeProjeto,
        email,
        descricao,
        ...patch,
      };
      sessionStorage.setItem(storageKey(editalSlug), JSON.stringify(next));
    },
    [step, nomeProjeto, email, descricao, editalSlug]
  );

  const avancarLead = () => {
    const nome = nomeProjeto.trim();
    const mail = email.trim().toLowerCase();
    if (!nome) {
      toast.error('Informe o nome do seu projeto.');
      return;
    }
    if (!mail || !EMAIL_REGEX.test(mail)) {
      toast.error('Informe um e-mail válido.');
      return;
    }
    setStep('descricao');
    persistEngine({ step: 'descricao', nomeProjeto: nome, email: mail });
    stashRemarketingLandingMeta(editalSlug, config.dataEncerramentoIso);
    syncEditalRemarketingToBrevo({
      email: mail,
      funil: 'lead_capturado',
      editalTitulo: config.titulo,
      editalSlug,
      dataEncerramentoIso: config.dataEncerramentoIso,
      nomeProjeto: nome,
    });
  };

  const gerarAnalise = async () => {
    const texto = descricao.trim();
    if (texto.length < 80) {
      toast.error('Descreva o projeto com pelo menos 80 caracteres.');
      return;
    }
    setStep('analisando');
    setStatusIA('O Oráculo está consultando as musas...');
    setSubEtapas(['Cruzando critérios do edital...']);
    persistEngine({ step: 'analisando', descricao: texto });

    await executarAvaliacaoDemonstracao({
      setStatus: setStatusIA,
      setSubEtapas,
      setConteudo: () => {},
    });

    persistEditalLandingDemoSession({
      nome: nomeProjeto.trim(),
      descricao: texto,
      email: email.trim().toLowerCase(),
      landingSlug: editalSlug,
      editalTitulo: config.titulo,
      editalId: config.firestoreEditalId ?? null,
      editalNomeParam: config.editalNomeParam,
      dataEncerramentoIso: config.dataEncerramentoIso,
    });

    setStep('preview');
    persistEngine({ step: 'preview' });
    syncEditalRemarketingToBrevo({
      email: email.trim().toLowerCase(),
      funil: 'analise_preview',
      editalTitulo: config.titulo,
      editalSlug,
      dataEncerramentoIso: config.dataEncerramentoIso,
      nomeProjeto: nomeProjeto.trim(),
    });
  };

  const irCadastroVerResto = () => {
    const mail = email.trim().toLowerCase();
    persistEditalLandingDemoSession({
      nome: nomeProjeto.trim(),
      descricao: descricao.trim(),
      email: mail,
      landingSlug: editalSlug,
      editalTitulo: config.titulo,
      editalId: config.firestoreEditalId ?? null,
      editalNomeParam: config.editalNomeParam,
      dataEncerramentoIso: config.dataEncerramentoIso,
    });
    syncEditalRemarketingToBrevo({
      email: mail,
      funil: 'cadastro_pendente',
      editalTitulo: config.titulo,
      editalSlug,
      dataEncerramentoIso: config.dataEncerramentoIso,
      nomeProjeto: nomeProjeto.trim(),
    });
    const redirect = encodeURIComponent('/avaliar-projeto?resumeLanding=1');
    navigate(`/cadastro?redirect=${redirect}&email=${encodeURIComponent(mail)}`);
  };

  const m = DEMO_MODULO1;
  const pctTotal = Math.round((m.notaTotal.obtida / m.notaTotal.maxima) * 100);
  const primeiroCriterio = m.criteriosMatriz[0];
  const resumoExibir =
    descricao.trim().length > 0
      ? descricao.trim().slice(0, 420) + (descricao.length > 420 ? '…' : '')
      : m.resumoProjeto;

  return (
    <div className="rounded-2xl bg-zinc-900 text-white p-6 md:p-8 shadow-2xl ring-1 ring-zinc-700 min-h-[320px]">
      {step === 'lead' && (
        <>
          <Badge className="bg-yellow-400 text-zinc-950 hover:bg-yellow-400 font-bold mb-4">
            ⚡ TESTE GRÁTIS — MÓDULO 1
          </Badge>
          <h2 className="text-xl md:text-2xl font-bold leading-snug">{config.cardTitulo}</h2>
          <p className="text-sm text-zinc-300 mt-2 leading-relaxed">{config.cardSubtitulo}</p>
          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="nome-projeto" className="text-sm font-medium text-zinc-200 block mb-1.5">
                Qual é o nome do seu projeto?
              </label>
              <Input
                id="nome-projeto"
                value={nomeProjeto}
                onChange={(e) => setNomeProjeto(e.target.value)}
                placeholder="Ex.: Festival Brasilidades na Praça"
                className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label htmlFor="email-landing" className="text-sm font-medium text-zinc-200 block mb-1.5">
                Seu e-mail para receber a análise
              </label>
              <Input
                id="email-landing"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@gmail.com"
                className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
              />
            </div>
            <Button
              type="button"
              onClick={avancarLead}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-black py-6 rounded-xl text-base md:text-lg shadow-xl border-0"
            >
              ⚡ SIMULAR MINHA NOTA NESTE EDITAL
            </Button>
          </div>
          <p className="text-xs text-zinc-400 mt-4 flex items-start gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
            Seus projetos são 100% confidenciais. Não utilizados para treino público.
          </p>
        </>
      )}

      {step === 'descricao' && (
        <>
          <button
            type="button"
            onClick={() => setStep('lead')}
            className="text-sm text-zinc-400 hover:text-white flex items-center gap-1 mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <p className="text-xs uppercase tracking-wide text-yellow-400 font-semibold mb-1">Passo 2 de 3</p>
          <h2 className="text-xl font-bold">Conte sobre o projeto</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Projeto: <span className="text-zinc-200 font-medium">{nomeProjeto}</span>
          </p>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={8}
            placeholder={PROJETO_EXEMPLO.descricao.slice(0, 280) + '…'}
            className="mt-4 w-full rounded-xl bg-zinc-800 border border-zinc-600 text-white text-sm p-3 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
          />
          <p className="text-xs text-zinc-500 mt-1">{descricao.trim().length} caracteres (mín. 80)</p>
          <Button
            type="button"
            onClick={() => void gerarAnalise()}
            className="w-full mt-4 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-black py-5 rounded-xl border-0"
          >
            Gerar análise do Oráculo
          </Button>
        </>
      )}

      {step === 'analisando' && (
        <div className="py-8 flex flex-col items-center text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
            <Brain className="h-8 w-8 text-yellow-400 animate-pulse" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
          <p className="font-medium text-zinc-100">{statusIA || 'Analisando...'}</p>
          <ul className="text-xs text-zinc-400 space-y-1">
            {subEtapas.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {step === 'preview' && (
        <>
          <p className="text-xs uppercase tracking-wide text-emerald-400 font-semibold mb-2">Prévia da avaliação</p>
          <div className="rounded-xl bg-zinc-800/80 border border-zinc-700 p-4 space-y-4 text-left">
            <div>
              <p className="text-[10px] uppercase text-zinc-500 font-semibold">Seu projeto</p>
              <p className="text-sm text-zinc-200 leading-relaxed mt-1">{resumoExibir}</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/30 p-4 text-center">
              <p className="text-xs text-purple-200 uppercase font-semibold">Nota total estimada</p>
              <p className="text-4xl font-black text-white tabular-nums mt-1">{m.notaTotal.rotulo}</p>
              <div className="mt-2 h-2 bg-zinc-700 rounded-full overflow-hidden max-w-xs mx-auto">
                <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500" style={{ width: `${pctTotal}%` }} />
              </div>
            </div>
            {primeiroCriterio ? (
              <div className="rounded-lg border border-zinc-600 p-3">
                <p className="text-xs font-semibold text-zinc-300">{primeiroCriterio.titulo}</p>
                <p className="text-sm text-zinc-400 mt-2 line-clamp-3">{primeiroCriterio.analise}</p>
                <p className="text-sm font-bold text-purple-300 mt-2">{primeiroCriterio.pontuacao}</p>
              </div>
            ) : null}
            <div className="relative rounded-lg border border-dashed border-zinc-600 p-4 overflow-hidden">
              <div className="blur-sm select-none opacity-60 text-sm text-zinc-400 space-y-2 pointer-events-none">
                <p>Critérios 2 a 4, matriz completa, sugestões de melhoria e texto otimizado…</p>
                <p>{m.sugestoesMelhoria[0]?.slice(0, 120)}…</p>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/70 gap-2 p-4">
                <Lock className="h-6 w-6 text-yellow-400" />
                <p className="text-sm font-semibold text-center">Crie sua conta grátis para ver a análise completa</p>
              </div>
            </div>
          </div>
          <Button
            type="button"
            onClick={irCadastroVerResto}
            className="w-full mt-5 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-black py-5 rounded-xl border-0"
          >
            ⚡ CRIAR CONTA E VER ANÁLISE COMPLETA
          </Button>
          <p className="text-xs text-zinc-500 mt-3 text-center">
            Seus dados do projeto ficam salvos — você continua de onde parou após o cadastro.
          </p>
        </>
      )}
    </div>
  );
}
