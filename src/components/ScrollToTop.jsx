import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Remonte en haut de page à chaque arrivée sur une nouvelle page. Sans cela,
// le navigateur garde la position de défilement de la page précédente : on
// arrivait parfois au milieu de la page.
// Le bouton « retour » du navigateur (POP) garde sa position, et un simple
// changement de paramètres sur la même page (filtres dans l'adresse) ne fait
// pas remonter.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
