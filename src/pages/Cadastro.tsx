import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
// COMENTADO: Import de sendEmailVerification (confirmação de email desativada)
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider /*, sendEmailVerification */ } from 'firebase/auth';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Sparkles, CheckCircle2, Circle, Eye, EyeOff } from 'lucide-react';
import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { trackLoginSuccess, identifyMixpanelUser, trackCompleteRegistration } from '@/lib/analytics';
import {
  trackMetaCompleteRegistration,
  trackMetaCompleteRegistrationAndWait,
} from '@/lib/metaPixel';
import {
  buildNovoUsuarioFirestore,
  bumpAccessCountIfNewSession,
  deveMostrarFormularioPerfil,
} from '@/lib/perfilUsuario';
import { Card, CardContent } from '@/components/ui/card';
import {
  clearCadastroCelebrationPending,
  markCadastroCelebrationPending,
} from '@/lib/cadastroCelebration';
import {
  captureLandingAttributionFromSearchParams,
  isCadastroFunnelContext,
  landingAttributionForFirestore,
  markLandingResumeMessage,
} from '@/lib/landingAttribution';
import logo from '@/assets/logo.png';

const YOUTUBE_APRESENTACAO_URL = 'https://www.youtube.com/watch?v=3bCt7Hjb5tk';

