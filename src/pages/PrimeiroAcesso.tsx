import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  aceitarConviteAutenticadoCallable,
  concluirPrimeiroAcessoConviteCallable,
  consultarTokenPrimeiroAcessoCallable,
  resolverEntradaConviteCallable,
  type TokenPrimeiroAcessoInfo,
} from '@/lib/conviteEmpresaCallable';
import { ensureUsuarioFirestore } from '@/lib/ensureUsuarioFirestore';
import logo from '@/assets/logo.png';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PrimeiroAcesso = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';
  const resolver = searchParams.get('resolver')?.trim() || '';
  const navigate = useNavigate();

  const [info, setInfo] = useState<TokenPrimeiroAcessoInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [resolving, setResolving] = useState(Boolean(resolver));

  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (resolver && !token) {
      setResolving(true);
      void resolverEntradaConviteCallable(resolver)
        .then(({ url }) => {
          const u = new URL(url);
          const t = u.searchParams.get('token');
          if (t) {
            setSearchParams({ token: t }, { replace: true });
          } else {
            setErro('Convite inválido. Peça um novo convite por e-mail.');
          }
        })
        .catch(() => {
          setErro('Convite expirado ou inválido. Peça um novo convite por e-mail.');
        })
        .finally(() => setResolving(false));
    }
  }, [resolver, token, setSearchParams]);

  useEffect(() => {
    if (!token || resolving) return;
    setLoadingInfo(true);
    setErro('');
    void consultarTokenPrimeiroAcessoCallable(token)
      .then(setInfo)
      .catch(() => {
        setErro('Link inválido ou expirado. Verifique o e-mail ou peça um novo convite.');
        setInfo(null);
      })
      .finally(() => setLoadingInfo(false));
  }, [token, resolving]);

  const handleCriarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!token) return;
    if (senha.length < 8) {
      setErro('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const result = await concluirPrimeiroAcessoConviteCallable(token, senha);
      const cred = await signInWithEmailAndPassword(auth, result.email, senha);
      await ensureUsuarioFirestore(cred.user);
      toast.success('Conta ativada. Bem-vindo!');
      navigate('/empresas', { replace: true });
    } catch (err: unknown) {
      setErro(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEntrarEAceitar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!token) return;
    if (!senha) {
      setErro('Informe sua senha.');
      return;
    }

    setLoading(true);
    try {
      const email = info?.email;
      if (!email) throw new Error('Convite inválido.');
      const cred = await signInWithEmailAndPassword(auth, email, senha);
      await ensureUsuarioFirestore(cred.user);
      await aceitarConviteAutenticadoCallable(token);
      toast.success('Convite aceito!');
      navigate('/empresas', { replace: true });
    } catch (err: unknown) {
      setErro(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (resolving || (token && loadingInfo && !info && !erro)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFCF7] p-4">
        <Loader2 className="h-10 w-10 animate-spin text-[#0088CB]" />
      </div>
    );
  }

  if (!token && !resolver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFCF7] p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border p-8 text-center">
          <p className="text-gray-700">Abra o link enviado por e-mail para aceitar o convite.</p>
        </div>
      </div>
    );
  }

  const authCreated = info?.authCreated ?? true;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFCF7] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#0088CB]/15 overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex flex-col items-center mb-6">
            <img src={logo} alt="Instituto dos Sonhos" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="font-display text-xl font-bold text-[#071F4E] mb-1">
            {authCreated ? 'Primeiro acesso' : 'Aceitar convite'}
          </h1>
          <p className="text-sm text-[#1B4C41]/80 mb-2">
            {info?.empresaNome ? (
              <>
                Convite para <strong>{info.empresaNome}</strong>
              </>
            ) : (
              'Convite para empresa no Oráculo'
            )}
          </p>
          {info?.email ? (
            <p className="text-xs text-gray-500 mb-4 font-mono">{info.email}</p>
          ) : null}
          <p className="text-sm text-[#1B4C41]/80 mb-6">
            {authCreated
              ? 'Crie sua senha para ativar a conta. Não use a tela genérica de “Entrar” — este link é só para convidados.'
              : 'Você já tem conta. Entre com sua senha para aceitar o convite.'}
          </p>

          <form
            onSubmit={(e) =>
              void (authCreated ? handleCriarSenha(e) : handleEntrarEAceitar(e))
            }
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1 text-[#071F4E]">
                {authCreated ? 'Nova senha' : 'Sua senha'}
              </label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  minLength={authCreated ? 8 : 1}
                  required
                  autoComplete={authCreated ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500"
                  onClick={() => setShowSenha((s) => !s)}
                  aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {authCreated ? (
              <div>
                <label className="block text-sm font-medium mb-1 text-[#071F4E]">
                  Confirmar senha
                </label>
                <input
                  type={showSenha ? 'text' : 'password'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>
            ) : null}
            {erro ? <p className="text-sm text-[#ED1C24] text-center">{erro}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#0088CB] to-[#1B4C41] text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {authCreated ? 'Ativando…' : 'Entrando…'}
                </>
              ) : authCreated ? (
                'Criar senha e entrar'
              ) : (
                'Entrar e aceitar convite'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as { message?: string; code?: string };
    if (o.code === 'auth/invalid-credential' || o.code === 'auth/wrong-password') {
      return 'Senha incorreta.';
    }
    if (o.message) return o.message;
  }
  return 'Não foi possível concluir. Tente novamente.';
}

export default PrimeiroAcesso;
