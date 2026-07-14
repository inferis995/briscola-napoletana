"use client";

import React, { useState, useEffect, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { CardComponent } from '@/components/Card';
import { MatchHistoryButton } from '@/components/MatchHistory';
import { RulesPopup, RulesIcon } from '@/components/RulesPopup';
import { QuickChatPopup, QuickChatBubble, QuickChatIcon } from '@/components/QuickChat';
import { Wifi, WifiOff, Volume2, VolumeX, Palette, Mic, MicOff, History } from 'lucide-react';
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
import {
  TABLE_THEMES,
  TableTheme,
  TableColors,
  TableBrightness,
  getSavedTableTheme,
  saveTableTheme,
  getSavedTableBrightness,
  saveTableBrightness,
  resolveTableColors,
} from '@/components/shared/tableThemes';
import { useVoiceChat } from '@/components/shared/useVoiceChat';
import { Confetti } from '@/components/shared/Confetti';

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

const talkPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(61, 220, 120, 0.45); }
  50% { box-shadow: 0 0 0 9px rgba(61, 220, 120, 0.08); }
`;

// Distribuzione a inizio smazzata: le carte volano dal tavolo alla mano
const dealEntrance = keyframes`
  0% { opacity: 0; transform: translateY(-42vh) rotate(-10deg) scale(0.6); }
  55% { opacity: 1; }
  100% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
`;

// La briscola si scopre con un flip di taglio
const trumpReveal = keyframes`
  0% { transform: translate(-50%, -50%) rotate(90deg) scaleX(0); opacity: 0; }
  40% { opacity: 1; }
  100% { transform: translate(-50%, -50%) rotate(90deg) scaleX(1); opacity: 1; }
`;

const sceneFadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

// ===== MAIN CONTAINER =====
const TableContainer = styled.div<{ $theme: TableColors }>`
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: radial-gradient(ellipse at center, ${props => props.$theme.bgCenter} 0%, ${props => props.$theme.bgEdge} 100%);
  overflow: hidden;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: ${DESIGN.colors.text.primary};
  display: flex;
  flex-direction: column;
  animation: ${sceneFadeIn} 350ms ease-out;

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
  padding: 8px 10px max(8px, env(safe-area-inset-top, 8px));
  background: rgba(6,10,6,0.85);
  backdrop-filter: blur(10px);
  z-index: 100;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(212,160,23,0.12);
  flex-wrap: nowrap;
  overflow: hidden;

  /* Telefono in orizzontale: barra sottile per dare spazio al tavolo */
  @media (max-height: 520px) {
    padding: 3px 12px;
  }
`;

const TopBarTitle = styled.div`
  font-family: var(--font-display), 'Times New Roman', serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #d4a017;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  white-space: nowrap;

  @media (max-width: 480px) {
    font-size: 11px;
    letter-spacing: 0.5px;
  }
`;

const TopBarVersion = styled.span`
  font-size: 9px;
  color: ${DESIGN.colors.text.tertiary};

  @media (max-width: 480px) {
    display: none;
  }
`;

const HideOnMobile = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;

  @media (max-width: 600px) {
    display: none;
  }
`;

const TopBarInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 1;
  min-width: 0;
