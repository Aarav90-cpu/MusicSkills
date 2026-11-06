import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ChatSession, ActivityEvent, PlayerTrack } from '../types';

export type AppRoute = 'welcome' | 'setup' | 'home' | 'chat' | 'vocals' | 'iterate' | 'settings';

interface AppContextType {
  route: AppRoute;
  setRoute: (route: AppRoute) => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  activeChat: ChatSession | null;
  setActiveChat: (chat: ChatSession | null) => void;
  chats: ChatSession[];
  refreshChats: () => Promise<void>;
  
  // Theme
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  
  // Audio Player
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playTrack: (track: PlayerTrack) => void;
  pauseTrack: () => void;
  togglePlayback: () => void;
  seekTrack: (seconds: number) => void;
  setPlayerVolume: (vol: number) => void;
  
  // Activity Stream
  activityEvents: ActivityEvent[];
  addActivityEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  clearActivityEvents: () => void;
  isActivityOpen: boolean;
  setIsActivityOpen: (open: boolean) => void;
  toggleActivity: () => void;

  // Snackbar Notification
  snackbar: { message: string; actionLabel?: string; onAction?: () => void } | null;
  showSnackbar: (message: string, actionLabel?: string, onAction?: () => void) => void;
  hideSnackbar: () => void;

  // Config & API status
  hasApiKey: boolean;
  systemStatus: any;
  checkStatus: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<AppRoute>('welcome');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<ChatSession | null>(null);
  const [chats, setChats] = useState<ChatSession[]>([]);
  
  // PRIORITY: Dark Studio Mode by default
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  
  // Audio Player State
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Activity Stream State
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      stage: 'Engine initialized in Dark Studio mode',
      status: 'done',
    },
  ]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);

  // Snackbar State
  const [snackbar, setSnackbar] = useState<{ message: string; actionLabel?: string; onAction?: () => void } | null>(null);

  // System status
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  // Apply Theme to DOM
  const setTheme = (t: 'dark' | 'light') => {
    setThemeState(t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Check backend status & load chats on boot
  const checkStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(data);
        setHasApiKey(data.hasApiKey);
      }
    } catch (e) {
      console.warn('Backend status check failed:', e);
    }
  };

  const refreshChats = async () => {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch (e) {
      console.error('Failed to fetch chats:', e);
    }
  };

  useEffect(() => {
    // Enforce dark mode initially
    setTheme('dark');
    checkStatus();
    refreshChats();
  }, []);

  // Fetch active chat details when activeChatId changes
  useEffect(() => {
    if (!activeChatId) {
      setActiveChat(null);
      return;
    }
    const fetchChat = async () => {
      try {
        const res = await fetch(`/api/chats/${activeChatId}`);
        if (res.ok) {
          const data = await res.json();
          setActiveChat(data);
        }
      } catch (err) {
        console.error('Error fetching chat:', err);
      }
    };
    fetchChat();
  }, [activeChatId]);

  // Audio element listener setup
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };
    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0);
    };
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const playTrack = (track: PlayerTrack) => {
    setCurrentTrack(track);
    if (audioRef.current) {
      audioRef.current.src = track.mp3Url;
      audioRef.current.volume = volume;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Audio playback error:', err);
      });
    }
  };

  const pauseTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const togglePlayback = () => {
    if (isPlaying) {
      pauseTrack();
    } else if (currentTrack && audioRef.current) {
      audioRef.current.play().then(() => setIsPlaying(true));
    }
  };

  const seekTrack = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const setPlayerVolume = (vol: number) => {
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  // Keyboard shortcut: Space toggles playback unless an input is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && !(e.target as HTMLElement)?.isContentEditable) {
          e.preventDefault();
          togglePlayback();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTrack]);

  // Activity events helper
  const addActivityEvent = (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
    setActivityEvents(prev => [
      ...prev,
      {
        ...event,
        id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const clearActivityEvents = () => {
    setActivityEvents([]);
  };

  const toggleActivity = () => {
    setIsActivityOpen(prev => !prev);
  };

  const showSnackbar = (message: string, actionLabel?: string, onAction?: () => void) => {
    setSnackbar({ message, actionLabel, onAction });
    setTimeout(() => {
      setSnackbar(null);
    }, 4500);
  };

  const hideSnackbar = () => {
    setSnackbar(null);
  };

  return (
    <AppContext.Provider
      value={{
        route,
        setRoute,
        activeChatId,
        setActiveChatId,
        activeChat,
        setActiveChat,
        chats,
        refreshChats,
        theme,
        setTheme,
        toggleTheme,
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        playTrack,
        pauseTrack,
        togglePlayback,
        seekTrack,
        setPlayerVolume,
        activityEvents,
        addActivityEvent,
        clearActivityEvents,
        isActivityOpen,
        setIsActivityOpen,
        toggleActivity,
        snackbar,
        showSnackbar,
        hideSnackbar,
        hasApiKey,
        systemStatus,
        checkStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

