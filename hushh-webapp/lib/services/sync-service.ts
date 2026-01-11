/**
 * Hushh Data Sync Service
 *
 * Handles synchronization between local storage and cloud.
 * DEVELOPMENT: Sync enabled by default for web parity.
 */

import { Capacitor } from "@capacitor/core";
import { HushhDatabase } from "../capacitor";
import { SettingsService } from "./settings-service";
import { apiJson } from "@/lib/services/api-client";

// ==================== Types ====================

export interface SyncItem {
  id: number;
  tableName: string;
  operation: "INSERT" | "UPDATE" | "DELETE" | "UPSERT";
  userId: string;
  data: string;
  createdAt: number;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export type SyncStatus = "idle" | "syncing" | "error" | "disabled";

// ==================== Sync Service ====================

class SyncServiceImpl {
  private syncStatus: SyncStatus = "idle";
  private lastSyncTime: number | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  async isSyncEnabled(): Promise<boolean> {
    return SettingsService.shouldSyncToCloud();
  }

  getStatus(): SyncStatus {
    return this.syncStatus;
  }

  getLastSyncTime(): number | null {
    return this.lastSyncTime;
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: SyncStatus) {
    this.syncStatus = status;
    this.listeners.forEach((l) => l(status));
  }

  /**
   * Perform sync (DEV: enabled by default)
   */
  async sync(): Promise<SyncResult> {
    const enabled = await this.isSyncEnabled();
    if (!enabled) {
      this.setStatus("disabled");
      return { success: true, synced: 0, failed: 0, errors: [] };
    }

    // Check network
    const settings = await SettingsService.getSettings();
    if (settings.syncOnWifiOnly) {
      const isOnline =
        typeof navigator !== "undefined" ? navigator.onLine : true;
      if (!isOnline) {
        console.log("[SyncService] Skipping sync - offline");
        return {
          success: true,
          synced: 0,
          failed: 0,
          errors: ["Network required"],
        };
      }
    }

    this.setStatus("syncing");

    try {
      const pendingItems = await this.getPendingSyncItems();

      if (pendingItems.length === 0) {
        this.setStatus("idle");
        this.lastSyncTime = Date.now();
        return { success: true, synced: 0, failed: 0, errors: [] };
      }

      console.log(`[SyncService] Syncing ${pendingItems.length} items...`);

      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      const batchSize = 10;
      for (let i = 0; i < pendingItems.length; i += batchSize) {
        const batch = pendingItems.slice(i, i + batchSize);

        try {
          await this.syncBatch(batch);
          synced += batch.length;
        } catch (error) {
          failed += batch.length;
          errors.push(error instanceof Error ? error.message : "Unknown error");
        }
      }

      this.lastSyncTime = Date.now();
      this.setStatus(failed > 0 ? "error" : "idle");

      return { success: failed === 0, synced, failed, errors };
    } catch (error) {
      console.error("[SyncService] Sync failed:", error);
      this.setStatus("error");
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  private async getPendingSyncItems(): Promise<SyncItem[]> {
    try {
      // @ts-ignore
      const items = (await HushhDatabase.getPendingSyncItems?.()) || [];
      return items;
    } catch {
      return [];
    }
  }

  private async syncBatch(items: SyncItem[]): Promise<void> {
    const result = await apiJson<any>("/api/sync/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

    if (result.syncedIds && result.syncedIds.length > 0) {
      // @ts-ignore
      await HushhDatabase.markAsSynced?.(result.syncedIds);
    }
  }

  async pull(userId: string): Promise<{ updated: number }> {
    const enabled = await this.isSyncEnabled();
    if (!enabled) return { updated: 0 };

    try {
      const data = await apiJson<any>(
        `/api/sync/pull?userId=${encodeURIComponent(userId)}&since=${
          this.lastSyncTime || 0
        }`,
        { method: "GET" }
      );
      return { updated: data.changes?.length || 0 };
    } catch (error) {
      console.error("[SyncService] Pull failed:", error);
      return { updated: 0 };
    }
  }

  async startAutoSync(intervalMs: number = 5 * 60 * 1000): Promise<() => void> {
    const sync = async () => {
      const enabled = await this.isSyncEnabled();
      if (enabled) await this.sync();
    };

    await sync();
    const intervalId = setInterval(sync, intervalMs);
    return () => clearInterval(intervalId);
  }
}

export const SyncService = new SyncServiceImpl();

// ==================== React Hook ====================

import { useState, useEffect } from "react";

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>(SyncService.getStatus());
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(
    SyncService.getLastSyncTime()
  );

  useEffect(() => {
    const unsubscribe = SyncService.subscribe(setStatus);
    return unsubscribe;
  }, []);

  const sync = async () => {
    const result = await SyncService.sync();
    setLastSyncTime(SyncService.getLastSyncTime());
    return result;
  };

  return { status, lastSyncTime, sync };
}
