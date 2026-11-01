import AsyncStorage from "@react-native-async-storage/async-storage";

export interface StaffUser {
  _id: string;
  name: string;
  email: string;
  mobile?: string;
  branch: string;
  role: string;
  sessionStartedAt?: string;
}

export interface PairedSession {
  pairingId: string;
  branch: string;
  staffId: string;
  staffName: string;
  deviceId: string;
  deviceName: string;
  pairedAt: string;
}

export interface WriteHistoryItem {
  id: string;
  cardId: string;
  orderNumber?: string;
  status: "Success" | "Failed" | "Sync Pending";
  tagUid?: string;
  tagTech?: string;
  readBackVerified: boolean;
  timestamp: string;
  staffName: string;
  branch: string;
  notes?: string;
  maskedUrlPreview?: string;
}

export interface PendingSyncItem {
  jobId?: string;
  cardId: string;
  orderId?: string;
  readBackUrl: string;
  tagUid: string;
  tagTech: string;
  staffId: string;
  staffName: string;
  branch: string;
  writtenAt: string;
}

export interface WriterSettings {
  lockTagAfterWrite: boolean;
  strictReadBackVerify: boolean;
  overwriteProtection: boolean;
  hapticFeedback: boolean;
  soundChimes: boolean;
  antennaTimeoutSeconds: number;
}

const DEFAULT_SETTINGS: WriterSettings = {
  lockTagAfterWrite: false,
  strictReadBackVerify: true,
  overwriteProtection: true,
  hapticFeedback: true,
  soundChimes: true,
  antennaTimeoutSeconds: 30
};

const KEYS = {
  STAFF_SESSION: "sanasa_writer_staff_session",
  PAIRED_SESSION: "sanasa_writer_paired_session",
  WRITE_HISTORY: "sanasa_writer_history",
  PENDING_SYNCS: "sanasa_writer_pending_syncs",
  SETTINGS: "sanasa_writer_settings"
};

// Staff Auth Session
export async function getStoredStaff(): Promise<StaffUser | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STAFF_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function storeStaff(user: StaffUser): Promise<void> {
  await AsyncStorage.setItem(KEYS.STAFF_SESSION, JSON.stringify(user));
}

export async function clearStoredStaff(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.STAFF_SESSION);
}

// Pairing Session
export async function getStoredPairing(): Promise<PairedSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PAIRED_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function storePairing(session: PairedSession): Promise<void> {
  await AsyncStorage.setItem(KEYS.PAIRED_SESSION, JSON.stringify(session));
}

export async function clearStoredPairing(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.PAIRED_SESSION);
}

// Write History (Capped at 100 items, secret tokens masked)
export async function getWriteHistory(): Promise<WriteHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WRITE_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function appendWriteHistory(item: Omit<WriteHistoryItem, "id">): Promise<void> {
  try {
    const current = await getWriteHistory();
    const newItem: WriteHistoryItem = {
      ...item,
      id: `HIST-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    };
    const updated = [newItem, ...current].slice(0, 100);
    await AsyncStorage.setItem(KEYS.WRITE_HISTORY, JSON.stringify(updated));
  } catch {
    // safe fallback
  }
}

export async function clearWriteHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.WRITE_HISTORY);
}

// Pending Sync Queue (for "Written - Sync Pending" offline operations)
export async function getPendingSyncs(): Promise<PendingSyncItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PENDING_SYNCS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addPendingSync(item: PendingSyncItem): Promise<void> {
  try {
    const list = await getPendingSyncs();
    // deduplicate by cardId
    const filtered = list.filter((p) => p.cardId !== item.cardId);
    filtered.push(item);
    await AsyncStorage.setItem(KEYS.PENDING_SYNCS, JSON.stringify(filtered));
  } catch {
    // safe fallback
  }
}

export async function removePendingSync(cardId: string): Promise<void> {
  try {
    const list = await getPendingSyncs();
    const filtered = list.filter((p) => p.cardId !== cardId);
    await AsyncStorage.setItem(KEYS.PENDING_SYNCS, JSON.stringify(filtered));
  } catch {
    // safe fallback
  }
}

// URL Masking Utility
export function maskUrlToken(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length > 0) {
      const lastSegment = parts[parts.length - 1];
      if (lastSegment.length > 8) {
        const masked = lastSegment.slice(0, 3) + "••••••••" + lastSegment.slice(-4);
        parts[parts.length - 1] = masked;
        return `${parsed.origin}/${parts.join("/")}`;
      }
    }
    return url;
  } catch {
    return url.replace(/([a-f0-9]{8})[a-f0-9]{16,}([a-f0-9]{4})/gi, "$1••••••••$2");
  }
}

// User Configurable Settings
export async function getStoredSettings(): Promise<WriterSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function storeSettings(settings: Partial<WriterSettings>): Promise<WriterSettings> {
  try {
    const current = await getStoredSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
