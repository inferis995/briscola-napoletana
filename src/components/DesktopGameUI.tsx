import React, { useState, useEffect, useRef } from 'react';
import styled, { css } from 'styled-components';
import { CardComponent } from '@/components/Card';
import { MatchHistoryButton } from '@/components/MatchHistory';
import { RulesPopup, RulesIcon } from '@/components/RulesPopup';
import { QuickChatPopup, QuickChatBubble, QuickChatIcon } from '@/components/QuickChat';
import { Wifi, WifiOff } from 'lucide-react';
import packageJson from '../../package.json';
import {
  DESIGN,
  borderGlow,
  borderFadeOut,
  fadeOut,
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

// ===== STYLED COMPONENTS =====

const GameContainer = styled.div`
  display: flex;
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

// Left Sidebar - Opponents
const LeftSidebar = styled.div`
  width: 280px;
  padding: ${DESIGN.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${DESIGN.spacing.lg};
  overflow-y: auto;
  background: rgba(10,18,10,0.85);
  backdrop-filter: blur(8px);
  border-right: 1px solid rgba(212,160,23,0.12);
  z-index: 1;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${DESIGN.colors.bg.tertiary};
    border-radius: 2px;
  }
`;

const OpponentCard = styled.div<{ isCurrentPlayer?: boolean; isActive?: boolean; isSwapHighlighted?: boolean }>`
  background: rgba(19,33,19,0.85);
  border-radius: ${DESIGN.radius.containers};
  padding: ${DESIGN.spacing.md};
  transition: background-color 200ms ease-out, border 200ms ease-out;
  border: 1px solid ${props => props.isSwapHighlighted ? '#d4a017' : props.isActive ? 'rgba(212,160,23,0.5)' : 'rgba(212,160,23,0.08)'};
  position: relative;

  ${props => props.isSwapHighlighted && css`
    animation: ${swapGlow} 1200ms ease-out;
  `}

  &:hover {
    background: rgba(30,50,32,0.9);
  }
`;

const OpponentHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${DESIGN.spacing.md};
  margin-bottom: ${DESIGN.spacing.md};
`;

const OpponentAvatar = styled.div<{ isActive?: boolean }>`
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: 50%;
  background: ${DESIGN.colors.surfaces.elevated};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  line-height: 1;
  flex-shrink: 0;
  border: 2px solid ${props => props.isActive ? DESIGN.colors.accents.green : DESIGN.colors.bg.tertiary};
`;

const OpponentName = styled.div`
  flex: 1;
  font-size: ${DESIGN.typography.body.size};
  font-weight: ${DESIGN.typography.body.weight};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${DESIGN.colors.text.primary};
`;

const OpponentStats = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${DESIGN.spacing.sm};
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${DESIGN.spacing.xs};

  div:first-child {
    font-size: ${DESIGN.typography.label.size};
    font-weight: ${DESIGN.typography.label.weight};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: ${DESIGN.colors.text.tertiary};
  }

  div:last-child {
    font-size: ${DESIGN.typography.subtitle.size};
    font-weight: 600;
    color: ${DESIGN.colors.accents.green};
  }
`;

const TeamIndicator = styled.span<{ team: number }>`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: ${props => TEAM_COLORS[props.team] || DESIGN.colors.text.tertiary};
  background: ${props => `${TEAM_COLORS[props.team] || DESIGN.colors.text.tertiary}18`};
  padding: 1px 6px;
  border-radius: 4px;
`;

// Center Area
const CenterArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: ${DESIGN.spacing.lg};
  gap: ${DESIGN.spacing.lg};
  background: transparent;
  position: relative;
  z-index: 1;
`;

const GameHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: ${DESIGN.spacing.md};
  border-bottom: 1px solid rgba(212,160,23,0.15);
`;

const GameTitle = styled.div`
  display: flex;
  align-items: flex-end;
  flex-direction: row;
  font-size: ${DESIGN.typography.title.size};
  font-weight: ${DESIGN.typography.title.weight};
  margin: 0;
  color: ${DESIGN.colors.text.primary};
  letter-spacing: 1px;
`;

const GameVersion = styled.div`
  font-size: ${DESIGN.typography.caption.size};
  color: ${DESIGN.colors.text.tertiary};
  margin-left: ${DESIGN.spacing.md};
  margin-bottom: ${DESIGN.spacing.xxs};
`;

const RoundInfo = styled.div`
  font-size: ${DESIGN.typography.label.size};
  color: ${DESIGN.colors.text.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: ${DESIGN.typography.label.weight};
`;

const RulesIconButton = styled.button`
  width: 28px;
  height: 28px;
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
`;

// Game Board
const GameBoard = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${DESIGN.spacing.xl};
  align-items: center;
  justify-content: center;
  position: relative;
  width: 100%;
`;

const BoardSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${DESIGN.spacing.md};
`;

const SectionLabel = styled.div`
  font-size: ${DESIGN.typography.label.size};
  color: ${DESIGN.colors.text.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transform: translateX(-8px);
  font-weight: ${DESIGN.typography.label.weight};
`;

const CardContainer = styled.div`
  position: relative;
  width: 100px;
  height: 140px;
`;

const PlayAreaContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(1.2);
  display: flex;
  gap: ${DESIGN.spacing.xl};
  justify-content: center;
  align-items: center;
  z-index: 500;
`;

const PlaySlot = styled.div<{ isEmpty?: boolean; isWinner?: boolean; isFadingOut?: boolean }>`
  position: relative;
  width: 160px;
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
  
  ${props => props.isFadingOut && css`
    animation: ${fadeOut} 250ms ease-out forwards;
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

// Floating Bottom Dock - Hand
const BottomHandDock = styled.div`
  position: absolute;
  bottom: ${DESIGN.spacing.md};
  left: 50%;
  transform: translate(-50%, 0) scale(1.25);
  background: rgba(19,33,19,0.92);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(212,160,23,0.2);
  border-radius: ${DESIGN.radius.containers};
  padding: ${DESIGN.spacing.md};
  display: flex;
  gap: ${DESIGN.spacing.md};
  z-index: 900;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  white-space: nowrap;
  width: fit-content;
  transition: transform 200ms ease-out;

  &:hover {
    transform: translate(-50%, -5%) scale(1.35);
  }
`;

// Floating Top Right Dock - Deck & Trump
const TopRightDock = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  background: rgba(19,33,19,0.92);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(212,160,23,0.2);
  border-radius: ${DESIGN.radius.containers};
  padding: ${DESIGN.spacing.lg};
  display: flex;
  gap: ${DESIGN.spacing.xl};
  z-index: 900;
  align-items: center;
  justify-content: center;
`;

const DeckContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${DESIGN.spacing.md};
  position: relative;
`;

const DeckStack = styled.div`
  position: relative;
  width: 100px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const HandCard = styled.div<{ isPlayable?: boolean; isSwappable?: boolean }>`
  flex-shrink: 0;
  width: 80px;
  height: 120px;
  border-radius: ${DESIGN.radius.cards};
  overflow: visible;
  cursor: ${props => (props.isPlayable ? 'pointer' : 'not-allowed')};
  transition: transform 200ms ease-out, opacity 200ms ease-out;
  opacity: ${props => (props.isPlayable ? 1 : 0.5)};
  position: relative;
  z-index: 901;

  &:hover {
    ${props =>
      props.isPlayable &&
      `
      transform: translateY(-12px);
      z-index: 1000;
    `}
  }
`;

const HandCardSlot = styled.div<{ entranceDelay?: number }>`
  flex-shrink: 0;
  animation: ${cardEntrance} 200ms ease-out ${props => props.entranceDelay || 0}ms both;
`;

const SwapBadge = styled.button`
  position: absolute;
  top: -10px;
  right: -8px;
  background: ${DESIGN.colors.accents.green};
  color: ${DESIGN.colors.bg.primary};
  border: 2px solid ${DESIGN.colors.bg.primary};
  border-radius: 10px;
  padding: 6px 8px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  z-index: 1002;
  white-space: nowrap;
  line-height: 1;
  transition: transform 150ms ease-out;

  &:hover {
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.9);
  }
`;

const TrumpFlashOverlay = styled.div`
  position: absolute;
  inset: -6px;
  border-radius: ${DESIGN.radius.cards};
  pointer-events: none;
  animation: ${swapGlow} 1200ms ease-out;
  border: 3px solid rgba(0, 255, 136, 0.6);
`;

const SwapNotificationBanner = styled.div`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: ${DESIGN.colors.surfaces.elevated};
  border: 1px solid ${DESIGN.colors.accents.green};
  border-radius: ${DESIGN.radius.buttons};
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  color: ${DESIGN.colors.accents.green};
  z-index: 2000;
  white-space: nowrap;
  animation: ${cardEntrance} 200ms ease-out;
  box-shadow: 0 4px 20px rgba(0, 255, 136, 0.15);
`;


// Game Over
const GameOverOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const GameOverDialog = styled.div`
  background: rgba(19,33,19,0.96);
  backdrop-filter: blur(12px);
  border-radius: ${DESIGN.radius.containers};
  padding: ${DESIGN.spacing.xl};
  text-align: center;
  max-width: 500px;
  border: 1px solid rgba(212,160,23,0.3);
`;

const GameOverTitle = styled.h2`
  font-size: ${DESIGN.typography.display.size};
  font-weight: ${DESIGN.typography.display.weight};
  margin: 0 0 ${DESIGN.spacing.lg} 0;
  color: ${DESIGN.colors.text.primary};
`;

const WinnerInfo = styled.div`
  margin-bottom: ${DESIGN.spacing.lg};
`;

const WinnerName = styled.div`
  font-size: ${DESIGN.typography.title.size};
  font-weight: 600;
  color: #d4a017;
  margin-bottom: ${DESIGN.spacing.sm};
`;

const WinnerScore = styled.div`
  font-size: ${DESIGN.typography.body.size};
  color: ${DESIGN.colors.text.secondary};
`;

const ScoresGrid = styled.div`
  display: grid;
  gap: ${DESIGN.spacing.sm};
  margin-top: ${DESIGN.spacing.lg};
`;

const ScoreRow = styled.div<{ isWinner?: boolean }>`
  display: flex;
  justify-content: space-between;
  padding: ${DESIGN.spacing.md};
  background: ${props =>
    props.isWinner ? DESIGN.colors.surfaces.elevated : DESIGN.colors.surfaces.containers};
  border: 1px solid ${props =>
    props.isWinner ? '#d4a017' : DESIGN.colors.bg.tertiary};
  border-radius: ${DESIGN.radius.buttons};

  div:first-child {
    color: ${DESIGN.colors.text.primary};
    font-weight: 500;
  }

  div:last-child {
    color: ${props => (props.isWinner ? '#d4a017' : DESIGN.colors.accents.cyan)};
    font-weight: 600;
    font-family: 'SF Mono', Monaco, monospace;
  }
`;

const PlayAgainButton = styled.button`
  margin-top: ${DESIGN.spacing.lg};
  padding: ${DESIGN.spacing.md} ${DESIGN.spacing.xl};
  background: #d4a017;
  color: #0a120a;
  border: none;
  border-radius: ${DESIGN.radius.buttons};
  font-size: ${DESIGN.typography.body.size};
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  width: 100%;
  transition: transform 150ms ease-out, box-shadow 150ms ease-out;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(212,160,23,0.3);
  }

  &:active {
    transform: scale(0.97);
  }
`;

// ===== DESKTOP GAME UI COMPONENT =====
export const DesktopGameUI: React.FC<GameUIProps> = ({
  gameState,
  players,
  currentPlayerId,
  onCardPlay,
  onSwapTrump,
  onPlayAgain,
  isHost: isHostPlayer,
  onQuickChat,
  quickChatMessage,
}) => {
  const playedCards = gameState.playedCards;
  const currentTurnIndex = gameState.currentTurnPlayerIndex;
  const currentPlayerIndex = players.findIndex(p => p.id === currentPlayerId);
  const isCurrentPlayerTurn = gameState.phase === 'playing' && currentTurnIndex === currentPlayerIndex;
  const playerHand = gameState.playerHands[currentPlayerId] || [];
  const playerStack = gameState.playerStacks[currentPlayerId] || [];

  // ===== ROUND WINNER STATE =====
  // roundWinnerId comes from shared state — all clients see the same value
  const roundWinnerId = gameState.phase === 'round_complete' ? gameState.roundWinnerId : null;
  const [isFadingOut, setIsFadingOut] = useState(false);

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
      const name = swapPlayer ? getPlayerName(swapPlayer) : 'A player';
      setSwapNotification(`${newSwapper === currentPlayerId ? 'You' : name} swapped with the trump!`);
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
      // Start fading before host resolves at 1.6s
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 1200);
      return () => clearTimeout(fadeTimer);
    } else {
      setIsFadingOut(false);
    }
  }, [gameState.phase, gameState.roundNumber]);

  // ===== HELPER FUNCTIONS =====
  const getOpponents = () => {
    return players.filter(p => p.id !== currentPlayerId);
  };

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
            <GameOverTitle>PARTITA FINITA</GameOverTitle>
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
                <div style={{ marginTop: DESIGN.spacing.md }}>
                  <ScoresGrid>
                    {[...players]
                      .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
                      .map((player) => (
                        <ScoreRow key={player.id} isWinner={false}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <TeamIndicator team={teams![player.id]}>T{teams![player.id]}</TeamIndicator>
                            {getPlayerName(player)}
                          </div>
                          <div>{scores[player.id] || 0}</div>
                        </ScoreRow>
                      ))}
                  </ScoresGrid>
                </div>
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
            {isHostPlayer && onPlayAgain && (
              <PlayAgainButton onClick={onPlayAgain}>RIGIOCA</PlayAgainButton>
            )}
            {!isHostPlayer && (
              <div style={{ marginTop: DESIGN.spacing.lg, fontSize: DESIGN.typography.caption.size, color: DESIGN.colors.text.tertiary }}>In attesa che l'host inizi una nuova partita...</div>
            )}
            <MatchHistoryButton roundHistory={gameState.roundHistory} players={players} />
          </GameOverDialog>
        </GameOverOverlay>
      </GameContainer>
    );
  }

  return (
    <GameContainer>
      {/* Swap Notification Banner */}
      {swapNotification && (
        <SwapNotificationBanner key={gameState.lastSwapPlayerId}>
          {swapNotification}
        </SwapNotificationBanner>
      )}
      {/* Left Sidebar - All Players in Fixed Order */}
      <LeftSidebar>
        {players.map((player, index) => {
          const isCurrentPlayer = player.id === currentPlayerId;
          const isActive = currentTurnIndex === index;
          
          return (
            <OpponentCard key={player.id} isCurrentPlayer={isCurrentPlayer} isActive={isActive} isSwapHighlighted={swapHighlightId === player.id}>
              <OpponentHeader>
                <OpponentAvatar 
                  isActive={isActive}
                >
                  {getPlayerEmoji(player)}
                </OpponentAvatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <OpponentName>{getPlayerName(player)}</OpponentName>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px', alignItems: 'center' }}>
                    {isCurrentPlayer && (
                      <span style={{ fontSize: '11px', color: DESIGN.colors.accents.cyan, letterSpacing: '0.5px' }}>TU</span>
                    )}
                    {isTeamMode && teams[player.id] && (
                      <TeamIndicator team={teams[player.id]}>T{teams[player.id]}</TeamIndicator>
                    )}
                  </div>
                </div>
              </OpponentHeader>
            </OpponentCard>
          );
        })}
      </LeftSidebar>

      {/* Center - Game Board */}
      <CenterArea>
        <GameHeader>
          <GameTitle>
            BRISCOLA NAPOLETANA<GameVersion>v{packageJson.version}</GameVersion>
          </GameTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <RoundInfo>Turno {gameState.roundNumber}</RoundInfo>
            <RulesIconButton onClick={() => setShowRules(true)} title="Come si gioca">
              <RulesIcon />
            </RulesIconButton>
            <RulesIconButton onClick={() => setShowQuickChat(true)} title="Chat veloce">
              <QuickChatIcon />
            </RulesIconButton>
            {isOnline
              ? <Wifi size={14} color={DESIGN.colors.accents.green} strokeWidth={2} />
              : <WifiOff size={14} color={DESIGN.colors.accents.pink} strokeWidth={2} />
            }
          </div>
        </GameHeader>

        <GameBoard>
          {/* Top Right: Deck & Trump Card Container */}
          <TopRightDock>
            {/* Trump Card */}
            <DeckContainer>
              <SectionLabel>Briscola</SectionLabel>
              <CardContainer>
                {gameState.trumpCard && (
                  <CardComponent
                    card={gameState.trumpCard}
                    onClick={() => {}}
                    transform=""
                    colors={cardColors}
                  />
                )}
                {trumpSwapped && <TrumpFlashOverlay key={gameState.trumpCard?.id} />}
              </CardContainer>
            </DeckContainer>

            {/* Deck - Stacked Cards */}
            <DeckContainer>
              <SectionLabel>Mazzo</SectionLabel>
              <DeckStack>
                {/* Stacked back cards */}
                <div style={{ position: 'absolute', top: '-4px', left: '-4px', transform: 'translateZ(0)' }}>
                  <CardComponent
                    card={null}
                    isBack={true}
                    onClick={() => {}}
                    transform=""
                    colors={cardColors}
                  />
                </div>
                <div style={{ position: 'absolute', top: 0, left: 0, transform: 'translateZ(0)' }}>
                  <CardComponent
                    card={null}
                    isBack={true}
                    onClick={() => {}}
                    transform=""
                    colors={cardColors}
                  />
                </div>
                <div style={{ position: 'absolute', top: '4px', left: '4px', transform: 'translateZ(0)' }}>
                  <CardComponent
                    card={null}
                    isBack={true}
                    onClick={() => {}}
                    transform=""
                    colors={cardColors}
                  />
                </div>
                {/* Count badge */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    background: DESIGN.colors.accents.green,
                    color: DESIGN.colors.bg.primary,
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '14px',
                    zIndex: 20
                  }}
                >
                  {gameState.deck.length}
                </div>
              </DeckStack>
            </DeckContainer>
          </TopRightDock>

          {/* Center: Templated Play Area - ALWAYS VISIBLE */}
          <PlayAreaContainer>
            {players.map((_, slotIndex) => {
              const isSlotWinner = roundWinnerId === playedCards[slotIndex]?.playerId;
              return (
              <PlaySlot
                key={slotIndex}
                isEmpty={playedCards.length < slotIndex + 1}
                isWinner={isSlotWinner}
                isFadingOut={isFadingOut}
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
              </PlaySlot>
              );
            })}
          </PlayAreaContainer>

          {/* Floating Bottom Dock - Player Hand */}
          <BottomHandDock>
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
          </BottomHandDock>
        </GameBoard>
      </CenterArea>

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

export default DesktopGameUI;
