import React from 'react';
import { eachDayOfInterval, getDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ChevronDown, Ruler } from 'lucide-react';
import { DEFAULT_AXIS_SETTINGS, isDefaultAxisSettings, yTickOptions, closestTickOption } from './chartStyle';

// Lundi en premier ; valeurs = getDay (0 = dimanche)
const WEEKDAYS = [
  { value: 1, label: 'Lundi', short: 'Lun' },
  { value: 2, label: 'Mardi', short: 'Mar' },
  { value: 3, label: 'Mercredi', short: 'Mer' },
  { value: 4, label: 'Jeudi', short: 'Jeu' },
  { value: 5, label: 'Vendredi', short: 'Ven' },
  { value: 6, label: 'Samedi', short: 'Sam' },
  { value: 0, label: 'Dimanche', short: 'Dim' },
];

const X_EVERY_CHOICES = [2, 3, 4, 5, 6, 7, 10, 14];

const fmt = (n) => String(n).replace('.', ',');

// Aperçu des graduations : « 0, 25, 50, 75, 100 », abrégé au-delà de 6
// (« 0, 10 … 100 »)
function ticksPreview(ticks) {
  if (ticks.length <= 6) return ticks.map(fmt).join(', ');
  return `${fmt(ticks[0])}, ${fmt(ticks[1])} … ${fmt(ticks[ticks.length - 1])}`;
}

// Vrai si au moins un des jours choisis tombe dans la période
function weekdaysInPeriod(weekdays, startDate, endDate) {
  if (!startDate || !endDate) return true;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (!(start <= end)) return true;
  const days = eachDayOfInterval({ start, end }).slice(0, 7);
  return days.some(d => weekdays.includes(getDay(d)));
}

// Bouton « Échelle » : réglage commun à tous les graphiques du dashboard
// (graduations de l'axe des valeurs, dates affichées sur l'axe horizontal).
// `scaleMax` : maximum de l'échelle du graphique où le bouton est affiché,
// pour ne proposer que les nombres de graduations qui y tombent juste.
export default function AxisScaleToggle({ settings, onChange, startDate, endDate, scaleMax }) {
  const value = { ...DEFAULT_AXIS_SETTINGS, ...settings };
  const set = (patch) => onChange({ ...value, ...patch });
  const isCustom = !isDefaultAxisSettings(value);

  // Graduations : seuls les choix qui tombent juste sur cette échelle ;
  // un réglage mémorisé impossible ici est remplacé par le plus proche
  const tickOptions = yTickOptions([], scaleMax);
  const wantedTicks = value.yTicks === 'auto' ? null : Number(value.yTicks);
  const usedTicks = wantedTicks == null ? null : closestTickOption(tickOptions, wantedTicks);
  const yValue = usedTicks ? String(usedTicks.count) : 'auto';
  const ticksAdjusted = usedTicks && usedTicks.count !== wantedTicks;

  const toggleWeekday = (day) => {
    const next = value.xWeekdays.includes(day)
      ? value.xWeekdays.filter(d => d !== day)
      : [...value.xWeekdays, day];
    set({ xWeekdays: next });
  };

  const weekdaysLabel = value.xWeekdays.length === 0
    ? 'Aucun jour'
    : WEEKDAYS.filter(d => value.xWeekdays.includes(d.value)).map(d => d.short).join(', ');

  const noDateShown = value.xMode === 'weekdays'
    && (value.xWeekdays.length === 0 || !weekdaysInPeriod(value.xWeekdays, startDate, endDate));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Échelle des graphiques"
          title="Échelle des graphiques"
          className={`p-1.5 rounded-md border shadow-sm transition-colors ${isCustom ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-white/90 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-white'}`}
        >
          <Ruler className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <p className="text-xs text-slate-500 mb-3">Réglage commun à tous les graphiques.</p>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-500">Axe des valeurs</Label>
          <Select
            value={yValue}
            onValueChange={(v) => set({ yTicks: v === 'auto' ? 'auto' : Number(v) })}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              {tickOptions.map(o => (
                <SelectItem key={o.count} value={String(o.count)}>
                  {o.count} graduations <span className="text-slate-500">({ticksPreview(o.axis.ticks)})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {ticksAdjusted && (
            <p className="text-xs text-amber-600">
              {wantedTicks} graduations ne tombent pas juste sur cette échelle : {usedTicks.count} utilisées.
            </p>
          )}
          <p className="text-xs text-slate-400">
            Sur un graphique d&apos;une autre échelle, le choix possible le plus proche est utilisé.
          </p>
        </div>

        <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-100">
          <Label className="text-xs font-medium text-slate-500">Axe des dates</Label>
          <Select value={value.xMode} onValueChange={(v) => set({ xMode: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="all">Tous les jours</SelectItem>
              <SelectItem value="every">Un jour sur N</SelectItem>
              <SelectItem value="weekdays">Jours de la semaine</SelectItem>
            </SelectContent>
          </Select>

          {value.xMode === 'every' && (
            <Select value={String(value.xEvery)} onValueChange={(v) => set({ xEvery: Number(v) })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {X_EVERY_CHOICES.map(n => (
                  <SelectItem key={n} value={String(n)}>Un jour sur {n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {value.xMode === 'weekdays' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                >
                  <span className="truncate">{weekdaysLabel}</span>
                  <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {WEEKDAYS.map(d => (
                  <DropdownMenuCheckboxItem
                    key={d.value}
                    checked={value.xWeekdays.includes(d.value)}
                    onCheckedChange={() => toggleWeekday(d.value)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {d.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {noDateShown && (
            <p className="text-xs text-amber-600">
              Aucun des jours choisis ne tombe dans la période : aucune date ne sera affichée.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
