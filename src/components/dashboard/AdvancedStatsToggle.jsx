import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown, LineChart } from 'lucide-react';
import { ADVANCED_STAT_DEFS } from '@/lib/advancedStats';

// Bouton "statistiques avancées" : en variant="button" (contrôle global, applique
// le réglage à tous les graphiques) ou variant="icon" (petite flèche par graphique,
// pour ajuster individuellement sans affecter les autres).
export default function AdvancedStatsToggle({ idPrefix, active, onToggle, variant = 'icon', label = 'Statistiques avancées' }) {
  const activeCount = ADVANCED_STAT_DEFS.filter(d => active?.[d.key]).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === 'icon' ? (
          <button
            type="button"
            aria-label={`${label} pour ce graphique`}
            title={label}
            className={`p-1.5 rounded-md border shadow-sm transition-colors ${activeCount > 0 ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-white/90 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-white'}`}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className={`gap-2 ${activeCount > 0 ? 'border-indigo-300 text-indigo-700 bg-indigo-50' : ''}`}
          >
            <LineChart className="w-4 h-4" />
            {label}{activeCount > 0 ? ` (${activeCount})` : ''}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <p className="text-xs font-medium text-slate-500 mb-2">Lignes de référence</p>
        <div className="space-y-2">
          {ADVANCED_STAT_DEFS.map(def => (
            <div key={def.key} className="flex items-center gap-2">
              <Checkbox
                id={`stat-${idPrefix}-${def.key}`}
                checked={!!active?.[def.key]}
                onCheckedChange={() => onToggle(def.key)}
              />
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: def.color }} />
              <Label htmlFor={`stat-${idPrefix}-${def.key}`} className="text-sm cursor-pointer font-normal">
                {def.label}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
