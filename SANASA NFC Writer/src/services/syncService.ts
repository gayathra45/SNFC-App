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

export interface BackendVerificationResult {
  success: boolean;
  verified: boolean;
  tokenStatus: "Active" | "Revoked" | "Expired" | "Invalid" | "Unauthorized" | "Unavailable";
  assignmentStatus: "Valid" | "Invalid" | "Unavailable";
  accessRouteStatus: "Available" | "Failed" | "Unavailable";
  vehiclePlate?: string;
  driverName?: string;
  policyHolderName?: string;
  verifiedAt?: string;
  auditLogged?: boolean;
  message: string;
}

export async function verifyBackendAccess(params: {
  cardId: string;
  cardUrl: string;
  staffId?: string;
  staffName?: string;
  branch?: string;
}): Promise<BackendVerificationResult> {
  const { cardId, cardUrl, staffId, staffName, branch } = params;

  try {
    const baseUrl = await getServerUrl();
    const res = await fetch(`${baseUrl}/api/nfc-card/writer/verify-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId,
        cardUrl,
        staffId,
        staffName,
        branch
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      return {
        success: true,
        verified: !!data.verified,
        tokenStatus: data.tokenStatus || "Active",
        assignmentStatus: data.assignmentStatus || "Valid",
        accessRouteStatus: data.accessRouteStatus || "Available",
        vehiclePlate: data.vehiclePlate,
        driverName: data.driverName,
        policyHolderName: data.policyHolderName,
        verifiedAt: data.verifiedAt,
        auditLogged: data.auditLogged,
        message: data.message || "Backend verified successfully."
      };
    } else {
      return {
        success: false,
        verified: false,
        tokenStatus: data.tokenStatus || (res.status === 403 ? "Unauthorized" : "Invalid"),
        assignmentStatus: data.assignmentStatus || "Invalid",
        accessRouteStatus: data.accessRouteStatus || "Failed",
        message: data.message || data.error || `Verification failed with HTTP ${res.status}`
      };
    }
  } catch (err: any) {
    console.warn("[SyncService] Backend verification network error:", err.message);
    return {
      success: false,
      verified: false,
      tokenStatus: "Unavailable",
      assignmentStatus: "Unavailable",
      accessRouteStatus: "Unavailable",
      message: `Backend unreachable: ${err.message}. Showing 'Written - Backend Verification Pending'.`
    };
  }
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
