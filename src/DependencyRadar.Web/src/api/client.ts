import type { DependencyRadarGraph, MonitorStatus } from "./types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export async function fetchStatus(): Promise<MonitorStatus> {
  const response = await fetch(apiUrl("/api/status"), { cache: "no-store" });
  if (!response.ok) throw new Error(`Status request failed with ${response.status}`);
  return response.json();
}

export async function fetchGraph(): Promise<DependencyRadarGraph | null> {
  const response = await fetch(apiUrl("/api/graph"), { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 503) return null;
    throw new Error(`Graph request failed with ${response.status}`);
  }
  return response.json();
}

export async function requestRescan(): Promise<void> {
  const response = await fetch(apiUrl("/api/rescan"), { method: "POST" });
  if (!response.ok) throw new Error(`Rescan request failed with ${response.status}`);
}