`;

const TopBarButton = styled.button`
  width: 28px;
  height: 28px;
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
const FeltTable = styled.div<{ $theme: TableColors }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(92%, 720px);
  height: min(72%, 480px);
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='linear' slope='0.05'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E") repeat,
    radial-gradient(ellipse at 38% 28%, rgba(255, 255, 255, 0.07) 0%, transparent 55%),
    radial-gradient(ellipse at center, ${props => props.$theme.feltLight} 0%, ${props => props.$theme.feltMid} 48%, ${props => props.$theme.feltDark} 82%, ${props => props.$theme.feltEdge} 100%);
  border-radius: 50%;
  box-shadow:
    inset 0 0 110px rgba(0, 0, 0, 0.6),
    inset 0 0 34px rgba(0, 0, 0, 0.45),
    inset 0 2px 5px rgba(255, 255, 255, 0.09);
  z-index: 1;

  /* Cornice in legno: venature + luce e profondità */
  &::before {
    content: '';
    position: absolute;
    inset: -14px;
    border-radius: 50%;
    background:
      repeating-linear-gradient(
        100deg,
        rgba(255, 255, 255, 0.045) 0px,
        rgba(255, 255, 255, 0.045) 2px,
        transparent 2px,
        transparent 7px,
        rgba(0, 0, 0, 0.06) 7px,
        rgba(0, 0, 0, 0.06) 9px,
        transparent 9px,
        transparent 15px
      ),
      linear-gradient(145deg, ${props => props.$theme.woodA} 0%, ${props => props.$theme.woodB} 40%, ${props => props.$theme.woodC} 65%, ${props => props.$theme.woodD} 100%);
    box-shadow:
      0 18px 60px rgba(0, 0, 0, 0.8),
      inset 0 2px 3px rgba(255, 255, 255, 0.18),
      inset 0 -3px 6px rgba(0, 0, 0, 0.6);
    z-index: -1;
  }

  /* Filo interno (oro; argento sul tema grafite) */
  &::after {
    content: '';
    position: absolute;
    inset: 10px;
    border-radius: 50%;
    border: 1.5px solid ${props => props.$theme.trim};
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

  /* Telefono in orizzontale: il tavolo sfrutta l'altezza ridotta */
  @media (max-height: 520px) {
    width: min(72%, 560px);
    height: 76%;

    &::before {
      inset: -8px;
    }
  }
`;

// ===== TALLONE + BRISCOLA: al centro del feltro =====
// Ancorato al FELTRO così resta sempre dentro il tavolo su ogni schermo.
// Sta SOPRA le carte giocate (z-index): una carta lanciata vicino scivola
// sotto il bordo del tallone e il contatore non viene mai coperto.
const CenterPile = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(-3deg);
  width: 150px;
  height: 92px;
  z-index: 6;

  @media (max-width: 768px) {
    width: 104px;
    height: 64px;
  }

  @media (max-height: 520px) {
    transform: translate(-50%, -50%) rotate(-3deg) scale(0.82);
  }
`;

// La briscola scoperta giace di traverso sotto il tallone (look classico).
// Al primo apparire si scopre con un flip di taglio.
const TrumpUnder = styled.div`
  position: absolute;
  top: 50%;
  left: 62%;
  animation: ${trumpReveal} 600ms 450ms both;
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
    width: 44px;
    height: 62px;
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
    width: 44px;
    height: 62px;
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
    width: 44px;
    height: 62px;
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
  position: relative;
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

  @media (max-height: 520px) {
    width: 38px;
    height: 38px;
    font-size: 19px;
    border-width: 2px;
  }
`;

// Anello verde su chi sta parlando (push-to-talk)
const TalkRing = styled.div`
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 2.5px solid rgba(61, 220, 120, 0.85);
  box-shadow: 0 0 14px rgba(61, 220, 120, 0.55);
  pointer-events: none;
  animation: ${talkPulse} 1.2s ease-in-out infinite;
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

  @media (max-height: 520px) {
    font-size: 10px;
    padding: 1px 8px;
    max-width: 90px;
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
// Ancorate al FELTRO (percentuali dell'ovale, non dello schermo): le carte
// di TUTTI i posti atterrano sempre sul panno, su qualunque schermo.
const PlayedCardSpot = styled.div<{ seat: SeatPosition }>`
  position: absolute;
  z-index: 5;

  ${props => props.seat === 'bottom' && `
    bottom: 9%;
    left: 50%;
    transform: translateX(-50%);
  `}
  ${props => props.seat === 'top' && `
    top: 9%;
    left: 50%;
    transform: translateX(-50%);
  `}
  ${props => props.seat === 'left' && `
    left: 13%;
    top: 50%;
    transform: translateY(-50%);
  `}
  ${props => props.seat === 'right' && `
    right: 13%;
    top: 50%;
    transform: translateY(-50%);
  `}
  ${props => props.seat === 'topLeft' && `
    top: 14%;
    left: 24%;
  `}
  ${props => props.seat === 'topRight' && `
    top: 14%;
    right: 24%;
  `}
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
  /* Stesse proporzioni della carta (0.65): l'immagine riempie senza bande.
     Più piccole delle carte in mano: sul tavolo non devono coprire il tallone */
  width: 50px;
  aspect-ratio: 0.65;
  filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.45));

  @media (min-width: 769px) {
    width: 68px;
  }

  @media (max-height: 520px) {
    width: 44px;
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
  gap: 10px;
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

  /* Telefono in orizzontale: dock compatto per lasciare spazio al tavolo */
  @media (max-height: 520px) {
    gap: 8px;
    padding: 4px 8px max(6px, env(safe-area-inset-bottom, 6px));
  }
`;

// Dimensioni della carta in mano sotto il nostro controllo diretto
// (CardComponent con fillContainer riempie questo box). Più grandi su
// mobile in verticale; compatte quando il telefono è in orizzontale.
const HandCardBox = styled.div`
  width: 96px;
  aspect-ratio: 0.65;

  @media (max-width: 768px) {
    width: 82px;
  }

  @media (max-height: 520px) {
    width: 60px;
  }
`;

const HandCardWrapper = styled.div<{ entranceDelay: number; $deal?: boolean }>`
  flex-shrink: 0;
  animation: ${props => props.$deal ? dealEntrance : handEntrance}
    ${props => props.$deal ? '520ms' : '240ms'}
    ${props => props.$deal ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'ease-out'}
    ${props => props.entranceDelay}ms both;
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

  @media (max-height: 520px) {
    font-size: 9px;
    padding: 1px 0 0;
  }
`;

// ===== PUSH-TO-TALK =====
const PttButton = styled.button<{ $active: boolean; $denied: boolean }>`
  position: absolute;
  right: 12px;
  bottom: 10px;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 2px solid ${props => props.$denied ? 'rgba(230,57,70,0.6)' : props.$active ? '#3ddc78' : 'rgba(212,160,23,0.4)'};
  background: ${props => props.$active ? 'rgba(61,220,120,0.18)' : 'rgba(10,16,10,0.85)'};
  color: ${props => props.$denied ? '#e63946' : props.$active ? '#3ddc78' : '#d4a017'};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 80;
  cursor: pointer;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
  transition: transform 120ms, border-color 120ms, background 120ms;

  &:active {
    transform: scale(1.08);
  }

  ${props => props.$active && css`
    animation: ${talkPulse} 1.2s ease-in-out infinite;
  `}

  @media (max-height: 520px) {
    width: 44px;
    height: 44px;
    right: 8px;
    bottom: 6px;
  }
`;

// Avviso voce: spiega PERCHÉ il microfono non va e come sistemarlo
const VoiceNotice = styled.div`
  position: absolute;
  right: 12px;
  bottom: 74px;
  max-width: 240px;
  z-index: 85;
  background: rgba(10, 16, 10, 0.96);
  border: 1px solid rgba(230, 57, 70, 0.5);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 11px;
  line-height: 1.45;
  color: ${DESIGN.colors.text.primary};
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  animation: ${cardSlideIn} 180ms ease-out;
  cursor: pointer;

  @media (max-height: 520px) {
    bottom: 56px;
    max-width: 200px;
    font-size: 10px;
  }
`;

const PttHint = styled.span`
  position: absolute;
  right: 12px;
  bottom: 68px;
  font-size: 8px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: ${DESIGN.colors.text.tertiary};
  font-weight: 700;
  z-index: 80;
  pointer-events: none;

  @media (max-height: 520px) {
    display: none;
  }
`;

// ===== SCELTA COLORE TAVOLO =====
const ThemeScrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 190;
`;

const ThemePickerPanel = styled.div`
  position: fixed;
  top: 54px;
  right: 12px;
  z-index: 200;
  background: rgba(10, 16, 10, 0.95);
  border: 1px solid rgba(212, 160, 23, 0.25);
  border-radius: 12px;
  padding: 10px 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
  animation: ${cardSlideIn} 150ms ease-out;
`;

const ThemePickerTitle = styled.div`
  font-size: 9px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: ${DESIGN.colors.text.tertiary};
  font-weight: 700;
  margin-bottom: 8px;
  text-align: center;
`;

const BrightnessRow = styled.div`
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
`;

const BrightnessButton = styled.button<{ $selected: boolean }>`
  flex: 1;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  cursor: pointer;
  border: 1.5px solid ${props => props.$selected ? '#d4a017' : 'rgba(212, 160, 23, 0.2)'};
  background: ${props => props.$selected ? 'rgba(212, 160, 23, 0.16)' : 'transparent'};
  color: ${props => props.$selected ? '#d4a017' : DESIGN.colors.text.tertiary};
  transition: all 120ms;
`;

const SwatchRow = styled.div`
  display: flex;
  gap: 8px;
`;

const Swatch = styled.button<{ $color: string; $selected: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.25), transparent 55%),
    ${props => props.$color};
  border: 2px solid ${props => props.$selected ? '#d4a017' : 'rgba(255, 255, 255, 0.15)'};
  cursor: pointer;
  padding: 0;
  transition: transform 120ms, border-color 120ms;

  &:hover { transform: scale(1.12); }
  &:active { transform: scale(0.95); }

  ${props => props.$selected && css`
    box-shadow: 0 0 10px rgba(212, 160, 23, 0.5);
  `}
