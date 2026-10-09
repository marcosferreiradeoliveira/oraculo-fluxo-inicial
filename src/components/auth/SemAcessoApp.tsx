import type { AppId } from "@/lib/auth/ecossistema-acesso";
import { APP_LABEL, appUrlsFromEnv, appsComAcesso, resolveAppsEfetivos } from "@/lib/auth/app-gate";
import { getEcossistemaGate } from "@/lib/auth/ecossistema-config";
import type { MembroOrganizacao } from "@/lib/firebase/organizacao-doc";

type Props = {
  membro: MembroOrganizacao | null;
  profileRole?: string;
  onLogout: () => void;
};

export function SemAcessoApp({ membro, profileRole, onLogout }: Props) {
  const apps = resolveAppsEfetivos(membro, profileRole);
  const liberados = appsComAcesso(apps);
  const urls = appUrlsFromEnv();
  const appAtual = getEcossistemaGate().appId;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Sem acesso a este app</h1>
        <p className="text-sm text-gray-600">
          Sua conta está ativa na organização, mas não inclui o módulo{" "}
          <strong>{APP_LABEL[appAtual]}</strong>. Use um dos apps abaixo ou peça ajuste a um administrador.
        </p>

        {liberados.length > 0 ? (
          <ul className="space-y-2 text-left text-sm">
            {liberados.map((id: AppId) => {
              const href = urls[id];
              return (
                <li key={id}>
                  {href ? (
                    <a
                      href={href}
                      className="block rounded-lg border bg-white px-4 py-3 font-medium text-blue-700 hover:bg-gray-50"
                    >
                      Abrir {APP_LABEL[id]}
                    </a>
                  ) : (
                    <span className="block rounded-lg border bg-gray-100 px-4 py-3 text-gray-500">
                      {APP_LABEL[id]} — configure VITE_APP_URL_{id.toUpperCase()}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">Nenhum módulo Oráculo liberado no seu convite.</p>
        )}

        <button type="button" onClick={onLogout} className="text-sm text-gray-600 underline">
          Sair
        </button>
      </div>
    </div>
  );
}