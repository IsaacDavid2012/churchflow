import React, { useState, useEffect } from 'react';
import { api } from './api';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import ServiceList from './components/ServiceList';
import ServiceDetail from './components/ServiceDetail';
import CreateServiceModal from './components/CreateServiceModal';
import PeopleManager from './components/PeopleManager';
import MinistriesManager from './components/MinistriesManager';
import PositionsManager from './components/PositionsManager';
import ChurchProfileManager from './components/ChurchProfileManager';
import UsersManager from './components/UsersManager';
import NotificationsFeed from './components/NotificationsFeed';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [currentTab, setCurrentTab] = useState('services'); // 'services', 'people', 'users', 'groups', 'positions', 'church', 'notifications'
  
  // Services data
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [theme] = useState('light');

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('churchflow_theme', 'light');
  }, []);

  useEffect(() => {
    checkAuth();
    const handleLogoutEvent = () => setUser(null);
    window.addEventListener('auth-logout', handleLogoutEvent);
    return () => window.removeEventListener('auth-logout', handleLogoutEvent);
  }, []);

  async function checkAuth() {
    setLoadingAuth(true);
    const storedToken = localStorage.getItem('servesync_token');
    if (!storedToken) {
      setLoadingAuth(false);
      return;
    }

    try {
      const res = await api.getMe();
      setUser(res.user);
      loadServices();
    } catch (err) {
      localStorage.removeItem('servesync_token');
      localStorage.removeItem('servesync_user');
      setUser(null);
    } finally {
      setLoadingAuth(false);
    }
  }

  async function loadServices() {
    try {
      const data = await api.getServices();
      setServices(data || []);
    } catch (err) {
      console.error('Failed to load services', err);
    }
  }

  function handleLoginSuccess(loggedInUser) {
    setUser(loggedInUser);
    loadServices();
  }

  function handleLogout() {
    localStorage.removeItem('servesync_token');
    localStorage.removeItem('servesync_user');
    setUser(null);
  }

  function handleSelectService(serviceId) {
    setSelectedServiceId(serviceId);
  }

  async function handleServiceCreated(newService) {
    await loadServices();
    if (newService?.id) {
      setSelectedServiceId(newService.id);
    }
  }

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-600">
        <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mr-3"></div>
        <span className="font-semibold text-xs">Initializing ChurchFlow...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        setTab={(tab) => {
          setCurrentTab(tab);
          setSelectedServiceId(null);
        }}
        user={user}
        theme={theme}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorBoundary onReset={() => { setSelectedServiceId(null); loadServices(); }}>
          {currentTab === 'services' && (
            <>
              {selectedServiceId ? (
                <ServiceDetail
                  serviceId={selectedServiceId}
                  onBack={() => {
                    setSelectedServiceId(null);
                    loadServices();
                  }}
                  user={user}
                />
              ) : (
                <ServiceList
                  services={services}
                  onSelectService={handleSelectService}
                  onCreateClick={() => setIsCreateModalOpen(true)}
                  onServiceDeleted={loadServices}
                  currentUser={user}
                />
              )}
            </>
          )}

          {currentTab === 'people' && <PeopleManager currentUser={user} />}
          {currentTab === 'users' && <UsersManager currentUser={user} />}
          {(currentTab === 'ministries' || currentTab === 'groups') && <MinistriesManager currentUser={user} />}
          {currentTab === 'positions' && <PositionsManager />}
          {currentTab === 'church' && <ChurchProfileManager />}
          {currentTab === 'notifications' && <NotificationsFeed />}
        </ErrorBoundary>
      </main>

      <CreateServiceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onServiceCreated={handleServiceCreated}
      />
    </div>
  );
}
