import { useSyncExternalStore } from "react";

export type Route = {
  path: string;
  parts: string[];
  query: URLSearchParams;
  hash: string;
};

const read = (): Route => {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [pathname, search = ""] = raw.split("?");
  const path = pathname || "/";
  return {
    path,
    parts: path.split("/").filter(Boolean),
    query: new URLSearchParams(search),
    hash: raw,
  };
};

const subscribe = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
};

let cached: Route = typeof window === "undefined" ? { path: "/", parts: [], query: new URLSearchParams(), hash: "/" } : read();

const getSnapshot = (): Route => {
  const next = read();
  if (next.hash !== cached.hash) cached = next;
  return cached;
};

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function navigate(path: string) {
  const target = path.startsWith("#") ? path : `#${path}`;
  if (window.location.hash === target) return;
  window.location.hash = target;
}

export function href(path: string): string {
  return `#${path}`;
}

export function match(route: Route, pattern: string): string[] | null {
  const expected = pattern.split("/").filter(Boolean);
  if (route.parts.length !== expected.length) return null;
  const params: string[] = [];
  for (let index = 0; index < expected.length; index++) {
    const part = expected[index];
    if (part.startsWith(":")) params.push(decodeURIComponent(route.parts[index]));
    else if (part !== route.parts[index]) return null;
  }
  return params;
}
