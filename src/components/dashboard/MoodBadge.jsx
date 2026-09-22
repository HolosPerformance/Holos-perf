import React from 'react';
import { cn } from "@/lib/utils";

const moodConfig = {
  excellent: { emoji: "😄", color: "bg-emerald-100 text-emerald-700", label: "Excellent" },
  bon: { emoji: "🙂", color: "bg-green-100 text-green-700", label: "Bon" },
  moyen: { emoji: "😐", color: "bg-yellow-100 text-yellow-700", label: "Moyen" },
  fatigué: { emoji: "😴", color: "bg-orange-100 text-orange-700", label: "Fatigué" },
  stressé: { emoji: "😰", color: "bg-red-100 text-red-700", label: "Stressé" }
};

export default function MoodBadge({ mood, size = "md" }) {
  const config = moodConfig[mood] || moodConfig.moyen;
  
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base"
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full font-medium",
      config.color,
      sizeClasses[size]
    )}>
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}