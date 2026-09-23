import React, { useState } from 'react';
import { Layers, Share2 } from 'lucide-react';
import { CollapsibleAnalysis } from './AnalysisParts';
import EfaPanel from './EfaPanel';
import NetworkPanel from './NetworkPanel';
import useAnalysisSettings from './useAnalysisSettings';

// Menus repliables « AFE » et « Analyse réseau » du Coach Dashboard.
// Les calculs ne tournent que lorsque le menu est ouvert.
export default function AdvancedAnalyses({
  user, periodLogs, athleteLogs, metricLabels, metricColors, sessionTypeLabels, globalFilters,
}) {
  const [settings, updateSection] = useAnalysisSettings(user);
  const [openEfa, setOpenEfa] = useState(false);
  const [openNetwork, setOpenNetwork] = useState(false);

  return (
    <>
      <CollapsibleAnalysis title="AFE" badge="analyse factorielle exploratoire" icon={Layers} open={openEfa} onToggle={() => setOpenEfa(v => !v)}>
        <EfaPanel
          logs={periodLogs}
          metricLabels={metricLabels}
          settings={settings.efa}
          onChange={(patch) => updateSection('efa', patch)}
        />
      </CollapsibleAnalysis>
      <CollapsibleAnalysis title="Analyse réseau" icon={Share2} open={openNetwork} onToggle={() => setOpenNetwork(v => !v)}>
        <NetworkPanel
          periodLogs={periodLogs}
          athleteLogs={athleteLogs}
          metricLabels={metricLabels}
          metricColors={metricColors}
          sessionTypeLabels={sessionTypeLabels}
          globalFilters={globalFilters}
          settings={settings.network}
          onChange={(patch) => updateSection('network', patch)}
          efaSettings={settings.efa}
        />
      </CollapsibleAnalysis>
    </>
  );
}
