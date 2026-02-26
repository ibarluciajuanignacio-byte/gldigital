import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { MainLayout } from "./layouts/MainLayout";
import { ChatPage } from "./pages/ChatPage";
import { ConsignmentsPage } from "./pages/ConsignmentsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DebtsPage } from "./pages/DebtsPage";
import { InventoryPage } from "./pages/InventoryPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { ClientsPage } from "./pages/ClientsPage";
import { ResellersMapPage } from "./pages/ResellersMapPage";
import { ResellerProfilePage } from "./pages/ResellerProfilePage";
import { ResellersPage } from "./pages/ResellersPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { SupplierDetailPage } from "./pages/SupplierDetailPage";
import { PurchasesPage } from "./pages/PurchasesPage";
import { PurchaseOrderDetailPage } from "./pages/PurchaseOrderDetailPage";
import { CashboxesPage } from "./pages/CashboxesPage";
import { CashboxDetailPage } from "./pages/CashboxDetailPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TechniciansPage } from "./pages/TechniciansPage";
import { LoginPage } from "./pages/LoginPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
          <Route path="/purchases" element={<PurchasesPage />} />
          <Route path="/purchases/:id" element={<PurchaseOrderDetailPage />} />
          <Route path="/resellers" element={<ResellersPage />} />
          <Route path="/resellers/map" element={<ResellersMapPage />} />
          <Route path="/resellers/:id" element={<ResellerProfilePage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/consignments" element={<ConsignmentsPage />} />
          <Route path="/debts" element={<DebtsPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/cashboxes" element={<CashboxesPage />} />
          <Route path="/cashboxes/:id" element={<CashboxDetailPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/technicians" element={<TechniciansPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
