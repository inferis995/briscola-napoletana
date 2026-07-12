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
 * TwoVTwoGameLogic
 * 4 players in 2 teams of 2. Host-authoritative.
 *
 * Rules:
 * - 40 card deck: 1 trump, 12 dealt (3 each × 4), 27 remain in deck
 * - 4 cards played per round, alternating teams (T1, T2, T1, T2)
 * - 3-card hand throughout
 * - When deck runs out, last player to draw gets the trump card (same as 1v1)
 * - Winner determined by sum of team points
 * - Before first round, teammates see each other's hands briefly
 * - Round winner's team leads next round
 */
export class TwoVTwoGameLogic extends BaseGameLogic {
  protected static readonly CONFIG: GameConfig = {
    cardsPerPlayer: 3,
    minPlayers: 4,
    maxPlayers: 4,
  };

  constructor(players: PlayerState[]) {
    if (players.length !== 4) {
      throw new Error("TwoVTwoGameLogic requires exactly 4 players");
    }
    super(players, TwoVTwoGameLogic.CONFIG);
  }

  /**
   * 2v2 uses 2 smazzate per partita.
   */
  usesTwoSmazzate(): boolean {
    return true;
  }

  /**
   * Build a team-alternating turn order starting from a given player.
   * Order: starter(WT) → other1(OT) → teammate(WT) → other2(OT)
   */
  static buildTurnOrder(
    startPlayerId: string,
    teams: { [playerId: string]: number },
    players: PlayerState[]
  ): string[] {
    const startTeam = teams[startPlayerId];
    const otherTeamNum = startTeam === 1 ? 2 : 1;

    const sameTeamPlayers = players.filter(
      p => teams[p.id] === startTeam && p.id !== startPlayerId
    );
    const otherTeamPlayers = players.filter(
      p => teams[p.id] === otherTeamNum
    );

    // Anti-orario: dal basso vai a DESTRA, poi sopra, poi sinistra
    // assignSeats: opponents[0]=destra, opponents[1]=sinistra
    // Quindi: startPlayer → otherTeam[0](destra) → teammate(sopra) → otherTeam[1](sinistra)
    return [
      startPlayerId,
      otherTeamPlayers[0]?.id,
      sameTeamPlayers[0]?.id,
      otherTeamPlayers[1]?.id,
    ].filter(Boolean) as string[];
  }

  /**
   * Read teams from player state. Players set their team in the lobby
   * via player.setState('team', '1'|'2', true).
   * Falls back to alternating assignment if not set.
   */
  private getTeamsFromPlayers(): { [playerId: string]: number } {
    const teams: { [playerId: string]: number } = {};
    this.players.forEach((player, idx) => {
      const team = player.getState?.('team');
      teams[player.id] = team ? parseInt(team, 10) : (idx % 2) + 1;
    });
    return teams;
  }

  /**
   * Override initializeGame for 2v2.
   * 40 cards: 1 trump + 12 dealt (3 each) + 27 in deck.
   * Starts with 'revealing_hands' phase so teammates can see each other's cards.
   */
  initializeGame(): GameState {
    const fullDeck = shuffleDeck(createDeck());
    const trumpCard = fullDeck.pop()!;

    // No deck balancing — 39 cards remaining
    // Deal 3 to each player = 12 dealt, 27 in deck
    const { newDeck, hands } = this.dealCards(fullDeck);

    const stacks: { [playerId: string]: Card[] } = {};
    this.players.forEach(player => {
      stacks[player.id] = [];
    });

    const teams = this.getTeamsFromPlayers();

    // Build initial turn order starting with first player of team 1
    const team1Players = this.players.filter(p => teams[p.id] === 1);
    const startPlayer = team1Players[0] || this.players[0];
    const turnOrder = TwoVTwoGameLogic.buildTurnOrder(startPlayer.id, teams, this.players);

    this.state = {
      phase: 'playing',
      deck: newDeck,
      trumpCard,
      trumpSuit: trumpCard.suit,
      playerHands: hands,
      playerStacks: stacks,
      playedCards: [],
      currentTurnPlayerIndex: this.players.findIndex(p => p.id === turnOrder[0]),
      roundNumber: 1,
      roundWinnerId: null,
      finalScores: {},
      gameWinnerId: null,
      lastSwapPlayerId: null,
      roundHistory: [],
      teams,
      turnOrder,
      smazzataNumber: 1,
      lastHandRevealDone: false,
    };

    return this.getState();
  }

