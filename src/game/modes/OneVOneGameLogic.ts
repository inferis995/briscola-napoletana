import { PlayerState } from "playroomkit";
import {
  Card,
  Suit,
  BRISCOLA_VALUE_ORDER,
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
 * OneVOneGameLogic
 * 2 players compete head-to-head. Host-authoritative.
 *
 * Rules (differences from 3-for-all):
 * - 40 card deck: 1 trump, 6 dealt (3 each), 33 remain in deck
 * - Only 2 cards played per round
 * - 3-card hand throughout
 * - When the deck runs out, the last player to draw picks up the trump card
 *   so both players end with the same number of cards
 * - Everything else (scoring, trump suit, swap mechanic) is identical
 */
export class OneVOneGameLogic extends BaseGameLogic {
  protected static readonly CONFIG: GameConfig = {
    cardsPerPlayer: 3,
    minPlayers: 2,
    maxPlayers: 2
  };

  constructor(players: PlayerState[]) {
    if (players.length !== 2) {
      throw new Error("OneVOneGameLogic requires exactly 2 players");
    }
    super(players, OneVOneGameLogic.CONFIG);
  }

  /**
   * 1v1 uses 2 smazzate per partita.
   */
  usesTwoSmazzate(): boolean {
    return true;
  }

  /**
   * Override initializeGame — no deck balancing for 1v1.
   * 40 cards: 1 trump + 6 dealt (3 each) + 33 in deck.
   * The trump card acts as the final draw card.
   */
  initializeGame(): GameState {
    const fullDeck = shuffleDeck(createDeck());
    const trumpCard = fullDeck.pop()!;

    // No deck balancing — 39 cards remaining.
    // Deal 3 to each player = 6 dealt, 33 in deck.
    // 33 cards / 2 per round = 16 rounds of drawing + 1 trump card draw.
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

    // Check if round is complete (2 cards played)
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
   * Special rule: when the deck is empty but the trump card is still available,
   * the last player to draw gets the trump card.
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

    // Draw cards (winner first, then the other player)
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
            // Last card to draw is the trump card
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

      // 2-smazzate logic: after smazzata 1, go to smazzata_complete
      if (this.usesTwoSmazzate() && this.state.smazzataNumber === 1) {
        this.state = {
          ...this.state,
          phase: 'smazzata_complete',
          deck: newDeck,
          trumpCard,
          playerHands: newHands,
          playerStacks: newStacks,
          playedCards: [],
          finalScores: scores,
          roundHistory: [...this.state.roundHistory, historyEntry],
        };
        return this.getState();
      }

      // Smazzata 2 (or single-smazzata mode): compute final winner
      // Save smazzata 2 scores separately for UI display
      const smazzata2Scores = { ...scores };

      // Combine smazzata1 scores with current scores ONLY for winner determination
      const combinedScores = { ...scores };
      if (this.state.smazzata1Scores) {
        Object.keys(combinedScores).forEach(pid => {
          combinedScores[pid] += this.state.smazzata1Scores![pid] || 0;
        });
      }

      const maxScore = Math.max(...Object.values(combinedScores));
      const topPlayers = Object.keys(combinedScores).filter(pid => combinedScores[pid] === maxScore);
      const gameWinner = topPlayers.length === 1 ? topPlayers[0] : null;

      this.state = {
        ...this.state,
        phase: 'game_over',
        deck: newDeck,
        trumpCard,
        playerHands: newHands,
        playerStacks: newStacks,
        playedCards: [],
        finalScores: smazzata2Scores,
        smazzata2Scores,
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
    return "1v1";
  }

  /**
   * Get game mode description
   */
  getModeDescription(): string {
    return "2 players compete head-to-head. Highest card wins the round and all played cards.";
  }
}
