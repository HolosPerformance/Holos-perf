import React, { useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, BarChart, Bar, ReferenceLine
} from 'recharts';
import { Activity, ArrowLeft, RefreshCw, Loader2, AlertCircle, Zap, Search } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const METRICS = [
  { key: 'distance_km', label: 'Distance (km)', color: '#3b82f6', unit: 'km' },
  { key: 'avg_speed_kmh', label: 'Vitesse moyenne (km/h)', color: '#10b981', unit: 'km/h' },
  { key: 'max_speed_kmh', label: 'Vitesse maximale (km/h)', color: '#f59e0b', unit: 'km/h' },
  { key: 'average_heartrate', label: 'FC moyenne (bpm)', color: '#ef4444', unit: 'bpm' },
  { key: 'max_heartrate', label: 'FC maximale (bpm)', color: '#f43f5e', unit: 'bpm' },
  { key: 'moving_time_min', label: 'Durée (min)', color: '#8b5cf6', unit: 'min' },
];

function calcMovingAvg(data, key, n) {
  return data.map((d, i) => {
    if (i < n - 1) return null;
    const slice = data.slice(i - n + 1, i + 1);
    const vals = slice.map(s => s[key]).filter(v => v != null);
    return vals.length > 0 ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;
  });
}

const getDefaultDates = () => {
  const end = new Date();
  const start = subDays(end, 60);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
};

