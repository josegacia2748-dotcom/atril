import { useSyncExternalStore } from "react";
import type { AppState, Orchestra, Profile, Score } from "./types";
import { PROFILE_COLORS, SEED_PROFILES, seedScores } from "./seed";

const KEY = "atril:v1";

export const uid = (prefix = "id"): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const initialState = (): AppState => ({
  profiles: SEED_PROFILES.map((profile) => ({ ...profile })),
  currentProfileId: null,
  scores: seedScores(),
  orchestra: {
    name: "Orquesta Sinfónica de LUZ",
    code: "LUZ-2026",
    city: "Maracaibo, Venezuela",
  },
  theme: "dark",
  seeded: true,
});

function load(): AppState {
  if (typeof window === "undefined") return initialState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const base = initialState();
    return {
      ...base,
      ...parsed,
      orchestra: { ...base.orchestra, ...(parsed.orchestra ?? {}) },
      profiles: Array.isArray(parsed.profiles) && parsed.profiles.length ? parsed.profiles : base.profiles,
      scores: Array.isArray(parsed.scores) ? parsed.scores : base.scores,
      theme: parsed.theme === "light" ? "light" : "dark",
      currentProfileId: typeof parsed.currentProfileId === "string" ? parsed.currentProfileId : null,
    };
  } catch {
    return initialState();
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function commit(next: AppState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* almacenamiento no disponible */
  }
  listeners.forEach((listener) => listener());
}

export const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return state;
  },
  login(profileId: string) {
    commit({ ...state, currentProfileId: profileId });
  },
  logout() {
    commit({ ...state, currentProfileId: null });
  },
  toggleTheme() {
    commit({ ...state, theme: state.theme === "dark" ? "light" : "dark" });
  },
  setOrchestra(orchestra: Orchestra) {
    commit({ ...state, orchestra });
  },
  addProfile(input: { name: string; role: Profile["role"]; instrumentId?: string }) {
    const profile: Profile = {
      id: uid("p"),
      name: input.name.trim() || "Músico sin nombre",
      role: input.role,
      instrumentId: input.instrumentId,
      color: PROFILE_COLORS[state.profiles.length % PROFILE_COLORS.length],
      createdAt: Date.now(),
    };
    commit({ ...state, profiles: [...state.profiles, profile] });
    return profile;
  },
  updateProfile(id: string, patch: Partial<Profile>) {
    commit({
      ...state,
      profiles: state.profiles.map((profile) => (profile.id === id ? { ...profile, ...patch } : profile)),
    });
  },
  removeProfile(id: string) {
    commit({
      ...state,
      profiles: state.profiles.filter((profile) => profile.id !== id),
      currentProfileId: state.currentProfileId === id ? null : state.currentProfileId,
    });
  },
  addScore(score: Score) {
    commit({ ...state, scores: [score, ...state.scores] });
  },
  clearScores() {
    commit({ ...state, scores: [] });
  },
  updateScore(id: string, patch: Partial<Score>) {
    commit({
      ...state,
      scores: state.scores.map((score) => (score.id === id ? { ...score, ...patch, updatedAt: Date.now() } : score)),
    });
  },
  removeScore(id: string) {
    commit({ ...state, scores: state.scores.filter((score) => score.id !== id) });
  },
  replaceState(next: AppState) {
    commit(next);
  },
  resetDemo() {
    commit(initialState());
  },
  clearAll() {
    commit({ ...initialState(), scores: [], profiles: [], currentProfileId: null });
  },
};

export function useApp(): AppState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function useProfile(): Profile | null {
  const app = useApp();
  return app.profiles.find((profile) => profile.id === app.currentProfileId) ?? null;
}

export function scoresForInstrument(scores: Score[], instrumentId: string | undefined): Score[] {
  if (!instrumentId) return [];
  return scores.filter((score) => score.instrumentIds.includes(instrumentId));
}
