import React from 'react';
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const rpeDescriptions = {
  1: "Très très facile",
  2: "Très facile", 
  3: "Facile",
  4: "Modéré",
  5: "Quelque peu difficile",
  6: "Difficile",
  7: "Très difficile",
  8: "Très très difficile",
  9: "Extrêmement difficile",
  10: "Effort maximal"
};

const rpeColors = {
  1: "bg-emerald-400",
  2: "bg-emerald-500",
  3: "bg-green-500",
  4: "bg-lime-500",
  5: "bg-yellow-500",
  6: "bg-amber-500",
  7: "bg-orange-500",
  8: "bg-red-400",
  9: "bg-red-500",
  10: "bg-red-600"
};

export default function RpeSlider({ value, onChange, label = "RPE" }) {
  const currentValue = value || 5;
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <div className="flex items-center gap-2">
          <span className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg",
            rpeColors[currentValue]
          )}>
            {currentValue}
          </span>
        </div>
      </div>
      <Slider
        value={[currentValue]}
        onValueChange={(vals) => onChange(vals[0])}
        min={1}
        max={10}
        step={1}
        className="py-2"
      />
      <p className="text-sm text-slate-500 text-center font-medium">
        {rpeDescriptions[currentValue]}
      </p>
    </div>
  );
}