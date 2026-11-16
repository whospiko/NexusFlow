import React, { useState } from 'react';
import { Users, Wifi, WifiOff, Sparkles, ChevronDown } from 'lucide-react';

export function PresenceBar({
  connected = false,
  currentUser = null,
  collaborators = [],
  onSimulatePeer = null,
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Total active count including current user
  const totalCount = (currentUser ? 1 : 0) + (collaborators?.length || 0);

  return (
    <div className="relative inline-flex items-center">
      {/* Presence Trigger Button */}
      <div className="flex items-center gap-2 bg-[#141923] border border-[#273148] hover:border-[#3d4b6c] px-2.5 py-1 rounded-lg text-xs transition-colors">
        {/* Connection Status Icon */}
        <div className="flex items-center gap-1.5" title={connected ? 'Live Sync active' : 'Offline'}>
          <span className="relative flex h-2 w-2">
            {connected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </>
            ) : (
              <span className="inline-flex rounded-full h-2 w-2 bg-amber-500" />
            )}
          </span>
          <span className="text-[11px] font-medium text-[#8c9bab] hidden sm:inline">
            {connected ? 'Live Sync' : 'Connecting'}
          </span>
        </div>

        <div className="h-3 w-[1px] bg-[#2e374f]" />

        {/* Avatar Stack */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 cursor-pointer text-[#dfe1e6] hover:text-white"
          title="Click to view all collaborators"
        >
          <div className="flex items-center -space-x-1.5 overflow-hidden">
            {/* Self Avatar */}
            {currentUser && (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-[#141923]"
                style={{ backgroundColor: currentUser.color || '#0ea5e9' }}
                title={`${currentUser.name} (You)`}
              >
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'Y'}
              </div>
            )}

            {/* Other Collaborators */}
            {collaborators.slice(0, 3).map((collab) => (
              <div
                key={collab.socketId || collab.userId}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-[#141923]"
                style={{ backgroundColor: collab.color || '#10b981' }}
                title={collab.name}
              >
                {collab.name ? collab.name.charAt(0).toUpperCase() : 'C'}
              </div>
            ))}

            {collaborators.length > 3 && (
              <div className="w-5 h-5 rounded-full bg-[#273148] text-[#8c9bab] ring-2 ring-[#141923] flex items-center justify-center text-[9px] font-mono font-bold">
                +{collaborators.length - 3}
              </div>
            )}
          </div>

          <span className="text-xs font-semibold text-[#dfe1e6] ml-0.5">
            {totalCount} {totalCount === 1 ? 'person' : 'people'} viewing
          </span>

          <ChevronDown size={12} className={`text-[#8c9bab] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Popover / Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-[#161c27] border border-[#2e3852] rounded-xl shadow-2xl z-50 p-3 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#242c40]">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-sky-400" />
              <span className="text-xs font-bold text-[#dfe1e6]">Live Collaborators</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              {totalCount} Active
            </span>
          </div>

          {/* User List */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {/* Current user */}
            {currentUser && (
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#1a2233] border border-[#2b3650]">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: currentUser.color || '#0ea5e9' }}
                  >
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'Y'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#dfe1e6] truncate flex items-center gap-1">
                      <span>{currentUser.name}</span>
                      <span className="text-[9px] text-sky-400 font-mono font-normal">(You)</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Active on canvas</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other peers */}
            {collaborators.map((c) => (
              <div
                key={c.socketId || c.userId}
                className="flex items-center justify-between p-1.5 rounded-lg bg-[#121620] border border-[#22293d]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: c.color || '#10b981' }}
                  >
                    {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#dfe1e6] truncate">
                      {c.name || 'Anonymous Peer'}
                    </div>
                    <div className="text-[10px] text-[#8c9bab] font-mono flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{c.activeNodeId ? `Editing node` : 'Viewing'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {collaborators.length === 0 && (
              <div className="text-center py-2 text-[11px] text-[#8c9bab] italic">
                No other teammates viewing right now. Open another tab or invite a teammate to collaborate live!
              </div>
            )}
          </div>

          {/* Quick Demo Simulator for Solo Devs */}
          {onSimulatePeer && (
            <div className="pt-2 border-t border-[#242c40]">
              <button
                type="button"
                onClick={() => {
                  onSimulatePeer();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-sky-600/30 to-purple-600/30 hover:from-sky-600/50 hover:to-purple-600/50 border border-sky-500/30 text-sky-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <Sparkles size={13} className="text-amber-400" />
                <span>Simulate Collaborator (Demo)</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

