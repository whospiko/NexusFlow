import React from 'react';
import { X } from 'lucide-react';

export function TagBadge({ tag, onRemove, size = 'sm' }) {
  if (!tag) return null;
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border transition-colors ${
        isSm ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
      style={{
        backgroundColor: `${tag.color || '#6366f1'}15`,
        borderColor: `${tag.color || '#6366f1'}35`,
        color: tag.color || '#6366f1',
      }}
    >
      <span
        className="rounded-full inline-block"
        style={{
          width: isSm ? '5px' : '6px',
          height: isSm ? '5px' : '6px',
          backgroundColor: tag.color || '#6366f1',
        }}
      />
      <span>{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(tag.id);
          }}
          className="hover:opacity-100 opacity-60 ml-0.5 transition-opacity"
          title={`Remove label ${tag.name}`}
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}
