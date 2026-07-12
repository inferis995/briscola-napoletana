"use client";

import React, { useState, useEffect, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { CardComponent } from '@/components/Card';
import { MatchHistoryButton } from '@/components/MatchHistory';
import { RulesPopup, RulesIcon } from '@/components/RulesPopup';
import { QuickChatPopup, QuickChatBubble, QuickChatIcon } from '@/components/QuickChat';
import { Wifi, WifiOff, Volume2, VolumeX } from 'lucide-react';
import packageJson from '../../package.json';
import {
  DESIGN,
  cardColors,
  GameUIProps,
  getPlayerName,
  getPlayerEmoji,
  playCardFlipSound,
  playableGlow,
  TEAM_COLORS,
} from '@/components/shared/gameDesign';
import { useTurnCountdown, TimerChip } from '@/components/shared/TurnTimer';
import { useGameFeedback } from '@/components/shared/useGameFeedback';
import { isSoundEnabled, setSoundEnabled } from '@/components/shared/soundEffects';
import { TeammateHandReveal } from '@/components/TeammateHandReveal';

// ===== TYPES =====
type SeatPosition = 'bottom' | 'top' | 'left' | 'right' | 'topLeft' | 'topRight';

// Vettori direzionali dei posti: usati per animare la presa verso il vincitore
const SEAT_VECTORS: Record<SeatPosition, [number, number]> = {
  bottom: [0, 1],
  top: [0, -1],
  left: [-1, 0],
  right: [1, 0],
  topLeft: [-0.8, -1],
  topRight: [0.8, -1],
};

// ===== ANIMATIONS =====
const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 8px rgba(212,160,23,0.4); }
  50% { box-shadow: 0 0 20px rgba(212,160,23,0.8); }
`;

const cardSlideIn = keyframes`
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
`;

const handEntrance = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
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

  /* Luce dall'alto + vignettatura + texture */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(ellipse at 50% -10%, rgba(255, 240, 190, 0.06) 0%, transparent 55%),
      radial-gradient(ellipse at center, transparent 58%, rgba(0, 0, 0, 0.5) 100%),
      url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='0.5' fill='%23ffffff' opacity='0.02'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }
`;

// ===== TOP BAR =====
const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px max(10px, env(safe-area-inset-top, 10px));
  background: rgba(6,10,6,0.85);
  backdrop-filter: blur(10px);
  z-index: 100;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(212,160,23,0.12);
`;

const TopBarTitle = styled.div`
  font-family: var(--font-display), 'Times New Roman', serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
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
  width: min(92%, 720px);
  height: min(72%, 480px);
  background:
    radial-gradient(ellipse at 38% 28%, rgba(255, 255, 255, 0.07) 0%, transparent 55%),
    radial-gradient(ellipse at center, #1f7343 0%, #14522f 48%, #0b3a1c 82%, #072812 100%);
  border-radius: 50%;
  box-shadow:
    inset 0 0 110px rgba(0, 0, 0, 0.6),
    inset 0 0 34px rgba(0, 0, 0, 0.45),
    inset 0 2px 5px rgba(255, 255, 255, 0.09);
  z-index: 1;

  /* Cornice in legno con luce e profondità */
  &::before {
    content: '';
    position: absolute;
    inset: -14px;
    border-radius: 50%;
    background: linear-gradient(145deg, #5a3d1e 0%, #33200c 40%, #45290f 65%, #1e1206 100%);
    box-shadow:
      0 18px 60px rgba(0, 0, 0, 0.8),
      inset 0 2px 3px rgba(255, 255, 255, 0.18),
      inset 0 -3px 6px rgba(0, 0, 0, 0.6);
    z-index: -1;
  }

  /* Filo dorato interno */
  &::after {
    content: '';
    position: absolute;
    inset: 10px;
    border-radius: 50%;
    border: 1.5px solid rgba(212, 160, 23, 0.16);
    box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.25);
    pointer-events: none;
  }

  @media (max-width: 768px) {
    width: 94%;
    height: 66%;

    &::before {
      inset: -9px;
    }
  }
`;

// ===== CENTRO TAVOLO: tallone col dorso vero + briscola coricata sotto =====
const CenterPile = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 150px;
  height: 92px;
  z-index: 2;

  @media (max-width: 768px) {
    width: 120px;
    height: 74px;
  }
`;

// La briscola scoperta giace di traverso sotto il tallone (look classico)
const TrumpUnder = styled.div`
  position: absolute;
  top: 50%;
  left: 62%;
  width: 62px;
  height: 87px;
  transform: translate(-50%, -50%) rotate(90deg);
  border-radius: 5px;
  overflow: hidden;
  border: 1.5px solid rgba(212, 160, 23, 0.4);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.55);
  z-index: 1;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  @media (max-width: 768px) {
    width: 50px;
    height: 70px;
    left: 60%;
  }
`;

// Briscola in piedi al centro quando il tallone è finito (sta per essere pescata)
const TrumpUpright = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 62px;
  height: 87px;
  transform: translate(-50%, -50%);
  border-radius: 5px;
  overflow: hidden;
  border: 1.5px solid rgba(212, 160, 23, 0.4);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.55);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  @media (max-width: 768px) {
    width: 50px;
    height: 70px;
  }
