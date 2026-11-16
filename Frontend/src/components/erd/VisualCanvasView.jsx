import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { toPng, toSvg } from 'html-to-image';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLiveCollaboration } from './useLiveCollaboration.js';
import { LiveCursors } from './LiveCursors.jsx';
import { PresenceBar } from './PresenceBar.jsx';
import {
  Maximize2,
  Download,
  Share2,
  RefreshCw,
  Layout,
  Save,
  Key,
  Shield,
  Layers,
  Sparkles,
  Sliders,
  Check,
  X,
  FileImage,
  FileCode,
  Link as LinkIcon,
  HelpCircle,
} from 'lucide-react';

/**
 * Custom Entity Node:
 * - Strong Entity: Solid crisp border, navy/slate header
 * - Weak Entity: Double border (`border-4 border-double border-purple-500`), purple header
 */
function EntityNode({ data }) {
  const { entity, isWeak } = data;
  const attributes = entity.attributes || [];

  return (
    <div
      className={`min-w-[220px] max-w-[280px] rounded-lg shadow-xl overflow-hidden bg-[#141923] text-xs transition-shadow ${
        isWeak
          ? 'border-4 border-double border-purple-500/90 shadow-purple-950/40'
          : 'border border-[#2e374f] hover:border-[#579dff] shadow-black/60'
      }`}
    >
      {/* Node Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2.5 h-2.5 bg-sky-400 border border-[#10141e] -top-1.5"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2.5 h-2.5 bg-sky-400 border border-[#10141e] -bottom-1.5"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-2.5 h-2.5 bg-sky-400 border border-[#10141e] -left-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-2.5 h-2.5 bg-sky-400 border border-[#10141e] -right-1.5"
      />

      {/* Header */}
      <div
        className={`px-3 py-2 flex items-center justify-between border-b ${
          isWeak
            ? 'bg-purple-950/40 border-purple-800/40 text-purple-200'
            : 'bg-[#1b2232] border-[#2e374f] text-[#dfe1e6]'
        }`}
      >
        <div className="font-bold tracking-wide truncate">{entity.name}</div>
        <span
          className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-semibold border ${
            isWeak
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
              : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
          }`}
        >
          {isWeak ? 'Weak' : 'Strong'}
        </span>
      </div>

      {/* Attribute Rows */}
      <div className="divide-y divide-[#1e2536] max-h-64 overflow-y-auto">
        {attributes.map((attr) => {
          const isPk = attr.keyType === 'PK' || attr.keyType === 'Composite';
          const isFk = attr.keyType === 'FK';

          return (
            <div
              key={attr.id}
              className={`px-2.5 py-1.5 flex items-center justify-between gap-1 text-[11px] ${
                isPk ? 'bg-amber-500/5' : isFk ? 'bg-sky-500/5' : ''
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {isPk ? (
                  <span className="text-amber-400 font-mono font-bold text-[9px] px-1 rounded bg-amber-500/20 border border-amber-500/30 shrink-0">
                    PK
                  </span>
                ) : isFk ? (
                  <span className="text-sky-400 font-mono font-bold text-[9px] px-1 rounded bg-sky-500/20 border border-sky-500/30 shrink-0">
                    FK
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-[#3b4764] shrink-0" />
                )}
                <span className="font-medium text-[#dfe1e6] truncate font-mono">
                  {attr.name}
                </span>
              </div>

              <span className="text-[10px] font-mono text-[#8c9bab] shrink-0">
                {attr.dataType}
              </span>
            </div>
          );
        })}

        {attributes.length === 0 && (
          <div className="px-3 py-2 text-[10px] text-[#626f86] italic text-center">
            No attributes defined
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Custom Chen Notation Relationship Diamond Node
 */
function RelationshipDiamondNode({ data }) {
  const { name, cardinality, isIdentifying } = data;

  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-emerald-400 border border-[#10141e]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-emerald-400 border border-[#10141e]"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 bg-emerald-400 border border-[#10141e]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-emerald-400 border border-[#10141e]"
      />

      {/* Diamond Shape */}
      <div
        className={`w-20 h-20 transform rotate-45 flex items-center justify-center shadow-lg transition-transform ${
          isIdentifying
            ? 'bg-purple-900/60 border-2 border-double border-purple-400'
            : 'bg-[#182538] border-2 border-[#579dff]'
        }`}
      >
        <div className="transform -rotate-45 text-center px-1">
          <div className="text-[10px] font-bold text-white uppercase tracking-tight truncate max-w-[60px]">
            {name || 'relates'}
          </div>
          <div className="text-[9px] font-mono font-bold text-sky-300">
            {cardinality}
          </div>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  entityNode: EntityNode,
  relationshipDiamond: RelationshipDiamondNode,
};

// Dagre Auto-Layout Algorithm
const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: direction, nodesep: 70, ranksep: 90 });

  nodes.forEach((node) => {
    const isDiamond = node.type === 'relationshipDiamond';
    dagreGraph.setNode(node.id, {
      width: isDiamond ? 120 : 250,
      height: isDiamond ? 120 : 200,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (node.type === 'relationshipDiamond' ? 60 : 125),
        y: nodeWithPosition.y - (node.type === 'relationshipDiamond' ? 60 : 100),
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export function VisualCanvasView({ projectId, entities = [], relationships = [], onRefresh }) {
  const canvasRef = useRef(null);
  const [notationMode, setNotationMode] = useState('crow'); // 'crow' (direct line) or 'chen' (diamonds)
  const [savingPositions, setSavingPositions] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Relationship Drawer / Modal State
  const [isRelModalOpen, setIsRelModalOpen] = useState(false);
  const [relFormData, setRelFormData] = useState({
    sourceEntityId: '',
    targetEntityId: '',
    cardinality: '1:M',
    name: 'relates to',
    description: '',
    isIdentifying: false,
    onDelete: 'CASCADE',
  });

  // Transform Entities & Relationships into React Flow Nodes and Edges
  const initialElements = useMemo(() => {
    const flowNodes = [];
    const flowEdges = [];

    // 1. Build Entity Nodes
    entities.forEach((ent) => {
      const isWeak = ent.type === 'Weak';
      flowNodes.push({
        id: `entity-${ent.id}`,
        type: 'entityNode',
        data: { entity: ent, isWeak },
        position: { x: ent.pos_x ?? 100, y: ent.pos_y ?? 100 },
      });
    });

    // 2. Build Relationships
    relationships.forEach((rel) => {
      const sourceId = `entity-${rel.source_entity_id}`;
      const targetId = `entity-${rel.target_entity_id}`;

      let sourceLabel = '1';
      let targetLabel = 'M';
      if (rel.cardinality === '1:1') {
        sourceLabel = '1';
        targetLabel = '1';
      } else if (rel.cardinality === 'M:N') {
        sourceLabel = 'M';
        targetLabel = 'N';
      }

      if (notationMode === 'chen') {
        // Chen notation: Insert Diamond Node between entities
        const diamondId = `rel-diamond-${rel.id}`;
        flowNodes.push({
          id: diamondId,
          type: 'relationshipDiamond',
          data: {
            name: rel.name,
            cardinality: rel.cardinality,
            isIdentifying: rel.is_identifying,
          },
          position: {
            x: ((rel.source_pos_x || 100) + (rel.target_pos_x || 300)) / 2,
            y: ((rel.source_pos_y || 100) + (rel.target_pos_y || 300)) / 2,
          },
        });

        // Source to Diamond Edge
        flowEdges.push({
          id: `edge-${rel.id}-src`,
          source: sourceId,
          target: diamondId,
          animated: rel.is_identifying,
          style: { stroke: rel.is_identifying ? '#c084fc' : '#579dff', strokeWidth: 2 },
          label: sourceLabel,
          labelStyle: { fill: '#dfe1e6', fontWeight: 'bold', fontSize: 12 },
          labelBgStyle: { fill: '#141923', fillOpacity: 0.9 },
        });

        // Diamond to Target Edge
        flowEdges.push({
          id: `edge-${rel.id}-tgt`,
          source: diamondId,
          target: targetId,
          animated: rel.is_identifying,
          style: { stroke: rel.is_identifying ? '#c084fc' : '#579dff', strokeWidth: 2 },
          label: targetLabel,
          labelStyle: { fill: '#dfe1e6', fontWeight: 'bold', fontSize: 12 },
          labelBgStyle: { fill: '#141923', fillOpacity: 0.9 },
        });
      } else {
        // Direct / Crow's Foot style
        flowEdges.push({
          id: `edge-${rel.id}`,
          source: sourceId,
          target: targetId,
          animated: rel.is_identifying,
          style: {
            stroke: rel.is_identifying ? '#c084fc' : '#579dff',
            strokeWidth: rel.is_identifying ? 3 : 2,
            strokeDasharray: rel.is_identifying ? '4,4' : undefined,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: rel.is_identifying ? '#c084fc' : '#579dff',
          },
          label: `${rel.name || 'relates'} [${sourceLabel}:${targetLabel}]`,
          labelStyle: { fill: '#dfe1e6', fontWeight: 600, fontSize: 11 },
          labelBgStyle: { fill: '#141923', fillOpacity: 0.95 },
          labelBgPadding: [6, 4],
          labelBgBorderRadius: 4,
        });
      }
    });

    return { flowNodes, flowEdges };
  }, [entities, relationships, notationMode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialElements.flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialElements.flowEdges);

  // Current logged in user for collaborative presence
  const { user } = useAuth();

  // Remote Node Drag & Drop Realtime Synchronization
  const handleRemoteNodeDrag = useCallback(({ nodeId, position }) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, position } : n))
    );
  }, [setNodes]);

  const handleRemoteNodeDragStop = useCallback(({ positions }) => {
    if (Array.isArray(positions)) {
      setNodes((nds) =>
        nds.map((n) => {
          const match = positions.find((p) => `entity-${p.entityId}` === n.id);
          return match ? { ...n, position: { x: match.x, y: match.y } } : n;
        })
      );
    }
  }, [setNodes]);

  // Live Collaborative Engine (Socket.IO with cursors & presence)
  const {
    connected,
    self,
    others,
    broadcastCursor,
    broadcastNodeDrag,
    broadcastNodeDragStop,
    broadcastSelectNode,
    simulatePeer,
  } = useLiveCollaboration({
    projectId,
    user,
    onRemoteNodeDrag: handleRemoteNodeDrag,
    onRemoteNodeDragStop: handleRemoteNodeDragStop,
    onRemoteDataChange: onRefresh,
  });

  // Track user mouse coordinates on ERD Canvas
  const handleMouseMove = useCallback(
    (e) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);
      broadcastCursor(x, y);
    },
    [broadcastCursor]
  );

  // Real-time Node Drag broadcast
  const onNodeDrag = useCallback(
    (event, node) => {
      broadcastNodeDrag(node.id, node.position);
    },
    [broadcastNodeDrag]
  );

  const onNodeDragStop = useCallback(
    (event, node) => {
      const positions = nodes
        .filter((n) => n.id.startsWith('entity-'))
        .map((n) => ({
          entityId: parseInt(n.id.replace('entity-', ''), 10),
          x: Math.round(n.id === node.id ? node.position.x : n.position.x),
          y: Math.round(n.id === node.id ? node.position.y : n.position.y),
        }));
      broadcastNodeDragStop(positions);
    },
    [nodes, broadcastNodeDragStop]
  );

  const onNodeClick = useCallback(
    (event, node) => {
      broadcastSelectNode(node.id);
    },
    [broadcastSelectNode]
  );

  // Sync state whenever props change
  useEffect(() => {
    setNodes(initialElements.flowNodes);
    setEdges(initialElements.flowEdges);
  }, [initialElements, setNodes, setEdges]);

  // Handle Drag-to-Connect Edge Creation
  const onConnect = useCallback(
    (params) => {
      const sourceId = parseInt(params.source.replace('entity-', ''), 10);
      const targetId = parseInt(params.target.replace('entity-', ''), 10);

      if (sourceId && targetId && sourceId !== targetId) {
        setRelFormData({
          sourceEntityId: sourceId,
          targetEntityId: targetId,
          cardinality: '1:M',
          name: 'contains',
          description: '',
          isIdentifying: false,
          onDelete: 'CASCADE',
        });
        setIsRelModalOpen(true);
      }
    },
    []
  );

  // Auto-Layout with Dagre
  const handleAutoLayout = useCallback(() => {
    const layouted = getLayoutedElements(nodes, edges, 'TB');
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);
    setStatusMsg('Auto-layout arranged cleanly!');
    setTimeout(() => setStatusMsg(''), 3000);
  }, [nodes, edges, setNodes, setEdges]);

  // Persist Node Coordinates to PostgreSQL Raw SQL Backend
  const handleSavePositions = async () => {
    try {
      setSavingPositions(true);
      const positions = nodes
        .filter((n) => n.id.startsWith('entity-'))
        .map((n) => ({
          entityId: parseInt(n.id.replace('entity-', ''), 10),
          x: Math.round(n.position.x),
          y: Math.round(n.position.y),
        }));

      await api.saveErdNodePositions(projectId, positions);
      setStatusMsg('Canvas positions saved successfully!');
      setTimeout(() => setStatusMsg(''), 3000);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to save node positions');
    } finally {
      setSavingPositions(false);
    }
  };

  // Submit Relationship from Canvas Connection
  const handleCreateRelationship = async (e) => {
    e.preventDefault();
    try {
      await api.createErdRelationship(projectId, relFormData);
      setIsRelModalOpen(false);
      setStatusMsg('Relationship created & Foreign Keys propagated!');
      setTimeout(() => setStatusMsg(''), 3500);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to create relationship');
    }
  };

  // Export Diagram as PNG / SVG
  const handleExportImage = async (format = 'png') => {
    if (!canvasRef.current) return;
    try {
      const filter = (node) => {
        // Exclude UI controls from exported snapshot
        return !node.classList?.contains('react-flow__controls') && !node.classList?.contains('react-flow__minimap');
      };

      let dataUrl;
      if (format === 'svg') {
        dataUrl = await toSvg(canvasRef.current, { backgroundColor: '#10141e', filter });
      } else {
        dataUrl = await toPng(canvasRef.current, { backgroundColor: '#10141e', filter });
      }

      const link = document.createElement('a');
      link.download = `erd-diagram-project-${projectId}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      alert('Failed to export diagram: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-210px)] min-h-[640px] bg-[#10141e] border border-[#22273b] rounded-lg overflow-hidden relative">
      {/* Canvas Top Bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#22273b] bg-[#161b26] z-10 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-[#1a202e] p-1 rounded-lg border border-[#2e374f]">
            <button
              type="button"
              onClick={() => setNotationMode('crow')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                notationMode === 'crow'
                  ? 'bg-[#0c66e4] text-white'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6]'
              }`}
            >
              Direct / Crow's Foot
            </button>
            <button
              type="button"
              onClick={() => setNotationMode('chen')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                notationMode === 'chen'
                  ? 'bg-purple-600 text-white'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6]'
              }`}
            >
              Chen Notation (Diamonds)
            </button>
          </div>

          {/* Live Collaborative Presence Bar (Feature 4) */}
          <PresenceBar
            connected={connected}
            currentUser={self}
            collaborators={others}
            onSimulatePeer={simulatePeer}
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {statusMsg && (
            <span className="text-xs text-emerald-400 font-medium px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded">
              {statusMsg}
            </span>
          )}

          <button
            type="button"
            onClick={handleAutoLayout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1c2230] hover:bg-[#252d40] border border-[#2e374f] text-xs font-semibold text-[#dfe1e6] transition-colors cursor-pointer"
            title="Auto-arrange nodes with Dagre algorithm"
          >
            <Layout size={13} />
            <span>Auto-Layout</span>
          </button>

          <button
            type="button"
            disabled={savingPositions}
            onClick={handleSavePositions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-40"
          >
            <Save size={13} />
            <span>{savingPositions ? 'Saving...' : 'Save Positions'}</span>
          </button>

          {/* Export Dropdown */}
          <div className="flex items-center rounded border border-[#2e374f] bg-[#1c2230]">
            <button
              type="button"
              onClick={() => handleExportImage('png')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#dfe1e6] hover:bg-[#252d40] border-r border-[#2e374f] transition-colors cursor-pointer"
              title="Export as PNG image"
            >
              <FileImage size={13} />
              <span>PNG</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportImage('svg')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#dfe1e6] hover:bg-[#252d40] transition-colors cursor-pointer"
              title="Export as SVG vector"
            >
              <FileCode size={13} />
              <span>SVG</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Area with Live Cursors & Mouse Tracking */}
      <div
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        className="flex-1 w-full h-full bg-[#0c0f17] relative overflow-hidden"
      >
        {/* Figma-style Live Cursors Overlay */}
        <LiveCursors others={others} />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onConnect={onConnect}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="#1e2536" gap={20} size={1} />
          <Controls className="bg-[#141923] border border-[#2e374f] rounded-lg text-[#dfe1e6]" />
          <MiniMap
            nodeColor={(n) => (n.type === 'relationshipDiamond' ? '#9333ea' : '#0c66e4')}
            maskColor="rgba(16, 20, 30, 0.7)"
            className="bg-[#141923] border border-[#2e374f] rounded-lg"
          />
        </ReactFlow>
      </div>

      {/* Relationship Properties Modal */}
      {isRelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#181d2a] border border-[#2e374f] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#22273b] bg-[#141923] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon size={16} className="text-sky-400" />
                <h3 className="font-bold text-sm text-[#dfe1e6]">Relationship Properties</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRelModalOpen(false)}
                className="text-[#8c9bab] hover:text-white p-1 rounded hover:bg-[#22273b] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRelationship} className="p-5 space-y-4">
              <div className="p-3 bg-[#121620] border border-[#242b3d] rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="text-[#8c9bab]">From: </span>
                  <strong className="text-sky-300">
                    {entities.find((e) => e.id === relFormData.sourceEntityId)?.name || 'Source'}
                  </strong>
                </div>
                <span className="text-[#626f86]">➔</span>
                <div>
                  <span className="text-[#8c9bab]">To: </span>
                  <strong className="text-purple-300">
                    {entities.find((e) => e.id === relFormData.targetEntityId)?.name || 'Target'}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8c9bab] mb-1">
                  Relationship Name (Verb)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. contains, manages, places, owns"
                  value={relFormData.name}
                  onChange={(e) => setRelFormData({ ...relFormData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#121620] border border-[#2e374f] text-xs text-[#dfe1e6] focus:outline-none focus:border-[#579dff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8c9bab] mb-1">
                  Cardinality
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['1:1', '1:M', 'M:N'].map((card) => (
                    <button
                      key={card}
                      type="button"
                      onClick={() => setRelFormData({ ...relFormData, cardinality: card })}
                      className={`p-2 rounded-lg border text-center font-mono font-bold text-xs cursor-pointer transition-colors ${
                        relFormData.cardinality === card
                          ? 'bg-sky-500/20 border-sky-500 text-sky-200'
                          : 'bg-[#121620] border-[#2e374f] text-[#8c9bab] hover:bg-[#1a202e]'
                      }`}
                    >
                      {card}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#8c9bab] mt-1.5">
                  {relFormData.cardinality === '1:M' && 'Auto-injects FK column into target child entity.'}
                  {relFormData.cardinality === 'M:N' && 'Auto-generates Junction table with composite PK.'}
                  {relFormData.cardinality === '1:1' && 'Direct one-to-one unique foreign key constraint.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="canvasIsIdentifying"
                  checked={relFormData.isIdentifying}
                  onChange={(e) => setRelFormData({ ...relFormData, isIdentifying: e.target.checked })}
                  className="w-4 h-4 rounded bg-[#121620] border-[#2e374f] text-[#0c66e4] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="canvasIsIdentifying" className="text-xs text-[#dfe1e6] cursor-pointer">
                  Identifying Relationship (for Weak Entities)
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8c9bab] mb-1">
                  ON DELETE Cascade Rule
                </label>
                <select
                  value={relFormData.onDelete}
                  onChange={(e) => setRelFormData({ ...relFormData, onDelete: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#121620] border border-[#2e374f] text-xs text-[#dfe1e6] focus:outline-none focus:border-[#579dff] cursor-pointer"
                >
                  <option value="CASCADE">CASCADE (Delete children when parent is deleted)</option>
                  <option value="SET NULL">SET NULL (Set child FK to NULL)</option>
                  <option value="RESTRICT">RESTRICT (Prevent parent deletion if children exist)</option>
                  <option value="NO ACTION">NO ACTION (Standard SQL restriction)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#22273b]">
                <button
                  type="button"
                  onClick={() => setIsRelModalOpen(false)}
                  className="px-3 py-1.5 rounded text-xs text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#22273b] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm cursor-pointer"
                >
                  Confirm & Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

