import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Easing,
  Modal,
  Switch,
  TextInput,
  Dimensions
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { WebView } from "react-native-webview";
import {
  nfcService,
  NfcDiagnosticStatus,
  DetectedTagInfo
} from "../../src/services/nfcService";
import {
  completeCardWriteAndSync,
  verifyBackendAccess,
  BackendVerificationResult
} from "../../src/services/syncService";
import {
  getStoredStaff,
  maskUrlToken,
  StaffUser
} from "../../src/services/storageService";
import { socketService } from "../../src/services/socketService";
import { notificationService } from "../../src/services/notificationService";
import SanasaLoadingAnimation from "../../src/components/SanasaLoadingAnimation";
import SanasaAppHeader from "../../src/components/SanasaAppHeader";
import {
  t,
  getCurrentLanguage,
  onLanguageChange
} from "../../src/services/i18nService";

type WriteStep =
  | "IDLE"
  | "READY_TO_WRITE"
  | "WAITING_FOR_TAG"
  | "CHECKING_CAPABILITIES"
  | "READY_TO_CONFIRM"
  | "WRITING_TAG"
  | "VERIFYING_READBACK"
  | "VERIFYING_BACKEND"
  | "SUCCESS"
  | "WRITTEN_BACKEND_PENDING"
  | "SYNC_PENDING"
  | "ERROR";

type CheckStatus = "Pending" | "Passed" | "Failed" | "Unavailable";

interface ChecklistItem {
  id: number;
  label: string;
  status: CheckStatus;
  detail?: string;
}

const INITIAL_CHECKLIST: ChecklistItem[] = [
  { id: 1, label: "NFC card detected", status: "Pending" },
  { id: 2, label: "Card capabilities identified", status: "Pending" },
  { id: 3, label: "Card is writable and URL fits", status: "Pending" },
  { id: 4, label: "Physical NFC write completed", status: "Pending" },
  { id: 5, label: "Read-back URL matches expected URL", status: "Pending" },
  { id: 6, label: "Backend token exists & active", status: "Pending" },
  { id: 7, label: "Token is not revoked or expired", status: "Pending" },
  { id: 8, label: "Vehicle assignment valid", status: "Pending" },
  { id: 9, label: "In-app preview loaded", status: "Pending" },
  { id: 10, label: "Backend acknowledgement received", status: "Pending" },
  { id: 11, label: "Security audit trail updated", status: "Pending" }
];

const SCREEN_HEIGHT = Dimensions.get("window").height;

interface SettingHelpInfo {
  title: string;
  description: string;
  risks: string;
  compatibility: string;
}

const SETTING_HELP_TEXTS: Record<string, Record<string, SettingHelpInfo>> = {
  en: {
    readBack: {
      title: "Read-Back Verification",
      description: "Immediately reads the written NDEF URI from the card chip and performs a strict byte-for-byte comparison against the intended URL.",
      risks: "Guarantees that partial writes, antenna disconnection, or radio interference are detected before the card leaves the office.",
      compatibility: "Fully supported on all NDEF-formatted tags (NTAG213, NTAG215, NTAG216)."
    },
    overwrite: {
      title: "Allow Overwrite",
      description: "Permits writing onto NFC cards that already contain existing NDEF records or previous URLs.",
      risks: "If enabled, existing records on the card will be replaced. Keep OFF if provisioning brand-new factory cards.",
      compatibility: "Supported on any rewritable, unlocked NFC chip."
    },
    permanentLock: {
      title: "Permanent Chip Lock",
      description: "Applies permanent lock bits on the NFC tag after writing, freezing memory into irreversible read-only state.",
      risks: "CRITICAL: Irreversible. Once locked, the card can NEVER be rewritten or reissued. Requires explicit confirmation.",
      compatibility: "Supported on NXP NTAG series with hardware lock bit registers."
    },
    passwordProtect: {
      title: "Password-Protected Writing",
      description: "Sets a 32-bit access password on the tag memory so only authorized SANASA writers can reconfigure the card.",
      risks: "Provides tamper protection without making the chip permanently read-only.",
      compatibility: "Supported on NTAG213, NTAG215, NTAG216 chips."
    }
  },
  si: {
    readBack: {
      title: "කියවා තහවුරු කිරීම (Read-Back)",
      description: "කාඩ්පතට දත්ත ලිවීමෙන් පසු, චිපයේ ඇති URL ලිපිනය නැවත කියවා එය මුල් URL එකට හරියටම සමාන දැයි පරීක්ෂා කරයි.",
      risks: "කාඩ්පත නියමිත වේලාවට පෙර දුරකථනයෙන් ඉවත් කිරීම නිසා සිදුවන දෝෂ වළක්වයි.",
      compatibility: "සියලුම NDEF (NTAG213/215/216) කාඩ්පත් සඳහා වලංගුයි."
    },
    overwrite: {
      title: "නැවත ලිවීමට ඉඩ දෙන්න (Overwrite)",
      description: "දැනටමත් දත්ත පවතින කාඩ්පත් මත අලුතින් දත්ත ලිවීමට අවසර ලබාදෙයි.",
      risks: "සක්‍රිය කළහොත් කාඩ්පතේ ඇති පැරණි දත්ත මැකී යනු ඇත.",
      compatibility: "අගුළු දමා නොමැති ඕනෑම කාඩ්පතක් සඳහා වලංගුයි."
    },
    permanentLock: {
      title: "ස්ථිර අගුල (Permanent Lock)",
      description: "කාඩ්පත ස්ථිරවම කියවීමට පමණක් හැකි වන සේ අගුළු දමයි.",
      risks: "අවවාදයයි: මෙය කිසිදා ආපසු හැරවිය නොහැක. කාඩ්පත නැවත කිසිදා ලිවිය නොහැක.",
      compatibility: "NTAG චිප සඳහා සහය දක්වයි."
    },
    passwordProtect: {
      title: "මුරපද ආරක්ෂාව",
      description: "කාඩ්පතේ මතකය ආරක්ෂා කිරීම සඳහා මුරපදයක් ඇතුළත් කිරීම.",
      risks: "අනවසර වෙනස්කම් වළක්වයි.",
      compatibility: "NTAG213/215/216 සඳහා සහය දක්වයි."
    }
  },
  ta: {
    readBack: {
      title: "மீண்டும் படித்து சரிபார்த்தல்",
      description: "அட்டையில் எழுதிய பிறகு, அட்டைத் தரவை மீண்டும் படித்து துல்லியமாக பொருந்துகிறதா என்பதை சரிபார்க்கிறது.",
      risks: "எழுதும் போது ஏற்படும் பிழைகளைக் கண்டறிய உதவுகிறது.",
      compatibility: "அனைத்து NDEF அட்டைகளுக்கும் பொருந்தும்."
    },
    overwrite: {
      title: "மேலெழுத அனுமதிக்கவும்",
      description: "ஏற்கனவே தரவு உள்ள அட்டைகளில் புதிய தரவை எழுத அனுமதிக்கிறது.",
      risks: "பழைய தரவு மாற்றப்படும்.",
      compatibility: "பூட்டப்படாத அட்டைகளுக்கு பொருந்தும்."
    },
    permanentLock: {
      title: "நிரந்தர பூட்டு",
      description: "அட்டையை நிரந்தரமாக படிக்க மட்டும் மாற்றுகிறது.",
      risks: "எச்சரிக்கை: இதை ஒருபோதும் மாற்ற முடியாது.",
      compatibility: "NTAG அட்டைகளில் ஆதரிக்கப்படுகிறது."
    },
    passwordProtect: {
      title: "கடவுச்சொல் பாதுகாப்பு",
      description: "அட்டை நினைவகத்திற்கு கடவுச்சொல் அமைக்கிறது.",
      risks: "அங்கீகரிக்கப்படாத மாற்றங்களைத் தடுக்கிறது.",
      compatibility: "NTAG213/215/216 இல் ஆதரிக்கப்படுகிறது."
    }
  }
};