`;

const DeckPile = styled.div`
  position: absolute;
  top: 50%;
  left: 30%;
  width: 62px;
  height: 87px;
  transform: translate(-50%, -50%);
  border-radius: 5px;
  box-shadow:
    2px 2px 0 rgba(0, 0, 0, 0.35),
    4px 4px 0 rgba(0, 0, 0, 0.25),
    0 8px 18px rgba(0, 0, 0, 0.55);
  z-index: 2;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: 5px;
    border: 1px solid rgba(0, 0, 0, 0.4);
  }

  @media (max-width: 768px) {
    width: 50px;
    height: 70px;
  }
`;

const DeckCountBadge = styled.span`
  position: absolute;
  bottom: -7px;
  right: -7px;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border-radius: 11px;
  background: #d4a017;
  color: #0a120a;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  font-variant-numeric: tabular-nums;
  z-index: 3;
`;

const PileLabel = styled.span`
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: rgba(212, 160, 23, 0.65);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-weight: 600;
  white-space: nowrap;
`;

// ===== PUNTI DELLA PRESA (visibili solo durante la raccolta) =====
const pointsPop = keyframes`
  0% { opacity: 0; transform: scale(0.4) translateY(8px); }
  14% { opacity: 1; transform: scale(1.18) translateY(0); }
  24% { transform: scale(1); }
  72% { opacity: 1; transform: scale(1) translateY(0); }
  100% { opacity: 0; transform: scale(0.85) translateY(-24px); }
`;

const TrickPointsFloat = styled.div`
  position: absolute;
  z-index: 30;
  transform: translate(-50%, -50%);
  pointer-events: none;
`;

const TrickPointsInner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(6, 10, 6, 0.88);
  border: 1.5px solid rgba(212, 160, 23, 0.55);
  border-radius: 12px;
  padding: 6px 16px 7px;
  box-shadow: 0 0 22px rgba(212, 160, 23, 0.35), 0 6px 18px rgba(0, 0, 0, 0.5);
  animation: ${pointsPop} 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;

  b {
    font-size: 24px;
    color: #f0cf7a;
    line-height: 1.05;
    text-shadow: 0 0 12px rgba(212, 160, 23, 0.6);
    font-variant-numeric: tabular-nums;
  }

  span {
    font-size: 8px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(212, 160, 23, 0.8);
    font-weight: 700;
  }
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
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(13,26,13,0.92);
  backdrop-filter: blur(8px);
  border: 2.5px solid ${props => props.isActive ? '#d4a017' : props.teamColor ? `${props.teamColor}50` : 'rgba(212,160,23,0.2)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  line-height: 1;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  ${props => props.isActive && css`animation: ${pulseGlow} 1.5s ease-in-out infinite;`}

  @media (min-width: 769px) {
    width: 56px;
    height: 56px;
    font-size: 28px;
  }
`;

const SeatName = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${DESIGN.colors.text.primary};
  background: rgba(0,0,0,0.7);
  border: 1px solid rgba(212,160,23,0.18);
  padding: 2px 10px;
  border-radius: 8px;
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);

  @media (min-width: 769px) {
    font-size: 13px;
    max-width: 130px;
    padding: 3px 12px;
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
    ${props => props.seat === 'bottom' && `bottom: 22%;`}
    ${props => props.seat === 'top' && `top: 22%;`}
    ${props => props.seat === 'left' && `left: 12%;`}
    ${props => props.seat === 'right' && `right: 12%;`}
    ${props => props.seat === 'topLeft' && `top: 23%; left: 26%;`}
    ${props => props.seat === 'topRight' && `top: 23%; right: 26%;`}
  }
`;

const PlayedCardWrapper = styled.div`
  animation: ${cardSlideIn} 300ms ease-out;
