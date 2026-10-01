import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiMoon, FiSun } from 'react-icons/fi';

// Light by default; dark is an opt-in remembered per browser.
const KEY = 'pakmedrecord.theme';
const ThemeContext = createContext({ theme: 'light', toggle: () => {} });

const readTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#04060c' : '#f3f6fb');
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable: theme just won't persist */
    }
  }, [theme]);

  const toggle = useCallback(() => {
    // animate colours only during an explicit switch
    const root = document.documentElement;
    root.classList.add('theme-anim');
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
    setTimeout(() => root.classList.remove('theme-anim'), 450);
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export const ThemeToggle = ({ className = 'btn btn-ghost btn-icon' }) => {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button type="button" className={`${className} theme-toggle`} onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}>
      <motion.span key={theme} initial={{ rotate: -90, scale: 0.5, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} style={{ display: 'inline-flex' }}>
        {dark ? <FiSun size={17} /> : <FiMoon size={17} />}
      </motion.span>
    </button>
  );
};
