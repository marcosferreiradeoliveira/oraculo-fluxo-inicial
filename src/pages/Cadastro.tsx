import React, { useState } from 'react';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

const Cadastro = () => {
  const [isLogin, setIsLogin] = useState(false);
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
        await signInWithEmailAndPassword(auth, email, senha);
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
    try {
      const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const db = getFirestore();
      const docRef = await addDoc(collection(db, 'usuarios'), {
        nome_completo: nomeCompleto,
        empresa: empresa,
        data_cadastro: serverTimestamp(),
        ultimo_login: serverTimestamp(),
        isPremium: false,
        email: email,
        uid: userUid,
      });
      console.log('Usuário criado no Firestore com ID:', docRef.id);
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
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Empresa</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                value={empresa}
                onChange={e => setEmpresa(e.target.value)}
                required
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
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <Link to="/" className="flex flex-col items-center mb-6 group cursor-pointer">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-r from-oraculo-magenta to-oraculo-gold rounded-lg flex items-center justify-center mb-2 group-hover:scale-105 transition">
            <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-white" />
          </div>
          <span className="text-base md:text-lg font-bold text-oraculo-blue group-hover:underline">Oráculo Cultural</span>
        </Link>
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
  );
};

export default Cadastro;