import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { trackWhatsAppClicked } from '@/lib/analytics';

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '5521999999999';
const WHATSAPP_MESSAGE = encodeURIComponent('Olá! Vim pelo site do Oráculo Cultural e gostaria de tirar uma dúvida.');
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

const POPUP_DELAY_MS = 20000; // 20 segundos
const SCROLL_THRESHOLD = 0.3; // 30% da página
const POPUP_HIDE_HOURS = 24;
const STORAGE_KEY = 'oraculo_whatsapp_popup_closed';

function getPopupClosedAt(): number | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? parseInt(v, 10) : null;
  } catch {
    return null;
  }
}

function setPopupClosedAt(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {}
}

function shouldShowPopup(): boolean {
  const closedAt = getPopupClosedAt();
  if (!closedAt) return true;
  const hoursSince = (Date.now() - closedAt) / (1000 * 60 * 60);
  return hoursSince >= POPUP_HIDE_HOURS;
}

export function FloatWhatsApp() {
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupDismissedThisSession, setPopupDismissedThisSession] = useState(false);
  const [scrollTriggered, setScrollTriggered] = useState(false);
  const [timeTriggered, setTimeTriggered] = useState(false);

  const openWhatsApp = useCallback(() => {
    window.open(WHATSAPP_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const dismissPopup = useCallback(() => {
    setPopupVisible(false);
    setPopupDismissedThisSession(true);
    setPopupClosedAt();
  }, []);

  useEffect(() => {
    if (timeTriggered || !shouldShowPopup() || popupDismissedThisSession) return;
    const t = setTimeout(() => {
      setTimeTriggered(true);
      setPopupVisible(true);
    }, POPUP_DELAY_MS);
    return () => clearTimeout(t);
  }, [timeTriggered, popupDismissedThisSession]);

  useEffect(() => {
    if (scrollTriggered || !shouldShowPopup() || popupDismissedThisSession) return;
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0 && scrollTop / docHeight >= SCROLL_THRESHOLD) {
        setScrollTriggered(true);
        setPopupVisible(true);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [scrollTriggered, popupDismissedThisSession]);

  const canShowPopup = shouldShowPopup() && !popupDismissedThisSession && (timeTriggered || scrollTriggered);

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2">
      {popupVisible && canShowPopup && (
        <div className="animate-fade-in relative w-[280px] rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          <button
            type="button"
            onClick={dismissPopup}
            className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="pr-6 font-semibold text-gray-900">
            Tá com dúvida no seu projeto cultural?
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Chama a gente no WhatsApp e a gente te ajuda a destravar a próxima etapa.
          </p>
          <button
            type="button"
            onClick={() => {
              trackWhatsAppClicked({ source: 'popup_cta' });
              openWhatsApp();
              dismissPopup();
            }}
            className="mt-3 w-full rounded-lg bg-[#25D366] px-3 py-2 text-sm font-medium text-white hover:bg-[#20bd5a]"
          >
            Falar com o Oráculo no WhatsApp
          </button>
        </div>
      )}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsAppClicked({ source: 'float_button' })}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 hover:bg-[#20bd5a]"
        aria-label="Abrir WhatsApp"
      >
        <MessageCircle className="h-7 w-7" strokeWidth={2} />
      </a>
    </div>
  );
}
