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
  PlayerState,
} from "playroomkit";
import { Card, BRISCOLA_VALUE_ORDER } from '@/components/Card';
import { useNotification } from '@/components/Notification';
import { GameState, BaseGameLogic, remapPlayerId, SeatOwner } from '@/game/BaseGameLogic';
import { GameMode, getGameModeConfig, createGameLogic } from '@/game/GameModeSelector';
import { TwoVTwoGameLogic } from '@/game/modes/TwoVTwoGameLogic';
import { detectDevice, DeviceType } from '@/utils/deviceDetection';
import { RoundTableGameUI } from '@/components/RoundTableGameUI';
import { HeroScreen, LS_USERNAME_KEY, LS_EMOJI_KEY, AVATAR_EMOJIS } from '@/components/HeroScreen';
import { DESIGN, getPlayerName, getPlayerEmoji, getPlayerTeam, TEAM_COLORS } from '@/components/shared/gameDesign';

// ===== TYPES =====
type AppPhase = 'hero' | 'connecting' | 'connected';

// ===== RICONNESSIONE =====
// Identità persistente del client: sopravvive a refresh/crash e permette
// di reclamare il proprio posto al tavolo quando si rientra in partita.
const LS_CLIENT_ID_KEY = 'briscola_client_id';
const LS_LAST_ROOM_KEY = 'briscola_last_room';
// Tempo concesso a un ex-host disconnesso per rientrare prima che il nuovo
// host chiuda la partita mostrando i punteggi parziali.
const RECONNECT_GRACE_MS = 60000;
// Validità del prompt "riprendi l'ultima partita"
const LAST_ROOM_MAX_AGE_MS = 3 * 60 * 60 * 1000;

