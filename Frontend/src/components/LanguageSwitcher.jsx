import React from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { Globe } from 'lucide-react';

export function LanguageSwitcher({ variant = 'navbar', className = '' }) {
  const { language, setLanguage } = useLanguage();

  if (variant === 'simple') {
    return (
      <div className={`inline-flex items-center rounded-lg bg-[#0e1726] border border-[#223554] p-0.5 text-xs select-none ${className}`}>
        <button
          type="button"
          onClick={() => setLanguage('km')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
            language === 'km'
              ? 'bg-[#0052cc] text-white shadow-xs'
              : 'text-[#8c9bab] hover:text-[#dfe1e6]'
          }`}
          title="ភាសាខ្មែរ (Khmer)"
        >
          <span>🇰🇭</span>
          <span>ខ្មែរ</span>
        </button>
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
            language === 'en'
              ? 'bg-[#0052cc] text-white shadow-xs'
              : 'text-[#8c9bab] hover:text-[#dfe1e6]'
          }`}
          title="English"
        >
          <span>🇬🇧</span>
          <span>EN</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center rounded-md bg-[#121622] border border-[#22273b] p-0.5 text-xs select-none ${className}`}>
      <button
        type="button"
        onClick={() => setLanguage('km')}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
          language === 'km'
            ? 'bg-[#0c66e4] text-white shadow-xs'
            : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
        }`}
        title="ភាសាខ្មែរ"
      >
        <span className="text-xs">🇰🇭</span>
        <span>ខ្មែរ</span>
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
          language === 'en'
            ? 'bg-[#0c66e4] text-white shadow-xs'
            : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
        }`}
        title="English"
      >
        <span className="text-xs">🇬🇧</span>
        <span>EN</span>
      </button>
    </div>
  );
}

