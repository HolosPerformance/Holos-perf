import React from 'react';
import { cn } from "@/lib/utils";
import { Dumbbell, Trophy, Zap, Coffee } from 'lucide-react';

const sessionTypes = [
  { value: 'entrainement', label: 'Entraînement', icon: Dumbbell, color: 'bg-blue-500' },
  { value: 'competition', label: 'Compétition', icon: Trophy, color: 'bg-amber-500' },
  { value: 'effort_type', label: 'Effort type', icon: Zap, color: 'bg-purple-500' },
  { value: 'off', label: 'Off', icon: Coffee, color: 'bg-slate-400' }
];

export default function SessionTypeSelector({ value, onChange }) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-slate-700">Type de séance</label>
      <div className="grid grid-cols-2 gap-3">
        {sessionTypes.map(type => {
          const Icon = type.icon;
          const isSelected = value === type.value;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => onChange(type.value)}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                isSelected 
                  ? "border-black bg-slate-800 text-white shadow-lg" 
                  : "border-black bg-white hover:border-black text-slate-700"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                isSelected ? "bg-white/20" : type.color
              )}>
                <Icon className={cn("w-5 h-5", isSelected ? "text-white" : "text-white")} />
              </div>
              <span className="font-medium">{type.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}