import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { countdownDias, formatEncerramentoDisplay, type EditalLandingConfig } from '@/lib/editalLandingPages';
import { resolveEditalLandingConfig } from '@/lib/editalLandingFirestore';
import {
  stashRemarketingLandingMeta,
  syncEditalRemarketingToBrevo,
} from '@/lib/brevoRemarketing';
import NotFound from './NotFound';
import { Calendar, DollarSign, Download, Lock, Sparkles, Check, ArrowRight, Loader2 } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EditalLandingPage() {
  const { editalSlug } = useParams<{ editalSlug: string }>();
  const navigate = useNavigate();
  const captureRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState<EditalLandingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nomeProjeto, setNomeProjeto] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!editalSlug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    resolveEditalLandingConfig(editalSlug)
      .then((resolved) => {
        if (cancelled) return;
        if (!resolved) {
          setNotFound(true);
          setConfig(null);
        } else {
          setConfig(resolved);
          if (editalSlug) {
            stashRemarketingLandingMeta(editalSlug, resolved.dataEncerramentoIso);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editalSlug]);

  const dias = useMemo(
    () => (config ? countdownDias(config.dataEncerramentoIso) : 0),
    [config?.dataEncerramentoIso]
  );

  useEffect(() => {
    if (config) document.title = `${config.titulo} | Oráculo Cultural`;
  }, [config]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Carregando" />
      </div>
    );
  }

  if (notFound || !config) {
    return <NotFound />;
  }

  const irParaSimulacao = (opts?: { scrollOnly?: boolean }) => {
    if (opts?.scrollOnly) {
      captureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
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
    setSubmitting(true);
    sessionStorage.setItem('oraculo_landing_email', mail);
    sessionStorage.setItem('oraculo_landing_nome_projeto', nome);
    if (editalSlug) {
      stashRemarketingLandingMeta(editalSlug, config.dataEncerramentoIso);
    }
    syncEditalRemarketingToBrevo({
      email: mail,
      funil: 'lead_capturado',
      editalTitulo: config.titulo,
      editalSlug: editalSlug || config.editalNomeParam,
      dataEncerramentoIso: config.dataEncerramentoIso,
      nomeContato: null,
      nomeProjeto: nome,
    });
    const params = new URLSearchParams();
    params.set('nome', nome);
    params.set('email', mail);
    params.set('editalNome', config.editalNomeParam);
    if (config.firestoreEditalId) params.set('edital', config.firestoreEditalId);
    params.set('iniciar', '1');
    navigate(`/avaliar-projeto?${params.toString()}`);
  };

  const pdfHref = config.pdfUrl || config.linkEdital;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-zinc-900 font-sans antialiased">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="Oráculo Cultural" className="h-9 w-auto" />
          </Link>
          <Badge
            variant="outline"
            className="justify-center border-red-200 bg-red-50 text-red-600 font-semibold text-xs sm:text-sm py-1.5 px-3"
          >
            ⏳ {dias} {dias === 1 ? 'dia restante' : 'dias restantes'} para a inscrição
          </Badge>
          <Button variant="outline" className="border-zinc-300 shrink-0" asChild>
            <Link to="/cadastro?mode=login">Fazer Login / Entrar</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-14 md:space-y-16">
        <section className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-start">
          <div className="space-y-6">
            <p className="text-xs font-bold tracking-widest text-primary uppercase">{config.kicker}</p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-zinc-900 leading-tight">
              {config.titulo}
            </h1>
            <p className="text-sm md:text-base font-semibold text-zinc-600">{config.proponente}</p>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <Calendar className="h-5 w-5 text-purple-600 mb-2" aria-hidden />
                <p className="text-[10px] uppercase font-semibold text-zinc-500">Data de encerramento</p>
                <p className="text-sm font-bold text-zinc-900 mt-1 leading-snug">
                  {formatEncerramentoDisplay(config.dataEncerramentoIso)}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <DollarSign className="h-5 w-5 text-purple-600 mb-2" aria-hidden />
                <p className="text-[10px] uppercase font-semibold text-zinc-500">Valor global</p>
                <p className="text-sm font-bold text-zinc-900 mt-1 leading-snug">{config.valorGlobal}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm flex flex-col">
                <Download className="h-5 w-5 text-purple-600 mb-2" aria-hidden />
                <p className="text-[10px] uppercase font-semibold text-zinc-500">Edital oficial</p>
                {pdfHref ? (
                  <a
                    href={pdfHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-primary hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    ⬇️ Baixar PDF do Edital
                  </a>
                ) : (
                  <span className="text-sm text-zinc-500 mt-1">Consulte o site do proponente</span>
                )}
              </div>
            </div>

            <p className="text-base text-zinc-700 leading-relaxed italic border-l-4 border-primary pl-4">
              {config.resumoEscopo}
            </p>
          </div>

          <div ref={captureRef} className="rounded-2xl bg-zinc-900 text-white p-6 md:p-8 shadow-2xl ring-1 ring-zinc-700">
            <Badge className="bg-yellow-400 text-zinc-950 hover:bg-yellow-400 font-bold mb-4">
              ⚡ TESTE GRÁTIS — MÓDULO 1
            </Badge>
            <h2 className="text-xl md:text-2xl font-bold leading-snug">{config.cardTitulo}</h2>
            <p className="text-sm text-zinc-300 mt-2 leading-relaxed">{config.cardSubtitulo}</p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                irParaSimulacao();
              }}
            >
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
                type="submit"
                disabled={submitting}
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-black py-6 rounded-xl text-base md:text-lg shadow-xl border-0"
              >
                ⚡ SIMULAR MINHA NOTA NESTE EDITAL (15 CRÉDITOS GRÁTIS)
              </Button>
            </form>
            <p className="text-xs text-zinc-400 mt-4 flex items-start gap-2">
              <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
              Seus projetos são 100% confidenciais. Não utilizados para treino público.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm space-y-4">
          <h2 className="text-xl md:text-2xl font-bold text-zinc-900">Matriz de critérios de avaliação</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {config.criterios.map((c) => (
              <div
                key={c.nome}
                className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3"
              >
                <span className="text-sm font-medium text-zinc-800">{c.nome}</span>
                <Badge variant="secondary" className="bg-purple-100 text-purple-800 shrink-0">
                  {c.peso}
                </Badge>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-primary text-primary hover:bg-primary/5"
            onClick={() => irParaSimulacao({ scrollOnly: true })}
          >
            🤖 Formatar meu projeto conforme estes critérios
          </Button>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold">Categorias aceitas</h2>
            <div className="flex flex-wrap gap-2">
              {config.categorias.map((cat) => (
                <Badge key={cat} variant="outline" className="border-zinc-300 text-zinc-800">
                  {cat}
                </Badge>
              ))}
            </div>
            <h3 className="text-sm font-bold text-zinc-900 pt-2">Textos exigidos</h3>
            <ul className="space-y-2">
              {config.textosExigidos.map((t) => (
                <li key={t} className="flex gap-2 text-sm text-zinc-700">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold">Checklist de documentação</h2>
            <ul className="space-y-2">
              {config.documentacao.map((d) => (
                <li key={d} className="flex gap-2 text-sm text-zinc-700">
                  <Check className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {config.thumbnailUrl ? (
          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="aspect-[21/9] md:aspect-[2.4/1] bg-zinc-100">
              <img
                src={config.thumbnailUrl}
                alt={`Ilustração do edital ${config.titulo}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <p className="px-4 py-3 text-xs text-zinc-500 text-center md:text-left">
              Imagem ilustrativa do edital — mesma capa exibida em Editais Abertos.
            </p>
          </section>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            O espelho da nota — antes de enviar
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 md:p-6">
              <p className="text-xs font-bold uppercase text-amber-800 mb-2">Texto original do proponente</p>
              <p className="text-3xl font-black text-amber-900 tabular-nums mb-3">
                Nota {config.demoIA.notaOriginal.toFixed(1)}
              </p>
              <p className="text-sm text-amber-950 leading-relaxed">{config.demoIA.textoOriginal}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 md:p-6">
              <p className="text-xs font-bold uppercase text-emerald-800 mb-2">Sugestão otimizada — Oráculo IA</p>
              <p className="text-3xl font-black text-emerald-900 tabular-nums mb-3">
                Nota {config.demoIA.notaOtimizada.toFixed(1)}
              </p>
              <p className="text-sm text-emerald-950 leading-relaxed">{config.demoIA.textoOtimizado}</p>
              <p className="text-xs font-semibold text-emerald-800 mt-3">
                Encaixe reforçado em: {config.demoIA.criterioDestaque}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl gradient-primary text-white p-8 md:p-10 text-center space-y-5 shadow-xl">
          <h2 className="text-2xl md:text-3xl font-bold max-w-2xl mx-auto leading-snug">
            Não corra o risco de ter seu projeto reprovado por vício de forma.
          </h2>
          <Button
            type="button"
            onClick={() => irParaSimulacao()}
            className="bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-black py-6 px-8 rounded-xl text-base md:text-lg shadow-xl border-0 inline-flex items-center gap-2"
          >
            ⚡ SIMULAR MEU PROJETO NESTE EDITAL AGORA
            <ArrowRight className="h-5 w-5" />
          </Button>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Oráculo Cultural ·{' '}
        <Link to="/privacidade" className="underline hover:text-zinc-700">
          Privacidade
        </Link>
      </footer>
    </div>
  );
}
