import { keyframes } from 'styled-components';

// ===== DESIGN SYSTEM - BRISCOLA NAPOLETANA =====
// Professional card table: felt verde, accenti oro Napoli, caldo e premium
export const DESIGN = {
  colors: {
    bg: {
      primary: '#0a120a',
      secondary: '#0d1a0d',
      tertiary: '#162616',
    },
    surfaces: {
      cards: '#f5f0e8',
      containers: '#132113',
      elevated: '#1e3220',
    },
    text: {
      primary: '#f5f0e8',
      secondary: '#a09880',
      tertiary: '#706850',
    },
    accents: {
      green: '#d4a017',
      cyan: '#2196f3',
      pink: '#e63946',
    },
  },
  radius: {
    cards: '10px',
    containers: '14px',
    buttons: '10px',
  },
  spacing: {
    xxs: '4px',
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  typography: {
    display: { size: '64px', weight: 700 },
    title: { size: '32px', weight: 600 },
    subtitle: { size: '24px', weight: 600 },
    body: { size: '18px', weight: 400 },
    caption: { size: '14px', weight: 500 },
    label: { size: '12px', weight: 500 },
  },
};

// ===== SHARED ANIMATIONS =====
export const borderGlow = keyframes`
  0% {
    opacity: 0;
    box-shadow: 0 0 0 0 rgba(0, 212, 255, 0);
  }
  15% {
    opacity: 1;
  }
  50% {
    box-shadow: 0 0 12px 2px rgba(0, 212, 255, 0.4);
  }
  100% {
    opacity: 1;
    box-shadow: 0 0 6px 1px rgba(0, 212, 255, 0.2);
  }
`;

export const borderFadeOut = keyframes`
  0% { opacity: 1; }
  100% { opacity: 0; }
`;

// Keep legacy export names for import compatibility
export const borderSweep = borderGlow;
export const borderDrawTop = borderGlow;
export const borderDrawRight = borderGlow;
export const borderDrawBottom = borderGlow;
export const borderDrawLeft = borderGlow;
export const pulseBlue = borderGlow;

export const fadeOut = keyframes`
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
`;

// ===== SHARED CARD COLORS =====
export const cardColors = {
  cardBg: DESIGN.colors.surfaces.cards,
  cardBorder: '#c8b890',
  primary: DESIGN.colors.accents.green,
  secondary: DESIGN.colors.text.secondary,
  text: '#2a1f0a',
  textSecondary: '#6a5a40',
  surface: DESIGN.colors.surfaces.containers,
};

// ===== SHARED PROPS INTERFACE =====
import { GameState } from '@/game/BaseGameLogic';
import { PlayerState } from 'playroomkit';
import { Card as CardType, CardValue } from '@/components/Card';
import { QuickChatMessage } from '@/components/QuickChat';

export interface GameUIProps {
  gameState: GameState;
  players: PlayerState[];
  currentPlayerId: string;
  onCardPlay: (card: CardType) => void;
  onSwapTrump: (card: CardType) => void;
  onPlayAgain?: () => void;
  onStartSecondSmazzata?: () => void;
  isHost?: boolean;
  onQuickChat?: (message: string) => void;
  quickChatMessage?: QuickChatMessage | null;
}

// ===== SHARED HELPER FUNCTIONS =====
export const getPlayerInitials = (playerId: string, players: PlayerState[]): string => {
  const player = players.find(p => p.id === playerId);
  if (!player) return '?';
  const profile = player.getProfile();
  const playerName = profile?.name || 'Player';
  const names = playerName.split(' ') || ['?'];
  return names.map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
};

export const getPlayerName = (player: PlayerState): string => {
  // Con skipLobby il nome vive nello stato del giocatore. MAI ripiegare sul
  // profilo Playroom: è un nickname casuale e appare come "nome che cambia"
  // quando lo stato non è ancora sincronizzato (es. riconnessione).
  const displayName = player.getState?.('displayName');
  const raw = displayName || 'Giocatore';
  return raw.length > 12 ? raw.slice(0, 12) : raw;
};

export const getPlayerPhoto = (player: PlayerState): string | undefined => {
  const profile = player.getProfile();
  return profile?.photo;
};

export const getPlayerColor = (player: PlayerState): string => {
  return player.getState?.('avatarColor') || DESIGN.colors.accents.green;
};

export const getPlayerEmoji = (player: PlayerState): string => {
  return player.getState?.('avatarEmoji') || '😎';
};

export const getPlayerTeam = (player: PlayerState): number | null => {
  const team = player.getState?.('team');
  return team ? parseInt(team, 10) : null;
};

export const TEAM_COLORS: { [team: number]: string } = {
  1: '#2196f3',
  2: '#e63946',
};

// ===== SWAP MECHANICS (DISABLED — non previsto nelle regole napoletane) =====
export const MAJOR_VALUES: CardValue[] = [
  CardValue.KING, CardValue.KNIGHT, CardValue.JACK, CardValue.ONE, CardValue.THREE
];

/**
 * Swap disabilitato per conformità alle regole napoletane classiche.
 * Nessuna carta può essere scambiata con la briscola sul tavolo.
 */
export const canSwapWithTrump = (
  _card: CardType,
  _trumpCard: CardType | null,
  _deckLength: number
): boolean => false;

// ===== ADDITIONAL SHARED ANIMATIONS =====
export const cardEntrance = keyframes`
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// Pulsazione dorata sulle carte giocabili quando è il tuo turno
export const playableGlow = keyframes`
  0%, 100% { box-shadow: 0 4px 10px rgba(0,0,0,0.35), 0 0 10px rgba(212,160,23,0.15); }
  50% { box-shadow: 0 4px 12px rgba(0,0,0,0.35), 0 0 20px rgba(212,160,23,0.45); }
`;

export const swapGlow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.9); }
  30% { box-shadow: 0 0 30px 10px rgba(0, 255, 136, 0.6); }
  60% { box-shadow: 0 0 20px 6px rgba(0, 255, 136, 0.3); }
  100% { box-shadow: 0 0 0 0 rgba(0, 255, 136, 0); }
`;

// ===== SOUND EFFECTS =====
import { Howl } from 'howler';
import { isSoundEnabled } from './soundEffects';

let cardFlipHowl: Howl | null = null;

const getCardFlipHowl = (): Howl => {
  if (!cardFlipHowl) {
    cardFlipHowl = new Howl({
      src: ['/assets/sounds/card_flip.mp3'],
      volume: 0.5,
      preload: true,
      html5: false, // Use Web Audio API for overlapping + no music interruption
    });
  }
  return cardFlipHowl;
};

/**
 * Play the card flip sound with slight random variation in rate (pitch+speed).
 * Uses Howler.js so sounds can overlap reliably and don't interrupt background music.
 */
export const playCardFlipSound = (): void => {
  try {
    if (!isSoundEnabled()) return;
    const howl = getCardFlipHowl();
    const id = howl.play();
    // Slight random rate variation: 0.94 to 1.06
    const rate = 0.94 + Math.random() * 0.12;
    howl.rate(rate, id);
  } catch {}
};
