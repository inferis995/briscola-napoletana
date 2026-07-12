import { PlayerState } from "playroomkit";
import {
  Card,
  Suit,
  createDeck,
  shuffleDeck
} from '@/components/Card';
import {
  BaseGameLogic,
  PlayedCardData,
  GameConfig,
  GameState
} from '../BaseGameLogic';

/**
 * ThreeForAllGameLogic
 * 3 players compete individually. Host-authoritative.
 *
 * Game Flow:
 * 1. Each player starts with 3 cards
 * 2. Players take turns playing one card each in order
 * 3. After all players play a card, phase becomes 'round_complete'
 * 4. After a visual delay, the host calls resolveRound()
 * 5. The winner gets all played cards, new cards are drawn, next round starts
 * 6. Game ends when all cards are played
 */
export class ThreeForAllGameLogic extends BaseGameLogic {
  protected static readonly CONFIG: GameConfig = {
    cardsPerPlayer: 3,
    minPlayers: 3,
    maxPlayers: 3
  };

  constructor(players: PlayerState[]) {
    if (players.length !== 3) {
      throw new Error("ThreeForAllGameLogic requires exactly 3 players");
    }
    super(players, ThreeForAllGameLogic.CONFIG);
  }

  /**
   * Regola classica della briscola a 3: si toglie un 2 (carta da 0 punti)
   * così il mazzo scende a 39 carte e i 120 punti restano tutti in gioco.
   * 38 carte dopo la briscola: 9 distribuite (3 a testa), 29 nel tallone.
   * La briscola scoperta viene pescata per ultima: 29 + 1 = 30 → 10 giri di pesca.
   */
  initializeGame(): GameState {
    const fullDeck = shuffleDeck(createDeck().filter(c => c.id !== 'coppe_2'));
    const trumpCard = fullDeck.pop()!;

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
   * Play a card from a player. Returns new state or null if invalid.
   */
  playCard(playerId: string, cardId: string): GameState | null {
    if (this.state.phase !== 'playing') return null;

    const currentTurnPlayer = this.players[this.state.currentTurnPlayerIndex];
    if (currentTurnPlayer.id !== playerId) return null;

    const playerHand = this.state.playerHands[playerId];
    if (!playerHand) return null;

    const cardIndex = playerHand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return null;

    const card = playerHand[cardIndex];
    const newHand = [...playerHand];
    newHand.splice(cardIndex, 1);

    const newPlayedCards = [
      ...this.state.playedCards,
      { card, playerId, transform: this.generateRandomTransform() }
    ];

    const newHands = { ...this.state.playerHands, [playerId]: newHand };
    const nextTurn = (this.state.currentTurnPlayerIndex + 1) % this.players.length;

    // Check if round is complete
    if (newPlayedCards.length === this.players.length) {
      const winnerId = this.evaluateRound(
        newPlayedCards,
        this.state.trumpSuit || ('coin' as Suit)
      );

      this.state = {
        ...this.state,
        phase: 'round_complete',
        playerHands: newHands,
        playedCards: newPlayedCards,
        currentTurnPlayerIndex: nextTurn,
        roundWinnerId: winnerId,
      };
    } else {
      this.state = {
        ...this.state,
        playerHands: newHands,
        playedCards: newPlayedCards,
        currentTurnPlayerIndex: nextTurn,
      };
    }

    return this.getState();
  }

  /**
   * Resolve the completed round: award cards, draw new ones, check game over.
   */
  resolveRound(): GameState {
    if (this.state.phase !== 'round_complete' || !this.state.roundWinnerId) {
      return this.getState();
    }

    const winnerId = this.state.roundWinnerId;

    // Record round history
    const historyEntry = {
      roundNumber: this.state.roundNumber,
      playedCards: [...this.state.playedCards],
      winnerId,
    };

    // Award played cards to winner
    const newStacks: { [playerId: string]: Card[] } = {};
    for (const pid of Object.keys(this.state.playerStacks)) {
      newStacks[pid] = [...this.state.playerStacks[pid]];
    }
    if (!newStacks[winnerId]) newStacks[winnerId] = [];
    newStacks[winnerId].push(...this.state.playedCards.map(pc => pc.card));

    // Draw cards (winner first, then others in order)
    const newDeck = [...this.state.deck];
    const newHands: { [playerId: string]: Card[] } = {};
    for (const pid of Object.keys(this.state.playerHands)) {
      newHands[pid] = [...this.state.playerHands[pid]];
    }

    let trumpCard = this.state.trumpCard;

    if (newDeck.length > 0 || trumpCard) {
      const winnerIndex = this.players.findIndex(p => p.id === winnerId);
      for (let i = 0; i < this.players.length; i++) {
        const playerIndex = (winnerIndex + i) % this.players.length;
        const pid = this.players[playerIndex].id;
        while (newHands[pid].length < this.config.cardsPerPlayer) {
          if (newDeck.length > 0) {
            const card = newDeck.pop()!;
            newHands[pid].push(card);
          } else if (trumpCard) {
            // L'ultima carta pescata è la briscola scoperta
            newHands[pid].push(trumpCard);
            trumpCard = null;
            break;
          } else {
            break;
          }
        }
      }
    }

    // Check game over
    const allHandsEmpty = Object.values(newHands).every(hand => hand.length === 0);
    const deckEmpty = newDeck.length === 0;
    const noTrump = trumpCard === null;

    if (allHandsEmpty && deckEmpty && noTrump) {
      const scores: { [playerId: string]: number } = {};
      Object.keys(newStacks).forEach(pid => {
        scores[pid] = newStacks[pid].reduce((total, card) => total + card.score, 0);
      });
      const maxScore = Math.max(...Object.values(scores));
      const topPlayers = Object.keys(scores).filter(pid => scores[pid] === maxScore);
      const gameWinner = topPlayers.length === 1 ? topPlayers[0] : null;

      this.state = {
        ...this.state,
        phase: 'game_over',
        deck: newDeck,
        trumpCard,
        playerHands: newHands,
        playerStacks: newStacks,
        playedCards: [],
        finalScores: scores,
        gameWinnerId: gameWinner,
        roundHistory: [...this.state.roundHistory, historyEntry],
      };
    } else {
      const winnerIndex = this.players.findIndex(p => p.id === winnerId);
      this.state = {
        ...this.state,
        phase: 'playing',
        deck: newDeck,
        trumpCard,
        playerHands: newHands,
        playerStacks: newStacks,
        playedCards: [],
        currentTurnPlayerIndex: winnerIndex,
        roundNumber: this.state.roundNumber + 1,
        roundWinnerId: null,
        roundHistory: [...this.state.roundHistory, historyEntry],
      };
    }

    return this.getState();
  }

  /**
   * Get game mode name
   */
  getModeName(): string {
    return "3-for-all";
  }

  /**
   * Get game mode description
   */
  getModeDescription(): string {
    return "3 giocatori, ognuno per sé. La carta più alta vince la presa.";
  }
}
