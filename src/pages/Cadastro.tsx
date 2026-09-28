import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { trackLoginSuccess } from '@/lib/analytics';
import logo from '@/assets/logo.png';

const Cadastro = () => {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const iniciar = searchParams.get('iniciar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const resolveTarget = () => {
    let target = redirect && redirect.startsWith('/') ? redirect : '/';
    if (target !== '/' && (target === '/avaliar-projeto' || target.startsWith('/avaliar-projeto')) && iniciar) {
      target = target.includes('?') ? `${target}&iniciar=1` : `${target}?iniciar=1`;
    }
    return target;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, senha);
      trackLoginSuccess({ tipoLogin: 'email' });

      try {
        const db = getFirestore();
        const userDocRef = doc(db, 'usuarios', cred.user.uid);
        const timestamp = serverTimestamp();
        await updateDoc(userDocRef, {
          lastLoginAt: timestamp,
          ultimo_login: timestamp,
        });
      } catch (updateError) {
        console.warn('Erro ao atualizar último login:', updateError);
      }

      navigate(resolveTarget());
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setErro('E-mail ou senha incorretos.');
      } else if (code === 'auth/too-many-requests') {
        setErro('Muitas tentativas. Aguarde um pouco e tente novamente.');
      } else {
        setErro(err?.message || 'Erro ao entrar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFCF7] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#0088CB]/15 overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex flex-col items-center mb-6">
            <img
              src={logo}
              alt="Instituto dos Sonhos"
              className="w-28 h-28 md:w-32 md:h-32 object-contain"
            />
          </div>

          <h1 className="font-display text-xl md:text-2xl font-bold text-[#071F4E] mb-1">
            Entrar na sua conta
          </h1>
          <p className="text-[#1B4C41]/80 text-xs md:text-sm mb-6">
            Sonhos são para se viver
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[#071F4E]">E-mail</label>
              <input
                type="email"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] transition"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#071F4E]">Senha</label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] transition"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0088CB]/50"
                  aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {erro && <div className="text-[#ED1C24] text-sm text-center">{erro}</div>}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#0088CB] to-[#1B4C41] text-white py-2.5 rounded-lg font-semibold text-sm md:text-base shadow hover:opacity-90 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Cadastro;
