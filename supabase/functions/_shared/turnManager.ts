export function nextPlayerIndex(
  currentIndex: number,
  totalPlayers: number
): number {
  return (currentIndex + 1) % totalPlayers;
}

export function calculateDeadline(timeoutSeconds: number): number {
  return Date.now() + timeoutSeconds * 1000;
}

export function isExpired(deadline: number): boolean {
  return Date.now() > deadline;
}
