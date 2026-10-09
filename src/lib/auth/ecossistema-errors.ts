export class EcossistemaAccessError extends Error {
  readonly code: "NO_PROFILE" | "NO_MEMBRO" | "MEMBRO_SUSPENDED";

  constructor(code: EcossistemaAccessError["code"], message: string) {
    super(message);
    this.name = "EcossistemaAccessError";
    this.code = code;
  }
}

export const AUTH_LAST_ERROR_KEY = "oraculo_ecossistema_auth_error";

export function stashAuthError(message: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(AUTH_LAST_ERROR_KEY, message);
}

export function takeAuthError(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const v = sessionStorage.getItem(AUTH_LAST_ERROR_KEY);
  if (v) sessionStorage.removeItem(AUTH_LAST_ERROR_KEY);
  return v;
}
