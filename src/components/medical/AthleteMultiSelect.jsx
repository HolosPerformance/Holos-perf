import React, { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

/**
 * Menu déroulant « Athlètes » : recherche + cases à cocher.
 * `athletes` : [{ email, name }] proposés ; `excluded` : e-mails décochés
 * (aucun = tous sélectionnés, y compris les athlètes ajoutés ensuite).
 */
export default function AthleteMultiSelect({ athletes, excluded, onChange, className = '' }) {
  const [query, setQuery] = useState('');
  const excludedSet = new Set(excluded);
  const selectedCount = athletes.filter(a => !excludedSet.has(a.email)).length;
  const allSelected = selectedCount === athletes.length;

  const q = query.trim().toLowerCase();
  const visible = q
    ? athletes.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
    : athletes;

  const toggle = (email) => onChange(excludedSet.has(email)
    ? excluded.filter(e => e !== email)
    : [...excluded, email]);
  // Tout cocher / décocher agit sur les athlètes affichés par la recherche
  const visibleEmails = visible.map(a => a.email);
  const allVisibleSelected = visibleEmails.every(e => !excludedSet.has(e));
  const toggleVisible = () => onChange(allVisibleSelected
    ? [...new Set([...excluded, ...visibleEmails])]
    : excluded.filter(e => !visibleEmails.includes(e)));

  const summary = athletes.length === 0
    ? 'Aucun athlète'
    : allSelected
      ? `Tous les athlètes (${athletes.length})`
      : selectedCount === 0
        ? 'Aucun athlète sélectionné'
        : selectedCount === 1
          ? athletes.find(a => !excludedSet.has(a.email)).name
          : `${selectedCount} athlètes sur ${athletes.length}`;

  return (
    <Popover onOpenChange={(open) => { if (!open) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button type="button"
          className={`flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${className}`}>
          <span className="truncate">
            <span className="text-slate-500 mr-1">Athlètes :</span>{summary}
          </span>
          <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input autoFocus className="pl-9 h-8" placeholder="Rechercher un athlète…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </div>
        {visible.length > 0 && (
          <button type="button" onClick={toggleVisible}
            className="w-full text-left px-3 py-2 text-xs font-medium text-blue-600 hover:bg-slate-50 border-b">
            {allVisibleSelected ? 'Tout décocher' : 'Tout cocher'}{q ? ' (résultats de la recherche)' : ''}
          </button>
        )}
        <div className="max-h-72 overflow-y-auto py-1">
          {visible.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500 text-center">Aucun athlète trouvé</p>
          ) : visible.map(a => (
            <label key={a.email} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50">
              <Checkbox checked={!excludedSet.has(a.email)} onCheckedChange={() => toggle(a.email)} />
              <span className="truncate">{a.name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
