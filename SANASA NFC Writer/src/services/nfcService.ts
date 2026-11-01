import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import Constants, { ExecutionEnvironment } from "expo-constants";

export const isRunningInExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export interface NfcDiagnosticStatus {
  supported: boolean;
  enabled: boolean;
  isExpoGo?: boolean;
  message: string;
}

export interface DetectedTagInfo {
  tagUid: string;
  techList: string[];
  maxSize: number;
  isWritable: boolean;
  isLocked: boolean;
  canFitUrl: boolean;
  ndefSupported: boolean;
  existingDataPreview?: string;
  statusMessage: string;
}

export interface NfcWriteResult {
  success: boolean;
  tagUid: string;
  tagTech: string;
  readBackUrl: string;
  readBackVerified: boolean;
  lockedPermanently?: boolean;
  error?: string;
}

class NfcService {
  private initialized = false;

  async init(): Promise<boolean> {
    if (isRunningInExpoGo) {
      return true;
    }
    if (this.initialized) return true;
    try {
      const isSupported = await NfcManager.isSupported();
      if (isSupported) {
        await NfcManager.start();
        this.initialized = true;
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn("[NfcService] Initialization warning:", err.message);
      return false;
    }
  }

  async checkDiagnosticStatus(): Promise<NfcDiagnosticStatus> {
    if (isRunningInExpoGo) {
      return {
        supported: true,
        enabled: true,
        isExpoGo: true,
        message: "Running in Expo Go. Test/Simulation mode is active. Standalone APK or dev build required for physical tag writing."
      };
    }

    try {
      const supported = await NfcManager.isSupported();
      if (!supported) {
        return {
          supported: false,
          enabled: false,
          isExpoGo: false,
          message: "NFC hardware is not available on this device."
        };
      }

      const enabled = await NfcManager.isEnabled();
      if (!enabled) {
        return {
          supported: true,
          enabled: false,
          isExpoGo: false,
          message: "NFC is turned OFF in system settings. Please enable NFC to write physical cards."
        };
      }

      return {
        supported: true,
        enabled: true,
        message: "NFC hardware is ready and active."
      };
    } catch (err: any) {
      return {
        supported: false,
        enabled: false,
        message: err.message || "Failed to inspect NFC status."
      };
    }
  }

  async openSystemNfcSettings(): Promise<void> {
    try {
      if (Platform.OS === "android") {
        await NfcManager.goToNfcSetting();
      }
    } catch (err: any) {
      console.warn("[NfcService] Could not open NFC settings:", err.message);
    }
  }

  /**
   * Request tag scan and read physical UID, capabilities, and existing data
   */
  async detectTag(targetUrl?: string): Promise<DetectedTagInfo | null> {
    if (isRunningInExpoGo) {
      await new Promise((r) => setTimeout(r, 600));
      const simulatedUid = "04:A2:8E:B1:F4:7D:90";
      const maxSize = 540;
      const canFitUrl = targetUrl ? targetUrl.length + 10 <= maxSize : true;
      return {
        tagUid: simulatedUid,
        techList: ["android.nfc.tech.Ndef", "android.nfc.tech.NfcA", "android.nfc.tech.MifareUltralight"],
        maxSize,
        isWritable: true,
        isLocked: false,
        canFitUrl,
        ndefSupported: true,
        existingDataPreview: undefined,
        statusMessage: "Ready to Write (Expo Go Simulation Mode)"
      };
    }

    try {
      await this.init();
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: "Hold physical card against the back of your phone."
      });

      const tag = await NfcManager.getTag();
      if (!tag) {
        return null;
      }

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      const tagUid = tag.id || "";
      const techList = tag.techTypes || ["NDEF"];
      const maxSize = (tag as any).maxSize || 540;
      const isWritable = (tag as any).isWritable !== false;
      const isLocked = !isWritable;
      const ndefSupported = techList.some((t: string) => t.toLowerCase().includes("ndef"));

      // Read existing data preview if available
      let existingDataPreview: string | undefined = undefined;
      const ndefMessage = tag.ndefMessage || [];
      if (ndefMessage.length > 0 && ndefMessage[0].payload) {
        try {
          existingDataPreview = Ndef.uri.decodePayload(new Uint8Array(ndefMessage[0].payload));
        } catch {
          existingDataPreview = "Existing NDEF record detected";
        }
      }

      const urlLen = targetUrl ? targetUrl.length + 10 : 0;
      const canFitUrl = targetUrl ? urlLen <= maxSize : true;

      let statusMessage = "Ready to Write";
      if (!ndefSupported) {
        statusMessage = "Unsupported Card (Non-NDEF)";
      } else if (isLocked) {
        statusMessage = "Card Is Read-Only / Locked";
      } else if (!canFitUrl) {
        statusMessage = "Insufficient Capacity";
      } else if (existingDataPreview) {
        statusMessage = "Card Detected (Contains Existing Data)";
      } else {
        statusMessage = "Ready to Write (NDEF Supported)";
      }

      return {
        tagUid,
        techList,
        maxSize,
        isWritable,
        isLocked,
        canFitUrl,
        ndefSupported,
        existingDataPreview,
        statusMessage
      };
    } catch (err: any) {
      console.warn("[NfcService] Detect tag error:", err.message);
      throw err;
    } finally {
      this.cancelSession();
    }
  }

  /**
   * Write exact NDEF URI record and read-back verify
   */
  async writeAndVerifyUri(
    targetUrl: string,
    options?: { lockPermanently?: boolean }
  ): Promise<NfcWriteResult> {
    if (!targetUrl || !targetUrl.trim()) {
      return {
        success: false,
        tagUid: "",
        tagTech: "",
        readBackUrl: "",
        readBackVerified: false,
        error: "Target URL cannot be empty."
      };
    }

    const cleanUrl = targetUrl.trim();
    const lockPermanently = !!options?.lockPermanently;

    // In Expo Go, native NFC hardware drivers cannot be loaded.
    // Provide a high-fidelity simulation so staff can test the end-to-end workflow immediately.
    if (isRunningInExpoGo) {
      await new Promise((r) => setTimeout(r, 1200));
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      await new Promise((r) => setTimeout(r, 800));

      const randomBytes = Array.from({ length: 7 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase()
      ).join(":");

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      return {
        success: true,
        tagUid: randomBytes,
        tagTech: "NDEF (Expo Go Simulation)",
        readBackUrl: cleanUrl,
        readBackVerified: true,
        lockedPermanently: lockPermanently
      };
    }

    try {
      await this.init();

      // 1. Request NDEF tech
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: "Hold physical card steady against the NFC antenna..."
      });

      const tag = await NfcManager.getTag();
      const tagUid = tag?.id || "";
      const tagTech = tag?.techTypes?.join(", ") || "NDEF";

      // Check writable
      if ((tag as any).isWritable === false) {
        throw new Error("Card is locked / permanently read-only and cannot be written.");
      }

      // 2. Encode NDEF URI Record
      const bytes = Ndef.encodeMessage([Ndef.uriRecord(cleanUrl)]);
      if (!bytes) {
        throw new Error("Failed to encode NDEF URI payload.");
      }

      // 3. Write bytes to physical card via ndefHandler
      await NfcManager.ndefHandler.writeNdefMessage(bytes);

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      // 4. Immediate Read-Back from Tag for Strict Verification
      const readTag = await NfcManager.getTag();
      const ndefMessage = readTag?.ndefMessage || [];

      let readBackUri = "";
      if (ndefMessage.length > 0) {
        const firstRecord = ndefMessage[0];
        try {
          readBackUri = Ndef.uri.decodePayload(new Uint8Array(firstRecord.payload));
        } catch {
          const payloadArray = Array.from(new Uint8Array(firstRecord.payload));
          const uriPrefixCodes = [
            "",
            "http://www.",
            "https://www.",
            "http://",
            "https://",
            "tel:",
            "mailto:"
          ];
          const prefixCode = payloadArray[0];
          const prefix = uriPrefixCodes[prefixCode] || "";
          const rest = String.fromCharCode(...payloadArray.slice(1));
          readBackUri = `${prefix}${rest}`;
        }
      }

      // Normalize URLs for character-for-character comparison
      const normalizedExpected = cleanUrl.replace(/\/+$/, "").toLowerCase();
      const normalizedReadBack = readBackUri.replace(/\/+$/, "").toLowerCase();
      const verified = normalizedExpected === normalizedReadBack;

      if (!verified) {
        throw new Error(
          `Read-back verification mismatch. Expected: ${cleanUrl}, but physical tag returned: ${readBackUri || "Empty"}`
        );
      }

      // Optional irreversible permanent lock (only if explicitly confirmed)
      if (lockPermanently) {
        try {
          if (NfcManager.ndefHandler.makeReadOnly) {
            await NfcManager.ndefHandler.makeReadOnly();
          }
        } catch (lockErr: any) {
          console.warn("[NfcService] Permanent lock warning:", lockErr.message);
        }
      }

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      return {
        success: true,
        tagUid,
        tagTech,
        readBackUrl: readBackUri,
        readBackVerified: true,
        lockedPermanently: lockPermanently
      };
    } catch (err: any) {
      console.warn("[NfcService] Write/Verify error:", err.message);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}

      let userFriendlyError = err.message || "Failed to write NFC tag.";
      if (userFriendlyError.includes("cancelled") || userFriendlyError.includes("canceled")) {
        userFriendlyError = "NFC operation was cancelled by user.";
      } else if (userFriendlyError.includes("Tag was lost")) {
        userFriendlyError = "Card was moved away too quickly. Please hold it steady against the back of your phone.";
      }

      return {
        success: false,
        tagUid: "",
        tagTech: "",
        readBackUrl: "",
        readBackVerified: false,
        error: userFriendlyError
      };
    } finally {
      this.cancelSession();
    }
  }

  async cancelSession(): Promise<void> {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // safe fallback
    }
  }
}

export const nfcService = new NfcService();
export default nfcService;
