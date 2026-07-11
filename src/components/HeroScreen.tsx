"use client";

import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { DESIGN } from '@/components/shared/gameDesign';
import { GameMode } from '@/game/GameModeSelector';
import { RulesPopup, RulesButton, RulesIcon } from '@/components/RulesPopup';
import packageJson from '../../package.json';

// ===== CONSTANTS =====
export const AVATAR_EMOJIS = [
  '😈',
  '😏',
  '😎',
  '🤖',
  '😒',
  '🤪',
  '😤',
  '💩',
  '😡',
  '🤡',
  '👿',
  '🧐',
  '🤓',
  '🥶',
  '🤢',
  '🫠',
];

export const LS_USERNAME_KEY = 'briscola_username';
export const LS_EMOJI_KEY = 'briscola_avatarEmoji';

const HERO_CARDS = [
  { src: '/assets/cards/coppe/coppe_1.jpg', rotation: -20, alt: 'Asso di Coppe' },
  { src: '/assets/cards/denari/denari_1.jpg', rotation: -7, alt: 'Asso di Denari' },
  { src: '/assets/cards/bastoni/bastoni_1.jpg', rotation: 7, alt: 'Asso di Bastoni' },
  { src: '/assets/cards/spade/spade_1.jpg', rotation: 20, alt: 'Asso di Spade' },
];

// ===== GAME MODE OPTIONS =====
const GAME_MODE_OPTIONS = [
  {
    mode: GameMode.ONE_ON_ONE,
    label: '1 v 1',
    description: 'Sfida testa a testa',
    players: '2 giocatori',
    icon: '⚔️',
  },
  {
    mode: GameMode.THREE_FOR_ALL,
    label: '3 per Tutti',
    description: 'Tutti contro tutti',
    players: '3 giocatori',
    icon: '👑',
  },
    {
    mode: GameMode.TWO_VS_TWO,
    label: '2 v 2',
    description: 'Battaglia a squadre',
    players: '4 giocatori',
    icon: '🤝',
  },
];

// ===== INTERFACES =====
export interface HeroScreenProps {
  onCreateGame: (username: string, avatarEmoji: string, mode: GameMode) => void;
  onJoinGame: (username: string, avatarEmoji: string, roomCode: string) => void;
  error?: string | null;
  onDismissError?: () => void;
  initialRoomCode?: string;
}

// ===== ANIMATIONS =====
const titleFadeIn = keyframes`
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const contentFadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const errorSlideIn = keyframes`
  from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
`;

// ===== STYLED COMPONENTS =====
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: safe center;
  min-height: 100svh;
  width: 100vw;
  background: ${DESIGN.colors.bg.secondary};
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 16px 16px max(24px, env(safe-area-inset-bottom, 24px));
  gap: clamp(8px, 2vh, 20px);
`;

const TitleSection = styled.div`
  text-align: center;
  animation: ${titleFadeIn} 600ms ease-out;
`;

const Title = styled.h1`
  font-size: clamp(28px, 7vw, 64px);
  font-weight: 800;
  color: ${DESIGN.colors.text.primary};
  margin: 0;
  letter-spacing: 4px;
  line-height: 1;
  background: linear-gradient(
    90deg,
    ${DESIGN.colors.text.primary} 0%,
    ${DESIGN.colors.text.primary} 40%,
    #d4a017 50%,
    ${DESIGN.colors.text.primary} 60%,
    ${DESIGN.colors.text.primary} 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ${shimmer} 6s linear infinite;
`;

const Subtitle = styled.p`
  font-size: clamp(10px, 1.6vw, 13px);
  color: ${DESIGN.colors.text.secondary};
  margin: 4px 0 0;
  letter-spacing: 1.5px;
  text-transform: uppercase;
`;

const VersionBadge = styled.span`
  font-size: 10px;
  color: ${DESIGN.colors.text.tertiary};
  background: ${DESIGN.colors.surfaces.containers};
  padding: 2px 8px;
  border-radius: 8px;
  margin-left: 8px;
  font-weight: 500;
  vertical-align: middle;
`;

const CardFanContainer = styled.div`
  position: relative;
  width: clamp(180px, 50vw, 340px);
  height: clamp(80px, 15vh, 170px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  flex-shrink: 0;

  &::before {
    content: '';
    position: absolute;
    inset: -20px;
    background: radial-gradient(
      ellipse at center bottom,
      rgba(212,160,23,0.12) 0%,
      transparent 70%
    );
    pointer-events: none;
    z-index: 0;
  }
`;

const FanCard = styled.div`
  position: absolute;
  bottom: 0;
  width: clamp(45px, 10vw, 85px);
  aspect-ratio: 0.62;
  transform-origin: bottom center;
  border: 2px solid #c8b890;
  border-radius: clamp(6px, 1vw, 12px);
  overflow: hidden;
  background: #f5f0e8;
  z-index: 1;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    -webkit-user-drag: none;
    user-select: none;
  }
`;

