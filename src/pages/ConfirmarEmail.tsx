import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { sendEmailVerification, reload } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import emailImg from '@/assets/email.png';

const ConfirmarEmail = () => {
  const [user, loading] = useAuthState(auth);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar periodicamente se o email foi confirmado
    if (user && !user.emailVerified) {
      const interval = setInterval(async () => {
        try {
          await reload(user);
          // Recarregar o estado do usuário após reload
          const updatedUser = auth.currentUser;
          if (updatedUser?.emailVerified) {
            navigate('/');
          }
        } catch (error) {
          console.error('Erro ao recarregar usuário:', error);
        }
      }, 3000); // Verifica a cada 3 segundos

      return () => clearInterval(interval);
    }
  }, [user, navigate]);

  const handleReenviarEmail = async () => {
    if (!user) return;
    
    setEnviando(true);
    setErro('');
    setEnviado(false);

    try {
      console.log('📧 Tentando reenviar email de confirmação para:', user.email);
      await sendEmailVerification(user, {
        url: window.location.origin + '/confirmar-email',
        handleCodeInApp: false,
      });
      console.log('✅ Email de confirmação reenviado com sucesso para:', user.email);
      console.log('📬 Verifique sua caixa de entrada e pasta de spam');
      setEnviado(true);
    } catch (error: any) {
      console.error('❌ Erro ao reenviar email:', error);
      console.error('Detalhes do erro:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      if (error.code === 'auth/too-many-requests') {
        setErro('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
      } else {
        setErro(error.message || 'Erro ao enviar email de confirmação. Tente novamente.');
      }
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-oraculo-blue mx-auto" />
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (user.emailVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-oraculo-blue/10 via-white to-oraculo-purple/10 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Confirmado!</h1>
          <p className="text-gray-600 mb-6">Seu email foi confirmado com sucesso. Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-oraculo-blue/10 via-white to-oraculo-purple/10 p-4">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl max-w-5xl w-full">
        {/* Box de Boas-vindas */}
        <div className="bg-gradient-to-br from-oraculo-blue/5 to-oraculo-purple/5 border-2 border-oraculo-blue/20 rounded-xl p-6 md:p-8 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Coluna da Imagem */}
            <div className="flex justify-center items-center">
              <img 
                src={emailImg} 
                alt="Email" 
                className="h-64 md:h-80 w-auto object-contain"
              />
            </div>
            
            {/* Coluna do Conteúdo */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                Bem-vindo ao Oráculo Cultural!
              </h1>
              <p className="text-lg text-gray-700 mb-6">
                Estamos felizes em tê-lo conosco. Aqui você pode:
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-oraculo-blue/10 rounded-full flex items-center justify-center mr-4 mt-0.5">
                    <span className="text-oraculo-blue font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Criar e gerenciar projetos culturais</h3>
                    <p className="text-gray-600 text-sm">Desenvolva seus projetos com a ajuda da inteligência artificial</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-oraculo-blue/10 rounded-full flex items-center justify-center mr-4 mt-0.5">
                    <span className="text-oraculo-blue font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Avaliar projetos com IA</h3>
                    <p className="text-gray-600 text-sm">Receba análises detalhadas e sugestões de melhoria para seus projetos</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-oraculo-blue/10 rounded-full flex items-center justify-center mr-4 mt-0.5">
                    <span className="text-oraculo-blue font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Gerar textos automaticamente</h3>
                    <p className="text-gray-600 text-sm">Crie justificativas, objetivos, metodologias e outros textos necessários</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-oraculo-blue/10 rounded-full flex items-center justify-center mr-4 mt-0.5">
                    <span className="text-oraculo-blue font-bold">4</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Acessar inteligência de mercado</h3>
                    <p className="text-gray-600 text-sm">Fique por dentro de editais, podcasts, guias e muito mais</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Seção de Confirmação - Largura Total */}
          <div className="mt-8">
            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 flex-1">
                  <p className="font-semibold mb-2">Para começar, confirme seu email:</p>
                  <p className="mb-2">Enviamos um email de confirmação para <strong>{user.email}</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2 mb-3">
                    <li>Verifique sua caixa de entrada (e a pasta de spam)</li>
                    <li>Clique no link de confirmação no email</li>
                    <li>Volte aqui e sua conta estará ativada automaticamente</li>
                  </ol>
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                    <p className="text-xs text-yellow-800 font-semibold mb-1">⚠️ Não recebeu o email?</p>
                    <ul className="text-xs text-yellow-800 list-disc list-inside space-y-1">
                      <li>Verifique a pasta de spam/lixo eletrônico</li>
                      <li>O email pode levar alguns minutos para chegar</li>
                      <li>Clique no botão abaixo para reenviar</li>
                      <li>Verifique se o email está correto: <strong>{user.email}</strong></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {enviado && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <p className="text-sm text-green-800">Email reenviado com sucesso! Verifique sua caixa de entrada.</p>
                </div>
              </div>
            )}

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-sm text-red-800">{erro}</p>
                </div>
              </div>
            )}

            {/* Botão de Confirmar Email */}
            <div className="text-center">
              <Button
                onClick={handleReenviarEmail}
                disabled={enviando}
                size="lg"
                className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90 text-white px-8 py-6 text-lg font-semibold shadow-lg"
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="h-5 w-5 mr-2" />
                    Confirmar email para ter acesso
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-500 mt-4">
                Não recebeu o email? Verifique sua pasta de spam ou clique no botão acima para reenviar.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmarEmail;