`;

const winnerRing = keyframes`
  0% { opacity: 0; transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
`;

const PlaySlot = styled.div<{ isEmpty: boolean; isWinner: boolean; isFadingOut: boolean; collectDx?: number; collectDy?: number }>`
  position: relative;
  /* Stesse proporzioni della carta (0.65): l'immagine riempie senza bande */
  width: 60px;
  aspect-ratio: 0.65;
  filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.45));

  @media (min-width: 769px) {
    width: 80px;
  }

  /* Raccolta: le carte scivolano verso il vincitore e svaniscono */
  ${props => props.isFadingOut && css`
    transform: translate(${props.collectDx ?? 0}px, ${props.collectDy ?? 0}px) scale(0.45);
    opacity: 0;
    transition: transform 450ms cubic-bezier(0.55, 0, 0.8, 0.4), opacity 420ms ease-in;
  `}
`;

// Porta la rotazione casuale della carta E l'anello del vincitore:
// ruotando insieme, la cornice contorna la carta con precisione
const TiltWrap = styled.div<{ isWinner: boolean }>`
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 6px;

  ${props => props.isWinner && css`
    &::after {
      content: '';
      position: absolute;
      inset: -3px;
      border: 2.5px solid #d4a017;
      border-radius: 8px;
      box-shadow: 0 0 18px rgba(212, 160, 23, 0.55), inset 0 0 10px rgba(212, 160, 23, 0.2);
      pointer-events: none;
      animation: ${winnerRing} 400ms ease-out;
      z-index: 10;
    }
  `}
`;

// Ritaglia gli angoli della carta (l'anello vive sul TiltWrap, fuori dal clip)
const CardClip = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 6px;
  overflow: hidden;
`;

// ===== QUICK CHAT BAR (always visible) =====
const QuickChatBar = styled.form`
  display: flex;
  gap: 6px;
  padding: 6px 10px max(6px, env(safe-area-inset-bottom, 6px));
  background: rgba(6,10,6,0.85);
  backdrop-filter: blur(8px);
  z-index: 60;
  flex-shrink: 0;
  border-top: 1px solid rgba(212,160,23,0.08);
  align-items: center;
`;

const QuickChatInput = styled.input`
  flex: 1;
  padding: 8px 12px;
  border-radius: 20px;
  border: 1px solid rgba(212,160,23,0.15);
  background: rgba(19,33,19,0.9);
  color: ${DESIGN.colors.text.primary};
  font-size: 14px;
  outline: none;
  transition: border-color 150ms;
  min-width: 0;

  &:focus {
    border-color: #d4a017;
  }

  &::placeholder {
    color: ${DESIGN.colors.text.tertiary};
  }
`;

const QuickChatSend = styled.button`
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: #d4a017;
  color: #0a120a;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 150ms;

  &:active { transform: scale(0.92); }
  &:disabled { opacity: 0.4; cursor: default; }
`;

const QuickChatToggle = styled.button`
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(212,160,23,0.15);
  background: rgba(19,33,19,0.9);
  color: ${DESIGN.colors.text.secondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active { transform: scale(0.92); }
`;

// ===== HAND DOCK (bottom - your cards) =====
const HandDock = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: flex-end;
  padding: 10px 8px max(12px, env(safe-area-inset-bottom, 12px));
  z-index: 50;
  flex-shrink: 0;
  background: linear-gradient(to top, rgba(6,10,6,0.9) 0%, rgba(6,10,6,0.4) 60%, transparent 100%);

  @media (min-width: 769px) {
    gap: 14px;
    padding: 16px 12px max(16px, env(safe-area-inset-bottom, 16px));
  }
`;

const HandCardWrapper = styled.div<{ entranceDelay: number }>`
  flex-shrink: 0;
  animation: ${handEntrance} 240ms ease-out ${props => props.entranceDelay}ms both;
`;

// Ventaglio: rotazione/arco separati dall'entrance animation
const FanWrap = styled.div`
  transform-origin: 50% 135%;
  transition: transform 200ms ease-out;
`;

const CardLift = styled.div<{ isPlayable: boolean }>`
  cursor: ${props => props.isPlayable ? 'pointer' : 'default'};
  opacity: ${props => props.isPlayable ? 1 : 0.55};
  transition: transform 200ms ease, opacity 200ms ease;
  border-radius: 8px;

  ${props => props.isPlayable && css`
    animation: ${playableGlow} 2.2s ease-in-out infinite;
  `}

  &:hover {
    ${props => props.isPlayable && `transform: translateY(-10px);`}
  }

  &:active {
    ${props => props.isPlayable && `transform: translateY(-12px) scale(1.04);`}
  }

  @media (min-width: 769px) {
    &:hover {
      ${props => props.isPlayable && `transform: translateY(-14px);`}
    }
  }
