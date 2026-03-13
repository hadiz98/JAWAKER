import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Platform, Pressable, Share, Text, View } from "react-native";

interface RoomCodeProps {
  code: string;
  shareTitle?: string;
}

export function RoomCode({ code, shareTitle = "Join my game" }: RoomCodeProps) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareCode() {
    const message = `Join my game with code: ${code}`;
    try {
      if (Platform.OS === "web" && navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: message,
        });
      } else {
        await Share.share({
          message,
          title: shareTitle,
        });
      }
    } catch {
      await copyCode();
    }
  }

  return (
    <View className="flex-row flex-wrap items-center gap-3">
      <Text
        className="text-2xl font-mono font-bold tracking-widest text-neutral-900 dark:text-white"
        selectable
      >
        {code}
      </Text>
      <View className="flex-row gap-2">
        <Pressable
          onPress={copyCode}
          className="rounded-lg bg-neutral-200 py-2 px-3 active:opacity-80 dark:bg-neutral-700"
        >
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">
            {copied ? "Copied!" : "Copy"}
          </Text>
        </Pressable>
        <Pressable
          onPress={shareCode}
          className="rounded-lg bg-neutral-200 py-2 px-3 active:opacity-80 dark:bg-neutral-700"
        >
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">
            Share
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
