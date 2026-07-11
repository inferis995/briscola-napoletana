"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import styled, { createGlobalStyle, keyframes } from "styled-components";
import { QRCodeSVG } from 'qrcode.react';
import {
  useMultiplayerState,
  insertCoin,
  myPlayer,
  usePlayersList,
  isHost,
  onPlayerJoin,
  RPC,
  getRoomCode,
} from "playroomkit";
import { Card } from '@/components/Card';
import { useNotification } from '@/components/Notification';
import { GameState, BaseGameLogic } from '@/game/BaseGameLogic';
import { GameMode, getGameModeConfig, createGameLogic } from '@/game/GameModeSelector';
import { TwoVTwoGameLogic } from '@/game/modes/TwoVTwoGameLogic';
import { detectDevice, DeviceType } from '@/utils/deviceDetection';
import { DesktopGameUI } from '@/components/DesktopGameUI';
import { MobileGameUI } from '@/components/MobileGameUI';
import { HeroScreen, LS_USERNAME_KEY, LS_EMOJI_KEY, AVATAR_EMOJIS } from '@/components/HeroScreen';
import { DESIGN, getPlayerName, getPlayerEmoji, getPlayerTeam, TEAM_COLORS } from '@/components/shared/gameDesign';

// ===== TYPES =====
type AppPhase = 'hero' | 'connecting' | 'connected';