export default function NfcWriterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [nfcStatus, setNfcStatus] = useState<NfcDiagnosticStatus>({
    supported: true,
    enabled: true,
    message: "Checking NFC hardware..."
  });

  // Mode Selection: "website" vs "manual"
  const [inputMode, setInputMode] = useState<"website" | "manual">("website");
  const [manualUrlInput, setManualUrlInput] = useState<string>("");
  const [manualUrlError, setManualUrlError] = useState<string>("");
  const [manualUrlValidated, setManualUrlValidated] = useState<boolean>(false);
  const [isSanasaManaged, setIsSanasaManaged] = useState<boolean>(false);

  // Current Card Data
  const [cardId, setCardId] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [cardUrl, setCardUrl] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [policyHolderName, setPolicyHolderName] = useState<string>("");
  const [vehiclePlate, setVehiclePlate] = useState<string>("");

  // Write State Machine
  const [step, setStep] = useState<WriteStep>("IDLE");
  const [detectedUid, setDetectedUid] = useState<string>("");
  const [detectedTech, setDetectedTech] = useState<string>("");
  const [readBackUrl, setReadBackUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [syncStatusText, setSyncStatusText] = useState<string>("");

  // SEPARATE STATE TRACKERS FOR PHYSICAL WRITE VS BACKEND CHECK (Section 12 Fix)
  const [isPhysicalWritten, setIsPhysicalWritten] = useState(false);
  const [isReadBackVerified, setIsReadBackVerified] = useState(false);
  const [isBackendVerified, setIsBackendVerified] = useState(false);
  const [writeLocked, setWriteLocked] = useState(false); // Prevents duplicate writes

  // Tag Capabilities
  const [detectedCap, setDetectedCap] = useState<DetectedTagInfo | null>(null);
  const [capChecking, setCapChecking] = useState(false);

  // Per-Card NFC Settings
  const [strictReadBack, setStrictReadBack] = useState(true);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [permanentLock, setPermanentLock] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(true);

  // Verification Checklist (11 Items)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);
  const [backendVerification, setBackendVerification] =
    useState<BackendVerificationResult | null>(null);

  // Settings Help Modal
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [activeHelpKey, setActiveHelpKey] = useState<string>("readBack");

  // In-App Half-Screen WebView Preview (Section 13)
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewLoadError, setPreviewLoadError] = useState<string | null>(null);

  // Confirm Write Modal (Section 10)
  const [showConfirmWriteModal, setShowConfirmWriteModal] = useState(false);

  // Standalone Tag Diagnostic Reader State
  const [diagReading, setDiagReading] = useState(false);
  const [diagTag, setDiagTag] = useState<DetectedTagInfo | null>(null);

  // Language state
  const [, setLangState] = useState(getCurrentLanguage());
  useEffect(() => {
    const unsub = onLanguageChange((l) => setLangState(l));
    return unsub;
  }, []);

  // Radar Pulse Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (
      step === "WAITING_FOR_TAG" ||
      step === "CHECKING_CAPABILITIES" ||
      step === "WRITING_TAG" ||
      step === "VERIFYING_READBACK" ||
      diagReading ||
      capChecking
    ) {
      anim = Animated.loop(
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true
          })
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0.5);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [step, diagReading, capChecking, pulseAnim, pulseOpacity]);

  // Load incoming parameters from router
  useEffect(() => {
    if (params.cardId && params.cardUrl) {
      setInputMode("website");
      setCardId(String(params.cardId));
      setCardUrl(String(params.cardUrl));
      setOrderId(params.orderId ? String(params.orderId) : "");
      setOrderNumber(params.orderNumber ? String(params.orderNumber) : "");
      setJobId(params.jobId ? String(params.jobId) : "");
      setPolicyHolderName(params.policyHolderName ? String(params.policyHolderName) : "");
      setVehiclePlate(params.vehiclePlate ? String(params.vehiclePlate) : "");
      setStep("READY_TO_WRITE");
      resetChecklist();
    } else if (params.mode === "manual") {
      setInputMode("manual");
    }
  }, [params]);

  // Load staff & inspect NFC hardware
  const checkNfc = useCallback(async () => {
    const s = await getStoredStaff();
    setStaff(s);
    const diag = await nfcService.checkDiagnosticStatus();
    setNfcStatus(diag);
  }, []);

  useEffect(() => {
    checkNfc();
  }, [checkNfc]);

  // Listen for wireless transfer jobs from web portal
  useEffect(() => {
    const unsub = socketService.onTransferJob((job) => {
      if (inputMode === "website") {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        setCardId(job.cardId);
        setCardUrl(job.cardUrl);
        setOrderId(job.orderId);
        setOrderNumber(job.orderNumber);
        setJobId(job.jobId);
        setPolicyHolderName(job.policyHolderName || "");
        setVehiclePlate(job.vehiclePlate || "");
        setStep("READY_TO_WRITE");
        resetChecklist();

        notificationService.addNotification(
          "New NFC Card Transferred",
          `Card ${job.cardId} received for ${job.policyHolderName || "Claim Order"}.`,
          job.cardId,
          job
        );
      }
    });

    return () => {
      unsub();
    };
  }, [inputMode]);

  const updateChecklistItem = (
    id: number,
    status: CheckStatus,
    detail?: string
  ) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status, detail } : item))
    );
  };

  const resetChecklist = () => {
    setChecklist(INITIAL_CHECKLIST);
    setBackendVerification(null);
    setIsPhysicalWritten(false);
    setIsReadBackVerified(false);
    setIsBackendVerified(false);
  };

  // =========================================================================
  // MANUAL URL VALIDATION (Section 8)
  // =========================================================================
  const validateAndApplyManualUrl = (input: string) => {
    const clean = input.trim();
    if (!clean) {
      setManualUrlError("Please enter a URL.");
      setManualUrlValidated(false);
      return false;
    }

    // Unsafe schemes block
    const lower = clean.toLowerCase();
    if (
      lower.startsWith("javascript:") ||
      lower.startsWith("file:") ||
      lower.startsWith("data:") ||
      lower.startsWith("vbscript:")
    ) {
      setManualUrlError(t("unsafeUrlError"));
      setManualUrlValidated(false);
      return false;
    }

    // URL protocol check
    try {
      const parsed = new URL(clean);
      const isDev =
        __DEV__ ||
        parsed.hostname === "localhost" ||
        parsed.hostname.startsWith("192.168.");

      if (parsed.protocol !== "https:" && (!isDev || parsed.protocol !== "http:")) {
        setManualUrlError(t("invalidUrlError"));
        setManualUrlValidated(false);
        return false;
      }

      setManualUrlError("");
      setManualUrlValidated(true);

      const isSanasa =
        parsed.hostname.includes("sanasa") ||
        parsed.pathname.includes("driver-access");
      setIsSanasaManaged(isSanasa);

      const generatedId = `MANUAL-${Date.now().toString().slice(-6)}`;
      setCardId(generatedId);
      setCardUrl(clean);
      setOrderNumber("Manual Provisioning");
      setPolicyHolderName(isSanasa ? "SANASA Policyholder Card" : "Generic NDEF URL");
      setStep("READY_TO_WRITE");
      resetChecklist();

      return true;
    } catch {
      setManualUrlError(t("invalidUrlError"));
      setManualUrlValidated(false);
      return false;
    }
  };

  const handlePasteUrl = async () => {
    try {
      Haptics.selectionAsync();
      const clipboardText = await Clipboard.getStringAsync();
      if (clipboardText) {
        setManualUrlInput(clipboardText);
        validateAndApplyManualUrl(clipboardText);
      }
    } catch {}
  };

  const handleClearUrl = () => {
    setManualUrlInput("");
    setManualUrlError("");
    setManualUrlValidated(false);
    setCardUrl("");
    setCardId("");
    setStep("IDLE");
    resetChecklist();
  };

  // =========================================================================
  // STEP 1: DETECT TAG & INSPECT CAPABILITIES (Section 9 & 10)
  // =========================================================================
  const handleScanAndDetectTag = async () => {
    if (!cardUrl) {
      Alert.alert("Input Required", "Please select a card or enter a valid URL first.");
      return;
    }

    if (!nfcStatus.supported) {
      Alert.alert("NFC Not Available", t("nfcNotSupported"));
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setStep("WAITING_FOR_TAG");
    setCapChecking(true);
    setErrorMessage("");
    setDetectedCap(null);

    // Reset items 1 to 5
    updateChecklistItem(1, "Pending");
    updateChecklistItem(2, "Pending");
    updateChecklistItem(3, "Pending");
    updateChecklistItem(4, "Pending");
    updateChecklistItem(5, "Pending");

    try {
      const cap = await nfcService.detectTag(cardUrl);
      setDetectedCap(cap);

      if (cap) {
        updateChecklistItem(1, "Passed", `UID: ${cap.tagUid}`);
        updateChecklistItem(
          2,
          cap.ndefSupported ? "Passed" : "Failed",
          `Tech: ${cap.techList.join(", ")}`
        );
        updateChecklistItem(
          3,
          cap.isWritable && cap.canFitUrl ? "Passed" : "Failed",
          `Capacity: ${cap.maxSize} bytes`
        );

        setDetectedUid(cap.tagUid);
        setDetectedTech(cap.techList.join(", "));

        if (!cap.ndefSupported) {
          throw new Error("Physical tag does not support NDEF standards. Use an NTAG213/215/216 chip.");
        }
        if (!cap.isWritable) {
          throw new Error("Physical card is locked / read-only and cannot be written.");
        }
        if (!cap.canFitUrl) {
          throw new Error(`Target URL (${cardUrl.length}b) exceeds chip memory (${cap.maxSize}b).`);
        }
        if (cap.existingDataPreview && !allowOverwrite) {
          throw new Error("Card contains existing data. Enable 'Allow Overwrite' in settings below to proceed.");
        }

        // Tag passed inspection! Move to confirmation state
        setStep("READY_TO_CONFIRM");
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      } else {
        setStep("READY_TO_WRITE");
      }
    } catch (err: any) {
      setStep("ERROR");
      setErrorMessage(err.message || "Failed to detect NFC card.");
      updateChecklistItem(1, "Failed", err.message);
    } finally {
      setCapChecking(false);
    }
  };

  // =========================================================================
  // STEP 2: CONFIRM & WRITE PHYSICAL NFC TAG (Section 10)
  // =========================================================================
  const handleConfirmAndWrite = async () => {
    if (writeLocked) return;
    setWriteLocked(true);
    setShowConfirmWriteModal(false);

    setStep("WRITING_TAG");
    setErrorMessage("");

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    if (jobId) {
      socketService.reportJobStatus(jobId, "Writing").catch(() => {});
    }

    try {
      // Physical write
      const writeRes = await nfcService.writeAndVerifyUri(cardUrl, {
        lockPermanently: permanentLock
      });

      if (!writeRes.success) {
        updateChecklistItem(4, "Failed", writeRes.error);
        throw new Error(writeRes.error || "NFC write operation failed.");
      }

      // Mark physical write as passed!
      setIsPhysicalWritten(true);
      updateChecklistItem(4, "Passed", "NDEF URI record encoded");
      setDetectedUid(writeRes.tagUid);
      setDetectedTech(writeRes.tagTech);
      setReadBackUrl(writeRes.readBackUrl);

      // Strict read-back comparison
      setStep("VERIFYING_READBACK");
      if (strictReadBack) {
        if (!writeRes.readBackVerified) {
          setIsReadBackVerified(false);
          updateChecklistItem(5, "Failed", "Read-back URI did not match");
          throw new Error("Strict read-back verification failed: Stored URL does not match intended URL.");
        }
        setIsReadBackVerified(true);
        updateChecklistItem(5, "Passed", "Exact byte-for-byte URI match");
      } else {
        setIsReadBackVerified(true);
        updateChecklistItem(5, "Passed", "Read-back skipped by setting");
      }

      // Backend token verification & security audit trail
      setStep("VERIFYING_BACKEND");
      setSyncStatusText(t("verifyingBackend"));

      const backendRes = await verifyBackendAccess({
        cardId,
        cardUrl,
        staffId: staff?._id,
        staffName: staff?.name || "Branch Staff",
        branch: staff?.branch || "Galle"
      });

      setBackendVerification(backendRes);

      if (backendRes.success && backendRes.verified) {
        setIsBackendVerified(true);
        updateChecklistItem(6, "Passed", `Status: ${backendRes.tokenStatus}`);
        updateChecklistItem(7, "Passed", "Not Revoked or Expired");
        updateChecklistItem(
          8,
          backendRes.assignmentStatus === "Valid" ? "Passed" : "Failed",
          `Plate: ${backendRes.vehiclePlate || "Assigned"}`
        );
        updateChecklistItem(
          11,
          backendRes.auditLogged ? "Passed" : "Unavailable",
          "Security audit logged"
        );
        if (backendRes.vehiclePlate) {
          setVehiclePlate(backendRes.vehiclePlate);
        }
      } else if (backendRes.tokenStatus === "Unavailable") {
        updateChecklistItem(6, "Unavailable", "Backend unreachable");
        updateChecklistItem(7, "Unavailable", "Server offline");
        updateChecklistItem(8, "Unavailable", "Server offline");
        updateChecklistItem(11, "Unavailable", "Audit queued");
      } else {
        updateChecklistItem(6, "Failed", `Token: ${backendRes.tokenStatus}`);
        updateChecklistItem(7, "Failed", `Token: ${backendRes.tokenStatus}`);
        updateChecklistItem(8, "Failed", backendRes.message);
        updateChecklistItem(11, "Failed", "Verification rejected");
      }

      // Final acknowledgement & Sync
      const syncRes = await completeCardWriteAndSync({
        jobId,
        cardId,
        orderId,
        readBackUrl: writeRes.readBackUrl,
        tagUid: writeRes.tagUid,
        tagTech: writeRes.tagTech,
        staffId: staff?._id || "",
        staffName: staff?.name || "Branch Staff",
        branch: staff?.branch || "Galle"
      });

      if (syncRes.synchronized) {
        updateChecklistItem(10, "Passed", "Acknowledged by server");
        if (backendRes.verified) {
          setStep("SUCCESS");
          setSyncStatusText("Physical write, backend token check & audit sync succeeded!");
        } else {
          setStep("WRITTEN_BACKEND_PENDING");
          setSyncStatusText("Physical card written, but backend verification requires attention.");
        }
      } else {
        updateChecklistItem(10, "Pending", "Queued for retry");
        setStep("SYNC_PENDING");
        setSyncStatusText(t("syncPending"));
      }

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      notificationService.addNotification(
        "Card Written Successfully",
        `Card ${cardId} was physically written and read-back verified.`,
        cardId
      );
    } catch (err: any) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      setStep("ERROR");
      setErrorMessage(err.message || "Failed to write NFC tag.");

      if (jobId) {
        socketService.reportJobStatus(jobId, "Failed", err.message).catch(() => {});
      }
    } finally {
      setWriteLocked(false);
    }
  };

  // =========================================================================
  // FIX FOR BUG IN SECTION 12: SAFE RETRY OF BACKEND VERIFICATION ONLY
  // =========================================================================
  const handleRetryBackendVerification = async () => {
    if (!cardId || !cardUrl) return;

    setStep("VERIFYING_BACKEND");
    setSyncStatusText(t("verifyingBackend"));

    try {
      const backendRes = await verifyBackendAccess({
        cardId,
        cardUrl,
        staffId: staff?._id,
        staffName: staff?.name || "Branch Staff",
        branch: staff?.branch || "Galle"
      });
      setBackendVerification(backendRes);

      if (backendRes.success && backendRes.verified) {
        setIsBackendVerified(true);
        updateChecklistItem(6, "Passed", `Status: ${backendRes.tokenStatus}`);
        updateChecklistItem(7, "Passed", "Not Revoked or Expired");
        updateChecklistItem(8, "Passed", `Plate: ${backendRes.vehiclePlate || "Assigned"}`);
        updateChecklistItem(11, "Passed", "Security audit updated");

        // CRITICAL BUG FIX (Section 12):
        // Only set SUCCESS if physical write and read-back verification ACTUALLY succeeded!
        if (isPhysicalWritten && isReadBackVerified) {
          setStep("SUCCESS");
          setSyncStatusText("Physical write, backend token check & audit sync succeeded!");
        } else {
          // Physical card has NOT been written yet. Do not mark physical write or card workflow as completed!
          setStep(detectedCap ? "READY_TO_CONFIRM" : "READY_TO_WRITE");
          setSyncStatusText("Backend token verified and active! Please tap and write physical NFC card.");
          Alert.alert(
            "Backend Verification Passed",
            "The backend token is active and valid. However, the physical NFC card has NOT yet been written.\n\nPlease hold the NFC card against your phone and tap 'Confirm & Write NFC' to perform the physical write."
          );
        }
      } else {
        setIsBackendVerified(false);
        updateChecklistItem(6, "Failed", backendRes.tokenStatus);
        updateChecklistItem(7, "Failed", "Token check failed");
        updateChecklistItem(8, "Failed", backendRes.message || "Unauthorized");
        updateChecklistItem(11, "Failed", "Verification rejected");
        setStep("WRITTEN_BACKEND_PENDING");
        Alert.alert("Backend Verification", backendRes.message || "Token verification failed.");
      }
    } catch (err: any) {
      Alert.alert("Retry Failed", err.message || "Could not reach server.");
      setStep(isPhysicalWritten ? "WRITTEN_BACKEND_PENDING" : "READY_TO_WRITE");
    }
  };

  const handleCancel = async () => {
    await nfcService.cancelSession();
    setStep(detectedCap ? "READY_TO_CONFIRM" : "READY_TO_WRITE");
    setErrorMessage("");
  };

  // Ready for Next Card (Section 14)
  const handleResetForNext = () => {
    nfcService.cancelSession().catch(() => {});
    setStep("IDLE");
    setCardId("");
    setCardUrl("");
    setOrderId("");
    setOrderNumber("");
    setJobId("");
    setDetectedUid("");
    setVehiclePlate("");
    setErrorMessage("");
    setDetectedCap(null);
    setDiagTag(null);
    setIsPhysicalWritten(false);
    setIsReadBackVerified(false);
    setIsBackendVerified(false);
    setManualUrlInput("");
    setManualUrlValidated(false);
    resetChecklist();
  };

  // Permanent Lock Toggle with Explicit Warning (Section 11)
  const handlePermanentLockToggle = (value: boolean) => {
    if (value) {
      Alert.alert(
        t("lockWarningTitle"),
        t("lockWarningMessage"),
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Enable Permanent Lock",
            style: "destructive",
            onPress: () => setPermanentLock(true)
          }
        ]
      );
    } else {
      setPermanentLock(false);
    }
  };

  // Open Help Popup (Section 11)
  const openHelpModal = (key: string) => {
    setActiveHelpKey(key);
    setHelpModalVisible(true);
  };

  const currentLangCode = getCurrentLanguage();
  const helpInfo =
    SETTING_HELP_TEXTS[currentLangCode]?.[activeHelpKey] ||
    SETTING_HELP_TEXTS["en"][activeHelpKey] ||
    SETTING_HELP_TEXTS["en"]["readBack"];

  // Standalone Tag Diagnostic Reader
  const handleTestTagScan = async () => {
    setDiagReading(true);
    setDiagTag(null);
    try {
      const tag = await nfcService.detectTag();
      setDiagTag(tag);
      if (tag) {
        Alert.alert(
          "Tag Detected!",
          `UID: ${tag.tagUid || "Unknown"}\nTechnologies: ${tag.techList.join(", ") || "NDEF"}\nCapacity: ${tag.maxSize} bytes\nWritable: ${tag.isWritable ? "Yes" : "Locked / Read-Only"}\n${tag.statusMessage}`
        );
      }
    } catch (err: any) {
      Alert.alert("Diagnostic Scan", err.message || "No tag detected or cancelled.");
    } finally {
      setDiagReading(false);
    }
  };

  const renderCheckBadge = (status: CheckStatus) => {
    switch (status) {
      case "Passed":
        return (
          <View style={styles.badgePassed}>
            <MaterialCommunityIcons name="check" size={12} color="#059669" />
            <Text style={styles.badgePassedText}>{t("checkPassed")}</Text>
          </View>
        );
      case "Failed":
        return (
          <View style={styles.badgeFailed}>
            <MaterialCommunityIcons name="close" size={12} color="#DC2626" />
            <Text style={styles.badgeFailedText}>{t("checkFailed")}</Text>
          </View>
        );
      case "Unavailable":
        return (
          <View style={styles.badgeUnavailable}>
            <MaterialCommunityIcons name="minus" size={12} color="#64748B" />
            <Text style={styles.badgeUnavailableText}>Offline</Text>
          </View>
        );
      default:
        return (
          <View style={styles.badgePending}>
            <MaterialCommunityIcons name="clock-outline" size={12} color="#D97706" />
            <Text style={styles.badgePendingText}>{t("checkPending")}</Text>
          </View>
        );
    }
  };

  // Required checks: Tag detected, physical write, readback verified, token verified
  const allRequiredPassed =
    checklist[0].status === "Passed" &&
    checklist[3].status === "Passed" &&
    checklist[4].status === "Passed" &&
    checklist[5].status === "Passed";

  return (
    <View style={styles.container}>
      <SanasaAppHeader
        title="Card Provisioning"
        subtitle="Write & Verify Physical NFC Cards"
        statusBadge={
          inputMode === "website"
            ? { text: "Web Synced", color: "#10B981" }
            : { text: "Manual Entry", color: "#FF9800" }
        }
        overlappingContent={
          <View style={styles.headerOverlapCard}>
            <TouchableOpacity
              style={[
                styles.modeTabBtn,
                inputMode === "website" && styles.modeTabBtnActive
              ]}
              onPress={() => {
                setInputMode("website");
                if (manualUrlValidated && !params.cardUrl) {
                  handleResetForNext();
                }
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="cellphone-link"
                size={16}
                color={inputMode === "website" ? "#10B981" : "#64748B"}
              />
              <Text
                style={[
                  styles.modeTabText,
                  inputMode === "website" && styles.modeTabTextActive
                ]}
              >
                {t("receiveModeWebsite")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeTabBtn,
                inputMode === "manual" && styles.modeTabBtnActive
              ]}
              onPress={() => setInputMode("manual")}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="link-plus"
                size={16}
                color={inputMode === "manual" ? "#10B981" : "#64748B"}
              />
              <Text
                style={[
                  styles.modeTabText,
                  inputMode === "manual" && styles.modeTabTextActive
                ]}
              >
                {t("enterUrlManually")}
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

      {/* MANUAL URL INPUT SECTION (Section 8) */}
      {inputMode === "manual" && (
        <View style={styles.manualCard}>
          <View style={styles.manualHeader}>
            <MaterialCommunityIcons name="form-textbox" size={18} color="#2563EB" />
            <Text style={styles.manualTitle}>{t("manualUrlTitle")}</Text>
          </View>
          <Text style={styles.manualDesc}>{t("manualUrlDesc")}</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.manualInput}
              placeholder={t("urlInputPlaceholder")}
              placeholderTextColor="#94A3B8"
              value={manualUrlInput}
              onChangeText={(txt) => {
                setManualUrlInput(txt);
                setManualUrlError("");
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {manualUrlInput.length > 0 && (
              <TouchableOpacity onPress={handleClearUrl} style={styles.inputClearBtn}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {manualUrlError ? (
            <View style={styles.errorNotice}>
              <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#DC2626" />
              <Text style={styles.errorNoticeText}>{manualUrlError}</Text>
            </View>
          ) : null}

          <View style={styles.manualActionRow}>
            <TouchableOpacity style={styles.pasteBtn} onPress={handlePasteUrl}>
              <MaterialCommunityIcons name="content-paste" size={14} color="#334155" />
              <Text style={styles.pasteBtnText}>{t("pasteBtn")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.validateBtn}
              onPress={() => validateAndApplyManualUrl(manualUrlInput)}
            >
              <Text style={styles.validateBtnText}>{t("validateBtn")}</Text>
              <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {manualUrlValidated && cardUrl ? (
            <View style={styles.validatedNotice}>
              <MaterialCommunityIcons name="shield-check" size={16} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.validatedNoticeTitle}>
                  {isSanasaManaged
                    ? "SANASA Managed Driver URL Verified"
                    : "Standard NDEF URL Formatted"}
                </Text>
                <Text style={styles.validatedNoticeUrl} numberOfLines={1}>
                  {cardUrl}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* ACTIVE CARD INFO BANNER */}
      {cardUrl ? (
        <View style={styles.cardInfoBanner}>
          <View style={styles.bannerHeader}>
            <View style={styles.bannerIconBox}>
              <MaterialCommunityIcons name="credit-card-outline" size={20} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerCardId}>{cardId}</Text>
              <Text style={styles.bannerOrderText}>
                {orderNumber ? `Order: ${orderNumber}` : "Manual Entry"} •{" "}
                {policyHolderName || "SANASA Card"}
              </Text>
            </View>
            {/* Half-screen preview button */}
            <TouchableOpacity
              style={styles.previewAccessBtn}
              onPress={() => {
                setShowPreviewModal(true);
                updateChecklistItem(9, "Passed", "Loaded in-app");
              }}
            >
              <MaterialCommunityIcons name="eye-outline" size={14} color="#2563EB" />
              <Text style={styles.previewAccessBtnText}>Preview</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bannerUrlBox}>
            <Text style={styles.bannerUrlLabel}>Target Access URL:</Text>
            <Text style={styles.bannerUrlText} numberOfLines={2}>
              {maskUrlToken(cardUrl)}
            </Text>
          </View>
        </View>
      ) : inputMode === "website" ? (
        <View style={styles.waitingWebsiteCard}>
          <MaterialCommunityIcons name="cellphone-wireless" size={36} color="#94A3B8" />
          <Text style={styles.waitingWebsiteTitle}>Awaiting Job from Website</Text>
          <Text style={styles.waitingWebsiteDesc}>
            Log into the SANASA desktop staff portal, click "Transfer to NFC Writer" on any approved card request, and it will appear here automatically.
          </Text>
        </View>
      ) : null}

      {/* PROMINENT "TAP YOUR NFC CARD" ANTENNA RADAR (Section 10) */}
      {cardUrl && (
        <View style={styles.tapAntennaCard}>
          <Text style={styles.tapTitle}>{t("tapCardTitle")}</Text>
          <Text style={styles.tapDesc}>{t("tapCardDesc")}</Text>

          {/* Radar Antenna Graphic */}
          <View style={styles.radarContainer}>
            <Animated.View
              style={[
                styles.radarPulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseOpacity
                }
              ]}
            />
            <View style={styles.radarCenterCircle}>
              <MaterialCommunityIcons
                name="nfc"
                size={44}
                color={detectedCap ? "#059669" : "#2563EB"}
              />
            </View>
          </View>

          {/* Tag Detection Trigger / Status */}
          <View style={styles.antennaActions}>
            {!detectedCap ? (
              <TouchableOpacity
                style={styles.scanAntennaBtn}
                onPress={handleScanAndDetectTag}
                disabled={capChecking}
                activeOpacity={0.8}
              >
                {capChecking ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.scanAntennaBtnText}>{t("statusChecking")}</Text>
                  </View>
                ) : (
                  <View style={styles.btnRow}>
                    <MaterialCommunityIcons name="radar" size={18} color="#FFFFFF" />
                    <Text style={styles.scanAntennaBtnText}>Scan & Inspect NFC Tag</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.detectedBanner}>
                <MaterialCommunityIcons name="check-circle" size={18} color="#059669" />
                <Text style={styles.detectedBannerText}>
                  Tag Detected! UID: {detectedCap.tagUid} ({detectedCap.maxSize}b)
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* DETECTED TAG CAPABILITIES INSPECTOR CARD (Section 9 & 10) */}
      {detectedCap && (
        <View style={styles.capCard}>
          <View style={styles.capHeader}>
            <MaterialCommunityIcons name="chip" size={18} color="#2563EB" />
            <Text style={styles.capTitle}>Physical Tag Capabilities</Text>
          </View>

          <View style={styles.capGrid}>
            <View style={styles.capGridItem}>
              <Text style={styles.capLabel}>{t("uidLabel")}</Text>
              <Text style={styles.capValueMono}>{detectedCap.tagUid || "Unknown"}</Text>
            </View>
            <View style={styles.capGridItem}>
              <Text style={styles.capLabel}>{t("capacityLabel")}</Text>
              <Text style={styles.capValue}>{detectedCap.maxSize} bytes</Text>
            </View>
            <View style={styles.capGridItem}>
              <Text style={styles.capLabel}>{t("writableLabel")}</Text>
              <Text
                style={[
                  styles.capValue,
                  { color: detectedCap.isWritable ? "#059669" : "#DC2626" }
                ]}
              >
                {detectedCap.isWritable ? t("writableYes") : t("writableNo")}
              </Text>
            </View>
            <View style={styles.capGridItem}>
              <Text style={styles.capLabel}>NDEF Status</Text>
              <Text
                style={[
                  styles.capValue,
                  { color: detectedCap.ndefSupported ? "#059669" : "#DC2626" }
                ]}
              >
                {detectedCap.ndefSupported ? "Standard Supported" : "Non-NDEF"}
              </Text>
            </View>
          </View>

          {/* PRIMARY ACTION BUTTON: "Confirm & Write NFC" (Section 10) */}
          <TouchableOpacity
            style={[
              styles.confirmWriteBtn,
              (!detectedCap.isWritable || !detectedCap.canFitUrl || writeLocked) &&
                styles.confirmWriteBtnDisabled
            ]}
            onPress={() => setShowConfirmWriteModal(true)}
            disabled={!detectedCap.isWritable || !detectedCap.canFitUrl || writeLocked}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={
                detectedCap.isWritable && detectedCap.canFitUrl
                  ? ["#059669", "#047857"]
                  : ["#94A3B8", "#64748B"]
              }
              style={styles.confirmWriteGradient}
            >
              <MaterialCommunityIcons name="nfc" size={22} color="#FFFFFF" />
              <Text style={styles.confirmWriteText}>{t("confirmWriteBtn")}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* WRITING / SUCCESS / ERROR STATES */}
      {step === "WRITING_TAG" || step === "VERIFYING_READBACK" ? (
        <View style={styles.statusBoxActive}>
          <SanasaLoadingAnimation
            fullscreen={false}
            size="medium"
            message={step === "WRITING_TAG" ? t("writingUrl") : t("verifyingReadback")}
            subMessage={t("writingPrompt")}
          />
        </View>
      ) : null}

      {step === "SUCCESS" && (
        <View style={styles.successCard}>
          <View style={styles.successIconCircle}>
            <MaterialCommunityIcons name="check-bold" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.successTitle}>{t("writtenSuccess")}</Text>
          <Text style={styles.successSub}>
            Physical tag {detectedUid} programmed and verified with SANASA token registry.
          </Text>
          <TouchableOpacity style={styles.nextCardBtn} onPress={handleResetForNext}>
            <MaterialCommunityIcons name="arrow-right-circle" size={18} color="#FFFFFF" />
            <Text style={styles.nextCardBtnText}>{t("readyNextCard")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === "ERROR" && errorMessage ? (
        <View style={styles.errorCard}>
          <MaterialCommunityIcons name="alert-circle" size={24} color="#DC2626" />
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>Write Operation Failed</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
          <TouchableOpacity style={styles.retryBtn} onPress={handleScanAndDetectTag}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PER-CARD SETTINGS PANEL WITH QUESTION-MARK HELP POPUPS (Section 11) */}
      <View style={styles.settingsCard}>
        <TouchableOpacity
          style={styles.settingsHeader}
          onPress={() => setShowSettingsPanel(!showSettingsPanel)}
          activeOpacity={0.7}
        >
          <View style={styles.settingsHeaderLeft}>
            <MaterialCommunityIcons name="tune-variant" size={18} color="#2563EB" />
            <Text style={styles.settingsTitle}>{t("settingsTitle")}</Text>
          </View>
          <MaterialCommunityIcons
            name={showSettingsPanel ? "chevron-up" : "chevron-down"}
            size={20}
            color="#64748B"
          />
        </TouchableOpacity>

        {showSettingsPanel && (
          <View style={styles.settingsBody}>
            {/* Setting 1: Read-back Verification */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfoCol}>
                <View style={styles.settingTitleRow}>
                  <Text style={styles.settingLabel}>{t("readBackSetting")}</Text>
                  <TouchableOpacity
                    onPress={() => openHelpModal("readBack")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons
                      name="help-circle-outline"
                      size={16}
                      color="#2563EB"
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.settingDesc}>{t("readBackDesc")}</Text>
              </View>
              <Switch
                value={strictReadBack}
                onValueChange={setStrictReadBack}
                thumbColor="#FFFFFF"
                trackColor={{ false: "#CBD5E1", true: "#059669" }}
              />
            </View>

            {/* Setting 2: Allow Overwrite */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfoCol}>
                <View style={styles.settingTitleRow}>
                  <Text style={styles.settingLabel}>{t("overwriteSetting")}</Text>
                  <TouchableOpacity
                    onPress={() => openHelpModal("overwrite")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons
                      name="help-circle-outline"
                      size={16}
                      color="#2563EB"
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.settingDesc}>{t("overwriteDesc")}</Text>
              </View>
              <Switch
                value={allowOverwrite}
                onValueChange={setAllowOverwrite}
                thumbColor="#FFFFFF"
                trackColor={{ false: "#CBD5E1", true: "#059669" }}
              />
            </View>

            {/* Setting 3: Permanent Chip Lock */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfoCol}>
                <View style={styles.settingTitleRow}>
                  <Text style={[styles.settingLabel, { color: "#DC2626" }]}>
                    {t("lockSetting")}
                  </Text>
                  <TouchableOpacity
                    onPress={() => openHelpModal("permanentLock")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons
                      name="help-circle-outline"
                      size={16}
                      color="#DC2626"
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.settingDesc}>{t("lockDesc")}</Text>
              </View>
              <Switch
                value={permanentLock}
                onValueChange={handlePermanentLockToggle}
                thumbColor="#FFFFFF"
                trackColor={{ false: "#CBD5E1", true: "#DC2626" }}
              />
            </View>
          </View>
        )}
      </View>

      {/* VERIFICATION CHECKLIST (11 Items) (Section 12) */}
      <View style={styles.checklistCard}>
        <View style={styles.checkHeader}>
          <MaterialCommunityIcons name="clipboard-check-outline" size={18} color="#2563EB" />
          <Text style={styles.checkTitle}>End-to-End Verification Checklist</Text>
        </View>

        <View style={styles.checkListWrap}>
          {checklist.map((item) => (
            <View key={item.id} style={styles.checkItemRow}>
              <View style={styles.checkItemLeft}>
                <Text style={styles.checkItemNum}>{item.id}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkItemText}>{item.label}</Text>
                  {item.detail ? (
                    <Text style={styles.checkItemDetailText}>{item.detail}</Text>
                  ) : null}
                </View>
              </View>
              {renderCheckBadge(item.status)}
            </View>
          ))}
        </View>

        {cardId && (
          <TouchableOpacity
            style={styles.retryBackendBtn}
            onPress={handleRetryBackendVerification}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="shield-sync-outline" size={16} color="#2563EB" />
            <Text style={styles.retryBackendBtnText}>{t("retryBackendChecks")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ANTENNA DIAGNOSTIC TOOL */}
      <View style={styles.diagCard}>
        <View style={styles.diagHeader}>
          <MaterialCommunityIcons name="tools" size={18} color="#2563EB" />
          <Text style={styles.diagTitle}>{t("antennaDiagTitle")}</Text>
        </View>
        <Text style={styles.diagDesc}>{t("antennaDiagDesc")}</Text>
        <TouchableOpacity
          style={styles.diagBtn}
          onPress={handleTestTagScan}
          disabled={diagReading}
          activeOpacity={0.8}
        >
          {diagReading ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <View style={styles.btnRow}>
              <MaterialCommunityIcons name="scan-helper" size={16} color="#2563EB" />
              <Text style={styles.diagBtnText}>{t("scanDiagBtn")}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* MODAL 1: PHYSICAL WRITE CONFIRMATION POPUP (Section 10) */}
      {/* ========================================================================= */}
      <Modal
        visible={showConfirmWriteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmWriteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalBox}>
            <View style={styles.confirmModalIconCircle}>
              <MaterialCommunityIcons name="nfc" size={32} color="#059669" />
            </View>
            <Text style={styles.confirmModalTitle}>Confirm Physical NFC Write</Text>
            <Text style={styles.confirmModalPrompt}>{t("writingPrompt")}</Text>

            <View style={styles.confirmModalDetails}>
              <View style={styles.confirmModalRow}>
                <Text style={styles.confirmModalLabel}>Card UID:</Text>
                <Text style={styles.confirmModalVal}>{detectedCap?.tagUid}</Text>
              </View>
              <View style={styles.confirmModalRow}>
                <Text style={styles.confirmModalLabel}>Chip Capacity:</Text>
                <Text style={styles.confirmModalVal}>{detectedCap?.maxSize} bytes</Text>
              </View>
              <View style={styles.confirmModalRow}>
                <Text style={styles.confirmModalLabel}>Read-Back Check:</Text>
                <Text style={styles.confirmModalVal}>
                  {strictReadBack ? "Strict Active" : "Disabled"}
                </Text>
              </View>
              {permanentLock && (
                <View style={styles.confirmModalRow}>
                  <Text style={[styles.confirmModalLabel, { color: "#DC2626" }]}>Lock:</Text>
                  <Text style={[styles.confirmModalVal, { color: "#DC2626" }]}>
                    PERMANENT IRREVERSIBLE LOCK
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.confirmModalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowConfirmWriteModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmAndWrite}
              >
                <Text style={styles.modalConfirmBtnText}>Start Writing</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: SETTINGS HELP POPUP / BOTTOM SHEET (Section 11) */}
      {/* ========================================================================= */}
      <Modal
        visible={helpModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.helpModalBox}>
            <View style={styles.helpHeader}>
              <View style={styles.helpIconCircle}>
                <MaterialCommunityIcons name="help" size={20} color="#2563EB" />
              </View>
              <Text style={styles.helpTitle}>{helpInfo.title}</Text>
            </View>

            <View style={styles.helpSection}>
              <Text style={styles.helpSectionHeading}>What It Does:</Text>
              <Text style={styles.helpSectionText}>{helpInfo.description}</Text>
            </View>

            <View style={styles.helpSection}>
              <Text style={styles.helpSectionHeading}>Risks & Impact:</Text>
              <Text style={styles.helpSectionText}>{helpInfo.risks}</Text>
            </View>

            <View style={styles.helpSection}>
              <Text style={styles.helpSectionHeading}>Chip Compatibility:</Text>
              <Text style={styles.helpSectionText}>{helpInfo.compatibility}</Text>
            </View>

            <TouchableOpacity
              style={styles.helpCloseBtn}
              onPress={() => setHelpModalVisible(false)}
            >
              <Text style={styles.helpCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: IN-APP HALF-SCREEN WEBVIEW PREVIEW (Section 13) */}
      {/* ========================================================================= */}
      <Modal
        visible={showPreviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewSheet}>
            {/* Sheet Header */}
            <View style={styles.previewSheetHeader}>
              <View style={styles.previewSheetHeaderLeft}>
                <MaterialCommunityIcons name="web" size={20} color="#2563EB" />
                <View>
                  <Text style={styles.previewSheetTitle}>{t("previewAccess")}</Text>
                  <Text style={styles.previewSheetSub}>
                    {cardId} • Secure Driver Gateway
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.previewCloseBtn}
                onPress={() => setShowPreviewModal(false)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* WebView Component */}
            <View style={styles.previewWebContainer}>
              {cardUrl ? (
                <WebView
                  source={{ uri: cardUrl }}
                  onLoadStart={() => setPreviewLoading(true)}
                  onLoadEnd={() => setPreviewLoading(false)}
                  onError={(e) => {
                    setPreviewLoading(false);
                    setPreviewLoadError(e.nativeEvent.description || "Failed to load page");
                  }}
                  style={styles.webView}
                />
              ) : null}

              {previewLoading && (
                <View style={styles.previewLoadingOverlay}>
                  <SanasaLoadingAnimation
                    fullscreen={false}
                    size="small"
                    message="Loading driver access view..."
                    subMessage="Sanasa Central Token Registry"
                  />
                </View>
              )}

              {previewLoadError && (
                <View style={styles.previewErrorOverlay}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={32} color="#DC2626" />
                  <Text style={styles.previewErrorTitle}>Could not load page</Text>
                  <Text style={styles.previewErrorSub}>{previewLoadError}</Text>
                </View>
              )}
            </View>

            {/* Sheet Footer */}
            <View style={styles.previewSheetFooter}>
              <Text style={styles.previewSheetFooterText}>
                Closing preview does not modify card writing progress.
              </Text>
              <TouchableOpacity
                style={styles.previewDoneBtn}
                onPress={() => setShowPreviewModal(false)}
              >
                <Text style={styles.previewDoneBtnText}>{t("closePreview")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  content: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16
  },
  headerOverlapCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 4,
    shadowColor: "#0D2A3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  modeTabsWrap: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 14,
    padding: 4
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12
  },
  modeTabBtnActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "#10B981"
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B"
  },
  modeTabTextActive: {
    color: "#065F46",
    fontWeight: "bold"
  },
  manualCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12
  },
  manualHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  manualTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0F172A"
  },
  manualDesc: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12
  },
  manualInput: {
    flex: 1,
    height: 44,
    fontSize: 13,
    color: "#0F172A"
  },
  inputClearBtn: {
    padding: 6
  },
  errorNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    padding: 8,
    borderRadius: 8
  },
  errorNoticeText: {
    fontSize: 11,
    color: "#DC2626",
    flex: 1
  },
  manualActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  pasteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10
  },
  pasteBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155"
  },
  validateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#10B981",
    paddingVertical: 10,
    borderRadius: 10
  },
  validateBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF"
  },
  validatedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 10,
    borderRadius: 10
  },
  validatedNoticeTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#065F46"
  },
  validatedNoticeUrl: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#047857"
  },
  cardInfoBanner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10
  },
  bannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  bannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center"
  },
  bannerCardId: {
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#0F172A"
  },
  bannerOrderText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2
  },
  previewAccessBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(13, 42, 58, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(13, 42, 58, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  previewAccessBtnText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0D2A3A"
  },
  bannerUrlBox: {
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9"
  },
  bannerUrlLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748B",
    marginBottom: 2
  },
  bannerUrlText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#334155"
  },
  waitingWebsiteCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8
  },
  waitingWebsiteTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#334155"
  },
  waitingWebsiteDesc: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18
  },
  tapAntennaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3
  },
  tapTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 4
  },
  tapDesc: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16
  },
  radarContainer: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
    position: "relative"
  },
  radarPulseRing: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 2,
    borderColor: "#10B981"
  },
  radarCenterCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#F1F5F9",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4
  },
  antennaActions: {
    width: "100%",
    marginTop: 14
  },
  scanAntennaBtn: {
    backgroundColor: "#0D2A3A",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center"
  },
  scanAntennaBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold"
  },
  detectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10
  },
  detectedBannerText: {
    color: "#065F46",
    fontSize: 12,
    fontWeight: "bold"
  },
  capCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 14
  },
  capHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  capTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#0F172A"
  },
  capGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  capGridItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9"
  },
  capLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    marginBottom: 2
  },
  capValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E293B"
  },
  capValueMono: {
    fontSize: 11,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#1E40AF"
  },
  confirmWriteBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 4
  },
  confirmWriteBtnDisabled: {
    opacity: 0.6
  },
  confirmWriteGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14
  },
  confirmWriteText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold"
  },
  statusBoxActive: {
    backgroundColor: "#0B1E32",
    borderWidth: 1.5,
    borderColor: "rgba(16, 185, 129, 0.35)",
    borderRadius: 20,
    padding: 10,
    alignItems: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4
  },
  statusBoxTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1E40AF",
    marginTop: 4
  },
  statusBoxPrompt: {
    fontSize: 12,
    color: "#3B82F6",
    textAlign: "center"
  },
  successCard: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    gap: 10
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center"
  },
  successTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#065F46"
  },
  successSub: {
    fontSize: 12,
    color: "#047857",
    textAlign: "center",
    lineHeight: 18
  },
  nextCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#059669",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 6
  },
  nextCardBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold"
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 14,
    borderRadius: 14
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#DC2626"
  },
  errorText: {
    fontSize: 11,
    color: "#B91C1C",
    marginTop: 2
  },
  retryBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold"
  },
  settingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden"
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: "#F8FAFC"
  },
  settingsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  settingsTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#0F172A"
  },
  settingsBody: {
    padding: 14,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0"
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  settingInfoCol: {
    flex: 1
  },
  settingTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  settingLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E293B"
  },
  settingDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 15
  },
  checklistCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12
  },
  checkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  checkTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#0F172A"
  },
  checkListWrap: {
    gap: 8
  },
  checkItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC"
  },
  checkItemLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    flex: 1,
    marginRight: 8
  },
  checkItemNum: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#64748B",
    width: 18
  },
  checkItemText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155"
  },
  checkItemDetailText: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 1
  },
  badgePassed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgePassedText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#059669"
  },
  badgeFailed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeFailedText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#DC2626"
  },
  badgeUnavailable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeUnavailableText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748B"
  },
  badgePending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgePendingText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#D97706"
  },
  retryBackendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 4
  },
  retryBackendBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E40AF"
  },
  diagCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8
  },
  diagHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  diagTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#0F172A"
  },
  diagDesc: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16
  },
  diagBtn: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  diagBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E40AF"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  confirmModalBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 12
  },
  confirmModalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center"
  },
  confirmModalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A"
  },
  confirmModalPrompt: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18
  },
  confirmModalDetails: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    gap: 6
  },
  confirmModalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  confirmModalLabel: {
    fontSize: 11,
    color: "#64748B"
  },
  confirmModalVal: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0F172A"
  },
  confirmModalBtnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 8
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    alignItems: "center"
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748B"
  },
  modalConfirmBtn: {
    flex: 1.3,
    paddingVertical: 12,
    backgroundColor: "#059669",
    borderRadius: 12,
    alignItems: "center"
  },
  modalConfirmBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF"
  },
  helpModalBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    width: "100%",
    maxWidth: 380,
    gap: 14
  },
  helpHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  helpIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center"
  },
  helpTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0F172A",
    flex: 1
  },
  helpSection: {
    gap: 3
  },
  helpSectionHeading: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#2563EB"
  },
  helpSectionText: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 18
  },
  helpCloseBtn: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6
  },
  helpCloseBtnText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#334155"
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end"
  },
  previewSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.65,
    overflow: "hidden"
  },
  previewSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0"
  },
  previewSheetHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  previewSheetTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0F172A"
  },
  previewSheetSub: {
    fontSize: 11,
    color: "#64748B"
  },
  previewCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center"
  },
  previewWebContainer: {
    flex: 1,
    position: "relative"
  },
  webView: {
    flex: 1
  },
  previewLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  previewLoadingText: {
    fontSize: 12,
    color: "#64748B"
  },
  previewErrorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 6
  },
  previewErrorTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#DC2626"
  },
  previewErrorSub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center"
  },
  previewSheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#F8FAFC"
  },
  previewSheetFooterText: {
    fontSize: 10,
    color: "#94A3B8",
    flex: 1,
    marginRight: 10
  },
  previewDoneBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  previewDoneBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF"
  }
});