`;

const TurnHint = styled.div<{ mine: boolean }>`
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: ${props => props.mine ? '#d4a017' : DESIGN.colors.text.tertiary};
  padding: 4px 0 0;
  z-index: 50;
  animation: ${handEntrance} 250ms ease-out;
`;

const ReconnectingTag = styled.span`
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: ${DESIGN.colors.accents.pink};
  background: rgba(230, 57, 70, 0.14);
  border: 1px solid rgba(230, 57, 70, 0.4);
  padding: 1px 6px;
  border-radius: 3px;
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

// ===== HELPER: posti FISSI per tutta la partita =====
// Derivati dall'ordine dei posti (chiavi di playerHands), MAI dal turnOrder:
// il turnOrder cambia a ogni presa (il vincitore guida) e farebbe "saltare"
// i giocatori da una sedia all'altra. La sedia si assegna una volta sola.
const assignSeats = (
  seatIds: string[],
  currentPlayerId: string,
  teams?: { [id: string]: number }
): Map<string, SeatPosition> => {
  const seats = new Map<string, SeatPosition>();
  const n = seatIds.length;
  const myIdx = seatIds.indexOf(currentPlayerId);
  if (myIdx === -1) return seats;

  // 2v2: compagno sempre di fronte, avversari ai lati
  if (n === 4 && teams && teams[currentPlayerId]) {
    const myTeam = teams[currentPlayerId];
    const teammate = seatIds.find(id => id !== currentPlayerId && teams[id] === myTeam);
    const opponents = seatIds.filter(id => teams[id] !== myTeam);
    seats.set(currentPlayerId, 'bottom');
    if (teammate) seats.set(teammate, 'top');
    if (opponents[0]) seats.set(opponents[0], 'right');
    if (opponents[1]) seats.set(opponents[1], 'left');
    return seats;
  }

  // Giro antiorario: chi gioca dopo di me siede alla mia destra
  const rotated: string[] = [];
  for (let i = 0; i < n; i++) {
    rotated.push(seatIds[(myIdx - i + n) % n]);
  }

  seats.set(rotated[0], 'bottom');
  if (n === 2) {
    seats.set(rotated[1], 'top');
  } else if (n === 3) {
    seats.set(rotated[1], 'topRight');
    seats.set(rotated[2], 'topLeft');
  } else if (n === 4) {
    seats.set(rotated[1], 'right');
    seats.set(rotated[2], 'top');
    seats.set(rotated[3], 'left');
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
  // Rete di sicurezza: mai renderizzare due volte la stessa carta, anche se
  // arrivasse uno stato transitorio in conflitto durante un lag
  const playerHand = (gameState.playerHands[currentPlayerId] || []).filter(
    (card, idx, arr) => arr.findIndex(c => c.id === card.id) === idx
  );
  const teams = gameState.teams;
  const isTeamMode = !!teams;
  const myTeam = teams ? teams[currentPlayerId] : null;

  // Il turno si determina dall'ordine dei posti (chiavi di playerHands), non
  // dall'ordine della lista connessi: dopo una riconnessione i due divergono
  const seatIds = Object.keys(gameState.playerHands);
  const activeTurnPlayerId = gameState.phase === 'playing'
    ? (gameState.turnOrder
        ? gameState.turnOrder[gameState.playedCards.length]
        : seatIds[gameState.currentTurnPlayerIndex]) || null
    : null;
  const isCurrentPlayerTurn = activeTurnPlayerId === currentPlayerId;

  const [showRules, setShowRules] = useState(false);
  const [showQuickChat, setShowQuickChat] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showChatBar, setShowChatBar] = useState(false);

  // Turn timer
  const secondsLeft = useTurnCountdown(gameState.turnDeadline, gameState.phase === 'playing', isCurrentPlayerTurn);

  // Feedback audio/tattile: tuo turno, presa vinta/persa, vittoria/sconfitta
  useGameFeedback(gameState, currentPlayerId, isCurrentPlayerTurn);

  // Toggle audio (inizializzato in effect per evitare mismatch SSR)
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => { setSoundOn(isSoundEnabled()); }, []);
  const toggleSound = () => {
    setSoundEnabled(!soundOn);
    setSoundOn(!soundOn);
  };

  // Nome robusto: displayName → registro posti → 'Giocatore'
  // (mai il nickname casuale di Playroom)
  const resolveSeatDisplay = (sid: string): { name: string; emoji: string; connected: boolean } => {
    const player = players.find(p => p.id === sid);
    const owner = gameState.seatOwners?.[sid];
    if (player) {
      const stateName = player.getState?.('displayName');
      const name = stateName ? getPlayerName(player) : (owner?.name || 'Giocatore');
      return { name, emoji: getPlayerEmoji(player), connected: true };
    }
    return { name: owner?.name || 'Giocatore', emoji: owner?.emoji || '🔌', connected: false };
  };

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

  // Fade out animation (raccolta a 1.1s, dura 450ms, l'host risolve a 1.6s)
  useEffect(() => {
    if (gameState.phase === 'round_complete') {
      setIsFadingOut(false);
      const t = setTimeout(() => setIsFadingOut(true), 1100);
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

  // Posti fissi per tutta la partita
  const seatMap = assignSeats(seatIds, currentPlayerId, teams);
  const playedCards = gameState.playedCards;
  const roundWinnerId = gameState.phase === 'round_complete' ? gameState.roundWinnerId : null;
  const winnerSeat = roundWinnerId ? seatMap.get(roundWinnerId) : undefined;
  // Punti della presa corrente: mostrati solo durante l'animazione di raccolta
  const trickPoints = roundWinnerId
    ? playedCards.reduce((t, pc) => t + pc.card.score, 0)
    : 0;

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
          BRISCOLA<TopBarVersion>v{packageJson.version}</TopBarVersion>
        </TopBarTitle>
        <TopBarInfo>
          <RoundBadge>{gameState.smazzataNumber > 1 ? `S${gameState.smazzataNumber} · ` : ''}T{gameState.roundNumber}</RoundBadge>
          {secondsLeft !== null && (
            <TimerChip urgent={secondsLeft <= 5}>{secondsLeft}s</TimerChip>
          )}
          <TopBarButton onClick={toggleSound} title={soundOn ? 'Disattiva audio' : 'Attiva audio'}>
            {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </TopBarButton>
          <TopBarButton onClick={() => setShowRules(true)} title="Come si gioca">
            <RulesIcon />
          </TopBarButton>
          {onQuickChat && (
            <TopBarButton onClick={() => { setShowChatBar(!showChatBar); setShowQuickChat(false); }} title="Chat veloce">
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

        {/* Centro tavolo: tallone col dorso vero, briscola coricata sotto */}
        <CenterPile>
          {gameState.trumpCard && gameState.deck.length > 0 && (
            <TrumpUnder>
              <img src={gameState.trumpCard.imagePath} alt="Briscola" />
            </TrumpUnder>
          )}
          {gameState.trumpCard && gameState.deck.length === 0 && (
            <TrumpUpright>
              <img src={gameState.trumpCard.imagePath} alt="Briscola" />
            </TrumpUpright>
          )}
          {gameState.deck.length > 0 && (
            <DeckPile>
              <img src="/assets/cards/back.jpg" alt="Mazzo" />
              <DeckCountBadge>{gameState.deck.length}</DeckCountBadge>
            </DeckPile>
          )}
          {gameState.trumpCard && <PileLabel>Briscola</PileLabel>}
        </CenterPile>

        {/* Punti della presa: appaiono solo durante la raccolta */}
        {roundWinnerId && winnerSeat && trickPoints > 0 && (
          <TrickPointsFloat
            key={`pts_${gameState.roundNumber}`}
            style={{
              left: `calc(50% + ${SEAT_VECTORS[winnerSeat][0] * 24}%)`,
              top: `calc(50% + ${SEAT_VECTORS[winnerSeat][1] * 20}%)`,
            }}
          >
            <TrickPointsInner>
              <b>+{trickPoints}</b>
              <span>punti</span>
            </TrickPointsInner>
          </TrickPointsFloat>
        )}

        {/* Played cards on the table */}
        {playedCards.map((pc, idx) => {
          const seat = seatMap.get(pc.playerId);
          if (!seat) return null;
          const isWinner = roundWinnerId === pc.playerId;
          // Direzione della raccolta: dal posto della carta verso il vincitore
          const wv = winnerSeat ? SEAT_VECTORS[winnerSeat] : null;
          const cv = SEAT_VECTORS[seat];
          const collectDx = wv ? (wv[0] - cv[0]) * 70 : 0;
          const collectDy = wv ? (wv[1] - cv[1]) * 70 : 0;
          return (
            <PlayedCardSpot key={idx} seat={seat}>
              <PlayedCardWrapper>
                <PlaySlot
                  isEmpty={false}
                  isWinner={isWinner}
                  isFadingOut={isFadingOut}
                  collectDx={collectDx}
                  collectDy={collectDy}
                >
                  <TiltWrap isWinner={isWinner} style={{ transform: pc.transform }}>
                    <CardClip>
                      <CardComponent
                        card={pc.card}
                        onClick={() => {}}
                        transform=""
                        colors={cardColors}
                        fillContainer
                      />
                    </CardClip>
                  </TiltWrap>
                </PlaySlot>
              </PlayedCardWrapper>
            </PlayedCardSpot>
          );
        })}

        {/* Player Seats — dai posti della partita, non dai connessi:
            chi si disconnette resta visibile al suo posto, in grigio */}
        {seatIds.map((sid) => {
          const seat = seatMap.get(sid);
          if (!seat) return null;
          const isActive = sid === activeTurnPlayerId;
          const isYou = sid === currentPlayerId;
          const playerTeam = teams ? teams[sid] : undefined;
          const { name, emoji, connected } = resolveSeatDisplay(sid);

          return (
            <PlayerSeat key={sid} seat={seat} isActive={isActive} style={{ opacity: connected ? 1 : 0.55 }}>
              <SeatAvatar isActive={isActive} teamColor={playerTeam ? TEAM_COLORS[playerTeam] : undefined}>
                {emoji}
              </SeatAvatar>
              <SeatName>
                {isYou ? 'Tu' : name}
              </SeatName>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {isActive && secondsLeft !== null && (
                  <TimerChip urgent={secondsLeft <= 5}>{secondsLeft}s</TimerChip>
                )}
                {isTeamMode && playerTeam && (
                  <TeamBadge team={playerTeam}>S{playerTeam}</TeamBadge>
                )}
                {!connected && <ReconnectingTag>riconnessione…</ReconnectingTag>}
              </div>
            </PlayerSeat>
          );
        })}
      </TableArea>

      {/* Hint di turno sopra la mano */}
      {gameState.phase === 'playing' && (
        <TurnHint mine={isCurrentPlayerTurn}>
          {isCurrentPlayerTurn
            ? 'Tocca a te — gioca una carta'
            : activeTurnPlayerId
              ? `Turno di ${resolveSeatDisplay(activeTurnPlayerId).name}`
              : ''}
        </TurnHint>
      )}

      {/* Hand dock at bottom */}
      <HandDock>
        {playerHand.map((card, idx) => {
          // Ventaglio: le carte ai lati ruotano e scendono leggermente
          const mid = (playerHand.length - 1) / 2;
          const fanRotation = (idx - mid) * 5;
          const fanDrop = Math.abs(idx - mid) * 5;
          return (
            <HandCardWrapper
              key={`${gameState.roundNumber}_${card.id}`}
              entranceDelay={idx * 70}
            >
              <FanWrap style={{ transform: `rotate(${fanRotation}deg) translateY(${fanDrop}px)` }}>
                <CardLift
                  isPlayable={isCurrentPlayerTurn}
                  onClick={() => isCurrentPlayerTurn && onCardPlay(card)}
                >
                  <CardComponent
                    card={card}
                    onClick={() => isCurrentPlayerTurn && onCardPlay(card)}
                    transform=""
                    colors={cardColors}
                    size="small"
                  />
                </CardLift>
              </FanWrap>
            </HandCardWrapper>
          );
        })}
      </HandDock>

      {/* Quick chat bar - toggleable for fast typing on mobile */}
      {showChatBar && onQuickChat && (
        <QuickChatBar
          onSubmit={(e) => {
            e.preventDefault();
            const msg = chatInput.trim();
            if (msg) { onQuickChat(msg.slice(0, 50)); setChatInput(''); }
          }}
        >
          <QuickChatInput
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value.slice(0, 50))}
            placeholder="Scrivi messaggio..."
            maxLength={50}
            autoComplete="off"
          />
          <QuickChatSend type="submit" disabled={!chatInput.trim()}>
            ➤
          </QuickChatSend>
          <QuickChatToggle onClick={() => setShowChatBar(false)}>
            ✕
          </QuickChatToggle>
        </QuickChatBar>
      )}

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
