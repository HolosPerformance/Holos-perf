import React from 'react';
import { Badge } from "@/components/ui/badge";

function resolveResponseValue(value, question) {
  if (value === undefined || value === null) return '—';
  if (question.type === 'select') {
    const choices = question.selectOptions?.choices || [];
    const arr = Array.isArray(value) ? value : [value];
    const labels = arr.map(v => {
      const i = parseInt(v, 10);
      if (!isNaN(i) && choices[i] !== undefined) return choices[i].label ?? v;
      return v;
    });
    return labels.join(', ');
  }
  if (question.type === 'scale') {
    return `${value}`;
  }
  if (question.type === 'textarea' || question.type === 'text') {
    const str = String(value);
    return str.length > 40 ? str.slice(0, 38) + '…' : str;
  }
  return String(value);
}

function ScaleCell({ value, question }) {
  if (value === undefined || value === null) return <span className="text-slate-300">—</span>;
  const min = question.scaleOptions?.min ?? 0;
  const max = question.scaleOptions?.max ?? 100;
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 50;
  const color = question.scaleOptions?.color || '#6366f1';
  return (
    <div className="flex flex-col items-center gap-1 min-w-[48px]">
      <span className="text-sm font-semibold" style={{ color }}>{value}</span>
      <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// Tableau de réponses à un questionnaire : athlètes en lignes, questions en colonnes.
export default function ResponseTable({ template, athletes, responses }) {
  const questions = template.questions || [];
  if (questions.length === 0) return null;

  const responseByEmail = {};
  responses.forEach(r => {
    if (r.template_id === template.id) responseByEmail[r.athlete_email] = r;
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      <table className="w-full min-w-max text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left font-semibold text-slate-700 px-4 py-3 border-b border-slate-200 sticky left-0 bg-slate-50 min-w-[140px] z-10">
              Athlète
            </th>
            {questions.map(q => (
              <th
                key={q.id}
                className="text-center font-medium text-slate-600 px-3 py-3 border-b border-slate-200 whitespace-nowrap max-w-[120px]"
                title={q.label}
              >
                <span className="block truncate max-w-[110px]">
                  {q.athleteLabel || q.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {athletes.map((athlete, i) => {
            const response = responseByEmail[athlete.email];
            return (
              <tr
                key={athlete.email}
                className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
              >
                <td className="px-4 py-3 border-b border-slate-100 sticky left-0 bg-inherit z-10">
                  <span className="font-medium text-slate-800 whitespace-nowrap">
                    {athlete.name}
                  </span>
                  {!response && (
                    <Badge variant="outline" className="ml-2 text-xs text-slate-400 border-slate-200">
                      Pas répondu
                    </Badge>
                  )}
                </td>
                {questions.map(q => (
                  <td key={q.id} className="px-3 py-3 border-b border-slate-100 text-center">
                    {response ? (
                      q.type === 'scale' ? (
                        <ScaleCell value={response.responses?.[q.id]} question={q} />
                      ) : (
                        <span className="text-slate-700">
                          {resolveResponseValue(response.responses?.[q.id], q)}
                        </span>
                      )
                    ) : (
                      <span className="text-slate-200">—</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