const Divider = styled.div`
  width: 60px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    #162616,
    rgba(212,160,23,0.4),
    #162616,
    transparent
  );
  flex-shrink: 0;
`;

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 340px;
  animation: ${contentFadeIn} 600ms ease-out 400ms both;
  flex-shrink: 0;
`;

const InputLabel = styled.label`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: ${DESIGN.colors.text.secondary};
  align-self: flex-start;
  margin-bottom: -8px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 14px;
  border-radius: ${DESIGN.radius.buttons};
  border: 1.5px solid ${DESIGN.colors.surfaces.elevated};
  background: ${DESIGN.colors.surfaces.containers};
  color: ${DESIGN.colors.text.primary};
  font-size: 16px;
  font-weight: 500;
  outline: none;
  transition: border 200ms;

  &:focus {
    border-color: ${DESIGN.colors.accents.green};
  }

  &::placeholder {
    color: ${DESIGN.colors.text.tertiary};
  }
`;

const EmojiGrid = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
`;

const EmojiButton = styled.button<{ isSelected: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: ${p => p.isSelected ? `${DESIGN.colors.accents.green}30` : 'transparent'};
  border: 2px solid ${p => p.isSelected ? DESIGN.colors.accents.green : 'transparent'};
  cursor: pointer;
  transition: all 150ms;
  padding: 0;
  font-size: 20px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    transform: scale(1.15);
    background: ${DESIGN.colors.surfaces.elevated};
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  width: 100%;
`;

const PrimaryButton = styled.button`
  flex: 1;
  padding: 10px 12px;
  border-radius: ${DESIGN.radius.buttons};
  border: none;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 150ms;
  background: ${DESIGN.colors.accents.green};
  color: ${DESIGN.colors.bg.primary};

  &:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.9; }
  &:active:not(:disabled) { transform: translateY(0); }
  &:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
`;

const SecondaryButton = styled.button`
  flex: 1;
  padding: 12px 16px;
  border-radius: ${DESIGN.radius.buttons};
  border: 1.5px solid ${DESIGN.colors.surfaces.elevated};
  background: ${DESIGN.colors.surfaces.containers};
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  color: ${DESIGN.colors.text.primary};
  transition: all 150ms;

  &:hover { border-color: ${DESIGN.colors.accents.cyan}; transform: translateY(-1px); }
  &:active { transform: translateY(0); }
`;

const JoinSection = styled.div`
  display: flex;
  gap: 8px;
  width: 100%;
  animation: ${contentFadeIn} 200ms ease-out;
`;

const RoomCodeInput = styled(Input)`
  text-transform: uppercase;
  letter-spacing: 4px;
  text-align: center;
  font-size: 20px;
  font-weight: 700;
`;

const ErrorBanner = styled.div`
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: ${DESIGN.colors.surfaces.elevated};
  border: 1px solid ${DESIGN.colors.accents.pink};
  border-radius: ${DESIGN.radius.buttons};
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 600;
  color: ${DESIGN.colors.accents.pink};
  z-index: 2000;
  cursor: pointer;
  white-space: nowrap;
  animation: ${errorSlideIn} 250ms ease-out;
  box-shadow: 0 4px 20px rgba(255, 107, 157, 0.15);
`;

const ModeGrid = styled.div`
  display: flex;
  gap: 8px;
  width: 100%;
  animation: ${contentFadeIn} 200ms ease-out;

  @media (max-width: 480px) {
    flex-direction: column;
    gap: 6px;
  }
`;

const ModeCard = styled.button`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border-radius: ${DESIGN.radius.containers};
  border: 1.5px solid ${DESIGN.colors.surfaces.elevated};
  background: ${DESIGN.colors.surfaces.containers};
  cursor: pointer;
  transition: all 200ms;
  color: ${DESIGN.colors.text.primary};

  &:hover {
    border-color: ${DESIGN.colors.accents.green};
    transform: translateY(-2px);
    box-shadow: 0 4px 20px ${DESIGN.colors.accents.green}20;
  }
  &:active {
    transform: translateY(0);
  }
`;

const ModeIcon = styled.span`
  font-size: 28px;
  line-height: 1;
`;

const ModeLabel = styled.span`
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.5px;
`;

const ModeDesc = styled.span`
  font-size: 11px;
  color: ${DESIGN.colors.text.secondary};
  font-weight: 500;
`;

const ModePlayers = styled.span`
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: ${DESIGN.colors.accents.cyan};
  background: ${DESIGN.colors.accents.cyan}18;
  padding: 2px 8px;
  border-radius: 4px;
  margin-top: 2px;
