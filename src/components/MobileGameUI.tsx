import React, { useState, useEffect, useRef } from 'react';
import styled, { css } from 'styled-components';
import { CardComponent } from '@/components/Card';
import { MatchHistoryButton } from '@/components/MatchHistory';
import { RulesPopup, RulesIcon } from '@/components/RulesPopup';
import { QuickChatPopup, QuickChatBubble, QuickChatIcon } from '@/components/QuickChat';
import { Wifi, WifiOff, Volume2, VolumeX } from 'lucide-react';
import {
  DESIGN,
  borderGlow,
  borderFadeOut,
  cardEntrance,
  swapGlow,
  cardColors,
  GameUIProps,
  getPlayerName,
  getPlayerEmoji,
  canSwapWithTrump,
  playCardFlipSound,
  TEAM_COLORS,
} from '@/components/shared/gameDesign';
import { TeammateHandReveal } from '@/components/TeammateHandReveal';
import { TimerChip, useTurnCountdown } from '@/components/shared/TurnTimer';
import { useGameFeedback } from '@/components/shared/useGameFeedback';
import { isSoundEnabled, setSoundEnabled } from '@/components/shared/soundEffects';
import packageJson from '../../package.json';

// ===== MOBILE STYLED COMPONENTS =====

const GameContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: radial-gradient(ellipse at center, #0f1f0f 0%, #0a120a 100%);
  color: ${DESIGN.colors.text.primary};
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  overflow: hidden;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='0.5' fill='%23ffffff' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }
`;

// Top Bar - Game Info + Trump/Deck
const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${DESIGN.spacing.xs} ${DESIGN.spacing.sm};
  background: rgba(10,18,10,0.85);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(212,160,23,0.12);
  flex-shrink: 0;
  min-height: 48px;
`;

const GameTitleMobile = styled.div`
  font-size: 16px;
  font-weight: ${DESIGN.typography.title.weight};
  letter-spacing: 1px;
  color: ${DESIGN.colors.text.primary};
  display: flex;
  align-items: baseline;
  gap: 6px;
`;

const GameVersionMobile = styled.span`
  font-size: 10px;
  color: ${DESIGN.colors.text.tertiary};
`;

const TopBarRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${DESIGN.spacing.sm};
`;

const MiniDeckInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  background: ${DESIGN.colors.surfaces.containers};
  border-radius: ${DESIGN.radius.buttons};
  padding: 4px 10px;
  font-size: 12px;
  color: ${DESIGN.colors.text.secondary};
`;

const MiniDeckCount = styled.span`
  color: ${DESIGN.colors.accents.green};
  font-weight: 600;
  font-size: 14px;
`;

const RoundBadge = styled.div`
  font-size: 11px;
  color: ${DESIGN.colors.text.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: ${DESIGN.typography.label.weight};
`;

const RulesIconButton = styled.button`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid ${DESIGN.colors.bg.tertiary};
  background: ${DESIGN.colors.surfaces.elevated};
  color: ${DESIGN.colors.text.tertiary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
  padding: 0;

  &:hover {
    color: ${DESIGN.colors.text.primary};
    border-color: ${DESIGN.colors.accents.cyan};
  }

  svg {
    width: 12px;
    height: 12px;
  }
`;

// Players Row
const PlayersRow = styled.div`
  display: flex;
  gap: 6px;
  padding: 6px ${DESIGN.spacing.sm};
  background: rgba(13,26,13,0.85);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(212,160,23,0.1);
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
`;

