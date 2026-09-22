import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from 'lucide-react';
import { parseISO, isAfter, differenceInDays } from 'date-fns';

const calculateStats = (values) => {
  if (values.length === 0) return null;
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;
  
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  
  const deciles = {};
  for (let i = 1; i <= 9; i++) {
    const index = Math.ceil((i / 10) * sorted.length) - 1;
    deciles[`P${i}0`] = sorted[Math.max(0, index)];
  }
  
  return {
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    min,
    max,
    ...deciles,
    count: values.length
  };
};

export default function SummaryStatsTable({ data, metricLabels = {}, metricColors = {}, startDate, endDate, sessionTypeFilters = ['entrainement', 'competition', 'effort_type', 'off'] }) {
  const [showPercentiles, setShowPercentiles] = useState(false);

  const filteredData = data.filter(log => {
    const logDate = parseISO(log.training_date);
    const matchesSessionType = sessionTypeFilters.includes(log.session_type);
    
    if (!startDate || !endDate) return matchesSessionType;
    
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const inDateRange = isAfter(logDate, start) && logDate <= end;
    
    return matchesSessionType && inDateRange;
  });

  const missedDays = startDate && endDate && filteredData.length > 0
    ? Math.max(0, differenceInDays(parseISO(endDate), parseISO(startDate)) + 1 - filteredData.length)
    : 0;

  const metricsToDisplay = Object.keys(metricLabels).filter(key =>
    filteredData.some(log => typeof log[key] === 'number')
  );
  
  const statsData = metricsToDisplay.map(metric => {
    const values = filteredData.map(d => d[metric]).filter(v => v != null);
    const stats = calculateStats(values);
    return { metric, stats };
  }).filter(item => item.stats !== null);

  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Tableau récapitulatif</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="mb-4 flex gap-6 text-sm">
          <span className="text-slate-600">
            <span className="font-semibold text-slate-800">{filteredData.length}</span> saisies
          </span>
          {startDate && endDate && (
            <span className="text-slate-600">
              <span className="font-semibold text-slate-800">{missedDays}</span> jours manqués
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold w-32">Statistique</TableHead>
                {statsData.map(({ metric }) => (
                  <TableHead key={metric} className="text-center w-32">
                    {metricLabels[metric]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-slate-50">
                <TableCell className="font-medium w-32">N</TableCell>
                {statsData.map(({ metric, stats }) => (
                  <TableCell key={metric} className="text-center text-slate-600 w-32">{stats.count}</TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50">
                <TableCell className="font-medium w-32">Moyenne</TableCell>
                {statsData.map(({ metric, stats }) => (
                  <TableCell key={metric} className="text-center font-semibold w-32">{stats.mean}</TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50">
                <TableCell className="font-medium w-32">Médiane</TableCell>
                {statsData.map(({ metric, stats }) => (
                  <TableCell key={metric} className="text-center font-semibold w-32">{stats.median}</TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50">
                <TableCell className="font-medium w-32">Min</TableCell>
                {statsData.map(({ metric, stats }) => (
                  <TableCell key={metric} className="text-center text-green-600 font-medium w-32">{stats.min}</TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-slate-50">
                <TableCell className="font-medium w-32">Max</TableCell>
                {statsData.map(({ metric, stats }) => (
                  <TableCell key={metric} className="text-center text-red-600 font-medium w-32">{stats.max}</TableCell>
                ))}
              </TableRow>
              {!showPercentiles && (
                <TableRow>
                  <TableCell colSpan={statsData.length + 1} className="py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPercentiles(true)}
                      className="gap-2 text-slate-500 hover:text-slate-700 text-xs w-full justify-center"
                    >
                      <ChevronDown className="w-3 h-3" />
                      Afficher plus
                    </Button>
                  </TableCell>
                </TableRow>
              )}
              {showPercentiles ? [
                ...[10, 20, 30, 40, 50, 60, 70, 80, 90].map(p => (
                  <TableRow key={`P${p}`} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-xs w-32">P{p}</TableCell>
                    {statsData.map(({ metric, stats }) => (
                      <TableCell key={metric} className="text-center text-xs text-slate-500 w-32">{stats[`P${p}`]}</TableCell>
                    ))}
                  </TableRow>
                )),
                <TableRow key="hide-btn">
                  <TableCell colSpan={statsData.length + 1} className="py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPercentiles(false)}
                      className="gap-2 text-slate-500 hover:text-slate-700 text-xs w-full justify-center"
                    >
                      <ChevronUp className="w-3 h-3" />
                      Masquer
                    </Button>
                  </TableCell>
                </TableRow>
              ] : null}
            </TableBody>
          </Table>
        </div>

        {statsData.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-slate-500">Aucune donnée pour cette période</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}