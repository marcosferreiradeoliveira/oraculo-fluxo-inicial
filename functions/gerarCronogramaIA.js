module.exports = (onRequest, openaiApiKey, db, getOpenAI) =>
  onRequest(
  {
    cors: true,
    secrets: [openaiApiKey],
    memory: '512MiB',
    timeoutSeconds: 120,
    cpu: 1,
  },
  async (req, res) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Body JSON inválido' }); }
      }
      if (!body || typeof body !== 'object') body = {};
      const { projetoId, sugestoes, etapasAtuais, duracaoMeses: duracaoMesesBody } = body;
      if (!projetoId) {
        return res.status(400).json({ error: 'projetoId é obrigatório' });
      }
      const duracaoMesesUsuario = typeof duracaoMesesBody === 'number' && duracaoMesesBody >= 1
        ? Math.min(120, Math.floor(duracaoMesesBody))
        : null;

      const projetoRef = db.collection('projetos').doc(projetoId);
      const projetoSnap = await projetoRef.get();
      if (!projetoSnap.exists) {
        return res.status(404).json({ error: 'Projeto não encontrado' });
      }

      const projeto = projetoSnap.data();
      const nomeProjeto = projeto.nome || 'Projeto';
      const descricaoProjeto = projeto.descricao || projeto.resumo || '';
      const orcamento = projeto.orcamento || {};
      const rubricas = orcamento.rubricas || [];
      const tetoOrcamento = orcamento.teto || 0;
      const textosGerados = projeto.textos_gerados || {};

      let dataEncerramentoEdital = null;
      let nomeEdital = '';
      if (projeto.edital_id) {
        try {
          const editalSnap = await db.collection('editais').doc(projeto.edital_id).get();
          if (editalSnap.exists) {
            const edital = editalSnap.data();
            nomeEdital = edital.nome || '';
            const raw = edital.data_encerramento || edital.dataEncerramento || edital.deadline;
            if (raw) {
              if (raw.toDate) dataEncerramentoEdital = raw.toDate();
              else if (raw.seconds) dataEncerramentoEdital = new Date(raw.seconds * 1000);
              else if (typeof raw === 'string') dataEncerramentoEdital = new Date(raw);
            }
          }
        } catch (e) {
          console.warn('[gerarCronogramaIA] Erro ao buscar edital:', e.message);
        }
      }

      const hoje = new Date();
      // Início do cronograma: daqui a 6 meses (não na data de geração)
      const inicioCronograma = new Date(hoje);
      inicioCronograma.setMonth(inicioCronograma.getMonth() + 6);
      const dataInicioMin = inicioCronograma.toISOString().slice(0, 10);

      // Duração total: usuário informou OU conforme orçamento (até 300k = 6 meses, acima escala até máx 12 meses)
      let duracaoMeses = (duracaoMesesUsuario && duracaoMesesUsuario >= 1) ? duracaoMesesUsuario : 6;
      const totalOrcamento = tetoOrcamento > 0 ? tetoOrcamento : rubricas.reduce((s, r) => s + Number(r.total || r.valor || 0), 0);
      if (!duracaoMesesUsuario || duracaoMesesUsuario < 1) {
        if (totalOrcamento <= 300000) {
          duracaoMeses = 6;
        } else if (totalOrcamento >= 600000) {
          duracaoMeses = 12;
        } else {
          duracaoMeses = Math.round(6 + (6 * (totalOrcamento - 300000) / 300000));
        }
      }
      const fimPorDuracao = new Date(inicioCronograma);
      fimPorDuracao.setMonth(fimPorDuracao.getMonth() + duracaoMeses);
      let fimMaximo = dataEncerramentoEdital && !isNaN(dataEncerramentoEdital.getTime())
        ? dataEncerramentoEdital
        : fimPorDuracao;
      if (fimPorDuracao.getTime() < fimMaximo.getTime()) fimMaximo = fimPorDuracao;
      const dataFimMax = fimMaximo.toISOString().slice(0, 10);

      const sugestoesTrim = typeof sugestoes === 'string' ? sugestoes.trim() : '';
      const isAlteracoes = sugestoesTrim.length > 0 && Array.isArray(etapasAtuais) && etapasAtuais.length > 0;
      const nomesRubricasSet = new Set(
        (rubricas || []).map((r) => String(r.nome || r.rubrica || '').trim()).filter(Boolean)
      );

      let prompt;
      let systemContent;

      if (isAlteracoes) {
        const cronogramaAtualJson = JSON.stringify(etapasAtuais.map((e) => ({
          etapa: e.etapa || '',
          inicio: String(e.inicio || '').slice(0, 10),
          fim: String(e.fim || '').slice(0, 10),
        })), null, 2);
        prompt = `Você é um especialista em planejamento de projetos culturais.

O usuário enviou o CRONOGRAMA ATUAL (array JSON) e PEDIDOS DE ALTERAÇÃO. Sua tarefa é devolver APENAS o array JSON do cronograma ATUALIZADO, aplicando as alterações EM CIMA do cronograma atual. NÃO gere um cronograma do zero. Mantenha etapas que não forem citadas nas sugestões; altere, remova ou adicione apenas o que as sugestões pedirem.

REGRAS:
- Retorne SOMENTE um array JSON válido, sem texto antes ou depois.
- Cada item: "etapa" (string), "inicio" (YYYY-MM-DD), "fim" (YYYY-MM-DD), "macroEtapa" (exatamente: pre_producao, producao, divulgacao ou pos_producao). Mantenha ou atribua macroEtapa coerente com a natureza de cada etapa.
- Datas devem estar entre ${dataInicioMin} e ${dataFimMax}.
- Durações razoáveis (semanas ou meses).
${duracaoMesesUsuario ? `- O usuário informou duração total do projeto de ${duracaoMesesUsuario} meses; o cronograma deve caber nesse período.` : ''}

CRONOGRAMA ATUAL:
${cronogramaAtualJson}

PEDIDOS DE ALTERAÇÃO:
${sugestoesTrim}

Retorne somente o array JSON atualizado:`;
        systemContent = 'Você recebe um cronograma atual (JSON) e pedidos de alteração. Devolva APENAS o array JSON atualizado, aplicando as alterações em cima do atual. Cada objeto deve ter "etapa", "inicio", "fim" e "macroEtapa" (pre_producao, producao, divulgacao ou pos_producao), coerente com a natureza da etapa. Não inclua texto explicativo.';
        console.log('[gerarCronogramaIA] Modo alterações: aplicando sugestões em cima do cronograma atual');
      } else {
        const nomesRubricas = rubricas.map((r) => String(r.nome || r.rubrica || '').trim()).filter(Boolean);
        const temOrcamento = nomesRubricas.length > 0;
        const rubricasTexto = temOrcamento
          ? rubricas.map((r) => `- ${r.nome || r.rubrica || 'Rubrica'}: R$ ${Number(r.total || r.valor || 0).toLocaleString('pt-BR')}`).join('\n')
          : 'Orçamento ainda não foi criado neste projeto. Derive as etapas da descrição e dos textos do projeto (metodologia, atividades, equipe, divulgação, produção). Use rubricasAssociadas: [] em todas as etapas.';
        const listaNomesRubricasParaPrompt = temOrcamento
          ? `Lista EXATA de nomes de rubricas (use estes nomes em "rubricasAssociadas"): ${JSON.stringify(nomesRubricas)}`
          : 'Não há rubricas ainda: em cada etapa use "rubricasAssociadas": [].';

        const textosResumo = Object.keys(textosGerados).length > 0
          ? Object.entries(textosGerados)
            .filter(([, v]) => v && typeof v === 'string')
            .map(([k, v]) => `[${k}]:\n${String(v).slice(0, 1500)}`)
            .join('\n\n')
          : 'Textos do projeto não informados.';

        prompt = `Você é um especialista em planejamento de projetos culturais para editais e leis de incentivo.

Com base nos dados do projeto${temOrcamento ? ', no ORÇAMENTO (rubricas abaixo)' : ''} e nos textos, gere um CRONOGRAMA de etapas em JSON.

NÍVEL DE DETALHAMENTO – OBRIGATÓRIO:
- NÃO gere apenas 4 macro etapas (pré-produção, produção, pós-produção, prestação de contas). Isso é insuficiente.
- Gere entre 10 e 20 etapas, com nível intermediário de detalhe${temOrcamento ? ': cada rubrica ou grupo lógico de rubricas do orçamento deve refletir em uma ou mais etapas concretas' : ': derive atividades concretas dos textos do projeto (contratações, licenciamentos, locações, ensaios, gravação, divulgação, montagem, apresentações, desmontagem, documentação, prestação de contas)'}.
${temOrcamento ? '- Use os NOMES e a NATUREZA das rubricas do orçamento para batizar e definir as etapas. Não invente rubricas; derive as etapas do orçamento e dos textos.' : '- O orçamento será criado depois; foque em etapas coerentes com a metodologia descrita nos textos.'}
- Não seja excessivamente detalhado (evite dezenas de etapas de um dia); cada etapa deve ter duração razoável (semanas ou poucos meses).

BOAS PRÁTICAS (estrutura em fases, mas desdobradas em etapas concretas):
- Pré-produção: contratos, seguros, reservas, licenças (ECAD, alvarás), alinhamento com fornecedores → virem etapas específicas conforme as rubricas.
- Produção: atividades centrais (ensaios, gravações, montagens) + janelas de respiro → uma ou mais etapas por tipo de atividade relevante no orçamento.
- Pós-produção: desmontagem, devolução, documentação (clipping, acessibilidade, listas) → etapas nomeadas de forma clara.
- Prestação de contas: período de 30 a 60 dias no final, como etapa explícita.
- Sincronia físico-financeira: datas dentro do prazo; considerar prazos de fornecedores. Margem de segurança (~15%) em tarefas críticas.

REGRAS DE DATAS E DISTRIBUIÇÃO – CRÍTICO:
- O cronograma começa em ${dataInicioMin} (data inicial de execução) e termina em ${dataFimMax}. NÃO use a data de hoje; a primeira etapa deve INICIAR em ${dataInicioMin} ou logo após.
- DISTRIUA as etapas ao longo de TODO o período (${dataInicioMin} a ${dataFimMax}). É PROIBIDO concentrar todas as etapas em um único mês. Cada etapa deve ter duração realista (semanas ou meses). A primeira etapa começa em ${dataInicioMin}; a última etapa deve terminar próximo a ${dataFimMax}.
- ETAPAS CONCOMITANTES: Muitas etapas podem e devem ocorrer em paralelo (mesmas datas ou sobreposição). NÃO gere tudo em sequência rígida (uma termina e só então começa a outra). Exemplos: produção de material de divulgação e ensaios ao mesmo tempo; campanha de divulgação durante as apresentações; várias atividades de pré-produção sobrepostas (contratação e locação simultâneas). Só exija sequência quando for obrigatório (ex.: montagem antes de apresentações; desmontagem depois).
- Duração total do projeto neste cronograma: ${duracaoMeses} meses (baseada no orçamento: até ~300 mil = 6 meses; acima disso escala até no máximo 12 meses). Respeite esse arco temporal.

REGRAS DE FORMATO:
- Retorne APENAS um array JSON válido, sem texto antes ou depois.
- Cada item deve ter: "etapa" (nome curto e concreto), "inicio" (YYYY-MM-DD), "fim" (YYYY-MM-DD), "macroEtapa" (fase do cronograma) e "rubricasAssociadas" (array de strings).
- rubricasAssociadas OBRIGATÓRIO: em cada etapa, indique os NOMES EXATOS das rubricas do orçamento que se aplicam a essa etapa (custos/despesas daquela atividade). Use somente nomes da lista de rubricas do projeto. Pode ser um ou mais; se não houver rubrica específica, use a mais próxima ou deixe [].
${listaNomesRubricasParaPrompt ? `\n${listaNomesRubricasParaPrompt}\n` : ''}
- macroEtapa OBRIGATÓRIO: use exatamente um destes valores em cada etapa, conforme a natureza da atividade:
  - pre_producao: contratos, licenciamentos (ECAD, alvarás), contratação de equipe, reserva e locação de espaços/equipamentos, planejamento, mobilização.
  - producao: ensaios, gravações, montagem técnica/cenográfica, apresentações, realização do evento, atividades centrais de execução.
  - divulgacao: produção de material de divulgação, campanha de divulgação, assessoria de imprensa, marketing.
  - pos_producao: desmontagem, devolução de equipamentos, documentação pedagógica, clipping, prestação de contas (RCO e documentação).
Atribua macroEtapa de forma coerente com o tipo de cada etapa; não use "producao" para tudo.

DADOS DO PROJETO:
Nome: ${nomeProjeto}
${descricaoProjeto ? `Descrição/Resumo:\n${descricaoProjeto.slice(0, 2000)}\n` : ''}

${temOrcamento ? 'ORÇAMENTO DO PROJETO – RUBRICAS (derive etapas a partir destas rubricas):' : 'ORÇAMENTO:'}
${rubricasTexto}
${tetoOrcamento ? `Teto total: R$ ${tetoOrcamento.toLocaleString('pt-BR')}` : ''}

TEXTOS DO PROJETO (trechos):
${textosResumo}

${nomeEdital ? `Edital: ${nomeEdital}. Data limite: ${dataFimMax}.` : ''}

Retorne somente o array JSON. Exemplo (cada objeto com etapa, inicio, fim, macroEtapa e rubricasAssociadas com nomes exatos das rubricas):
[{"etapa":"Contratos e licenciamentos (ECAD, alvarás)","inicio":"2025-02-01","fim":"2025-02-28","macroEtapa":"pre_producao","rubricasAssociadas":["Licenças e direitos autorais"]},{"etapa":"Contratação de equipe técnica e artística","inicio":"2025-03-01","fim":"2025-03-15","macroEtapa":"pre_producao","rubricasAssociadas":["Equipe técnica","Equipe artística"]},{"etapa":"Reserva e locação de espaços e equipamentos","inicio":"2025-03-10","fim":"2025-03-31","macroEtapa":"pre_producao","rubricasAssociadas":["Locação de espaços","Equipamentos"]},{"etapa":"Ensaios e preparação","inicio":"2025-04-01","fim":"2025-04-30","macroEtapa":"producao","rubricasAssociadas":["Ensaios","Produção"]},{"etapa":"Produção de material de divulgação","inicio":"2025-04-15","fim":"2025-05-15","macroEtapa":"divulgacao","rubricasAssociadas":["Divulgação"]},{"etapa":"Montagem técnica e cenográfica","inicio":"2025-05-01","fim":"2025-05-20","macroEtapa":"producao","rubricasAssociadas":["Montagem","Cenografia"]},{"etapa":"Apresentações e realização do evento","inicio":"2025-05-21","fim":"2025-06-15","macroEtapa":"producao","rubricasAssociadas":["Apresentações","Produção"]},{"etapa":"Campanha de divulgação e assessoria","inicio":"2025-05-01","fim":"2025-06-30","macroEtapa":"divulgacao","rubricasAssociadas":["Divulgação","Assessoria de imprensa"]},{"etapa":"Desmontagem e devolução de equipamentos","inicio":"2025-06-16","fim":"2025-06-30","macroEtapa":"pos_producao","rubricasAssociadas":["Logística"]},{"etapa":"Documentação pedagógica e clipping","inicio":"2025-07-01","fim":"2025-07-20","macroEtapa":"pos_producao","rubricasAssociadas":["Documentação","Acessibilidade"]},{"etapa":"Prestação de contas (RCO e documentação)","inicio":"2025-07-21","fim":"2025-09-15","macroEtapa":"pos_producao","rubricasAssociadas":["Administrativo"]}]`;
        systemContent = 'Você gera um array JSON de etapas de cronograma. Cada objeto: "etapa", "inicio" (YYYY-MM-DD), "fim" (YYYY-MM-DD), "macroEtapa" (pre_producao, producao, divulgacao ou pos_producao) e "rubricasAssociadas" (array de strings com os NOMES EXATOS das rubricas do orçamento que se aplicam àquela etapa). Use apenas nomes de rubricas fornecidos na lista do projeto. IMPORTANTE: muitas etapas devem ser CONCOMITANTES (datas sobrepostas). Resposta: apenas o JSON.';
      }

      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt },
        ],
        max_tokens: 8192,
        temperature: 0.3,
      });

      const content = completion.choices?.[0]?.message?.content?.trim() || '';
      let etapas = [];
      const extrairArrayJson = (raw) => {
        if (!raw) return null;
        let s = raw.trim();
        const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fence) s = fence[1].trim();
        const start = s.indexOf('[');
        if (start === -1) return null;
        let depth = 0;
        for (let i = start; i < s.length; i++) {
          if (s[i] === '[') depth += 1;
          else if (s[i] === ']') {
            depth -= 1;
            if (depth === 0) return s.slice(start, i + 1);
          }
        }
        return null;
      };
      const jsonStr = extrairArrayJson(content);
      if (jsonStr) {
        try {
          etapas = JSON.parse(jsonStr);
          if (!Array.isArray(etapas)) etapas = [];
          const macroValidos = ['pre_producao', 'producao', 'divulgacao', 'pos_producao'];
          etapas = etapas
            .filter((e) => e && typeof e.etapa === 'string' && e.inicio && e.fim)
            .map((e) => {
              const macro = e.macroEtapa && macroValidos.includes(String(e.macroEtapa)) ? String(e.macroEtapa) : 'producao';
              const rawRubricas = Array.isArray(e.rubricasAssociadas) ? e.rubricasAssociadas : [];
              const rubricasAssociadas = rawRubricas
                .filter((n) => typeof n === 'string' && nomesRubricasSet.has(String(n).trim()))
                .map((n) => String(n).trim());
              return {
                etapa: String(e.etapa).trim(),
                inicio: String(e.inicio).slice(0, 10),
                fim: String(e.fim).slice(0, 10),
                macroEtapa: macro,
                rubricasAssociadas: rubricasAssociadas.length ? rubricasAssociadas : [],
              };
            });
          if (isAlteracoes && Array.isArray(etapasAtuais) && etapasAtuais.length > 0) {
            const mapaPorEtapa = new Map(etapasAtuais.map((e) => [e.etapa || '', e]));
            etapas = etapas.map((e) => {
              const anterior = mapaPorEtapa.get(e.etapa);
              const mantidas = anterior && Array.isArray(anterior.rubricasAssociadas)
                ? anterior.rubricasAssociadas.filter((n) => nomesRubricasSet.has(String(n).trim()))
                : (e.rubricasAssociadas || []);
              return { ...e, rubricasAssociadas: mantidas.length ? mantidas : (e.rubricasAssociadas || []) };
            });
          }
        } catch (parseErr) {
          console.error('[gerarCronogramaIA] Erro ao parsear JSON:', parseErr, content.slice(0, 500));
        }
      } else if (content) {
        console.warn('[gerarCronogramaIA] Resposta sem array JSON:', content.slice(0, 400));
      }

      return res.status(200).json({ etapas });
    } catch (error) {
      console.error('[gerarCronogramaIA]', error);
      return res.status(500).json({
        error: error.message || 'Erro ao gerar cronograma com IA',
      });
    }
  }
);

