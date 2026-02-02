import React, { useEffect, useState } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, 
  Headphones, 
  TrendingUp, 
  Clock, 
  Calendar,
  Play,
  FileText,
  Plus,
  Edit
} from 'lucide-react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Guia {
  id: string;
  titulo: string;
  descricao: string;
  imgUrl: string;
  pdfUrl: string;
  criadoEm?: any;
  especial?: boolean;
  landingPageUrl?: string;
}

interface Podcast {
  id: string;
  titulo: string;
  descricao: string;
  mp3Url?: string;
  capaUrl?: string;
  duracao?: string;
  criadoEm?: any;
}

const InteligenciaMercado = () => {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [guias, setGuias] = useState<Guia[]>([]);
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loadingGuias, setLoadingGuias] = useState(true);
  const [loadingPodcasts, setLoadingPodcasts] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [descricoesExpandidas, setDescricoesExpandidas] = useState<Set<string>>(new Set());

  console.log('🎯 [InteligenciaMercado] Componente renderizado');
  console.log('🎯 [InteligenciaMercado] User:', user);
  console.log('🎯 [InteligenciaMercado] User UID:', user?.uid);
  console.log('🎯 [InteligenciaMercado] isSuperAdmin atual:', isSuperAdmin);

  useEffect(() => {
    // Verificar email do usuário
    if (user?.email) {
      setUserEmail(user.email);
    } else if (user?.uid) {
      // Se não tiver email no auth, buscar do Firestore
      const fetchUserEmail = async () => {
        try {
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserEmail(userData.email || null);
          }
        } catch (error) {
          console.error('Erro ao buscar email do usuário:', error);
        }
      };
      fetchUserEmail();
    } else {
      setUserEmail(null);
    }
  }, [user]);

  useEffect(() => {
    const checkSuperAdmin = async () => {
      console.log('🚀 [InteligenciaMercado] Iniciando verificação de super_admin');
      console.log('🚀 [InteligenciaMercado] User:', user);
      console.log('🚀 [InteligenciaMercado] User UID:', user?.uid);
      
      if (!user?.uid) {
        console.log('❌ [InteligenciaMercado] Usuário não autenticado');
        setIsSuperAdmin(false);
        return;
      }

      console.log('🔍 [InteligenciaMercado] Verificando super_admin para UID:', user.uid);
      
      try {
        // Primeiro tentar buscar pelo ID do documento (mais rápido)
        console.log('🔍 [InteligenciaMercado] Tentando buscar documento pelo ID:', user.uid);
        const userDocRef = doc(db, 'usuarios', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('✅ [InteligenciaMercado] Documento encontrado pelo ID!');
          console.log('✅ [InteligenciaMercado] Dados:', userData);
          console.log('✅ [InteligenciaMercado] Role:', userData.role);
          console.log('✅ [InteligenciaMercado] Role === "super_admin":', userData.role === 'super_admin');
          
          const isAdmin = userData.role === 'super_admin';
          console.log('✅ [InteligenciaMercado] Definindo isSuperAdmin como:', isAdmin);
          
          // Log FORÇADO para garantir que aparece
          if (userData.role) {
            console.warn('🚨🚨🚨 ROLE ENCONTRADO:', userData.role, 'É super_admin?', isAdmin);
          } else {
            console.warn('🚨🚨🚨 ROLE NÃO ENCONTRADO NO DOCUMENTO');
          }
          
          setIsSuperAdmin(isAdmin);
          return;
        }
        
        // Se não encontrou pelo ID, buscar na collection inteira
        console.log('⚠️ [InteligenciaMercado] Documento não encontrado pelo ID, buscando na collection por campo uid:', user.uid);
        const usuariosRef = collection(db, 'usuarios');
        const usuariosSnapshot = await getDocs(usuariosRef);
        
        console.log(`📊 [InteligenciaMercado] Total de documentos na collection: ${usuariosSnapshot.docs.length}`);
        
        // Buscar pelo campo uid
        const usuarioEncontrado = usuariosSnapshot.docs.find(doc => {
          const data = doc.data();
          const match = data.uid === user.uid;
          if (match) {
            console.log('✅ [InteligenciaMercado] Usuário encontrado por campo uid:', {
              docId: doc.id,
              uid: data.uid,
              role: data.role,
              todosOsCampos: Object.keys(data)
            });
          }
          return match;
        });
        
        if (usuarioEncontrado) {
          const userData = usuarioEncontrado.data();
          console.log('✅ Usuário encontrado na collection:', userData);
          console.log('Todos os campos:', Object.keys(userData));
          console.log('Valor completo do role:', JSON.stringify(userData.role));
          console.log('Role encontrado:', userData.role);
          console.log('Tipo do role:', typeof userData.role);
          console.log('É super_admin?', userData.role === 'super_admin');
          console.log('Comparação estrita:', userData.role === 'super_admin');
          console.log('Comparação com trim:', userData.role?.trim() === 'super_admin');
          console.log('Comparação lowercase:', userData.role?.toLowerCase() === 'super_admin');
          
          // Verificar se role é super_admin
          const roleValue = userData.role;
          console.log('🔍 Verificação detalhada:');
          console.log('  - roleValue:', roleValue);
          console.log('  - Tipo:', typeof roleValue);
          console.log('  - roleValue === "super_admin":', roleValue === 'super_admin');
          
          // Verificação simples e direta
          const isAdmin = roleValue === 'super_admin';
          
          console.log('  - Resultado final isAdmin:', isAdmin);
          console.log('  - Vou definir isSuperAdmin como:', isAdmin);
          
          setIsSuperAdmin(isAdmin);
          
          // Log adicional para debug
          if (!isAdmin) {
            if (roleValue) {
              console.warn('⚠️ Role encontrado mas não é super_admin. Valor:', roleValue, 'Tipo:', typeof roleValue);
            } else {
              console.warn('⚠️ Campo role não existe ou está undefined no documento');
            }
          } else {
            console.log('✅ Role é super_admin! Botão deve aparecer.');
          }
        } else {
          console.log('❌ Usuário não encontrado na collection usuarios');
          console.log('UID buscado:', user.uid);
          console.log('UIDs encontrados na collection:', usuariosSnapshot.docs.map(d => ({ docId: d.id, uid: d.data().uid })));
          
          // Tentar também buscar pelo ID do documento como fallback
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('⚠️ Documento encontrado pelo ID (fallback):', userData);
            console.log('Todos os campos:', Object.keys(userData));
            const isAdmin = userData.role === 'super_admin' || 
                           userData.role?.toString().trim() === 'super_admin' ||
                           userData.role?.toLowerCase() === 'super_admin';
            setIsSuperAdmin(isAdmin);
          } else {
            setIsSuperAdmin(false);
          }
        }
      } catch (error) {
        console.error('❌ Erro ao verificar role do usuário:', error);
        setIsSuperAdmin(false);
      }
    };

    checkSuperAdmin();
  }, [user]);

  useEffect(() => {
    const fetchGuias = async () => {
      try {
        const guiasRef = collection(db, 'guias');
        const q = query(guiasRef, orderBy('criadoEm', 'desc'));
        const snapshot = await getDocs(q);
        const guiasData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Guia[];
        
        // Ordenar: especiais primeiro, depois os normais
        const guiasEspeciais = guiasData.filter(g => Boolean(g.especial) === true);
        const guiasNormais = guiasData.filter(g => Boolean(g.especial) !== true);
        const guiasOrdenados = [...guiasEspeciais, ...guiasNormais];
        
        setGuias(guiasOrdenados);
      } catch (error) {
        console.error('Erro ao buscar guias:', error);
      } finally {
        setLoadingGuias(false);
      }
    };

    const fetchPodcasts = async () => {
      try {
        const podcastsRef = collection(db, 'podcast_episodios');
        let snapshot;
        try {
          // Tentar buscar com ordenação primeiro
          const q = query(podcastsRef, orderBy('criadoEm', 'desc'));
          snapshot = await getDocs(q);
        } catch (orderError: any) {
          console.log('Erro ao ordenar podcasts, buscando sem ordenação:', orderError);
          // Se o erro for de permissão, tentar buscar sem ordenação
          if (orderError?.code === 'permission-denied' || orderError?.message?.includes('permission')) {
            try {
              snapshot = await getDocs(podcastsRef);
            } catch (permError) {
              console.error('Erro de permissão ao buscar podcasts:', permError);
              setPodcasts([]);
              setLoadingPodcasts(false);
              return;
            }
          } else {
            // Se for outro erro (como índice faltando), tentar sem ordenação
            snapshot = await getDocs(podcastsRef);
          }
        }
        const podcastsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Podcast[];
        setPodcasts(podcastsData);
      } catch (error: any) {
        console.error('Erro ao buscar podcasts:', error);
        // Se for erro de permissão, mostrar mensagem mais clara
        if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
          console.warn('⚠️ Erro de permissão ao buscar podcasts. Verifique se as regras do Firestore foram deployadas.');
        }
        setPodcasts([]);
      } finally {
        setLoadingPodcasts(false);
      }
    };

    fetchGuias();
    fetchPodcasts();
  }, []);

  const formatDate = (date: any) => {
    if (!date) return '';
    
    if (date.toDate) {
      return date.toDate().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
    
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Debug: logar quando isSuperAdmin mudar
  useEffect(() => {
    console.log('🔄 Estado isSuperAdmin atualizado:', isSuperAdmin);
  }, [isSuperAdmin]);

  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 overflow-auto">
        <DashboardHeader />
        <main className="p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-oraculo-blue to-oraculo-purple rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Inteligência de Mercado</h1>
              </div>
              
              {/* Botão Admin - Cadastrar Conteúdo - Apenas para marcosferreira@mobcontent.com.br */}
              {userEmail === 'marcosferreira@mobcontent.com.br' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Cadastrar Conteúdo
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate('/cadastrar-guia')}>
                      <FileText className="h-4 w-4 mr-2" />
                      Cadastrar Guia
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/cadastrar-episodio')}>
                      <Headphones className="h-4 w-4 mr-2" />
                      Cadastrar Podcast
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <p className="text-gray-600 text-lg">
              Acesse guias especializados e podcasts sobre editais culturais, tendências do mercado e melhores práticas
            </p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="podcasts" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
              <TabsTrigger value="podcasts" className="flex items-center gap-2">
                <Headphones className="h-4 w-4" />
                Podcasts
              </TabsTrigger>
              <TabsTrigger value="guias" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Guias
              </TabsTrigger>
            </TabsList>

            {/* Podcasts Tab */}
            <TabsContent value="podcasts">
              {loadingPodcasts ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oraculo-blue"></div>
                  <span className="ml-4 text-lg">Carregando podcasts...</span>
                </div>
              ) : podcasts.length === 0 ? (
                <div className="text-center py-12">
                  <Headphones className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Nenhum podcast disponível no momento</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {podcasts.map((podcast) => (
                    <Card 
                      key={podcast.id} 
                      className="hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer"
                      onClick={() => {
                        if (!user) {
                          navigate('/cadastro');
                        } else {
                          navigate(`/podcast/${podcast.id}`);
                        }
                      }}
                    >
                      <div className="aspect-video relative overflow-hidden rounded-t-lg">
                        {podcast.capaUrl && (
                          <img 
                            src={podcast.capaUrl} 
                            alt={podcast.titulo}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Play className="h-16 w-16 text-white" />
                        </div>
                      </div>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg leading-tight line-clamp-2">
                          {podcast.titulo}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {podcast.descricao}
                        </CardDescription>
                        <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                          {podcast.criadoEm && (
                            <div className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatDate(podcast.criadoEm)}
                            </div>
                          )}
                          {podcast.duracao && (
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {podcast.duracao}
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!user) {
                              navigate('/cadastro');
                            } else {
                              navigate(`/podcast/${podcast.id}`);
                            }
                          }}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Ouvir Episódio
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Guias Tab */}
            <TabsContent value="guias">
              {loadingGuias ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oraculo-blue"></div>
                  <span className="ml-4 text-lg">Carregando guias...</span>
                </div>
              ) : guias.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Nenhum guia disponível no momento</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {guias.map((guia) => {
                    const isExpandido = descricoesExpandidas.has(guia.id);
                    const descricaoLonga = guia.descricao && guia.descricao.length > 100;
                    // Verificação mais robusta para isEspecial (pode vir como true, "true", 1, etc)
                    const isEspecial = Boolean(guia.especial) && (guia.especial === true || String(guia.especial).toLowerCase() === 'true' || Number(guia.especial) === 1);
                    
                    // Debug: verificar se isEspecial está sendo detectado corretamente
                    if (isEspecial) {
                      console.log('[InteligenciaMercado] Guia especial detectado:', {
                        guiaId: guia.id,
                        guiaTitulo: guia.titulo,
                        especial: guia.especial,
                        isEspecial,
                        user: !!user,
                      });
                    }
                    
                    return (
                      <Card 
                        key={guia.id} 
                        className="hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer"
                        onClick={() => {
                          console.log('[InteligenciaMercado] Card clicado:', {
                            guiaId: guia.id,
                            isEspecial,
                            user: !!user,
                          });
                          // Guias especiais podem ser acessados sem login
                          if (isEspecial) {
                            console.log('[InteligenciaMercado] Navegando para guia especial sem login');
                            navigate(`/guia-especial/${guia.id}`);
                          } else if (!user) {
                            // Guias normais precisam de login
                            console.log('[InteligenciaMercado] Usuário não logado, redirecionando para cadastro');
                            navigate('/cadastro');
                          } else {
                            window.open(guia.pdfUrl, '_blank');
                          }
                        }}
                      >
                        <div className="aspect-video relative overflow-hidden rounded-t-lg">
                          <img 
                            src={guia.imgUrl} 
                            alt={guia.titulo}
                            className="w-full h-full object-cover"
                          />
                          {isEspecial && (
                            <div className="absolute top-2 right-2 bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                              ESPECIAL
                            </div>
                          )}
                          {/* Botão Editar - Apenas para marcosferreira@mobcontent.com.br */}
                          {userEmail === 'marcosferreira@mobcontent.com.br' && (
                            <div className="absolute top-2 left-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="bg-white/90 hover:bg-white shadow-md"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/editar-guia/${guia.id}`);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg leading-tight line-clamp-2">
                            {guia.titulo}
                          </CardTitle>
                          <div className="mt-2">
                            <div
                              className={`text-sm text-muted-foreground ${isExpandido ? '' : 'line-clamp-2'} [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_strong]:font-semibold`}
                              dangerouslySetInnerHTML={{ __html: guia.descricao || '' }}
                            />
                            {descricaoLonga && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDescricoesExpandidas(prev => {
                                    const novo = new Set(prev);
                                    if (isExpandido) {
                                      novo.delete(guia.id);
                                    } else {
                                      novo.add(guia.id);
                                    }
                                    return novo;
                                  });
                                }}
                                className="text-sm text-oraculo-blue hover:text-oraculo-purple mt-1 font-medium"
                              >
                                {isExpandido ? 'Ver menos' : 'Ver mais'}
                              </button>
                            )}
                          </div>
                          {guia.criadoEm && (
                            <div className="flex items-center text-xs text-gray-500 mt-2">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatDate(guia.criadoEm)}
                            </div>
                          )}
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Button 
                            variant="default" 
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('[InteligenciaMercado] Botão clicado:', {
                                guiaId: guia.id,
                                isEspecial,
                                user: !!user,
                              });
                              // Guias especiais podem ser acessados sem login
                              if (isEspecial) {
                                console.log('[InteligenciaMercado] Navegando para guia especial sem login (botão)');
                                navigate(`/guia-especial/${guia.id}`);
                              } else if (!user) {
                                // Guias normais precisam de login
                                console.log('[InteligenciaMercado] Usuário não logado, redirecionando para cadastro (botão)');
                                navigate('/cadastro');
                              } else {
                                window.open(guia.pdfUrl, '_blank');
                              }
                            }}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            {isEspecial ? 'Ver Detalhes' : 'Abrir Guia'}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default InteligenciaMercado;

