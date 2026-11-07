import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ChatSession, ActivityEvent, PlayerTrack } from '../types';
import { webAudioPlayer } from '../utils/webAudioPlayer';

export type AppRoute = 'welcome' | 'setup' | 'home' | 'chat' | 'vocals' | 'iterate' | 'settings' | 'lyrics' | 'code' | 'stats' | 'video';

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
  updateCurrentTrack: (trackId: string, updates: Partial<PlayerTrack>) => void;
  
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

  // Real-time Event Stream (SSE) listening for external AI agents (Claude Code, Codex, Antigravity)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chats_updated') {
            refreshChats();
            if (data.message) {
              showSnackbar(data.message);
            }
          } else if (data.type === 'agent_artifact') {
            refreshChats();
            showSnackbar(`External AI created ${data.payload.artifact.type}: ${data.payload.artifact.name}`);
          }
        } catch (_) {}
      };
    } catch (e) {
      console.warn('Could not connect to /api/events:', e);
    }

    return () => {
      eventSource?.close();
    };
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
    audio.preload = 'auto';
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };
    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    audio.onplay = () => {
      setIsPlaying(true);
    };
    audio.onpause = () => {
      setIsPlaying(false);
    };
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    audio.onerror = (e) => {
      console.warn('HTML Audio Element error:', e, audio.error);
      setIsPlaying(false);
    };

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const playTrack = (track: PlayerTrack) => {
    // 1. Sanitize mp3Url to ensure it's never empty, ending with slash, or a dead blob URL
    let safeMp3Url = track.mp3Url;
    if (
      !safeMp3Url ||
      safeMp3Url.endsWith('/') ||
      safeMp3Url.endsWith('/undefined') ||
      safeMp3Url.endsWith('/null')
    ) {
      const cleanTarget = encodeURIComponent(track.chatId || track.songName);
      const titleParam = encodeURIComponent(track.songName || '');
      safeMp3Url = `/api/audio/${cleanTarget}/v1_custom.mp3?title=${titleParam}`;
    }

    const coverUrl =
      track.coverArtUrl && !track.coverArtUrl.startsWith('blob:')
        ? track.coverArtUrl
        : `/api/audio/${encodeURIComponent(track.chatId || track.songName)}/cover?title=${encodeURIComponent(track.songName)}`;

    const normalizedTrack: PlayerTrack = {
      ...track,
      mp3Url: safeMp3Url,
      coverArtUrl: coverUrl,
      durationSec: track.durationSec || 180,
    };

    // 2. If same track is already loaded in audio element
    if (
      currentTrack &&
      currentTrack.chatId === track.chatId &&
      currentTrack.songName === track.songName &&
      currentTrack.version === track.version &&
      audioRef.current &&
      audioRef.current.src
    ) {
      if (audioRef.current.paused) {
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch(err => {
            console.warn('Resume play error:', err);
            if (err.name === 'NotAllowedError') {
              showSnackbar('Autoplay blocked: Click play in player to unlock browser audio');
            } else {
              // Try reloading the audio source if playback failed
              if (audioRef.current) {
                audioRef.current.src = safeMp3Url;
                audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
              }
            }
          });
      } else {
        // If already playing, restart track
        audioRef.current.currentTime = 0;
      }
      return;
    }

    // 3. New track load
    setCurrentTrack(normalizedTrack);
    setDuration(normalizedTrack.durationSec || 180);

    if (audioRef.current) {
      const audio = audioRef.current;
      audio.pause();
      audio.src = safeMp3Url;
      audio.volume = volume;
      audio.currentTime = 0;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(err => {
            if (err.name === 'NotAllowedError') {
              showSnackbar('Autoplay blocked: Click play in player to listen');
              setIsPlaying(false);
            } else if (err.name === 'AbortError') {
              // Harmless interruption by user rapidly selecting another track
            } else {
              console.error('Audio playback error, attempting title-based stream fallback:', err);
              const fallbackUrl = `/api/audio/${encodeURIComponent(track.songName)}/v1_custom.mp3?title=${encodeURIComponent(track.songName)}`;
              if (audioRef.current && safeMp3Url !== fallbackUrl) {
                audioRef.current.src = fallbackUrl;
                audioRef.current
                  .play()
                  .then(() => setIsPlaying(true))
                  .catch(fallbackErr => {
                    console.error('Audio stream fallback also failed:', fallbackErr);
                    showSnackbar(`Could not stream audio for "${track.songName}".`);
                    setIsPlaying(false);
                  });
              } else {
                showSnackbar(`Could not stream audio for "${track.songName}".`);
                setIsPlaying(false);
              }
            }
          });
      }
    }
  };

  const pauseTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      pauseTrack();
    } else if (currentTrack) {
      if (audioRef.current && audioRef.current.src) {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(err => {
            console.warn('Toggle playback error:', err);
            if (err.name === 'NotAllowedError') {
              showSnackbar('Click play in player to unlock browser audio');
            } else {
              // Retry loading from currentTrack definition
              playTrack(currentTrack);
            }
          });
      } else {
        playTrack(currentTrack);
      }
    }
  };

  const seekTrack = (seconds: number) => {
    const clamped = Math.max(0, Math.min(duration || 180, seconds));
    if (audioRef.current && !isNaN(audioRef.current.duration) && audioRef.current.duration > 0) {
      try {
        audioRef.current.currentTime = clamped;
      } catch (_) {}
    }
    setCurrentTime(clamped);
  };

  const setPlayerVolume = (vol: number) => {
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const updateCurrentTrack = (trackId: string, updates: Partial<PlayerTrack>) => {
    setCurrentTrack(prev => {
      if (!prev) return null;
      const cleanTarget = trackId.trim().toLowerCase();
      const matchesChat = prev.chatId && prev.chatId.toLowerCase() === cleanTarget;
      const matchesSong = prev.songName && prev.songName.trim().toLowerCase() === cleanTarget;
      if (matchesChat || matchesSong) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  };

  // Keyboard shortcut: Space toggles playback unless an input is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
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
        updateCurrentTrack,
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

