"use client";

import React, { useEffect, useState, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { DESIGN, getPlayerName, getPlayerEmoji } from '@/components/shared/gameDesign';
import { PlayerState } from 'playroomkit';

// ===== QUICK MESSAGES =====
export const QUICK_MESSAGES = [
  { emoji: '👋', text: 'Ciao!' },
  { emoji: '👍', text: 'Bella giocata!' },
  { emoji: '😲', text: 'Wow!' },
  { emoji: '🔥', text: 'Forza!' },
  { emoji: '😅', text: 'Ops...' },
  { emoji: '🤝', text: 'Bella partita!' },
];

// ===== TYPES =====
export interface QuickChatMessage {
  senderId: string;
  message: string;
  ts: number;
}

// ===== ICON =====
export const QuickChatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

// ===== ANIMATIONS =====
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const scaleIn = keyframes`
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
`;

const slideOut = keyframes`
  from { opacity: 1; transform: translateX(-50%) translateY(0); }
  to { opacity: 0; transform: translateX(-50%) translateY(-12px); }
`;

// ===== POPUP STYLED COMPONENTS =====
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: ${fadeIn} 120ms ease-out;
  padding: 20px;
`;

const Dialog = styled.div`
  background: ${DESIGN.colors.surfaces.containers};
  border-radius: ${DESIGN.radius.containers};
  border: 1px solid ${DESIGN.colors.bg.tertiary};
  max-width: 360px;
  width: 100%;
  animation: ${scaleIn} 150ms ease-out;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid ${DESIGN.colors.bg.tertiary};
`;

const Title = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: ${DESIGN.colors.text.primary};
  letter-spacing: 0.5px;
`;

const CloseButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: ${DESIGN.colors.surfaces.elevated};
  color: ${DESIGN.colors.text.secondary};
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;

  &:hover {
    background: ${DESIGN.colors.bg.tertiary};
    color: ${DESIGN.colors.text.primary};
  }
`;

const MessagesGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 14px 18px;
`;

const MessageButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: ${DESIGN.colors.surfaces.elevated};
  border: 1px solid ${DESIGN.colors.bg.tertiary};
  border-radius: ${DESIGN.radius.buttons};
  color: ${DESIGN.colors.text.secondary};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms;
  white-space: nowrap;

  &:hover {
    color: ${DESIGN.colors.text.primary};
    border-color: ${DESIGN.colors.accents.cyan};
    background: ${DESIGN.colors.surfaces.containers};
  }

  &:active {
    transform: scale(0.96);
  }

  span:first-child {
    font-size: 16px;
    line-height: 1;
  }
`;

const CustomInputRow = styled.form`
  display: flex;
  gap: 8px;
  padding: 0 18px 14px;
`;

const CustomInput = styled.input`
  flex: 1;
  padding: 9px 12px;
  background: ${DESIGN.colors.surfaces.elevated};
  border: 1px solid ${DESIGN.colors.bg.tertiary};
  border-radius: ${DESIGN.radius.buttons};
  color: ${DESIGN.colors.text.primary};
  font-size: 13px;
  font-weight: 500;
  outline: none;
  transition: border-color 150ms;

  &::placeholder {
    color: ${DESIGN.colors.text.tertiary};
  }

  &:focus {
    border-color: ${DESIGN.colors.accents.cyan};
  }
`;

const SendButton = styled.button`
  padding: 9px 14px;
  background: ${DESIGN.colors.accents.cyan};
  border: none;
  border-radius: ${DESIGN.radius.buttons};
  color: ${DESIGN.colors.bg.primary};
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 150ms;
  white-space: nowrap;

  &:hover {
    opacity: 0.85;
  }

  &:active {
    transform: scale(0.96);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

// ===== BUBBLE STYLED COMPONENTS =====
const BubbleContainer = styled.div<{ $isLeaving: boolean }>`
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1900;
  animation: ${props => props.$isLeaving ? slideOut : slideIn} ${props => props.$isLeaving ? '300ms' : '200ms'} ease-out forwards;
  pointer-events: none;
`;

const BubbleContent = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: ${DESIGN.colors.surfaces.elevated};
  border: 1px solid ${DESIGN.colors.bg.tertiary};
  border-radius: 20px;
  padding: 8px 16px 8px 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
`;

const BubbleAvatar = styled.div`
  width: 30px;
  height: 30px;
  min-width: 30px;
  border-radius: 50%;
  background: ${DESIGN.colors.surfaces.containers};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  border: 1.5px solid ${DESIGN.colors.accents.cyan};
`;

const BubbleName = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${DESIGN.colors.accents.cyan};
`;

const BubbleText = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: ${DESIGN.colors.text.primary};
`;

// ===== POPUP COMPONENT =====
interface QuickChatPopupProps {
  onClose: () => void;
  onSend: (message: string) => void;
}

export const QuickChatPopup: React.FC<QuickChatPopupProps> = ({ onClose, onSend }) => {
  const [customMsg, setCustomMsg] = useState('');
  const MAX_LENGTH = 30;

  const handleSend = (msg: string) => {
    onSend(msg);
    onClose();
  };

  const handleCustomSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customMsg.trim();
    if (!trimmed) return;
    handleSend(trimmed);
  };

  return (
    <Overlay onClick={onClose}>
      <Dialog onClick={e => e.stopPropagation()}>
        <Header>
          <Title>💬 CHAT VELOCE</Title>
          <CloseButton onClick={onClose}>✕</CloseButton>
        </Header>
        <MessagesGrid>
          {QUICK_MESSAGES.map((msg) => (
            <MessageButton key={msg.text} onClick={() => handleSend(msg.text)}>
              <span>{msg.emoji}</span>
              <span>{msg.text}</span>
            </MessageButton>
          ))}
        </MessagesGrid>
        <CustomInputRow onSubmit={handleCustomSend}>
          <CustomInput
            value={customMsg}
            onChange={e => setCustomMsg(e.target.value.slice(0, MAX_LENGTH))}
            placeholder="Scrivi un messaggio..."
            maxLength={MAX_LENGTH}
            autoFocus
          />
          <SendButton type="submit" disabled={!customMsg.trim()}>
            Invia
          </SendButton>
        </CustomInputRow>
      </Dialog>
    </Overlay>
  );
};

// ===== BUBBLE COMPONENT =====
interface QuickChatBubbleProps {
  message: QuickChatMessage;
  players: PlayerState[];
  currentPlayerId: string;
}

export const QuickChatBubble: React.FC<QuickChatBubbleProps> = ({ message, players, currentPlayerId }) => {
  const [visible, setVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTsRef = useRef(message.ts);

  useEffect(() => {
    // Reset on new message
    setVisible(true);
    setIsLeaving(false);
    prevTsRef.current = message.ts;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => setVisible(false), 300);
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message.ts]);

  if (!visible) return null;

  const sender = players.find(p => p.id === message.senderId);
  const senderName = message.senderId === currentPlayerId ? 'Tu' : (sender ? getPlayerName(sender) : 'Giocatore');
  const senderEmoji = sender ? getPlayerEmoji(sender) : '😎';

  return (
    <BubbleContainer $isLeaving={isLeaving}>
      <BubbleContent>
        <BubbleAvatar>{senderEmoji}</BubbleAvatar>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <BubbleName>{senderName}</BubbleName>
          <BubbleText>{message.message}</BubbleText>
        </div>
      </BubbleContent>
    </BubbleContainer>
  );
};
