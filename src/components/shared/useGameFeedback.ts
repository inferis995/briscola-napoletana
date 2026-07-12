import { useEffect, useRef } from 'react';
import { GameState } from '@/game/BaseGameLogic';
import {
  playTurnSound,
  playTrickWonSound,
  playTrickLostSound,
  playVictorySound,
  playDefeatSound,
  playNeutralChime,
  vibrate,
} from './soundEffects';

/**
 * Feedback audio/tattile condiviso tra UI desktop e mobile:
 * - "è il tuo turno" (suono + vibrazione)
 * - esito della presa (vinta/persa, anche di squadra)
 * - fine partita (vittoria/sconfitta/pareggio) e fine smazzata
 */
export const useGameFeedback = (
  gameState: GameState,
  currentPlayerId: string,
  isMyTurn: boolean
): void => {
  // È il tuo turno
  const prevMyTurnRef = useRef(isMyTurn);
  useEffect(() => {
    if (isMyTurn && !prevMyTurnRef.current) {
      playTurnSound();
      vibrate(60);
    }
    prevMyTurnRef.current = isMyTurn;
  }, [isMyTurn]);

  // Esito della presa (leggero ritardo per allinearsi al glow del vincitore)
  useEffect(() => {
    if (gameState.phase !== 'round_complete' || !gameState.roundWinnerId) return;
    const winner = gameState.roundWinnerId;
    const teams = gameState.teams;
    const iWon =
      winner === currentPlayerId ||
      (!!teams && teams[winner] != null && teams[winner] === teams[currentPlayerId]);
    const timer = setTimeout(() => {
      if (iWon) {
        playTrickWonSound();
        vibrate([30, 40, 30]);
      } else {
        playTrickLostSound();
      }
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.phase, gameState.roundNumber]);

  // Fine partita / fine smazzata
  const prevPhaseRef = useRef(gameState.phase);
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = gameState.phase;
    if (gameState.phase === prevPhase) return;

    if (gameState.phase === 'game_over') {
      const teams = gameState.teams;
      let won: boolean | null = null;
      if (teams && gameState.winnerTeam) {
        won = teams[currentPlayerId] === gameState.winnerTeam;
      } else if (gameState.gameWinnerId) {
        won = gameState.gameWinnerId === currentPlayerId;
      }
      if (won === true) {
        playVictorySound();
        vibrate([50, 60, 50, 60, 150]);
      } else if (won === false) {
        playDefeatSound();
      } else {
        playNeutralChime();
      }
    } else if (gameState.phase === 'smazzata_complete') {
      playNeutralChime();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.phase]);
};
