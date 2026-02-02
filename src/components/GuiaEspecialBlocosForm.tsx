import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { GuiaEspecialCampos } from '@/types/guia-especial';
import { parseLines, formatLines } from '@/types/guia-especial';

const defaultOpen = [true, false, false, false, false, false, false];

export interface GuiaEspecialBlocosFormProps {
  value: Partial<GuiaEspecialCampos>;
  onChange: (v: Partial<GuiaEspecialCampos>) => void;
}

function update<K extends keyof GuiaEspecialCampos>(
  prev: Partial<GuiaEspecialCampos>,
  key: K,
  val: GuiaEspecialCampos[K]
): Partial<GuiaEspecialCampos> {
  return { ...prev, [key]: val };
}

export function GuiaEspecialBlocosForm({ value, onChange }: GuiaEspecialBlocosFormProps) {
  const [open, setOpen] = useState<boolean[]>(defaultOpen);
  const toggle = (i: number) => {
    setOpen((p) => {
      const n = [...p];
      n[i] = !n[i];
      return n;
    });
  };

  return (
    <div className="space-y-3">
      {/* BLOCO 1 — Proposta de Valor */}
      <Card>
        <CardHeader
          role="button"
          tabIndex={0}
          onClick={() => toggle(0)}
          onKeyDown={(e) => e.key === 'Enter' && toggle(0)}
          className="cursor-pointer flex flex-row items-center justify-between hover:bg-gray-50/50"
        >
          <div>
            <CardTitle className="text-base">1. Proposta de Valor (Above the Fold)</CardTitle>
            <CardDescription>Subtítulo, promessa, benefícios-chave, etiqueta</CardDescription>
          </div>
          {open[0] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardHeader>
        {open[0] && (
            <CardContent className="space-y-4 pt-0">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Escolher <strong>OU</strong> Subtítulo <strong>OU</strong> Promessa Principal (evitar repetição). Na página, só um dos dois é exibido na capa.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">Subtítulo de Impacto</label>
                <Input
                  value={value.subtituloImpacto ?? ''}
                  onChange={(e) => onChange(update(value, 'subtituloImpacto', e.target.value))}
                  placeholder="Complementa o título com dor/benefício direto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Promessa Principal (1 frase)</label>
                <Input
                  value={value.promessaPrincipal ?? ''}
                  onChange={(e) => onChange(update(value, 'promessaPrincipal', e.target.value))}
                  placeholder="Ex: Prestação de contas segura, organizada e aprovada — sem dor de cabeça."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Lista de Benefícios-Chave (3 a 5 bullets)</label>
                <Textarea
                  value={formatLines(value.beneficiosChave)}
                  onChange={(e) => onChange(update(value, 'beneficiosChave', parseLines(e.target.value)))}
                  placeholder="Um item por linha"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Etiqueta de Posicionamento</label>
                <Input
                  value={value.etiquetaPosicionamento ?? ''}
                  onChange={(e) => onChange(update(value, 'etiquetaPosicionamento', e.target.value))}
                  placeholder="Ex: Para produtores culturais, Guia prático"
                />
              </div>
            </CardContent>
        )}
      </Card>

      {/* BLOCO 2 — Dor, Identificação e Urgência */}
      <Card>
        <CardHeader
          role="button"
          tabIndex={0}
          onClick={() => toggle(1)}
          onKeyDown={(e) => e.key === 'Enter' && toggle(1)}
          className="cursor-pointer flex flex-row items-center justify-between hover:bg-gray-50/50"
        >
          <div>
            <CardTitle className="text-base">2. Dor, Identificação e Urgência</CardTitle>
            <CardDescription>Você já passou por isso?, dores, consequência, urgência</CardDescription>
          </div>
          {open[1] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardHeader>
        {open[1] && (
            <CardContent className="space-y-4 pt-0">
              <div>
                <label className="block text-sm font-medium mb-1">&quot;Você já passou por isso?&quot; (texto curto)</label>
                <Textarea
                  value={value.blocoVoceJaPassou ?? ''}
                  onChange={(e) => onChange(update(value, 'blocoVoceJaPassou', e.target.value))}
                  placeholder="Texto introdutório para as dores"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Lista de dores reais do público</label>
                <Textarea
                  value={formatLines(value.listaDores)}
                  onChange={(e) => onChange(update(value, 'listaDores', parseLines(e.target.value)))}
                  placeholder="Um item por linha"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Consequência de Não Resolver</label>
                <Textarea
                  value={value.consequenciaNaoResolver ?? ''}
                  onChange={(e) => onChange(update(value, 'consequenciaNaoResolver', e.target.value))}
                  placeholder="Ex: Uma prestação de contas mal feita pode gerar diligências, glosas e devolução de recursos."
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">Exibido em destaque (box de alerta) na página</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bloco de Urgência Contextual</label>
                <Input
                  value={value.blocoUrgenciaContextual ?? ''}
                  onChange={(e) => onChange(update(value, 'blocoUrgenciaContextual', e.target.value))}
                  placeholder="Ex: Antes de enviar sua próxima prestação"
                />
              </div>
            </CardContent>
        )}
      </Card>

      {/* BLOCO 3 — Autor | Prova técnica | Depoimentos (3 blocos na página) */}
      <Card>
        <CardHeader
          role="button"
          tabIndex={0}
          onClick={() => toggle(2)}
          onKeyDown={(e) => e.key === 'Enter' && toggle(2)}
          className="cursor-pointer flex flex-row items-center justify-between hover:bg-gray-50/50"
        >
          <div>
            <CardTitle className="text-base">3. Autor | Prova técnica | Depoimentos</CardTitle>
            <CardDescription>Autor (quem é) · Metodologia (por que confiar) · Depoimentos (o que outros dizem). Não misturar.</CardDescription>
          </div>
          {open[2] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardHeader>
        {open[2] && (
            <CardContent className="space-y-5 pt-0">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Na página: 1) Autor do conteúdo (👤) — só “quem é” e “por que confiar”. 2) Metodologia validada (📊) — prova técnica. 3) Depoimentos (⭐) — o que produtores dizem.
              </p>
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
                <h4 className="text-sm font-semibold text-gray-800">1. Autor do conteúdo</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">Nome</label>
                  <Input
                    value={value.autorNome ?? ''}
                    onChange={(e) => onChange(update(value, 'autorNome', e.target.value))}
                    placeholder="Ex: Marcos Ferreira"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Bio (uma linha por item)</label>
                  <Textarea
                    value={value.autorBio ?? ''}
                    onChange={(e) => onChange(update(value, 'autorBio', e.target.value))}
                    placeholder="Uma linha por item. Ex.: Produtor Executivo; 20 anos no campo cultural; 100+ prestações."
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">Nada de depoimento aqui. Só “quem é” e “por que confiar”.</p>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/30 p-3">
                <h4 className="text-sm font-semibold text-gray-800">2. Prova técnica / Metodologia</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">Metodologia validada (número + contexto)</label>
                  <Input
                    value={value.provaSocial1 ?? ''}
                    onChange={(e) => onChange(update(value, 'provaSocial1', e.target.value))}
                    placeholder="Ex: Metodologia construída a partir da análise de mais de 300 prestações de contas reais."
                  />
                  <p className="text-xs text-gray-500 mt-1">Número concreto + situação real. Ícone 📊 na página.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Credibilidade institucional (opcional)</label>
                  <Input
                    value={value.provaSocial3 ?? ''}
                    onChange={(e) => onChange(update(value, 'provaSocial3', e.target.value))}
                    placeholder="Ex: Conteúdo alinhado às exigências do SALIC"
                  />
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-amber-100 bg-amber-50/30 p-3">
                <h4 className="text-sm font-semibold text-gray-800">3. Depoimentos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome</label>
                    <Input
                      value={value.provaSocial2Nome ?? ''}
                      onChange={(e) => onChange(update(value, 'provaSocial2Nome', e.target.value))}
                      placeholder="Ex: Fernanda Seixas"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Perfil</label>
                    <Input
                      value={value.provaSocial2Perfil ?? ''}
                      onChange={(e) => onChange(update(value, 'provaSocial2Perfil', e.target.value))}
                      placeholder="Ex: Produtora Executiva"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Texto do depoimento (1–2 frases)</label>
                  <Textarea
                    value={value.provaSocial2Texto ?? ''}
                    onChange={(e) => onChange(update(value, 'provaSocial2Texto', e.target.value))}
                    placeholder="Ex.: Eu sempre tive medo da prestação de contas. O guia me ajudou a entender o que precisava ser comprovado."
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">Exibido em bloco separado (⭐). Nunca misturar com Autor.</p>
                </div>
              </div>
            </CardContent>
        )}
      </Card>

      {/* BLOCO 4 — Conteúdo & Transformação */}
      <Card>
        <CardHeader
          role="button"
          tabIndex={0}
          onClick={() => toggle(3)}
          onKeyDown={(e) => e.key === 'Enter' && toggle(3)}
          className="cursor-pointer flex flex-row items-center justify-between hover:bg-gray-50/50"
        >
          <div>
            <CardTitle className="text-base">4. Conteúdo & Transformação</CardTitle>
            <CardDescription>O que será capaz de fazer, Antes vs Depois</CardDescription>
          </div>
          {open[3] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardHeader>
        {open[3] && (
            <CardContent className="space-y-4 pt-0">
              <div>
                <label className="block text-sm font-medium mb-1">Resultados práticos</label>
                <Textarea
                  value={formatLines(value.oQueSeraCapaz)}
                  onChange={(e) => onChange(update(value, 'oQueSeraCapaz', parseLines(e.target.value)))}
                  placeholder="Um item por linha. Linguagem de resultado, menos técnico e mais emocional."
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">O que a pessoa será capaz de fazer depois — foco em resultados, não em conteúdo</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Antes (situação comum)</label>
                <Textarea
                  value={value.antesDepoisAntes ?? ''}
                  onChange={(e) => onChange(update(value, 'antesDepoisAntes', e.target.value))}
                  placeholder="Um item por linha — exibido com bullet"
                  rows={5}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Depois (situação desejada)</label>
                <Textarea
                  value={value.antesDepoisDepois ?? ''}
                  onChange={(e) => onChange(update(value, 'antesDepoisDepois', e.target.value))}
                  placeholder="Um item por linha — exibido com bullet"
                  rows={5}
                />
              </div>
            </CardContent>
        )}
      </Card>

      {/* BLOCO 5 — Oferta & Ancoragem de Preço */}
      <Card>
        <CardHeader
          role="button"
          tabIndex={0}
          onClick={() => toggle(4)}
          onKeyDown={(e) => e.key === 'Enter' && toggle(4)}
          className="cursor-pointer flex flex-row items-center justify-between hover:bg-gray-50/50"
        >
          <div>
            <CardTitle className="text-base">5. Oferta & Ancoragem de Preço</CardTitle>
            <CardDescription>Âncora, benefício econômico, badges risco baixo</CardDescription>
          </div>
          {open[4] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardHeader>
        {open[4] && (
            <CardContent className="space-y-4 pt-0">
              <div>
                <label className="block text-sm font-medium mb-1">Texto de Ancoragem de Valor</label>
                <Input
                  value={value.textoAncoragemValor ?? ''}
                  onChange={(e) => onChange(update(value, 'textoAncoragemValor', e.target.value))}
                  placeholder="Ex: Menos que uma taxa bancária"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Benefício Econômico Implícito</label>
                <Input
                  value={value.beneficioEconomico ?? ''}
                  onChange={(e) => onChange(update(value, 'beneficioEconomico', e.target.value))}
                  placeholder="Ex: Pode evitar devoluções de milhares de reais"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Badge de Risco Baixo</label>
                <Textarea
                  value={formatLines(value.badgeRiscoBaixo)}
                  onChange={(e) => onChange(update(value, 'badgeRiscoBaixo', parseLines(e.target.value)))}
                  placeholder="Ex: Acesso imediato, Sem enrolação — um por linha"
                  rows={3}
                />
              </div>
            </CardContent>
        )}
      </Card>

      {/* BLOCO 6 — Redução de Objeções */}
      <Card>
        <CardHeader
          role="button"
          tabIndex={0}
          onClick={() => toggle(5)}
          onKeyDown={(e) => e.key === 'Enter' && toggle(5)}
          className="cursor-pointer flex flex-row items-center justify-between hover:bg-gray-50/50"
        >
          <div>
            <CardTitle className="text-base">6. Redução de Objeções</CardTitle>
            <CardDescription>Para quem é / não é, FAQ 1–3</CardDescription>
          </div>
          {open[5] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardHeader>
        {open[5] && (
            <CardContent className="space-y-4 pt-0">
              <div>
                <label className="block text-sm font-medium mb-1">Para quem é este guia</label>
                <Textarea
                  value={value.paraQuemEh ?? ''}
                  onChange={(e) => onChange(update(value, 'paraQuemEh', e.target.value))}
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Para quem NÃO é</label>
                <Textarea
                  value={value.paraQuemNaoEh ?? ''}
                  onChange={(e) => onChange(update(value, 'paraQuemNaoEh', e.target.value))}
                  rows={2}
                />
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2 p-3 rounded-lg bg-gray-50">
                  <label className="block text-sm font-medium">Pergunta Frequente {i}</label>
                  <Input
                    value={(value as any)[`faq${i}Pergunta`] ?? ''}
                    onChange={(e) => onChange(update(value, `faq${i}Pergunta` as keyof GuiaEspecialCampos, e.target.value))}
                    placeholder="Pergunta"
                  />
                  <Textarea
                    value={(value as any)[`faq${i}Resposta`] ?? ''}
                    onChange={(e) => onChange(update(value, `faq${i}Resposta` as keyof GuiaEspecialCampos, e.target.value))}
                    placeholder="Resposta"
                    rows={2}
                  />
                </div>
              ))}
            </CardContent>
        )}
      </Card>

      {/* BLOCO 7 — CTA */}
      <Card>
        <CardHeader
          role="button"
          tabIndex={0}
          onClick={() => toggle(6)}
          onKeyDown={(e) => e.key === 'Enter' && toggle(6)}
          className="cursor-pointer flex flex-row items-center justify-between hover:bg-gray-50/50"
        >
          <div>
            <CardTitle className="text-base">7. CTA (Call to Action)</CardTitle>
            <CardDescription>Texto do botão, reforço, microcopy segurança</CardDescription>
          </div>
          {open[6] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardHeader>
        {open[6] && (
            <CardContent className="space-y-4 pt-0">
              <div>
                <label className="block text-sm font-medium mb-1">Texto Principal do CTA</label>
                <Input
                  value={value.ctaTextoPrincipal ?? ''}
                  onChange={(e) => onChange(update(value, 'ctaTextoPrincipal', e.target.value))}
                  placeholder="Ex: Garanta agora!"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Texto Secundário de Reforço</label>
                <Input
                  value={value.ctaTextoSecundario ?? ''}
                  onChange={(e) => onChange(update(value, 'ctaTextoSecundario', e.target.value))}
                  placeholder="Ex: Acesso imediato • Download direto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Microcopy de Segurança</label>
                <Textarea
                  value={formatLines(value.microcopySeguranca)}
                  onChange={(e) => onChange(update(value, 'microcopySeguranca', parseLines(e.target.value)))}
                  placeholder="Ex: Pagamento seguro, Sem assinatura — um por linha"
                  rows={3}
                />
              </div>
            </CardContent>
        )}
      </Card>
    </div>
  );
}
