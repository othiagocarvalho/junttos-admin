import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConsultorAuthProvider, ConsultorPrivateRoute } from '../../context/ConsultorAuthContext'
import ConsultorLogin    from './ConsultorLogin'
import ConsultorDemo     from './ConsultorDemo'
import ConsultorVisitas  from './ConsultorVisitas'
import ConsultorNovaLoja from './ConsultorNovaLoja'

export default function ConsultorApp() {
  return (
    <ConsultorAuthProvider>
      <BrowserRouter basename="/c">
        <Routes>
          <Route path="/"         element={<ConsultorLogin />} />
          <Route path="/demo"     element={<ConsultorPrivateRoute><ConsultorDemo /></ConsultorPrivateRoute>} />
          <Route path="/visitas"  element={<ConsultorPrivateRoute><ConsultorVisitas /></ConsultorPrivateRoute>} />
          <Route path="/nova-loja" element={<ConsultorPrivateRoute><ConsultorNovaLoja /></ConsultorPrivateRoute>} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConsultorAuthProvider>
  )
}
