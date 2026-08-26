import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { getFirestore, collection, getDocs, doc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Crown, Search, UserX, Mail, Shield } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_EMAIL = 'marcosferreira@mobcontent.com.br';

interface Usuario {
  uid: string;
  email: string;
  nome_completo?: string;
  isPremium: boolean;
  planType?: string;
  premiumStatus?: string;
  premiumActivatedAt?: any;
  lastLoginAt?: any;
  createdAt?: any;
  data_cadastro?: any;
  role?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

const Admin = () => {
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Verificar se o usuário é o admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!loading && user) {
        if (user.email === ADMIN_EMAIL) {
          setIsAuthorized(true);
          setCheckingAuth(false);
        } else {
          toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
          navigate('/');
          setCheckingAuth(false);
        }
      } else if (!loading && !user) {
        navigate('/cadastro');
        setCheckingAuth(false);
      }
    };
    checkAdmin();
  }, [user, loading, navigate]);

  // Carregar lista de usuários
  useEffect(() => {
    const fetchUsuarios = async () => {
      if (!isAuthorized) return;

      try {
        setLoadingUsuarios(true);
        const db = getFirestore();
        const usuariosRef = collection(db, 'usuarios');
        
        // Buscar todos os usuários (limite de 1000 para performance)
        const q = query(usuariosRef, orderBy('createdAt', 'desc'), limit(1000));
        const snapshot = await getDocs(q);
        
        const usuariosList: Usuario[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          usuariosList.push({
            uid: docSnap.id,
            email: data.email || '',
            nome_completo: data.nome_completo || '',
            isPremium: data.isPremium === true,
            planType: data.planType || '',
            premiumStatus: data.premiumStatus || '',
            premiumActivatedAt: data.premiumActivatedAt,
            lastLoginAt: data.lastLoginAt,
            createdAt: data.createdAt || data.data_cadastro,
            data_cadastro: data.data_cadastro,
            role: data.role || '',
            stripeCustomerId: data.stripeCustomerId || '',
            stripeSubscriptionId: data.stripeSubscriptionId || '',
          });
        });
        
        setUsuarios(usuariosList);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        toast.error('Erro ao carregar lista de usuários');
      } finally {
        setLoadingUsuarios(false);
      }
    };

    if (isAuthorized) {
      fetchUsuarios();
    }
  }, [isAuthorized]);

  const tornarPremium = async (usuario: Usuario) => {
    if (!user || user.email !== ADMIN_EMAIL) {
      toast.error('Acesso negado');
      return;
    }

    if (!confirm(`Tornar ${usuario.email} premium sem pagamento?`)) {
      return;
    }

    setUpdatingUserId(usuario.uid);
    try {
      const db = getFirestore();
      const userRef = doc(db, 'usuarios', usuario.uid);
      
      const now = new Date();
      const timestamp = now; // Firestore aceita Date diretamente
      
      await updateDoc(userRef, {
        isPremium: true,
        planType: 'basico', // ou 'premium' conforme necessário
        premiumStatus: 'active',
        premiumActivatedAt: timestamp,
        lastSubscriptionUpdate: timestamp,
        lastPaymentDate: timestamp, // Data do último "pagamento" (manual)
        cancelAtPeriodEnd: false,
        // Manter campos existentes se houver
        // Não remover stripeCustomerId e stripeSubscriptionId se existirem
      });

      // Atualizar estado local
      setUsuarios(prev => prev.map(u => 
        u.uid === usuario.uid 
          ? {
              ...u,
              isPremium: true,
              planType: 'basico',
              premiumStatus: 'active',
              premiumActivatedAt: timestamp,
            }
          : u
      ));

      toast.success(`${usuario.email} agora é premium!`);
    } catch (error) {
      console.error('Erro ao tornar premium:', error);
      toast.error('Erro ao atualizar usuário');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const removerPremium = async (usuario: Usuario) => {
    if (!user || user.email !== ADMIN_EMAIL) {
      toast.error('Acesso negado');
      return;
    }

    if (!confirm(`Remover premium de ${usuario.email}?`)) {
      return;
    }

    setUpdatingUserId(usuario.uid);
    try {
      const db = getFirestore();
      const userRef = doc(db, 'usuarios', usuario.uid);
      
      await updateDoc(userRef, {
        isPremium: false,
        premiumStatus: 'inactive',
        cancelAtPeriodEnd: false,
      });

      // Atualizar estado local
      setUsuarios(prev => prev.map(u => 
        u.uid === usuario.uid 
          ? {
              ...u,
              isPremium: false,
              premiumStatus: 'inactive',
            }
          : u
      ));

      toast.success(`Premium removido de ${usuario.email}`);
    } catch (error) {
      console.error('Erro ao remover premium:', error);
      toast.error('Erro ao atualizar usuário');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (date.toDate) {
      return date.toDate().toLocaleString('pt-BR');
    }
    if (date instanceof Date) {
      return date.toLocaleString('pt-BR');
    }
    return 'N/A';
  };

  const usuariosFiltrados = usuarios.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.nome_completo && u.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (checkingAuth || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-oraculo-blue animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="h-8 w-8 text-oraculo-blue" />
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Painel Administrativo</h1>
              </div>
              <p className="text-gray-600">Gerenciar usuários e atribuir premium</p>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Buscar Usuários
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Buscar por email ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
                />
              </CardContent>
            </Card>

            {loadingUsuarios ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-oraculo-blue animate-spin" />
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Usuários ({usuariosFiltrados.length} de {usuarios.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left p-3 font-semibold text-gray-700">Email</th>
                          <th className="text-left p-3 font-semibold text-gray-700">Nome</th>
                          <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                          <th className="text-left p-3 font-semibold text-gray-700">Plano</th>
                          <th className="text-left p-3 font-semibold text-gray-700">Cadastro</th>
                          <th className="text-left p-3 font-semibold text-gray-700">Último Login</th>
                          <th className="text-left p-3 font-semibold text-gray-700">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuariosFiltrados.map((usuario) => (
                          <tr key={usuario.uid} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="font-medium">{usuario.email}</span>
                              </div>
                            </td>
                            <td className="p-3">{usuario.nome_completo || '-'}</td>
                            <td className="p-3">
                              {usuario.isPremium ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                                  <Crown className="h-3 w-3" />
                                  Premium
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-medium">
                                  <UserX className="h-3 w-3" />
                                  Free
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="text-gray-700">{usuario.planType || '-'}</span>
                            </td>
                            <td className="p-3 text-gray-600 text-xs">
                              {formatDate(usuario.createdAt || usuario.data_cadastro)}
                            </td>
                            <td className="p-3 text-gray-600 text-xs">
                              {formatDate(usuario.lastLoginAt)}
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2">
                                {usuario.isPremium ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removerPremium(usuario)}
                                    disabled={updatingUserId === usuario.uid}
                                  >
                                    {updatingUserId === usuario.uid ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <UserX className="h-4 w-4 mr-1" />
                                        Remover Premium
                                      </>
                                    )}
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => tornarPremium(usuario)}
                                    disabled={updatingUserId === usuario.uid}
                                    className="bg-oraculo-blue hover:bg-oraculo-blue/90"
                                  >
                                    {updatingUserId === usuario.uid ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Crown className="h-4 w-4 mr-1" />
                                        Tornar Premium
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {usuariosFiltrados.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        Nenhum usuário encontrado
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Admin;
