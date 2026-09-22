import React from 'react';
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export default function AnalogScale({ label, value, onChange }) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative pt-2 pb-6">
        <Slider
          value={[value ?? 50]}
          onValueChange={(vals) => onChange(vals[0])}
          min={0}
          max={100}
          step={1}
          className="py-2"
        />
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>Minimum</span>
          <span>Maximum</span>
        </div>
      </div>
    </div>
  );
}