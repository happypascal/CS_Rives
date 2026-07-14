import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import RegistreCS from './pages/RegistreCS'
import DecisionForm from './pages/DecisionForm'
import DecisionDetail from './pages/DecisionDetail'
import AGList from './pages/AGList'
import AGForm from './pages/AGForm'
import AGDetail from './pages/AGDetail'
import ProjetList from './pages/ProjetList'
import ProjetForm from './pages/ProjetForm'
import ProjetDetail from './pages/ProjetDetail'
import BudgetsConsolidated from './pages/BudgetsConsolidated'
import Membres from './pages/Membres'
import Parametres from './pages/Parametres'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/registre" replace />} />
            <Route path="/tableau-de-bord" element={<Dashboard />} />
            <Route path="/registre" element={<RegistreCS />} />
            <Route path="/registre/nouvelle" element={<DecisionForm />} />
            <Route path="/registre/:id" element={<DecisionDetail />} />
            <Route path="/registre/:id/modifier" element={<DecisionForm />} />
            <Route path="/ag" element={<AGList />} />
            <Route path="/ag/nouvelle" element={<AGForm />} />
            <Route path="/ag/:id" element={<AGDetail />} />
            <Route path="/ag/:id/modifier" element={<AGForm />} />
            <Route path="/projets" element={<ProjetList />} />
            <Route path="/projets/nouveau" element={<ProjetForm />} />
            <Route path="/projets/:id" element={<ProjetDetail />} />
            <Route path="/projets/:id/modifier" element={<ProjetForm />} />
            <Route path="/budgets" element={<BudgetsConsolidated />} />
            <Route path="/membres" element={<Membres />} />
            <Route path="/parametres" element={<Parametres />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