function CadastroBeneficiosAside({ compact }: { compact?: boolean }) {
  return (
    <Card className="border-2 border-oraculo-blue/20 shadow-xl overflow-hidden bg-white">
      <CardContent className={compact ? 'p-4' : 'p-6'}>
        <div className={`flex items-center gap-3 ${compact ? 'mb-3' : 'mb-4'}`}>
          <div
            className={`bg-gradient-to-r from-oraculo-blue to-oraculo-purple rounded-xl flex items-center justify-center flex-shrink-0 ${
              compact ? 'w-10 h-10' : 'w-12 h-12'
            }`}
          >
            <Sparkles className={compact ? 'h-5 w-5 text-white' : 'h-6 w-6 text-white'} />
          </div>
          <h2 className={`font-bold text-gray-900 ${compact ? 'text-lg' : 'text-2xl'}`}>
            Transforme seu projeto com Inteligência Artificial
          </h2>
        </div>

        <p className={`text-gray-600 ${compact ? 'text-sm mb-4' : 'text-base mb-6'}`}>
          O Oráculo Cultural utiliza IA para analisar, otimizar e aumentar as chances de aprovação do seu
          projeto cultural.
        </p>

        <ul className={`space-y-2 ${compact ? 'mb-4 text-xs' : 'mb-6 text-sm'} list-none`}>
          {[
            'Análise inteligente do seu projeto contra os critérios do edital',
            'Geração automática de textos otimizados (justificativa, objetivos, metodologia)',
            'Sugestões personalizadas de melhorias',
            'Avaliação de aderência com nota estimada',
            'Aplicação instantânea das sugestões da IA',
          ].map((text) => (
            <li key={text} className="flex items-start gap-2">
              <CheckCircle2
                className={`text-oraculo-blue flex-shrink-0 mt-0.5 ${compact ? 'h-4 w-4' : 'h-5 w-5'}`}
                aria-hidden
              />
              <span className="text-gray-700">{text}</span>
            </li>
          ))}
        </ul>

        <div
          className={`bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 rounded-lg text-center ${
            compact ? 'p-3' : 'p-4'
          }`}
        >
          <p className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
            Cadastro gratuito · 30 créditos para começar
          </p>
          <p className={`text-gray-600 mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
            Crie sua conta em poucos minutos e continue de onde parou.
          </p>
        </div>

        <p className={`text-center ${compact ? 'mt-3 text-xs' : 'mt-4 text-sm'}`}>
          <a
            href={YOUTUBE_APRESENTACAO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-oraculo-blue font-medium hover:underline"
          >
            Ver vídeo de apresentação no YouTube
          </a>
        </p>
      </CardContent>
    </Card>
  );
}

const Cadastro = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const redirect = searchParams.get('redirect');
  const [isLogin, setIsLogin] = useState(mode === 'login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [repitaSenha, setRepitaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [userUid, setUserUid] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showRepitaSenha, setShowRepitaSenha] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const navigate = useNavigate();

  const finishNewUserSignup = (
    redirectPath?: string | null,
    registrationMethod: 'email' | 'google' = 'email',
    userId?: string,
  ) => {
    trackCompleteRegistration({ registrationMethod, userId });
    const target = redirectPath && redirectPath.startsWith('/') ? redirectPath : '/';
    const funnelResume =
      target.includes('criar-projeto') &&
      (target.includes('continuar') || target.includes('origem=landing'));
    if (funnelResume) {
      clearCadastroCelebrationPending();
      markLandingResumeMessage('Recuperamos seu projeto, avaliando agora…');
      navigate(target, { replace: true });
      return;
    }
    markCadastroCelebrationPending(target === '/' ? undefined : target);
    navigate('/');
  };

  useEffect(() => {
    captureLandingAttributionFromSearchParams(searchParams);
    try {
      const fromLanding = sessionStorage.getItem('oraculo_landing_email')?.trim();
      if (fromLanding) setEmail((prev) => prev || fromLanding);
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  const cadastroFunnel = !isLogin && isCadastroFunnelContext(searchParams, redirect);
  const attributionFields = landingAttributionForFirestore();

  const completarPerfil = searchParams.get('completar') === 'perfil';

  useEffect(() => {
    if (!completarPerfil) return;
    const current = auth.currentUser;
    if (!current) return;
    setUserUid(current.uid);
    setShowExtra(true);
    void (async () => {
      const db = getFirestore();
      const snap = await getDoc(doc(db, 'usuarios', current.uid));
      if (snap.exists()) {
        const data = snap.data();
        setNomeCompleto(data.nome_completo || current.displayName || '');
        setEmpresa(data.empresa || '');
      }
    })();
  }, [completarPerfil]);

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

      const timestamp = serverTimestamp();

      if (!userDoc.exists()) {
        await setDoc(
          userDocRef,
          buildNovoUsuarioFirestore({
            uid: user.uid,
            email: user.email || '',
            nomeCompletoInicial: user.displayName || '',
            timestamp,
            attribution: attributionFields,
          }),
          { merge: true },
        );
        await trackMetaCompleteRegistrationAndWait(user.email || undefined, user.uid);
        finishNewUserSignup(redirect, 'google', user.uid);
        setLoadingGoogle(false);
        return;
      }

      const userData = userDoc.data();
      const access = bumpAccessCountIfNewSession(user.uid);
      if (deveMostrarFormularioPerfil(userData, access)) {
        const target = redirect && redirect.startsWith('/') ? redirect : '/';
        navigate(`/cadastro?completar=perfil&redirect=${encodeURIComponent(target)}`);
        setLoadingGoogle(false);
        return;
      }

      await updateDoc(userDocRef, {
        lastLoginAt: timestamp,
        ultimo_login: timestamp,
      });

      trackLoginSuccess({ tipoLogin: 'social' });

      const target = redirect && redirect.startsWith('/') ? redirect : '/';
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
        trackLoginSuccess({ tipoLogin: 'email' });

        const db = getFirestore();
        const userDocRef = doc(db, 'usuarios', cred.user.uid);
        const timestamp = serverTimestamp();
        const userSnap = await getDoc(userDocRef);
        const access = bumpAccessCountIfNewSession(cred.user.uid);
        const target = redirect && redirect.startsWith('/') ? redirect : '/';

        if (userSnap.exists() && deveMostrarFormularioPerfil(userSnap.data(), access)) {
          navigate(`/cadastro?completar=perfil&redirect=${encodeURIComponent(target)}`);
          setLoading(false);
          return;
        }

        try {
          await updateDoc(userDocRef, {
            lastLoginAt: timestamp,
            ultimo_login: timestamp,
          });
        } catch (updateError) {
          console.warn('Erro ao atualizar último login:', updateError);
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

        const db = getFirestore();
        const userDocRef = doc(db, 'usuarios', cred.user.uid);
        const timestamp = serverTimestamp();
        await setDoc(
          userDocRef,
          buildNovoUsuarioFirestore({
            uid: cred.user.uid,
            email: cred.user.email || email,
            timestamp,
            attribution: attributionFields,
          }),
          { merge: true },
        );
        await trackMetaCompleteRegistrationAndWait(cred.user.email || email, cred.user.uid);
        setLoading(false);
        finishNewUserSignup(redirect, 'email', cred.user.uid);
        return;

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
    const empresaTrimmed = empresa.trim();
    
    if (!nomeCompletoTrimmed) {
      setErro('Por favor, preencha o nome completo.');
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
        await setDoc(
          userDocRef,
          {
            ...buildNovoUsuarioFirestore({
              uid: userUid,
              email: userEmail,
              timestamp,
              attribution: attributionFields,
            }),
            nome_completo: nomeCompletoTrimmed,
            empresa: empresaTrimmed || '',
            perfil_dados_coletados: true,
          },
          { merge: true },
        );
        trackMetaCompleteRegistration(userEmail, userUid);
        finishNewUserSignup(redirect, 'email', userUid);
      } else {
        const isNewUser = !userDoc.data()?.nome_completo || !userDoc.data()?.empresa;
        await updateDoc(userDocRef, {
          nome_completo: nomeCompletoTrimmed,
          empresa: empresaTrimmed || '',
          perfil_dados_coletados: true,
          lastLoginAt: timestamp,
          ultimo_login: timestamp,
        });
        if (currentUser) {
          trackLoginSuccess({ tipoLogin: 'social' });
          if (isNewUser) {
            trackMetaCompleteRegistration(userEmail, userUid);
            finishNewUserSignup(redirect, 'google', userUid);
            return;
          }
        }
        const target = redirect && redirect.startsWith('/') ? redirect : '/';
        navigate(target);
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
              Complete seu perfil para personalizar sua experiência na plataforma
            </p>
          </div>
          <form onSubmit={handleExtraSubmit} className="space-y-4">
            <div>
              <label htmlFor="cadastro-nome-completo" className="block text-sm font-medium mb-1 text-gray-700">
                Nome completo
              </label>
              <input
                id="cadastro-nome-completo"
                name="nomeCompleto"
                type="text"
                autoComplete="name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                value={nomeCompleto}
                onChange={e => setNomeCompleto(e.target.value)}
                placeholder="Ex: Chiquinha Gonzaga"
                required
              />
            </div>
            <div>
              <label htmlFor="cadastro-empresa" className="block text-sm font-medium mb-1 text-gray-700">
                Empresa <span className="text-gray-400 text-xs">(opcional)</span>
              </label>
              <input
                id="cadastro-empresa"
                name="empresa"
                type="text"
                autoComplete="organization"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                value={empresa}
                onChange={e => setEmpresa(e.target.value)}
                placeholder="Ex: Alalaô produções"
              />
            </div>
            {erro && <div className="text-red-500 text-sm text-center">{erro}</div>}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white py-2.5 rounded-lg font-semibold text-sm md:text-base shadow hover:opacity-90 transition"
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Salvar e continuar'}
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
            <div className="hidden md:flex flex-col p-6 lg:p-8 bg-gradient-to-br from-oraculo-blue/5 to-oraculo-purple/5 justify-center">
              <CadastroBeneficiosAside />
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
              {isLogin
                ? 'Entrar na sua conta'
                : cadastroFunnel
                  ? 'Sua avaliação está pronta, falta só criar a conta'
                  : 'Crie sua conta gratuita'}
            </h1>
            {isLogin ? (
              <p className="text-gray-500 text-xs md:text-sm mb-6">
                Acesse sua área exclusiva
              </p>
            ) : cadastroFunnel ? (
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-oraculo-blue/30 bg-oraculo-blue/5 px-3 py-1.5 text-sm font-semibold text-oraculo-purple">
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                30 créditos grátis, sem cartão
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
            <label htmlFor="cadastro-email" className="block text-sm font-medium mb-1 text-gray-700">
              E-mail
            </label>
            <input
              id="cadastro-email"
              name="email"
              type="email"
              autoComplete="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="cadastro-senha" className="block text-sm font-medium mb-1 text-gray-700">
              Senha
            </label>
            <div className="relative">
              <input
                id="cadastro-senha"
                name="senha"
                type={showSenha ? 'text' : 'password'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                aria-describedby={!isLogin ? 'cadastro-requisitos-senha' : undefined}
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
              <div id="cadastro-requisitos-senha" className="mt-2 space-y-1.5" role="group" aria-label="Requisitos da senha">
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
              <label htmlFor="cadastro-repita-senha" className="block text-sm font-medium mb-1 text-gray-700">
                Repita a senha
              </label>
              <div className="relative">
                <input
                  id="cadastro-repita-senha"
                  name="repitaSenha"
                  type={showRepitaSenha ? 'text' : 'password'}
                  autoComplete="new-password"
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
              <div className="md:hidden mt-8">
                <CadastroBeneficiosAside compact />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cadastro;