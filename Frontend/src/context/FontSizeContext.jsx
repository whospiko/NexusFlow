import React, { createContext, useContext, useState, useEffect } from 'react';

const FontSizeContext = createContext();

const STORAGE_KEY = 'jira_font_size';

export function FontSizeProvider({ children }) {
  // Always lock to comfortable (middle) font size
  const fontSize = 'comfortable';

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'comfortable');
    } catch {
      // Ignore
    }

    const root = document.documentElement;
    root.classList.remove('font-compact', 'font-large');
    root.classList.add('font-comfortable');
  }, []);

  const setFontSize = () => {};
  const cycleFontSize = () => {};

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize, cycleFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
}

