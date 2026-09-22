import React, { useState, useMemo } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from 'lucide-react';

// Sélecteur d'athlètes avec recherche + filtre par club + filtre par groupe.
// - Admin : peut filtrer la liste par club (parmi tous ceux de l'appli) et/ou par groupe ;
//   "Tout sélectionner" ne sélectionne que les athlètes actuellement affichés (filtrés).
// - Coach lié à un club : pas de sélecteur "club", juste la liste (déjà limitée aux athlètes du club) + filtre groupe + "Tout sélectionner".
// - Coach indépendant : peut filtrer par un de ses propres groupes.
export default function AthleteAssignmentPicker({
  athletes = [],
  selected = [],
  onChange,
  isAdmin = false,
  coachClub = null,
  allGroups = [],
  allClubs = [],
  coachOwnGroups = [],
  idPrefix = 'athlete',
  emptyLabel = 'Aucun athlète disponible',
}) {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [clubFilter, setClubFilter] = useState('');

  const groupOptions = isAdmin ? allGroups : coachOwnGroups;

  const filteredAthletes = useMemo(() => {
    let list = athletes;
    if (clubFilter) {
      const club = allClubs.find(c => c.id === clubFilter);
      const clubEmails = new Set(club?.athlete_emails || []);
      list = list.filter(a => clubEmails.has(a.email));
    }
    if (groupFilter) {
      const group = groupOptions.find(g => g.id === groupFilter);
      const groupEmails = new Set(group?.athlete_emails || []);
      list = list.filter(a => groupEmails.has(a.email));
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(a =>
      (a.name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q)
    );
  }, [athletes, search, clubFilter, groupFilter, allClubs, groupOptions]);

  const allFilteredSelected = filteredAthletes.length > 0 && filteredAthletes.every(a => selected.includes(a.email));

  const toggleAthlete = (email) => {
    onChange(selected.includes(email) ? selected.filter(e => e !== email) : [...selected, email]);
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredEmails = new Set(filteredAthletes.map(a => a.email));
      onChange(selected.filter(e => !filteredEmails.has(e)));
    } else {
      const merged = new Set([...selected, ...filteredAthletes.map(a => a.email)]);
      onChange(Array.from(merged));
    }
  };

  const showGroupSelector = isAdmin ? groupOptions.length > 0 : (!coachClub && groupOptions.length > 0);
  const showClubSelector = isAdmin && allClubs.length > 0;

  return (
    <div>
      <Label className="mb-3 block">Athlètes assignés</Label>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un athlète..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleSelectAll}
          disabled={filteredAthletes.length === 0}
        >
          {allFilteredSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </Button>
        {showGroupSelector && (
          <Select
            value={groupFilter || '__all__'}
            onValueChange={(groupId) => setGroupFilter(groupId === '__all__' ? '' : groupId)}
          >
            <SelectTrigger className="w-48"><SelectValue placeholder="Filtrer par groupe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les groupes</SelectItem>
              {groupOptions.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {showClubSelector && (
          <Select
            value={clubFilter || '__all__'}
            onValueChange={(clubId) => setClubFilter(clubId === '__all__' ? '' : clubId)}
          >
            <SelectTrigger className="w-48"><SelectValue placeholder="Filtrer par club" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les clubs</SelectItem>
              {allClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
        {filteredAthletes.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            {athletes.length === 0 ? emptyLabel : 'Aucun athlète ne correspond à la recherche'}
          </p>
        ) : (
          filteredAthletes.map((athlete) => (
            <div key={athlete.email} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded">
              <Checkbox
                id={`${idPrefix}-${athlete.email}`}
                checked={selected.includes(athlete.email)}
                onCheckedChange={() => toggleAthlete(athlete.email)}
              />
              <Label htmlFor={`${idPrefix}-${athlete.email}`} className="flex-1 cursor-pointer">
                {athlete.name}
              </Label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
