"use client";

import type { Grade } from "@/core/model";
import type { GameConfig, GameSettings, Team } from "@/games/types";
import { readJson, removeKey, writeJson } from "./storage";

/**
 * Oyun oturumu tarayıcıda saklanır: sayfa yenilense ya da tahta uyku moduna geçse
 * bile oyun kaldığı yerden devam eder. Çok cihazlı sürümde bu katman sunucuya taşınır.
 */

const ACTIVE_KEY = "oynabil.aktif-oyun.v1";
const SETUP_KEY = "oynabil.son-kurulum.v1";
const stateKey = (sessionId: string) => `oynabil.oyun-durumu.${sessionId}`;

export type SavedSetup = {
  gameId: string;
  subjectId: string;
  grade: Grade;
  unitIds: string[];
  teams: Team[];
  teamCountByGame: Record<string, number>;
  settingsByGame: Record<string, GameSettings>;
};

export function loadSetup(): SavedSetup | null {
  return readJson<SavedSetup | null>(SETUP_KEY, null);
}

export function saveSetup(setup: SavedSetup) {
  writeJson(SETUP_KEY, setup);
}

export function loadActiveGame(): GameConfig | null {
  return readJson<GameConfig | null>(ACTIVE_KEY, null);
}

export function startGame(config: GameConfig) {
  const previous = loadActiveGame();
  if (previous) removeKey(stateKey(previous.sessionId));
  writeJson(ACTIVE_KEY, config);
}

export function endActiveGame() {
  const active = loadActiveGame();
  if (active) removeKey(stateKey(active.sessionId));
  removeKey(ACTIVE_KEY);
}

export function loadGameState<T>(sessionId: string): T | null {
  return readJson<T | null>(stateKey(sessionId), null);
}

export function saveGameState(sessionId: string, state: unknown) {
  writeJson(stateKey(sessionId), state);
}

export function newSessionId(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
}
