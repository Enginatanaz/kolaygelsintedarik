import React, { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginScreen } from './components/auth/LoginScreen';
import { AdminOverview } from './components/admin/AdminOverview';
import { CreateRequestForm } from './components/admin/CreateRequestForm';
import { VehicleManagement } from './components/admin/VehicleManagement';
import { DriverMessagingModule } from './components/messaging/DriverMessagingModule';
import { SupplierPortal } from './components/supplier/SupplierPortal';
import { OperatorDashboard } from './components/operator/OperatorDashboard';
import { AuditLogViewer } from './components/admin/AuditLogViewer';
import { UserManagement } from './components/admin/UserManagement';
import { VehicleRequestsView } from './components/admin/VehicleRequestsView';
import { SupplierPerformanceView } from './components/admin/SupplierPerformanceView';
import { FacilityManagementView } from './components/admin/FacilityManagementView';
import { NotificationsView } from './components/admin/NotificationsView';
import { ReportsView } from './components/admin/ReportsView';
import { DailyTemplatesView } from './components/admin/DailyTemplatesView';
import { SupplierManagementView } from './components/admin/SupplierManagementView';
import { ForcePasswordChangeModal } from './components/auth/ForcePasswordChangeModal';
import { computeAnalytics, DateFilterConfig } from './services/analyticsService';

import {
  collection,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, testFirestoreConnection } from './firebase';
import {
  VehicleRequest,
  RequestAssignment,
  Vehicle,
  Supplier,
  Facility,
  Message,
  AuditLog,
  UserProfile,
  SupplierRequestView,
} from './types';
import { INITIAL_SUPPLIERS, INITIAL_FACILITIES } from './services/seedService';

