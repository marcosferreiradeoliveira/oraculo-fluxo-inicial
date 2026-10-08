import { Navigate, useSearchParams } from 'react-router-dom';

/** Rota legada — portfólio fica em Empresas (por empresa). */
const Portfolio = () => {
  const [params] = useSearchParams();
  const empresaId = params.get('empresaId') || params.get('empresa');
  if (empresaId) {
    return <Navigate to={`/empresas?empresa=${encodeURIComponent(empresaId)}&aba=galeria`} replace />;
  }
  return <Navigate to="/empresas" replace />;
};

export default Portfolio;
