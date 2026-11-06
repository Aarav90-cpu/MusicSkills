import React from 'react';
import { useApp } from './context/AppContext';
import { AppShell } from './components/AppShell';
import { WelcomePage } from './pages/WelcomePage';
import { SetupPage } from './pages/SetupPage';
import { HomePage } from './pages/HomePage';
import { ChatCreationPage } from './pages/ChatCreationPage';
import { VocalStudioPage } from './pages/VocalStudioPage';
import { IteratePage } from './pages/IteratePage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const { route } = useApp();

  const renderCurrentPage = () => {
    switch (route) {
      case 'welcome':
        return <WelcomePage />;
      case 'setup':
        return <SetupPage />;
      case 'home':
        return <HomePage />;
      case 'chat':
        return <ChatCreationPage />;
      case 'vocals':
        return <VocalStudioPage />;
      case 'iterate':
        return <IteratePage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  return <AppShell>{renderCurrentPage()}</AppShell>;
};