`;

// ===== COMPONENT =====
export const HeroScreen: React.FC<HeroScreenProps> = ({
  onCreateGame,
  onJoinGame,
  error,
  onDismissError,
  initialRoomCode,
}) => {
  const [username, setUsername] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState(AVATAR_EMOJIS[0]);
  const [showJoin, setShowJoin] = useState(!!initialRoomCode);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [cardsVisible, setCardsVisible] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const savedName = localStorage.getItem(LS_USERNAME_KEY);
      const savedEmoji = localStorage.getItem(LS_EMOJI_KEY);
      if (savedName) setUsername(savedName);
      if (savedEmoji && AVATAR_EMOJIS.includes(savedEmoji)) setAvatarEmoji(savedEmoji);
    } catch {}

    // Trigger card fan animation
    const timer = setTimeout(() => setCardsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const isValid = username.trim().length > 0;
  const isJoinValid = isValid && roomCode.trim().length === 4;

  const saveToStorage = (name: string, emoji: string) => {
    try {
      localStorage.setItem(LS_USERNAME_KEY, name);
      localStorage.setItem(LS_EMOJI_KEY, emoji);
    } catch {}
  };

  const handleCreate = () => {
    if (!isValid) return;
    setShowModeSelect(true);
  };

  const handleModeSelect = (mode: GameMode) => {
    const trimmedName = username.trim();
    saveToStorage(trimmedName, avatarEmoji);
    onCreateGame(trimmedName, avatarEmoji, mode);
  };

  const handleJoin = () => {
    if (!isJoinValid) return;
    const trimmedName = username.trim();
    saveToStorage(trimmedName, avatarEmoji);
    onJoinGame(trimmedName, avatarEmoji, roomCode.trim().toUpperCase());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showJoin && isJoinValid) handleJoin();
      else if (!showJoin && isValid) handleCreate();
    }
  };

  return (
    <Container>
      {error && (
        <ErrorBanner onClick={onDismissError}>{error}</ErrorBanner>
      )}

      <TitleSection>
        <Title>BRISCOLA NAPOLETANA</Title>
        <Subtitle>
          Il gioco di carte più amato di Napoli
          <VersionBadge>v{packageJson.version}</VersionBadge>
        </Subtitle>
      </TitleSection>

      <CardFanContainer>
        {HERO_CARDS.map((card, i) => (
          <FanCard
            key={card.alt}
            style={{
              opacity: cardsVisible ? 1 : 0,
              transform: cardsVisible
                ? `rotate(${card.rotation}deg)`
                : `rotate(0deg) translateY(30px)`,
              transition: `all 600ms cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 100 + 200}ms`,
            }}
          >
            <img src={card.src} alt={card.alt} draggable={false} />
          </FanCard>
        ))}
      </CardFanContainer>

      <Divider />

      <FormSection onKeyDown={handleKeyDown}>
        <InputLabel>Il tuo nome</InputLabel>
        <Input
          type="text"
          placeholder="Inserisci il tuo nome..."
          value={username}
          onChange={e => setUsername(e.target.value)}
          maxLength={20}
          autoComplete="off"
          spellCheck={false}
        />

        <InputLabel>Scegli la tua emoji</InputLabel>
        <EmojiGrid>
          {AVATAR_EMOJIS.map(emoji => (
            <EmojiButton
              key={emoji}
              isSelected={avatarEmoji === emoji}
              onClick={() => setAvatarEmoji(emoji)}
            >
              {emoji}
            </EmojiButton>
          ))}
        </EmojiGrid>

        {showModeSelect ? (
          <>
            <InputLabel>Scegli la modalità</InputLabel>
            <ModeGrid>
              {GAME_MODE_OPTIONS.map(opt => (
                <ModeCard key={opt.mode} onClick={() => handleModeSelect(opt.mode)}>
                  <ModeIcon>{opt.icon}</ModeIcon>
                  <ModeLabel>{opt.label}</ModeLabel>
                  <ModeDesc>{opt.description}</ModeDesc>
                  <ModePlayers>{opt.players}</ModePlayers>
                </ModeCard>
              ))}
            </ModeGrid>
            <SecondaryButton
              onClick={() => setShowModeSelect(false)}
              style={{ width: '100%' }}
            >
              INDIETRO
            </SecondaryButton>
          </>
        ) : !showJoin ? (
          <ButtonRow>
            <PrimaryButton onClick={handleCreate} disabled={!isValid}>
              CREA PARTITA
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowJoin(true)}>
              PARTECIPA
            </SecondaryButton>
          </ButtonRow>
        ) : (
          <>
            <InputLabel>Codice stanza</InputLabel>
            <JoinSection>
              <RoomCodeInput
                type="text"
                placeholder="ABCD"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                maxLength={4}
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
              <PrimaryButton
                onClick={handleJoin}
                disabled={!isJoinValid}
                style={{ flex: '0 0 auto', width: '100px' }}
              >
                ENTRA
              </PrimaryButton>
            </JoinSection>
            <SecondaryButton
              onClick={() => { setShowJoin(false); setRoomCode(''); }}
              style={{ width: '100%' }}
            >
              INDIETRO
            </SecondaryButton>
          </>
        )}
      </FormSection>

      <RulesButton onClick={() => setShowRules(true)} style={{ marginTop: '16px' }}>
        <RulesIcon /> COME SI GIOCA
      </RulesButton>

      {showRules && <RulesPopup onClose={() => setShowRules(false)} />}
    </Container>
  );
};
