import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type PremiumProjectSummary = {
  id: string;
  nome: string;
  editalLabel?: string;
  etapaAtual: number;
};

export type HomeDashboardMetrics = {
  projetosAtivos: number;
  recentProjects: PremiumProjectSummary[];
};

export type UserProfileState = {
  nome: string;
  isPremium: boolean;
  planType: string | null;
  creditos: number;
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

function planLabelFromType(planType: string | null | undefined, isPremium: boolean): string {
  const pt = (planType || '').toLowerCase();
  if (pt === 'essencial') return 'Essencial';
  if (pt === 'basico') return 'Básico';
  if (pt === 'premium' || isPremium) return 'Premium';
  if (pt === 'free') return 'Starter';
  return isPremium ? 'Premium' : 'Starter';
}

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
        const isPremium = data.isPremium === true;
        const nome =
          (typeof data.nome_completo === 'string' && data.nome_completo.trim()) ||
          user.displayName ||
          user.email?.split('@')[0] ||
          'Produtor';

        let metrics: HomeDashboardMetrics = { ...defaultMetrics };

        if (isPremium) {
          try {
            const q = query(collection(db, 'projetos'), where('user_id', '==', user.uid));
            const snapProjetos = await getDocs(q);
            const projetos = snapProjetos.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<
              Record<string, unknown> & { id: string }
            >;
            metrics.projetosAtivos = projetos.length;
            const sorted = [...projetos].sort((a, b) => {
              const ta =
                (a.atualizado_em as { toMillis?: () => number })?.toMillis?.() ??
                (a.criado_em as { toMillis?: () => number })?.toMillis?.() ??
                0;
              const tb =
                (b.atualizado_em as { toMillis?: () => number })?.toMillis?.() ??
                (b.criado_em as { toMillis?: () => number })?.toMillis?.() ??
                0;
              return tb - ta;
            });
            metrics.recentProjects = sorted.slice(0, 3).map((p) => ({
              id: p.id,
              nome: (typeof p.nome === 'string' && p.nome) || 'Projeto sem nome',
              editalLabel:
                (typeof p.edital_associado === 'string' && p.edital_associado) ||
                (typeof p.nome_edital === 'string' && p.nome_edital) ||
                undefined,
              etapaAtual: typeof p.etapa_atual === 'number' ? p.etapa_atual : 1,
            }));
          } catch {
            /* mantém defaults */
          }
        }

        setProfile({
          nome,
          isPremium,
          planType: (data.planType as string) ?? null,
          creditos: typeof data.creditos === 'number' ? data.creditos : Number(data.creditos ?? 0),
          metrics,
        });
        setProfileLoading(false);
      },
      () => {
        setProfileLoading(false);
      }
    );

    return () => unsub();
  }, [user, authLoading]);

  const loading = authLoading || profileLoading;

  return {
    user,
    loading,
    isPremium: profile?.isPremium === true,
    profile,
    planLabel: planLabelFromType(profile?.planType, profile?.isPremium === true),
  };
}

export const useUser = useUserProfile;
