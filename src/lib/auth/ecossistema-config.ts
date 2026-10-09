import type { EcossistemaGateConfig } from "@/lib/auth/app-gate";

const isIsProfile =
  import.meta.env.VITE_PROJECT_ID === "oraculo-is" ||
  import.meta.env.VITE_FIREBASE_PROFILE === "oraculo-is";

export function getEcossistemaGate(): EcossistemaGateConfig {
  return {
    appId: "criacao",
    requireAppAccess: isIsProfile,
    inviteOnly: isIsProfile,
  };
}