`;

// Mazzetto delle prese accanto all'avatar: pila di dorsi che cresce
// (nessun numero: i punti restano segreti come da regola)
const MiniPile = styled.div<{ $flip?: boolean }>`
  position: absolute;
  top: -2px;
  ${props => props.$flip ? 'left: -20px;' : 'right: -20px;'}
  width: 20px;
  height: 28px;
  border-radius: 3px;
  background: url('/assets/cards/back.jpg') center / cover;
  border: 1px solid rgba(0, 0, 0, 0.55);
  box-shadow:
    ${props => props.$flip ? '2px' : '-2px'} 2px 0 rgba(10, 16, 10, 0.9),
    ${props => props.$flip ? '4px' : '-4px'} 4px 0 rgba(10, 16, 10, 0.55),
    0 2px 6px rgba(0, 0, 0, 0.5);
  transform: rotate(${props => props.$flip ? '-8deg' : '8deg'});
  animation: ${cardSlideIn} 250ms ease-out;

  @media (max-height: 520px) {
    width: 15px;
    height: 21px;
  }
`;

// ===== ULTIMA PRESA =====
const LastTrickPanel = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 210;
  background: rgba(10, 16, 10, 0.96);
  border: 1px solid rgba(212, 160, 23, 0.35);
  border-radius: 14px;
  padding: 16px 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
  animation: ${cardSlideIn} 180ms ease-out;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
`;

