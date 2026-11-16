import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import {
  Sparkles,
  Search,
  Star,
  Download,
  Copy,
  Plus,
  Layers,
  Database,
  ExternalLink,
  Check,
  ShieldCheck,
  ArrowRight,
  Filter,
  RefreshCw,
  FolderPlus,
  BookOpen,
} from 'lucide-react';

export function MarketplacePage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [projects, setProjects] = useState([]);

  // Modals
  const [cloneNewModal, setCloneNewModal] = useState(null); // template object
  const [newProjectName, setNewProjectName] = useState('');
  const [cloningNew, setCloningNew] = useState(false);

  const [cloneExistingModal, setCloneExistingModal] = useState(null); // template object
  const [targetProjectId, setTargetProjectId] = useState('');
  const [cloningExisting, setCloningExisting] = useState(false);

  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishProjectId, setPublishProjectId] = useState('');
  const [publishName, setPublishName] = useState('');
  const [publishCategory, setPublishCategory] = useState('SaaS');
  const [publishDesc, setPublishDesc] = useState('');
  const [publishTags, setPublishTags] = useState('postgres, relational, microservices');
  const [publishing, setPublishing] = useState(false);

  const categories = ['All', 'E-Commerce', 'FinTech', 'Healthcare', 'SaaS', 'Education'];

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getMarketplaceTemplates({
        category: selectedCategory,
        search: search.trim() || undefined,
      });
      setTemplates(res.data || []);
    } catch (err) {
      console.error('Failed to load marketplace templates:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, search]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Load existing projects for clone/publish dropdowns
  useEffect(() => {
    api.getProjects()
      .then((res) => {
        setProjects(res.data || []);
        if (res.data?.length > 0) {
          setTargetProjectId(String(res.data[0].id));
          setPublishProjectId(String(res.data[0].id));
        }
      })
      .catch(() => {});
  }, []);

  const handleRate = async (templateId, star) => {
    try {
      await api.rateMarketplaceTemplate(templateId, star);
      await fetchTemplates();
    } catch (err) {
      alert(err.message || 'Rating failed');
    }
  };

  const handleCloneAsNew = async (e) => {
    e.preventDefault();
    if (!cloneNewModal || !newProjectName.trim()) return;
    try {
      setCloningNew(true);
      const res = await api.cloneTemplateAsNewProject(cloneNewModal.id, newProjectName.trim());
      const projId = res.data?.id || res.data?.projectId;
      alert(`Project '${res.data?.name}' created successfully!`);
      setCloneNewModal(null);
      setNewProjectName('');
      if (projId) {
        navigate(`/projects/${projId}`);
      }
    } catch (err) {
      alert(err.message || 'Clone failed');
    } finally {
      setCloningNew(false);
    }
  };

  const handleCloneToExisting = async (e) => {
    e.preventDefault();
    if (!cloneExistingModal || !targetProjectId) return;
    try {
      setCloningExisting(true);
      const res = await api.cloneMarketplaceTemplate(targetProjectId, cloneExistingModal.id);
      alert(`Successfully restored template into project! (${res.data?.entitiesRestored || 0} tables created)`);
      setCloneExistingModal(null);
      navigate(`/projects/${targetProjectId}`);
    } catch (err) {
      alert(err.message || 'Failed to clone into existing project');
    } finally {
      setCloningExisting(false);
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!publishProjectId || !publishName.trim()) return;
    try {
      setPublishing(true);
      const tagList = publishTags.split(',').map((t) => t.trim()).filter(Boolean);
      await api.publishMarketplaceTemplate(publishProjectId, {
        name: publishName.trim(),
        description: publishDesc.trim(),
        category: publishCategory,
        tags: tagList,
        author: 'Piko',
      });
      alert('Your schema was successfully published to the Template Marketplace!');
      setPublishModalOpen(false);
      setPublishName('');
      setPublishDesc('');
      await fetchTemplates();
    } catch (err) {
      alert(err.message || 'Failed to publish template');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-teal-950/40 via-[#161b26] to-[#121620] border border-teal-500/20 rounded-3xl p-8 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1.5">
                <Sparkles size={13} /> Module 11 • Public Model Library
              </span>
              <span className="text-xs text-[#8c9bab]">Community Driven Hub</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <BookOpen className="text-teal-400" size={30} />
              ERD Template Marketplace
            </h1>
            <p className="text-sm text-[#8c9bab] leading-relaxed">
              Explore production-ready database schemas curated for modern SaaS, FinTech, E-Commerce, and Healthcare. Clone schemas in one click as a new project or publish your own architecture to the community.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPublishModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition-all cursor-pointer shadow-lg shadow-teal-900/30"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Publish My Schema</span>
            </button>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="mt-8 pt-6 border-t border-[#22283b] flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full flex-nowrap py-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-[#10141f] text-[#8c9bab] hover:text-white hover:bg-[#1a2130] border border-[#22283b]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search size={15} className="absolute left-3 top-2.5 text-[#627084]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search schemas, banking, e-commerce..."
              className="w-full bg-[#10141f] border border-[#22283b] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-[#627084] focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 text-[#8c9bab] bg-[#161b26] rounded-2xl border border-[#22273b]">
          <RefreshCw size={28} className="animate-spin text-teal-400 mb-3" />
          <span className="text-sm font-medium">Loading community template catalog...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="p-16 text-center text-sm text-[#8c9bab] bg-[#161b26] rounded-2xl border border-[#22273b]">
          No schemas found matching "{search}". Try another keyword or category!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tmpl) => {
            const schemaData = tmpl.schema_data || {};
            const entityCount = schemaData.entities?.length || 0;
            const relCount = schemaData.relationships?.length || 0;
            const colCount = (schemaData.entities || []).reduce((acc, e) => acc + (e.attributes?.length || 0), 0);

            return (
              <div
                key={tmpl.id}
                className="bg-[#161b26] border border-[#22273b] hover:border-teal-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all group shadow-sm hover:shadow-teal-900/10"
              >
                <div className="space-y-3">
                  {/* Category and Clones */}
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#10141f] border border-[#232a3d] text-teal-300">
                      {tmpl.category}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] font-mono text-[#8c9bab]">
                      <Download size={12} className="text-teal-400" />
                      <span>{tmpl.clones_count || 0} clones</span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
                      {tmpl.name}
                    </h3>
                    <p className="text-xs text-[#8c9bab] mt-1 line-clamp-3 leading-relaxed">
                      {tmpl.description}
                    </p>
                  </div>

                  {/* Metrics Badge */}
                  <div className="grid grid-cols-3 gap-2 bg-[#10141f] p-2.5 rounded-xl border border-[#22283b] text-center font-mono">
                    <div>
                      <div className="text-[10px] text-[#627084]">Tables</div>
                      <div className="text-xs font-bold text-white mt-0.5">{entityCount}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#627084]">Columns</div>
                      <div className="text-xs font-bold text-teal-400 mt-0.5">{colCount}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#627084]">Foreign Keys</div>
                      <div className="text-xs font-bold text-indigo-400 mt-0.5">{relCount}</div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(tmpl.tags || []).map((t, i) => (
                      <span key={i} className="text-[10px] font-mono text-[#8c9bab] bg-[#121620] px-2 py-0.5 rounded border border-[#22273b]">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer: Rating & Clone Buttons */}
                <div className="mt-5 pt-4 border-t border-[#22283b] flex flex-col gap-3">
                  {/* Rating stars */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleRate(tmpl.id, star)}
                          className="hover:scale-125 transition-transform cursor-pointer"
                          title={`Rate ${star} stars`}
                        >
                          <Star
                            size={14}
                            className={star <= Math.round(Number(tmpl.rating) || 5) ? 'fill-amber-400 text-amber-400' : 'text-[#394258]'}
                          />
                        </button>
                      ))}
                      <span className="font-mono text-[11px] text-[#8c9bab] ml-1">
                        ({Number(tmpl.rating || 5).toFixed(1)})
                      </span>
                    </div>

                    <span className="text-[10px] text-[#627084] font-mono">by {tmpl.author}</span>
                  </div>

                  {/* Clone Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCloneNewModal(tmpl);
                        setNewProjectName(`${tmpl.name} (Clone)`);
                      }}
                      className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition-all cursor-pointer shadow-sm"
                    >
                      <FolderPlus size={13} />
                      <span>Clone New</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCloneExistingModal(tmpl)}
                      className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-[#1a202e] border border-[#2c354d] text-white hover:bg-[#232c40] transition-colors cursor-pointer"
                    >
                      <Copy size={13} />
                      <span>Into Project</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Clone As New Project */}
      {cloneNewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b26] border border-[#22273b] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FolderPlus size={18} className="text-teal-400" />
              Clone as Brand New Project
            </h3>
            <p className="text-xs text-[#8c9bab]">
              This will create a new workspace project populated with the <strong>{cloneNewModal.name}</strong> schema.
            </p>

            <form onSubmit={handleCloneAsNew} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8c9bab] mb-1">
                  New Project Name
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-[#10141f] border border-[#22283b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCloneNewModal(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#8c9bab] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cloningNew}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 transition-all cursor-pointer"
                >
                  <FolderPlus size={13} className={cloningNew ? 'animate-spin' : ''} />
                  <span>{cloningNew ? 'Creating Project...' : 'Create & Open Project'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Clone Into Existing Project */}
      {cloneExistingModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b26] border border-[#22273b] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Copy size={18} className="text-teal-400" />
              Restore Template Into Existing Project
            </h3>
            <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg">
              ⚠️ Warning: Restoring this template will replace the selected project's existing ERD tables with <strong>{cloneExistingModal.name}</strong>.
            </p>

            <form onSubmit={handleCloneToExisting} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8c9bab] mb-1">
                  Select Target Project
                </label>
                <select
                  value={targetProjectId}
                  onChange={(e) => setTargetProjectId(e.target.value)}
                  className="w-full bg-[#10141f] border border-[#22283b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (#{p.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCloneExistingModal(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#8c9bab] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cloningExisting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Copy size={13} className={cloningExisting ? 'animate-spin' : ''} />
                  <span>{cloningExisting ? 'Restoring...' : 'Restore Schema'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Publish Schema To Marketplace */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b26] border border-[#22273b] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus size={18} className="text-teal-400" />
              Publish Schema to Community Marketplace
            </h3>
            <p className="text-xs text-[#8c9bab]">
              Share your relational design with the developer community. Other users can inspect and clone your schema.
            </p>

            <form onSubmit={handlePublish} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#8c9bab] mb-1">Source Project</label>
                <select
                  value={publishProjectId}
                  onChange={(e) => setPublishProjectId(e.target.value)}
                  className="w-full bg-[#10141f] border border-[#22283b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (#{p.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8c9bab] mb-1">Template Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Microservices Multi-Tenant SaaS"
                  value={publishName}
                  onChange={(e) => setPublishName(e.target.value)}
                  className="w-full bg-[#10141f] border border-[#22283b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8c9bab] mb-1">Category</label>
                <select
                  value={publishCategory}
                  onChange={(e) => setPublishCategory(e.target.value)}
                  className="w-full bg-[#10141f] border border-[#22283b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  {categories.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8c9bab] mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe your tables, indexing strategy, and use case..."
                  value={publishDesc}
                  onChange={(e) => setPublishDesc(e.target.value)}
                  className="w-full bg-[#10141f] border border-[#22283b] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8c9bab] mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={publishTags}
                  onChange={(e) => setPublishTags(e.target.value)}
                  className="w-full bg-[#10141f] border border-[#22283b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPublishModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#8c9bab] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Plus size={13} className={publishing ? 'animate-spin' : ''} />
                  <span>{publishing ? 'Publishing...' : 'Publish to Marketplace'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
