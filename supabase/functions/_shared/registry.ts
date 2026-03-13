import type { IGameRules } from "./types.ts";

class GameRegistry {
  private rules = new Map<string, IGameRules>();

  register(rules: IGameRules): void {
    this.rules.set(rules.gameType, rules);
  }

  get(gameType: string): IGameRules {
    const rules = this.rules.get(gameType);
    if (!rules) {
      throw new Error(
        `Game type "${gameType}" is not registered. Available: ${this.list().join(", ") || "none"}.`
      );
    }
    return rules;
  }

  list(): string[] {
    return Array.from(this.rules.keys());
  }
}

export const gameRegistry = new GameRegistry();