const LastTrickCards = styled.div`
  display: flex;
  gap: 8px;
`;

const LastTrickCard = styled.div<{ $win: boolean }>`
  width: 56px;
  aspect-ratio: 0.65;
  border-radius: 5px;
  position: relative;

  ${props => props.$win && css`
    &::after {
      content: '';
      position: absolute;
      inset: -3px;
      border: 2px solid #d4a017;
      border-radius: 7px;
      box-shadow: 0 0 12px rgba(212, 160, 23, 0.5);
      pointer-events: none;
    }
  `}
`;

const LastTrickPoints = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: #f0cf7a;
  font-variant-numeric: tabular-nums;
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
  animation: ${cardSlideIn} 280ms ease-out;
`;

const GameOverTitle = styled.h2<{ $win?: boolean }>`
  font-family: var(--font-display), 'Times New Roman', serif;
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 700;
  margin: 0 0 16px 0;
  letter-spacing: 1.5px;
  color: #d4a017;

  ${props => props.$win && css`
    color: #f0cf7a;
    text-shadow: 0 0 26px rgba(212, 160, 23, 0.55);
  `}
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
  teams?: { [id: string]: number },
  seatCycle?: string[]
): Map<string, SeatPosition> => {
  const seats = new Map<string, SeatPosition>();
  const n = seatIds.length;
  const myIdx = seatIds.indexOf(currentPlayerId);
  if (myIdx === -1) return seats;

  // 2v2: posti dal ciclo di seduta FISSO condiviso nello stato — lo stesso
  // che governa i turni. Ruotato con me in basso: chi gioca dopo di me è
  // SEMPRE alla mia destra, il compagno di fronte, e il senso del giro è
  // identico sugli schermi di tutti e quattro, per tutta la partita.
  if (n === 4 && seatCycle && seatCycle.length === 4 && seatCycle.every(id => seatIds.includes(id))) {
    const myCycleIdx = seatCycle.indexOf(currentPlayerId);
    if (myCycleIdx !== -1) {
      const rotated = [...seatCycle.slice(myCycleIdx), ...seatCycle.slice(0, myCycleIdx)];
      seats.set(rotated[0], 'bottom');
      seats.set(rotated[1], 'right');
      seats.set(rotated[2], 'top');
      seats.set(rotated[3], 'left');
      return seats;
    }
  }

  // Fallback 2v2 senza ciclo nello stato: compagno di fronte, avversari ai lati
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

  // Voce push-to-talk (P2P, zero server)
  const { micStatus, isTalking, startTalking, stopTalking, voiceSupported } =
    useVoiceChat(players, currentPlayerId);

  // Avviso visibile quando il microfono non è utilizzabile (e perché)
  const micBlocked = micStatus === 'denied' || micStatus === 'nomic' || micStatus === 'error' || micStatus === 'unsupported';
  const [showVoiceNotice, setShowVoiceNotice] = useState(false);
  useEffect(() => {
    if (!micBlocked) { setShowVoiceNotice(false); return; }
    setShowVoiceNotice(true);
    const timer = setTimeout(() => setShowVoiceNotice(false), 8000);
    return () => clearTimeout(timer);
  }, [micStatus, micBlocked]);
  const voiceNoticeText =
    micStatus === 'denied'
      ? 'Microfono bloccato dal browser. Apri i permessi del sito (lucchetto o "aA" accanto all\'indirizzo) e consenti il Microfono, poi riprova.'
      : micStatus === 'nomic'
        ? 'Nessun microfono trovato su questo dispositivo.'
        : 'Microfono non disponibile su questo browser.';

  // Desktop: barra spaziatrice = push-to-talk (ignorata mentre scrivi in chat)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      startTalking();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') stopTalking();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [startTalking, stopTalking]);

  // Colore del tavolo: scelta personale, salvata sul dispositivo
  const [tableTheme, setTableTheme] = useState<TableTheme>(TABLE_THEMES[0]);
  const [tableBrightness, setTableBrightness] = useState<TableBrightness>('classic');
  const [showThemePicker, setShowThemePicker] = useState(false);
  useEffect(() => {
    setTableTheme(getSavedTableTheme());
    setTableBrightness(getSavedTableBrightness());
  }, []);
  const pickTheme = (t: TableTheme) => {
    setTableTheme(t);
    saveTableTheme(t.id);
  };
  const pickBrightness = (b: TableBrightness) => {
    setTableBrightness(b);
    saveTableBrightness(b);
  };
  // Palette effettiva: tema scelto + luminosità (Classico/Chiaro)
  const tableColors = resolveTableColors(tableTheme, tableBrightness);

  // Ultima presa rivedibile
  const [showLastTrick, setShowLastTrick] = useState(false);
  const lastTrick = gameState.roundHistory.length > 0
    ? gameState.roundHistory[gameState.roundHistory.length - 1]
    : null;

  // Suono di distribuzione a inizio smazzata (3 flip a scalare)
  const dealKeyRef = useRef('');
  useEffect(() => {
    const key = `${gameState.smazzataNumber}_${gameState.trumpCard?.id ?? 'x'}`;
    if (gameState.roundNumber !== 1 || gameState.phase !== 'playing' || dealKeyRef.current === key) return;
    dealKeyRef.current = key;
    const timers = [0, 150, 300].map(d => setTimeout(() => playCardFlipSound(), d));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.smazzataNumber, gameState.trumpCard?.id, gameState.roundNumber, gameState.phase]);

  // La distribuzione animata (carte che volano in mano) solo alla prima mano
  const isDealing = gameState.roundNumber === 1;

  // Nome robusto: displayName → registro posti → 'Giocatore'
  // (mai il nickname casuale di Playroom)
  const resolveSeatDisplay = (sid: string): { name: string; emoji: string; connected: boolean; talking: boolean } => {
    const player = players.find(p => p.id === sid);
    const owner = gameState.seatOwners?.[sid];
    if (player) {
      const stateName = player.getState?.('displayName');
      const name = stateName ? getPlayerName(player) : (owner?.name || 'Giocatore');
      return {
        name,
        emoji: getPlayerEmoji(player),
        connected: true,
        talking: player.getState?.('talking') === true,
      };
    }
    return { name: owner?.name || 'Giocatore', emoji: owner?.emoji || '🔌', connected: false, talking: false };
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
  const seatMap = assignSeats(seatIds, currentPlayerId, teams, gameState.seatCycle);
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
    // Ho vinto io? (o la mia squadra) → coriandoli e titolo dorato
    const iWon = isTeamMode
      ? (!!gameState.winnerTeam && !isTeamDraw && teams![currentPlayerId] === gameState.winnerTeam)
      : (!!winner && winner === currentPlayerId);
    const titleText = gameState.endedEarly
      ? 'PARTITA INTERROTTA'
      : iWon
        ? 'HAI VINTO!'
        : (isTeamMode ? isTeamDraw : isDraw)
          ? 'PAREGGIO'
          : 'PARTITA FINITA';

    return (
      <TableContainer $theme={tableColors}>
        {iWon && !gameState.endedEarly && <Confetti />}
        <GameOverOverlay>
          <GameOverDialog>
            <GameOverTitle $win={iWon && !gameState.endedEarly}>{titleText}</GameOverTitle>
            {gameState.endedEarly && (
              <div style={{ margin: '-6px 0 12px', fontSize: '12px', color: DESIGN.colors.accents.pink, fontWeight: 600 }}>
                Un giocatore ha lasciato — punteggi al momento dell'interruzione
              </div>
            )}
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
      <TableContainer $theme={tableColors}>
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
    <TableContainer $theme={tableColors}>
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
          <TopBarButton onClick={() => setShowThemePicker(v => !v)} title="Colore del tavolo">
            <Palette size={15} />
          </TopBarButton>
          {lastTrick && (
            <TopBarButton onClick={() => setShowLastTrick(true)} title="Rivedi l'ultima presa">
              <History size={15} />
            </TopBarButton>
          )}
          <TopBarButton onClick={() => setShowRules(true)} title="Come si gioca">
            <RulesIcon />
          </TopBarButton>
          {onQuickChat && (
            <TopBarButton onClick={() => { setShowChatBar(!showChatBar); setShowQuickChat(false); }} title="Chat veloce">
              <QuickChatIcon />
            </TopBarButton>
          )}
          <HideOnMobile>
            {isOnline
              ? <Wifi size={14} color="#d4a017" />
              : <WifiOff size={14} color="#e63946" />
            }
          </HideOnMobile>
        </TopBarInfo>
      </TopBar>

      {/* Table Area */}
      <TableArea>
        <FeltTable $theme={tableColors}>
          {/* Tallone col dorso vero + briscola coricata sotto, ancorati al feltro */}
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
            {gameState.trumpCard && gameState.deck.length === 0 && <PileLabel>Briscola</PileLabel>}
          </CenterPile>

          {/* Carte giocate: ancorate al feltro, atterrano sempre sul panno */}
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

        </FeltTable>

        {/* Player Seats — dai posti della partita, non dai connessi:
            chi si disconnette resta visibile al suo posto, in grigio */}
        {seatIds.map((sid) => {
          const seat = seatMap.get(sid);
          if (!seat) return null;
          const isActive = sid === activeTurnPlayerId;
          const isYou = sid === currentPlayerId;
          const playerTeam = teams ? teams[sid] : undefined;
          const { name, emoji, connected, talking } = resolveSeatDisplay(sid);

          return (
            <PlayerSeat key={sid} seat={seat} isActive={isActive} style={{ opacity: connected ? 1 : 0.55 }}>
              <SeatAvatar isActive={isActive} teamColor={playerTeam ? TEAM_COLORS[playerTeam] : undefined}>
                {emoji}
                {talking && connected && <TalkRing />}
                {(gameState.playerStacks[sid]?.length ?? 0) > 0 && (
                  <MiniPile $flip={seat === 'right'} title="Prese fatte" />
                )}
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

        {/* Push-to-talk: tieni premuto per parlare */}
        {voiceSupported && (
          <>
            {showVoiceNotice && (
              <VoiceNotice onClick={() => setShowVoiceNotice(false)}>
                {voiceNoticeText}
              </VoiceNotice>
            )}
            <PttHint>
              {micStatus === 'denied' ? 'mic bloccato'
                : micStatus === 'nomic' ? 'nessun mic'
                : micStatus === 'error' || micStatus === 'unsupported' ? 'mic non disp.'
                : 'tieni premuto'}
            </PttHint>
            <PttButton
              $active={isTalking}
              $denied={micBlocked}
              title={micBlocked ? voiceNoticeText : 'Tieni premuto per parlare (o barra spaziatrice)'}
              onPointerDown={(e) => { e.preventDefault(); startTalking(); }}
              onPointerUp={stopTalking}
              onPointerLeave={stopTalking}
              onPointerCancel={stopTalking}
              onContextMenu={(e) => e.preventDefault()}
            >
              {micBlocked ? <MicOff size={22} /> : <Mic size={22} />}
            </PttButton>
          </>
        )}
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
              entranceDelay={idx * (isDealing ? 150 : 70)}
              $deal={isDealing}
            >
              <FanWrap style={{ transform: `rotate(${fanRotation}deg) translateY(${fanDrop}px)` }}>
                <CardLift
                  isPlayable={isCurrentPlayerTurn}
                  onClick={() => isCurrentPlayerTurn && onCardPlay(card)}
                >
                  <HandCardBox>
                    <CardComponent
                      card={card}
                      onClick={() => isCurrentPlayerTurn && onCardPlay(card)}
                      transform=""
                      colors={cardColors}
                      fillContainer
                    />
                  </HandCardBox>
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

      {/* Scelta colore tavolo */}
      {showThemePicker && (
        <>
          <ThemeScrim onClick={() => setShowThemePicker(false)} />
          <ThemePickerPanel>
            <ThemePickerTitle>Colore tavolo</ThemePickerTitle>
            <BrightnessRow>
              <BrightnessButton
                $selected={tableBrightness === 'classic'}
                onClick={() => pickBrightness('classic')}
              >
                Classico
              </BrightnessButton>
              <BrightnessButton
                $selected={tableBrightness === 'light'}
                onClick={() => pickBrightness('light')}
              >
                Chiaro
              </BrightnessButton>
            </BrightnessRow>
            <SwatchRow>
              {TABLE_THEMES.map(t => (
                <Swatch
                  key={t.id}
                  $color={resolveTableColors(t, tableBrightness).feltMid}
                  $selected={t.id === tableTheme.id}
                  title={t.label}
                  onClick={() => pickTheme(t)}
                />
              ))}
            </SwatchRow>
          </ThemePickerPanel>
        </>
      )}

      {/* Ultima presa */}
      {showLastTrick && lastTrick && (
        <>
          <ThemeScrim onClick={() => setShowLastTrick(false)} />
          <LastTrickPanel onClick={() => setShowLastTrick(false)}>
            <ThemePickerTitle>
              Ultima presa — {lastTrick.winnerId === currentPlayerId ? 'tua' : resolveSeatDisplay(lastTrick.winnerId).name}
            </ThemePickerTitle>
            <LastTrickCards>
              {lastTrick.playedCards.map((pc, i) => (
                <LastTrickCard key={i} $win={pc.playerId === lastTrick.winnerId}>
                  <CardComponent
                    card={pc.card}
                    onClick={() => {}}
                    transform=""
                    colors={cardColors}
                    fillContainer
                  />
                </LastTrickCard>
              ))}
            </LastTrickCards>
            <LastTrickPoints>
              +{lastTrick.playedCards.reduce((t, pc) => t + pc.card.score, 0)} punti
            </LastTrickPoints>
          </LastTrickPanel>
        </>
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
