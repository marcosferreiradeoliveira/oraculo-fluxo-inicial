import React from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Termos = () => {
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
                Termos de Uso do Oráculo Cultural
              </h1>
              <p className="text-gray-600">
                Desenvolvido e Operado por: Mobr Produções Artísticas LTDA. CNPJ 11.794.400/0001-32. Sede Rua Br de Lucena 135 104 Rio de Janeiro RJ.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Versão: 1.0 | Data da Última Atualização: 20-10-2025
              </p>
            </div>

            <Card>
              <CardContent className="p-8">
                <div className="prose prose-gray max-w-none">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">1. INTRODUÇÃO E ACEITAÇÃO</h2>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    Estes Termos de Uso ("Termos") regem o acesso e a utilização da plataforma Oraculo Cultural ("Plataforma"), um sistema de software e inteligência artificial (IA) que oferece ferramentas para a gestão, otimização e conformidade de projetos culturais, desenvolvido e mantido pela MobCONTENT ("MobCONTENT").
                  </p>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    Ao acessar, cadastrar-se ou utilizar qualquer funcionalidade da Plataforma, o usuário ("Usuário") manifesta sua plena e incondicional concordância com estes Termos e com a Política de Privacidade da MobCONTENT. Caso não concorde com qualquer disposição destes Termos ou da Política de Privacidade, o Usuário não deve utilizar a Plataforma.
                  </p>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">2. OBJETO DO SERVIÇO</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    <strong>2.1.</strong> O Oraculo Cultural é uma ferramenta de apoio tecnológico que utiliza Inteligência Artificial para:
                  </p>
                  <ul className="list-disc pl-6 mb-4 text-gray-700 leading-relaxed">
                    <li><strong>Módulo Criação:</strong> Oferecer um polo de conhecimento (editais, e-books, podcasts), realizar avaliação inteligente de projetos com base em critérios de editais, gerar sugestões e realizar a geração automática de alterações em textos (justificativa, objetivos), e auxiliar na criação de orçamentos e cronogramas.</li>
                    <li><strong>Módulo Execução:</strong> Gerenciar a execução do projeto, realizando a importação e o armazenamento de notas fiscais, utilizando IA para avaliação de conformidade fiscal e documental com o edital, controlando o uso de rubricas e fornecendo Dashboards Estatísticos de acompanhamento.</li>
                  </ul>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    <strong>2.2.</strong> Natureza do Serviço: O Oraculo Cultural é uma ferramenta de suporte e sugestão. As análises, notas, comparações de mercado e sugestões de texto geradas pela IA são informativas e não substituem o julgamento profissional, a diligência ou a responsabilidade legal do Usuário.
                  </p>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">3. CADASTRO E ACESSO</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    <strong>3.1.</strong> O acesso à Plataforma é restrito a Usuários devidamente cadastrados, que devem fornecer informações precisas, completas e atualizadas.
                  </p>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    <strong>3.2.</strong> O Usuário é o único responsável pela guarda e confidencialidade de seu login e senha, devendo notificar imediatamente a MobCONTENT em caso de uso não autorizado.
                  </p>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    <strong>3.3.</strong> A Plataforma destina-se a pessoas jurídicas ou pessoas físicas maiores de 18 (dezoito) anos e legalmente capazes de celebrar contratos.
                  </p>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">4. USO DO SERVIÇO E RESPONSABILIDADES</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    <strong>4.1. Responsabilidade do Usuário:</strong> O Usuário é o único responsável por:
                  </p>
                  <ul className="list-disc pl-6 mb-4 text-gray-700 leading-relaxed">
                    <li>A veracidade, legalidade e precisão de todos os dados, documentos, notas fiscais, textos e informações carregadas na Plataforma.</li>
                    <li>As decisões tomadas com base nas análises e sugestões da IA.</li>
                    <li>A verificação e a submissão final dos projetos, orçamentos e prestações de contas aos órgãos governamentais ou patrocinadores.</li>
                    <li>O cumprimento integral das leis, regulamentos, editais e termos de fomento aplicáveis aos seus projetos.</li>
                  </ul>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    <strong>4.2. Vedação de Uso:</strong> É proibido ao Usuário:
                  </p>
                  <ul className="list-disc pl-6 mb-6 text-gray-700 leading-relaxed">
                    <li>Utilizar a Plataforma para fins ilícitos ou que violem a legislação brasileira.</li>
                    <li>Realizar engenharia reversa, descompilação ou tentar acessar o código-fonte da Plataforma.</li>
                    <li>Carregar ou processar dados que violem direitos de terceiros ou contenham vírus ou códigos maliciosos.</li>
                  </ul>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">5. PROPRIEDADE INTELECTUAL</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    <strong>5.1. Propriedade da MobCONTENT:</strong> A Plataforma Oraculo Cultural, incluindo seu código-fonte, software, design, algoritmos de IA, modelos, metodologias, marcas e conteúdo didático (e-books, podcasts), são de propriedade exclusiva da MobCONTENT. O uso da Plataforma concede ao Usuário apenas uma licença de uso limitada e não exclusiva, revogável a qualquer tempo.
                  </p>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    <strong>5.2. Propriedade do Usuário:</strong> O Usuário retém a integral propriedade intelectual sobre os projetos, textos, orçamentos, notas fiscais e quaisquer dados e informações específicos do projeto ("Conteúdo do Usuário") carregados na Plataforma.
                  </p>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    <strong>5.3. Licença de Uso do Conteúdo:</strong> O Usuário concede à MobCONTENT uma licença limitada e não exclusiva para armazenar, processar e utilizar o Conteúdo do Usuário (incluindo o uso de dados anonimizados e agregados) com a única finalidade de prestar o serviço, realizar a gestão de conformidade, treinar e aprimorar os algoritmos de IA e gerar relatórios estatísticos.
                  </p>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">6. CONFIDENCIALIDADE E PRIVACIDADE</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    <strong>6.1.</strong> A MobCONTENT tratará o Conteúdo do Usuário como confidencial, utilizando medidas de segurança razoáveis para protegê-lo contra acesso, uso ou divulgação não autorizados.
                  </p>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    <strong>6.2.</strong> O tratamento de dados pessoais pela MobCONTENT é regido pela Política de Privacidade, que se encontra acessível em [Link para a Política de Privacidade] e cumpre com as disposições da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
                  </p>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">7. LIMITAÇÃO DE RESPONSABILIDADE</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    <strong>7.1.</strong> A MobCONTENT não se responsabiliza por:
                  </p>
                  <ul className="list-disc pl-6 mb-4 text-gray-700 leading-relaxed">
                    <li>Perdas ou danos resultantes da não aprovação de projetos ou da reprovação de prestações de contas, mesmo que o Usuário tenha seguido as sugestões ou análises da Plataforma.</li>
                    <li>Erros ou omissões no Conteúdo do Usuário que levem a inconsistências ou não conformidades.</li>
                    <li>Interrupções, falhas técnicas ou indisponibilidade temporária da Plataforma, embora se comprometa a tomar as medidas necessárias para o restabelecimento do serviço no menor prazo possível.</li>
                    <li>Quaisquer danos ou prejuízos decorrentes da má interpretação ou uso inadequado das informações fornecidas pela IA.</li>
                  </ul>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    <strong>7.2.</strong> A Plataforma é fornecida "no estado em que se encontra" (as is), sem garantias de que atenderá a todas as expectativas do Usuário ou que estará livre de erros.
                  </p>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">8. VIGÊNCIA E RESCISÃO</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    <strong>8.1.</strong> Estes Termos permanecem em vigor enquanto o Usuário mantiver uma conta ativa na Plataforma.
                  </p>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    <strong>8.2.</strong> A MobCONTENT poderá rescindir o acesso do Usuário, a qualquer momento e sem aviso prévio, em caso de violação destes Termos ou da legislação aplicável.
                  </p>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    <strong>8.3.</strong> O Usuário pode solicitar o encerramento de sua conta a qualquer momento, estando ciente de que a MobCONTENT poderá reter o Conteúdo do Usuário (incluindo dados e documentos) pelo prazo legal necessário para fins de auditoria e cumprimento de obrigações legais e regulatórias.
                  </p>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">9. DISPOSIÇÕES GERAIS</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    <strong>9.1.</strong> A MobCONTENT reserva-se o direito de modificar estes Termos a qualquer momento, mediante aviso prévio ao Usuário por e-mail ou notificação na própria Plataforma. A utilização contínua da Plataforma após a publicação das alterações constitui aceitação dos novos Termos.
                  </p>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    <strong>9.2.</strong> Estes Termos constituem o acordo integral entre o Usuário e a MobCONTENT em relação ao uso da Plataforma.
                  </p>

                  <h2 className="text-xl font-semibold text-gray-900 mb-4">10. LEI APLICÁVEL E FORO</h2>
                  <p className="mb-4 text-gray-700 leading-relaxed">
                    <strong>10.1.</strong> Estes Termos de Uso são regidos e interpretados de acordo com a legislação da República Federativa do Brasil.
                  </p>
                  <p className="mb-6 text-gray-700 leading-relaxed">
                    <strong>10.2.</strong> Fica eleito o Foro da Comarca de Rio de Janeiro, para dirimir quaisquer dúvidas ou litígios decorrentes destes Termos, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
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

export default Termos;