// ===== CONNECTED APP (LOBBY + GAME) =====
const ConnectedApp: React.FC<{ username: string; avatarEmoji: string; gameMode?: GameMode }> = ({ username, avatarEmoji, gameMode }) => {
  const players = usePlayersList(true);
  const [gameState, setGameState] = useMultiplayerState<GameState | null>("game", null);
  const [hostId, setHostId] = useMultiplayerState<string | null>("hostId", null);
  const [sharedMode, setSharedMode] = useMultiplayerState<string | null>("gameMode", null);
  const [quickChat, setQuickChat] = useMultiplayerState<{ senderId: string; message: string; ts: number } | null>("quickChat", null);
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const { notification, showNotification } = useNotification();
  const currentPlayer = myPlayer();
  const amHost = isHost();
  const [roomCode, setRoomCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Refs
  const gameLogicRef = useRef<BaseGameLogic | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const setGameStateRef = useRef(setGameState);
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileSetRef = useRef(false);
  const gameCountRef = useRef(0);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { setGameStateRef.current = setGameState; }, [setGameState]);

  // Set player profile on mount
  useEffect(() => {
    if (currentPlayer && !profileSetRef.current) {
      currentPlayer.setState('displayName', username, true);
      currentPlayer.setState('avatarEmoji', avatarEmoji, true);
      profileSetRef.current = true;
    }
  }, [currentPlayer, username, avatarEmoji]);

  // Host broadcasts their id and game mode so all clients know
  useEffect(() => {
    if (amHost && currentPlayer) {
      setHostId(currentPlayer.id, true);
      if (gameMode) {
        setSharedMode(gameMode, true);
      }
    }
  }, [amHost, currentPlayer, setHostId, gameMode, setSharedMode]);

  // Determine the active mode (host sets it via gameMode prop, joiners read from sharedMode)
  // sharedMode is synced via playroomkit multiplayer state — may take a moment for joiners
  const activeMode = (gameMode || sharedMode || null) as GameMode | null;
  const modeConfig = activeMode ? getGameModeConfig(activeMode) : undefined;
  const maxPlayers = modeConfig?.maxPlayers ?? 4;

  // Get room code
  useEffect(() => {
    const code = getRoomCode();
    if (code) setRoomCode(code);
    // Poll briefly in case it's not immediately available
    const timer = setInterval(() => {
      const c = getRoomCode();
      if (c) { setRoomCode(c); clearInterval(timer); }
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Device detection
  useEffect(() => {
    const updateDevice = () => setDeviceType(detectDevice());
    updateDevice();
    window.addEventListener('resize', updateDevice);
    return () => window.removeEventListener('resize', updateDevice);
  }, []);

  // Register RPC handlers
  useEffect(() => {
    RPC.register('playCard', async (data: { cardId: string }, caller: any) => {
      if (!isHost()) return;
      const logic = gameLogicRef.current;
      const currentState = gameStateRef.current;
      if (!logic || !currentState || currentState.phase !== 'playing') return;
      logic.loadState(currentState);
      const newState = logic.playCard(caller.id, data.cardId);
      if (!newState) return;
      setGameStateRef.current(newState, true);

      if (newState.phase === 'round_complete') {
        if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
        resolveTimerRef.current = setTimeout(() => {
          const latestState = gameStateRef.current;
          if (!latestState || latestState.phase !== 'round_complete') return;
          const latestLogic = gameLogicRef.current;
          if (!latestLogic) return;
          latestLogic.loadState(latestState);
          const resolvedState = latestLogic.resolveRound();
          setGameStateRef.current(resolvedState, true);
        }, 1600);
      }
      return "ok";
    });

    RPC.register('swapTrump', async (data: { cardId: string }, caller: any) => {
      if (!isHost()) return;
      const logic = gameLogicRef.current;
      const currentState = gameStateRef.current;
      if (!logic || !currentState) return;
      logic.loadState(currentState);
      const newState = logic.swapWithTrump(caller.id, data.cardId);
      if (!newState) return;
      setGameStateRef.current(newState, true);
      return "ok";
    });

    RPC.register('playAgain', async (_data: any, _caller: any) => {
      if (!isHost()) return;
      const logic = gameLogicRef.current;
      if (!logic) return;
      gameCountRef.current += 1;
      const newState = logic.initializeGame();
      // Rotate starting player each game
      const allPlayers = logic.getPlayers();
      const playerCount = allPlayers.length;
      const startIndex = gameCountRef.current % playerCount;
      newState.currentTurnPlayerIndex = startIndex;

      // Rebuild turn order for team modes (2v2)
      if (newState.turnOrder && newState.teams) {
        const startPid = allPlayers[startIndex].id;
        newState.turnOrder = TwoVTwoGameLogic.buildTurnOrder(startPid, newState.teams, allPlayers);
      }

      setGameStateRef.current(newState, true);
      return "ok";
    });

    return () => {
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
    };
  }, []);

  // Handle card play
  const handleCardPlay = useCallback((card: Card) => {
    if (!currentPlayer || !gameState) return;
    if (gameState.phase !== 'playing') {
      showNotification("Aspetta la fine del turno", "WARNING" as any);
      return;
    }
    const playerIndex = players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex !== gameState.currentTurnPlayerIndex) {
      showNotification("Non è il tuo turno!", "WARNING" as any);
      return;
    }
    RPC.call('playCard', { cardId: card.id }, RPC.Mode.HOST);
  }, [currentPlayer, gameState, players, showNotification]);

  const handleSwapTrump = useCallback((card: Card) => {
    if (!currentPlayer || !gameState) return;
    RPC.call('swapTrump', { cardId: card.id }, RPC.Mode.HOST);
  }, [currentPlayer, gameState]);

  const handlePlayAgain = useCallback(() => {
    if (!amHost) return;
    RPC.call('playAgain', {}, RPC.Mode.HOST);
  }, [amHost]);

  const handleQuickChat = useCallback((message: string) => {
    if (!currentPlayer) return;
    setQuickChat({ senderId: currentPlayer.id, message, ts: Date.now() }, true);
  }, [currentPlayer, setQuickChat]);

  // Host starts game manually from lobby
  const handleStartGame = useCallback(() => {
    if (!amHost) return;
    if (players.length < (modeConfig?.minPlayers ?? 2)) {
      showNotification("Servono più giocatori per iniziare!", "WARNING" as any);
      return;
    }
    try {
      const logic = createGameLogic(players, activeMode || GameMode.THREE_FOR_ALL);
      gameLogicRef.current = logic;
      const initialState = logic.initializeGame();
      setGameState(initialState, true);
    } catch (error) {
      console.error("Failed to start game:", error);
      showNotification("Impossibile avviare la partita", "ERROR" as any);
    }
  }, [amHost, players, setGameState, showNotification, activeMode, modeConfig]);

  // Handle player join/quit
  useEffect(() => {
    const unsubscribe = onPlayerJoin((playerState: any) => {
      playerState.onQuit(() => {
        showNotification("Un giocatore ha lasciato la partita!", "ERROR" as any);
      });
    });
    return unsubscribe;
  }, [showNotification]);

  // Handle 'revealing_hands' -> 'playing' transition (2v2 teammate hand reveal)
  useEffect(() => {
    if (!amHost || !gameState) return;
    if (gameState.phase === 'revealing_hands') {
      const timer = setTimeout(() => {
        const latestState = gameStateRef.current;
        if (!latestState || latestState.phase !== 'revealing_hands') return;
        setGameStateRef.current({ ...latestState, phase: 'playing' }, true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.phase, amHost]);

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard?.writeText(roomCode).then(() => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      });
    }
  };

  const handleCopyLink = () => {
    if (roomCode) {
      const url = `${window.location.origin}?refcode=${roomCode}`;
      navigator.clipboard?.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

  // ==================== LOBBY VIEW ====================
  if (!gameState) {
    const is2v2 = activeMode === GameMode.TWO_VS_TWO;
    const canStart = (() => {
      if (players.length < (modeConfig?.minPlayers ?? 2)) return false;
      if (is2v2) {
        // Verify 2 per team
        let t1 = 0, t2 = 0;
        players.forEach(p => {
          const t = getPlayerTeam(p);
          if (t === 1) t1++;
          else if (t === 2) t2++;
        });
        return t1 === 2 && t2 === 2;
      }
      return true;
    })();
    const needed = maxPlayers - players.length;

    return (
      <LobbyWrapper>
        <GlobalStyle />
        <LobbyContainer>
          <LobbyHeader>
            <LobbyTitle>BRISCOLA NAPOLETANA</LobbyTitle>
            <LobbySubtitle>{activeMode === GameMode.ONE_ON_ONE ? '1 v 1' : activeMode === GameMode.TWO_VS_TWO ? '2 v 2' : activeMode === GameMode.THREE_FOR_ALL ? '3 per Tutti' : 'Caricamento...'} • Sala d'attesa</LobbySubtitle>
          </LobbyHeader>

          <RoomCodeCard>
            <RoomCodeLabel>CODICE STANZA</RoomCodeLabel>
            <RoomCodeValue>{roomCode || '----'}</RoomCodeValue>
            <ShareButtonRow>
              <ShareButton onClick={handleCopyCode}>
                {copiedCode ? 'COPIATO!' : 'COPIA CODICE'}
              </ShareButton>
              <ShareButton onClick={handleCopyLink}>
                {copiedLink ? 'COPIATO!' : 'COPIA LINK'}
              </ShareButton>
              <ShareButton onClick={() => setShowQR(!showQR)}>
                {showQR ? 'NASCONDI QR' : 'MOSTRA QR'}
              </ShareButton>
            </ShareButtonRow>
            {showQR && roomCode && (
              <QRCodeContainer>
                <QRCodeSVG 
                  value={`${window.location.origin}?refcode=${roomCode}`}
                  size={160}
                  level="H"
                  fgColor="#ffffff"
                  bgColor="#1a1a1a"
                />
              </QRCodeContainer>
            )}
          </RoomCodeCard>

          <PlayersSection>
            <PlayersHeader>Giocatori ({players.length}/{maxPlayers})</PlayersHeader>
            {players.map((player) => {
              const name = getPlayerName(player);
              const emoji = getPlayerEmoji(player);
              const isYou = player.id === currentPlayer?.id;
              const isPlayerHost = player.id === hostId;
              const playerTeam = getPlayerTeam(player);

              return (
                <PlayerRow key={player.id}>
                  <LobbyPlayerAvatar>
                    {emoji}
                  </LobbyPlayerAvatar>
                  <PlayerNameText>
                    {name}
                    {isYou && <YouTag>YOU</YouTag>}
                  </PlayerNameText>
                  {is2v2 && (
                    isYou ? (
                      <TeamToggle>
                        <TeamButton
                          team={1}
                          selected={playerTeam === 1}
                          onClick={() => currentPlayer?.setState('team', '1', true)}
                        >
                          T1
                        </TeamButton>
                        <TeamButton
                          team={2}
                          selected={playerTeam === 2}
                          onClick={() => currentPlayer?.setState('team', '2', true)}
                        >
                          T2
                        </TeamButton>
                      </TeamToggle>
                    ) : (
                      playerTeam ? (
                        <TeamBadge team={playerTeam}>SQUADRA {playerTeam}</TeamBadge>
                      ) : (
                        <TeamBadge team={0}>NESSUN TEAM</TeamBadge>
                      )
                    )
                  )}
                  {isPlayerHost && <HostTag>HOST</HostTag>}
                </PlayerRow>
              );
            })}
            {Array.from({ length: Math.max(0, maxPlayers - players.length) }).map((_, i) => (
              <PlayerRow key={`empty-${i}`} style={{ opacity: 0.4 }}>
                <WaitingDot>?</WaitingDot>
                <PlayerNameText style={{ color: DESIGN.colors.text.tertiary }}>
                  In attesa di giocatori...
                </PlayerNameText>
              </PlayerRow>
            ))}
          </PlayersSection>

          {amHost ? (
            <StartButton onClick={handleStartGame} disabled={!canStart}>
              {canStart
                ? 'AVVIA PARTITA'
                : players.length < (modeConfig?.minPlayers ?? 2)
                  ? `MANCANO ${needed} GIOCATORI`
                  : 'I TEAM DEVONO ESSERE 2v2'
              }
            </StartButton>
          ) : (
            <WaitingForHostText>
              <PulsingDot />
              In attesa che l'host inizi...
            </WaitingForHostText>
          )}
        </LobbyContainer>
      </LobbyWrapper>
    );
  }

  // ==================== GAME VIEW ====================
  const gameUI = deviceType === 'desktop' ? (
    <DesktopGameUI
      gameState={gameState}
      players={players}
      currentPlayerId={currentPlayer!.id}
      onCardPlay={handleCardPlay}
      onSwapTrump={handleSwapTrump}
      onPlayAgain={handlePlayAgain}
      isHost={amHost}
      onQuickChat={handleQuickChat}
      quickChatMessage={quickChat}
    />
  ) : (
    <MobileGameUI
      gameState={gameState}
      players={players}
      currentPlayerId={currentPlayer!.id}
      onCardPlay={handleCardPlay}
      onSwapTrump={handleSwapTrump}
      onPlayAgain={handlePlayAgain}
      isHost={amHost}
      onQuickChat={handleQuickChat}
      quickChatMessage={quickChat}
    />
  );

  return (
    <GameWrapper>
      <GlobalStyle />
      {gameUI}
    </GameWrapper>
  );
};

// ===== GLOBAL STYLES =====
const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    background: #0a120a;
    color: #f5f0e8;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden;
    height: 100%;
    user-select: none;
    -webkit-text-size-adjust: 100%;
  }

  html {
    height: 100%;
    width: 100vw;
    overflow: hidden;
  }
`;

// ===== GAME WRAPPER =====
const GameWrapper = styled.div`
  background: radial-gradient(ellipse at center, #0f1f0f 0%, #0a120a 100%);
  height: 100vh;
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
`;

// ===== CONNECTING SCREEN =====
const pulseAnim = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
`;

const dotPulse = keyframes`
  0%, 80%, 100% { opacity: 0; }
  40% { opacity: 1; }
`;

const ConnectingWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  height: 100dvh;
  width: 100vw;
  background: ${DESIGN.colors.bg.secondary};
  gap: 32px;
`;

const CardBackImage = styled.img`
  width: clamp(80px, 15vw, 120px);
  border-radius: 10px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  animation: ${pulseAnim} 2s ease-in-out infinite;
`;

const ConnectingTextRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 18px;
  font-weight: 500;
  color: ${DESIGN.colors.text.secondary};
`;

const AnimDot = styled.span<{ delay: number }>`
  animation: ${dotPulse} 1.4s ease-in-out infinite;
  animation-delay: ${p => p.delay}ms;
`;

// ===== LOBBY STYLES =====
const lobbyFadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const hostPulse = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
`;

const LobbyWrapper = styled.div`
  display: flex;
  align-items: safe center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  width: 100vw;
  background: ${DESIGN.colors.bg.secondary};
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 20px env(safe-area-inset-bottom, 20px);
  -webkit-overflow-scrolling: touch;
`;

const LobbyContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(16px, 3vh, 24px);
  width: 100%;
  max-width: 420px;
  animation: ${lobbyFadeIn} 500ms ease-out;
  flex-shrink: 0;
`;

const LobbyHeader = styled.div`
  text-align: center;
`;

const LobbyTitle = styled.h1`
  font-size: clamp(36px, 7vw, 52px);
  font-weight: 800;
  color: ${DESIGN.colors.text.primary};
  margin: 0;
  letter-spacing: 6px;
  line-height: 1;
`;

const LobbySubtitle = styled.p`
  font-size: 14px;
  color: ${DESIGN.colors.text.secondary};
  margin: 6px 0 0;
  letter-spacing: 2px;
  text-transform: uppercase;
`;

const RoomCodeCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: ${DESIGN.colors.surfaces.containers};
  border: 1px solid ${DESIGN.colors.surfaces.elevated};
  border-radius: ${DESIGN.radius.containers};
  padding: 20px 32px;
  width: 100%;
`;

const RoomCodeLabel = styled.span`
  font-size: 11px;
  letter-spacing: 2px;
  color: ${DESIGN.colors.text.tertiary};
  text-transform: uppercase;
  font-weight: 600;
`;

const RoomCodeValue = styled.span`
  font-size: clamp(36px, 8vw, 52px);
  font-weight: 800;
  letter-spacing: 12px;
  color: ${DESIGN.colors.accents.green};
  font-family: 'SF Mono', 'Fira Code', monospace;
  line-height: 1;
`;

const ShareButtonRow = styled.div`
  display: flex;
  gap: 8px;
  width: 100%;
`;

const ShareButton = styled.button`
  flex: 1;
  background: ${DESIGN.colors.surfaces.elevated};
  border: 1px solid ${DESIGN.colors.bg.tertiary};
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  color: ${DESIGN.colors.text.secondary};
  cursor: pointer;
  transition: all 150ms;

  &:hover {
    background: ${DESIGN.colors.bg.tertiary};
    color: ${DESIGN.colors.text.primary};
  }
`;

const QRCodeContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid ${DESIGN.colors.bg.tertiary};

  canvas {
    border-radius: 8px;
  }
`;

const PlayersSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

const PlayersHeader = styled.span`
  font-size: 12px;
  letter-spacing: 1.5px;
  color: ${DESIGN.colors.text.secondary};
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 4px;
`;

const PlayerRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  background: ${DESIGN.colors.surfaces.containers};
  border-radius: 12px;
  padding: 10px 14px;
  transition: opacity 200ms;
`;

const LobbyPlayerAvatar = styled.div`
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  line-height: 1;
  background: ${DESIGN.colors.surfaces.elevated};
  border: 1.5px solid ${DESIGN.colors.bg.tertiary};
`;

const WaitingDot = styled.div`
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: ${DESIGN.colors.text.tertiary};
  background: ${DESIGN.colors.surfaces.elevated};
  border: 1.5px dashed ${DESIGN.colors.bg.tertiary};
`;

const PlayerNameText = styled.span`
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: ${DESIGN.colors.text.primary};
  display: flex;
  align-items: center;
  gap: 6px;
`;

const YouTag = styled.span`
  font-size: 10px;
  font-weight: 700;
  color: ${DESIGN.colors.accents.cyan};
  background: ${DESIGN.colors.accents.cyan}18;
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
`;

const HostTag = styled.span`
  font-size: 10px;
  font-weight: 700;
  color: ${DESIGN.colors.accents.green};
  background: ${DESIGN.colors.accents.green}18;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
`;

const TeamToggle = styled.div`
  display: flex;
  gap: 4px;
  flex-shrink: 0;
`;

const TeamButton = styled.button<{ team: number; selected: boolean }>`
  padding: 3px 8px;
  border-radius: 6px;
  border: 1.5px solid ${props => props.selected ? TEAM_COLORS[props.team] : DESIGN.colors.bg.tertiary};
  background: ${props => props.selected ? `${TEAM_COLORS[props.team]}20` : 'transparent'};
  color: ${props => props.selected ? TEAM_COLORS[props.team] : DESIGN.colors.text.tertiary};
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: all 150ms;
  letter-spacing: 0.5px;

  &:hover {
    border-color: ${props => TEAM_COLORS[props.team]};
    color: ${props => TEAM_COLORS[props.team]};
  }
`;

const TeamBadge = styled.span<{ team: number }>`
  font-size: 9px;
  font-weight: 700;
  color: ${props => props.team ? TEAM_COLORS[props.team] || DESIGN.colors.text.tertiary : DESIGN.colors.text.tertiary};
  background: ${props => props.team ? `${TEAM_COLORS[props.team] || DESIGN.colors.text.tertiary}18` : `${DESIGN.colors.text.tertiary}18`};
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  flex-shrink: 0;
`;

const StartButton = styled.button`
  width: 100%;
  padding: 16px 24px;
  border-radius: ${DESIGN.radius.buttons};
  border: none;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1.5px;
  cursor: pointer;
  transition: all 200ms;
  background: ${DESIGN.colors.accents.green};
  color: ${DESIGN.colors.bg.primary};

  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px ${DESIGN.colors.accents.green}40; }
  &:active:not(:disabled) { transform: translateY(0); }
  &:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
`;

const WaitingForHostText = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: ${DESIGN.colors.text.secondary};
  font-weight: 500;
  letter-spacing: 0.5px;
`;

const PulsingDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${DESIGN.colors.accents.green};
  animation: ${hostPulse} 1.5s ease-in-out infinite;
`;

// ===== QUICK JOIN POPUP STYLES =====
const QuickJoinOverlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${DESIGN.colors.bg.secondary};
  padding: 20px;
`;

const QuickJoinCard = styled.div`
  background: ${DESIGN.colors.surfaces.containers};
  border: 1px solid ${DESIGN.colors.surfaces.elevated};
  border-radius: ${DESIGN.radius.containers};
  padding: 28px 24px;
  width: 100%;
  max-width: 360px;
  animation: ${lobbyFadeIn} 300ms ease-out;
`;

const QuickJoinTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: ${DESIGN.colors.text.primary};
  margin: 0 0 4px;
  text-align: center;
`;

const QuickJoinSubtitle = styled.p`
  font-size: 13px;
  color: ${DESIGN.colors.accents.green};
  font-weight: 600;
  letter-spacing: 1px;
  margin: 0 0 20px;
  text-align: center;
`;

const QuickJoinField = styled.div`
  margin-bottom: 16px;
`;

const QuickJoinLabel = styled.label`
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  color: ${DESIGN.colors.text.tertiary};
  text-transform: uppercase;
  margin-bottom: 6px;
`;

const QuickJoinInput = styled.input`
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1.5px solid ${DESIGN.colors.bg.tertiary};
  background: ${DESIGN.colors.surfaces.elevated};
  color: ${DESIGN.colors.text.primary};
  font-size: 15px;
  font-weight: 500;
  outline: none;
  transition: border-color 150ms;

  &:focus {
    border-color: ${DESIGN.colors.accents.green};
  }

  &::placeholder {
    color: ${DESIGN.colors.text.tertiary};
  }
`;

const QuickJoinEmojiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
`;

const QuickJoinEmojiBtn = styled.button<{ isSelected: boolean }>`
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  border: 2px solid ${props => props.isSelected ? DESIGN.colors.accents.green : 'transparent'};
  background: ${props => props.isSelected ? `${DESIGN.colors.accents.green}20` : DESIGN.colors.surfaces.elevated};
  font-size: 18px;
  cursor: pointer;
  transition: all 150ms;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${DESIGN.colors.bg.tertiary};
  }
`;

const QuickJoinActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 20px;
`;

const QuickJoinCancelBtn = styled.button`
  flex: 1;
  padding: 12px;
  border-radius: ${DESIGN.radius.buttons};
  border: 1.5px solid ${DESIGN.colors.bg.tertiary};
  background: transparent;
  color: ${DESIGN.colors.text.secondary};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms;

  &:hover {
    background: ${DESIGN.colors.surfaces.elevated};
    color: ${DESIGN.colors.text.primary};
  }
`;

const QuickJoinSubmitBtn = styled.button`
  flex: 2;
  padding: 12px;
  border-radius: ${DESIGN.radius.buttons};
  border: none;
  background: ${DESIGN.colors.accents.green};
  color: ${DESIGN.colors.bg.primary};
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 150ms;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px ${DESIGN.colors.accents.green}40;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

// ===== ENTRY POINT =====
export default function Home() {
  const [phase, setPhase] = useState<AppPhase>('hero');
  const [username, setUsername] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('');
  const [gameMode, setGameMode] = useState<GameMode | undefined>(undefined);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectingText, setConnectingText] = useState('Connecting');
  const [initialRoomCode, setInitialRoomCode] = useState<string | undefined>(undefined);

  // Quick join popup state (for invite links when user has no saved credentials)
  const [pendingRefcode, setPendingRefcode] = useState<string | null>(null);
  const [quickJoinName, setQuickJoinName] = useState('');
  const [quickJoinEmoji, setQuickJoinEmoji] = useState(AVATAR_EMOJIS[0]);

  const connect = useCallback(async (name: string, emoji: string, roomCode?: string, mode?: GameMode) => {
    setUsername(name);
    setAvatarEmoji(emoji);
    if (mode) setGameMode(mode);
    setConnectingText(roomCode ? 'Entrando in partita' : 'Creando partita');
    setPhase('connecting');

    // Determine max players from mode (host knows)
    // Joiners should NOT pass maxPlayersPerRoom — the room's limit is set by the host at creation.
    // Passing a lower value (e.g. 3) when joining a 4-player room causes a ROOM_LIMIT_EXCEEDED error.
    const modeConfig = mode ? getGameModeConfig(mode) : undefined;
    const maxPlayers = modeConfig?.maxPlayers ?? 4;

    try {
      if (typeof window !== 'undefined') {
        (window as any)._USETEMPSTORAGE = true;
      }
      await insertCoin({
        skipLobby: true,
        ...(roomCode ? { roomCode } : {}),
        ...(!roomCode ? { maxPlayersPerRoom: maxPlayers } : {}),
      });
      setPhase('connected');
    } catch (error: any) {
      console.error('insertCoin failed:', error);
      if (error?.message === 'ROOM_LIMIT_EXCEEDED') {
        setConnectError('Stanza piena! Prova un altro codice.');
      } else {
        setConnectError(roomCode
          ? 'Impossibile partecipare. Controlla il codice e riprova.'
          : 'Impossibile creare la partita. Riprova.'
        );
      }
      setPhase('hero');
    }
  }, []);

  const handleCreateGame = useCallback((name: string, emoji: string, mode: GameMode) => {
    connect(name, emoji, undefined, mode);
  }, [connect]);

  const handleJoinGame = useCallback((name: string, emoji: string, roomCode: string) => {
    connect(name, emoji, roomCode);
  }, [connect]);

  // Parse room code from URL query param (e.g. ?refcode=ABCD) for shared invite links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refcode = params.get('refcode');
    if (refcode && /^[A-Z0-9]{4}$/i.test(refcode)) {
      const code = refcode.toUpperCase();
      // Clean the URL so it doesn't persist on refresh
      window.history.replaceState(null, '', window.location.pathname);

      // Auto-join if we have saved credentials, otherwise show quick join popup
      const savedName = localStorage.getItem(LS_USERNAME_KEY);
      const savedEmoji = localStorage.getItem(LS_EMOJI_KEY);
      if (savedName && savedEmoji) {
        connect(savedName, savedEmoji, code);
      } else {
        setPendingRefcode(code);
      }
    }
  }, [connect]);

  // Handle quick join popup submission
  const handleQuickJoin = useCallback(() => {
    const trimmedName = quickJoinName.trim();
    if (!trimmedName || !pendingRefcode) return;
    // Save to localStorage as their preference
    try {
      localStorage.setItem(LS_USERNAME_KEY, trimmedName);
      localStorage.setItem(LS_EMOJI_KEY, quickJoinEmoji);
    } catch (e) { /* ignore storage errors */ }
    setPendingRefcode(null);
    connect(trimmedName, quickJoinEmoji, pendingRefcode);
  }, [quickJoinName, quickJoinEmoji, pendingRefcode, connect]);

  // ===== QUICK JOIN POPUP (invite link without saved credentials) =====
  if (pendingRefcode) {
    const canJoin = quickJoinName.trim().length > 0;
    return (
      <>
        <GlobalStyle />
        <QuickJoinOverlay>
          <QuickJoinCard>
            <QuickJoinTitle>Partecipa</QuickJoinTitle>
            <QuickJoinSubtitle>Stanza: {pendingRefcode}</QuickJoinSubtitle>

            <QuickJoinField>
              <QuickJoinLabel>Il tuo nome</QuickJoinLabel>
              <QuickJoinInput
                type="text"
                placeholder="Inserisci il tuo nome"
                value={quickJoinName}
                onChange={(e) => setQuickJoinName(e.target.value.slice(0, 12))}
                maxLength={12}
                autoFocus
              />
            </QuickJoinField>

            <QuickJoinField>
              <QuickJoinLabel>Scegli un'emoji</QuickJoinLabel>
              <QuickJoinEmojiGrid>
                {AVATAR_EMOJIS.map((emoji) => (
                  <QuickJoinEmojiBtn
                    key={emoji}
                    isSelected={quickJoinEmoji === emoji}
                    onClick={() => setQuickJoinEmoji(emoji)}
                  >
                    {emoji}
                  </QuickJoinEmojiBtn>
                ))}
              </QuickJoinEmojiGrid>
            </QuickJoinField>

            <QuickJoinActions>
              <QuickJoinCancelBtn onClick={() => setPendingRefcode(null)}>
                Annulla
              </QuickJoinCancelBtn>
              <QuickJoinSubmitBtn onClick={handleQuickJoin} disabled={!canJoin}>
                Partecipa
              </QuickJoinSubmitBtn>
            </QuickJoinActions>
          </QuickJoinCard>
        </QuickJoinOverlay>
      </>
    );
  }

  // ===== HERO PHASE =====
  if (phase === 'hero') {
    return (
      <>
        <GlobalStyle />
        <HeroScreen
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
          error={connectError}
          onDismissError={() => setConnectError(null)}
          initialRoomCode={initialRoomCode}
        />
      </>
    );
  }

  // ===== CONNECTING PHASE =====
  if (phase === 'connecting') {
    return (
      <>
        <GlobalStyle />
        <ConnectingWrapper>
          <CardBackImage src="/assets/cards/back.jpg" alt="Caricamento" />
          <ConnectingTextRow>
            {connectingText}
            <AnimDot delay={0}>.</AnimDot>
            <AnimDot delay={200}>.</AnimDot>
            <AnimDot delay={400}>.</AnimDot>
          </ConnectingTextRow>
        </ConnectingWrapper>
      </>
    );
  }

  // ===== CONNECTED PHASE =====
  return <ConnectedApp username={username} avatarEmoji={avatarEmoji} gameMode={gameMode} />;
}