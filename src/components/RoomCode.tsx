import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

interface RoomCodeProps {
  code: string;
}

export function RoomCode({ code }: RoomCodeProps) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View className="flex-row items-center gap-3">
      <Text
        className="text-2xl font-mono font-bold tracking-widest text-neutral-900 dark:text-white"
        selectable
      >
        {code}
      </Text>
      <Pressable
        onPress={copyCode}
        className="rounded-lg bg-neutral-200 py-2 px-3 active:opacity-80 dark:bg-neutral-700"
      >
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">
          {copied ? "Copied!" : "Copy"}
        </Text>
      </Pressable>
    </View>
  );
}
