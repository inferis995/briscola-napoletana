import { useEffect, useRef, useState } from 'react';

/**
 * Anima un numero verso il valore target (easing cubico in uscita).
 * Usato per il contatore punti: quando vinci una presa il punteggio
 * "corre" fino al nuovo valore invece di scattare.
 */
export const useCountUp = (target: number, duration = 700): number => {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    if (from === target) return;
    prevRef.current = target;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
};
