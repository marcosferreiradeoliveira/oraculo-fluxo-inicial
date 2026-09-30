const DEFAULT_DESCRIPTION =
  'Simule a avaliação da banca neste edital antes de enviar sua proposta — Oráculo Cultural.';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  if (typeof document === 'undefined') return;
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function publicAppOrigin(): string {
  const envOrigin = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  if (envOrigin) return envOrigin.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return 'https://oraculo-is.web.app';
}

export function defaultPublicOgImage(): string {
  return `${publicAppOrigin()}/og-image.png`;
}

/** Open Graph exige URL absoluta (https). */
export function toAbsoluteSocialImageUrl(image: string | undefined): string | undefined {
  const raw = image?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${publicAppOrigin()}${path}`;
}

export type SocialPreviewMeta = {
  title: string;
  description?: string;
  url: string;
  /** Imagem absoluta (https) — capa do edital ou fallback */
  image?: string;
};

/** Atualiza Open Graph / Twitter para preview ao compartilhar a URL. */
export function applySocialPreviewMeta(meta: SocialPreviewMeta) {
  const description = meta.description?.trim() || DEFAULT_DESCRIPTION;
  const image = toAbsoluteSocialImageUrl(meta.image) || defaultPublicOgImage();

  upsertMeta('property', 'og:title', meta.title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:url', meta.url);
  upsertMeta('property', 'og:image', image);
  upsertMeta('property', 'og:image:secure_url', image);
  upsertMeta('property', 'og:site_name', 'Oráculo Cultural');
  upsertMeta('property', 'og:locale', 'pt_BR');

  upsertMeta('name', 'description', description);
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', meta.title);
  upsertMeta('name', 'twitter:description', description);
  upsertMeta('name', 'twitter:image', image);

  upsertCanonical(meta.url);
}

export function resetSocialPreviewMeta() {
  applySocialPreviewMeta({
    title: 'Oráculo Cultural',
    description:
      'Aqui você encontra todas as ferramentas e conteúdos para transformar seus projetos culturais em realidade.',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://oraculo-is.web.app',
    image: defaultPublicOgImage(),
  });
}
