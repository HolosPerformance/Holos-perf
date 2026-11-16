import React, { useState } from 'react';
import { formatPainValue, painScaleOf } from '@/lib/painZones';
import { responseTime } from '@/lib/questionnaireDay';

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
  if (question.type === 'body_pain') {
    const str = formatPainValue(value, painScaleOf(question));
    return str.length > 40 ? str.slice(0, 38) + '…' : str;
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
    <div className="flex flex-col items-center gap-1">
      <span className="text-sm font-semibold" style={{ color }}>{value}</span>
      <div className="w-8 sm:w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// Colonne « Athlète » figée à gauche : fond opaque (le contenu défile dessous)
// et ombre légère pour marquer la séparation
const stickyCell = 'sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]';
const athleteColWidth = 'w-[104px] min-w-[104px] max-w-[104px] sm:w-[180px] sm:min-w-[180px] sm:max-w-[180px]';
const questionColWidth = 'w-[72px] min-w-[72px] max-w-[72px] sm:w-[104px] sm:min-w-[104px] sm:max-w-[120px]';

// Tableau de réponses à un questionnaire : athlètes en lignes, questions en
// colonnes. Pensé pour le téléphone : colonne Athlète étroite (nom sur deux
// lignes, heure de réponse ou « pas répondu » dessous), intitulés sur deux
// lignes (toucher un intitulé l'affiche en entier), athlètes sans réponse
// grisés et placés en bas.
export default function ResponseTable({ template, athletes, responses }) {
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const questions = template.questions || [];
  if (questions.length === 0) return null;

  const responseByEmail = {};
  responses.forEach(r => {
    if (r.template_id === template.id) responseByEmail[r.athlete_email] = r;
  });

  // Ceux qui ont répondu d'abord, dans l'ordre reçu (alphabétique)
  const rows = [
    ...athletes.filter(a => responseByEmail[a.email]),
    ...athletes.filter(a => !responseByEmail[a.email]),
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      <table className="min-w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={`${stickyCell} ${athleteColWidth} bg-slate-50 text-left font-semibold text-slate-700 px-2 sm:px-4 py-2.5 border-b border-slate-200 align-bottom`}>
              Athlète
            </th>
            {questions.map(q => {
              const label = q.athleteLabel || q.label;
              const expanded = expandedQuestion === q.id;
              return (
                <th
                  key={q.id}
                  className={`${expanded ? 'min-w-[160px]' : questionColWidth} bg-slate-50 text-center font-medium text-slate-600 px-1.5 sm:px-2 py-2.5 border-b border-slate-200 align-bottom`}
                  title={q.label}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedQuestion(expanded ? null : q.id)}
                    className={`w-full text-xs sm:text-[13px] leading-tight break-words hover:text-slate-900 ${expanded ? '' : 'line-clamp-2'}`}
                    aria-label={`Intitulé complet : ${q.label || label}`}
                  >
                    {expanded ? (q.label || label) : label}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((athlete, i) => {
            const response = responseByEmail[athlete.email];
            const time = response ? responseTime(response) : null;
            // Fond opaque, y compris pour la cellule figée
            const rowBg = !response ? 'bg-slate-100' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50';
            return (
              <tr key={athlete.email} className={response ? '' : 'text-slate-400'}>
                <td className={`${stickyCell} ${athleteColWidth} ${rowBg} px-2 sm:px-4 py-2 border-b border-slate-100`}>
                  <span className={`block text-[13px] sm:text-sm font-medium leading-tight break-words ${response ? 'text-slate-800' : 'text-slate-500'}`}>
                    {athlete.name}
                  </span>
                  {!response ? (
                    <span className="block text-[11px] text-slate-400 mt-0.5">pas répondu</span>
                  ) : time ? (
                    <span className="block text-[11px] text-slate-500 tabular-nums mt-0.5">{time}</span>
                  ) : (
                    <span className="block text-[11px] text-slate-400 mt-0.5" title="Réponse saisie après coup : heure inconnue">après coup</span>
                  )}
                </td>
                {questions.map(q => (
                  <td key={q.id} className={`${rowBg} px-1.5 sm:px-2 py-2 border-b border-slate-100 text-center`}>
                    {response ? (
                      q.type === 'scale' ? (
                        <ScaleCell value={response.responses?.[q.id]} question={q} />
                      ) : (
                        <span className="text-xs sm:text-sm text-slate-700 break-words">
                          {resolveResponseValue(response.responses?.[q.id], q)}
                        </span>
                      )
                    ) : (
                      <span className="text-slate-300">—</span>
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
