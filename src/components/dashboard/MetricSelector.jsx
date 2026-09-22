import React from 'react';
import { cn } from "@/lib/utils";
import { Pencil } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import ColorPicker from '@/components/ui/ColorPicker';

export default function MetricSelector({ selected, onChange, metrics, onColorChange }) {
  const defaultMetrics = [
    { key: 'fatigue', label: 'Fatigue', color: '#ef4444' },
    { key: 'intensite', label: 'Intensité', color: '#f59e0b' },
    { key: 'sommeil', label: 'Sommeil', color: '#8b5cf6' },
    { key: 'plaisir', label: 'Plaisir', color: '#10b981' },
    { key: 'harmonie_proches', label: 'Harmonie proches', color: '#06b6d4' },
    { key: 'maitrise_technique', label: 'Maîtrise technique', color: '#3b82f6' },
    { key: 'maitrise_tactique', label: 'Maîtrise tactique', color: '#6366f1' },
    { key: 'epanouissement', label: 'Épanouissement', color: '#ec4899' }
  ];

  const metricsToUse = metrics || defaultMetrics;

  const toggleMetric = (key) => {
    if (selected.includes(key)) {
      onChange(selected.filter(m => m !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {metricsToUse.map(metric => (
        <MetricButton
          key={metric.key}
          metric={metric}
          isSelected={selected.includes(metric.key)}
          onToggle={() => toggleMetric(metric.key)}
          onColorChange={onColorChange}
        />
      ))}
    </div>
  );
}

function MetricButton({ metric, isSelected, onToggle, onColorChange }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border-2 shadow-sm",
        isSelected
          ? "text-white border-white shadow-md"
          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
      )}
      style={isSelected ? { backgroundColor: metric.color } : {}}
    >
      <Popover>
        <PopoverTrigger asChild>
          <span
            className="relative group/dot flex items-center justify-center w-3 h-3 rounded-full flex-shrink-0 ring-[1.5px] ring-white"
            onClick={(e) => e.stopPropagation()}
            title="Changer la couleur"
          >
            <span
              className="w-3 h-3 rounded-full block transition-opacity group-hover/dot:opacity-0"
              style={{ backgroundColor: metric.color }}
            />
            <span
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/dot:opacity-100 cursor-pointer transition-opacity"
            >
              <Pencil
                className="w-2.5 h-2.5"
                style={{ color: isSelected ? 'white' : metric.color }}
              />
            </span>
          </span>
        </PopoverTrigger>
        <PopoverContent
          className="p-3 w-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs font-semibold text-slate-600 mb-2">{metric.label}</p>
          <ColorPicker
            value={metric.color}
            onChange={(newColor) => onColorChange && onColorChange(metric.key, newColor)}
          />
        </PopoverContent>
      </Popover>
      {metric.label}
    </button>
  );
}
