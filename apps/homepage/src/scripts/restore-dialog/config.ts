// Restore Dialog Configuration

import type { Position } from "./types";

// Fake video titles for the progress bar
export const VIDEOS = [
  // Browser & Video Player Frustrations (TV Series)
  {
    title: "The Streaming Experience",
    subtitle: "S3 E7: Press Space to Scroll Down",
  },
  { title: "Focus Issues", subtitle: "S2 E14: Click Anywhere to Continue" },
  {
    title: "The Fullscreen Escape",
    subtitle: "S5 E3: Where Did My Controls Go?",
  },
  { title: "Why Is This Button Here", subtitle: "S1 E8: The Accidental Skip" },
  {
    title: "Extension Conflicts",
    subtitle: "S4 E12: Too Many Content Scripts",
  },
  { title: "The Buffering Circle", subtitle: "S6 E1: 99% Complete Forever" },
  { title: "Autoplay Nightmares", subtitle: "S2 E5: It Started Without Me" },
  { title: "Cookie Consent", subtitle: "S3 E9: The Banner That Never Dies" },
  {
    title: "Tab Hoarders Anonymous",
    subtitle: "S1 E22: 847 Tabs and Counting",
  },
  {
    title: "The Wrong Keyboard Shortcut",
    subtitle: "S4 E6: I Just Wanted Volume",
  },
  {
    title: "Subtitles Gone Wrong",
    subtitle: "S2 E11: [\u200aPeople speaking foreign language\u200a]",
  },
  {
    title: "The Mysterious Mute Button",
    subtitle: "S7 E4: Sound From Unknown Tab",
  },
  {
    title: "Where Did I Leave Off",
    subtitle: "S8 E3: The Quest for the Timeline",
  },
  {
    title: "Mouse Required",
    subtitle: "S1 E4: When Keyboards Don't Work",
  },
  {
    title: "The Custom Player",
    subtitle: "S4 E7: Reinventing The Wheel Badly",
  },
  {
    title: "F Doesn't Fullscreen",
    subtitle: "S5 E11: Non-Standard Controls",
  },
  {
    title: "Position History",
    subtitle: "S6 E2: If Only I Could Go Back",
  },
  {
    title: "The Unmapped Keys",
    subtitle: "S3 E5: Arrow Keys Do Nothing",
  },

  // General Comedy TV Series
  { title: "Debugging My Life", subtitle: "S3 E7: The Semicolon Strikes Back" },
  { title: "Cats Who Judge", subtitle: "S5 E3: The Empty Food Bowl" },
  {
    title: "Overly Dramatic Chefs",
    subtitle: "S4 E12: The Slightly Undercooked Risotto",
  },
  { title: "The Procrastinators", subtitle: "S6 E1: We'll Finish This Later" },
  { title: "Office Plant Drama", subtitle: "S2 E11: The Overwatering Crisis" },

  // Browser & Video Player Frustrations (Movies)
  { title: "Space: The Forbidden Key", subtitle: "2024 • Video Player Horror" },
  {
    title: "Where Is the Pause Button",
    subtitle: "2023 • Interactive Mystery",
  },
  { title: "The 30 Second Unskippable Ad", subtitle: "2022 • Endurance Drama" },
  {
    title: "Manifest V3: The Reckoning",
    subtitle: "2024 • Extension Thriller",
  },
  { title: "Picture in Picture: Denied", subtitle: "2023 • DRM Documentary" },
  { title: "The Phantom Click", subtitle: "2021 • UI/UX Horror" },
  {
    title: "Seeking Without Scrubbing",
    subtitle: "2024 • Time Travel Impossible",
  },
  {
    title: "The Position That Wasn't Saved",
    subtitle: "2023 • Memory Loss Drama",
  },
  { title: "C for Captions: A Story", subtitle: "2022 • Lost in Translation" },
  {
    title: "Return of the Native Controls",
    subtitle: "2024 • Revenge of Accessibility",
  },
  {
    title: "Keyboard Shortcuts: The Forgotten Art",
    subtitle: "2023 • Historical Documentary",
  },
  { title: "Focus Trap", subtitle: "2024 • Psychological Horror" },

  // General Comedy Movies
  { title: "The Incredibly Long Meeting", subtitle: "2023 • Corporate Horror" },
  {
    title: "Parallel Parking: The Movie",
    subtitle: "2019 • Psychological Thriller",
  },
  { title: "The WiFi Is Down", subtitle: "2023 • Disaster Film" },
  { title: "Instructions Not Included", subtitle: "2020 • IKEA Documentary" },
  { title: "Grandma vs Technology", subtitle: "2022 • Action Comedy" },
];

// Video duration in seconds (1h 30m = 90 minutes)
export const DURATION_SECONDS = 90 * 60;

// Random video position range (10:00 to 55:00)
const MIN_VIDEO_SECONDS = 10 * 60; // 10:00
const MAX_VIDEO_SECONDS = 80 * 60; // 1:20:00

// Get a random video position between 10:00 and 55:00
export function getRandomVideoSeconds(): number {
  return (
    Math.floor(Math.random() * (MAX_VIDEO_SECONDS - MIN_VIDEO_SECONDS)) +
    MIN_VIDEO_SECONDS
  );
}

// Initial video position (for backwards compatibility, use getRandomVideoSeconds() for new code)
export const INITIAL_VIDEO_SECONDS = getRandomVideoSeconds();

// Banner display duration
export const BANNER_FADE_DELAY = 1500;
export const BANNER_FADE_DURATION = 300;

// Dialog animation duration
export const DIALOG_FADE_DURATION = 200;

// Minimum distance between positions (seconds)
export const POSITION_THRESHOLD = 15;

// Format time helper (exported for state.ts, duplicated here to avoid circular imports)
export function formatTimeForConfig(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Generate initial positions based on load time
export function getInitialPositions(loadTimeSeconds: number): Position[] {
  // Generate 2 random history positions that are at least POSITION_THRESHOLD apart
  const historyPositions: Position[] = [];
  const usedTimes = [loadTimeSeconds]; // Load time is already "used"

  // Try to generate 2 history positions
  for (let i = 0; i < 2; i++) {
    // Generate random time between 5:00 and 50:00
    let attempts = 0;
    while (attempts < 20) {
      const randomTime =
        Math.floor(Math.random() * (50 * 60 - 5 * 60)) + 5 * 60;

      // Check if it's at least POSITION_THRESHOLD away from all used times
      const isFarEnough = usedTimes.every(
        (t) => Math.abs(t - randomTime) >= POSITION_THRESHOLD,
      );

      if (isFarEnough) {
        const savedAgo = (i + 1) * 30 + Math.floor(Math.random() * 60); // 30-90s ago, 60-120s ago
        historyPositions.push({
          time: formatTimeForConfig(randomTime),
          timeSeconds: randomTime,
          label: `${savedAgo}s ago`,
          savedAt: Date.now() - savedAgo * 1000,
        });
        usedTimes.push(randomTime);
        break;
      }
      attempts++;
    }
  }

  return [
    {
      time: formatTimeForConfig(loadTimeSeconds),
      timeSeconds: loadTimeSeconds,
      label: "load time",
      isLoadTime: true,
    },
    ...historyPositions,
  ];
}

// Initial positions (generated once on module load)
export const initialPositions: Position[] = getInitialPositions(
  INITIAL_VIDEO_SECONDS,
);
