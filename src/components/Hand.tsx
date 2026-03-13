import type { Card as CardType, GameState } from "@/src/engine/types";
import { gameRegistry } from "@/src/engine/registry";
import { Card } from "./Card";

interface HandProps {
  cards: CardType[];
  disabled?: boolean;
  onPlayCard: (card: CardType) => void;
  state: GameState;
  playerId: string;
}

export function Hand({ cards, disabled, onPlayCard, state, playerId }: HandProps) {
  const gameType = (state?.publicState?.gameType as string) ?? "template";
  const rules = state ? gameRegistry.get(gameType) : null;
  const validMoves = rules ? rules.getValidMoves(state, playerId) : [];
  const validCardIds = new Set(validMoves.map((m) => m.card?.id).filter(Boolean));

  return (
    <View className="flex-row flex-wrap justify-center gap-1">
      {cards.map((card) => (
        <Card
          key={card.id}
          card={card}
          onPress={() => !disabled && validCardIds.has(card.id) && onPlayCard(card)}
          disabled={disabled || !validCardIds.has(card.id)}
        />
      ))}
    </View>
  );
}
