import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Settings } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, setDoc, serverTimestamp, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { toast } from 'sonner';
import {
  type DadosCadastraisEmpresa,
  dadosCadastraisParaTexto,
  emptyDadosCadastraisEmpresa,
  formatarCep,
  lerDadosCadastraisDoUsuario,
  normalizarDadosCadastraisEmpresa,
  ufValida,
} from '@/lib/dadosCadastraisEmpresa';
import { formatarCnpj, formatarCpf } from '@/lib/fornecedores';

const Conta = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [dadosEmpresa, setDadosEmpresa] = useState<DadosCadastraisEmpresa>(
    emptyDadosCadastraisEmpresa
  );

  const patchDadosEmpresa = (patch: Partial<DadosCadastraisEmpresa>) => {
    setDadosEmpresa((prev) => ({ ...prev, ...patch }));
  };
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoURL, setPhotoURL] = useState('');

  const createUserDocument = async (firebaseUser: any) => {
    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
      
      const timestamp = serverTimestamp();
      await setDoc(userDocRef, {
        createdAt: timestamp,
        dadosCadastrais: '',
        dadosCadastraisEmpresa: emptyDadosCadastraisEmpresa(),
        data_cadastro: timestamp,
        email: firebaseUser.email || '',
        empresa: '',
        equipeBio: '',
        lastLoginAt: timestamp,
        nome_completo: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
        origem: 'captacao',
        portfolio: '',
        role: 'super_admin',
        ultimo_login: timestamp,
        uid: firebaseUser.uid,
      });
      
      console.log('Documento do usuário criado no Firestore');
      return true;
    } catch (error) {
      console.error('Erro ao criar documento do usuário:', error);
      return false;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        // Se o usuário não estiver logado, redirecionar para a página de cadastro
        setLoading(false);
        navigate('/cadastro');
        return;
      }
      if (firebaseUser) {
        try {
          const db = getFirestore();
          const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
          
          // Tentar ler do servidor primeiro (sem cache), se falhar, usar cache
          let userDoc;
          try {
            userDoc = await getDocFromServer(userDocRef);
            console.log('[Conta] Dados lidos do servidor (sem cache)');
          } catch (error) {
            console.log('[Conta] Erro ao ler do servidor, usando cache:', error);
            userDoc = await getDoc(userDocRef);
          }
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setNomeCompleto(data.nome_completo || '');
            setEmail(firebaseUser.email || '');
            setEmpresa(data.empresa || '');
            setPortfolio(data.portfolio || '');
            setDadosEmpresa(lerDadosCadastraisDoUsuario(data));
            setPhotoURL(data.photoURL || firebaseUser.photoURL || '');
          } else {
            console.log('Usuário não encontrado no Firestore, criando documento...');
            const created = await createUserDocument(firebaseUser);
            if (created) {
              // Recarregar os dados após criar o documento
              const newUserDoc = await getDoc(userDocRef);
              if (newUserDoc.exists()) {
                const data = newUserDoc.data();
                setUserData(data);
                setNomeCompleto(data.nome_completo || '');
                setEmail(firebaseUser.email || '');
                setEmpresa(data.empresa || '');
                setPortfolio(data.portfolio || '');
                setDadosEmpresa(lerDadosCadastraisDoUsuario(data));
                setPhotoURL(data.photoURL || firebaseUser.photoURL || '');
              }
            } else {
              setNomeCompleto(firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário');
              setEmail(firebaseUser.email || '');
            }
          }
        } catch (error) {
          console.error('Erro ao carregar dados do usuário:', error);
          setNomeCompleto(firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário');
          setEmail(firebaseUser.email || '');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!user) return;

    const cnpjDigits = dadosEmpresa.cnpj.replace(/\D/g, '');
    if (cnpjDigits.length > 0 && cnpjDigits.length !== 14) {
      toast.error('CNPJ deve ter 14 dígitos.');
      return;
    }
    if (dadosEmpresa.uf && !ufValida(dadosEmpresa.uf)) {
      toast.error('UF inválida (use sigla de 2 letras, ex.: SP).');
      return;
    }

    const dadosNorm = normalizarDadosCadastraisEmpresa(dadosEmpresa);
    
    setSaving(true);
    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'usuarios', user.uid);
      
      await updateDoc(userDocRef, {
        nome_completo: nomeCompleto,
        email: email,
        empresa: empresa,
        portfolio: portfolio,
        dadosCadastraisEmpresa: dadosNorm,
        dadosCadastrais: dadosCadastraisParaTexto(dadosNorm),
      });
      toast.success('Dados atualizados com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      toast.error('Erro ao salvar dados. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user || !currentPassword || !newPassword || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    setChangingPassword(true);
    try {
      // Reautenticar o usuário
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Atualizar a senha
      await updatePassword(user, newPassword);
      
      toast.success('Senha alterada com sucesso!');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      if (error.code === 'auth/wrong-password') {
        toast.error('Senha atual incorreta');
      } else if (error.code === 'auth/weak-password') {
        toast.error('A nova senha é muito fraca');
      } else {
        toast.error('Erro ao alterar senha. Tente novamente.');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validar tamanho (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const storage = getStorage();
      const fileName = `profile-photos/${user.uid}-${Date.now()}`;
      const storageRef = ref(storage, fileName);
      
      // Upload da imagem
      await uploadBytes(storageRef, file);
      
      // Obter URL de download
      const downloadURL = await getDownloadURL(storageRef);
      
      // Atualizar no Firestore
      const db = getFirestore();
      const userDocRef = doc(db, 'usuarios', user.uid);
      await updateDoc(userDocRef, {
        photoURL: downloadURL
      });
      
      // Atualizar estado local
      setPhotoURL(downloadURL);
      
      toast.success('Foto atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      toast.error('Erro ao fazer upload da foto. Tente novamente.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 p-4 md:p-8 animate-fade-in">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oraculo-blue"></div>
                <span className="ml-2">Carregando...</span>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        
        <main className="flex-1 p-4 md:p-8 animate-fade-in">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <User className="h-8 w-8 text-oraculo-blue" />
                Minha Conta
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Gerencie suas informações pessoais e preferências da plataforma.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Informações Pessoais
                  </CardTitle>
                  <CardDescription>
                    Atualize seus dados pessoais e de contato
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage 
                        src={photoURL || user?.photoURL || ''} 
                        className="object-cover"
                        style={{ objectFit: 'cover' }}
                      />
                      <AvatarFallback className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple text-white text-xl">
                        {nomeCompleto ? nomeCompleto[0] : (user?.displayName || user?.email || 'U')[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        id="photo-upload"
                        disabled={uploadingPhoto}
                      />
                      <label htmlFor="photo-upload">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          asChild
                          disabled={uploadingPhoto}
                        >
                          <span className="cursor-pointer">
                            {uploadingPhoto ? 'Enviando...' : 'Alterar Foto'}
                          </span>
                        </Button>
                      </label>
                      <p className="text-sm text-gray-500 mt-1">
                        JPG, PNG até 2MB
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome Completo</Label>
                      <Input 
                        id="nome" 
                        value={nomeCompleto}
                        onChange={(e) => setNomeCompleto(e.target.value)}
                        placeholder="Digite seu nome completo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Digite seu email"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="empresa">Empresa</Label>
                      <Input 
                        id="empresa" 
                        value={empresa}
                        onChange={(e) => setEmpresa(e.target.value)}
                        placeholder="Digite o nome da sua empresa"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="portfolio">Portfolio</Label>
                      <Textarea 
                        id="portfolio" 
                        value={portfolio}
                        onChange={(e) => setPortfolio(e.target.value)}
                        placeholder="Descreva seu portfolio, projetos anteriores, experiências relevantes..."
                        rows={4}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-4 pt-2 border-t border-gray-100">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Dados cadastrais da empresa</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Usados em anexos e textos do projeto. Preencha CNPJ, razão social, endereço e contatos
                          institucionais.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="dc-cnpj">CNPJ *</Label>
                          <Input
                            id="dc-cnpj"
                            value={dadosEmpresa.cnpj}
                            onChange={(e) => patchDadosEmpresa({ cnpj: formatarCnpj(e.target.value) })}
                            placeholder="00.000.000/0000-00"
                            inputMode="numeric"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="dc-razao">Razão social *</Label>
                          <Input
                            id="dc-razao"
                            value={dadosEmpresa.razaoSocial}
                            onChange={(e) => patchDadosEmpresa({ razaoSocial: e.target.value })}
                            placeholder="Nome jurídico conforme contrato social"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dc-fantasia">Nome fantasia</Label>
                          <Input
                            id="dc-fantasia"
                            value={dadosEmpresa.nomeFantasia}
                            onChange={(e) => patchDadosEmpresa({ nomeFantasia: e.target.value })}
                            placeholder="Como a empresa é conhecida"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dc-ie">Inscrição estadual</Label>
                          <Input
                            id="dc-ie"
                            value={dadosEmpresa.inscricaoEstadual}
                            onChange={(e) => patchDadosEmpresa({ inscricaoEstadual: e.target.value })}
                            placeholder="IE ou isento"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dc-im">Inscrição municipal</Label>
                          <Input
                            id="dc-im"
                            value={dadosEmpresa.inscricaoMunicipal}
                            onChange={(e) => patchDadosEmpresa({ inscricaoMunicipal: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dc-cep">CEP *</Label>
                          <Input
                            id="dc-cep"
                            value={dadosEmpresa.cep}
                            onChange={(e) => patchDadosEmpresa({ cep: formatarCep(e.target.value) })}
                            placeholder="00000-000"
                            inputMode="numeric"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="dc-log">Logradouro *</Label>
                          <Input
                            id="dc-log"
                            value={dadosEmpresa.logradouro}
                            onChange={(e) => patchDadosEmpresa({ logradouro: e.target.value })}
                            placeholder="Rua, avenida, número do lote…"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dc-num">Número *</Label>
                          <Input
                            id="dc-num"
                            value={dadosEmpresa.numero}
                            onChange={(e) => patchDadosEmpresa({ numero: e.target.value })}
                            placeholder="Nº ou S/N"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dc-comp">Complemento</Label>
                          <Input
                            id="dc-comp"
                            value={dadosEmpresa.complemento}
                            onChange={(e) => patchDadosEmpresa({ complemento: e.target.value })}
                            placeholder="Sala, bloco, andar…"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dc-bairro">Bairro *</Label>
                          <Input
                            id="dc-bairro"
                            value={dadosEmpresa.bairro}
                            onChange={(e) => patchDadosEmpresa({ bairro: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dc-cidade">Cidade *</Label>
                          <Input
                            id="dc-cidade"
                            value={dadosEmpresa.cidade}
                            onChange={(e) => patchDadosEmpresa({ cidade: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dc-uf">UF *</Label>
                          <Input
                            id="dc-uf"
                            value={dadosEmpresa.uf}
                            onChange={(e) =>
                              patchDadosEmpresa({ uf: e.target.value.toUpperCase().slice(0, 2) })
                            }
                            placeholder="SP"
                            maxLength={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dc-tel">Telefone / WhatsApp</Label>
                          <Input
                            id="dc-tel"
                            value={dadosEmpresa.telefone}
                            onChange={(e) => patchDadosEmpresa({ telefone: e.target.value })}
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dc-email-inst">E-mail institucional</Label>
                          <Input
                            id="dc-email-inst"
                            type="email"
                            value={dadosEmpresa.emailInstitucional}
                            onChange={(e) => patchDadosEmpresa({ emailInstitucional: e.target.value })}
                            placeholder="contato@empresa.com.br"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dc-rep">Representante legal</Label>
                          <Input
                            id="dc-rep"
                            value={dadosEmpresa.representanteLegal}
                            onChange={(e) => patchDadosEmpresa({ representanteLegal: e.target.value })}
                            placeholder="Nome do responsável pela proposta"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dc-cpf-rep">CPF do representante</Label>
                          <Input
                            id="dc-cpf-rep"
                            value={dadosEmpresa.cpfRepresentante}
                            onChange={(e) =>
                              patchDadosEmpresa({ cpfRepresentante: formatarCpf(e.target.value) })
                            }
                            placeholder="000.000.000-00"
                            inputMode="numeric"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="dc-obs">Observações (opcional)</Label>
                          <Textarea
                            id="dc-obs"
                            value={dadosEmpresa.observacoes}
                            onChange={(e) => patchDadosEmpresa({ observacoes: e.target.value })}
                            placeholder="Dados bancários, sócios, procuradores ou outras informações exigidas pelo edital."
                            rows={3}
                          />
                        </div>
                      </div>
                      {dadosEmpresa.observacoes &&
                        !dadosEmpresa.cnpj &&
                        !dadosEmpresa.razaoSocial && (
                          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md p-2">
                            Você tinha dados cadastrais em texto livre. Revise os campos acima e salve para
                            organizar tudo.
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button 
                      className="bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowPasswordModal(true)}
                    >
                      Alterar Senha
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Modal de Alteração de Senha */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Alterar Senha</h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Senha Atual</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                />
              </div>
              
              <div>
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite sua nova senha"
                />
              </div>
              
              <div>
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme sua nova senha"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="flex-1 bg-gradient-to-r from-oraculo-blue to-oraculo-purple hover:opacity-90"
              >
                {changingPassword ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Conta;

