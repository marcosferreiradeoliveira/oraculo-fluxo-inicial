import React from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Privacidade = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Button 
                variant="outline" 
                onClick={() => navigate(-1)}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Política de Privacidade do Oráculo Cultural
              </h1>
              <p className="text-gray-600">
                Desenvolvido e Operado por: Mobr Produções Artísticas LTDA. (CNPJ 11.794.400/0001-32)
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Última Atualização: 20-10-2025
              </p>
            </div>

            <Card>
              <CardContent className="p-8">
                <div className="prose prose-gray max-w-none">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">1. INTRODUÇÃO</h2>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    Esta Política de Privacidade ("Política") descreve como a Mobr Produções Artísticas LTDA., controladora da plataforma Oraculo Cultural ("Plataforma"), coleta, utiliza, armazena, compartilha e protege as informações e dados pessoais dos Usuários, em conformidade com a legislação brasileira, especialmente a Lei Geral de Proteção de Dados (LGPD).
                  </p>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    Ao utilizar a Plataforma, o Usuário concorda com o tratamento de seus dados pessoais conforme estabelecido nesta Política.
                  </p>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">2. DADOS PESSOAIS COLETADOS</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    A Plataforma coleta os seguintes tipos de dados pessoais e informações:
                  </p>
                  
                  <div className="overflow-x-auto mb-6">
                    <table className="min-w-full border border-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900">Categoria de Dados</th>
                          <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900">Exemplos</th>
                          <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900">Finalidade Principal do Tratamento (Base Legal: Execução de Contrato e Legítimo Interesse)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-gray-300 px-4 py-2 text-gray-700 font-medium">Dados de Cadastro</td>
                          <td className="border border-gray-300 px-4 py-2 text-gray-700">Nome, e-mail, telefone, CPF/CNPJ.</td>
                          <td className="border border-gray-300 px-4 py-2 text-gray-700">Identificar o Usuário, permitir o acesso e gerenciamento da conta, e prestar o serviço contratado.</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 px-4 py-2 text-gray-700 font-medium">Conteúdo do Usuário</td>
                          <td className="border border-gray-300 px-4 py-2 text-gray-700">Textos de projetos, orçamentos, cronogramas, dados de editais e qualquer informação inserida ou gerada na Plataforma.</td>
                          <td className="border border-gray-300 px-4 py-2 text-gray-700">Armazenar, processar e utilizar o conteúdo para (a) prestar o serviço principal (avaliação, sugestão e geração de textos), (b) treinar e aprimorar os algoritmos de IA, e (c) realizar a gestão de conformidade.</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 px-4 py-2 text-gray-700 font-medium">Dados de Uso e Navegação</td>
                          <td className="border border-gray-300 px-4 py-2 text-gray-700">Endereço IP, dados de localização, registros de acesso, informações sobre o dispositivo, interações e funcionalidades mais utilizadas.</td>
                          <td className="border border-gray-300 px-4 py-2 text-gray-700">Melhorar a performance e a usabilidade da Plataforma, gerar relatórios estatísticos e garantir a segurança.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">3. COMO UTILIZAMOS OS DADOS</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    Os dados pessoais e o Conteúdo do Usuário são utilizados exclusivamente para as seguintes finalidades, conforme previsto nos Termos de Uso:
                  </p>
                  <ul className="list-disc pl-6 mb-6 text-gray-700 leading-relaxed space-y-2">
                    <li><strong>Prestação do Serviço:</strong> Armazenar, processar e analisar o Conteúdo do Usuário para gerar sugestões, avaliações e alterações em textos de projetos (justificativas, objetivos), bem como auxiliar na criação de orçamentos e cronogramas.</li>
                    <li><strong>Desenvolvimento da Plataforma:</strong> Utilizar dados de uso e, principalmente, Conteúdo do Usuário anonimizado e agregado para treinar e aprimorar os algoritmos de Inteligência Artificial do Oraculo Cultural, visando a melhoria contínua da precisão e relevância das ferramentas.</li>
                    <li><strong>Comunicação e Suporte:</strong> Enviar avisos sobre a conta, modificações nos Termos/Política e responder a solicitações de suporte.</li>
                    <li><strong>Cumprimento Legal:</strong> Realizar a gestão de conformidade, auditorias e atender a obrigações legais, regulatórias ou ordens judiciais.</li>
                  </ul>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">4. COMPARTILHAMENTO DE DADOS</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    A Mobr Produções Artísticas não vende nem aluga os dados pessoais ou o Conteúdo do Usuário a terceiros. Os dados podem ser compartilhados nas seguintes situações:
                  </p>
                  <ul className="list-disc pl-6 mb-6 text-gray-700 leading-relaxed space-y-2">
                    <li><strong>Prestadores de Serviço:</strong> Com empresas e parceiros que auxiliam na operação e manutenção da Plataforma (ex: serviços de hospedagem, processamento de pagamentos, análise de dados), sempre sob rigorosos acordos de confidencialidade e limitados à finalidade da prestação do serviço.</li>
                    <li><strong>Anonimização para IA:</strong> O Conteúdo do Usuário pode ser submetido a um processo de anonimização e agregação antes de ser utilizado para o treinamento e aprimoramento dos modelos de IA, tornando-o impossível de ser rastreado ao Usuário original.</li>
                    <li><strong>Obrigações Legais:</strong> Em cumprimento a determinações legais, regulatórias ou em resposta a ordens judiciais, administrativas ou arbitrais.</li>
                  </ul>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">5. SEGURANÇA E CONFIDENCIALIDADE</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    A Mobr Produções Artísticas utiliza medidas de segurança razoáveis e alinhadas às melhores práticas de mercado (como criptografia, controle de acesso, firewalls e testes de segurança) para proteger o Conteúdo e os dados pessoais do Usuário contra acesso, uso, alteração ou divulgação não autorizados.
                  </p>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    O tratamento do Conteúdo do Usuário será feito de forma confidencial, conforme estabelecido nos Termos de Uso.
                  </p>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">6. RETENÇÃO E TÉRMINO</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    Os dados e o Conteúdo do Usuário serão retidos enquanto o Usuário mantiver uma conta ativa na Plataforma.
                  </p>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    Em caso de encerramento da conta, a Mobr Produções Artísticas poderá reter o Conteúdo do Usuário (incluindo dados e documentos) pelo prazo legal necessário para fins de auditoria, cumprimento de obrigações legais e regulatórias, conforme previsto nos Termos de Uso.
                  </p>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">7. DIREITOS DO TITULAR DOS DADOS</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    O Usuário, como titular dos dados, possui os seguintes direitos, que podem ser exercidos mediante solicitação ao Contato de Privacidade (DPO):
                  </p>
                  <ul className="list-disc pl-6 mb-6 text-gray-700 leading-relaxed space-y-1">
                    <li>Confirmação da existência de tratamento.</li>
                    <li>Acesso aos dados.</li>
                    <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
                    <li>Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD.</li>
                    <li>Portabilidade dos dados a outro fornecedor de serviço ou produto.</li>
                    <li>Eliminação dos dados pessoais tratados com o consentimento do titular (ressalvadas as exceções legais de retenção).</li>
                    <li>Informação sobre o compartilhamento de dados.</li>
                    <li>Revogação do consentimento (quando aplicável).</li>
                  </ul>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">8. CONTATO COM O ENCARREGADO (DPO)</h2>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    Para exercer seus direitos como titular de dados, fazer perguntas sobre esta Política ou quaisquer questões relativas à privacidade, o Usuário deve contatar o Encarregado pelo Tratamento de Dados Pessoais (DPO) da Mobr Produções Artísticas.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Privacidade;
