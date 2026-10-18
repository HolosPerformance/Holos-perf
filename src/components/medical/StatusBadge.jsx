import React from 'react';
import { statusInfo } from '@/lib/medical';

export default function StatusBadge({ status, className = '' }) {
  const info = statusInfo(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${info.badge} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}
