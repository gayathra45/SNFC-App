import { getServerUrl } from "../config/api";
import {
  addPendingSync,
  removePendingSync,
  getPendingSyncs,
  appendWriteHistory,
  maskUrlToken,
  PendingSyncItem
} from "./storageService";

export interface SyncCompleteParams {
  jobId?: string;
  cardId: string;
  orderId?: string;
  readBackUrl: string;
  tagUid: string;
  tagTech: string;
  staffId: string;
  staffName: string;
  branch: string;
}

export interface SyncResult {
  synchronized: boolean;
  message: string;
  syncPending: boolean;
  order?: any;
}

export async function completeCardWriteAndSync(params: SyncCompleteParams): Promise<SyncResult> {
  const { jobId, cardId, orderId, readBackUrl, tagUid, tagTech, staffId, staffName, branch } = params;

  try {
    const baseUrl = await getServerUrl();
    const res = await fetch(`${baseUrl}/api/nfc-card/writer/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        cardId,
        orderId,
        readBackUrl,
        tagUid,
        tagTech,
        staffId,
        staffName,
        branch
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      // Remove any prior pending sync for this card
      await removePendingSync(cardId);

      // Record successful write in history
      await appendWriteHistory({
        cardId,
        orderNumber: data.order?.orderNumber,
        status: "Success",
        tagUid,
        tagTech,
        readBackVerified: true,
        timestamp: new Date().toISOString(),
        staffName,
        branch,
        maskedUrlPreview: maskUrlToken(readBackUrl),
        notes: "Card verified and backend synchronized."
      });

      return {
        synchronized: true,
        syncPending: false,
        message: data.message || "Card verified and synchronized with backend.",
        order: data.order
      };
    } else {
      throw new Error(data.error || "Backend synchronization returned an error.");
    }
  } catch (err: any) {
    console.warn("[SyncService] Initial backend sync failed:", err.message);

    // Queue for safe offline retry: "Written - Sync Pending"
    const pendingItem: PendingSyncItem = {
      jobId,
      cardId,
      orderId,
      readBackUrl,
      tagUid,
      tagTech,
      staffId,
      staffName,
      branch,
      writtenAt: new Date().toISOString()
    };

    await addPendingSync(pendingItem);

    await appendWriteHistory({
      cardId,
      status: "Sync Pending",
      tagUid,
      tagTech,
      readBackVerified: true,
      timestamp: new Date().toISOString(),
      staffName,
      branch,
      maskedUrlPreview: maskUrlToken(readBackUrl),
      notes: `Tag written successfully, but backend sync is pending: ${err.message}`
    });

    return {
      synchronized: false,
      syncPending: true,
      message: "Physical card written and verified! Server sync is pending network availability."
    };
  }
}

/**
 * Retry all pending offline syncs
 */
export async function flushPendingSyncs(): Promise<{ successCount: number; failCount: number }> {
  const pending = await getPendingSyncs();
  let successCount = 0;
  let failCount = 0;

  for (const item of pending) {
    try {
      const baseUrl = await getServerUrl();
      const res = await fetch(`${baseUrl}/api/nfc-card/writer/sync-retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: item.cardId,
          orderId: item.orderId,
          readBackUrl: item.readBackUrl,
          tagUid: item.tagUid,
          staffId: item.staffId,
          branch: item.branch
        })
      });

      if (res.ok) {
        await removePendingSync(item.cardId);
        successCount++;
      } else {
        failCount++;
      }
    } catch {
      failCount++;
    }
  }

  return { successCount, failCount };
}
