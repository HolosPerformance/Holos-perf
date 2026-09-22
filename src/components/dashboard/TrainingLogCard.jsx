import React from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, Dumbbell, Moon, Droplets } from 'lucide-react';
import MoodBadge from './MoodBadge';
import { cn } from "@/lib/utils";

const rpeColors = {
  1: "bg-emerald-500", 2: "bg-emerald-500", 3: "bg-green-500",
  4: "bg-lime-500", 5: "bg-yellow-500", 6: "bg-amber-500",
  7: "bg-orange-500", 8: "bg-red-400", 9: "bg-red-500", 10: "bg-red-600"
};

const trainingTypeLabels = {
  endurance: "Endurance",
  force: "Force",
  vitesse: "Vitesse",
  technique: "Technique",
  récupération: "Récupération",
  compétition: "Compétition",
  autre: "Autre"
};

export default function TrainingLogCard({ log, showAthlete = false }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-slate-500">
            {format(parseISO(log.training_date), 'EEEE d MMMM', { locale: fr })}
          </p>
          {showAthlete && (
            <p className="font-semibold text-slate-800">{log.athlete_name}</p>
          )}
          {log.training_type && (
            <span className="inline-block mt-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">
              {trainingTypeLabels[log.training_type]}
            </span>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg",
          rpeColors[log.rpe] || "bg-slate-400"
        )}>
          {log.rpe}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {log.duration_minutes && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>{log.duration_minutes} min</span>
          </div>
        )}
        {log.fatigue_level && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Dumbbell className="w-4 h-4 text-slate-400" />
            <span>Fatigue: {log.fatigue_level}/10</span>
          </div>
        )}
        {log.sleep_hours && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Moon className="w-4 h-4 text-slate-400" />
            <span>{log.sleep_hours}h sommeil</span>
          </div>
        )}
        {log.hydration && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Droplets className="w-4 h-4 text-slate-400" />
            <span>{log.hydration}</span>
          </div>
        )}
      </div>

      {log.mood && (
        <div className="mb-3">
          <MoodBadge mood={log.mood} size="sm" />
        </div>
      )}

      {log.notes && (
        <p className="text-sm text-slate-500 italic border-t border-slate-100 pt-3">
          "{log.notes}"
        </p>
      )}

      {log.injury_report && (
        <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
          <p className="text-sm text-red-700">
            ⚠️ {log.injury_report}
          </p>
        </div>
      )}
    </div>
  );
}