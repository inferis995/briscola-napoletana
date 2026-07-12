"use client";

import React, { useState, useEffect, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
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
  cardColors,
  GameUIProps,
  getPlayerName,
  getPlayerEmoji,
  playCardFlipSound,
  TEAM_COLORS,
} from '@/components/shared/gameDesign';
import { TeammateHandReveal } from '@/components/TeammateHandReveal';

// ===== TYPES =====
type SeatPosition = 'bottom' | 'top' | 'left' | 'right' | 'topLeft' | 'topRight';

interface PlayerSeatInfo {
  player: any;
  seat: SeatPosition;
  isActive: boolean;
  isYou: boolean;
}

// ===== ANIMATIONS =====
const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 8px rgba(212,160,23,0.4); }
  50% { box-shadow: 0 0 20px rgba(212,160,23,0.8); }
`;

const cardSlideIn = keyframes`
  from { opacity: 0; transform: scale(0.7) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
`;

// ===== MAIN CONTAINER =====
const TableContainer = styled.div`
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: radial-gradient(ellipse at center, #0f1f0f 0%, #050a05 100%);
  overflow: hidden;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: ${DESIGN.colors.text.primary};
  display: flex;
  flex-direction: column;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='0.5' fill='%23ffffff' opacity='0.02'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }
`;

// ===== TOP BAR =====
const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(10,18,10,0.7);
  backdrop-filter: blur(8px);
  z-index: 100;
  flex-shrink: 0;
  min-height: 44px;
  border-bottom: 1px solid rgba(212,160,23,0.1);
`;

const TopBarTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #d4a017;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const TopBarVersion = styled.span`
  font-size: 10px;
  color: ${DESIGN.colors.text.tertiary};
`;

const TopBarInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TopBarButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(212,160,23,0.15);
  background: rgba(19,33,19,0.8);
  color: ${DESIGN.colors.text.secondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;

  &:hover {
    color: #d4a017;
    border-color: #d4a017;
  }
`;

const RoundBadge = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${DESIGN.colors.text.secondary};
  background: rgba(19,33,19,0.8);
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid rgba(212,160,23,0.1);
  white-space: nowrap;
`;

// ===== TABLE AREA =====
const TableArea = styled.div`
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  overflow: hidden;
`;

// ===== OVAL FELT TABLE =====
const FeltTable = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(85%, 600px);
  height: min(65%, 420px);
  background: radial-gradient(ellipse at center, #1a5c33 0%, #0d3a1c 70%, #082a14 100%);
  border-radius: 50%;
  border: 6px solid #3d2a14;
  box-shadow:
    inset 0 0 80px rgba(0,0,0,0.5),
    inset 0 0 20px rgba(0,0,0,0.3),
    0 8px 40px rgba(0,0,0,0.7);
  z-index: 1;

  &::after {
    content: '';
    position: absolute;
    inset: 6px;
    border-radius: 50%;
    border: 2px solid rgba(212,160,23,0.08);
    pointer-events: none;
  }

  @media (max-width: 768px) {
    width: 90%;
    height: 55%;
  }
`;

// ===== TRUMP CARD BADGE (on table) =====
const TrumpOnTable = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  z-index: 2;
  opacity: 0.9;
`;

const TrumpMini = styled.div`
  position: relative;
  width: 40px;
  height: 56px;
  border-radius: 4px;
  overflow: hidden;
  border: 1.5px solid rgba(212,160,23,0.3);

  @media (min-width: 769px) {
    width: 50px;
    height: 70px;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const TrumpLabel = styled.span`
  font-size: 9px;
  color: rgba(212,160,23,0.6);
  text-transform: uppercase;
  letter-spacing: 1px;
`;

// ===== DECK BADGE =====
const DeckBadge = styled.div`
  position: absolute;
  top: 50%;
  left: calc(50% + 50px);
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  z-index: 2;

  @media (max-width: 768px) {
    left: calc(50% + 35px);
  }
`;

const DeckCount = styled.span`
  font-size: 10px;
  color: rgba(245,240,232,0.5);
  background: rgba(0,0,0,0.5);
  padding: 2px 6px;
  border-radius: 4px;
`;

// ===== PLAYER SEAT =====
const PlayerSeat = styled.div<{ seat: SeatPosition; isActive: boolean }>`
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  z-index: 10;

  ${props => props.seat === 'bottom' && `
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
  `}
  ${props => props.seat === 'top' && `
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
  `}
  ${props => props.seat === 'left' && `
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
  `}
  ${props => props.seat === 'right' && `
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
  `}
  ${props => props.seat === 'topLeft' && `
    top: 12px;
    left: 15%;
  `}
  ${props => props.seat === 'topRight' && `
    top: 12px;
    right: 15%;
  `}

  @media (max-width: 768px) {
    ${props => props.seat === 'bottom' && `bottom: 4px;`}
    ${props => props.seat === 'top' && `top: 4px;`}
    ${props => props.seat === 'left' && `left: 4px;`}
    ${props => props.seat === 'right' && `right: 4px;`}
  }
`;

const SeatAvatar = styled.div<{ isActive: boolean; teamColor?: string }>`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(19,33,19,0.9);
  backdrop-filter: blur(8px);
  border: 2px solid ${props => props.isActive ? '#d4a017' : props.teamColor ? `${props.teamColor}40` : 'rgba(212,160,23,0.15)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  line-height: 1;
  ${props => props.isActive && `animation: ${pulseGlow} 1.5s ease-in-out infinite;`}

  @media (min-width: 769px) {
    width: 52px;
    height: 52px;
    font-size: 26px;
  }
`;

const SeatName = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${DESIGN.colors.text.primary};
  background: rgba(0,0,0,0.6);
  padding: 2px 8px;
  border-radius: 6px;
  white-space: nowrap;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (min-width: 769px) {
    font-size: 13px;
    max-width: 120px;
  }
`;

const TeamBadge = styled.span<{ team: number }>`
  font-size: 8px;
  font-weight: 700;
  color: ${props => TEAM_COLORS[props.team] || DESIGN.colors.text.tertiary};
  background: ${props => `${TEAM_COLORS[props.team] || DESIGN.colors.text.tertiary}20`};
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.5px;
`;

// ===== PLAYED CARD ON TABLE =====
const PlayedCardSpot = styled.div<{ seat: SeatPosition }>`
  position: absolute;
  z-index: 5;

  ${props => props.seat === 'bottom' && `
    bottom: 28%;
    left: 50%;
    transform: translateX(-50%);
  `}
  ${props => props.seat === 'top' && `
    top: 28%;
    left: 50%;
    transform: translateX(-50%);
  `}
  ${props => props.seat === 'left' && `
    left: 22%;
    top: 50%;
    transform: translateY(-50%);
  `}
  ${props => props.seat === 'right' && `
    right: 22%;
    top: 50%;
    transform: translateY(-50%);
  `}
  ${props => props.seat === 'topLeft' && `
    top: 25%;
    left: 30%;
  `}
  ${props => props.seat === 'topRight' && `
    top: 25%;
    right: 30%;
  `}

  @media (max-width: 768px) {
    ${props => props.seat === 'bottom' && `bottom: 24%;`}
    ${props => props.seat === 'top' && `top: 24%;`}
    ${props => props.seat === 'left' && `left: 18%;`}
    ${props => props.seat === 'right' && `right: 18%;`}
  }
`;

const PlayedCardWrapper = styled.div`
  animation: ${cardSlideIn} 300ms ease-out;
`;

const PlaySlot = styled.div<{ isEmpty: boolean; isWinner: boolean; isFadingOut: boolean }>`
  width: 60px;
  height: 84px;

  @media (min-width: 769px) {
    width: 80px;
    height: 112px;
  }

  ${props => props.isWinner && css`
    &::before {
      content: '';
      position: absolute;
      inset: -4px;
      border: 2px solid #d4a017;
      border-radius: 8px;
      animation: ${borderGlow} 0.6s ease forwards, ${borderFadeOut} 0.3s ease 1s forwards;
    }
  `}

  ${props => props.isFadingOut && css`
    animation: ${fadeOut} 250ms ease forwards;
  `}
`;

// ===== HAND DOCK (bottom - your cards) =====
const HandDock = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: flex-end;
  padding: 8px;
  z-index: 50;
  flex-shrink: 0;

  @media (min-width: 769px) {
    gap: 12px;
    padding: 12px;
  }
`;

const HandCardWrapper = styled.div<{ isPlayable: boolean; entranceDelay: number }>`
  flex-shrink: 0;
  cursor: ${props => props.isPlayable ? 'pointer' : 'default'};
  opacity: ${props => props.isPlayable ? 1 : 0.5};
  transition: transform 200ms ease;
  animation: ${cardEntrance} 200ms ease ${props => props.entranceDelay}ms both;

  &:hover {
    ${props => props.isPlayable && `transform: translateY(-10px);`}
  }

  @media (min-width: 769px) {
    &:hover {
      ${props => props.isPlayable && `transform: translateY(-14px);`}
    }
  }
`;

// ===== GAME OVER =====
const GameOverOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

const GameOverDialog = styled.div`
  background: rgba(19,33,19,0.96);
  backdrop-filter: blur(12px);
  border-radius: ${DESIGN.radius.containers};
  padding: ${DESIGN.spacing.xl};
  text-align: center;
  max-width: 460px;
  width: 100%;
  border: 1px solid rgba(212,160,23,0.3);
  max-height: 85vh;
  overflow-y: auto;
`;

const GameOverTitle = styled.h2`
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 700;
  margin: 0 0 16px 0;
  color: #d4a017;
`;

const WinnerName = styled.div`
  font-size: 22px;
  font-weight: 600;
  color: #d4a017;
  margin-bottom: 4px;
`;

const WinnerScore = styled.div`
  font-size: 14px;
  color: ${DESIGN.colors.text.secondary};
`;

const ScoresGrid = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 12px;
`;

const ScoreRow = styled.div<{ isWinner: boolean }>`
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: ${props => props.isWinner ? DESIGN.colors.surfaces.elevated : 'rgba(19,33,19,0.6)'};
  border: 1px solid ${props => props.isWinner ? '#d4a017' : 'rgba(212,160,23,0.08)'};
  border-radius: 8px;
  font-size: 13px;

  div:first-child { color: ${DESIGN.colors.text.primary}; }
  div:last-child { color: ${props => props.isWinner ? '#d4a017' : DESIGN.colors.accents.cyan}; font-weight: 600; }
`;

const PlayAgainButton = styled.button`
  margin-top: 16px;
  padding: 12px 24px;
  background: #d4a017;
  color: #0a120a;
  border: none;
  border-radius: ${DESIGN.radius.buttons};
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  width: 100%;
  transition: transform 150ms;

  &:active { transform: scale(0.97); }
`;

// ===== HELPER: assign seats =====
const assignSeats = (players: any[], currentPlayerId: string, teams?: { [id: string]: number }): Map<string, SeatPosition> => {
  const seats = new Map<string, SeatPosition>();
  const myIndex = players.findIndex(p => p.id === currentPlayerId);
  const n = players.length;

  if (n === 2) {
    seats.set(players[myIndex].id, 'bottom');
    seats.set(players[(myIndex + 1) % n].id, 'top');
  } else if (n === 3) {
    seats.set(players[myIndex].id, 'bottom');
    seats.set(players[(myIndex + 1) % n].id, 'topRight');
    seats.set(players[(myIndex + 2) % n].id, 'topLeft');
  } else if (n === 4) {
    // 2v2: teammates face each other
    if (teams) {
      const myTeam = teams[currentPlayerId];
      const teammate = players.find(p => p.id !== currentPlayerId && teams[p.id] === myTeam);
      const opponents = players.filter(p => teams[p.id] !== myTeam);
      seats.set(currentPlayerId, 'bottom');
      if (teammate) seats.set(teammate.id, 'top');
      if (opponents[0]) seats.set(opponents[0].id, 'left');
      if (opponents[1]) seats.set(opponents[1].id, 'right');
    } else {
      seats.set(players[myIndex].id, 'bottom');
      seats.set(players[(myIndex + 1) % n].id, 'left');
      seats.set(players[(myIndex + 2) % n].id, 'top');
      seats.set(players[(myIndex + 3) % n].id, 'right');
    }
  }

  return seats;
};

// ===== MAIN COMPONENT =====
export const RoundTableGameUI: React.FC<GameUIProps> = ({
  gameState,
  players,
  currentPlayerId,
  onCardPlay,
  onPlayAgain,
  onStartSecondSmazzata,
  isHost: isHostPlayer,
  onQuickChat,
  quickChatMessage,
}) => {
  const playerHand = gameState.playerHands[currentPlayerId] || [];
  const currentTurnIndex = gameState.currentTurnPlayerIndex;
  const isCurrentPlayerTurn = gameState.phase === 'playing' && currentTurnIndex === players.findIndex(p => p.id === currentPlayerId);
  const teams = gameState.teams;
  const isTeamMode = !!teams;
  const myTeam = teams ? teams[currentPlayerId] : null;

  const [showRules, setShowRules] = useState(false);
  const [showQuickChat, setShowQuickChat] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Online status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  // Card flip sound
  const prevPlayedCountRef = useRef(gameState.playedCards.length);
  useEffect(() => {
    if (gameState.playedCards.length > prevPlayedCountRef.current) {
      playCardFlipSound();
    }
    prevPlayedCountRef.current = gameState.playedCards.length;
  }, [gameState.playedCards.length]);

  // Fade out animation
  useEffect(() => {
    if (gameState.phase === 'round_complete') {
      setIsFadingOut(false);
      const t = setTimeout(() => setIsFadingOut(true), 1200);
      return () => clearTimeout(t);
    } else {
      setIsFadingOut(false);
    }
  }, [gameState.phase, gameState.roundNumber]);

  // Teammate reveal
  const [revealTimeLeft, setRevealTimeLeft] = useState(5000);
  useEffect(() => {
    if (gameState.phase !== 'revealing_hands') return;
    setRevealTimeLeft(5000);
    const interval = setInterval(() => setRevealTimeLeft(prev => Math.max(0, prev - 100)), 100);
    return () => clearInterval(interval);
  }, [gameState.phase]);

  const teammate = isTeamMode && myTeam
    ? players.find(p => p.id !== currentPlayerId && teams[p.id] === myTeam) || null
    : null;
  const teammateHand = teammate ? (gameState.playerHands[teammate.id] || []) : [];

  // Assign seats
  const seatMap = assignSeats(players, currentPlayerId, teams);
  const playedCards = gameState.playedCards;
  const roundWinnerId = gameState.phase === 'round_complete' ? gameState.roundWinnerId : null;

  // ===== GAME OVER =====
  if (gameState.phase === 'game_over') {
    const scores = gameState.finalScores;
    const winner = gameState.gameWinnerId;
    const winnerPlayer = winner ? players.find(p => p.id === winner) : null;
    const isDraw = !winner;
    const isTeamDraw = isTeamMode && (!gameState.winnerTeam || gameState.winnerTeam === 0);

    return (
      <TableContainer>
        <GameOverOverlay>
          <GameOverDialog>
            <GameOverTitle>PARTITA FINITA</GameOverTitle>
            {isTeamMode ? (
              <>
                <WinnerName style={{ color: isTeamDraw ? DESIGN.colors.accents.cyan : TEAM_COLORS[gameState.winnerTeam!] }}>
                  {isTeamDraw ? 'PAREGGIO!' : `SQUADRA ${gameState.winnerTeam} VINCE!`}
                </WinnerName>
                <WinnerScore>
                  {isTeamDraw ? `${gameState.teamScores?.['1'] || 0} punti ciascuno`
                    : `${gameState.teamScores?.[String(gameState.winnerTeam)] || 0} punti`}
                </WinnerScore>
                <ScoresGrid>
                  {[1, 2].map(t => (
                    <ScoreRow key={t} isWinner={!isTeamDraw && t === gameState.winnerTeam}>
                      <div style={{ color: TEAM_COLORS[t] }}>Squadra {t}</div>
                      <div>{gameState.teamScores?.[String(t)] || 0}</div>
                    </ScoreRow>
                  ))}
                </ScoresGrid>
              </>
            ) : isDraw ? (
              <>
                <WinnerName style={{ color: DESIGN.colors.accents.cyan }}>PAREGGIO!</WinnerName>
                <WinnerScore>{Math.max(...Object.values(scores))} punti ciascuno</WinnerScore>
                <ScoresGrid>
                  {[...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)).map((p, i) => (
                    <ScoreRow key={p.id} isWinner={scores[p.id] === Math.max(...Object.values(scores))}>
                      <div>{i + 1}. {getPlayerName(p)}</div>
                      <div>{scores[p.id] || 0}</div>
                    </ScoreRow>
                  ))}
                </ScoresGrid>
              </>
            ) : (
              <>
                <WinnerName>{getPlayerName(winnerPlayer!)}</WinnerName>
                <WinnerScore>{scores[winner!]} punti</WinnerScore>
                <ScoresGrid>
                  {[...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)).map((p, i) => (
                    <ScoreRow key={p.id} isWinner={p.id === winner}>
                      <div>{i + 1}. {getPlayerName(p)}</div>
                      <div>{scores[p.id] || 0}</div>
                    </ScoreRow>
                  ))}
                </ScoresGrid>
              </>
            )}
            {/* Smazzate breakdown */}
            {gameState.smazzata1Scores && gameState.smazzata2Scores && (
              <div style={{ marginTop: '12px', padding: '10px', background: DESIGN.colors.surfaces.elevated, borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: DESIGN.colors.text.tertiary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Riepilogo Smazzate</div>
                {isTeamMode ? (
                  [1, 2].map(t => (
                    <div key={t} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: TEAM_COLORS[t], fontSize: '13px' }}>
                      <span>Squadra {t}</span>
                      <span>{gameState.smazzata1TeamScores?.[String(t)] || 0} — {gameState.smazzata2TeamScores?.[String(t)] || 0}</span>
                    </div>
                  ))
                ) : (
                  [...players].map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: DESIGN.colors.text.secondary, fontSize: '13px' }}>
                      <span>{getPlayerName(p)}</span>
                      <span>{gameState.smazzata1Scores?.[p.id] || 0} — {gameState.smazzata2Scores?.[p.id] || 0}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            {isHostPlayer && onPlayAgain && (
              <PlayAgainButton onClick={onPlayAgain}>RIGIOCA</PlayAgainButton>
            )}
            {!isHostPlayer && (
              <div style={{ marginTop: '12px', fontSize: '12px', color: DESIGN.colors.text.tertiary }}>In attesa dell'host...</div>
            )}
            <MatchHistoryButton roundHistory={gameState.roundHistory} players={players} />
          </GameOverDialog>
        </GameOverOverlay>
      </TableContainer>
    );
  }

  // ===== SMAZZATA COMPLETE =====
  if (gameState.phase === 'smazzata_complete') {
    const scores = gameState.finalScores;
    return (
      <TableContainer>
        <GameOverOverlay>
          <GameOverDialog>
            <GameOverTitle>SMAZZATA 1</GameOverTitle>
            <WinnerName style={{ color: DESIGN.colors.accents.cyan, fontSize: '16px' }}>PROSSIMA SMAZZATA</WinnerName>
            <ScoresGrid>
              {[...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)).map((p, i) => (
                <ScoreRow key={p.id} isWinner={false}>
                  <div>{i + 1}. {getPlayerName(p)}</div>
                  <div>{scores[p.id] || 0}</div>
                </ScoreRow>
              ))}
            </ScoresGrid>
            {isTeamMode && gameState.teamScores && (
              <div style={{ marginTop: '8px' }}>
                <ScoresGrid>
                  {[1, 2].map(t => (
                    <ScoreRow key={t} isWinner={false}>
                      <div style={{ color: TEAM_COLORS[t] }}>Squadra {t}</div>
                      <div>{gameState.teamScores?.[String(t)] || 0}</div>
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
      </TableContainer>
    );
  }

  // ===== GAME VIEW (Round Table) =====
  return (
    <TableContainer>
      {/* Top Bar */}
      <TopBar>
        <TopBarTitle>
          BRISCOLA NAPOLETANA<TopBarVersion>v{packageJson.version}</TopBarVersion>
        </TopBarTitle>
        <TopBarInfo>
          <RoundBadge>Smazzata {gameState.smazzataNumber} · Turno {gameState.roundNumber}</RoundBadge>
          <TopBarButton onClick={() => setShowRules(true)} title="Come si gioca">
            <RulesIcon />
          </TopBarButton>
          {onQuickChat && (
            <TopBarButton onClick={() => setShowQuickChat(true)} title="Chat">
              <QuickChatIcon />
            </TopBarButton>
          )}
          {isOnline
            ? <Wifi size={14} color="#d4a017" />
            : <WifiOff size={14} color="#e63946" />
          }
        </TopBarInfo>
      </TopBar>

      {/* Table Area */}
      <TableArea>
        <FeltTable />

        {/* Trump card + deck in center */}
        {gameState.trumpCard && (
          <TrumpOnTable>
            <TrumpMini>
              <img src={gameState.trumpCard.imagePath} alt={gameState.trumpCard.name} />
            </TrumpMini>
            <TrumpLabel>Briscola</TrumpLabel>
          </TrumpOnTable>
        )}
        {gameState.deck.length > 0 && (
          <DeckBadge>
            <DeckCount>{gameState.deck.length}</DeckCount>
          </DeckBadge>
        )}

        {/* Played cards on the table */}
        {playedCards.map((pc, idx) => {
          const seat = seatMap.get(pc.playerId);
          if (!seat) return null;
          const isWinner = roundWinnerId === pc.playerId;
          return (
            <PlayedCardSpot key={idx} seat={seat}>
              <PlayedCardWrapper>
                <PlaySlot isEmpty={false} isWinner={isWinner} isFadingOut={isFadingOut}>
                  <CardComponent
                    card={pc.card}
                    onClick={() => {}}
                    transform={pc.transform}
                    colors={cardColors}
                    fillContainer
                  />
                </PlaySlot>
              </PlayedCardWrapper>
            </PlayedCardSpot>
          );
        })}

        {/* Player Seats */}
        {players.map((player, index) => {
          const seat = seatMap.get(player.id);
          if (!seat) return null;
          const isActive = currentTurnIndex === index;
          const isYou = player.id === currentPlayerId;
          const playerTeam = teams ? teams[player.id] : undefined;

          return (
            <PlayerSeat key={player.id} seat={seat} isActive={isActive}>
              <SeatAvatar isActive={isActive} teamColor={playerTeam ? TEAM_COLORS[playerTeam] : undefined}>
                {getPlayerEmoji(player)}
              </SeatAvatar>
              <SeatName>
                {isYou ? 'Tu' : getPlayerName(player)}
              </SeatName>
              {isTeamMode && playerTeam && (
                <TeamBadge team={playerTeam}>S{playerTeam}</TeamBadge>
              )}
            </PlayerSeat>
          );
        })}
      </TableArea>

      {/* Hand dock at bottom */}
      <HandDock>
        {playerHand.map((card, idx) => (
          <HandCardWrapper
            key={`${gameState.roundNumber}_${card.id}`}
            isPlayable={isCurrentPlayerTurn}
            entranceDelay={idx * 60}
            onClick={() => isCurrentPlayerTurn && onCardPlay(card)}
          >
            <CardComponent
              card={card}
              onClick={() => isCurrentPlayerTurn && onCardPlay(card)}
              transform=""
              colors={cardColors}
              size="small"
            />
          </HandCardWrapper>
        ))}
      </HandDock>

      {/* Modals */}
      {showRules && <RulesPopup onClose={() => setShowRules(false)} />}
      {showQuickChat && onQuickChat && (
        <QuickChatPopup onClose={() => setShowQuickChat(false)} onSend={onQuickChat} />
      )}
      {quickChatMessage && quickChatMessage.ts > 0 && (
        <QuickChatBubble message={quickChatMessage} players={players} currentPlayerId={currentPlayerId} />
      )}
      {gameState.phase === 'revealing_hands' && isTeamMode && teammate && (
        <TeammateHandReveal
          teammateHand={teammateHand}
          teammate={teammate}
          myTeam={myTeam!}
          timeLeft={revealTimeLeft}
        />
      )}
    </TableContainer>
  );
};

export default RoundTableGameUI;
