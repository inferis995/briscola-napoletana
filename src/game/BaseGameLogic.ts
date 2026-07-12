import { PlayerState } from "playroomkit";
import {
  Card,
  CardValue,
  Suit,
  createDeck,
  shuffleDeck,
  BRISCOLA_VALUE_ORDER
} from '@/components/Card';

// ===== TYPE DEFINITIONS =====
export interface PlayedCardData {
  card: Card;
  playerId: string;
  transform: string;
}

export type GamePhase =
  | 'waiting'
  | 'playing'
  | 'round_complete'
  | 'smazzata_complete'
  | 'game_over'
  | 'revealing_hands';

export interface RoundHistoryEntry {
  roundNumber: number;
  playedCards: PlayedCardData[];
  winnerId: string;
}

export interface GameState {
  phase: GamePhase;
  deck: Card[];
  trumpCard: Card | null;
  trumpSuit: Suit | null;
  playerHands: { [playerId: string]: Card[] };
  playerStacks: { [playerId: string]: Card[] };
  playedCards: PlayedCardData[];
  currentTurnPlayerIndex: number;
  roundNumber: number;
  roundWinnerId: string | null;
  finalScores: { [playerId: string]: number };
  gameWinnerId: string | null;
  lastSwapPlayerId: string | null;
  roundHistory: RoundHistoryEntry[];
  // 2v2 team mode fields
  teams?: { [playerId: string]: number };
  teamScores?: { [team: string]: number };
  turnOrder?: string[];
  winnerTeam?: number;
  // Turn timer: epoch ms entro cui il giocatore di turno deve giocare (host clock)
  turnDeadline?: number | null;
  // Partita terminata in anticipo (es. un giocatore ha abbandonato)
  endedEarly?: boolean;
  // 2 smazzate fields (1v1 and 2v2 only)
  smazzataNumber: number;
  smazzata1Scores?: { [playerId: string]: number };
  smazzata1TeamScores?: { [team: string]: number };
  smazzata2Scores?: { [playerId: string]: number };
  smazzata2TeamScores?: { [team: string]: number };
}

export interface GameConfig {
  cardsPerPlayer: number;
  minPlayers: number;
  maxPlayers: number;
}

/**
 * Base class for all game modes.
 * Host-authoritative: only the host creates and mutates this.
 * All methods are synchronous and return state snapshots.
 */
export abstract class BaseGameLogic {
  protected players: PlayerState[];
  protected state: GameState;
  protected config: GameConfig;

  constructor(players: PlayerState[], config: GameConfig) {
    this.players = players;
    this.config = config;
    this.state = {
      phase: 'waiting',
      deck: [],
      trumpCard: null,
      trumpSuit: null,
      playerHands: {},
      playerStacks: {},
      playedCards: [],
      currentTurnPlayerIndex: 0,
      roundNumber: 1,
      roundWinnerId: null,
      finalScores: {},
      gameWinnerId: null,
      lastSwapPlayerId: null,
      roundHistory: [],
      smazzataNumber: 1,
    };
  }

  /**
   * Get a deep copy of the current game state
   */
  getState(): GameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Load state from shared multiplayer state (host uses this to stay in sync)
   */
  loadState(state: GameState): void {
    this.state = JSON.parse(JSON.stringify(state));
  }

  /**
   * Initialize the game - shuffle deck and deal cards.
   * Called once by the host. Returns new state.
   */
  initializeGame(): GameState {
    const fullDeck = shuffleDeck(createDeck());
    const trumpCard = fullDeck.pop()!;

    // Balance deck so remaining cards are divisible by number of players
    const remainingCards = fullDeck.length;
    const cardsToRemove = remainingCards % this.players.length;
    for (let i = 0; i < cardsToRemove; i++) {
      fullDeck.pop();
    }

    const { newDeck, hands } = this.dealCards(fullDeck);

    const stacks: { [playerId: string]: Card[] } = {};
    this.players.forEach(player => {
      stacks[player.id] = [];
    });

    this.state = {
      phase: 'playing',
      deck: newDeck,
      trumpCard,
      trumpSuit: trumpCard.suit,
      playerHands: hands,
      playerStacks: stacks,
      playedCards: [],
      currentTurnPlayerIndex: 0,
      roundNumber: 1,
      roundWinnerId: null,
      finalScores: {},
      gameWinnerId: null,
      lastSwapPlayerId: null,
      roundHistory: [],
      smazzataNumber: 1,
    };

    return this.getState();
  }

  /**
   * Deal cards to all players
   */
  protected dealCards(deck: Card[]): { newDeck: Card[]; hands: { [playerId: string]: Card[] } } {
    const newDeck = [...deck];
    const hands: { [playerId: string]: Card[] } = {};

    this.players.forEach(player => {
      hands[player.id] = [];
    });

    for (let cardIndex = 0; cardIndex < this.config.cardsPerPlayer; cardIndex++) {
      for (let playerIndex = 0; playerIndex < this.players.length; playerIndex++) {
        if (newDeck.length > 0) {
          const card = newDeck.pop()!;
          hands[this.players[playerIndex].id].push(card);
        }
      }
    }

    return { newDeck, hands };
  }

