import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  Bell,
  HelpCircle,
  Settings,
  Layers,
  LogOut,
  User,
  ChevronDown,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Navbar({ onOpenCreateModal, onOpenCreateProjectModal }) {
  const handleCreate = onOpenCreateProjectModal || onOpenCreateModal;
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { t } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-[#161a23] border-b border-[#22273b] px-4 h-14 flex items-center justify-between text-sm select-none shadow-sm">
      {/* Left: NexusFlow Brand Logo & Nav Links */}
      <div className="flex items-center gap-3">
        {/* NexusFlow Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#0052cc] via-[#4f46e5] to-[#7c3aed] flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 group-hover:shadow-indigo-500/35 transition-all">
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="2.5" fill="currentColor" />
              <circle cx="18" cy="18" r="2.5" fill="currentColor" />
              <path d="M8.5 7.5L15.5 16.5" />
              <path d="M12 6c3 0 6 2.5 6 6" strokeDasharray="2 2" />
              <path d="M12 18c-3 0-6-2.5-6-6" strokeDasharray="2 2" />
            </svg>
          </div>
          <div className="flex items-center">
            <span className="font-bold text-base tracking-tight text-[#dfe1e6]">Nexus<span className="text-[#579dff]">Flow</span></span>
          </div>
        </Link>

        {/* Main Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 ml-2 text-xs font-medium text-[#9fadbc]">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              location.pathname === '/' || location.pathname === '/projects'
                ? 'text-[#579dff] bg-[#0c66e4]/15 font-semibold'
                : 'hover:text-[#dfe1e6] hover:bg-[#202738]'
            }`}
          >
            <Layers size={14} />
            <span>{t('nav.projects')}</span>
          </Link>

          <Link
            to="/filters"
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              location.pathname.startsWith('/filters')
                ? 'text-[#579dff] bg-[#0c66e4]/15 font-semibold'
                : 'hover:text-[#dfe1e6] hover:bg-[#202738]'
            }`}
          >
            <span>{t('nav.filters')}</span>
          </Link>

          <Link
            to="/teams"
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              location.pathname.startsWith('/teams')
                ? 'text-[#579dff] bg-[#0c66e4]/15 font-semibold'
                : 'hover:text-[#dfe1e6] hover:bg-[#202738]'
            }`}
          >
            <span>{t('nav.teams')}</span>
          </Link>

          <Link
            to="/explore"
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              location.pathname.startsWith('/explore')
                ? 'text-teal-400 bg-teal-500/15 font-semibold'
                : 'hover:text-teal-300 hover:bg-[#202738] text-[#9fadbc]'
            }`}
          >
            <Sparkles size={13} className="text-teal-400" />
            <span>Marketplace</span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Explore
            </span>
          </Link>
        </nav>

        {/* Jira Primary Action Button: "+ Create Project" */}
        {handleCreate && (
          <button
            type="button"
            onClick={handleCreate}
            title={t('nav.createProject')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.8} />
            <span>{t('nav.createProject')}</span>
          </button>
        )}
      </div>

      {/* Right: Search Bar, Badges & Profile Avatar */}
      <div className="flex items-center gap-2.5">
        {/* Language Switcher Button */}
        <LanguageSwitcher variant="navbar" />

        {/* Quick Icon Tools */}
        <div className="flex items-center text-[#8c9bab] gap-1">
          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 hover:text-[#dfe1e6] hover:bg-[#202738] rounded-md transition-all cursor-pointer flex items-center justify-center"
            title={isDark ? t('nav.lightMode') : t('nav.darkMode')}
          >
            {isDark ? (
              <Sun size={16} className="text-amber-400 hover:rotate-45 transition-transform" />
            ) : (
              <Moon size={16} className="text-indigo-400 hover:-rotate-12 transition-transform" />
            )}
          </button>

          <button
            type="button"
            className="p-1.5 hover:text-[#dfe1e6] hover:bg-[#202738] rounded transition-colors"
            title={t('nav.notifications')}
          >
            <Bell size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 hover:text-[#dfe1e6] hover:bg-[#202738] rounded transition-colors"
            title={t('nav.help')}
          >
            <HelpCircle size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 hover:text-[#dfe1e6] hover:bg-[#202738] rounded transition-colors"
            title={t('nav.settings')}
          >
            <Settings size={16} />
          </button>
        </div>

        {/* User Account Avatar & Dropdown */}
        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-[#202738] transition-colors cursor-pointer"
            >
              <img
                src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name}`}
                alt={user.name}
                className="w-7 h-7 rounded-full bg-[#1e2333] border border-[#3b4460] shadow-sm"
              />
              <span className="text-xs font-semibold text-[#dfe1e6] hidden md:inline">
                {user.name}
              </span>
              <ChevronDown size={12} className="text-[#8c9bab]" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#111c2e] border border-[#223554] rounded-xl shadow-2xl py-2 z-50 text-xs text-[#c7d1db]">
                <div className="px-3.5 py-2 border-b border-[#223554]">
                  <div className="font-bold text-white text-sm">{user.name}</div>
                  <div className="text-[11px] text-[#8c9bab] truncate">{user.email}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                      {t('nav.provider')}: {user.provider || 'local'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-3.5 py-2 hover:bg-red-950/40 text-red-400 hover:text-red-300 flex items-center gap-2 transition-colors cursor-pointer mt-1"
                >
                  <LogOut size={14} />
                  <span>{t('nav.logOut')}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/login"
            className="px-3 py-1.5 bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold rounded-md shadow-sm transition-colors"
          >
            {t('auth.logIn')}
          </Link>
        )}
      </div>
    </header>
  );
}
