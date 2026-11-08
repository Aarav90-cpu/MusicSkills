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
import { ScrollingLyricsPage } from './pages/ScrollingLyricsPage';
import { CodeEditorPage } from './pages/CodeEditorPage';
import { StatsPage } from './pages/StatsPage';
import { MusicVideoStudioPage } from './pages/MusicVideoStudioPage';
import { BeatStudioPage } from './pages/BeatStudioPage';
import { FloatingChatBox } from './components/FloatingChatBox';

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
      case 'lyrics':
        return <ScrollingLyricsPage />;
      case 'code':
        return <CodeEditorPage />;
      case 'stats':
        return <StatsPage />;
      case 'video':
        return <MusicVideoStudioPage />;
      case 'studio':
        return <BeatStudioPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <AppShell>
      {renderCurrentPage()}
      {route !== 'studio' && <FloatingChatBox />}
    </AppShell>
  );
};

