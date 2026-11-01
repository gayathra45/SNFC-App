import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

export interface NfcDiagnosticStatus {
  supported: boolean;
  enabled: boolean;
  message: string;
}

export interface DetectedTagInfo {
  tagUid: string;
  techList: string[];
  maxSize?: number;
  isWritable?: boolean;
}

export interface NfcWriteResult {
  success: boolean;
  tagUid: string;
  tagTech: string;
  readBackUrl: string;
  readBackVerified: boolean;
  error?: string;
}

class NfcService {
  private initialized = false;

  async init(): Promise<boolean> {
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
    try {
      const supported = await NfcManager.isSupported();
      if (!supported) {
        return {
          supported: false,
          enabled: false,
          message: "NFC hardware is not available on this device."
        };
      }

      const enabled = await NfcManager.isEnabled();
      if (!enabled) {
        return {
          supported: true,
          enabled: false,
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
   * Request tag scan and read physical UID / tech
   */
  async detectTag(): Promise<DetectedTagInfo | null> {
    try {
      await this.init();
      // Request Ndef technology
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: "Hold physical card against the back of your phone."
      });

      const tag = await NfcManager.getTag();
      if (!tag) {
        return null;
      }

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // safe fallback
      }

      const tagUid = tag.id || "";
      const techList = tag.techTypes || [];

      return {
        tagUid,
        techList,
        maxSize: (tag as any).maxSize || 540,
        isWritable: (tag as any).isWritable !== false
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
  async writeAndVerifyUri(targetUrl: string): Promise<NfcWriteResult> {
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

    try {
      await this.init();

      // 1. Request NDEF tech
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: "Hold physical card steady against the NFC antenna..."
      });

      const tag = await NfcManager.getTag();
      const tagUid = tag?.id || "";
      const tagTech = tag?.techTypes?.join(", ") || "NDEF";

      // 2. Encode NDEF URI Record
      const bytes = Ndef.encodeMessage([Ndef.uriRecord(cleanUrl)]);
      if (!bytes) {
        throw new Error("Failed to encode NDEF URI payload.");
      }

      // 3. Write bytes to physical card via ndefHandler
      await NfcManager.ndefHandler.writeNdefMessage(bytes);

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // fallback
      }

      // 4. Immediate Read-Back from Tag for Strict Verification
      const readTag = await NfcManager.getTag();
      const ndefMessage = readTag?.ndefMessage || [];

      let readBackUri = "";
      if (ndefMessage.length > 0) {
        const firstRecord = ndefMessage[0];
        try {
          readBackUri = Ndef.uri.decodePayload(new Uint8Array(firstRecord.payload));
        } catch {
          // Alternative manual payload decoding if decodePayload format differs
          const payloadArray = Array.from(new Uint8Array(firstRecord.payload));
          // First byte of URI record is prefix code
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

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // fallback
      }

      return {
        success: true,
        tagUid,
        tagTech,
        readBackUrl: readBackUri,
        readBackVerified: true
      };
    } catch (err: any) {
      console.warn("[NfcService] Write/Verify error:", err.message);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {
        // fallback
      }

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
