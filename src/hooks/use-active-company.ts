import { useSyncExternalStore } from "react";

import type { Company } from "@/lib/api-client";

const STORAGE_KEY = "vektor.active-company-id";

let currentId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function readStoredId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentId;
}

function getServerSnapshot() {
  return null;
}

function setId(id: string | null) {
  currentId = id;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
  emit();
}

if (typeof window !== "undefined") {
  currentId = readStoredId();
}

/** Drop the remembered pick on sign-out so the next user starts clean. */
export function clearActiveCompany() {
  setId(null);
}

export function useActiveCompany(companies: Company[]) {
  const selectedId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const company = companies.find((entry) => entry.id === selectedId) ?? companies[0] ?? null;

  return {
    company,
    selectedId: company?.id ?? null,
    setSelectedId: (id: string) => setId(id),
  };
}
