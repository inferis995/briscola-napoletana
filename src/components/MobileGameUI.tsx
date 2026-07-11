import React, { useState, useEffect, useRef } from 'react';
import styled, { css } from 'styled-components';
import { CardComponent } from '@/components/Card';
import { MatchHistoryButton } from '@/components/MatchHistory';
import { RulesPopup, RulesIcon } from '@/components/RulesPopup';
import { QuickChatPopup, QuickChatBubble, QuickChatIcon } from '@/components/QuickChat';
import { Wifi, WifiOff } from 'lucide-react';
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
import packageJson from '../../package.json';

// ===== MOBILE STYLED COMPONENTS =====

const GameContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: ${DESIGN.colors.bg.primary};
  color: ${DESIGN.colors.text.primary};
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  overflow: hidden;
  position: relative;
`;

// Top Bar - Game Info + Trump/Deck
const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${DESIGN.spacing.xs} ${DESIGN.spacing.sm};
  background: ${DESIGN.colors.bg.secondary};
  border-bottom: 1px solid ${DESIGN.colors.bg.tertiary};
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
  background: ${DESIGN.colors.bg.secondary};
  border-bottom: 1px solid ${DESIGN.colors.bg.tertiary};
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

const YouBadge = styled.span`
  font-size: 8px;
  color: ${DESIGN.colors.accents.cyan};
  letter-spacing: 0.5px;
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

const PlaySlot = styled.div<{ isEmpty?: boolean; isWinner?: boolean; isFadingOut?: boolean }>`
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
  background: ${DESIGN.colors.bg.secondary};
  border-top: 1px solid ${DESIGN.colors.bg.tertiary};
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
  border: 1px solid ${DESIGN.colors.accents.green};
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
  background: ${DESIGN.colors.surfaces.containers};
  border-radius: ${DESIGN.radius.containers};
  padding: ${DESIGN.spacing.lg};
  text-align: center;
  width: 100%;
  max-width: 400px;
  border: 1px solid ${DESIGN.colors.bg.tertiary};
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
  font-size: ${DESIGN.typography.subtitle.size};
  font-weight: 600;
  color: ${DESIGN.colors.accents.green};
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
  background: ${DESIGN.colors.accents.green};
  color: ${DESIGN.colors.bg.primary};
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
  isHost: isHostPlayer,
  onQuickChat,
  quickChatMessage,
}) => {
  const playedCards = gameState.playedCards;
  const currentTurnIndex = gameState.currentTurnPlayerIndex;
  const currentPlayerIndex = players.findIndex(p => p.id === currentPlayerId);
  const isCurrentPlayerTurn = gameState.phase === 'playing' && currentTurnIndex === currentPlayerIndex;
  const playerHand = gameState.playerHands[currentPlayerId] || [];

  // ===== ROUND WINNER STATE =====
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
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 1200);
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
    return player.id === currentPlayerId ? 'You' : getPlayerName(player);
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
            {isOnline
              ? <Wifi size={12} color={DESIGN.colors.accents.green} strokeWidth={2} />
              : <WifiOff size={12} color={DESIGN.colors.accents.pink} strokeWidth={2} />
            }
          </div>
        </div>
        <TopBarRight>
          <MiniDeckInfo>
            Deck <MiniDeckCount>{gameState.deck.length}</MiniDeckCount>
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
        {players.map((player, index) => {
          const isYou = player.id === currentPlayerId;
          const isActive = currentTurnIndex === index;

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
                    {isYou && <YouBadge> TU</YouBadge>}
                  </PlayerPillName>
                  <PlayerPillStats>
                    <span>Mano <PlayerPillStatValue>{gameState.playerHands[player.id]?.length || 0}</PlayerPillStatValue></span>
                    <span>Prese <PlayerPillStatValue>{gameState.playerStacks[player.id]?.length || 0}</PlayerPillStatValue></span>
                    {isTeamMode && teams[player.id] && (
                      <MobileTeamIndicator team={teams[player.id]}>T{teams[player.id]}</MobileTeamIndicator>
                    )}
                  </PlayerPillStats>
                </PlayerPillInfo>
              )}
            </PlayerPill>
          );
        })}
      </PlayersRow>

      {/* Center Play Area */}
      <PlayArea>
        <PlayAreaSlots playerCount={players.length}>
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
        </HandLabel>
        <HandRow>
          {playerHand.map((card, idx) => {
            const swappable = canSwapWithTrump(card, gameState.trumpCard, gameState.deck.length);
            return (
              <HandCardSlot key={`${gameState.roundNumber}_${card.id}`} entranceDelay={idx * 60}>
                <HandCard
                  isPlayable={isCurrentPlayerTurn}
                  isSwappable={swappable}
                  onClick={() => isCurrentPlayerTurn && onCardPlay(card)}
                >
                  <CardComponent
                    card={card}
                    onClick={() => isCurrentPlayerTurn && onCardPlay(card)}
                    transform=""
                    colors={cardColors}
                  />
                  {swappable && (
                    <SwapBadge onClick={(e) => { e.stopPropagation(); onSwapTrump(card); }}>
                      SWAP
                    </SwapBadge>
                  )}
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
