import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedStory = {
  id: string;
  category: 'Tržišta' | 'Kompanije' | 'Ekonomija' | 'Sektori';
  source: string;
  published: string;
  readTime: string;
  company: string;
  ticker?: string;
  title: string;
  summary: string;
  direction: 'positive' | 'negative' | 'mixed';
  pressure: string;
  articleUrl: string;
  accent: 'lime' | 'coral' | 'blue' | 'amber' | 'violet';
};

const SAVED_STORIES_STORAGE_KEY = '@dionice-sazeto/saved-stories';

function isStoredStory(value: unknown): value is SavedStory {
  if (typeof value !== 'object' || value === null) return false;
  const story = value as Partial<SavedStory>;
  return (
    typeof story.id === 'string' &&
    typeof story.category === 'string' &&
    typeof story.source === 'string' &&
    typeof story.published === 'string' &&
    typeof story.readTime === 'string' &&
    typeof story.company === 'string' &&
    typeof story.title === 'string' &&
    typeof story.summary === 'string' &&
    typeof story.direction === 'string' &&
    typeof story.pressure === 'string' &&
    typeof story.articleUrl === 'string' &&
    typeof story.accent === 'string' &&
    (story.ticker === undefined || typeof story.ticker === 'string')
  );
}

type SavedStoriesContextValue = {
  savedStories: SavedStory[];
  isReady: boolean;
  storageError: boolean;
  isSaved: (id: string) => boolean;
  toggleSaved: (story: SavedStory) => void;
};

const SavedStoriesContext = createContext<SavedStoriesContextValue | null>(null);

export function SavedStoriesProvider({ children }: { children: ReactNode }) {
  const [savedStories, setSavedStories] = useState<SavedStory[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const savedStoriesRef = useRef<SavedStory[]>([]);
  const savedStoriesHydratedRef = useRef(false);
  const savedWriteQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(SAVED_STORIES_STORAGE_KEY)
      .then((storedValue) => {
        if (cancelled) return;
        try {
          const parsed: unknown = storedValue ? JSON.parse(storedValue) : [];
          const hydratedStories = Array.isArray(parsed) ? parsed.filter(isStoredStory) : [];
          savedStoriesRef.current = hydratedStories;
          setSavedStories(hydratedStories);
          setStorageError(false);
        } catch {
          savedStoriesRef.current = [];
          setSavedStories([]);
          setStorageError(true);
        } finally {
          savedStoriesHydratedRef.current = true;
          setIsReady(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStorageError(true);
        savedStoriesHydratedRef.current = true;
        setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persistSavedStories = useCallback((nextStories: SavedStory[]) => {
    savedWriteQueueRef.current = savedWriteQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(SAVED_STORIES_STORAGE_KEY, JSON.stringify(nextStories)))
      .then(() => setStorageError(false))
      .catch(() => setStorageError(true));
  }, []);

  const toggleSaved = useCallback((story: SavedStory) => {
    if (!savedStoriesHydratedRef.current) return;
    const current = savedStoriesRef.current;
    const nextStories = current.some((item) => item.id === story.id)
      ? current.filter((item) => item.id !== story.id)
      : [...current, story];
    savedStoriesRef.current = nextStories;
    setSavedStories(nextStories);
    persistSavedStories(nextStories);
  }, [persistSavedStories]);

  const isSaved = useCallback(
    (id: string) => savedStories.some((story) => story.id === id),
    [savedStories],
  );

  const value = useMemo(
    () => ({ savedStories, isReady, storageError, isSaved, toggleSaved }),
    [isReady, isSaved, savedStories, storageError, toggleSaved],
  );

  return <SavedStoriesContext.Provider value={value}>{children}</SavedStoriesContext.Provider>;
}

export function useSavedStories() {
  const context = useContext(SavedStoriesContext);
  if (!context) {
    throw new Error('useSavedStories must be used inside SavedStoriesProvider');
  }
  return context;
}