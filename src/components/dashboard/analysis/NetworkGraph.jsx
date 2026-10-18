import React, { useRef, useState } from 'react';

const WIDTH = 600;
const HEIGHT = 440;
const NODE_RADIUS = 20;

const shorten = (label, max = 16) => (label.length > max ? `${label.slice(0, max - 1)}…` : label);

// Graphe réseau en SVG : liens bleus (positifs) / rouges (négatifs), épaisseur
// proportionnelle au poids, bulles déplaçables à la souris ou au doigt.
export default function NetworkGraph({
  keys, labels, nodeColors, weights, positions, onMoveNode,
  edgeThreshold = 0, maxWeight, positiveColor = '#2563eb', negativeColor = '#dc2626',
}) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [hovered, setHovered] = useState(null);

  const maxW = maxWeight || Math.max(0.01, ...weights.flatMap(row => row.map(Math.abs)));
  const toPx = (pt) => ({ x: pt.x * WIDTH, y: pt.y * HEIGHT });

  const edges = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const w = weights[i][j];
      if (w !== 0 && Math.abs(w) >= edgeThreshold) edges.push({ i, j, w });
    }
  }
  // Les liens les plus forts sont dessinés par-dessus
  edges.sort((a, b) => Math.abs(a.w) - Math.abs(b.w));

  const eventToPoint = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.min(0.97, Math.max(0.03, (e.clientX - rect.left) / rect.width)),
      y: Math.min(0.95, Math.max(0.05, (e.clientY - rect.top) / rect.height)),
    };
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full h-auto select-none touch-none bg-slate-50/60 rounded-lg"
      onPointerMove={(e) => { if (dragging !== null) onMoveNode(keys[dragging], eventToPoint(e)); }}
      onPointerUp={() => setDragging(null)}
      onPointerLeave={() => setDragging(null)}
    >
      {edges.map(({ i, j, w }) => {
        const a = toPx(positions[keys[i]]), b = toPx(positions[keys[j]]);
        const rel = Math.abs(w) / maxW;
        const active = hovered === null || hovered === i || hovered === j;
        return (
          <line
            key={`${i}-${j}`}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={w > 0 ? positiveColor : negativeColor}
            strokeWidth={1 + 9 * rel}
            strokeOpacity={active ? 0.25 + 0.7 * rel : 0.06}
            strokeLinecap="round"
          >
            <title>{`${labels[keys[i]]} — ${labels[keys[j]]} : ${w.toFixed(2).replace('.', ',')}`}</title>
          </line>
        );
      })}
      {keys.map((key, i) => {
        const pt = toPx(positions[key]);
        return (
          <g
            key={key}
            transform={`translate(${pt.x}, ${pt.y})`}
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => { e.currentTarget.ownerSVGElement.setPointerCapture?.(e.pointerId); setDragging(i); }}
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered(null)}
          >
            <title>{labels[key]}</title>
            <circle r={NODE_RADIUS} fill={nodeColors[key]} stroke="white" strokeWidth={3} />
            <text textAnchor="middle" dy="0.35em" fontSize={11} fontWeight={700} fill="white" pointerEvents="none">
              {i + 1}
            </text>
            <text
              textAnchor="middle"
              y={NODE_RADIUS + 13}
              fontSize={11}
              fill="#334155"
              stroke="white"
              strokeWidth={3}
              paintOrder="stroke"
              pointerEvents="none"
            >
              {shorten(labels[key])}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
