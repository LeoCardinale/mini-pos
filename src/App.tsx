import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SyncProvider } from './context/SyncContext';
import SyncStatus from './components/sync/SyncStatus';

// Pages
import POSPage from './pages/pos/POSPage';
import InventoryPage from './pages/inventory/InventoryPage';
import RegisterControl from './pages/register/RegisterControl';

function App() {
  return (
    <SyncProvider>
      <Router>
        <div className="min-h-screen bg-gray-100">
          <nav className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <a href="/" className="flex items-center px-2 text-gray-900">
                    Mini POS
                  </a>
                  <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                    <a href="/pos" className="text-gray-900 inline-flex items-center px-1 pt-1">
                      Punto de Venta
                    </a>
                    <a href="/inventory" className="text-gray-900 inline-flex items-center px-1 pt-1">
                      Inventario
                    </a>
                    <a href="/register" className="text-gray-900 inline-flex items-center px-1 pt-1">
                      Caja
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<POSPage />} />
              <Route path="/pos" element={<POSPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/register" element={<RegisterControl />} />
            </Routes>
          </main>

          <SyncStatus />
        </div>
      </Router>
    </SyncProvider>
  );
}

export default App;