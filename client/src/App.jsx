import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DataProvider } from './contexts/DataContext';
import { ToastProvider } from './components/Layout/Toast';
import AuthOverlay from './components/Auth/AuthOverlay';
import Header from './components/Layout/Header';
import BottomNav from './components/Layout/BottomNav';
import TodayPage from './components/Today/TodayPage';
import DashboardPage from './components/Dashboard/DashboardPage';
import ChartsPage from './components/Charts/ChartsPage';
import SettingsPage from './components/Settings/SettingsPage';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('today');

  if (loading) return null;

  if (!isAuthenticated) {
    return <AuthOverlay />;
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'today': return <TodayPage />;
      case 'dashboard': return <DashboardPage />;
      case 'charts': return <ChartsPage />;
      case 'settings': return <SettingsPage />;
      default: return <TodayPage />;
    }
  };

  return (
    <>
      <div className="container">
        <Header />
        {renderPage()}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <DataProvider>
            <AppContent />
          </DataProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