  /**
   * Play a card. Validates turn using the team-alternating turnOrder array.
   */
  playCard(playerId: string, cardId: string): GameState | null {
    if (this.state.phase !== 'playing') return null;

    // Determine whose turn it is based on turnOrder and played cards count
    const turnOrder = this.state.turnOrder || [];
    const expectedPlayerId = turnOrder[this.state.playedCards.length];
    if (expectedPlayerId !== playerId) return null;

    const playerHand = this.state.playerHands[playerId];
    if (!playerHand) return null;

    const cardIndex = playerHand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return null;

    const card = playerHand[cardIndex];
    const newHand = [...playerHand];
    newHand.splice(cardIndex, 1);

    const newPlayedCards: PlayedCardData[] = [
      ...this.state.playedCards,
      { card, playerId, transform: this.generateRandomTransform() }
    ];

    const newHands = { ...this.state.playerHands, [playerId]: newHand };

    // Check if round is complete (4 cards played)
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
        roundWinnerId: winnerId,
      };
    } else {
      // Advance to next player in turn order
      const nextPlayerId = turnOrder[newPlayedCards.length];
      const nextPlayerIndex = this.players.findIndex(p => p.id === nextPlayerId);

      this.state = {
        ...this.state,
        playerHands: newHands,
        playedCards: newPlayedCards,
        currentTurnPlayerIndex: nextPlayerIndex,
      };
    }

    return this.getState();
  }

  /**
   * Resolve completed round: award cards, draw new ones, rebuild turn order.
   * Draw order follows the new turnOrder (winner first).
   * Last player to draw gets the trump card when deck is empty.
   */
  resolveRound(): GameState {
    if (this.state.phase !== 'round_complete' || !this.state.roundWinnerId) {
      return this.getState();
    }

    const winnerId = this.state.roundWinnerId;
    const teams = this.state.teams || {};

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

    // Rebuild turn order starting from winner
    const newTurnOrder = TwoVTwoGameLogic.buildTurnOrder(winnerId, teams, this.players);

    // Draw cards following the new turn order (winner first)
    const newDeck = [...this.state.deck];
    const newHands: { [playerId: string]: Card[] } = {};
    for (const pid of Object.keys(this.state.playerHands)) {
      newHands[pid] = [...this.state.playerHands[pid]];
    }

    let trumpCard = this.state.trumpCard;

    if (newDeck.length > 0 || trumpCard) {
      for (let i = 0; i < newTurnOrder.length; i++) {
        const pid = newTurnOrder[i];
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
      // Calculate individual scores
      const scores: { [playerId: string]: number } = {};
      Object.keys(newStacks).forEach(pid => {
        scores[pid] = newStacks[pid].reduce((total, card) => total + card.score, 0);
      });

      // Calculate team scores
      const teamScores: { [team: string]: number } = { '1': 0, '2': 0 };
      Object.keys(scores).forEach(pid => {
        const team = teams[pid] || 1;
        teamScores[String(team)] += scores[pid];
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
          teamScores,
          turnOrder: newTurnOrder,
        };
        return this.getState();
      }

      // Smazzata 2: save scores separately, combine only for winner determination
      const smazzata2Scores = { ...scores };
      const smazzata2TeamScores = { ...teamScores };

      const combinedScores = { ...scores };
      if (this.state.smazzata1Scores) {
        Object.keys(combinedScores).forEach(pid => {
          combinedScores[pid] += this.state.smazzata1Scores![pid] || 0;
        });
      }
      const combinedTeamScores: { [team: string]: number } = { '1': 0, '2': 0 };
      Object.keys(combinedScores).forEach(pid => {
        const team = teams[pid] || 1;
        combinedTeamScores[String(team)] += combinedScores[pid];
      });

      // Determine winning team (0 = draw)
      const winnerTeam = combinedTeamScores['1'] === combinedTeamScores['2'] ? 0
        : combinedTeamScores['1'] > combinedTeamScores['2'] ? 1 : 2;

      const winnerTeamPlayers = winnerTeam ? this.players.filter(p => teams[p.id] === winnerTeam) : [];
      const gameWinner = winnerTeamPlayers[0]?.id || null;

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
        smazzata2TeamScores,
        gameWinnerId: gameWinner,
        roundHistory: [...this.state.roundHistory, historyEntry],
        teamScores: smazzata2TeamScores,
        winnerTeam,
        turnOrder: newTurnOrder,
      };
    } else {
      const winnerIndex = this.players.findIndex(p => p.id === winnerId);

      // ULTIMA MANO: when deck is empty and trump is taken, teammates reveal hands
      const isLastHand = newDeck.length === 0 && trumpCard === null;
      const shouldReveal = isLastHand && !this.state.lastHandRevealDone;

      this.state = {
        ...this.state,
        phase: shouldReveal ? 'revealing_hands' : 'playing',
        deck: newDeck,
        trumpCard,
        playerHands: newHands,
        playerStacks: newStacks,
        playedCards: [],
        currentTurnPlayerIndex: winnerIndex,
        roundNumber: this.state.roundNumber + 1,
        roundWinnerId: null,
        roundHistory: [...this.state.roundHistory, historyEntry],
        turnOrder: newTurnOrder,
        lastHandRevealDone: shouldReveal ? true : this.state.lastHandRevealDone,
      };
    }

    return this.getState();
  }

  getModeName(): string {
    return "2v2";
  }

  getModeDescription(): string {
    return "Due squadre da due. Vince la squadra con più punti.";
  }
}
