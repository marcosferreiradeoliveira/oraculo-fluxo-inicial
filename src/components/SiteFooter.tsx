import { Link } from 'react-router-dom';

const SUPPORT_EMAIL = 'suporte@oraculocultural.com.br';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-white text-gray-600 shrink-0">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md text-sm">
            <p className="font-semibold text-gray-900">Oráculo Cultural</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              © {year} Mobr Produções Artísticas LTDA — CNPJ 11.794.400/0001-32. Todos os direitos reservados.
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium"
            aria-label="Links institucionais"
          >
            <Link to="/termos" className="text-gray-600 hover:text-oraculo-blue transition-colors">
              Termos de uso
            </Link>
            <Link to="/privacidade" className="text-gray-600 hover:text-oraculo-blue transition-colors">
              Política de privacidade
            </Link>
            <Link to="/suporte" className="text-gray-600 hover:text-oraculo-blue transition-colors">
              Suporte
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-gray-600 hover:text-oraculo-blue transition-colors"
            >
              Contato
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
