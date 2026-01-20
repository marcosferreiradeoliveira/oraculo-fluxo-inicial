import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
// COMENTADO: Import de sendEmailVerification (confirmação de email desativada)
import { createUserWithEmailAndPassword, signInWithEmailAndPassword /*, sendEmailVerification */ } from 'firebase/auth';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { trackLoginSuccess, identifyMixpanelUser } from '@/lib/analytics';
import criarImage from '@/assets/Criar.jpeg';
import { Card, CardContent } from '@/components/ui/card';
import logo from '@/assets/logo.png';

const Cadastro = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
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
  const navigate = useNavigate();

  const validarForcaSenha = (senha: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    return regex.test(senha);
  };

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
        
        navigate('/');
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
        setEmpresa('');
        setShowExtra(true);
      }
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Função para salvar dados adicionais
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
    
    console.log('📝 Valores antes de salvar:');
    console.log('  - nomeCompleto:', nomeCompletoTrimmed);
    console.log('  - empresa:', empresaTrimmed);
    console.log('  - email:', email);
    console.log('  - userUid:', userUid);
    
    try {
      const { getFirestore, doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const db = getFirestore();
      const userDocRef = doc(db, 'usuarios', userUid);
      
      const timestamp = serverTimestamp();
      const dadosParaSalvar = {
        createdAt: timestamp,
        dadosCadastrais: '',
        data_cadastro: timestamp,
        email: email,
        empresa: empresaTrimmed || '',
        equipeBio: '',
        isPremium: false,
        lastLoginAt: timestamp,
        nome_completo: nomeCompletoTrimmed,
        origem: 'captacao',
        portfolio: '',
        role: 'super_admin',
        ultimo_login: timestamp,
        uid: userUid,
      };
      
      console.log('💾 Dados que serão salvos:', dadosParaSalvar);
      
      await setDoc(userDocRef, dadosParaSalvar);
      console.log('✅ Usuário criado no Firestore com ID:', userUid);
      
      // COMENTADO: Redirecionamento para confirmação de email
      // navigate('/confirmar-email');
      navigate('/');
    } catch (err: any) {
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
            <p className="text-gray-500 text-xs md:text-sm text-center">Preencha para completar seu cadastro</p>
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
              <label className="block text-sm font-medium mb-1 text-gray-700">Empresa <span className="text-gray-400 text-xs">(opcional)</span></label>
              <input
                type="text"
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
            <div className="flex flex-col items-center mb-6">
              <img 
                src={logo} 
                alt="Oráculo Cultural Logo" 
                className="w-24 h-24 md:w-28 md:h-28 object-contain"
              />
            </div>
            
            {/* Vídeo e Mensagem para área restrita (apenas mobile) */}
            {!isLogin && (
              <div className="md:hidden mb-6 space-y-4">
                {/* Vídeo do YouTube - Mobile */}
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
                
                {/* Box Informativo - Mobile */}
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
                    
                    {/* Lista de features - Mobile */}
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
            
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
              {isLogin ? 'Entrar na sua conta' : 'Criar conta'}
            </h1>
            <p className="text-gray-500 text-xs md:text-sm mb-6">
              {isLogin ? 'Acesse sua área exclusiva' : 'Comece a usar o Oráculo Cultural'}
            </p>
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
            <input
              type="password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
            />
          </div>
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Repita a senha</label>
              <input
                type="password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                value={repitaSenha}
                onChange={e => setRepitaSenha(e.target.value)}
                required={!isLogin}
              />
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cadastro;