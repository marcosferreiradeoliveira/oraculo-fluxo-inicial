import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  PROJETO_DEMONSTRACAO,
  PROJETO_DEMO_STEPS,
  formatarMoedaBRL,
} from '@/lib/projetoDemonstracao';
import { CheckCircle2, Lock, Sparkles } from 'lucide-react';
import { DemoCronogramaGantt } from '@/components/home/DemoCronogramaGantt';

const TITULOS_TEXTO: Record<string, string> = {
  justificativa: 'Justificativa',
  objetivos: 'Objetivos',
  metodologia: 'Metodologia',
  resultados_esperados: 'Resultados esperados',
};

const ProjetoExemplo = () => {
  const navigate = useNavigate();
  const demo = PROJETO_DEMONSTRACAO;
  const [secaoAtiva, setSecaoAtiva] = useState(0);
  const totalOrcamento = demo.orcamento.rubricas.reduce((s, r) => s + r.total, 0);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 rounded-xl border border-oraculo-blue/30 bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 p-4 md:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <Badge variant="secondary" className="mb-2 bg-white/80">
                    Demonstração · somente leitura
                  </Badge>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{demo.nome}</h1>
                  <p className="text-sm text-gray-600 mt-1">{demo.editalNome}</p>
                </div>
                <Button
                  className="bg-oraculo-purple hover:bg-oraculo-purple/90 text-white shrink-0"
                  onClick={() => navigate('/cadastro?redirect=/criar-projeto')}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Criar meu projeto
                </Button>
              </div>
              <p className="text-sm text-gray-700 mt-3">
                Veja como fica um projeto cultural completo no Oráculo — do rascunho à inscrição. Todos os
                campos abaixo são fictícios.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {PROJETO_DEMO_STEPS.map((step, index) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setSecaoAtiva(index)}
                  className={`text-left text-xs sm:text-sm px-3 py-2 rounded-lg border transition-colors ${
                    secaoAtiva === index
                      ? 'border-oraculo-blue bg-oraculo-blue/10 text-oraculo-blue font-medium'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-oraculo-blue/40'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    {index + 1}. {step}
                  </span>
                </button>
              ))}
            </div>

            {secaoAtiva <= 2 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>
                    {secaoAtiva === 0 && 'Dados do projeto'}
                    {secaoAtiva === 1 && 'Análise com IA'}
                    {secaoAtiva === 2 && 'Sugestões aplicadas (exemplo)'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-gray-800 text-sm leading-relaxed whitespace-pre-line">
                  {secaoAtiva === 0 && (
                    <>
                      <p>{demo.descricao}</p>
                      <p className="text-gray-500 text-xs">
                        No app, você preenche nome, edital e descrição em &quot;Criar Projeto&quot;.
                      </p>
                    </>
                  )}
                  {secaoAtiva === 1 && <p>{demo.analise_ia}</p>}
                  {secaoAtiva === 2 && (
                    <p>
                      Após a análise, o Oráculo sugere melhorias ponto a ponto. Aqui você veria o texto do
                      projeto já refinado com base nessas sugestões — como no fluxo &quot;Alterar com IA&quot;.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {secaoAtiva === 3 && (
              <div className="space-y-4 mb-6">
                {Object.entries(demo.textos_gerados).map(([key, texto]) => (
                  <Card key={key}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">{TITULOS_TEXTO[key] || key}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-800 leading-relaxed">{texto}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {secaoAtiva === 4 && (
              <Card className="mb-6 overflow-hidden">
                <CardHeader>
                  <CardTitle>Orçamento</CardTitle>
                  <p className="text-sm text-gray-600">Total: {formatarMoedaBRL(totalOrcamento)}</p>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0 sm:p-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-gray-600">
                        <th className="p-3 font-medium">Rubrica</th>
                        <th className="p-3 font-medium">Qtd.</th>
                        <th className="p-3 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demo.orcamento.rubricas.map((r) => (
                        <tr key={r.id} className="border-b">
                          <td className="p-3">{r.nome}</td>
                          <td className="p-3">
                            {r.quantidade} {r.unidade}
                          </td>
                          <td className="p-3 text-right font-medium">{formatarMoedaBRL(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {secaoAtiva === 5 && (
              <div className="space-y-4 mb-6">
                <DemoCronogramaGantt etapas={demo.cronograma.etapas} />
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Cronograma</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0 sm:p-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-gray-600">
                        <th className="p-3 font-medium">Etapa</th>
                        <th className="p-3 font-medium">Início</th>
                        <th className="p-3 font-medium">Fim</th>
                        <th className="p-3 font-medium">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demo.cronograma.etapas.map((e) => (
                        <tr key={e.id} className="border-b">
                          <td className="p-3">{e.etapa}</td>
                          <td className="p-3">{e.inicio.split('-').reverse().join('/')}</td>
                          <td className="p-3">{e.fim.split('-').reverse().join('/')}</td>
                          <td className="p-3 text-xs text-gray-600">{e.observacao ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              </div>
            )}

            {secaoAtiva === 6 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Documentos de inscrição</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {demo.documentos_inscricao.map((doc) => (
                      <li
                        key={doc.nome}
                        className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-white"
                      >
                        <span className="text-sm font-medium text-gray-900">{doc.nome}</span>
                        <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
                          {doc.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {secaoAtiva === 7 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-gray-500" />
                    Preencher anexos
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-700 space-y-3">
                  <p>
                    No projeto real, você anexa PDFs e formulários exigidos pelo edital. Nesta demonstração,
                    os anexos não são enviados — apenas ilustram a última etapa antes do resumo e da
                    inscrição.
                  </p>
                  <Button variant="outline" onClick={() => navigate('/avaliar-projeto?iniciar=1')}>
                    Testar avaliação com IA (grátis)
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-200">
              <Button variant="outline" onClick={() => navigate('/')}>
                Voltar ao início
              </Button>
              <Button
                className="bg-oraculo-blue hover:bg-oraculo-blue/90 text-white"
                onClick={() => navigate('/cadastro?redirect=/criar-projeto')}
              >
                Quero montar o meu projeto
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProjetoExemplo;
