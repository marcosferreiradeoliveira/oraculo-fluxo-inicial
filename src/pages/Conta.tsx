import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Settings } from 'lucide-react';
import { AssociarEmpresaConta } from '@/components/empresa/AssociarEmpresaConta';
import { DadosPessoaForm } from '@/components/conta/DadosPessoaForm';
import {
  emptyDadosCadastraisPessoa,
  lerDadosPessoaDoUsuario,
  normalizarDadosCadastraisPessoa,
  validarDadosPessoa,
  type DadosCadastraisPessoa,
} from '@/lib/dadosCadastraisPessoa';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, setDoc, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { toast } from 'sonner';
import { emptyDadosCadastraisEmpresa } from '@/lib/dadosCadastraisEmpresa';

const Conta = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoURL, setPhotoURL] = useState('');
  const [dadosPessoa, setDadosPessoa] = useState<DadosCadastraisPessoa>(emptyDadosCadastraisPessoa);

  const patchDadosPessoa = (patch: Partial<DadosCadastraisPessoa>) => {
    setDadosPessoa((prev) => ({ ...prev, ...patch }));
  };

  const createUserDocument = async (firebaseUser: any) => {
    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
      
      const timestamp = serverTimestamp();
      await setDoc(userDocRef, {
        createdAt: timestamp,
        dadosCadastrais: '',
        dadosCadastraisEmpresa: emptyDadosCadastraisEmpresa(),
        dadosCadastraisPessoa: emptyDadosCadastraisPessoa(),
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
            setPhotoURL(data.photoURL || firebaseUser.photoURL || '');
            setDadosPessoa(lerDadosPessoaDoUsuario(data));
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
                setPhotoURL(data.photoURL || firebaseUser.photoURL || '');
                setDadosPessoa(lerDadosPessoaDoUsuario(data));
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

    const erroPf = validarDadosPessoa(dadosPessoa);
    if (erroPf) {
      toast.error(erroPf);
      return;
    }
    const dadosPfNorm = normalizarDadosCadastraisPessoa(dadosPessoa);

    setSaving(true);
    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'usuarios', user.uid);
      
      await updateDoc(userDocRef, {
        nome_completo: nomeCompleto,
        email: email,
        dadosCadastraisPessoa: dadosPfNorm,
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
                    Nome, contato, foto e cadastro de pessoa física (CPF, RG, endereço)
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
                  </div>

                  <DadosPessoaForm values={dadosPessoa} onChange={patchDadosPessoa} />

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

              {user?.uid ? <AssociarEmpresaConta uid={user.uid} /> : null}
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

