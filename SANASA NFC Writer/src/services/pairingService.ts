import { getServerUrl } from "../config/api";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { PairedSession, storePairing, clearStoredPairing, getStoredStaff } from "./storageService";

export interface PairResult {
  success: boolean;
  pairing?: PairedSession;
  error?: string;
}

export async function getDeviceIdentifier(): Promise<{ deviceId: string; deviceName: string }> {
  const modelName = Device.modelName || (Platform.OS === "android" ? "Android Phone" : "Device");
  const brand = Device.brand || "Mobile";
  const deviceName = `${brand} ${modelName}`.trim();
  const deviceId = `android-${(Device.osBuildId || Math.random().toString(36).substring(2, 9)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
  return { deviceId, deviceName };
}

export async function pairWithPortal(pairingCode: string): Promise<PairResult> {
  try {
    const staff = await getStoredStaff();
    if (!staff) {
      return { success: false, error: "Please log in first to pair your device." };
    }

    const { deviceId, deviceName } = await getDeviceIdentifier();
    const baseUrl = await getServerUrl();

    const res = await fetch(`${baseUrl}/api/nfc-card/writer/pairing/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairingCode: pairingCode.trim().toUpperCase(),
        deviceId,
        deviceName,
        staffId: staff._id,
        branch: staff.branch
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || "Pairing failed." };
    }

    const session: PairedSession = {
      pairingId: data.pairing.pairingId,
      branch: data.pairing.branch,
      staffId: data.pairing.staffId,
      staffName: data.pairing.staffName,
      deviceId: data.pairing.deviceId,
      deviceName: data.pairing.deviceName,
      pairedAt: data.pairing.pairedAt || new Date().toISOString()
    };

    await storePairing(session);
    return { success: true, pairing: session };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to communicate with pairing gateway." };
  }
}

export async function verifyPairingStatus(branch: string): Promise<boolean> {
  try {
    const { deviceId } = await getDeviceIdentifier();
    const baseUrl = await getServerUrl();
    const res = await fetch(`${baseUrl}/api/nfc-card/writer/pairing/status?deviceId=${encodeURIComponent(deviceId)}&branch=${encodeURIComponent(branch)}`);
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.paired);
    }
    return false;
  } catch {
    return false;
  }
}

export async function unpairDevice(): Promise<void> {
  try {
    const staff = await getStoredStaff();
    const { deviceId } = await getDeviceIdentifier();
    const baseUrl = await getServerUrl();
    await fetch(`${baseUrl}/api/nfc-card/writer/pairing/unpair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        branch: staff?.branch || "",
        staffId: staff?._id || ""
      })
    });
  } finally {
    await clearStoredPairing();
  }
}
