import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type PremiumProjectSummary = {
  id: string;
  nome: string;
  editalLabel?: string;
  etapaAtual: number;
  tipo_projeto?: 'mae' | 'edital';
  edital_id?: string;
  edital_associado?: string;
};

export type HomeDashboardMetrics = {
  projetosAtivos: number;
  recentProjects: PremiumProjectSummary[];
};

export type UserProfileState = {
  nome: string;
  metrics: HomeDashboardMetrics;
};

const defaultMetrics: HomeDashboardMetrics = {
  projetosAtivos: 0,
  recentProjects: [],
};

const STEP_LABELS = [
  'Criar projeto',
  'Avaliar com IA',
  'Alterar com IA',
  'Gerar textos',
  'Orçamento',
  'Cronograma',
  'Documentos',
  'Anexos',
];

export function etapaLabel(index: number): string {
  if (index >= 0 && index < STEP_LABELS.length) return STEP_LABELS[index];
  return 'Em andamento';
}

async function loadProjectMetrics(uid: string): Promise<HomeDashboardMetrics> {
  const q = query(collection(db, 'projetos'), where('user_id', '==', uid));
  const snapProjetos = await getDocs(q);
  const projetos = snapProjetos.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<
    Record<string, unknown> & { id: string }
  >;
  const sorted = [...projetos].sort((a, b) => {
    const ta =
      (a.data_atualizacao as { toMillis?: () => number })?.toMillis?.() ??
      (a.data_criacao as { toMillis?: () => number })?.toMillis?.() ??
      0;
    const tb =
      (b.data_atualizacao as { toMillis?: () => number })?.toMillis?.() ??
      (b.data_criacao as { toMillis?: () => number })?.toMillis?.() ??
      0;
    return tb - ta;
  });
  return {
    projetosAtivos: projetos.length,
    recentProjects: sorted.slice(0, 3).map((p) => ({
      id: p.id,
      nome: (typeof p.nome === 'string' && p.nome) || 'Projeto sem nome',
      editalLabel:
        (typeof p.edital_associado === 'string' && p.edital_associado) ||
        (typeof p.nome_edital === 'string' && p.nome_edital) ||
        undefined,
      etapaAtual: typeof p.etapa_atual === 'number' ? p.etapa_atual : 1,
      tipo_projeto:
        p.tipo_projeto === 'mae' || p.tipo_projeto === 'edital' ? p.tipo_projeto : undefined,
      edital_id: typeof p.edital_id === 'string' ? p.edital_id : undefined,
      edital_associado:
        typeof p.edital_associado === 'string' ? p.edital_associado : undefined,
    })),
  };
}

/** Perfil leve para home IS — projetos para todos os usuários logados. */
export function useUserProfile() {
  const [user, authLoading] = useAuthState(auth);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileState | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const userRef = doc(db, 'usuarios', user.uid);
    const unsub = onSnapshot(
      userRef,
      async (snap) => {
        const data = snap.exists() ? snap.data() : {};
        const nome =
          (typeof data.nome_completo === 'string' && data.nome_completo.trim()) ||
          user.displayName ||
          user.email?.split('@')[0] ||
          'Produtor';

        let metrics = defaultMetrics;
        try {
          metrics = await loadProjectMetrics(user.uid);
        } catch {
          /* mantém defaults */
        }

        setProfile({ nome, metrics });
        setProfileLoading(false);
      },
      () => setProfileLoading(false)
    );

    return () => unsub();
  }, [user, authLoading]);

  return {
    user,
    loading: authLoading || profileLoading,
    profile,
  };
}
