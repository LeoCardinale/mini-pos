// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import UsersPage from './pages/admin/UsersPage';

// Pages
import Login from './pages/Login';
import POSPage from './pages/pos/POSPage';
import InventoryPage from './pages/inventory/InventoryPage';
import RegisterControl from './pages/register/RegisterControl';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <main className="p-4">
            <Routes>
              {/* Ruta pública */}
              <Route path="/login" element={<Login />} />

              {/* Ruta por defecto - redirige a login */}
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* Rutas protegidas */}
              <Route
                path="/inventory"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <InventoryPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/pos"
                element={
                  <ProtectedRoute>
                    <POSPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/register"
                element={
                  <ProtectedRoute>
                    <RegisterControl />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />

              {/* Ruta para manejar URLs no encontradas */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;