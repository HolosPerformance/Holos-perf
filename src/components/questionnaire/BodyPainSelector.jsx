import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const bodyParts = [
  { id: 'tete', label: 'Tête', cx: 100, cy: 40, r: 25 },
  { id: 'cou', label: 'Cou', x: 90, y: 60, width: 20, height: 15 },
  { id: 'epaule_gauche', label: 'Épaule G', cx: 70, cy: 85, r: 12 },
  { id: 'epaule_droite', label: 'Épaule D', cx: 130, cy: 85, r: 12 },
  { id: 'bras_gauche', label: 'Bras G', x: 50, y: 95, width: 15, height: 55, rx: 7 },
  { id: 'bras_droit', label: 'Bras D', x: 135, y: 95, width: 15, height: 55, rx: 7 },
  { id: 'coude_gauche', label: 'Coude G', cx: 57, cy: 155, r: 10 },
  { id: 'coude_droit', label: 'Coude D', cx: 143, cy: 155, r: 10 },
  { id: 'avant_bras_gauche', label: 'Avant-bras G', x: 50, y: 160, width: 14, height: 40, rx: 7 },
  { id: 'avant_bras_droit', label: 'Avant-bras D', x: 136, y: 160, width: 14, height: 40, rx: 7 },
  { id: 'poignet_gauche', label: 'Poignet G', cx: 57, cy: 205, r: 8 },
  { id: 'poignet_droit', label: 'Poignet D', cx: 143, cy: 205, r: 8 },
  { id: 'torse_haut', label: 'Torse haut', cx: 100, cy: 105, rx: 38, ry: 25 },
  { id: 'torse_bas', label: 'Abdomen', cx: 100, cy: 150, rx: 35, ry: 25 },
  { id: 'hanche', label: 'Hanche', x: 70, y: 170, width: 60, height: 20, rx: 10 },
  { id: 'cuisse_gauche', label: 'Cuisse G', x: 70, y: 190, width: 20, height: 55, rx: 8 },
  { id: 'cuisse_droite', label: 'Cuisse D', x: 110, y: 190, width: 20, height: 55, rx: 8 },
  { id: 'genou_gauche', label: 'Genou G', cx: 80, cy: 250, r: 11 },
  { id: 'genou_droit', label: 'Genou D', cx: 120, cy: 250, r: 11 },
  { id: 'mollet_gauche', label: 'Mollet G', x: 72, y: 260, width: 16, height: 50, rx: 8 },
  { id: 'mollet_droit', label: 'Mollet D', x: 112, y: 260, width: 16, height: 50, rx: 8 },
  { id: 'cheville_gauche', label: 'Cheville G', cx: 80, cy: 315, r: 9 },
  { id: 'cheville_droite', label: 'Cheville D', cx: 120, cy: 315, r: 9 },
  { id: 'pied_gauche', label: 'Pied G', cx: 80, cy: 335, rx: 12, ry: 18 },
  { id: 'pied_droit', label: 'Pied D', cx: 120, cy: 335, rx: 12, ry: 18 }
];

export default function BodyPainSelector({ value = {}, onChange }) {
  const [selectedZones, setSelectedZones] = useState(value || {});

  const handleZoneClick = (zoneId) => {
    const newZones = { ...selectedZones };
    if (newZones[zoneId]) {
      delete newZones[zoneId];
    } else {
      newZones[zoneId] = true;
    }
    setSelectedZones(newZones);
    onChange(newZones);
  };

  const clearAll = () => {
    setSelectedZones({});
    onChange({});
  };

  const selectedCount = Object.keys(selectedZones).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base">Zones douloureuses</Label>
        {selectedCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-red-600 hover:text-red-700"
          >
            <X className="w-4 h-4 mr-1" />
            Effacer ({selectedCount})
          </Button>
        )}
      </div>

      <div className="bg-slate-50 rounded-xl p-6">
        <p className="text-sm text-slate-600 mb-4 text-center">
          Clique sur les zones du corps qui te font mal
        </p>
        
        <div className="flex justify-center">
          <svg
            viewBox="0 0 200 360"
            className="w-40 h-72 cursor-pointer"
          >
            {bodyParts.map((part) => {
              const isSelected = selectedZones[part.id];
              const commonProps = {
                key: part.id,
                onClick: () => handleZoneClick(part.id),
                className: 'transition-all hover:opacity-80',
                fill: isSelected ? '#ef4444' : '#cbd5e1',
                stroke: isSelected ? '#dc2626' : '#94a3b8',
                strokeWidth: isSelected ? 2 : 1,
                opacity: isSelected ? 0.9 : 0.4,
              };

              if (part.r && !part.rx) {
                return <circle {...commonProps} cx={part.cx} cy={part.cy} r={part.r} />;
              } else if (part.rx && part.ry && part.cx && part.cy) {
                return <ellipse {...commonProps} cx={part.cx} cy={part.cy} rx={part.rx} ry={part.ry} />;
              } else {
                return <rect {...commonProps} x={part.x} y={part.y} width={part.width} height={part.height} rx={part.rx} />;
              }
            })}
          </svg>
        </div>

        {selectedCount > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {Object.keys(selectedZones).map((zoneId) => {
              const part = bodyParts.find(p => p.id === zoneId);
              return (
                <div
                  key={zoneId}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1"
                >
                  {part?.label}
                  <button
                    type="button"
                    onClick={() => handleZoneClick(zoneId)}
                    className="hover:bg-red-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}