import { useEffect, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { DESIGN } from './gameDesign';
import { playTickSound } from './soundEffects';

/**
 * Countdown sincronizzato sulla deadline condivisa nello stato di gioco
 * (epoch ms, orologio dell'host). Ritorna i secondi rimanenti o null
 * quando il timer non è attivo.
 * Con `tick` attivo emette un tick sonoro negli ultimi 5 secondi.
 */
export const useTurnCountdown = (
  deadline: number | null | undefined,
  active: boolean,
  tick = false
): number | null => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!active || !deadline) {
      setSecondsLeft(null);
      return;
    }
    let lastTicked = -1;
    const update = () => {
      const s = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(s);
      if (tick && s > 0 && s <= 5 && s !== lastTicked) {
        playTickSound();
        lastTicked = s;
      }
    };
    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [deadline, active, tick]);

  return secondsLeft;
};

const urgentPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
`;

export const TimerChip = styled.span<{ urgent?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  color: ${props => (props.urgent ? DESIGN.colors.accents.pink : '#d4a017')};
  background: ${props => (props.urgent ? 'rgba(230,57,70,0.14)' : 'rgba(212,160,23,0.12)')};
  border: 1px solid ${props => (props.urgent ? DESIGN.colors.accents.pink : 'rgba(212,160,23,0.35)')};
  flex-shrink: 0;

  ${props =>
    props.urgent &&
    css`
      animation: ${urgentPulse} 0.8s ease-in-out infinite;
    `}
`;
