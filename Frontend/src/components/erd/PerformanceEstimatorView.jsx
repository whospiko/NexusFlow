import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.js';
import {
  Gauge,
  HardDrive,
  TrendingUp,
  Zap,
  Layers,
  Database,
  Cpu,
  Search,
  Copy,
  Check,
  AlertCircle,
  Play,
  ArrowRight,
  ShieldAlert,
  Server,
  RefreshCw,
} from 'lucide-react';

export function PerformanceEstimatorView({ projectId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [monthlyRows, setMonthlyRows] = useState(15000);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Query Cost Simulator State
  const [selectedTables, setSelectedTables] = useState([]);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  const fetchEstimates = useCallback(async (rows = monthlyRows) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPerformanceEstimates(projectId, rows);
      setData(res.data);
      if (res.data?.querySimulation) {
        setSimResult(res.data.querySimulation);
      }
      // Default table selection for simulator
      if (res.data?.tableEstimates?.length > 0 && selectedTables.length === 0) {
        setSelectedTables(res.data.tableEstimates.slice(0, 2).map((t) => t.entityName));
      }
    } catch (err) {
      setError(err.message || 'Failed to calculate performance estimates');
    } finally {
      setLoading(false);
    }
  }, [projectId, monthlyRows]);

  useEffect(() => {
    fetchEstimates(monthlyRows);
  }, [fetchEstimates, monthlyRows]);

  const handleCopySql = (sql, key) => {
    navigator.clipboard.writeText(sql);
    setCopiedIndex(key);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleRunSimulation = async () => {
    try {
      setSimulating(true);
      const res = await api.simulateQueryCost(projectId, selectedTables);
      setSimResult(res.data);
    } catch (err) {
      alert(err.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  const toggleTableSelection = (tableName) => {
    if (selectedTables.includes(tableName)) {
      setSelectedTables(selectedTables.filter((t) => t !== tableName));
    } else {
      setSelectedTables([...selectedTables, tableName]);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-[#8c9bab] bg-[#161b26] rounded-xl border border-[#22273b]">
        <RefreshCw size={28} className="animate-spin text-indigo-400 mb-3" />
        <span className="text-sm font-medium">Computing PostgreSQL storage heuristics & query plans...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-[#161b26] to-[#121620] border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Module 9 • High Throughput Engine
              </span>
              <span className="text-xs text-[#8c9bab]">PostgreSQL Storage & Query Optimizer</span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Cpu className="text-indigo-400" size={22} />
              Performance & Capacity Estimator
            </h2>
            <p className="text-xs text-[#8c9bab] mt-1 max-w-2xl">
              Forecast storage trajectory over 1-5 years, audit B-Tree index coverage on foreign keys, and simulate multi-table SQL JOIN execution latency without affecting production.
            </p>
          </div>

          {/* Monthly Growth Rate Slider */}
          <div className="bg-[#10141e]/80 border border-[#232a3d] p-3.5 rounded-xl min-w-[260px]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[#8c9bab] font-medium">Monthly Ingestion / Table:</span>
              <span className="text-indigo-400 font-mono font-bold">{monthlyRows.toLocaleString()} rows</span>
            </div>
            <input
              type="range"
              min="1000"
              max="100000"
              step="1000"
              value={monthlyRows}
              onChange={(e) => setMonthlyRows(Number(e.target.value))}
              className="w-full h-1.5 bg-[#232a3d] rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-[#627084] mt-1">
              <span>1K (Dev)</span>
              <span>25K (Growth)</span>
              <span>100K (Enterprise)</span>
            </div>
          </div>
        </div>

        {/* Global Summary KPI Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-[#121622]/90 border border-[#22283a] rounded-xl p-3.5">
            <div className="text-[11px] text-[#8c9bab] flex items-center gap-1.5">
              <TrendingUp size={13} className="text-emerald-400" />
              <span>1-Year Storage Growth</span>
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">
              ~{data?.annualGrowthFormatted || '0 B'}
            </div>
            <div className="text-[10px] text-[#627084] mt-0.5">Tables + 25% B-Tree indexes</div>
          </div>

          <div className="bg-[#121622]/90 border border-[#22283a] rounded-xl p-3.5">
            <div className="text-[11px] text-[#8c9bab] flex items-center gap-1.5">
              <HardDrive size={13} className="text-indigo-400" />
              <span>3-Year Runway Storage</span>
            </div>
            <div className="text-xl font-bold text-indigo-400 mt-1 font-mono">
              ~{data?.threeYearGrowthFormatted || '0 B'}
            </div>
            <div className="text-[10px] text-[#627084] mt-0.5">At current ingest volume</div>
          </div>

          <div className="bg-[#121622]/90 border border-[#22283a] rounded-xl p-3.5">
            <div className="text-[11px] text-[#8c9bab] flex items-center gap-1.5">
              <Database size={13} className="text-sky-400" />
              <span>Avg Tuple Row Width</span>
            </div>
            <div className="text-xl font-bold text-sky-400 mt-1 font-mono">
              {data?.averageRowBytes || 0} bytes
            </div>
            <div className="text-[10px] text-[#627084] mt-0.5">Includes 24B PG tuple header</div>
          </div>

          <div className="bg-[#121622]/90 border border-[#22283a] rounded-xl p-3.5">
            <div className="text-[11px] text-[#8c9bab] flex items-center gap-1.5">
              <Zap size={13} className="text-amber-400" />
              <span>Index Suggestions</span>
            </div>
            <div className="text-xl font-bold text-amber-400 mt-1 font-mono">
              {data?.indexRecommendations?.length || 0}
            </div>
            <div className="text-[10px] text-[#627084] mt-0.5">High selectivity columns</div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Index Recommendations & Query Join Simulator (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section: Query Join Execution Cost Simulator */}
          <div className="bg-[#161b26] border border-[#22273b] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Play size={16} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Multi-Table Query Join Cost Simulator</h3>
              </div>
              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={simulating || selectedTables.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-all cursor-pointer shadow-sm"
              >
                <Play size={12} className={simulating ? 'animate-spin' : ''} />
                <span>Simulate Execution</span>
              </button>
            </div>

            <p className="text-xs text-[#8c9bab] mb-3">
              Select tables to simulate a relational JOIN plan. Evaluates nested loops, hash joins, and detects unindexed sequential scan risks.
            </p>

            {/* Table Selection Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full flex-nowrap py-1 mb-4">
              <span className="text-[11px] text-[#627084] font-medium mr-1 shrink-0">Join tables:</span>
              {(data?.tableEstimates || []).map((t) => {
                const isSelected = selectedTables.includes(t.entityName);
                return (
                  <button
                    key={t.entityName}
                    type="button"
                    onClick={() => toggleTableSelection(t.entityName)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all cursor-pointer border shrink-0 whitespace-nowrap ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-[#121620] text-[#8c9bab] border-[#22273b] hover:border-[#343e5c]'
                    }`}
                  >
                    {t.entityName}
                  </button>
                );
              })}
            </div>

            {/* Simulation Results Display */}
            {simResult && (
              <div className="bg-[#10141f] border border-[#22283b] rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#161b26] p-2.5 rounded-lg border border-[#252c40]">
                    <div className="text-[10px] text-[#8c9bab]">Planner Strategy</div>
                    <div className="text-xs font-bold text-white mt-0.5 truncate">{simResult.joinStrategy}</div>
                  </div>
                  <div className="bg-[#161b26] p-2.5 rounded-lg border border-[#252c40]">
                    <div className="text-[10px] text-[#8c9bab]">Cost Units</div>
                    <div className="text-xs font-bold text-indigo-400 mt-0.5 font-mono">{simResult.estimatedCostUnits}</div>
                  </div>
                  <div className="bg-[#161b26] p-2.5 rounded-lg border border-[#252c40]">
                    <div className="text-[10px] text-[#8c9bab]">Estimated Latency</div>
                    <div className={`text-xs font-bold mt-0.5 font-mono ${simResult.hasSequentialScanRisk ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {simResult.estimatedLatency}
                    </div>
                  </div>
                </div>

                {/* Bottleneck Alerts */}
                {simResult.bottlenecks?.length > 0 && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs space-y-1">
                    {simResult.bottlenecks.map((b, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <ShieldAlert size={13} className="shrink-0 text-rose-400" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mock EXPLAIN Output */}
                <div>
                  <div className="text-[11px] font-mono text-[#8c9bab] mb-1 flex items-center justify-between">
                    <span>EXPLAIN (ANALYZE, BUFFERS) SIMULATION</span>
                    <span className="text-[10px] text-[#627084]">Postgres 16 Cost Model</span>
                  </div>
                  <div className="bg-[#0b0e14] p-3 rounded-lg border border-[#1b2233] font-mono text-xs text-emerald-400/90 overflow-x-auto space-y-0.5">
                    {(simResult.mockExplainPlan || []).map((line, i) => (
                      <div key={i} className={line.includes('Seq Scan') ? 'text-amber-300' : ''}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: Index Recommendations */}
          <div className="bg-[#161b26] border border-[#22273b] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-amber-400" />
                <h3 className="text-sm font-bold text-white">Intelligent B-Tree Index Recommendations</h3>
              </div>
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                {data?.indexRecommendations?.length || 0} suggestions
              </span>
            </div>

            <p className="text-xs text-[#8c9bab] mb-3">
              Unindexed Foreign Keys cause PostgreSQL to perform full-table sequential scans during JOINs and CASCADE deletions.
            </p>

            <div className="space-y-3">
              {(data?.indexRecommendations || []).length === 0 ? (
                <div className="p-6 text-center text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  ✓ Excellent! All foreign keys and high-cardinality candidate columns appear indexed.
                </div>
              ) : (
                data?.indexRecommendations.map((rec, i) => (
                  <div key={i} className="bg-[#10141f] border border-[#242c3f] rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rec.priority === 'High'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {rec.priority} Priority
                        </span>
                        <span className="text-xs font-bold text-white font-mono">{rec.tableName}.{rec.columnName}</span>
                      </div>
                      <span className="text-[11px] text-emerald-400 font-mono">{rec.estimatedSpeedup}</span>
                    </div>

                    <p className="text-xs text-[#8c9bab]">{rec.reason}</p>

                    <div className="flex items-center justify-between bg-[#0b0e14] px-3 py-2 rounded-lg border border-[#1b2233]">
                      <code className="text-xs font-mono text-indigo-300 truncate max-w-[85%]">{rec.sql}</code>
                      <button
                        type="button"
                        onClick={() => handleCopySql(rec.sql, i)}
                        className="text-xs text-[#8c9bab] hover:text-white transition-colors cursor-pointer"
                        title="Copy DDL SQL"
                      >
                        {copiedIndex === i ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Table Storage Trajectories & Row Width Breakdown (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#161b26] border border-[#22273b] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HardDrive size={16} className="text-sky-400" />
                <h3 className="text-sm font-bold text-white">Table Storage Projections</h3>
              </div>
              <span className="text-xs text-[#8c9bab]">{data?.totalTables || 0} tables</span>
            </div>

            <p className="text-xs text-[#8c9bab] mb-3">
              PostgreSQL data byte calculations per table based on aligned tuple overhead, null bitmaps, and column types.
            </p>

            <div className="space-y-3">
              {(data?.tableEstimates || []).map((t) => (
                <div key={t.entityId} className="bg-[#10141f] border border-[#22283b] rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database size={14} className="text-indigo-400" />
                      <span className="text-xs font-bold text-white font-mono">{t.entityName}</span>
                    </div>
                    <span className="text-[11px] font-mono text-sky-400">
                      {t.rowBytes} B/row ({t.columnCount} cols)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#161b26] p-2 rounded-lg border border-[#22283a]">
                      <div className="text-[10px] text-[#8c9bab]">1-Year Projection</div>
                      <div className="font-bold text-white font-mono mt-0.5">
                        {t.projections.oneYear.withIndexFormatted}
                      </div>
                      <div className="text-[9px] text-[#627084]">
                        {(t.projections.oneYear.rows).toLocaleString()} rows
                      </div>
                    </div>

                    <div className="bg-[#161b26] p-2 rounded-lg border border-[#22283a]">
                      <div className="text-[10px] text-[#8c9bab]">3-Year Projection</div>
                      <div className="font-bold text-indigo-400 font-mono mt-0.5">
                        {t.projections.threeYears.withIndexFormatted}
                      </div>
                      <div className="text-[9px] text-[#627084]">
                        {(t.projections.threeYears.rows).toLocaleString()} rows
                      </div>
                    </div>
                  </div>

                  {/* Milestones bar */}
                  <div className="pt-1 border-t border-[#1e2436] flex items-center justify-between text-[10px] text-[#627084] font-mono">
                    <span>100K: {t.projections.milestones.at100k}</span>
                    <span>1M: {t.projections.milestones.at1M}</span>
                    <span>10M: {t.projections.milestones.at10M}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