const PlayerPill = styled.div<{ isActive?: boolean; isYou?: boolean; isSwapHighlighted?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0px;
  background: ${DESIGN.colors.surfaces.containers};
  border-radius: 20px;
  padding: 3px;
  flex-shrink: 0;
  border: 1.5px solid ${props => props.isSwapHighlighted ? DESIGN.colors.accents.green : props.isActive ? DESIGN.colors.accents.green : 'transparent'};
  transition: all 250ms ease-out;
  overflow: hidden;
  max-width: 34px;

  ${props => props.isActive && css`
    gap: 6px;
    padding: 3px 10px 3px 3px;
    max-width: 200px;
  `}

  ${props => props.isSwapHighlighted && css`
    animation: ${swapGlow} 1200ms ease-out;
  `}
`;

const PlayerPillAvatar = styled.div<{ isActive?: boolean }>`
  width: 26px;
  height: 26px;
  min-width: 26px;
  border-radius: 50%;
  background: ${DESIGN.colors.surfaces.elevated};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  line-height: 1;
  flex-shrink: 0;
  border: 1.5px solid ${props => props.isActive ? DESIGN.colors.accents.green : DESIGN.colors.bg.tertiary};
`;

const PlayerPillInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
`;

const PlayerPillName = styled.div`
  font-size: 11px;
  font-weight: 500;
  color: ${DESIGN.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PlayerPillStats = styled.div`
  font-size: 9px;
  color: ${DESIGN.colors.text.tertiary};
  display: flex;
  gap: 6px;
  white-space: nowrap;
`;

const PlayerPillStatValue = styled.span`
  color: ${DESIGN.colors.accents.green};
  font-weight: 600;
`;

// Trump Card Area (inline in top bar)
const TrumpMini = styled.div`
    width: 48px;
    height: 72px;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
`;

// Main Play Area
const PlayArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: ${DESIGN.spacing.sm};
  min-height: 0;
`;

const PlayAreaSlots = styled.div<{ playerCount?: number }>`
  display: flex;
  gap: ${props => (props.playerCount && props.playerCount >= 4) ? '4px' : DESIGN.spacing.md};
  justify-content: center;
  align-items: center;
  max-width: 100vw;
  padding: 0 ${DESIGN.spacing.xs};
`;

const PlaySlot = styled.div<{ isEmpty?: boolean; isWinner?: boolean; isFadingOut?: boolean; collectDx?: number }>`
  position: relative;
  width: 90px;
  aspect-ratio: 0.65;
  border: 2px dashed ${props => props.isEmpty ? DESIGN.colors.bg.tertiary : 'transparent'};
  border-radius: ${DESIGN.radius.cards};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 200ms ease-out;

  ${props => props.isWinner && css`
    &::before {
      content: '';
      position: absolute;
      inset: -3px;
      border: 2.5px solid ${DESIGN.colors.accents.cyan};
      border-radius: calc(${DESIGN.radius.cards} + 2px);
      pointer-events: none;
      animation: ${borderGlow} 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards,
                 ${borderFadeOut} 0.3s ease-out 1.0s forwards;
      z-index: 10;
    }
  `}

  /* Raccolta della presa: le carte convergono sulla carta vincente e svaniscono */
  ${props => props.isFadingOut && css`
    transform: translateX(${props.collectDx ?? 0}px) translateY(-6px) scale(0.55);
    opacity: 0;
    transition: transform 450ms cubic-bezier(0.55, 0, 0.8, 0.4), opacity 420ms ease-in;
  `}
`;

const PlayedCardWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: ${DESIGN.radius.cards};
  overflow: hidden;
  animation: ${cardEntrance} 250ms ease-out;
`;

const PlaySlotLabel = styled.div`
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: ${DESIGN.colors.text.tertiary};
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 80px;
  text-align: center;
`;

// Bottom Hand Area
const BottomArea = styled.div`
  flex-shrink: 0;
  background: rgba(13,26,13,0.88);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(212,160,23,0.12);
  padding: ${DESIGN.spacing.xs} ${DESIGN.spacing.sm} ${DESIGN.spacing.md};
`;

const HandLabel = styled.div`
  font-size: 10px;
  color: ${DESIGN.colors.text.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: ${DESIGN.spacing.xs};
  text-align: center;
  font-weight: ${DESIGN.typography.label.weight};
`;

const HandRow = styled.div`
  display: flex;
  gap: ${DESIGN.spacing.sm};
  justify-content: center;
  align-items: center;
`;

const HandCard = styled.div<{ isPlayable?: boolean; isSwappable?: boolean }>`
  flex-shrink: 0;
  width: 72px;
  height: 108px;
  border-radius: ${DESIGN.radius.cards};
  overflow: visible;
  cursor: ${props => (props.isPlayable ? 'pointer' : 'not-allowed')};
  transition: transform 200ms ease-out, opacity 200ms ease-out;
  opacity: ${props => (props.isPlayable ? 1 : 0.5)};
  position: relative;

  &:active {
    ${props => props.isPlayable && `
      transform: translateY(-8px) scale(1.05);
    `}
  }
`;

const HandCardSlot = styled.div<{ entranceDelay?: number }>`
  flex-shrink: 0;
  animation: ${cardEntrance} 200ms ease-out ${props => props.entranceDelay || 0}ms both;
`;

const SwapBadge = styled.button`
  position: absolute;
  top: -8px;
  right: -6px;
  background: ${DESIGN.colors.accents.green};
  color: ${DESIGN.colors.bg.primary};
  border: 2px solid ${DESIGN.colors.bg.primary};
  border-radius: 10px;
  padding: 5px 6px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  z-index: 1002;
  white-space: nowrap;
  line-height: 1;

  &:active {
    transform: scale(0.9);
  }
`;

const TrumpFlashOverlay = styled.div`
  position: absolute;
  inset: -3px;
  border-radius: 6px;
  pointer-events: none;
  animation: ${swapGlow} 800ms ease-out;
`;

const SwapNotificationBanner = styled.div`
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: ${DESIGN.colors.surfaces.elevated};
  border: 1px solid #d4a017;
  border-radius: ${DESIGN.radius.buttons};
  padding: 8px 18px;
  font-size: 12px;
  font-weight: 600;
  color: ${DESIGN.colors.accents.green};
  z-index: 2000;
  white-space: nowrap;
  animation: ${cardEntrance} 200ms ease-out;
  box-shadow: 0 4px 20px rgba(0, 255, 136, 0.15);
`;

const MobileTeamIndicator = styled.span<{ team: number }>`
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: ${props => TEAM_COLORS[props.team] || DESIGN.colors.text.tertiary};
  background: ${props => `${TEAM_COLORS[props.team] || DESIGN.colors.text.tertiary}18`};
  padding: 1px 4px;
  border-radius: 3px;
`;

// Game Over (mobile version)
const GameOverOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: ${DESIGN.spacing.md};
`;

const GameOverDialog = styled.div`
  background: rgba(19,33,19,0.96);
  backdrop-filter: blur(12px);
  border-radius: ${DESIGN.radius.containers};
  padding: ${DESIGN.spacing.lg};
  text-align: center;
  width: 100%;
  max-width: 400px;
  border: 1px solid rgba(212,160,23,0.3);
`;

const GameOverTitle = styled.h2`
  font-size: 40px;
  font-weight: ${DESIGN.typography.display.weight};
  margin: 0 0 ${DESIGN.spacing.md} 0;
  color: ${DESIGN.colors.text.primary};
`;

const WinnerInfo = styled.div`
  margin-bottom: ${DESIGN.spacing.md};
`;

const WinnerName = styled.div`
  font-size: 26px;
  font-weight: 600;
  color: #d4a017;
  margin-bottom: ${DESIGN.spacing.xs};
`;

const WinnerScore = styled.div`
  font-size: ${DESIGN.typography.body.size};
  color: ${DESIGN.colors.text.secondary};
`;

const ScoresGrid = styled.div`
  display: grid;
  gap: ${DESIGN.spacing.xs};
  margin-top: ${DESIGN.spacing.md};
`;

const ScoreRow = styled.div<{ isWinner?: boolean }>`
  display: flex;
  justify-content: space-between;
  padding: ${DESIGN.spacing.sm};
  background: ${props =>
    props.isWinner ? DESIGN.colors.surfaces.elevated : DESIGN.colors.surfaces.containers};
  border: 1px solid ${props =>
    props.isWinner ? DESIGN.colors.accents.green : DESIGN.colors.bg.tertiary};
  border-radius: ${DESIGN.radius.buttons};

  div:first-child {
    color: ${DESIGN.colors.text.primary};
    font-weight: 500;
    font-size: 14px;
  }

  div:last-child {
    color: ${props => (props.isWinner ? DESIGN.colors.accents.green : DESIGN.colors.accents.cyan)};
    font-weight: 600;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 14px;
  }
`;

const PlayAgainButton = styled.button`
  margin-top: ${DESIGN.spacing.md};
  padding: ${DESIGN.spacing.sm} ${DESIGN.spacing.lg};
  background: #d4a017;
  color: #0a120a;
  border: none;
  border-radius: ${DESIGN.radius.buttons};
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  width: 100%;
  transition: transform 150ms ease-out;

  &:active {
    transform: scale(0.97);
  }
`;

// ===== MOBILE GAME UI COMPONENT =====
export const MobileGameUI: React.FC<GameUIProps> = ({
  gameState,
  players,
  currentPlayerId,
  onCardPlay,
  onSwapTrump,
  onPlayAgain,
  onStartSecondSmazzata,
  isHost: isHostPlayer,
  onQuickChat,
  quickChatMessage,
}) => {
  const playedCards = gameState.playedCards;
  // Il turno si determina dall'ordine dei posti (chiavi di playerHands), non
  // dall'ordine della lista connessi: dopo una riconnessione i due divergono
  const seatIds = Object.keys(gameState.playerHands);
  const activeTurnPlayerId = gameState.phase === 'playing'
    ? (gameState.turnOrder
        ? gameState.turnOrder[gameState.playedCards.length]
        : seatIds[gameState.currentTurnPlayerIndex]) || null
    : null;
  const isCurrentPlayerTurn = activeTurnPlayerId === currentPlayerId;
  const playerHand = gameState.playerHands[currentPlayerId] || [];

  // ===== ROUND WINNER STATE =====
  const roundWinnerId = gameState.phase === 'round_complete' ? gameState.roundWinnerId : null;
  const winnerSlotIndex = roundWinnerId
    ? playedCards.findIndex(pc => pc.playerId === roundWinnerId)
    : -1;
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Slot in tavola: basati sui posti della partita (non sui connessi attuali)
  const seatCount = Math.max(players.length, seatIds.length);
  // Distanza tra slot per l'animazione di raccolta (larghezza 90 + gap)
  const slotStep = seatCount >= 4 ? 94 : 106;

  // Timer di turno + feedback audio/tattile
  const secondsLeft = useTurnCountdown(gameState.turnDeadline, gameState.phase === 'playing', isCurrentPlayerTurn);
  useGameFeedback(gameState, currentPlayerId, isCurrentPlayerTurn);

  // Toggle audio (inizializzato in effect per evitare mismatch SSR)
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => { setSoundOn(isSoundEnabled()); }, []);
  const toggleSound = () => {
    setSoundEnabled(!soundOn);
    setSoundOn(!soundOn);
  };

  // Trump swap detection
  const [trumpSwapped, setTrumpSwapped] = useState(false);
  const prevTrumpIdRef = useRef(gameState.trumpCard?.id);

  // Swap player highlight
  const [swapHighlightId, setSwapHighlightId] = useState<string | null>(null);
  const [swapNotification, setSwapNotification] = useState<string | null>(null);
  const prevSwapPlayerRef = useRef(gameState.lastSwapPlayerId);
  const [showRules, setShowRules] = useState(false);
  const [showQuickChat, setShowQuickChat] = useState(false);

  // Online status
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  const teams = gameState.teams;
  const isTeamMode = !!teams;
  const myTeam = teams ? teams[currentPlayerId] : null;

  // Reveal timer for teammate hand
  const [revealTimeLeft, setRevealTimeLeft] = useState(5000);
  useEffect(() => {
    if (gameState.phase !== 'revealing_hands') return;
    setRevealTimeLeft(5000);
    const interval = setInterval(() => {
      setRevealTimeLeft(prev => Math.max(0, prev - 100));
    }, 100);
    return () => clearInterval(interval);
  }, [gameState.phase]);

  // Find teammate
  const teammate = isTeamMode && myTeam
    ? players.find(p => p.id !== currentPlayerId && teams[p.id] === myTeam) || null
    : null;
  const teammateHand = teammate ? (gameState.playerHands[teammate.id] || []) : [];

  useEffect(() => {
    const newSwapper = gameState.lastSwapPlayerId;
    if (newSwapper && newSwapper !== prevSwapPlayerRef.current) {
      setSwapHighlightId(newSwapper);
      const swapPlayer = players.find(p => p.id === newSwapper);
      const name = swapPlayer ? getPlayerName(swapPlayer) : 'Un giocatore';
      setSwapNotification(newSwapper === currentPlayerId
        ? 'Hai scambiato con la briscola!'
        : `${name} ha scambiato con la briscola!`);
      const timer = setTimeout(() => {
        setSwapHighlightId(null);
        setSwapNotification(null);
      }, 2000);
      prevSwapPlayerRef.current = newSwapper;
      return () => clearTimeout(timer);
    }
    prevSwapPlayerRef.current = newSwapper;
  }, [gameState.lastSwapPlayerId, currentPlayerId, players]);

  useEffect(() => {
    if (prevTrumpIdRef.current !== undefined &&
        gameState.trumpCard?.id !== prevTrumpIdRef.current) {
      setTrumpSwapped(true);
      const timer = setTimeout(() => setTrumpSwapped(false), 800);
      prevTrumpIdRef.current = gameState.trumpCard?.id;
      return () => clearTimeout(timer);
    }
    prevTrumpIdRef.current = gameState.trumpCard?.id;
  }, [gameState.trumpCard?.id]);

  // Card flip sound effect
  const prevPlayedCountRef = useRef(gameState.playedCards.length);
  useEffect(() => {
    if (gameState.playedCards.length > prevPlayedCountRef.current) {
      playCardFlipSound();
    }
    prevPlayedCountRef.current = gameState.playedCards.length;
  }, [gameState.playedCards.length]);

  // ===== FADE OUT ANIMATION =====
  useEffect(() => {
    if (gameState.phase === 'round_complete') {
      setIsFadingOut(false);
      // La raccolta parte a 1.1s (dura 450ms), l'host risolve a 1.6s
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 1100);
      return () => clearTimeout(fadeTimer);
    } else {
      setIsFadingOut(false);
    }
  }, [gameState.phase, gameState.roundNumber]);

  // Get player name for play slot labels
  const getSlotPlayerName = (index: number): string => {
    if (playedCards.length <= index) return '';
    const player = players.find(p => p.id === playedCards[index].playerId);
    if (!player) return '';
    return player.id === currentPlayerId ? 'Tu' : getPlayerName(player);
  };

  if (gameState.phase === 'smazzata_complete') {
    const scores = gameState.finalScores;
    return (
      <GameContainer>
        <GameOverOverlay>
          <GameOverDialog>
            <GameOverTitle>SMAZZATA 1</GameOverTitle>
            <WinnerName style={{ color: DESIGN.colors.accents.cyan, fontSize: '18px' }}>PROSSIMA SMAZZATA</WinnerName>
            <ScoresGrid>
              {[...players]
                .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
                .map((player, index) => (
                  <ScoreRow key={player.id} isWinner={false}>
                    <div>{index + 1}. {getPlayerName(player)}</div>
                    <div>{scores[player.id] || 0}</div>
                  </ScoreRow>
                ))}
            </ScoresGrid>
            {isTeamMode && gameState.teamScores && (
              <div style={{ marginTop: '8px' }}>
                <ScoresGrid>
                  {[1, 2].map(teamNum => (
                    <ScoreRow key={teamNum} isWinner={false}>
                      <div style={{ color: TEAM_COLORS[teamNum] }}>Squadra {teamNum}</div>
                      <div>{gameState.teamScores?.[String(teamNum)] || 0}</div>
                    </ScoreRow>
                  ))}
                </ScoresGrid>
              </div>
            )}
            {isHostPlayer && onStartSecondSmazzata && (
              <PlayAgainButton onClick={onStartSecondSmazzata}>SECONDA SMAZZATA</PlayAgainButton>
            )}
            {!isHostPlayer && (
              <div style={{ marginTop: '12px', fontSize: '12px', color: DESIGN.colors.text.tertiary }}>In attesa dell'host...</div>
            )}
          </GameOverDialog>
        </GameOverOverlay>
      </GameContainer>
    );
  }

  if (gameState.phase === 'game_over') {
    const scores = gameState.finalScores;
    const winner = gameState.gameWinnerId;
    const winnerPlayer = winner ? players.find(p => p.id === winner) : null;
    const isDraw = !winner;
    const isTeamDraw = isTeamMode && (!gameState.winnerTeam || gameState.winnerTeam === 0);

    return (
      <GameContainer>
        <GameOverOverlay>
          <GameOverDialog>
            <GameOverTitle>{gameState.endedEarly ? 'PARTITA INTERROTTA' : 'PARTITA FINITA'}</GameOverTitle>
            {gameState.endedEarly && (
              <div style={{ margin: '-4px 0 12px', fontSize: '12px', color: DESIGN.colors.accents.pink, fontWeight: 600 }}>
                Un giocatore ha lasciato — punteggi al momento dell'interruzione
              </div>
            )}
            {isTeamMode ? (
              <>
                <WinnerInfo>
                  {isTeamDraw ? (
                    <>
                      <WinnerName style={{ color: DESIGN.colors.accents.cyan }}>PAREGGIO!</WinnerName>
                      <WinnerScore>
                        Entrambi i team hanno {gameState.teamScores?.['1'] || 0} punti
                      </WinnerScore>
                    </>
                  ) : (
                    <>
                      <WinnerName style={{ color: TEAM_COLORS[gameState.winnerTeam!] }}>
                        TEAM {gameState.winnerTeam} VINCE!
                      </WinnerName>
                      <WinnerScore>
                        {gameState.teamScores?.[String(gameState.winnerTeam)] || 0} punti
                      </WinnerScore>
                    </>
                  )}
                </WinnerInfo>
                <ScoresGrid>
                  {[1, 2].map(teamNum => (
                    <ScoreRow key={teamNum} isWinner={!isTeamDraw && teamNum === gameState.winnerTeam}>
                      <div style={{ color: TEAM_COLORS[teamNum] }}>
                        Team {teamNum}
                      </div>
                      <div>{gameState.teamScores?.[String(teamNum)] || 0}</div>
                    </ScoreRow>
                  ))}
                </ScoresGrid>
                <ScoresGrid>
                  {[...players]
                    .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
                    .map((player) => (
                      <ScoreRow key={player.id} isWinner={false}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MobileTeamIndicator team={teams![player.id]}>T{teams![player.id]}</MobileTeamIndicator>
                          {getPlayerName(player)}
                        </div>
                        <div>{scores[player.id] || 0}</div>
                      </ScoreRow>
                    ))}
                </ScoresGrid>
              </>
            ) : isDraw ? (
              <>
                <WinnerInfo>
                  <WinnerName style={{ color: DESIGN.colors.accents.cyan }}>PAREGGIO!</WinnerName>
                  <WinnerScore>
                    {Math.max(...Object.values(scores))} punti ciascuno
                  </WinnerScore>
                </WinnerInfo>
                <ScoresGrid>
                  {[...players]
                    .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
                    .map((player, index) => {
                      const maxScore = Math.max(...Object.values(scores));
                      const isTied = scores[player.id] === maxScore;
                      return (
                        <ScoreRow key={player.id} isWinner={isTied}>
                          <div>
                            {index + 1}. {getPlayerName(player)}
                          </div>
                          <div>{scores[player.id] || 0}</div>
                        </ScoreRow>
                      );
                    })}
                </ScoresGrid>
              </>
            ) : (
              <>
                <WinnerInfo>
                  <WinnerName>{getPlayerName(winnerPlayer!)}</WinnerName>
                  <WinnerScore>{scores[winner!]} punti</WinnerScore>
                </WinnerInfo>
                <ScoresGrid>
                  {[...players]
                    .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
                    .map((player, index) => (
                      <ScoreRow key={player.id} isWinner={player.id === winner}>
                        <div>
                          {index + 1}. {getPlayerName(player)}
                        </div>
                        <div>{scores[player.id] || 0}</div>
                      </ScoreRow>
                    ))}
                </ScoresGrid>
              </>
            )}
            {gameState.smazzata1Scores && gameState.smazzata2Scores && (
              <div style={{ marginTop: '8px', padding: '10px', background: DESIGN.colors.surfaces.elevated, borderRadius: DESIGN.radius.buttons }}>
                <div style={{ fontSize: '10px', color: DESIGN.colors.text.tertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Riepilogo</div>
                {isTeamMode ? (
                  <>
                    {[1, 2].map(teamNum => (
                      <div key={teamNum} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: TEAM_COLORS[teamNum], fontSize: '13px' }}>
                        <span>Sq.{teamNum}</span>
                        <span>{gameState.smazzata1TeamScores?.[String(teamNum)] || 0} — {gameState.smazzata2TeamScores?.[String(teamNum)] || 0}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {[...players].map(player => (
                      <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: DESIGN.colors.text.secondary, fontSize: '13px' }}>
                        <span>{getPlayerName(player)}</span>
                        <span>{gameState.smazzata1Scores?.[player.id] || 0} — {gameState.smazzata2Scores?.[player.id] || 0}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
            {isHostPlayer && onPlayAgain && (
              <PlayAgainButton onClick={onPlayAgain}>RIGIOCA</PlayAgainButton>
            )}
            {!isHostPlayer && (
              <div style={{ marginTop: DESIGN.spacing.md, fontSize: '12px', color: DESIGN.colors.text.tertiary }}>In attesa che l'host inizi una nuova partita...</div>
            )}
            <MatchHistoryButton roundHistory={gameState.roundHistory} players={players} />
          </GameOverDialog>
        </GameOverOverlay>
      </GameContainer>
    );
  }

  return (
    <GameContainer>
      {swapNotification && (
        <SwapNotificationBanner key={swapNotification}>
          {swapNotification}
        </SwapNotificationBanner>
      )}

      {/* Top Bar - Title, Round, Deck Count, Trump */}
      <TopBar>
        <div>
          <GameTitleMobile>
            BRISCOLA NAPOLETANA<GameVersionMobile>v{packageJson.version}</GameVersionMobile>
          </GameTitleMobile>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RoundBadge>Turno {gameState.roundNumber}</RoundBadge>
            <RulesIconButton onClick={() => setShowRules(true)} title="Come si gioca">
              <RulesIcon />
            </RulesIconButton>
            <RulesIconButton onClick={() => setShowQuickChat(true)} title="Chat veloce">
              <QuickChatIcon />
            </RulesIconButton>
            <RulesIconButton onClick={toggleSound} title={soundOn ? 'Disattiva audio' : 'Attiva audio'}>
              {soundOn ? <Volume2 /> : <VolumeX />}
            </RulesIconButton>
            {isOnline
              ? <Wifi size={12} color={DESIGN.colors.accents.green} strokeWidth={2} />
              : <WifiOff size={12} color={DESIGN.colors.accents.pink} strokeWidth={2} />
            }
          </div>
        </div>
        <TopBarRight>
          <MiniDeckInfo>
            Mazzo <MiniDeckCount>{gameState.deck.length}</MiniDeckCount>
          </MiniDeckInfo>
          {gameState.trumpCard && (
            <div style={{ position: 'relative' }}>
              <TrumpMini>
                <CardComponent
                  card={gameState.trumpCard}
                  onClick={() => {}}
                  transform=""
                  colors={cardColors}
                  fillContainer
                />
              </TrumpMini>
              {trumpSwapped && <TrumpFlashOverlay key={gameState.trumpCard.id} />}
            </div>
          )}
        </TopBarRight>
      </TopBar>

      {/* Players Row */}
      <PlayersRow>
        {players.map((player) => {
          const isYou = player.id === currentPlayerId;
          const isActive = player.id === activeTurnPlayerId;

          return (
            <PlayerPill key={player.id} isActive={isActive} isYou={isYou} isSwapHighlighted={swapHighlightId === player.id}>
              <PlayerPillAvatar
                isActive={isActive}
              >
                {getPlayerEmoji(player)}
              </PlayerPillAvatar>
              {isActive && (
                <PlayerPillInfo>
                  <PlayerPillName>
                    {isYou ? 'Tu' : getPlayerName(player)}
                  </PlayerPillName>
                  <PlayerPillStats>
                    {isTeamMode && teams[player.id] && (
                      <MobileTeamIndicator team={teams[player.id]}>T{teams[player.id]}</MobileTeamIndicator>
                    )}
                  </PlayerPillStats>
                </PlayerPillInfo>
              )}
              {isActive && gameState.phase === 'playing' && secondsLeft !== null && (
                <TimerChip urgent={secondsLeft <= 5} style={{ marginLeft: 4 }}>{secondsLeft}s</TimerChip>
              )}
            </PlayerPill>
          );
        })}
      </PlayersRow>

      {/* Center Play Area */}
      <PlayArea>
        <PlayAreaSlots playerCount={seatCount}>
          {Array.from({ length: seatCount }).map((_, slotIndex) => {
            const isSlotWinner = roundWinnerId === playedCards[slotIndex]?.playerId;
            return (
            <PlaySlot
              key={slotIndex}
              isEmpty={playedCards.length < slotIndex + 1}
              isWinner={isSlotWinner}
              isFadingOut={isFadingOut}
              collectDx={winnerSlotIndex >= 0 ? (winnerSlotIndex - slotIndex) * slotStep : 0}
            >
              {playedCards.length > slotIndex && (
                <PlayedCardWrapper>
                  <CardComponent
                    card={playedCards[slotIndex].card}
                    onClick={() => {}}
                    transform=""
                    colors={cardColors}
                    fillContainer
                  />
                </PlayedCardWrapper>
              )}
              <PlaySlotLabel>{getSlotPlayerName(slotIndex)}</PlaySlotLabel>
            </PlaySlot>
            );
          })}
        </PlayAreaSlots>
      </PlayArea>

      {/* Bottom Hand Area */}
      <BottomArea>
        <HandLabel>
          {isCurrentPlayerTurn ? 'Tocca a te — Scegli una carta' : 'In attesa...'}
          {isCurrentPlayerTurn && secondsLeft !== null && (
            <TimerChip urgent={secondsLeft <= 5} style={{ marginLeft: 6 }}>{secondsLeft}s</TimerChip>
          )}
        </HandLabel>
        <HandRow>
          {playerHand.map((card, idx) => {
            return (
              <HandCardSlot key={`${gameState.roundNumber}_${card.id}`} entranceDelay={idx * 60}>
                <HandCard
                  isPlayable={isCurrentPlayerTurn}
                  onClick={() => isCurrentPlayerTurn && onCardPlay(card)}
                >
                  <CardComponent
                    card={card}
                    onClick={() => isCurrentPlayerTurn && onCardPlay(card)}
                    transform=""
                    colors={cardColors}
                  />
                </HandCard>
              </HandCardSlot>
            );
          })}
        </HandRow>
      </BottomArea>

      {showRules && <RulesPopup onClose={() => setShowRules(false)} />}

      {showQuickChat && onQuickChat && (
        <QuickChatPopup
          onClose={() => setShowQuickChat(false)}
          onSend={onQuickChat}
        />
      )}

      {quickChatMessage && quickChatMessage.ts > 0 && (
        <QuickChatBubble
          message={quickChatMessage}
          players={players}
          currentPlayerId={currentPlayerId}
        />
      )}

      {gameState.phase === 'revealing_hands' && isTeamMode && teammate && (
        <TeammateHandReveal
          teammateHand={teammateHand}
          teammate={teammate}
          myTeam={myTeam!}
          timeLeft={revealTimeLeft}
        />
      )}
    </GameContainer>
  );
};

export default MobileGameUI;
