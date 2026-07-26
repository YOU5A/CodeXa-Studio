import { useCallback } from "react";
import { STORAGE_ACTIVITY } from "@/constants/storage-keys";
export interface ActivityEntry {
  timestamp: string;
  module: string;
  description: string;
}


const MAX_ENTRIES = 20;

export function getActivities(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVITY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function recordActivity(module: string, description: string): void {
  try {
    const activities = getActivities();
    const now = new Date();
    const timestamp = now.toISOString();
    activities.unshift({ timestamp, module, description });
    if (activities.length > MAX_ENTRIES) {
      activities.length = MAX_ENTRIES;
    }
    localStorage.setItem(STORAGE_ACTIVITY, JSON.stringify(activities));
  } catch {
    // Silently fail - activity log is non-critical
  }
}

export function useActivityLog() {
  const record = useCallback((module: string, description: string) => {
    recordActivity(module, description);
  }, []);

  return { record, getActivities };
}
