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
      await addDoc(collection(db, 'usuarios'), {
        nome_completo: nomeCompleto,
        empresa: empresa,
        data_cadastro: serverTimestamp(),
        ultimo_login: serverTimestamp(),
        premium: false,
        email: email,
        uid: userUid,
      });
      navigate('/');
    } catch (err: any) {
      setErro('Erro ao salvar informações adicionais.');
    } finally {
      setLoading(false);
    }
  };

  if (showExtra) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-oraculo-blue/10 via-white to-oraculo-purple/10">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-r from-oraculo-magenta to-oraculo-gold rounded-lg flex items-center justify-center mb-2">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">Precisamos de mais algumas informações suas</h1>
            <p className="text-gray-500 text-sm text-center">Preencha para completar seu cadastro</p>
          </div>
          <form onSubmit={handleExtraSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Nome completo</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                value={nomeCompleto}
                onChange={e => setNomeCompleto(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Empresa</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                value={empresa}
                onChange={e => setEmpresa(e.target.value)}
                required
              />
            </div>
            {erro && <div className="text-red-500 text-sm text-center">{erro}</div>}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white py-2.5 rounded-lg font-semibold shadow hover:opacity-90 transition"
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-oraculo-blue/10 via-white to-oraculo-purple/10">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <Link to="/" className="flex flex-col items-center mb-6 group cursor-pointer">
          <div className="w-14 h-14 bg-gradient-to-r from-oraculo-magenta to-oraculo-gold rounded-lg flex items-center justify-center mb-2 group-hover:scale-105 transition">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <span className="text-lg font-bold text-oraculo-blue group-hover:underline">Oráculo Cultural</span>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {isLogin ? 'Entrar na sua conta' : 'Criar conta'}
          </h1>
          <p className="text-gray-500 text-sm">
            {isLogin ? 'Acesse sua área exclusiva' : 'Comece a usar o Oráculo Cultural'}
          </p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">E-mail</label>
            <input
              type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Senha</label>
            <input
              type="password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
            />
            {!isLogin && (
              <ul className="text-xs text-gray-500 mt-1 ml-1 list-disc list-inside space-y-0.5">
                <li>Mínimo 8 caracteres</li>
                <li>Pelo menos uma letra maiúscula</li>
                <li>Pelo menos uma letra minúscula</li>
                <li>Pelo menos um número</li>
                <li>Pelo menos um caractere especial</li>
              </ul>
            )}
          </div>
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Repita a senha</label>
              <input
                type="password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-oraculo-blue focus:border-oraculo-blue transition"
                value={repitaSenha}
                onChange={e => setRepitaSenha(e.target.value)}
                required
              />
            </div>
          )}
          {!isLogin && (
            <div className="flex items-start gap-2 mt-2">
              <input
                type="checkbox"
                id="termos"
                checked={aceitaTermos}
                onChange={e => setAceitaTermos(e.target.checked)}
                className="mt-1"
                required
              />
              <label htmlFor="termos" className="text-xs text-gray-600 select-none">
                Estou de acordo com o
                <a href="/termo-de-uso" target="_blank" rel="noopener noreferrer" className="text-oraculo-blue underline mx-1">Termo de Uso</a>
                e
                <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-oraculo-blue underline mx-1">Política de Privacidade</a>.
              </label>
            </div>
          )}
          {erro && <div className="text-red-500 text-sm text-center">{erro}</div>}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white py-2.5 rounded-lg font-semibold shadow hover:opacity-90 transition"
            disabled={loading}
          >
            {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        {!isLogin && (
          <div className="mt-4 text-center text-xs text-gray-500">
            Ao criar uma conta, você concorda com o
            <a href="/termo-de-uso" target="_blank" rel="noopener noreferrer" className="text-oraculo-blue underline mx-1">Termo de Uso</a>
            e a
            <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-oraculo-blue underline mx-1">Política de Privacidade</a>.
          </div>
        )}
        <div className="mt-6 text-center">
          <button
            className="text-oraculo-blue hover:underline text-sm font-medium"
            onClick={() => { setIsLogin(!isLogin); setErro(''); }}
          >
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cadastro; 