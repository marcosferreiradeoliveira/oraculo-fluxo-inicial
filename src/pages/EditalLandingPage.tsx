import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  buildCriarProjetoFromLandingQuery,
  saveCriarProjetoDraft,
  stashLandingLeadForCriarProjeto,
} from '@/lib/landingToCriarProjeto';
import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { countdownDias, formatEncerramentoDisplay, type EditalLandingConfig } from '@/lib/editalLandingPages';
import { resolveEditalLandingConfig, getEditalLandingPublicUrl } from '@/lib/editalLandingFirestore';
import { applySocialPreviewMeta, resetSocialPreviewMeta } from '@/lib/socialMeta';
import {
  stashRemarketingLandingMeta,
  syncEditalRemarketingToBrevo,
} from '@/lib/brevoRemarketing';
import { EditalLandingPareceristaPreview } from '@/components/home/EditalLandingPareceristaPreview';
import NotFound from './NotFound';
import { Calendar, DollarSign, Download, Lock, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const instituicaoCurta = useMemo(() => {
    if (!config) return 'instituição';
    const p = config.proponente.split('|')[0]?.trim();
    return p || config.titulo;
  }, [config]);

  useEffect(() => {
    if (!config || !editalSlug) return;
    document.title = `${config.titulo} | Oráculo Cultural`;
    const previewImage = config.thumbnailUrl?.trim() || undefined;
    const desc = config.resumoEscopo.slice(0, 200);
    applySocialPreviewMeta({
      title: `${config.titulo} | Oráculo Cultural`,
      description: desc,
      url: getEditalLandingPublicUrl(editalSlug),
      image: previewImage,
    });
    return () => {
      resetSocialPreviewMeta();
    };
  }, [config, editalSlug]);

  const scrollToCapture = () => {
    captureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const irParaSimulacao = () => {
    const nome = nomeProjeto.trim();
    const mail = email.trim().toLowerCase();
    if (!nome) {
      toast.error('Informe o nome do seu projeto.');
      scrollToCapture();
      return;
    }
    if (!mail || !EMAIL_REGEX.test(mail)) {
      toast.error('Informe um e-mail válido.');
      scrollToCapture();
      return;
    }
    if (!config) return;
    setSubmitting(true);
    stashLandingLeadForCriarProjeto(nome, mail);
    saveCriarProjetoDraft({
      nome,
      descricao: '',
      editalAssociado: '',
      editalId: config.firestoreEditalId || undefined,
    });
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
    const criarPath = buildCriarProjetoFromLandingQuery({
      nomeProjeto: nome,
      firestoreEditalId: config.firestoreEditalId,
    });
    navigate(criarPath);
    setSubmitting(false);
  };

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

  const pdfHref = config.pdfUrl || config.linkEdital;
  const cardTitulo =
    config.cardTitulo.includes('banca') || config.cardTitulo.includes('parecerista')
      ? config.cardTitulo
      : `Veja como a banca do ${config.titulo} vai avaliar seu projeto`;
  const cardSubtitulo =
    config.cardSubtitulo.includes('item por item')
      ? config.cardSubtitulo
      : 'Sua proposta analisada item por item contra os critérios oficiais antes do envio final.';

  const urgencyClass =
    dias <= 7
      ? 'border-red-200 bg-red-50 text-red-600'
      : 'border-amber-200 bg-amber-50 text-amber-800';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-zinc-900 font-sans antialiased">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="Oráculo Cultural" className="h-9 w-auto" />
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-14 md:space-y-20">
        {/* A. Hero */}
        <section className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-start">
          <div className="space-y-6">
            <Badge
              variant="outline"
              className={cn('font-semibold text-xs sm:text-sm py-1.5 px-3 w-fit', urgencyClass)}
            >
              ⏳ {dias} {dias === 1 ? 'dia restante' : 'dias restantes'} para a inscrição
            </Badge>

            <div>
              <p className="text-xs font-bold tracking-widest text-primary uppercase mb-2">{config.kicker}</p>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-zinc-900 leading-tight">
                {config.titulo}
              </h1>
              <p className="text-sm md:text-base font-semibold text-zinc-600 mt-3">{config.proponente}</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <InfoCard
                icon={Calendar}
                label="Data de encerramento"
                value={formatEncerramentoDisplay(config.dataEncerramentoIso)}
              />
              <InfoCard icon={DollarSign} label="Valor global" value={config.valorGlobal} />
              <InfoCard
                icon={Download}
                label="Edital oficial"
                value={
                  pdfHref ? (
                    <a
                      href={pdfHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Baixar PDF
                    </a>
                  ) : (
                    <span className="text-sm text-zinc-500">Consulte o proponente</span>
                  )
                }
              />
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-900 mb-2">Resumo do escopo</h2>
              <p className="text-base text-zinc-700 leading-relaxed">{config.resumoEscopo}</p>
            </div>
          </div>

          <div
            ref={captureRef}
            className="rounded-2xl bg-zinc-900 text-white p-6 md:p-8 shadow-2xl ring-1 ring-zinc-700 lg:sticky lg:top-24 scroll-mt-24"
          >
            <h2 className="text-xl md:text-2xl font-bold leading-snug">{cardTitulo}</h2>
            <p className="text-sm text-zinc-300 mt-2 leading-relaxed">{cardSubtitulo}</p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                irParaSimulacao();
              }}
            >
              <div>
                <label htmlFor="nome-projeto" className="text-sm font-medium text-zinc-200 block mb-1.5">
                  Nome do seu projeto ou ideia
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
                  Seu melhor e-mail para receber o relatório
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
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-black py-4 rounded-xl text-base md:text-lg shadow-xl border-0 h-auto"
              >
                ⚡ SIMULAR MINHA NOTA NESTE EDITAL
              </Button>
            </form>
            <p className="text-xs text-zinc-400 mt-4">🔒 Seus projetos são 100% confidenciais. Não utilizados para treino público.</p>
          </div>
        </section>

        {/* B. Raio-X */}
        <section className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
            {config.thumbnailUrl ? (
              <figure className="shrink-0 w-full sm:w-36 md:w-40 rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <div className="aspect-[4/3] sm:aspect-square bg-zinc-50 flex items-center justify-center p-2">
                  <img
                    src={config.thumbnailUrl}
                    alt={`Capa do edital ${config.titulo}`}
                    className="max-w-full max-h-full w-auto h-auto object-contain"
                    loading="lazy"
                  />
                </div>
              </figure>
            ) : null}
            <div className="flex-1 min-w-0 space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 leading-tight">
                Raio-X das exigências do edital
              </h2>
              <p className="text-sm md:text-base text-zinc-600 leading-relaxed">
                Critérios, categorias e requisitos oficiais de{' '}
                <span className="font-semibold text-zinc-800">{config.titulo}</span> — o que a banca
                realmente pontua antes de você enviar.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">Matriz de critérios de avaliação</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-500">
                    <th className="pb-2 font-semibold">Critério</th>
                    <th className="pb-2 font-semibold text-right w-24">Peso</th>
                  </tr>
                </thead>
                <tbody>
                  {config.criterios.map((c) => (
                    <tr key={c.nome} className="border-b border-zinc-100 last:border-0">
                      <td className="py-3 text-zinc-800 font-medium">{c.nome}</td>
                      <td className="py-3 text-right">
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                          {c.peso}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold">Categorias aceitas</h3>
              <div className="flex flex-wrap gap-2">
                {config.categorias.map((cat) => (
                  <Badge key={cat} variant="outline" className="border-zinc-300 text-zinc-800">
                    {cat}
                  </Badge>
                ))}
              </div>
              {config.textosExigidos.length > 0 && (
                <>
                  <h4 className="text-sm font-bold text-zinc-900 pt-2">Textos exigidos na inscrição</h4>
                  <ul className="space-y-2">
                    {config.textosExigidos.map((t) => (
                      <li key={t} className="flex gap-2 text-sm text-zinc-700">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold">Documentação exigida</h3>
              <ul className="space-y-2">
                {config.documentacao.map((d) => (
                  <li key={d} className="flex gap-2 text-sm text-zinc-700">
                    <Check className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* C. Preview painel — sem notas fake */}
        <EditalLandingPareceristaPreview
          instituicao={instituicaoCurta}
          criterios={config.criterios}
          onUnlockClick={scrollToCapture}
        />

        {/* D. CTA final */}
        <section className="rounded-2xl gradient-primary p-8 md:p-10 text-center space-y-5 shadow-xl border border-oraculo-purple/30">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold max-w-2xl mx-auto leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]">
            Pronto para enviar uma proposta com mais segurança?
          </h2>
          <p className="text-sm md:text-base text-white/90 max-w-xl mx-auto">
            Simule a leitura da banca neste edital antes de fechar sua inscrição.
          </p>
          <Button
            type="button"
            onClick={scrollToCapture}
            className="bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-black py-4 px-8 rounded-xl text-base md:text-lg shadow-xl border-0 h-auto"
          >
            ⚡ SIMULAR MEU PROJETO NESTE EDITAL AGORA
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

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-purple-600 mb-2" aria-hidden />
      <p className="text-[10px] uppercase font-semibold text-zinc-500">{label}</p>
      <div className="text-sm font-bold text-zinc-900 mt-1 leading-snug">{value}</div>
    </div>
  );
}
