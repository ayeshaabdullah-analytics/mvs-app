import { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

export const THEMES = { neon: 'neon', sunrise: 'sunrise', arctic: 'arctic', forest: 'forest' };

const THEME_META = {
  neon:    { icon: '⚡', label: 'Neon',    desc: 'Fuchsia & Purple' },
  sunrise: { icon: '🌅', label: 'Sunrise', desc: 'Coral & Gold' },
  arctic:  { icon: '❄️', label: 'Arctic',  desc: 'Cyan & Ice' },
  forest:  { icon: '🌿', label: 'Forest',  desc: 'Neon Green' },
};

export { THEME_META };

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState('neon');

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'userSettings', user.uid);
    getDoc(ref).then((snap) => {
      if (snap.exists() && snap.data().theme) {
        const t = snap.data().theme;
        // migrate old theme names to new names
        const map = {
          vivid: 'neon',
          solar: 'sunrise',
          ocean: 'arctic',
          rose:  'forest',
          slate: 'neon',
          ember: 'sunrise',
          jade:  'forest',
        };
        setThemeState(map[t] ?? (THEMES[t] ? t : 'neon'));
      }
    });
  }, [user]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = async (newTheme) => {
    setThemeState(newTheme);
    if (user) {
      await setDoc(doc(db, 'userSettings', user.uid), { theme: newTheme }, { merge: true });
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES, themeMeta: THEME_META }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
