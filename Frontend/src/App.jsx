import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { FontSizeProvider } from './context/FontSizeContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { ProjectsPage } from './pages/ProjectsPage.jsx';
import { ProjectDetailPage } from './pages/ProjectDetailPage.jsx';
import { IssueDetailPage } from './pages/IssueDetailPage.jsx';
import { TeamsPage } from './pages/TeamsPage.jsx';
import { FiltersPage } from './pages/FiltersPage.jsx';
import { MarketplacePage } from './pages/MarketplacePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AcceptInvitePage from './pages/AcceptInvitePage.jsx';
import { CreateProjectModal } from './components/CreateProjectModal.jsx';
import { api } from './services/api.js';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isGlobalCreateProjectModalOpen, setIsGlobalCreateProjectModalOpen] = useState(false);

  const isAuthPage = location.pathname === '/login';

  const handleGlobalCreateProject = async (projData) => {
    const res = await api.createProject(projData);
    if (res?.data?.id) {
      navigate(`/projects/${res.data.id}`);
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0c1017] text-[#dfe1e6]">
      {/* Show Navbar only if logged in and not on login page */}
      {!isAuthPage && user && (
        <Navbar onOpenCreateModal={() => setIsGlobalCreateProjectModalOpen(true)} />
      )}

      <main className="flex-1">
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invite/accept" element={<AcceptInvitePage />} />

          {/* Protected Application & Dashboard Routes (Require Login) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <ProtectedRoute>
                <ProjectDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/issues/:issueId"
            element={
              <ProtectedRoute>
                <IssueDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <TeamsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/filters"
            element={
              <ProtectedRoute>
                <FiltersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/explore"
            element={
              <ProtectedRoute>
                <MarketplacePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      {!isAuthPage && user && (
        <CreateProjectModal
          isOpen={isGlobalCreateProjectModalOpen}
          onClose={() => setIsGlobalCreateProjectModalOpen(false)}
          onProjectCreated={handleGlobalCreateProject}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <FontSizeProvider>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </FontSizeProvider>
    </LanguageProvider>
  );
}
