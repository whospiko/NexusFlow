import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api.js';
import {
  Database,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Layers,
  Key,
  Link as LinkIcon,
  Save,
  RotateCcw,
  Search,
  Check,
  X,
  Shield,
  HelpCircle,
  Table as TableIcon,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const DATA_TYPES = ['String', 'Int', 'Date', 'Boolean', 'Decimal', 'Text', 'Timestamp'];
const KEY_TYPES = [
  { value: 'Normal', label: 'Normal Attribute', badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  { value: 'PK', label: 'Primary Key (PK)', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { value: 'FK', label: 'Foreign Key (FK)', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  { value: 'Composite', label: 'Composite PK', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
];

export function EntityManagerView({ projectId, entities = [], onRefresh }) {
  const [selectedEntityId, setSelectedEntityId] = useState(entities[0]?.id || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [newEntityData, setNewEntityData] = useState({
    name: '',
    type: 'Strong',
    description: '',
    parentEntityId: '',
  });

  // Working state for active entity & attributes
  const activeEntity = useMemo(
    () => entities.find((e) => e.id === selectedEntityId) || null,
    [entities, selectedEntityId]
  );

  const [attributes, setAttributes] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Synchronize active entity attributes when selection changes or entities reloaded
  useEffect(() => {
    if (activeEntity) {
      setAttributes(
        (activeEntity.attributes || []).map((a, idx) => ({
          ...a,
          order: a.order !== undefined ? a.order : idx,
        }))
      );
      setIsDirty(false);
      setErrorMsg('');
      setSuccessMsg('');
    } else if (entities.length > 0) {
      setSelectedEntityId(entities[0].id);
    }
  }, [activeEntity, entities]);

  // Filtered entity list for left pane
  const filteredEntities = useMemo(() => {
    if (!searchTerm.trim()) return entities;
    const term = searchTerm.toLowerCase();
    return entities.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        (e.description && e.description.toLowerCase().includes(term))
    );
  }, [entities, searchTerm]);

  // Strong entities available as parent for weak entity selection
  const strongEntities = useMemo(
    () => entities.filter((e) => e.type === 'Strong' && e.id !== selectedEntityId),
    [entities, selectedEntityId]
  );

  // Auto-Validation Engine (Rules evaluation on current attributes state)
  const validationResults = useMemo(() => {
    const issues = [];
    if (!activeEntity) return { isValid: true, issues: [] };

    // 1. Every entity must have at least one PK or Composite PK
    const hasPk = attributes.some((a) => a.keyType === 'PK' || a.keyType === 'Composite');
    if (!hasPk && attributes.length > 0) {
      issues.push({
        type: 'error',
        message: 'Entity must contain at least one Primary Key (PK).',
      });
    }

    // 2. No duplicate attribute names within an entity
    const seenNames = new Set();
    for (const a of attributes) {
      const name = (a.name || '').trim().toLowerCase();
      if (!name) {
        issues.push({ type: 'error', message: 'Attribute name cannot be empty.' });
      } else if (seenNames.has(name)) {
        issues.push({
          type: 'error',
          message: `Duplicate attribute name "${a.name}" detected in this entity.`,
        });
      }
      seenNames.add(name);
    }

    // 3. FK must reference an existing entity's PK
    for (const a of attributes) {
      if (a.keyType === 'FK') {
        if (!a.refEntityId) {
          issues.push({
            type: 'error',
            message: `Foreign Key "${a.name || 'unnamed'}" must reference a target entity.`,
          });
        }
      }
    }

    return {
      isValid: issues.filter((i) => i.type === 'error').length === 0,
      issues,
    };
  }, [activeEntity, attributes]);

  // Attribute Handlers
  const handleAddAttribute = () => {
    const newAttr = {
      id: `temp-${Date.now()}`,
      name: `col_${attributes.length + 1}`,
      dataType: 'String',
      keyType: attributes.length === 0 ? 'PK' : 'Normal',
      isNullable: false,
      defaultValue: '',
      refEntityId: null,
      refAttributeId: null,
      order: attributes.length,
      description: '',
    };
    setAttributes([...attributes, newAttr]);
    setIsDirty(true);
  };

  const handleUpdateAttribute = (index, field, value) => {
    setAttributes((prev) => {
      const copy = [...prev];
      const attr = { ...copy[index], [field]: value };

      // Reset ref fields if keyType changes away from FK
      if (field === 'keyType' && value !== 'FK') {
        attr.refEntityId = null;
        attr.refAttributeId = null;
      }
      // If changing refEntityId, auto-select target's PK column
      if (field === 'refEntityId' && value) {
        const targetEnt = entities.find((e) => e.id === Number(value));
        const targetPk = targetEnt?.attributes?.find(
          (a) => a.keyType === 'PK' || a.keyType === 'Composite'
        );
        attr.refAttributeId = targetPk ? targetPk.id : null;
      }

      copy[index] = attr;
      return copy;
    });
    setIsDirty(true);
  };

  const handleDeleteAttribute = (index) => {
    setAttributes((prev) => {
      const copy = prev.filter((_, i) => i !== index);
      // Re-index order
      return copy.map((a, idx) => ({ ...a, order: idx }));
    });
    setIsDirty(true);
  };

  const handleMoveAttribute = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= attributes.length) return;

    setAttributes((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy.map((a, idx) => ({ ...a, order: idx }));
    });
    setIsDirty(true);
  };

  // Save Attributes to Backend
  const handleSaveAttributes = async () => {
    if (!validationResults.isValid) {
      setErrorMsg('Please resolve validation errors before saving.');
      return;
    }
    try {
      setSaving(true);
      setErrorMsg('');
      await api.bulkSaveErdAttributes(activeEntity.id, attributes);
      setIsDirty(false);
      setSuccessMsg('Attributes saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save attributes');
    } finally {
      setSaving(false);
    }
  };

  // Create Entity
  const handleCreateEntity = async (e) => {
    e.preventDefault();
    if (!newEntityData.name.trim()) return;

    try {
      setSaving(true);
      setErrorMsg('');
      const res = await api.createErdEntity(projectId, {
        name: newEntityData.name.trim(),
        type: newEntityData.type,
        description: newEntityData.description,
        parentEntityId: newEntityData.type === 'Weak' ? Number(newEntityData.parentEntityId) || null : null,
      });

      setIsCreatingEntity(false);
      setNewEntityData({ name: '', type: 'Strong', description: '', parentEntityId: '' });
      setSuccessMsg(`Entity "${res.data?.name}" created successfully!`);
      setTimeout(() => setSuccessMsg(''), 3000);
      if (onRefresh) await onRefresh();
      if (res.data?.id) setSelectedEntityId(res.data.id);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create entity');
    } finally {
      setSaving(false);
    }
  };

  // Delete Active Entity
  const handleDeleteEntity = async () => {
    if (!activeEntity) return;
    if (!window.confirm(`Are you sure you want to delete entity "${activeEntity.name}"? This will remove its attributes, canvas node, and related constraints.`)) {
      return;
    }

    try {
      setSaving(true);
      await api.deleteErdEntity(activeEntity.id);
      setSelectedEntityId(null);
      if (onRefresh) await onRefresh();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete entity');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-210px)] min-h-[640px] bg-[#10141e] border border-[#22273b] rounded-lg overflow-hidden">
      {/* Top Header / Sub-Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#22273b] bg-[#161b26]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <Database size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#dfe1e6] flex items-center gap-2">
              Module 2: Entity & Attribute Manager
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Pure SQL
              </span>
            </h2>
            <p className="text-xs text-[#8c9bab]">
              Define Strong & Weak entities, manage column attributes, assign Primary/Foreign keys, and validate relational integrity.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCreatingEntity(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Plus size={14} />
          <span>New Entity</span>
        </button>
      </div>

      {/* Split-Pane Layout: Left = Entity List, Right = Attribute Table */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Entity List */}
        <aside className="w-72 border-r border-[#22273b] bg-[#141923] flex flex-col shrink-0">
          <div className="p-3 border-b border-[#22273b]">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[#8c9bab]" />
              <input
                type="text"
                placeholder="Search entities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded bg-[#1c2230] border border-[#2e374f] text-xs text-[#dfe1e6] placeholder-[#626f86] focus:outline-none focus:border-[#579dff]"
              />
            </div>
            <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-[#8c9bab]">
              <span>Entities ({entities.length})</span>
              <span className="font-mono text-[10px]">
                {entities.filter((e) => e.type === 'Weak').length} Weak
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredEntities.map((entity) => {
              const isSelected = entity.id === selectedEntityId;
              const isWeak = entity.type === 'Weak';
              const pkCount = (entity.attributes || []).filter(
                (a) => a.keyType === 'PK' || a.keyType === 'Composite'
              ).length;

              return (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => setSelectedEntityId(entity.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1e2638] border-[#579dff] shadow-sm'
                      : 'bg-[#181d2a] border-[#242b3d] hover:bg-[#1c2230] hover:border-[#38435d]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-[#dfe1e6] truncate">
                      {entity.name}
                    </span>
                    <span
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                        isWeak
                          ? 'bg-purple-500/15 text-purple-300 border-purple-500/40'
                          : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      }`}
                    >
                      {entity.type}
                    </span>
                  </div>

                  {entity.description && (
                    <p className="text-[11px] text-[#8c9bab] line-clamp-1 mb-1.5">
                      {entity.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-[10px] text-[#626f86]">
                    <span className="flex items-center gap-1">
                      <TableIcon size={10} />
                      {(entity.attributes || []).length} cols
                    </span>
                    <span>•</span>
                    <span
                      className={`flex items-center gap-1 font-mono ${
                        pkCount > 0 ? 'text-amber-400' : 'text-red-400 font-bold'
                      }`}
                    >
                      <Key size={10} />
                      {pkCount} PK
                    </span>
                  </div>
                </button>
              );
            })}

            {filteredEntities.length === 0 && (
              <div className="p-6 text-center text-xs text-[#8c9bab]">
                No entities found. Click <strong>+ New Entity</strong> to get started.
              </div>
            )}
          </div>
        </aside>

        {/* Right Pane: Active Entity & Attribute Table View */}
        <main className="flex-1 flex flex-col bg-[#10141e] overflow-hidden">
          {activeEntity ? (
            <>
              {/* Entity Overview Bar */}
              <div className="p-4 border-b border-[#22273b] bg-[#161b26] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border ${
                      activeEntity.type === 'Weak'
                        ? 'border-double border-4 border-purple-500/80 bg-purple-500/10 text-purple-300'
                        : 'border-sky-500/50 bg-sky-500/10 text-sky-300'
                    }`}
                  >
                    {activeEntity.name.substring(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-[#dfe1e6]">{activeEntity.name}</h3>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                          activeEntity.type === 'Weak'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                        }`}
                      >
                        {activeEntity.type} Entity
                      </span>
                      {activeEntity.type === 'Weak' && activeEntity.parent_entity_id && (
                        <span className="text-[10px] text-[#8c9bab] flex items-center gap-1">
                          <LinkIcon size={10} />
                          Identified by parent entity #{activeEntity.parent_entity_id}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8c9bab] mt-0.5">
                      {activeEntity.description || 'No description provided.'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {isDirty && (
                    <button
                      type="button"
                      onClick={() => {
                        setAttributes(
                          (activeEntity.attributes || []).map((a, idx) => ({
                            ...a,
                            order: a.order !== undefined ? a.order : idx,
                          }))
                        );
                        setIsDirty(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#2e374f] text-xs text-[#8c9bab] hover:bg-[#1a202e] hover:text-[#dfe1e6] transition-colors cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      Discard
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={saving || !validationResults.isValid || !isDirty}
                    onClick={handleSaveAttributes}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-colors cursor-pointer ${
                      isDirty && validationResults.isValid
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-[#22273b] text-[#626f86] cursor-not-allowed'
                    }`}
                  >
                    <Save size={13} />
                    <span>{saving ? 'Saving...' : 'Save Attributes'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteEntity}
                    className="p-1.5 rounded text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors cursor-pointer ml-1"
                    title="Delete Entity"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Status / Validation Feedback Alerts */}
              {errorMsg && (
                <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle size={14} className="shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Auto-Validation Rules Banner */}
              {!validationResults.isValid && (
                <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    <span>Entity Integrity Violation</span>
                  </div>
                  {validationResults.issues.map((issue, idx) => (
                    <p key={idx} className="ml-5 text-[11px] text-amber-200/90">
                      • {issue.message}
                    </p>
                  ))}
                </div>
              )}

              {/* Attribute Table View (Mirrors Image 2/3) */}
              <div className="flex-1 overflow-auto p-4">
                <div className="border border-[#22273b] rounded-lg overflow-hidden bg-[#141923]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#1b212f] text-[#8c9bab] border-b border-[#22273b] select-none font-semibold">
                        <th className="py-2.5 px-3 w-12 text-center">#</th>
                        <th className="py-2.5 px-3 w-48">Attribute Name</th>
                        <th className="py-2.5 px-3 w-32">Data Type</th>
                        <th className="py-2.5 px-3 w-36">Key Type</th>
                        <th className="py-2.5 px-3 w-48">FK Target Reference</th>
                        <th className="py-2.5 px-3 w-20 text-center">Nullable</th>
                        <th className="py-2.5 px-3 w-28">Default</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 w-20 text-center">Order</th>
                        <th className="py-2.5 px-3 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#22273b]">
                      {attributes.map((attr, index) => {
                        const isPk = attr.keyType === 'PK' || attr.keyType === 'Composite';
                        const isFk = attr.keyType === 'FK';

                        return (
                          <tr
                            key={attr.id || index}
                            className={`hover:bg-[#181e2b] transition-colors ${
                              isPk ? 'bg-amber-500/5' : ''
                            }`}
                          >
                            {/* Row Index */}
                            <td className="py-2 px-3 text-center text-[#626f86] font-mono text-[11px]">
                              {index + 1}
                            </td>

                            {/* Attribute Name */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={attr.name || ''}
                                onChange={(e) =>
                                  handleUpdateAttribute(index, 'name', e.target.value)
                                }
                                placeholder="column_name"
                                className="w-full px-2 py-1 rounded bg-[#1c2230] border border-[#2e374f] text-xs font-mono font-medium text-[#dfe1e6] focus:outline-none focus:border-[#579dff]"
                              />
                            </td>

                            {/* Data Type */}
                            <td className="py-2 px-3">
                              <select
                                value={attr.dataType || 'String'}
                                onChange={(e) =>
                                  handleUpdateAttribute(index, 'dataType', e.target.value)
                                }
                                className="w-full px-2 py-1 rounded bg-[#1c2230] border border-[#2e374f] text-xs text-[#dfe1e6] focus:outline-none focus:border-[#579dff] cursor-pointer"
                              >
                                {DATA_TYPES.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Key Type Selector */}
                            <td className="py-2 px-3">
                              <select
                                value={attr.keyType || 'Normal'}
                                onChange={(e) =>
                                  handleUpdateAttribute(index, 'keyType', e.target.value)
                                }
                                className={`w-full px-2 py-1 rounded border text-xs font-semibold focus:outline-none cursor-pointer ${
                                  isPk
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                    : isFk
                                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                                    : 'bg-[#1c2230] border-[#2e374f] text-[#dfe1e6]'
                                }`}
                              >
                                {KEY_TYPES.map((kt) => (
                                  <option key={kt.value} value={kt.value}>
                                    {kt.label}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* FK Linking: Target Entity & Target PK Column */}
                            <td className="py-2 px-3">
                              {isFk ? (
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={attr.refEntityId || ''}
                                    onChange={(e) =>
                                      handleUpdateAttribute(index, 'refEntityId', e.target.value)
                                    }
                                    className="flex-1 px-2 py-1 rounded bg-[#1c2230] border border-sky-500/40 text-[11px] text-[#dfe1e6] focus:outline-none focus:border-[#579dff] cursor-pointer"
                                  >
                                    <option value="">Select target entity...</option>
                                    {entities
                                      .filter((e) => e.id !== activeEntity.id)
                                      .map((e) => (
                                        <option key={e.id} value={e.id}>
                                          {e.name}
                                        </option>
                                      ))}
                                  </select>

                                  {attr.refEntityId && (
                                    <select
                                      value={attr.refAttributeId || ''}
                                      onChange={(e) =>
                                        handleUpdateAttribute(index, 'refAttributeId', e.target.value)
                                      }
                                      className="w-24 px-1.5 py-1 rounded bg-[#1c2230] border border-sky-500/40 text-[11px] text-[#dfe1e6] focus:outline-none cursor-pointer font-mono"
                                    >
                                      {entities
                                        .find((e) => e.id === Number(attr.refEntityId))
                                        ?.attributes?.filter(
                                          (a) => a.keyType === 'PK' || a.keyType === 'Composite'
                                        )
                                        .map((targetCol) => (
                                          <option key={targetCol.id} value={targetCol.id}>
                                            {targetCol.name} (PK)
                                          </option>
                                        ))}
                                    </select>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-[#626f86] italic">—</span>
                              )}
                            </td>

                            {/* Nullable Checkbox */}
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                disabled={isPk}
                                checked={isPk ? false : Boolean(attr.isNullable)}
                                onChange={(e) =>
                                  handleUpdateAttribute(index, 'isNullable', e.target.checked)
                                }
                                className="w-4 h-4 rounded bg-[#1c2230] border-[#2e374f] text-[#0c66e4] focus:ring-0 cursor-pointer disabled:opacity-40"
                              />
                            </td>

                            {/* Default Value */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={attr.defaultValue || ''}
                                onChange={(e) =>
                                  handleUpdateAttribute(index, 'defaultValue', e.target.value)
                                }
                                placeholder="NULL"
                                className="w-full px-2 py-1 rounded bg-[#1c2230] border border-[#2e374f] text-xs font-mono text-[#dfe1e6] focus:outline-none focus:border-[#579dff]"
                              />
                            </td>

                            {/* Description */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={attr.description || ''}
                                onChange={(e) =>
                                  handleUpdateAttribute(index, 'description', e.target.value)
                                }
                                placeholder="Column remarks..."
                                className="w-full px-2 py-1 rounded bg-[#1c2230] border border-[#2e374f] text-xs text-[#dfe1e6] focus:outline-none focus:border-[#579dff]"
                              />
                            </td>

                            {/* Reorder Up/Down */}
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => handleMoveAttribute(index, -1)}
                                  className="p-1 rounded text-[#8c9bab] hover:text-white hover:bg-[#22273b] disabled:opacity-30 cursor-pointer"
                                  title="Move Up"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === attributes.length - 1}
                                  onClick={() => handleMoveAttribute(index, 1)}
                                  className="p-1 rounded text-[#8c9bab] hover:text-white hover:bg-[#22273b] disabled:opacity-30 cursor-pointer"
                                  title="Move Down"
                                >
                                  <ArrowDown size={12} />
                                </button>
                              </div>
                            </td>

                            {/* Delete Column */}
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteAttribute(index)}
                                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                                title="Remove Attribute"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {attributes.length === 0 && (
                    <div className="p-8 text-center text-xs text-[#8c9bab]">
                      No columns defined. Click <strong>+ Add Attribute</strong> below.
                    </div>
                  )}

                  {/* Table Footer: Add Attribute */}
                  <div className="p-3 bg-[#161b26] border-t border-[#22273b] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleAddAttribute}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#2e374f] hover:border-[#579dff] text-xs font-semibold text-[#579dff] bg-[#1a202e] hover:bg-[#222a3d] transition-colors cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Add Attribute</span>
                    </button>

                    <span className="text-[11px] text-[#626f86]">
                      {attributes.length} column{attributes.length !== 1 ? 's' : ''} • Table View mirrors ERD Entity Specification
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8c9bab]">
              <Database size={40} className="text-[#2e374f] mb-3" />
              <h3 className="text-sm font-semibold text-[#dfe1e6]">No Entity Selected</h3>
              <p className="text-xs max-w-sm mt-1">
                Select an entity from the left pane or create a new Strong/Weak entity to view and edit attributes.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Create Entity Modal */}
      {isCreatingEntity && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#181d2a] border border-[#2e374f] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#22273b] bg-[#141923] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-sky-400" />
                <h3 className="font-bold text-sm text-[#dfe1e6]">Create New Entity</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingEntity(false)}
                className="text-[#8c9bab] hover:text-white p-1 rounded hover:bg-[#22273b] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateEntity} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8c9bab] mb-1">
                  Entity Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Customer, Order, OrderItem"
                  value={newEntityData.name}
                  onChange={(e) =>
                    setNewEntityData({ ...newEntityData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#121620] border border-[#2e374f] text-xs text-[#dfe1e6] focus:outline-none focus:border-[#579dff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8c9bab] mb-1">
                  Entity Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewEntityData({ ...newEntityData, type: 'Strong', parentEntityId: '' })}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                      newEntityData.type === 'Strong'
                        ? 'bg-sky-500/15 border-sky-500 text-sky-200'
                        : 'bg-[#121620] border-[#2e374f] text-[#8c9bab] hover:bg-[#1a202e]'
                    }`}
                  >
                    <div className="font-bold text-xs">Strong Entity</div>
                    <div className="text-[10px] text-[#8c9bab] mt-0.5">
                      Independent identity (solid box)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewEntityData({ ...newEntityData, type: 'Weak' })}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                      newEntityData.type === 'Weak'
                        ? 'bg-purple-500/15 border-purple-500 text-purple-200'
                        : 'bg-[#121620] border-[#2e374f] text-[#8c9bab] hover:bg-[#1a202e]'
                    }`}
                  >
                    <div className="font-bold text-xs">Weak Entity</div>
                    <div className="text-[10px] text-[#8c9bab] mt-0.5">
                      Dependent identity (double box)
                    </div>
                  </button>
                </div>
              </div>

              {/* Weak Entity Parent Selector */}
              {newEntityData.type === 'Weak' && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg space-y-2">
                  <label className="block text-xs font-semibold text-purple-200">
                    Identifying Parent Entity <span className="text-red-400">*</span>
                  </label>
                  <p className="text-[11px] text-purple-300/80">
                    Weak entities depend on a strong parent entity. An identifying relationship and composite PK reference will be auto-generated.
                  </p>
                  <select
                    value={newEntityData.parentEntityId}
                    onChange={(e) =>
                      setNewEntityData({ ...newEntityData, parentEntityId: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded bg-[#121620] border border-purple-500/40 text-xs text-[#dfe1e6] focus:outline-none focus:border-purple-400 cursor-pointer"
                  >
                    <option value="">Select parent entity...</option>
                    {strongEntities.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#8c9bab] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Entity purpose and relational business notes..."
                  value={newEntityData.description}
                  onChange={(e) =>
                    setNewEntityData({ ...newEntityData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#121620] border border-[#2e374f] text-xs text-[#dfe1e6] focus:outline-none focus:border-[#579dff]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#22273b]">
                <button
                  type="button"
                  onClick={() => setIsCreatingEntity(false)}
                  className="px-3 py-1.5 rounded text-xs text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#22273b] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newEntityData.name.trim() || (newEntityData.type === 'Weak' && !newEntityData.parentEntityId && strongEntities.length > 0)}
                  className="px-4 py-1.5 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-40"
                >
                  {saving ? 'Creating...' : 'Create Entity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

