import React from 'react';

/**
 * Live Figma-style Collaborative Cursors
 * Renders other collaborators' cursors with distinct colors and name tags
 */
export function LiveCursors({ others = [] }) {
  if (!others || others.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {others.map((collaborator) => {
        const { socketId, name, color = '#0ea5e9', cursor, activeNodeId, isEditing } = collaborator;
        if (!cursor || typeof cursor.x !== 'number' || typeof cursor.y !== 'number') {
          return null;
        }

        return (
          <div
            key={socketId}
            className="absolute transition-transform duration-75 ease-out pointer-events-none"
            style={{
              transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)`,
              willChange: 'transform',
            }}
          >
            {/* SVG Cursor Pointer with dynamic color */}
            <svg
              className="w-5 h-5 drop-shadow-md"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4.5 2.5L10.5 20.5L14 13.5L21 10.5L4.5 2.5Z"
                fill={color}
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>

            {/* Name Badge */}
            <div
              className="absolute left-4 top-3 px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-lg whitespace-nowrap flex items-center gap-1.5 select-none"
              style={{ backgroundColor: color }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>{name || 'Collaborator'}</span>
              {activeNodeId && (
                <span className="opacity-80 font-normal text-[9px] bg-black/20 px-1 rounded">
                  editing
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