let cachedClientId: string | null = null;
const getClientId = (): string => {
  if (cachedClientId) return cachedClientId;
  try {
    let id = localStorage.getItem(LS_CLIENT_ID_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(LS_CLIENT_ID_KEY, id);
    }
    cachedClientId = id;
  } catch {
    cachedClientId = `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
  return cachedClientId;
};

const saveLastRoom = (code: string): void => {
  try {
    localStorage.setItem(LS_LAST_ROOM_KEY, JSON.stringify({ code, ts: Date.now() }));
  } catch {}
};

const readLastRoom = (): string | null => {
  try {
    const raw = localStorage.getItem(LS_LAST_ROOM_KEY);
    if (!raw) return null;
    const { code, ts } = JSON.parse(raw);
    if (typeof code !== 'string' || typeof ts !== 'number') return null;
    if (Date.now() - ts > LAST_ROOM_MAX_AGE_MS) return null;
    return code;
  } catch {
    return null;
  }
};

const clearLastRoom = (): void => {
  try {
    localStorage.removeItem(LS_LAST_ROOM_KEY);
  } catch {}
};

// Registro dei posti: associa ogni posto (player id di inizio partita)
// all'identità persistente e al nome del proprietario
const stampSeatOwners = (state: GameState, seatPlayers: PlayerState[]): GameState => ({
  ...state,
  seatOwners: Object.fromEntries(
    seatPlayers.map(p => [p.id, {
      clientId: (p.getState?.('clientId') as string) || '',
      name: getPlayerName(p),
    } as SeatOwner])
  ),
});

// ===== TURN TIMER =====
const TURN_TIMEOUT_MS = 30000;

// Imposta la deadline del turno (orologio host) quando si sta giocando
const stampTurnDeadline = (state: GameState): GameState => ({
  ...state,
  turnDeadline: state.phase === 'playing' ? Date.now() + TURN_TIMEOUT_MS : null,
});

// Carta giocata in automatico allo scadere del timer:
// meno punti possibile, preferendo le non-briscole, poi la più debole
const chooseAutoCard = (hand: Card[], trumpSuit: string | null): Card => {
  return [...hand].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const aTrump = a.suit === trumpSuit ? 1 : 0;
    const bTrump = b.suit === trumpSuit ? 1 : 0;
    if (aTrump !== bTrump) return aTrump - bTrump;
    return BRISCOLA_VALUE_ORDER.indexOf(b.value) - BRISCOLA_VALUE_ORDER.indexOf(a.value);
  })[0];
};

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
  const profileSetRef = useRef(false);
  const gameCountRef = useRef(0);
  const playersRef = useRef(players);
  const activeModeRef = useRef<GameMode | null>(null);
  const endedEarlyRef = useRef(false);
  // PlayerState per posto: conserva anche i giocatori usciti, così la logica
  // resta ricostruibile mentre si aspetta un loro eventuale rientro
  const seatPlayerMapRef = useRef<{ [playerId: string]: PlayerState }>({});

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { setGameStateRef.current = setGameState; }, [setGameState]);
  useEffect(() => { playersRef.current = players; }, [players]);

  // Risolve i PlayerState dei posti nell'ordine dei posti (chiavi di playerHands).
  // Ritorna null se qualche posto non è risolvibile.
  const resolveSeatPlayers = useCallback((state: GameState): PlayerState[] | null => {
    const seatIds = Object.keys(state.playerHands);
    const resolved = seatIds.map(id =>
      playersRef.current.find(p => p.id === id) || seatPlayerMapRef.current[id]
    );
    return resolved.every(Boolean) ? (resolved as PlayerState[]) : null;
  }, []);

  // Set player profile on mount
  useEffect(() => {
    if (currentPlayer && !profileSetRef.current) {
      currentPlayer.setState('displayName', username, true);
      currentPlayer.setState('avatarEmoji', avatarEmoji, true);
      currentPlayer.setState('clientId', getClientId(), true);
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
  useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);

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

  // Memorizza l'ultima stanza per il prompt "riprendi partita" dopo un refresh
  useEffect(() => {
    if (roomCode) saveLastRoom(roomCode);
  }, [roomCode]);

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
      setGameStateRef.current(stampTurnDeadline(newState), true);
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

    // Riconnessione: un giocatore rientrato (nuovo player id) reclama il suo
    // posto tramite l'identità persistente. L'host rimappa lo stato sul nuovo
    // id e ricostruisce la logica di gioco.
    RPC.register('claimSeat', async (data: { clientId: string }, caller: any) => {
      if (!isHost()) return 'not_host';
      if (!data?.clientId) return 'invalid';
      const state = gameStateRef.current;
      if (!state || !state.seatOwners) return 'no_game';

      const owners = state.seatOwners;
      const seatId = Object.keys(owners).find(sid => owners[sid].clientId === data.clientId);
      if (!seatId) return 'no_seat';
      if (seatId === caller.id || state.playerHands[caller.id]) return 'already_seated';
      // Il posto è reclamabile solo se il suo occupante originale è uscito
      if (playersRef.current.some(p => p.id === seatId)) return 'seat_taken';

      const callerPlayer: PlayerState =
        playersRef.current.find(p => p.id === caller.id) || (caller as PlayerState);

      let newState = remapPlayerId(state, seatId, caller.id);
      // Aggiorna il nome nel registro (potrebbe essere cambiato al rientro)
      newState = {
        ...newState,
        seatOwners: {
          ...newState.seatOwners,
          [caller.id]: { clientId: data.clientId, name: getPlayerName(callerPlayer) },
        },
      };

      delete seatPlayerMapRef.current[seatId];
      seatPlayerMapRef.current[caller.id] = callerPlayer;

      // Ricostruisce la logica nell'ordine dei posti
      const seatPlayers = resolveSeatPlayers(newState);
      if (seatPlayers && activeModeRef.current) {
        try {
          const logic = createGameLogic(seatPlayers, activeModeRef.current);
          logic.loadState(newState);
          gameLogicRef.current = logic;
        } catch (error) {
          console.error('Ricostruzione logica dopo reclaim fallita:', error);
        }
      }

      setGameStateRef.current(stampTurnDeadline(newState), true);
      return 'ok';
    });

    RPC.register('playAgain', async (_data: any, _caller: any) => {
      if (!isHost()) return;
      let logic = gameLogicRef.current;
      if (!logic) {
        // Host migrato senza logica (es. partita chiusa in anticipo): prova a ricrearla
        try {
          if (!activeModeRef.current) return;
          logic = createGameLogic(playersRef.current, activeModeRef.current);
          gameLogicRef.current = logic;
        } catch {
          return;
        }
      }
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

      setGameStateRef.current(stampTurnDeadline(stampSeatOwners(newState, allPlayers)), true);
      return "ok";
    });

    RPC.register('startSecondSmazzata', async (_data: any, _caller: any) => {
      if (!isHost()) return;
      const logic = gameLogicRef.current;
      if (!logic) return;
      const newState = logic.startSecondSmazzata();
      setGameStateRef.current(stampTurnDeadline(stampSeatOwners(newState, logic.getPlayers())), true);
      return "ok";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Host: risolve la presa dopo la pausa visiva. Vive in un effect (non nel
  // timer dell'RPC) così sopravvive anche a una migrazione dell'host.
  useEffect(() => {
    if (!amHost || !gameState || gameState.phase !== 'round_complete') return;
    const timer = setTimeout(() => {
      const latestState = gameStateRef.current;
      const logic = gameLogicRef.current;
      if (!latestState || latestState.phase !== 'round_complete' || !logic) return;
      logic.loadState(latestState);
      const resolvedState = logic.resolveRound();
      setGameStateRef.current(stampTurnDeadline(resolvedState), true);
    }, 1600);
    return () => clearTimeout(timer);
    // Dipende dall'identità dello stato: così un reclaim durante
    // round_complete rischedula la risoluzione con lo stato rimappato
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amHost, gameState]);

  // Host: allo scadere del timer di turno gioca in automatico una carta
  // per il giocatore di turno (evita che un AFK/disconnesso blocchi tutti)
  useEffect(() => {
    if (!amHost || !gameState) return;
    if (gameState.phase !== 'playing' || !gameState.turnDeadline) return;
    const deadline = gameState.turnDeadline;
    const timer = setTimeout(() => {
      const latestState = gameStateRef.current;
      const logic = gameLogicRef.current;
      if (!latestState || !logic) return;
      if (latestState.phase !== 'playing' || latestState.turnDeadline !== deadline) return;
      const pid = latestState.turnOrder
        ? latestState.turnOrder[latestState.playedCards.length]
        : logic.getPlayers()[latestState.currentTurnPlayerIndex]?.id;
      const hand = pid ? latestState.playerHands[pid] : undefined;
      if (!pid || !hand || hand.length === 0) return;
      const card = chooseAutoCard(hand, latestState.trumpSuit);
      logic.loadState(latestState);
      const newState = logic.playCard(pid, card.id);
      if (!newState) return;
      setGameStateRef.current(stampTurnDeadline(newState), true);
    }, Math.max(0, deadline - Date.now()) + 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amHost, gameState?.phase, gameState?.turnDeadline]);

  // Nuovo host dopo migrazione: ricostruisce la logica dallo stato condiviso.
  // Se un posto è vacante (chi è uscito era l'host), concede una finestra di
  // grazia per il rientro; solo allo scadere chiude la partita mostrando i
  // punteggi raccolti, invece di lasciare il tavolo congelato.
  useEffect(() => {
    if (!amHost || !gameState || gameLogicRef.current) return;
    const activePhases = ['playing', 'round_complete', 'revealing_hands', 'smazzata_complete'];
    if (!activePhases.includes(gameState.phase)) return;
    const seatIds = Object.keys(gameState.playerHands);
    if (seatIds.length === 0) return;

    const seatPlayers = resolveSeatPlayers(gameState);
    if (seatPlayers && activeMode) {
      try {
        const logic = createGameLogic(seatPlayers, activeMode);
        logic.loadState(gameState);
        gameLogicRef.current = logic;
        seatPlayers.forEach(p => { seatPlayerMapRef.current[p.id] = p; });
        return;
      } catch (error) {
        console.error('Ricostruzione logica di gioco fallita:', error);
      }
    }

    // Posto vacante: aspetta un eventuale reclaim prima di chiudere
    const timer = setTimeout(() => {
      const latest = gameStateRef.current;
      if (!latest || gameLogicRef.current || endedEarlyRef.current) return;
      if (!activePhases.includes(latest.phase)) return;
      const latestSeatIds = Object.keys(latest.playerHands);
      const stillMissing = latestSeatIds.some(
        id => !playersRef.current.some(p => p.id === id) && !seatPlayerMapRef.current[id]
      );
      if (!stillMissing) return;
      endedEarlyRef.current = true;

      const scores: { [pid: string]: number } = {};
      latestSeatIds.forEach(pid => {
        scores[pid] = (latest.playerStacks[pid] || []).reduce((t, c) => t + c.score, 0);
      });
      let teamScores: { [team: string]: number } | undefined;
      let winnerTeam: number | undefined;
      if (latest.teams) {
        teamScores = { '1': 0, '2': 0 };
        Object.keys(scores).forEach(pid => {
          teamScores![String(latest.teams![pid] || 1)] += scores[pid];
        });
        winnerTeam = teamScores['1'] === teamScores['2'] ? 0 : teamScores['1'] > teamScores['2'] ? 1 : 2;
      }
      const maxScore = Math.max(...Object.values(scores));
      const topPlayers = Object.keys(scores).filter(pid => scores[pid] === maxScore);

      setGameStateRef.current({
        ...latest,
        phase: 'game_over',
        endedEarly: true,
        finalScores: scores,
        gameWinnerId: topPlayers.length === 1 ? topPlayers[0] : null,
        ...(teamScores ? { teamScores, winnerTeam } : {}),
        playedCards: [],
        turnDeadline: null,
      }, true);
      showNotification('Partita terminata: un giocatore non è rientrato', 'ERROR' as any);
    }, RECONNECT_GRACE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amHost, gameState, players, activeMode]);

  // Permette una nuova chiusura anticipata dopo che una nuova partita è iniziata
  useEffect(() => {
    if (gameState?.phase === 'playing') endedEarlyRef.current = false;
  }, [gameState?.phase]);

  // Handle card play
  const handleCardPlay = useCallback((card: Card) => {
    if (!currentPlayer || !gameState) return;
    if (gameState.phase !== 'playing') {
      showNotification("Aspetta la fine del turno", "WARNING" as any);
      return;
    }
    // Il turno si determina dall'ordine dei posti (chiavi di playerHands),
    // non dall'ordine della lista dei connessi, che può divergere dopo un rientro
    const seatIds = Object.keys(gameState.playerHands);
    const activeTurnPlayerId = gameState.turnOrder
      ? gameState.turnOrder[gameState.playedCards.length]
      : seatIds[gameState.currentTurnPlayerIndex];
    if (activeTurnPlayerId !== currentPlayer.id) {
      showNotification("Non è il tuo turno!", "WARNING" as any);
      return;
    }
    RPC.call('playCard', { cardId: card.id }, RPC.Mode.HOST);
  }, [currentPlayer, gameState, showNotification]);

  const handleSwapTrump = useCallback((card: Card) => {
    if (!currentPlayer || !gameState) return;
    RPC.call('swapTrump', { cardId: card.id }, RPC.Mode.HOST);
  }, [currentPlayer, gameState]);

  const handlePlayAgain = useCallback(() => {
    if (!amHost) return;
    RPC.call('playAgain', {}, RPC.Mode.HOST);
  }, [amHost]);

  const handleStartSecondSmazzata = useCallback(() => {
    if (!amHost) return;
    RPC.call('startSecondSmazzata', {}, RPC.Mode.HOST);
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
      players.forEach(p => { seatPlayerMapRef.current[p.id] = p; });
      const initialState = logic.initializeGame();
      setGameState(stampTurnDeadline(stampSeatOwners(initialState, players)), true);
    } catch (error) {
      console.error("Failed to start game:", error);
      showNotification("Impossibile avviare la partita", "ERROR" as any);
    }
  }, [amHost, players, setGameState, showNotification, activeMode, modeConfig]);

  // Handle player join/quit
  useEffect(() => {
    const unsubscribe = onPlayerJoin((playerState: any) => {
      playerState.onQuit(() => {
        const name = getPlayerName(playerState) || 'Un giocatore';
        const inGame = gameStateRef.current && gameStateRef.current.phase !== 'game_over';
        showNotification(
          inGame
            ? `${name} si è disconnesso — può rientrare, nel frattempo gioca in automatico`
            : `${name} ha lasciato la partita`,
          "ERROR" as any
        );
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
        setGameStateRef.current(stampTurnDeadline({ ...latestState, phase: 'playing' }), true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.phase, amHost]);

  // ==================== RICONNESSIONE (LATO CHI RIENTRA) ====================
  // Se c'è una partita e non ho un posto, provo a reclamare il mio vecchio
  // posto tramite clientId. Ritento finché il reclaim non riesce o fallisce
  // definitivamente (nessun posto mi appartiene: partita di altri).
  const hasSeat = !!(gameState && currentPlayer && gameState.playerHands[currentPlayer.id]);
  const [claimFailed, setClaimFailed] = useState(false);

  useEffect(() => {
    if (!gameState || !currentPlayer || hasSeat || claimFailed) return;
    if (Object.keys(gameState.playerHands).length === 0) return;

    let cancelled = false;
    let failures = 0;
    const tryClaim = async () => {
      try {
        const res = await RPC.call('claimSeat', { clientId: getClientId() }, RPC.Mode.HOST);
        if (cancelled) return;
        if (res === 'no_seat' || res === 'seat_taken' || res === 'invalid') {
          failures += 1;
          if (failures >= 3) setClaimFailed(true);
        }
        // 'ok' / 'already_seated': lo stato sincronizzato farà sparire l'overlay
      } catch {
        // host non raggiungibile o in migrazione: si ritenta
      }
    };
    tryClaim();
    const interval = setInterval(tryClaim, 2500);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState === null, hasSeat, claimFailed, currentPlayer?.id]);

  // Posti il cui occupante è attualmente disconnesso (visibile a tutti i client)
  const disconnectedSeatNames = (gameState && gameState.phase !== 'game_over' && gameState.seatOwners)
    ? Object.keys(gameState.seatOwners)
        .filter(sid => !players.some(p => p.id === sid))
        .map(sid => gameState.seatOwners![sid].name)
    : [];

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
                    {isYou && <YouTag>TU</YouTag>}
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
            activeMode ? (
              <StartButton onClick={handleStartGame} disabled={!canStart}>
                {canStart
                  ? 'AVVIA PARTITA'
                  : players.length < (modeConfig?.minPlayers ?? 2)
                    ? `MANCANO ${needed} GIOCATORI`
                    : 'I TEAM DEVONO ESSERE 2v2'
                }
              </StartButton>
            ) : (
              // Host senza modalità: stanza ricreata dal prompt di ripresa
              // dopo che la partita originale è terminata — via d'uscita pulita
              <StartButton onClick={() => { clearLastRoom(); window.location.reload(); }}>
                PARTITA NON TROVATA — TORNA ALLA HOME
              </StartButton>
            )
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

  // ==================== RECONNECT VIEW ====================
  // Partita in corso ma non ho un posto: sto reclamando il mio (rientro),
  // oppure sono un estraneo e non posso partecipare.
  if (currentPlayer && !gameState.playerHands[currentPlayer.id] && Object.keys(gameState.playerHands).length > 0) {
    return (
      <LobbyWrapper>
        <GlobalStyle />
        <ReconnectCard>
          {claimFailed ? (
            <>
              <ReconnectTitle>Partita in corso</ReconnectTitle>
              <ReconnectText>Non c'è un posto per te in questa partita.</ReconnectText>
              <ReconnectExitButton onClick={() => { clearLastRoom(); window.location.reload(); }}>
                TORNA ALLA HOME
              </ReconnectExitButton>
            </>
          ) : (
            <>
              <PulsingDot />
              <ReconnectTitle>Rientro in partita…</ReconnectTitle>
              <ReconnectText>Stiamo recuperando il tuo posto al tavolo</ReconnectText>
            </>
          )}
        </ReconnectCard>
      </LobbyWrapper>
    );
  }

  // ==================== GAME VIEW ====================
  const gameUI = (
    <RoundTableGameUI
      gameState={gameState}
      players={players}
      currentPlayerId={currentPlayer!.id}
      onCardPlay={handleCardPlay}
      onSwapTrump={handleSwapTrump}
      onPlayAgain={handlePlayAgain}
      onStartSecondSmazzata={handleStartSecondSmazzata}
      isHost={amHost}
      onQuickChat={handleQuickChat}
      quickChatMessage={quickChat}
    />
  );

  return (
    <GameWrapper>
      <GlobalStyle />
      {disconnectedSeatNames.length > 0 && (
        <DisconnectBanner>
          <PulsingDot />
          In attesa che {disconnectedSeatNames.join(', ')} rientri…
        </DisconnectBanner>
      )}
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
    user-select: none;
    -webkit-text-size-adjust: 100%;
  }

  html {
    width: 100vw;
  }
`;

// ===== GAME WRAPPER =====
const GameWrapper = styled.div`
  background: radial-gradient(ellipse at center, #0f1f0f 0%, #0a120a 100%);
  height: 100vh;
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
  position: fixed;
  inset: 0;
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
  min-height: 100svh;
  width: 100%;
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
  min-height: 100svh;
  width: 100%;
  background: ${DESIGN.colors.bg.secondary};
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 20px 20px max(20px, env(safe-area-inset-bottom, 20px));
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
  border: 1px solid rgba(212,160,23,0.25);
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
  color: #d4a017;
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
  border: 1px solid ${DESIGN.colors.surfaces.elevated};
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #d4a017;
  cursor: pointer;
  transition: all 150ms;

  &:hover {
    background: rgba(212,160,23,0.12);
    border-color: #d4a017;
    color: #f5e6a3;
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
  background: #d4a017;
  color: #0a120a;

  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(212,160,23,0.4); }
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
  background: #d4a017;
  animation: ${hostPulse} 1.5s ease-in-out infinite;
`;

// ===== RECONNECT STYLES =====
const ReconnectCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: ${DESIGN.colors.surfaces.containers};
  border: 1px solid rgba(212,160,23,0.25);
  border-radius: ${DESIGN.radius.containers};
  padding: 32px 28px;
  width: 100%;
  max-width: 360px;
  text-align: center;
  animation: ${lobbyFadeIn} 300ms ease-out;
`;

const ReconnectTitle = styled.h2`
  font-size: 22px;
  font-weight: 700;
  color: ${DESIGN.colors.text.primary};
  margin: 0;
`;

const ReconnectText = styled.p`
  font-size: 13px;
  color: ${DESIGN.colors.text.secondary};
  margin: 0;
`;

const ReconnectExitButton = styled.button`
  margin-top: 8px;
  padding: 12px 24px;
  border-radius: ${DESIGN.radius.buttons};
  border: none;
  background: #d4a017;
  color: #0a120a;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: transform 150ms ease-out;

  &:hover { transform: translateY(-1px); }
  &:active { transform: scale(0.97); }
`;

const DisconnectBanner = styled.div`
  position: fixed;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: ${DESIGN.colors.surfaces.elevated};
  border: 1px solid rgba(230,57,70,0.5);
  border-radius: ${DESIGN.radius.buttons};
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  color: ${DESIGN.colors.text.secondary};
  z-index: 1900;
  white-space: nowrap;
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
  const [connectingText, setConnectingText] = useState('Connessione');
  const [initialRoomCode, setInitialRoomCode] = useState<string | undefined>(undefined);

  // Quick join popup state (for invite links when user has no saved credentials)
  const [pendingRefcode, setPendingRefcode] = useState<string | null>(null);
  const [quickJoinName, setQuickJoinName] = useState('');
  const [quickJoinEmoji, setQuickJoinEmoji] = useState(AVATAR_EMOJIS[0]);

  // Prompt "riprendi l'ultima partita" (riconnessione dopo refresh/crash)
  const [resumeCode, setResumeCode] = useState<string | null>(null);

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
      // Evita che il prompt di ripresa continui a proporre una stanza inaccessibile
      if (roomCode && readLastRoom() === roomCode) clearLastRoom();
      if (error?.message === 'ROOM_LIMIT_EXCEEDED') {
        setConnectError('Stanza piena! Se ti stai riconnettendo, riprova tra qualche secondo.');
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
      return;
    }

    // Nessun refcode: se c'è una partita recente e credenziali salvate,
    // proponi di rientrare (riconnessione dopo refresh o crash)
    const lastRoom = readLastRoom();
    const savedName = localStorage.getItem(LS_USERNAME_KEY);
    const savedEmoji = localStorage.getItem(LS_EMOJI_KEY);
    if (lastRoom && savedName && savedEmoji) {
      setResumeCode(lastRoom);
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

  // ===== RESUME PROMPT (riconnessione all'ultima partita) =====
  if (resumeCode && phase === 'hero') {
    return (
      <>
        <GlobalStyle />
        <QuickJoinOverlay>
          <QuickJoinCard>
            <QuickJoinTitle>Riprendi la partita?</QuickJoinTitle>
            <QuickJoinSubtitle>Stanza: {resumeCode}</QuickJoinSubtitle>
            <p style={{ fontSize: '13px', color: DESIGN.colors.text.secondary, textAlign: 'center', margin: '0 0 20px' }}>
              Risulti in una partita recente. Vuoi rientrare al tuo posto?
            </p>
            <QuickJoinActions>
              <QuickJoinCancelBtn onClick={() => { clearLastRoom(); setResumeCode(null); }}>
                No, nuova partita
              </QuickJoinCancelBtn>
              <QuickJoinSubmitBtn onClick={() => {
                const savedName = localStorage.getItem(LS_USERNAME_KEY);
                const savedEmoji = localStorage.getItem(LS_EMOJI_KEY);
                const code = resumeCode;
                setResumeCode(null);
                if (savedName && savedEmoji && code) {
                  connect(savedName, savedEmoji, code);
                }
              }}>
                RIENTRA
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