export default function ObjectiveData() {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stravaConnected, setStravaConnected] = useState(true);
  const [startDate, setStartDate] = useState(() => getDefaultDates().start);
  const [endDate, setEndDate] = useState(() => getDefaultDates().end);
  const [selectedMetrics, setSelectedMetrics] = useState(['distance_km', 'avg_speed_kmh', 'average_heartrate']);
  const [activityTypeFilter, setActivityTypeFilter] = useState('all');
  const [showMME7, setShowMME7] = useState(true);
  const [showMME21, setShowMME21] = useState(true);

  // For coaches/admins: athlete selector
  const [selectionMode, setSelectionMode] = useState('all');
  const [selectedAthleteEmails, setSelectedAthleteEmails] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [athleteSearchQuery, setAthleteSearchQuery] = useState('');

  const isAdmin = user?.user_status === 'admin';
  const isCoach = user?.user_status === 'coach' || user?.user_status === 'coach_pro';

  const { data: allGroups = [] } = useQuery({
    queryKey: ['groups-objective', user?.email],
    queryFn: async () => {
      if (isAdmin) return await base44.entities.Group.list();
      if (isCoach) return await base44.entities.Group.filter({ coach_email: user.email });
      return [];
    },
    enabled: !!user && (isAdmin || isCoach),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-objective'],
    queryFn: async () => await base44.entities.User.list(),
    enabled: !!user && (isAdmin || isCoach),
  });

  const { data: coachClub } = useQuery({
    queryKey: ['coach-club-objective', user?.email],
    queryFn: async () => {
      const clubs = await base44.entities.Club.list();
      return clubs.find(c => (c.coach_emails || []).includes(user.email)) || null;
    },
    enabled: !!user?.email && isCoach,
  });

  const { data: stravaTokens = [] } = useQuery({
    queryKey: ['strava-tokens-objective'],
    queryFn: async () => await base44.entities.StravaToken.list(),
    enabled: !!user && (isAdmin || isCoach),
  });

  const urlParams = new URLSearchParams(window.location.search);
  const isIndividualView = urlParams.get('view') === 'individual';

  // Utiliser user_id pour la correspondance (plus fiable que l'email)
  const connectedUserIds = new Set(stravaTokens.map(t => t.user_id).filter(Boolean));
  const connectedEmails = new Set(stravaTokens.map(t => t.athlete_email));

  const selectableAthletes = (() => {
    if (isAdmin) {
      return allUsers.filter(u => u.user_status === 'athlete' && (connectedUserIds.has(u.id) || connectedEmails.has(u.email)))
        .map(u => ({ email: u.email, name: u.full_name || u.email, id: u.id }));
    } else if (isCoach) {
      let emails = [];
      if (coachClub && !isIndividualView) {
        emails = coachClub.athlete_emails || [];
      } else {
        const coachGroup = allGroups[0];
        emails = coachGroup?.athlete_emails || [];
      }
      return emails
        .map(email => {
          const u = allUsers.find(u => u.email === email);
          return u ? { email, name: u.full_name || email, id: u.id } : null;
        })
        .filter(a => a && (connectedUserIds.has(a.id) || connectedEmails.has(a.email)));
    }
    return [];
  })();

  const getTargetEmails = () => {
    if (!isCoach && !isAdmin) return [null]; // athlete: own data
    if (selectionMode === 'athletes' && selectedAthleteEmails.length > 0) return selectedAthleteEmails;
    if (selectionMode === 'group' && selectedGroupId) {
      const group = allGroups.find(g => g.id === selectedGroupId);
      return (group?.athlete_emails || []).filter(e => connectedEmails.has(e));
    }
    return selectableAthletes.map(a => a.email);
  };

  const fetchActivities = async () => {
    setLoading(true);
    setError(null);
    try {
      const targetEmails = getTargetEmails();
      if (targetEmails.length === 0) {
        setActivities([]);
        setLoading(false);
        return;
      }
      const allActivities = [];
      for (const email of targetEmails) {
        const athlete = selectableAthletes.find(a => a.email === email);
        const res = await base44.functions.invoke('getStravaActivities', {
          start_date: startDate,
          end_date: endDate,
          per_page: 200,
          athlete_email: email || undefined,
          user_id: athlete?.id || undefined,
        });
        if (!res.data?.not_connected && !res.data?.error) {
          const raw = res.data?.activities || [];
          raw.forEach(a => {
            allActivities.push({
              ...a,
              athlete_email: email,
              athlete_name: selectableAthletes.find(s => s.email === email)?.name || email,
              dateLabel: format(new Date(a.start_date_local || a.start_date), 'dd/MM', { locale: fr }),
              date: format(new Date(a.start_date_local || a.start_date), 'yyyy-MM-dd'),
              distance_km: a.distance ? parseFloat((a.distance / 1000).toFixed(2)) : null,
              avg_speed_kmh: a.average_speed ? parseFloat((a.average_speed * 3.6).toFixed(2)) : null,
              max_speed_kmh: a.max_speed ? parseFloat((a.max_speed * 3.6).toFixed(2)) : null,
              moving_time_min: a.moving_time ? Math.round(a.moving_time / 60) : null,
            });
          });
        }
      }
      if (allActivities.length === 0 && targetEmails.length === 1 && targetEmails[0] === null) {
        setStravaConnected(false);
      } else {
        setStravaConnected(true);
        setActivities(allActivities.sort((a, b) => new Date(a.date) - new Date(b.date)));
      }
    } catch (err) {
      setStravaConnected(false);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchActivities();
  }, [user, startDate, endDate, selectionMode, selectedAthleteEmails, selectedGroupId, selectableAthletes.length]);

  const activityTypes = [...new Set(activities.map(a => a.type).filter(Boolean))];

  const filteredActivities = activityTypeFilter === 'all'
    ? activities
    : activities.filter(a => a.type === activityTypeFilter);

  // Build chart data with MME7 and MME21
  const chartData = filteredActivities.map((a, i) => {
    const point = { dateLabel: a.dateLabel, date: a.date, name: a.name };
    METRICS.forEach(m => { point[m.key] = a[m.key]; });
    return point;
  });

  METRICS.forEach(m => {
    const mme7 = calcMovingAvg(chartData, m.key, 7);
    const mme21 = calcMovingAvg(chartData, m.key, 21);
    chartData.forEach((d, i) => {
      d[`${m.key}_mme7`] = mme7[i];
      d[`${m.key}_mme21`] = mme21[i];
    });
  });

  const toggleMetric = (key) => {
    setSelectedMetrics(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const getReturnUrl = () => {
    if (!user) return createPageUrl('Home');
    if (user.user_status === 'admin') return createPageUrl('AdminHome');
    if (user.user_status === 'coach' || user.user_status === 'coach_pro') return createPageUrl('CoachHome');
    return createPageUrl('AthleteHome');
  };

  const isCoachOrAdmin = isAdmin || isCoach;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Bloquer l'accès si l'athlète n'a pas la permission
  if (user.user_status === 'athlete' && user.can_access_objective_data_page === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Accès restreint</h2>
          <p className="text-slate-500 mb-4">Vous n'avez pas accès à cette page.</p>
          <Link to={createPageUrl('AthleteHome')}>
            <Button variant="outline">Retour à l'accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
              <Zap className="w-7 h-7 text-orange-500" />
              Données Objectives
            </h1>
            <p className="text-slate-500 mt-1">Activités Strava — performances réelles</p>
          </div>
          <div className="flex items-center gap-3">
            {(!isCoachOrAdmin || user?.can_access_subjective_data_page !== false) && (
            <Link to={isCoachOrAdmin ? createPageUrl('CoachDashboard') : createPageUrl('PersonalDashboard')}>
              <Button variant="outline" className="gap-2 border-green-300 text-green-600 hover:bg-green-50">
                <ArrowLeft className="w-4 h-4" />
                Données Subjectives
              </Button>
            </Link>
            )}
            <Button onClick={fetchActivities} variant="outline" className="gap-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Actualiser
            </Button>
          </div>
        </div>

        {/* Strava not connected */}
        {!stravaConnected && (
          <Card className="border-orange-200 bg-orange-50 mb-6">
            <CardContent className="p-6 flex items-center gap-4">
              <AlertCircle className="w-8 h-8 text-orange-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-800">Compte Strava non connecté</p>
                <p className="text-sm text-orange-700 mt-1">
                  Connectez votre compte Strava dans les <Link to="/Settings" className="underline font-medium">Paramètres</Link> pour voir vos données.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Athlete selector for coaches/admins */}
        {(isAdmin || isCoach) && (
          <Card className="shadow-lg border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-indigo-900">🎯 Sélection d'athlète</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <Label className="text-sm font-medium text-slate-700">Mode :</Label>
                  <div className="flex gap-2">
                    <Button variant={selectionMode === 'all' ? 'default' : 'outline'} size="sm"
                      onClick={() => { setSelectionMode('all'); setSelectedAthleteEmails([]); setSelectedGroupId(null); }}
                      className={selectionMode === 'all' ? 'bg-slate-800' : ''}>
                      Tous
                    </Button>
                    <Button variant={selectionMode === 'athletes' ? 'default' : 'outline'} size="sm"
                      onClick={() => { setSelectionMode('athletes'); setSelectedGroupId(null); }}
                      className={selectionMode === 'athletes' ? 'bg-slate-800' : ''}>
                      Athlètes
                    </Button>
                    {allGroups.length > 0 && (
                      <Button variant={selectionMode === 'group' ? 'default' : 'outline'} size="sm"
                        onClick={() => { setSelectionMode('group'); setSelectedAthleteEmails([]); }}
                        className={selectionMode === 'group' ? 'bg-slate-800' : ''}>
                        Groupe
                      </Button>
                    )}
                  </div>
                </div>

                {selectionMode === 'athletes' && (
                  <div className="flex items-start gap-4">
                    <Label className="text-sm font-medium text-slate-700 whitespace-nowrap mt-3">Athlètes :</Label>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Search className="w-4 h-4 text-slate-400" />
                        <Input placeholder="Rechercher un athlète..." value={athleteSearchQuery}
                          onChange={e => setAthleteSearchQuery(e.target.value)} className="h-9" />
                      </div>
                      <div className="border border-slate-200 rounded-lg p-3 bg-white max-h-48 overflow-y-auto">
                        {selectableAthletes.length > 0 ? selectableAthletes
                          .filter(a => !athleteSearchQuery || a.name.toLowerCase().includes(athleteSearchQuery.toLowerCase()) || a.email.toLowerCase().includes(athleteSearchQuery.toLowerCase()))
                          .map(athlete => (
                            <div key={athlete.email} className="flex items-center gap-2 py-1">
                              <Checkbox id={`oa-${athlete.email}`}
                                checked={selectedAthleteEmails.includes(athlete.email)}
                                onCheckedChange={checked => {
                                  if (checked) setSelectedAthleteEmails(prev => [...prev, athlete.email]);
                                  else setSelectedAthleteEmails(prev => prev.filter(e => e !== athlete.email));
                                }} />
                              <Label htmlFor={`oa-${athlete.email}`} className="text-sm cursor-pointer">{athlete.name}</Label>
                            </div>
                          )) : <div className="text-sm text-amber-700">Aucun athlète connecté à Strava</div>}
                      </div>
                      {selectedAthleteEmails.length > 0 && (
                        <p className="text-sm text-indigo-700 font-medium">✓ {selectedAthleteEmails.length} athlète(s) sélectionné(s)</p>
                      )}
                    </div>
                  </div>
                )}

                {selectionMode === 'group' && allGroups.length > 0 && (
                  <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">Groupe :</Label>
                    <Select value={selectedGroupId || 'none'} onValueChange={v => setSelectedGroupId(v === 'none' ? null : v)}>
                      <SelectTrigger className="h-11 bg-white border-indigo-300 max-w-md">
                        <SelectValue placeholder="Sélectionner un groupe..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sélectionner un groupe...</SelectItem>
                        {allGroups.map(g => (
                          <SelectItem key={g.id} value={g.id}>{g.name} ({g.athlete_emails?.length || 0} athlètes)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="shadow-sm border-0 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-slate-700">Du :</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-40" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-slate-700">Au :</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-40" />
              </div>
              {activityTypes.length > 0 && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-slate-700">Type :</Label>
                  <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                    <SelectTrigger className="h-9 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      {activityTypes.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <Card className="shadow-sm border-0">
            <CardContent className="p-12 text-center">
              <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Aucune activité trouvée</h3>
              <p className="text-slate-500 text-sm">
                {stravaConnected
                  ? 'Aucune activité Strava sur cette période. Élargissez la plage de dates.'
                  : 'Connectez votre compte Strava pour voir vos données.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats résumé */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-slate-500 mb-1">Activités</p>
                  <p className="text-2xl font-bold text-slate-800">{filteredActivities.length}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-slate-500 mb-1">Distance totale</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {filteredActivities.reduce((s, a) => s + (a.distance_km || 0), 0).toFixed(1)} km
                  </p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-slate-500 mb-1">Vitesse moy. globale</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {(filteredActivities.filter(a => a.avg_speed_kmh).reduce((s, a) => s + a.avg_speed_kmh, 0) /
                      (filteredActivities.filter(a => a.avg_speed_kmh).length || 1)).toFixed(1)} km/h
                  </p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-slate-500 mb-1">FC moy. globale</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {Math.round(filteredActivities.filter(a => a.average_heartrate).reduce((s, a) => s + a.average_heartrate, 0) /
                      (filteredActivities.filter(a => a.average_heartrate).length || 1)) || '—'} bpm
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Metric Selector */}
            <Card className="shadow-sm border-0 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-slate-800 mb-3">Indicateurs à afficher</h3>
                <div className="flex flex-wrap gap-4">
                  {METRICS.map(m => (
                    <div key={m.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`metric-${m.key}`}
                        checked={selectedMetrics.includes(m.key)}
                        onCheckedChange={() => toggleMetric(m.key)}
                      />
                      <Label htmlFor={`metric-${m.key}`} className="text-sm cursor-pointer flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: m.color }} />
                        {m.label}
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                  <p className="text-sm font-medium text-slate-700">Moyennes mobiles :</p>
                  <div className="flex items-center gap-2">
                    <Checkbox id="mme7" checked={showMME7} onCheckedChange={setShowMME7} />
                    <Label htmlFor="mme7" className="text-sm cursor-pointer">MME7 (---)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="mme21" checked={showMME21} onCheckedChange={setShowMME21} />
                    <Label htmlFor="mme21" className="text-sm cursor-pointer">MME21 (···)</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scatter / Line Chart */}
            {selectedMetrics.length > 0 && (
              <Card className="shadow-sm border-0 mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Évolution des activités</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        formatter={(value, name) => {
                          if (value == null) return ['—', name];
                          const metric = METRICS.find(m => m.key === name || name.startsWith(m.key));
                          return [value + (metric?.unit ? ` ${metric.unit}` : ''), name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {METRICS.filter(m => selectedMetrics.includes(m.key)).map(m => (
                        <React.Fragment key={m.key}>
                          <Scatter
                            dataKey={m.key}
                            name={m.label}
                            fill={m.color}
                            line={{ stroke: m.color, strokeWidth: 1.5, strokeOpacity: 0.4 }}
                            shape="circle"
                            r={4}
                          />
                          {showMME7 && (
                            <Line
                              dataKey={`${m.key}_mme7`}
                              name={`${m.label} MME7`}
                              stroke={m.color}
                              strokeWidth={2}
                              strokeDasharray="6 3"
                              dot={false}
                              connectNulls={false}
                              legendType="none"
                            />
                          )}
                          {showMME21 && (
                            <Line
                              dataKey={`${m.key}_mme21`}
                              name={`${m.label} MME21`}
                              stroke={m.color}
                              strokeWidth={2.5}
                              strokeDasharray="2 4"
                              dot={false}
                              connectNulls={false}
                              legendType="none"
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    Points = valeurs réelles · tirets courts = MME7 · pointillés = MME21
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Histograms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {METRICS.map(m => {
                const vals = filteredActivities.map(a => a[m.key]).filter(v => v != null);
                if (vals.length === 0) return null;
                const min = Math.min(...vals);
                const max = Math.max(...vals);
                const bucketCount = Math.min(15, Math.ceil(Math.sqrt(vals.length)));
                const bucketSize = (max - min) / bucketCount || 1;
                const buckets = Array.from({ length: bucketCount }, (_, i) => {
                  const from = min + i * bucketSize;
                  const to = from + bucketSize;
                  return {
                    label: `${from.toFixed(1)}`,
                    count: vals.filter(v => v >= from && (i === bucketCount - 1 ? v <= to : v < to)).length
                  };
                });
                const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

                return (
                  <Card key={m.key} className="shadow-sm border-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: m.color }} />
                        {m.label}
                        <Badge variant="secondary" className="ml-auto text-xs">
                          moy: {avg.toFixed(1)} {m.unit}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={buckets} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={Math.floor(bucketCount / 5)} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v) => [v, 'activités']} />
                          <Bar dataKey="count" fill={m.color} radius={[2, 2, 0, 0]} opacity={0.85} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Data Table */}
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Détail des activités</CardTitle>
                  <Badge variant="secondary">{filteredActivities.length} activités</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-xs">
                        <th className="px-3 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-left font-medium">Activité</th>
                        <th className="px-3 py-2 text-center font-medium">Type</th>
                        <th className="px-3 py-2 text-center font-medium">Dist. (km)</th>
                        <th className="px-3 py-2 text-center font-medium">Durée (min)</th>
                        <th className="px-3 py-2 text-center font-medium">V. moy (km/h)</th>
                        <th className="px-3 py-2 text-center font-medium">V. max (km/h)</th>
                        <th className="px-3 py-2 text-center font-medium">FC moy (bpm)</th>
                        <th className="px-3 py-2 text-center font-medium">FC max (bpm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...filteredActivities].reverse().slice(0, 30).map((a, i) => (
                        <tr key={a.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-700">
                            {format(new Date(a.start_date_local || a.start_date), 'dd/MM/yyyy', { locale: fr })}
                          </td>
                          <td className="px-3 py-2 text-slate-600 max-w-[150px] truncate">{a.name}</td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant="secondary" className="text-xs">{a.type}</Badge>
                          </td>
                          <td className="px-3 py-2 text-center text-slate-700">{a.distance_km ?? '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-700">{a.moving_time_min ?? '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-700">{a.avg_speed_kmh ?? '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-700">{a.max_speed_kmh ?? '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-700">{a.average_heartrate ?? '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-700">{a.max_heartrate ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredActivities.length > 30 && (
                    <p className="text-center text-xs text-slate-400 mt-3">
                      Affichage des 30 dernières activités sur {filteredActivities.length}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}