import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { getTimeRemaining } from "@/src/engine/selectors";

interface TurnTimerProps {
  deadline: number;
  totalSeconds: number;
  active: boolean;
}

export function TurnTimer({ deadline, totalSeconds, active }: TurnTimerProps) {
  const [remaining, setRemaining] = useState(() => getTimeRemaining(deadline));

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setRemaining(getTimeRemaining(deadline)), 500);
    return () => clearInterval(t);
  }, [deadline, active]);

  if (!active) return null;

  return (
    <View className="rounded-lg bg-neutral-200 px-3 py-1.5 dark:bg-neutral-700">
      <Text className={`text-sm font-mono font-medium ${remaining <= 10 ? "text-red-600" : "text-neutral-900 dark:text-white"}`}>
        {remaining}s
      </Text>
    </View>
  );
}
