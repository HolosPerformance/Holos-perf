import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW registration failed:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// La pastille de l'icône signale un rappel non vu : l'ouverture de l'app la lève.
// Placé APRÈS le rendu et entièrement encapsulé : l'API peut être absente ou
// lever selon les autorisations, et cela ne doit jamais empêcher l'affichage.
const clearAppBadge = () => {
  try {
    const result = navigator.clearAppBadge?.();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch (_) {
    // Pastille non supportée ou refusée : sans conséquence.
  }
};

clearAppBadge();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') clearAppBadge();
});
