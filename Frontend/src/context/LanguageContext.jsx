import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations.js';

const LanguageContext = createContext();

const STORAGE_KEY = 'jira_language';

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'km') {
        return saved;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 'km'; // Default to Khmer as requested by Piko!
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Ignore
    }
    // Update HTML root attributes for font & accessibility
    document.documentElement.lang = language === 'km' ? 'km' : 'en';
    if (language === 'km') {
      document.documentElement.classList.add('lang-km');
    } else {
      document.documentElement.classList.remove('lang-km');
    }
  }, [language]);

  const setLanguage = (newLang) => {
    if (newLang === 'en' || newLang === 'km') {
      setLanguageState(newLang);
    }
  };

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'km' ? 'en' : 'km'));
  };

  /**
   * Translate key with nested fallback and variable interpolation
   * e.g. t('nav.projects') or t('projects.confirmDelete', { name: 'Apollo' })
   */
  const t = (path, params = {}) => {
    const keys = path.split('.');
    
    // 1. Try current language
    let value = translations[language];
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        value = undefined;
        break;
      }
    }

    // 2. Fallback to English if missing in current language
    if (value === undefined && language !== 'en') {
      let fallbackValue = translations.en;
      for (const key of keys) {
        if (fallbackValue && typeof fallbackValue === 'object' && key in fallbackValue) {
          fallbackValue = fallbackValue[key];
        } else {
          fallbackValue = undefined;
          break;
        }
      }
      value = fallbackValue;
    }

    // 3. Fallback to key path itself
    if (value === undefined || typeof value !== 'string') {
      return path;
    }

    // 4. Interpolate variables: {{key}} -> params[key]
    if (params && typeof params === 'object') {
      return value.replace(/\{\{([^{}]+)\}\}/g, (match, paramKey) => {
        const trimmed = paramKey.trim();
        return params[trimmed] !== undefined ? params[trimmed] : match;
      });
    }

    return value;
  };

  /**
   * Helper for relative time strings in Khmer and English
   */
  const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return t('common.justNow');
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return t('common.agoMin', { count: diffMin });
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return t('common.agoHour', { count: diffHour });
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return t('common.agoDay', { count: diffDay });
    
    return date.toLocaleDateString(language === 'km' ? 'km-KH' : 'en-US');
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        isKhmer: language === 'km',
        setLanguage,
        toggleLanguage,
        t,
        formatRelativeTime,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