export default function App() {
  const { currentUser, userProfile, updateUserProfile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('admin-overview');

  // Live Firestore collections
  const [requests, setRequests] = useState<VehicleRequest[]>([]);
  const [assignments, setAssignments] = useState<RequestAssignment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [facilities, setFacilities] = useState<Facility[]>(INITIAL_FACILITIES);
  const [messages, setMessages] = useState<Message[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [supplierViews, setSupplierViews] = useState<SupplierRequestView[]>([]);

  // Modal for messaging a specific vehicle
  const [messageTargetVehicle, setMessageTargetVehicle] = useState<Vehicle | null>(null);

  // Sync default tab when user signs in or role updates, with deep-link support for ?requestId=
  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(window.location.search);
    const hasRequestDeepLink = params.has('requestId');

    if (userProfile?.role === 'ADMIN') {
      if (hasRequestDeepLink) {
        setActiveTab('admin-requests');
      } else if (!activeTab.startsWith('admin-')) {
        setActiveTab('admin-overview');
      }
    } else if (userProfile?.role === 'OPERATOR') {
      if (!activeTab.startsWith('op-')) {
        setActiveTab('op-daily');
      }
    } else if (userProfile?.role === 'SUPPLIER') {
      if (hasRequestDeepLink) {
        setActiveTab('sup-requests');
      } else if (!activeTab.startsWith('sup-')) {
        setActiveTab('sup-overview');
      }
    }
  }, [userProfile?.role, loading]);

  // Strict route guard for ADMIN-only routes like admin-settings
  useEffect(() => {
    if (loading) return;

    if (activeTab === 'admin-settings' && userProfile?.role !== 'ADMIN') {
      if (userProfile?.role === 'OPERATOR') {
        setActiveTab('op-daily');
      } else if (userProfile?.role === 'SUPPLIER') {
        setActiveTab('sup-overview');
      } else {
        setActiveTab('admin-overview');
      }
    }
  }, [activeTab, userProfile?.role, loading]);

  // Firestore Realtime Listeners
  useEffect(() => {
    if (!currentUser) return;

    testFirestoreConnection();

    // 1. Vehicle Requests
    const unsubReqs = onSnapshot(
      collection(db, 'vehicleRequests'),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as VehicleRequest[];
        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setRequests(data);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'vehicleRequests')
    );

    // 2. Request Assignments
    const unsubAsgs = onSnapshot(
      collection(db, 'requestAssignments'),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as RequestAssignment[];
        setAssignments(data);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'requestAssignments')
    );

    // 3. Vehicles
    const unsubVehicles = onSnapshot(
      collection(db, 'vehicles'),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Vehicle[];
        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setVehicles(data);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles')
    );

    // 4. Suppliers
    const unsubSuppliers = onSnapshot(
      collection(db, 'suppliers'),
      (snapshot) => {
        if (!snapshot.empty) {
          const data = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as any))
            .filter(
              (s) =>
                typeof s.companyName === 'string' &&
                s.companyName.trim().length > 0 &&
                !s.id.startsWith('system_') &&
                !s.isSystemRegistry
            ) as Supplier[];
          if (data.length > 0) {
            setSuppliers(data);
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'suppliers')
    );

    // 5. Facilities (Master Database)
    const unsubFacilities = onSnapshot(
      collection(db, 'facilities'),
      (snapshot) => {
        if (!snapshot.empty) {
          const data = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as any))
            .filter(
              (f) =>
                typeof f.facilityName === 'string' &&
                f.facilityName.trim().length > 0 &&
                !f.id.startsWith('system_') &&
                !f.isSystemRegistry
            ) as Facility[];
          data.sort((a, b) => (a.facilityName || '').localeCompare(b.facilityName || ''));
          if (data.length > 0) {
            setFacilities(data);
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'facilities')
    );

    // 6. Messages
    const unsubMessages = onSnapshot(
      collection(db, 'messages'),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Message[];
        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setMessages(data);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'messages')
    );

    // 7. Audit Logs
    const unsubAudit = onSnapshot(
      collection(db, 'auditLogs'),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as AuditLog[];
        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setAuditLogs(data);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
    );

    // 8. Users Collection
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as any))
          .filter(
            (u) =>
              typeof u.username === 'string' &&
              u.username.trim().length > 0 &&
              !u.id.startsWith('system_') &&
              !u.isSystemRegistry
          ) as unknown as UserProfile[];
        setAllUsers(data);
      },
      (err) => console.warn('Users fetch notice:', err.message)
    );

    // 9. Supplier Request Views (Privacy Isolation)
    const unsubViews = onSnapshot(
      collection(db, 'supplierRequestViews'),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as SupplierRequestView[];
        setSupplierViews(data);
      },
      (err) => console.warn('Supplier views fetch notice:', err.message)
    );

    return () => {
      unsubReqs();
      unsubAsgs();
      unsubVehicles();
      unsubSuppliers();
      unsubFacilities();
      unsubMessages();
      unsubAudit();
      unsubUsers();
      unsubViews();
    };
  }, [currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#092B60] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-[#FFD000] border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-white font-black text-sm tracking-wider">TEDARİK360</div>
        <div className="text-blue-200 text-xs mt-1">Güvenlik ve yetki kontrolü yapılıyor...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  const role = userProfile?.role || 'ADMIN';

  const renderContent = () => {
    // SUPPLIER PORTAL
    if (role === 'SUPPLIER') {
      return (
        <SupplierPortal
          requests={requests}
          assignments={assignments}
          vehicles={vehicles}
          suppliers={suppliers}
          facilities={facilities}
          supplierViews={supplierViews}
          currentTab={activeTab}
          onNavigateToTab={(tab) => setActiveTab(tab)}
        />
      );
    }

    // OPERATOR DASHBOARD
    if (role === 'OPERATOR') {
      if (activeTab === 'op-messages' || activeTab === 'op-bulk-message') {
        return (
          <DriverMessagingModule
            messages={messages}
            vehicles={vehicles}
            activeVehicleForModal={messageTargetVehicle}
          />
        );
      }
      if (activeTab === 'op-notifications') {
        return <NotificationsView onNavigateToRequest={() => setActiveTab('op-daily')} />;
      }
      if (activeTab === 'op-history') {
        return <AuditLogViewer logs={auditLogs} />;
      }
      return (
        <OperatorDashboard
          vehicles={vehicles}
          suppliers={suppliers}
          currentTab={activeTab}
          onOpenMessageModal={(v) => {
            setMessageTargetVehicle(v);
            setActiveTab('op-messages');
          }}
        />
      );
    }

    // Date filter state for supplier performance & analytics
    const analyticsData = computeAnalytics(requests, assignments, vehicles, suppliers, { range: 'ALL' });

    // ADMIN VIEWS (11 Modül Düzeni)
    switch (activeTab) {
      case 'admin-overview':
        return (
          <AdminOverview
            requests={requests}
            assignments={assignments}
            vehicles={vehicles}
            suppliers={suppliers}
            facilities={facilities}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        );
      case 'admin-new-request':
        return (
          <CreateRequestForm
            facilities={facilities}
            suppliers={suppliers}
            onSuccess={() => setActiveTab('admin-requests')}
          />
        );
      case 'admin-requests':
        return (
          <VehicleRequestsView
            requests={requests}
            assignments={assignments}
            vehicles={vehicles}
            suppliers={suppliers}
            facilities={facilities}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        );
      case 'admin-vehicles':
        return (
          <VehicleManagement
            vehicles={vehicles}
            suppliers={suppliers}
            onOpenMessageModal={(v) => {
              setMessageTargetVehicle(v);
              setActiveTab('admin-messages');
            }}
          />
        );
      case 'admin-suppliers':
        if (loading) {
          return (
            <div className="p-12 text-center text-slate-500 font-medium text-xs">
              Tedarikçi verileri yükleniyor...
            </div>
          );
        }
        if (userProfile?.role !== 'ADMIN') {
          return (
            <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2">
              <div className="text-sm font-black text-rose-950">Erişim Engellendi (403 Yetkisiz Erişim)</div>
              <div className="text-rose-800 font-bold">
                Tedarikçi Yönetimi modülüne yalnızca doğrulanmış ADMIN yetkisine sahip kullanıcılar erişebilir.
              </div>
              <button
                onClick={() => setActiveTab('admin-overview')}
                className="mt-3 bg-[#092B60] text-white px-4 py-2 rounded-xl text-xs font-bold"
              >
                Genel Bakışa Dön
              </button>
            </div>
          );
        }
        return (
          <SupplierManagementView
            suppliers={suppliers}
            requests={requests}
            assignments={assignments}
            vehicles={vehicles}
            onNavigateToPerformance={() => setActiveTab('admin-supplier-performance')}
          />
        );
      case 'admin-supplier-performance':
        return (
          <SupplierPerformanceView
            suppliers={analyticsData.suppliers}
            routes={analyticsData.routes}
            allRequests={requests}
            allVehicles={vehicles}
            allAssignments={assignments}
            allSuppliersList={suppliers}
            facilities={facilities}
            onNavigateToRequest={() => setActiveTab('admin-requests')}
          />
        );
      case 'admin-templates':
        if (loading) {
          return (
            <div className="p-12 text-center text-slate-500 font-medium text-xs">
              Yetki doğrulanıyor...
            </div>
          );
        }
        if (userProfile?.role !== 'ADMIN') {
          return (
            <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2">
              <div className="text-sm font-black text-rose-950">Erişim Engellendi (403 Yetkisiz Erişim)</div>
              <div className="text-rose-800 font-bold">
                Günlük Talep Şablonları ekranına yalnızca doğrulanmış ADMIN yetkisine sahip kullanıcılar erişebilir.
              </div>
              <button
                onClick={() => setActiveTab('admin-overview')}
                className="mt-3 bg-[#092B60] text-white px-4 py-2 rounded-xl text-xs font-bold"
              >
                Genel Bakışa Dön
              </button>
            </div>
          );
        }
        return (
          <DailyTemplatesView
            facilities={facilities}
            suppliers={suppliers}
            onNavigateToTab={setActiveTab}
          />
        );
      case 'admin-facilities':
        return <FacilityManagementView facilities={facilities} />;
      case 'admin-operators':
        return <UserManagement users={allUsers} suppliers={suppliers} />;
      case 'admin-messages':
        return (
          <DriverMessagingModule
            messages={messages}
            vehicles={vehicles}
            activeVehicleForModal={messageTargetVehicle}
          />
        );
      case 'admin-notifications':
        return <NotificationsView onNavigateToRequest={() => setActiveTab('admin-requests')} />;
      case 'admin-reports':
        return (
          <ReportsView
            routes={analyticsData.routes}
            suppliers={analyticsData.suppliers}
            requests={requests}
            vehicles={vehicles}
            assignments={assignments}
            allSuppliers={suppliers}
            facilities={facilities}
          />
        );
      case 'admin-settings':
        if (loading) {
          return (
            <div className="p-12 text-center text-slate-500 font-medium text-xs">
              Sistem Ayarları yetkisi doğrulanıyor...
            </div>
          );
        }
        if (userProfile?.role !== 'ADMIN') {
          return (
            <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2">
              <div className="text-sm font-black text-rose-950">Erişim Engellendi (403 Yetkisiz Erişim)</div>
              <div className="text-rose-800 font-bold">
                Sistem Ayarları ekranına yalnızca doğrulanmış ADMIN yetkisine sahip kullanıcılar erişebilir.
              </div>
              <div className="text-[11px] text-slate-500">Genel Bakış sayfasına yönlendiriliyorsunuz...</div>
            </div>
          );
        }
        return (
          <div className="space-y-6">
            <UserManagement users={allUsers} suppliers={suppliers} />
            <AuditLogViewer logs={auditLogs} />
          </div>
        );
      case 'admin-audit':
        return <AuditLogViewer logs={auditLogs} />;
      default:
        return (
          <AdminOverview
            requests={requests}
            assignments={assignments}
            vehicles={vehicles}
            suppliers={suppliers}
            facilities={facilities}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased relative">
      {userProfile?.mustChangePassword && (
        <ForcePasswordChangeModal
          onSuccess={() => updateUserProfile({ mustChangePassword: false })}
        />
      )}

      <Navbar
        activeTab={activeTab}
        vehicles={vehicles}
        onNavigateToTab={(tabId) => setActiveTab(tabId)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentTab={activeTab} onSelectTab={(tabId) => setActiveTab(tabId)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100">
          <div className="max-w-7xl mx-auto">{renderContent()}</div>
        </main>
      </div>
    </div>
  );
}
