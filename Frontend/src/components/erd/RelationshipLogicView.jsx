import React, { useState } from 'react';
import { api } from '../../services/api.js';
import {
  GitMerge,
  Plus,
  Trash2,
  ArrowRight,
  Shield,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  ExternalLink,
  Table as TableIcon,
  RefreshCw,
  Sliders,
} from 'lucide-react';

export function RelationshipLogicView({ projectId, entities = [], relationships = [], onRefresh }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [newRel, setNewRel] = useState({
    sourceEntityId: '',
    targetEntityId: '',
    cardinality: '1:M',
    name: 'relates to',
    description: '',
    isIdentifying: false,
    onDelete: 'CASCADE',
  });

  // Toggle Cardinality directly from the list view
  const handleToggleCardinality = async (relId, targetCardinality) => {
    try {
      setLoading(true);
      setErrorMsg('');
      await api.updateErdRelationship(relId, { cardinality: targetCardinality });
      setSuccessMsg(`Cardinality updated to ${targetCardinality}! Auto-propagation refreshed.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update cardinality');
    } finally {
      setLoading(false);
    }
  };

  // Update ON DELETE rule
  const handleUpdateOnDelete = async (relId, onDeleteRule) => {
    try {
      setLoading(true);
      await api.updateErdRelationship(relId, { onDelete: onDeleteRule });
      setSuccessMsg(`ON DELETE rule updated to ${onDeleteRule}`);
      setTimeout(() => setSuccessMsg(''), 3000);
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update rule');
    } finally {
      setLoading(false);
    }
  };

  // Toggle Identifying
  const handleToggleIdentifying = async (relId, currentVal) => {
    try {
      setLoading(true);
      await api.updateErdRelationship(relId, { isIdentifying: !currentVal });
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update identifying status');
    } finally {
      setLoading(false);
    }
  };

  // Delete Relationship
  const handleDelete = async (relId) => {
    if (!window.confirm('Delete this relationship? Any associated foreign key constraints will be affected.')) {
      return;
    }
    try {
      setLoading(true);
      await api.deleteErdRelationship(relId);
      setSuccessMsg('Relationship deleted successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete relationship');
    } finally {
      setLoading(false);
    }
  };

  // Create New Relationship
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newRel.sourceEntityId || !newRel.targetEntityId) {
      setErrorMsg('Please select both source and target entities');
      return;
    }
    if (newRel.sourceEntityId === newRel.targetEntityId) {
      setErrorMsg('Source and target entities must be different');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      await api.createErdRelationship(projectId, {
        sourceEntityId: Number(newRel.sourceEntityId),
        targetEntityId: Number(newRel.targetEntityId),
        cardinality: newRel.cardinality,
        name: newRel.name.trim() || 'relates to',
        description: newRel.description,
        isIdentifying: newRel.isIdentifying,
        onDelete: newRel.onDelete,
      });

      setIsCreateOpen(false);
      setNewRel({
        sourceEntityId: '',
        targetEntityId: '',
        cardinality: '1:M',
        name: 'relates to',
        description: '',
        isIdentifying: false,
        onDelete: 'CASCADE',
      });
      setSuccessMsg('Relationship created! Foreign keys & junction tables auto-propagated.');
      setTimeout(() => setSuccessMsg(''), 3500);
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create relationship');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-210px)] min-h-[640px] bg-[#10141e] border border-[#22273b] rounded-lg overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#22273b] bg-[#161b26]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <GitMerge size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#dfe1e6] flex items-center gap-2">
              Module 4: Relationship Logic Engine
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Auto-FK & Junction
              </span>
            </h2>
            <p className="text-xs text-[#8c9bab]">
              Manage relational cardinalities, automated foreign key propagation, many-to-many junction resolutions, and delete cascade behaviors.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Plus size={14} />
          <span>New Relationship</span>
        </button>
      </div>

      {/* Status Messages */}
      {errorMsg && (
        <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="px-5 py-2 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 size={14} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Relationship List View (Mirrors Image 4 & Image 5/6) */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {relationships.map((rel) => {
          const isMtoN = rel.cardinality === 'M:N';
          const is1toM = rel.cardinality === '1:M';
          const is1to1 = rel.cardinality === '1:1';

          return (
            <div
              key={rel.id}
              className={`p-4 rounded-xl border transition-all ${
                rel.is_identifying
                  ? 'bg-[#151221] border-purple-500/40 shadow-sm'
                  : 'bg-[#141923] border-[#242b3d] hover:border-[#38435d]'
              }`}
            >
              {/* Primary Relationship Sentence (Mirrors Image 4) */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[#22273b]">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Entity A */}
                  <span className="px-2.5 py-1 rounded bg-[#1c2230] border border-[#2e374f] text-xs font-bold text-[#579dff] font-mono">
                    [{rel.source_entity_name.toUpperCase()}]
                  </span>

                  <span className="text-xs font-semibold text-[#8c9bab]">
                    is related to (
                    <span className="italic text-[#dfe1e6]">{rel.name || 'relates to'}</span>
                    )
                  </span>

                  {/* Entity B */}
                  <span className="px-2.5 py-1 rounded bg-[#1c2230] border border-[#2e374f] text-xs font-bold text-purple-400 font-mono">
                    [{rel.target_entity_name.toUpperCase()}]
                  </span>

                  {rel.is_identifying && (
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      Identifying (Weak)
                    </span>
                  )}
                </div>

                {/* Cardinality Toggle Selector */}
                <div className="flex items-center gap-1 bg-[#1a202e] p-1 rounded-lg border border-[#2e374f]">
                  {['1:1', '1:M', 'M:N'].map((card) => (
                    <button
                      key={card}
                      type="button"
                      disabled={loading}
                      onClick={() => handleToggleCardinality(rel.id, card)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                        rel.cardinality === card
                          ? card === '1:M'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : card === 'M:N'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-emerald-600 text-white shadow-xs'
                          : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#242b3d]'
                      }`}
                    >
                      {card}
                    </button>
                  ))}
                </div>
              </div>

              {/* Middle Section: Bidirectional Descriptions (Mirrors Image 5/6) */}
              <div className="py-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Description (a) */}
                <div className="p-2.5 rounded-lg bg-[#181d2a] border border-[#22273b]">
                  <div className="text-[11px] font-bold text-[#8c9bab] mb-0.5">
                    (a) Forward Relationship:
                  </div>
                  <div className="text-[#dfe1e6] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    <span>{rel.bidirectional?.forward}</span>
                  </div>
                </div>

                {/* Description (b) */}
                <div className="p-2.5 rounded-lg bg-[#181d2a] border border-[#22273b]">
                  <div className="text-[11px] font-bold text-[#8c9bab] mb-0.5">
                    (b) Reverse Relationship:
                  </div>
                  <div className="text-[#dfe1e6] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>{rel.bidirectional?.reverse}</span>
                  </div>
                </div>
              </div>

              {/* Automation Status & Configuration Bar */}
              <div className="pt-2 flex items-center justify-between flex-wrap gap-2 text-xs border-t border-[#1e2536]">
                <div className="flex items-center gap-3">
                  {/* Auto-FK indicator */}
                  {is1toM && (
                    <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      Auto-FK injected into "{rel.target_entity_name}"
                    </span>
                  )}

                  {/* Junction table indicator */}
                  {isMtoN && (
                    <span className="text-[11px] text-purple-300 font-mono flex items-center gap-1 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      <TableIcon size={12} />
                      Junction Table: <strong>{rel.junction_entity_name || `${rel.source_entity_name}_${rel.target_entity_name}`}</strong>
                    </span>
                  )}

                  {/* Identifying relationship indicator */}
                  <button
                    type="button"
                    onClick={() => handleToggleIdentifying(rel.id, rel.is_identifying)}
                    className={`text-[11px] px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                      rel.is_identifying
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'bg-[#181d2a] text-[#8c9bab] border-[#2e374f] hover:text-[#dfe1e6]'
                    }`}
                  >
                    Identifying: {rel.is_identifying ? 'Yes' : 'No'}
                  </button>
                </div>

                {/* ON DELETE Rule Selector & Delete Button */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#8c9bab] font-mono">ON DELETE:</span>
                    <select
                      value={rel.on_delete || 'CASCADE'}
                      onChange={(e) => handleUpdateOnDelete(rel.id, e.target.value)}
                      className="px-2 py-1 rounded bg-[#181d2a] border border-[#2e374f] text-[11px] font-mono text-[#dfe1e6] focus:outline-none focus:border-[#579dff] cursor-pointer"
                    >
                      <option value="CASCADE">CASCADE</option>
                      <option value="SET NULL">SET NULL</option>
                      <option value="RESTRICT">RESTRICT</option>
                      <option value="NO ACTION">NO ACTION</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(rel.id)}
                    className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Delete Relationship"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {relationships.length === 0 && (
          <div className="p-12 text-center text-xs text-[#8c9bab] bg-[#141923] border border-[#22273b] rounded-xl">
            <GitMerge size={36} className="text-[#2e374f] mx-auto mb-3" />
            <h4 className="font-bold text-sm text-[#dfe1e6]">No Relationships Defined</h4>
            <p className="mt-1 max-w-sm mx-auto">
              Create relationships between entities to automatically propagate foreign keys, resolve M:N junction tables, and enforce integrity.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 px-3 py-1.5 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white font-semibold cursor-pointer"
            >
              + Create First Relationship
            </button>
          </div>
        )}
      </div>

      {/* Create Relationship Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#181d2a] border border-[#2e374f] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#22273b] bg-[#141923] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitMerge size={16} className="text-purple-400" />
                <h3 className="font-bold text-sm text-[#dfe1e6]">New Relationship</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-[#8c9bab] hover:text-white p-1 rounded hover:bg-[#22273b] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#8c9bab] mb-1">
                    Source Entity (Parent / Side 1) <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={newRel.sourceEntityId}
                    onChange={(e) => setNewRel({ ...newRel, sourceEntityId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#121620] border border-[#2e374f] text-[#dfe1e6] focus:outline-none focus:border-[#579dff] cursor-pointer"
                  >
                    <option value="">Select source...</option>
                    {entities.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#8c9bab] mb-1">
                    Target Entity (Child / Side 2) <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={newRel.targetEntityId}
                    onChange={(e) => setNewRel({ ...newRel, targetEntityId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#121620] border border-[#2e374f] text-[#dfe1e6] focus:outline-none focus:border-[#579dff] cursor-pointer"
                  >
                    <option value="">Select target...</option>
                    {entities
                      .filter((e) => e.id !== Number(newRel.sourceEntityId))
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#8c9bab] mb-1">
                  Relationship Name (Verb)
                </label>
                <input
                  type="text"
                  placeholder="e.g. places, contains, manages"
                  value={newRel.name}
                  onChange={(e) => setNewRel({ ...newRel, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#121620] border border-[#2e374f] text-[#dfe1e6] focus:outline-none focus:border-[#579dff]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#8c9bab] mb-1">
                  Cardinality
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['1:1', '1:M', 'M:N'].map((card) => (
                    <button
                      key={card}
                      type="button"
                      onClick={() => setNewRel({ ...newRel, cardinality: card })}
                      className={`p-2 rounded-lg border text-center font-mono font-bold cursor-pointer transition-colors ${
                        newRel.cardinality === card
                          ? 'bg-purple-500/20 border-purple-500 text-purple-200'
                          : 'bg-[#121620] border-[#2e374f] text-[#8c9bab] hover:bg-[#1a202e]'
                      }`}
                    >
                      {card}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#8c9bab] mb-1">
                  ON DELETE Cascade Behavior
                </label>
                <select
                  value={newRel.onDelete}
                  onChange={(e) => setNewRel({ ...newRel, onDelete: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#121620] border border-[#2e374f] text-[#dfe1e6] focus:outline-none focus:border-[#579dff] cursor-pointer"
                >
                  <option value="CASCADE">CASCADE (Delete associated records)</option>
                  <option value="SET NULL">SET NULL (Set foreign key to NULL)</option>
                  <option value="RESTRICT">RESTRICT (Prevent deletion)</option>
                  <option value="NO ACTION">NO ACTION (Standard)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="relIsIdentifying"
                  checked={newRel.isIdentifying}
                  onChange={(e) => setNewRel({ ...newRel, isIdentifying: e.target.checked })}
                  className="w-4 h-4 rounded bg-[#121620] border-[#2e374f] text-[#0c66e4] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="relIsIdentifying" className="text-[#dfe1e6] cursor-pointer">
                  Identifying relationship (for weak entities)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#22273b]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 rounded text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#22273b] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newRel.sourceEntityId || !newRel.targetEntityId}
                  className="px-4 py-1.5 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white font-semibold shadow-sm cursor-pointer disabled:opacity-40"
                >
                  Create & Propagate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

