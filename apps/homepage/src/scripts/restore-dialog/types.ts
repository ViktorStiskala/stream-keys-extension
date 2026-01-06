// Restore Dialog Types

export interface Position {
  time: string; // Formatted time "14:32"
  timeSeconds: number; // Time in seconds for progress bar
  label: string; // "load time", "30s ago", "saved position"
  savedAt?: number; // Timestamp when saved (Date.now())
  isUserSaved?: boolean; // Green styling flag
  isLoadTime?: boolean; // Separator after this item
}