  /**
   * Play a card. Returns new state if valid, null otherwise.
   * Only the host calls this.
   */
  abstract playCard(playerId: string, cardId: string): GameState | null;

  /**
   * Resolve the completed round. Returns new state.
   * Only the host calls this after the display timeout.
   */
  abstract resolveRound(): GameState;

  /**
   * Swap a 7 or 2 of trump suit with the trump card.
   * 7 can swap major trump cards (King, Knight, Jack, Ace, Three)
   * 2 can swap minor trump cards (rest)
   * Can be done any time, not turn-dependent.
   */
  swapWithTrump(playerId: string, cardId: string): GameState | null {
    if (this.state.phase !== 'playing' && this.state.phase !== 'round_complete') return null;
    if (!this.state.trumpCard || this.state.deck.length === 0) return null;

    const playerHand = this.state.playerHands[playerId];
    if (!playerHand) return null;

    const cardIndex = playerHand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return null;

    const card = playerHand[cardIndex];
    const trumpCard = this.state.trumpCard;

    // Must be same suit as trump
    if (card.suit !== trumpCard.suit) return null;

    // Major cards: King, Knight, Jack, Ace (ONE), Three
    const MAJOR = [CardValue.KING, CardValue.KNIGHT, CardValue.JACK, CardValue.ONE, CardValue.THREE];
    const isMajorTrump = MAJOR.includes(trumpCard.value);

    // 7 swaps major trump cards, 2 swaps minor trump cards
    if (card.value === CardValue.SEVEN && !isMajorTrump) return null;
    if (card.value === CardValue.TWO && isMajorTrump) return null;
    if (card.value !== CardValue.SEVEN && card.value !== CardValue.TWO) return null;

    // Perform swap: card goes to trump position, trump goes to hand
    const newHand = [...playerHand];
    newHand[cardIndex] = trumpCard;

    this.state = {
      ...this.state,
      trumpCard: card,
      playerHands: { ...this.state.playerHands, [playerId]: newHand },
      lastSwapPlayerId: playerId,
    };

    return this.getState();
  }

  /**
   * Whether this mode uses 2 smazzate per partita (1v1 and 2v2).
   * Override to true in those modes.
   */
  usesTwoSmazzate(): boolean {
    return false;
  }

  /**
   * Start the second smazzata (round 2 of 2).
   * Keeps smazzata1 scores, resets hands/deck/trump.
   */
  startSecondSmazzata(): GameState {
    // Save smazzata 1 scores before resetting
    const smazzata1Scores = this.evaluateGame().scores;
    const smazzata1TeamScores = this.state.teamScores
      ? { ...this.state.teamScores }
      : undefined;

    // Reinitialize the board (new deck, hands, trump)
    const newState = this.initializeGame();
    newState.smazzataNumber = 2;
    newState.smazzata1Scores = smazzata1Scores;
    newState.smazzata1TeamScores = smazzata1TeamScores;

    this.state = newState;
    return this.getState();
  }

  /**
   * Evaluate round winner from played cards
   */
  protected evaluateRound(playedCards: PlayedCardData[], trumpSuit: Suit): string {
    if (playedCards.length === 0) return '';

    const leadingSuit = playedCards[0].card.suit;
    const trumpCards = playedCards.filter(pc => pc.card.suit === trumpSuit);

    if (trumpCards.length > 0) {
      return trumpCards.reduce((highest, current) => {
        const highestValue = BRISCOLA_VALUE_ORDER.indexOf(highest.card.value);
        const currentValue = BRISCOLA_VALUE_ORDER.indexOf(current.card.value);
        return currentValue < highestValue ? current : highest;
      }, trumpCards[0]).playerId;
    }

    const leadingSuitCards = playedCards.filter(pc => pc.card.suit === leadingSuit);

    if (leadingSuitCards.length > 0) {
      return leadingSuitCards.reduce((highest, current) => {
        const highestValue = BRISCOLA_VALUE_ORDER.indexOf(highest.card.value);
        const currentValue = BRISCOLA_VALUE_ORDER.indexOf(current.card.value);
        return currentValue < highestValue ? current : highest;
      }, leadingSuitCards[0]).playerId;
    }

    return playedCards[0].playerId;
  }

  /**
   * Calculate final game scores from player stacks
   */
  evaluateGame(): { scores: { [playerId: string]: number }; winner: string } {
    const scores: { [playerId: string]: number } = {};

    Object.keys(this.state.playerStacks).forEach(playerId => {
      const stack = this.state.playerStacks[playerId];
      scores[playerId] = stack.reduce((total, card) => total + card.score, 0);
    });

    const winner = Object.keys(scores).reduce((a, b) =>
      scores[a] > scores[b] ? a : b
    );

    return { scores, winner };
  }

  /**
   * Get player by ID
   */
  protected getPlayer(playerId: string): PlayerState | undefined {
    return this.players.find(p => p.id === playerId);
  }

  /**
   * Get all players
   */
  getPlayers(): PlayerState[] {
    return this.players;
  }

  /**
   * Utility: random number between min and max
   */
  protected randomNumBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  /**
   * Utility: generate random transform for card animation
   */
  protected generateRandomTransform(): string {
    return `rotate(${this.randomNumBetween(-10, 10)}deg) translateX(${this.randomNumBetween(-10, 10)}px)`;
  }
}
