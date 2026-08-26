import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
// COMENTADO: Import de sendEmailVerification (confirmação de email desativada)
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider /*, sendEmailVerification */ } from 'firebase/auth';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Sparkles, CheckCircle2, Circle, Eye, EyeOff } from 'lucide-react';
import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { trackLoginSuccess, identifyMixpanelUser } from '@/lib/analytics';
import criarImage from '@/assets/Criar.jpeg';
import { Card, CardContent } from '@/components/ui/card';
import logo from '@/assets/logo.png';

const Cadastro = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const redirect = searchParams.get('redirect');
  const iniciar = searchParams.get('iniciar');
  const [isLogin, setIsLogin] = useState(mode === 'login');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [repitaSenha, setRepitaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [userUid, setUserUid] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showRepitaSenha, setShowRepitaSenha] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setErro('');
    setLoadingGoogle(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Verificar se o documento do usuário já existe
      const db = getFirestore();
      const userDocRef = doc(db, 'usuarios', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // Usuário novo - mostrar formulário para coletar nome e WhatsApp
        setUserUid(user.uid);
        setNomeCompleto(user.displayName || '');
        setWhatsapp('');
        setShowExtra(true);
        setLoadingGoogle(false);
        return;
      }

      // Usuário existente - verificar se tem nome completo e WhatsApp
      const userData = userDoc.data();
      const hasNomeCompleto = userData.nome_completo && userData.nome_completo.trim() !== '';
      const hasWhatsapp = userData.whatsapp && userData.whatsapp.trim() !== '';

      if (!hasNomeCompleto || !hasWhatsapp) {
        // Falta informação - mostrar formulário para completar
        setUserUid(user.uid);
        setNomeCompleto(userData.nome_completo || user.displayName || '');
        setWhatsapp(userData.whatsapp || '');
        setShowExtra(true);
        setLoadingGoogle(false);
        return;
      }

      // Usuário completo - atualizar último login e redirecionar
      const timestamp = serverTimestamp();
      await updateDoc(userDocRef, {
        lastLoginAt: timestamp,
        ultimo_login: timestamp,
      });

      // Track login success
      trackLoginSuccess({ tipoLogin: 'social' });

      let target = redirect && redirect.startsWith('/') ? redirect : '/';
      if (target !== '/' && (target === '/avaliar-projeto' || target.startsWith('/avaliar-projeto')) && iniciar) {
        target = target.includes('?') ? target + '&iniciar=1' : target + '?iniciar=1';
      }
      navigate(target);
    } catch (err: any) {
      console.error('Erro ao fazer login com Google:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErro('Login cancelado. Tente novamente.');
      } else {
        setErro(err.message || 'Erro ao fazer login com Google. Tente novamente.');
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  const validarForcaSenha = (senha: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    return regex.test(senha);
  };

  const senhaChecks = (s: string) => ({
    minLength: s.length >= 8,
    hasUpper: /[A-Z]/.test(s),
    hasLower: /[a-z]/.test(s),
    hasNumber: /\d/.test(s),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(s),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!isLogin && !aceitaTermos) {
      setErro('Você deve concordar com o Termo de Uso e a Política de Privacidade.');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, email, senha);
        // COMENTADO: Verificação de email confirmado
        // if (!cred.user.emailVerified) {
        //   navigate('/confirmar-email');
        //   return;
        // }
        
        // Track login success
        trackLoginSuccess({ tipoLogin: 'email' });
        
        // Atualizar lastLoginAt e ultimo_login
        try {
          const { getFirestore, doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
          const db = getFirestore();
          const userDocRef = doc(db, 'usuarios', cred.user.uid);
          const timestamp = serverTimestamp();
          await updateDoc(userDocRef, {
            lastLoginAt: timestamp,
            ultimo_login: timestamp,
          });
        } catch (updateError) {
          console.warn('Erro ao atualizar último login:', updateError);
          // Não bloquear o login se a atualização falhar
        }
        
        let target = redirect && redirect.startsWith('/') ? redirect : '/';
        if (target !== '/' && (target === '/avaliar-projeto' || target.startsWith('/avaliar-projeto')) && iniciar) {
          target = target.includes('?') ? target + '&iniciar=1' : target + '?iniciar=1';
        }
        navigate(target);
      } else {
        if (senha !== repitaSenha) {
          setErro('As senhas não coincidem.');
          setLoading(false);
          return;
        }
        if (!validarForcaSenha(senha)) {
          setErro('A senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial.');
          setLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        setUserUid(cred.user.uid);
        
        // COMENTADO: Envio de email de confirmação
        // console.log('👤 Usuário criado:', {
        //   uid: cred.user.uid,
        //   email: cred.user.email,
        //   emailVerified: cred.user.emailVerified
        // });
        // 
        // try {
        //   console.log('📧 Tentando enviar email de confirmação...');
        //   await sendEmailVerification(cred.user, {
        //     url: window.location.origin + '/confirmar-email',
        //     handleCodeInApp: false,
        //   });
        //   console.log('✅ Email de confirmação enviado com sucesso para:', email);
        //   console.log('📬 Verifique sua caixa de entrada e pasta de spam');
        // } catch (emailError: any) {
        //   console.error('❌ Erro ao enviar email de confirmação:', emailError);
        //   console.error('Detalhes do erro:', {
        //     code: emailError.code,
        //     message: emailError.message,
        //     stack: emailError.stack
        //   });
        //   
        //   if (emailError.code === 'auth/too-many-requests') {
        //     setErro('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
        //   } else {
        //     setErro(`Erro ao enviar email: ${emailError.message}. Você pode solicitar um novo email na página de confirmação.`);
        //   }
        //   setLoading(false);
        // }
        
        // Limpar campos antes de mostrar o formulário extra
        setNomeCompleto('');
        setWhatsapp('');
        setShowExtra(true);
      }
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Função para salvar dados adicionais (usada tanto para cadastro com email quanto login com Google)
  const handleExtraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    
    // Validar que os campos foram preenchidos
    const nomeCompletoTrimmed = nomeCompleto.trim();
    const whatsappTrimmed = whatsapp.trim();
    
    if (!nomeCompletoTrimmed) {
      setErro('Por favor, preencha o nome completo.');
      setLoading(false);
      return;
    }
    if (!whatsappTrimmed) {
      setErro('Por favor, preencha seu WhatsApp.');
      setLoading(false);
      return;
    }
    
    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'usuarios', userUid);
      
      // Verificar se o documento já existe (caso de login com Google)
      const userDoc = await getDoc(userDocRef);
      const timestamp = serverTimestamp();
      
      // Obter email do usuário autenticado ou do estado
      const currentUser = auth.currentUser;
      const userEmail = currentUser?.email || email;
      
      if (!userDoc.exists()) {
        // Criar novo documento (cadastro com email)
        const dadosParaSalvar = {
          createdAt: timestamp,
          creditos: 15,
          dadosCadastrais: '',
          data_cadastro: timestamp,
          email: userEmail,
          empresa: '',
          equipeBio: '',
          isPremium: false,
          lastLoginAt: timestamp,
          nome_completo: nomeCompletoTrimmed,
          origem: 'captacao',
          portfolio: '',
          role: 'super_admin',
          ultimo_login: timestamp,
          uid: userUid,
          whatsapp: whatsappTrimmed,
        };
        
        await setDoc(userDocRef, dadosParaSalvar);
        if (redirect && redirect.startsWith('/')) {
          let target = redirect;
          if ((target === '/avaliar-projeto' || target.startsWith('/avaliar-projeto')) && iniciar) {
            target = target.includes('?') ? target + '&iniciar=1' : target + '?iniciar=1';
          }
          navigate(target);
        } else {
          navigate('/', { state: { showCadastroSuccess: true } });
        }
      } else {
        // Atualizar documento existente (login com Google que precisa completar dados)
        await updateDoc(userDocRef, {
          nome_completo: nomeCompletoTrimmed,
          whatsapp: whatsappTrimmed,
          lastLoginAt: timestamp,
          ultimo_login: timestamp,
        });
        
        // Track login success se for login com Google
        if (currentUser) {
          trackLoginSuccess({ tipoLogin: 'social' });
        }
        if (redirect && redirect.startsWith('/')) {
          let target = redirect;
          if ((target === '/avaliar-projeto' || target.startsWith('/avaliar-projeto')) && iniciar) {
            target = target.includes('?') ? target + '&iniciar=1' : target + '?iniciar=1';
          }
          navigate(target);
        } else {
          navigate('/');
        }
      }
    } catch (err: any) {
      console.error('Erro ao salvar informações:', err);
      setErro('Erro ao salvar informações adicionais.');
    } finally {
      setLoading(false);
    }
  };

  if (showExtra) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-oraculo-blue/10 via-white to-oraculo-purple/10 p-4">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-r from-oraculo-magenta to-oraculo-gold rounded-lg flex items-center justify-center mb-2">
              <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 text-center">Precisamos de mais algumas informações suas</h1>
            <p className="text-gray-500 text-xs md:text-sm text-center">
              {auth.currentUser ? 'Complete seu perfil para continuar' : 'Preencha para completar seu cadastro'}
            </p>
          </div>
          <form onSubmit={handleExtraSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Nome completo</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                value={nomeCompleto}
                onChange={e => setNomeCompleto(e.target.value)}
                placeholder="Ex: Chiquinha Gonzaga"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">WhatsApp</label>
              <input
                type="tel"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="Ex: (21) 99999-9999"
              />
            </div>
            {erro && <div className="text-red-500 text-sm text-center">{erro}</div>}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white py-2.5 rounded-lg font-semibold text-sm md:text-base shadow hover:opacity-90 transition"
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Finalizar cadastro'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-oraculo-blue/10 via-white to-oraculo-purple/10 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${isLogin ? 'max-w-md' : 'max-w-5xl'} border border-gray-100 overflow-hidden`}>
        <div className={`grid gap-0 ${isLogin ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
          {/* Coluna da Esquerda - Vídeo e Box IA (apenas no modo cadastro) */}
          {!isLogin && (
            <div className="hidden md:flex flex-col p-8 bg-gradient-to-br from-oraculo-blue/5 to-oraculo-purple/5 space-y-6">
              {/* Vídeo do YouTube */}
              <div className="w-full rounded-xl overflow-hidden shadow-lg">
                <div className="relative" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src="https://www.youtube.com/embed/3bCt7Hjb5tk"
                    title="Oráculo Cultural - Inteligência Artificial"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
              
              {/* Box Informativo */}
              <Card className="border-2 border-oraculo-blue/20 shadow-xl overflow-hidden bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-oraculo-blue to-oraculo-purple rounded-xl flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      Transforme seu projeto com Inteligência Artificial
                    </h3>
                  </div>
                  
                  <p className="text-gray-600 text-base mb-6">
                    O Oráculo Cultural utiliza IA de última geração para analisar, otimizar e aumentar as chances de aprovação do seu projeto cultural. Veja como podemos ajudar:
                  </p>
                  
                  {/* Lista de features */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-oraculo-blue flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">Análise inteligente do seu projeto contra os critérios do edital</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-oraculo-blue flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">Geração automática de textos otimizados (justificativa, objetivos, metodologia)</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-oraculo-blue flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">Sugestões personalizadas de melhorias baseadas no seu portfolio</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-oraculo-blue flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">Avaliação de aderência com nota estimada</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-oraculo-blue flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">Aplicação instantânea das sugestões da IA</span>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 rounded-lg p-4 text-center">
                    <p className="text-sm font-medium text-gray-800 mb-2">
                      Área restrita para usuários cadastrados.
                    </p>
                    <p className="text-sm font-semibold text-oraculo-blue">
                      Crie sua conta - é gratuito!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Coluna da Direita - Formulário */}
          <div className="p-6 md:p-8">
            {isLogin && (
              <div className="flex flex-col items-center mb-6">
                <img 
                  src={logo} 
                  alt="Oráculo Cultural Logo" 
                  className="w-24 h-24 md:w-28 md:h-28 object-contain"
                />
              </div>
            )}
            
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
              {isLogin ? 'Entrar na sua conta' : 'Para acessar, é necessário criar uma conta'}
            </h1>
            {isLogin ? (
              <p className="text-gray-500 text-xs md:text-sm mb-6">
                Acesse sua área exclusiva
              </p>
            ) : (
              <p className="text-oraculo-blue font-semibold text-base md:text-lg mb-6">
                É gratuito!
              </p>
            )}
        {/* Botão Google Sign In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loadingGoogle || loading}
          className="w-full flex items-center justify-center gap-3 border-2 border-gray-300 text-gray-700 py-2.5 rounded-lg font-semibold text-sm md:text-base shadow hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {loadingGoogle ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700"></div>
              <span>Processando...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continuar com Google</span>
            </>
          )}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">ou</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">E-mail</label>
            <input
              type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Senha</label>
            <div className="relative">
              <input
                type={showSenha ? 'text' : 'password'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowSenha(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-oraculo-blue/50"
                aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!isLogin && (
              <div className="mt-2 space-y-1.5">
                {(() => {
                  const c = senhaChecks(senha);
                  const items: { key: keyof typeof c; label: string }[] = [
                    { key: 'minLength', label: 'Pelo menos 8 caracteres' },
                    { key: 'hasUpper', label: 'Uma letra maiúscula' },
                    { key: 'hasLower', label: 'Uma letra minúscula' },
                    { key: 'hasNumber', label: 'Um número' },
                    { key: 'hasSpecial', label: 'Um caractere especial (!@#$%^&* etc.)' },
                  ];
                  return items.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      {c[key] ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
                      ) : (
                        <Circle className="h-4 w-4 flex-shrink-0 text-gray-300" />
                      )}
                      <span className={c[key] ? 'text-gray-700' : 'text-gray-500'}>{label}</span>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Repita a senha</label>
              <div className="relative">
                <input
                  type={showRepitaSenha ? 'text' : 'password'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                  value={repitaSenha}
                  onChange={e => setRepitaSenha(e.target.value)}
                  required={!isLogin}
                />
                <button
                  type="button"
                  onClick={() => setShowRepitaSenha(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-oraculo-blue/50"
                  aria-label={showRepitaSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showRepitaSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          {!isLogin && (
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="termos"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-oraculo-blue focus:ring-oraculo-blue"
                  checked={aceitaTermos}
                  onChange={e => setAceitaTermos(e.target.checked)}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="termos" className="text-gray-600">
                  Concordo com o <Link to="/termos" className="text-oraculo-blue hover:underline">Termo de Uso</Link> e a <Link to="/privacidade" className="text-oraculo-blue hover:underline">Política de Privacidade</Link>.
                </label>
              </div>
            </div>
          )}
          {erro && <div className="text-red-500 text-sm text-center">{erro}</div>}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white py-2.5 rounded-lg font-semibold text-sm md:text-base shadow hover:opacity-90 transition"
            disabled={loading}
          >
            {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        <div className="mt-6 text-center text-sm">
          <span className="text-gray-600">
            {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
          </span>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setErro('');
            }}
            className="text-oraculo-blue font-medium hover:underline"
          >
            {isLogin ? 'Criar conta' : 'Fazer login'}
          </button>
        </div>

            {/* Vídeo e Box IA – apenas mobile, após o formulário (modo cadastro) */}
            {!isLogin && (
              <div className="md:hidden mt-8 space-y-4">
                <div className="w-full rounded-xl overflow-hidden shadow-lg">
                  <div className="relative" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      className="absolute top-0 left-0 w-full h-full"
                      src="https://www.youtube.com/embed/3bCt7Hjb5tk"
                      title="Oráculo Cultural - Inteligência Artificial"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
                <Card className="border-2 border-oraculo-blue/20 shadow-xl overflow-hidden bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-oraculo-blue to-oraculo-purple rounded-xl flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Transforme seu projeto com Inteligência Artificial
                      </h3>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">
                      O Oráculo Cultural utiliza IA de última geração para analisar, otimizar e aumentar as chances de aprovação do seu projeto cultural. Veja como podemos ajudar:
                    </p>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-oraculo-blue flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-xs">Análise inteligente do seu projeto contra os critérios do edital</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-oraculo-blue flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-xs">Geração automática de textos otimizados (justificativa, objetivos, metodologia)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-oraculo-blue flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-xs">Sugestões personalizadas de melhorias baseadas no seu portfolio</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-oraculo-blue flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-xs">Avaliação de aderência com nota estimada</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-oraculo-blue flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-xs">Aplicação instantânea das sugestões da IA</span>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 rounded-lg p-3 text-center">
                      <p className="text-xs font-medium text-gray-800 mb-1">
                        Área restrita para usuários cadastrados.
                      </p>
                      <p className="text-xs font-semibold text-oraculo-blue">
                        Crie sua conta - é gratuito!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cadastro;