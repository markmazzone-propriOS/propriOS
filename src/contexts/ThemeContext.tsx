import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

type ThemeContextType = {
  darkMode: boolean;
  toggleDarkMode: () => void;
  loading: boolean;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserPreference();
    } else {
      const savedMode = localStorage.getItem('darkMode');
      setDarkMode(savedMode === 'true');
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  async function loadUserPreference() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('dark_mode')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data) {
        setDarkMode(data.dark_mode || false);
      }
    } catch (error) {
      console.error('Error loading dark mode preference:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleDarkMode() {
    const newMode = !darkMode;
    setDarkMode(newMode);

    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ dark_mode: newMode })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error saving dark mode preference:', error);
      }
    } else {
      localStorage.setItem('darkMode', String(newMode));
    }
  }

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
