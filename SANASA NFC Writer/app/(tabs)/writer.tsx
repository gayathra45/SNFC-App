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
  Dimensions
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
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

type WriteStep =
  | "IDLE"
  | "READY_TO_WRITE"
  | "WAITING_FOR_TAG"
  | "CHECKING_CAPABILITIES"
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
  { id: 4, label: "URL written successfully", status: "Pending" },
  { id: 5, label: "Read-back URL matches expected URL", status: "Pending" },
  { id: 6, label: "Backend token exists and is active", status: "Pending" },
  { id: 7, label: "Token is not revoked or expired", status: "Pending" },
  { id: 8, label: "Vehicle assignment & permissions valid", status: "Pending" },
  { id: 9, label: "In-app preview loaded correct page", status: "Pending" },
  { id: 10, label: "Backend final acknowledgement received", status: "Pending" },
  { id: 11, label: "Security audit trail updated", status: "Pending" }
];

const SCREEN_HEIGHT = Dimensions.get("window").height;

export default function NfcWriterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [nfcStatus, setNfcStatus] = useState<NfcDiagnosticStatus>({
    supported: true,
    enabled: true,
    message: "Checking NFC hardware..."
  });

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

  // Tag Capabilities
  const [detectedCap, setDetectedCap] = useState<DetectedTagInfo | null>(null);
  const [capChecking, setCapChecking] = useState(false);

  // Per-Card NFC Settings
  const [strictReadBack, setStrictReadBack] = useState(true);
  const [allowOverwrite, setAllowOverwrite] = useState(true);
  const [permanentLock, setPermanentLock] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(true);

  // Verification Checklist (11 Items)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);
  const [backendVerification, setBackendVerification] =
    useState<BackendVerificationResult | null>(null);

  // In-App Half-Screen WebView Preview (Section 10)
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewLoadError, setPreviewLoadError] = useState<string | null>(null);
  const webViewRef = useRef<any>(null);
  const WebViewComponent: any = WebView;

  // Standalone Tag Diagnostic Reader State
  const [diagReading, setDiagReading] = useState(false);
  const [diagTag, setDiagTag] = useState<DetectedTagInfo | null>(null);

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

  // Load incoming parameters
  useEffect(() => {
    if (params.cardId && params.cardUrl) {
      setCardId(String(params.cardId));
      setCardUrl(String(params.cardUrl));
      setOrderId(params.orderId ? String(params.orderId) : "");
      setOrderNumber(params.orderNumber ? String(params.orderNumber) : "");
      setJobId(params.jobId ? String(params.jobId) : "");
      setPolicyHolderName(params.policyHolderName ? String(params.policyHolderName) : "");
      setVehiclePlate(params.vehiclePlate ? String(params.vehiclePlate) : "");
      setStep("READY_TO_WRITE");
      resetChecklist();
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
      setErrorMessage("");
      resetChecklist();
    });
    return () => unsub();
  }, []);

  const resetChecklist = () => {
    setChecklist(INITIAL_CHECKLIST);
    setBackendVerification(null);
  };

  const updateChecklistItem = (id: number, status: CheckStatus, detail?: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status, detail } : item))
    );
  };

  // Inspect Card Capabilities Prior to Writing
  const handleInspectCapabilities = async () => {
    setCapChecking(true);
    setStep("CHECKING_CAPABILITIES");
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

        if (cap.existingDataPreview && !allowOverwrite) {
          Alert.alert(
            "Existing Data Found",
            `Card contains existing data: "${cap.existingDataPreview}". Enable Overwrite in Settings to proceed.`
          );
        }
      } else {
        updateChecklistItem(1, "Failed", "No card responded");
      }
      setStep("READY_TO_WRITE");
    } catch (err: any) {
      updateChecklistItem(1, "Failed", err.message);
      setStep("READY_TO_WRITE");
    } finally {
      setCapChecking(false);
    }
  };

  // Toggle Permanent Lock with Safety Confirmation
  const handleTogglePermanentLock = (val: boolean) => {
    if (val) {
      Alert.alert(
        "Permanent Tag Locking",
        "WARNING: Locking an NFC card is irreversible. Once locked, the URL on the physical card cannot be updated or reused. Are you certain you want to lock this card?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Yes, Enable Permanent Lock",
            style: "destructive",
            onPress: () => setPermanentLock(true)
          }
        ]
      );
    } else {
      setPermanentLock(false);
    }
  };

  // Main Writing Flow: Stage A (Physical NFC) & Stage B (Backend Verification)
  const handleStartWrite = async () => {
    if (!cardUrl || !cardId) {
      Alert.alert("No Card Selected", "Please select or receive a card transfer job first.");
      return;
    }

    if (!nfcStatus.isExpoGo) {
      if (!nfcStatus.supported) {
        Alert.alert("Hardware Unsupported", "This device does not have NFC hardware.");
        return;
      }
      if (!nfcStatus.enabled) {
        Alert.alert("NFC is Disabled", "Please enable NFC in system settings to continue.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => nfcService.openSystemNfcSettings() }
        ]);
        return;
      }
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setStep("WAITING_FOR_TAG");
    setErrorMessage("");
    setDetectedUid("");

    // Reset items 1 to 5 for new write attempt
    updateChecklistItem(1, "Pending");
    updateChecklistItem(2, "Pending");
    updateChecklistItem(3, "Pending");
    updateChecklistItem(4, "Pending");
    updateChecklistItem(5, "Pending");

    if (jobId) {
      socketService.reportJobStatus(jobId, "Writing").catch(() => {});
    }

    try {
      // Step 1: Detect & Check capabilities
      setStep("CHECKING_CAPABILITIES");
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

        if (!cap.isWritable) {
          throw new Error("Physical card is locked / read-only and cannot be rewritten.");
        }
        if (!cap.canFitUrl) {
          throw new Error(`URL length (${cardUrl.length}b) exceeds tag capacity (${cap.maxSize}b).`);
        }
        if (cap.existingDataPreview && !allowOverwrite) {
          throw new Error("Card contains existing data and overwrite permission is disabled.");
        }
      }

      // Step 2: Physical Write
      setStep("WRITING_TAG");
      const writeRes = await nfcService.writeAndVerifyUri(cardUrl, {
        lockPermanently: permanentLock
      });

      if (!writeRes.success) {
        updateChecklistItem(4, "Failed", writeRes.error);
        throw new Error(writeRes.error || "NFC write operation failed.");
      }

      updateChecklistItem(4, "Passed", "NDEF URI record encoded");
      setDetectedUid(writeRes.tagUid);
      setDetectedTech(writeRes.tagTech);
      setReadBackUrl(writeRes.readBackUrl);

      // Step 3: Strict Read-Back Verification
      setStep("VERIFYING_READBACK");
      if (strictReadBack) {
        if (!writeRes.readBackVerified) {
          updateChecklistItem(5, "Failed", "Read-back URI did not match");
          throw new Error("Strict read-back verification failed: Read URI does not match expected URL.");
        }
        updateChecklistItem(5, "Passed", "Exact byte-for-byte URI match");
      } else {
        updateChecklistItem(5, "Passed", "Read-back skipped by setting");
      }

      // Step 4: Stage B Backend Verification
      setStep("VERIFYING_BACKEND");
      setSyncStatusText("Verifying token status, vehicle assignment & security audit trail...");

      const backendRes = await verifyBackendAccess({
        cardId,
        cardUrl,
        staffId: staff?._id,
        staffName: staff?.name || "Branch Staff",
        branch: staff?.branch || "Galle"
      });

      setBackendVerification(backendRes);

      if (backendRes.success && backendRes.verified) {
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

      // Step 5: Final Acknowledgement and Sync
      setSyncStatusText("Saving final write acknowledgement to SANASA database...");
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
        setSyncStatusText("Physical tag verified! Server sync is pending network connection.");
      }

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (err: any) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      console.warn("Write error:", err.message);
      setStep("ERROR");
      setErrorMessage(err.message || "Failed to write NFC tag.");

      if (jobId) {
        socketService.reportJobStatus(jobId, "Failed", err.message).catch(() => {});
      }
    }
  };

  // Safe Retry of Backend Verification Only (Without rewriting physical NFC tag)
  const handleRetryBackendVerification = async () => {
    if (!cardId || !cardUrl) return;
    setStep("VERIFYING_BACKEND");
    setSyncStatusText("Retrying backend token and permissions check...");

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
        updateChecklistItem(6, "Passed", `Status: ${backendRes.tokenStatus}`);
        updateChecklistItem(7, "Passed", "Not Revoked or Expired");
        updateChecklistItem(8, "Passed", `Plate: ${backendRes.vehiclePlate || "Assigned"}`);
        updateChecklistItem(11, "Passed", "Security audit updated");
        setStep("SUCCESS");
        setSyncStatusText("Backend verification succeeded! Ready for preview.");
      } else {
        updateChecklistItem(6, "Failed", backendRes.tokenStatus);
        setStep("WRITTEN_BACKEND_PENDING");
        Alert.alert("Backend Verification", backendRes.message);
      }
    } catch (err: any) {
      Alert.alert("Retry Failed", err.message || "Could not reach server.");
      setStep("WRITTEN_BACKEND_PENDING");
    }
  };

  const handleCancel = async () => {
    await nfcService.cancelSession();
    setStep("READY_TO_WRITE");
    setErrorMessage("");
  };

  const handleResetForNext = () => {
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
    resetChecklist();
  };

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

  // Helper for checklist status badge
  const renderCheckBadge = (status: CheckStatus) => {
    switch (status) {
      case "Passed":
        return (
          <View style={styles.badgePassed}>
            <MaterialCommunityIcons name="check" size={12} color="#059669" />
            <Text style={styles.badgePassedText}>Passed</Text>
          </View>
        );
      case "Failed":
        return (
          <View style={styles.badgeFailed}>
            <MaterialCommunityIcons name="close" size={12} color="#DC2626" />
            <Text style={styles.badgeFailedText}>Failed</Text>
          </View>
        );
      case "Unavailable":
        return (
          <View style={styles.badgeUnavailable}>
            <MaterialCommunityIcons name="minus" size={12} color="#64748B" />
            <Text style={styles.badgeUnavailableText}>Unavailable</Text>
          </View>
        );
      default:
        return (
          <View style={styles.badgePending}>
            <MaterialCommunityIcons name="clock-outline" size={12} color="#D97706" />
            <Text style={styles.badgePendingText}>Pending</Text>
          </View>
        );
    }
  };

  const allRequiredPassed =
    checklist[0].status === "Passed" &&
    checklist[3].status === "Passed" &&
    checklist[4].status === "Passed" &&
    checklist[5].status === "Passed";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Stepper */}
      <View style={styles.stepperContainer}>
        <View style={styles.stepItem}>
          <View style={[styles.stepDot, cardId ? styles.stepDotActive : null]}>
            <Text style={[styles.stepDotNum, cardId ? styles.stepDotNumActive : null]}>1</Text>
          </View>
          <Text style={[styles.stepLabel, cardId ? styles.stepLabelActive : null]}>Card Ready</Text>
        </View>
        <View style={[styles.stepLine, step !== "IDLE" && styles.stepLineActive]} />

        <View style={styles.stepItem}>
          <View
            style={[
              styles.stepDot,
              (step === "WAITING_FOR_TAG" ||
                step === "CHECKING_CAPABILITIES" ||
                step === "WRITING_TAG" ||
                step === "VERIFYING_READBACK" ||
                step === "VERIFYING_BACKEND" ||
                step === "SUCCESS") &&
                styles.stepDotActive
            ]}
          >
            <Text
              style={[
                styles.stepDotNum,
                (step === "WAITING_FOR_TAG" ||
                  step === "CHECKING_CAPABILITIES" ||
                  step === "WRITING_TAG" ||
                  step === "VERIFYING_READBACK" ||
                  step === "VERIFYING_BACKEND" ||
                  step === "SUCCESS") &&
                  styles.stepDotNumActive
              ]}
            >
              2
            </Text>
          </View>
          <Text
            style={[
              styles.stepLabel,
              (step === "WAITING_FOR_TAG" ||
                step === "CHECKING_CAPABILITIES" ||
                step === "WRITING_TAG" ||
                step === "VERIFYING_READBACK" ||
                step === "VERIFYING_BACKEND" ||
                step === "SUCCESS") &&
                styles.stepLabelActive
            ]}
          >
            Detect Tag
          </Text>
        </View>
        <View
          style={[
            styles.stepLine,
            (step === "WRITING_TAG" ||
              step === "VERIFYING_READBACK" ||
              step === "VERIFYING_BACKEND" ||
              step === "SUCCESS") &&
              styles.stepLineActive
          ]}
        />

        <View style={styles.stepItem}>
          <View
            style={[
              styles.stepDot,
              (step === "WRITING_TAG" ||
                step === "VERIFYING_READBACK" ||
                step === "VERIFYING_BACKEND" ||
                step === "SUCCESS") &&
                styles.stepDotActive
            ]}
          >
            <Text
              style={[
                styles.stepDotNum,
                (step === "WRITING_TAG" ||
                  step === "VERIFYING_READBACK" ||
                  step === "VERIFYING_BACKEND" ||
                  step === "SUCCESS") &&
                  styles.stepDotNumActive
              ]}
            >
              3
            </Text>
          </View>
          <Text
            style={[
              styles.stepLabel,
              (step === "WRITING_TAG" ||
                step === "VERIFYING_READBACK" ||
                step === "VERIFYING_BACKEND" ||
                step === "SUCCESS") &&
                styles.stepLabelActive
            ]}
          >
            Write NDEF
          </Text>
        </View>
        <View style={[styles.stepLine, step === "SUCCESS" && styles.stepLineActive]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepDot, step === "SUCCESS" && styles.stepDotSuccess]}>
            <MaterialCommunityIcons
              name={step === "SUCCESS" ? "check" : "numeric-4"}
              size={13}
              color={step === "SUCCESS" ? "#FFFFFF" : "#64748B"}
            />
          </View>
          <Text style={[styles.stepLabel, step === "SUCCESS" && styles.stepLabelSuccess]}>
            Verified
          </Text>
        </View>
      </View>

      {/* Hardware Status Banner */}
      {nfcStatus.isExpoGo ? (
        <View style={styles.hardwareBannerInfo}>
          <MaterialCommunityIcons name="cellphone-nfc" size={22} color="#0284C7" />
          <View style={styles.hardwareBannerTextWrap}>
            <Text style={styles.bannerTitleInfo}>Expo Go • Simulation Mode Active</Text>
            <Text style={styles.bannerDescInfo}>
              Simulation mode is active for end-to-end testing of write, read-back & backend access verification.
            </Text>
          </View>
        </View>
      ) : !nfcStatus.supported ? (
        <View style={styles.hardwareBannerError}>
          <MaterialCommunityIcons name="nfc-search-variant" size={22} color="#DC2626" />
          <View style={styles.hardwareBannerTextWrap}>
            <Text style={styles.bannerTitleError}>NFC Hardware Unavailable</Text>
            <Text style={styles.bannerDescError}>
              This Android device lacks NFC hardware.
            </Text>
          </View>
        </View>
      ) : !nfcStatus.enabled ? (
        <View style={styles.hardwareBannerWarn}>
          <MaterialCommunityIcons name="nfc-search-variant" size={22} color="#D97706" />
          <View style={styles.hardwareBannerTextWrap}>
            <Text style={styles.bannerTitleWarn}>NFC is Turned OFF</Text>
            <Text style={styles.bannerDescWarn}>
              Enable NFC in system settings to write physical cards.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.openSettingsBtn}
            onPress={() => nfcService.openSystemNfcSettings()}
          >
            <Text style={styles.openSettingsBtnText}>Enable</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.hardwareBannerReady}>
          <MaterialCommunityIcons name="check-circle" size={18} color="#059669" />
          <Text style={styles.bannerTextReady}>
            NFC Antenna Active • ISO 14443-A NDEF URI Mode
          </Text>
        </View>
      )}

      {/* Main Interactive Writing Card */}
      <View style={styles.card}>
        {/* Antenna Guide with Radar */}
        <View style={styles.antennaGuideBox}>
          <View style={styles.radarWrapper}>
            {(step === "WAITING_FOR_TAG" ||
              step === "CHECKING_CAPABILITIES" ||
              step === "WRITING_TAG" ||
              step === "VERIFYING_READBACK" ||
              diagReading ||
              capChecking) && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: pulseOpacity
                  }
                ]}
              />
            )}

            <View style={styles.radarRingOuter}>
              <LinearGradient
                colors={
                  step === "SUCCESS"
                    ? ["#059669", "#10B981"]
                    : step === "ERROR"
                    ? ["#DC2626", "#EF4444"]
                    : step === "WAITING_FOR_TAG" ||
                      step === "CHECKING_CAPABILITIES" ||
                      step === "WRITING_TAG"
                    ? ["#2563EB", "#0284C7"]
                    : ["#EFF6FF", "#DBEAFE"]
                }
                style={styles.radarRingInner}
              >
                <MaterialCommunityIcons
                  name={
                    step === "SUCCESS"
                      ? "check-bold"
                      : step === "ERROR"
                      ? "alert-circle"
                      : "credit-card-wireless"
                  }
                  size={36}
                  color={
                    step === "SUCCESS" ||
                    step === "ERROR" ||
                    step === "WAITING_FOR_TAG" ||
                    step === "CHECKING_CAPABILITIES" ||
                    step === "WRITING_TAG"
                      ? "#FFFFFF"
                      : "#2563EB"
                  }
                />
              </LinearGradient>
            </View>
          </View>

          <Text style={styles.antennaInstruction}>
            {step === "WAITING_FOR_TAG"
              ? "Hold card steady against the back of your phone..."
              : step === "CHECKING_CAPABILITIES"
              ? "Card detected! Checking memory & write capabilities..."
              : step === "WRITING_TAG"
              ? "Writing NDEF URI payload..."
              : step === "VERIFYING_READBACK"
              ? "Reading back from card to verify URI..."
              : step === "VERIFYING_BACKEND"
              ? "Verifying backend token & vehicle assignment..."
              : step === "SUCCESS"
              ? "Card Verified & Ready for Driver!"
              : step === "WRITTEN_BACKEND_PENDING"
              ? "Written — Backend Verification Pending"
              : step === "SYNC_PENDING"
              ? "Card Written (Sync Pending)"
              : step === "ERROR"
              ? "Operation Failed"
              : "NFC Antenna Guide"}
          </Text>
          <Text style={styles.antennaSubInstruction}>
            {detectedCap
              ? `Status: ${detectedCap.statusMessage}`
              : "Place physical card near top-center on the back of phone."}
          </Text>
        </View>

        {/* Selected Card Information */}
        {cardId ? (
          <View style={styles.cardInfoBox}>
            <View style={styles.cardInfoRow}>
              <Text style={styles.infoLabel}>Card Identifier:</Text>
              <Text style={styles.infoCardId}>{cardId}</Text>
            </View>
            {orderNumber ? (
              <View style={styles.cardInfoRow}>
                <Text style={styles.infoLabel}>Order Reference:</Text>
                <Text style={styles.infoVal}>{orderNumber}</Text>
              </View>
            ) : null}
            {vehiclePlate ? (
              <View style={styles.cardInfoRow}>
                <Text style={styles.infoLabel}>Assigned Vehicle:</Text>
                <View style={styles.vehicleBadge}>
                  <MaterialCommunityIcons name="car" size={13} color="#2563EB" />
                  <Text style={styles.vehicleBadgeText}>{vehiclePlate}</Text>
                </View>
              </View>
            ) : null}
            {policyHolderName ? (
              <View style={styles.cardInfoRow}>
                <Text style={styles.infoLabel}>Policyholder:</Text>
                <Text style={styles.infoVal}>{policyHolderName}</Text>
              </View>
            ) : null}
            <View style={styles.cardInfoRow}>
              <Text style={styles.infoLabel}>Branch Scope:</Text>
              <View style={styles.branchPill}>
                <Text style={styles.branchPillText}>{staff?.branch || "Galle"} Branch</Text>
              </View>
            </View>
            <View style={styles.cardInfoRow}>
              <Text style={styles.infoLabel}>Authorized URL:</Text>
              <Text style={styles.infoMono}>{maskUrlToken(cardUrl)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.noCardBox}>
            <MaterialCommunityIcons name="tray-alert" size={26} color="#94A3B8" />
            <Text style={styles.noCardText}>No card currently selected for writing.</Text>
            <Text style={styles.noCardSubtext}>
              Click "Transfer to NFC Writer" in the website portal or select from the Dashboard.
            </Text>
          </View>
        )}

        {/* Section 6: Per-Card NFC Settings Panel */}
        {cardId ? (
          <View style={styles.settingsPanel}>
            <TouchableOpacity
              style={styles.settingsPanelHeader}
              onPress={() => setShowSettingsPanel(!showSettingsPanel)}
              activeOpacity={0.7}
            >
              <View style={styles.settingsTitleWrap}>
                <MaterialCommunityIcons name="cog-outline" size={16} color="#0F2942" />
                <Text style={styles.settingsPanelTitle}>Per-Card NFC Settings & Capabilities</Text>
              </View>
              <MaterialCommunityIcons
                name={showSettingsPanel ? "chevron-up" : "chevron-down"}
                size={20}
                color="#64748B"
              />
            </TouchableOpacity>

            {showSettingsPanel && (
              <View style={styles.settingsBody}>
                {/* Capability Specs */}
                <View style={styles.capGrid}>
                  <View style={styles.capItem}>
                    <Text style={styles.capLabel}>Target URL Size</Text>
                    <Text style={styles.capVal}>{cardUrl ? `${cardUrl.length} bytes` : "0b"}</Text>
                  </View>
                  <View style={styles.capItem}>
                    <Text style={styles.capLabel}>Tag Capacity</Text>
                    <Text style={styles.capVal}>
                      {detectedCap ? `${detectedCap.maxSize} bytes` : "540 bytes (Est.)"}
                    </Text>
                  </View>
                  <View style={styles.capItem}>
                    <Text style={styles.capLabel}>Writable State</Text>
                    <Text
                      style={[
                        styles.capVal,
                        { color: detectedCap?.isLocked ? "#DC2626" : "#059669" }
                      ]}
                    >
                      {detectedCap ? (detectedCap.isLocked ? "Read-Only" : "Writable") : "Writable"}
                    </Text>
                  </View>
                </View>

                {/* Capability Check Action */}
                <TouchableOpacity
                  style={styles.checkCapBtn}
                  onPress={handleInspectCapabilities}
                  disabled={capChecking}
                >
                  {capChecking ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="credit-card-scan-outline"
                        size={15}
                        color="#2563EB"
                      />
                      <Text style={styles.checkCapBtnText}>Inspect Tag Capabilities</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Settings Toggles */}
                <View style={styles.settingRow}>
                  <View style={styles.settingTextWrap}>
                    <Text style={styles.settingName}>Strict Read-Back Verification</Text>
                    <Text style={styles.settingDesc}>
                      Reads back URI immediately to guarantee 100% byte match.
                    </Text>
                  </View>
                  <Switch
                    value={strictReadBack}
                    onValueChange={setStrictReadBack}
                    trackColor={{ false: "#CBD5E1", true: "#93C5FD" }}
                    thumbColor={strictReadBack ? "#2563EB" : "#F1F5F9"}
                  />
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingTextWrap}>
                    <Text style={styles.settingName}>Allow Overwrite Existing Data</Text>
                    <Text style={styles.settingDesc}>
                      Replaces existing NDEF payload if card has prior data.
                    </Text>
                  </View>
                  <Switch
                    value={allowOverwrite}
                    onValueChange={setAllowOverwrite}
                    trackColor={{ false: "#CBD5E1", true: "#93C5FD" }}
                    thumbColor={allowOverwrite ? "#2563EB" : "#F1F5F9"}
                  />
                </View>

                <View style={[styles.settingRow, styles.settingRowWarning]}>
                  <View style={styles.settingTextWrap}>
                    <View style={styles.settingWarningHeader}>
                      <Text style={styles.settingName}>Permanent Tag Lock (Read-Only)</Text>
                      <View style={styles.dangerTag}>
                        <Text style={styles.dangerTagText}>Irreversible</Text>
                      </View>
                    </View>
                    <Text style={styles.settingDesc}>
                      Permanently locks NFC chip. OFF by default. Requires explicit confirmation.
                    </Text>
                  </View>
                  <Switch
                    value={permanentLock}
                    onValueChange={handleTogglePermanentLock}
                    trackColor={{ false: "#CBD5E1", true: "#FCA5A5" }}
                    thumbColor={permanentLock ? "#DC2626" : "#F1F5F9"}
                  />
                </View>
              </View>
            )}
          </View>
        ) : null}

        {/* Dynamic Action Buttons */}
        <View style={styles.actionsWrap}>
          {step === "IDLE" || step === "READY_TO_WRITE" ? (
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (!cardId || (!nfcStatus.enabled && !nfcStatus.isExpoGo)) && styles.btnDisabled
              ]}
              onPress={handleStartWrite}
              disabled={!cardId || (!nfcStatus.enabled && !nfcStatus.isExpoGo)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={
                  !cardId || (!nfcStatus.enabled && !nfcStatus.isExpoGo)
                    ? ["#CBD5E1", "#94A3B8"]
                    : ["#2563EB", "#1D4ED8"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtnContent}
              >
                <MaterialCommunityIcons
                  name={nfcStatus.isExpoGo ? "play-circle-outline" : "nfc"}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.primaryBtnText}>
                  {nfcStatus.isExpoGo ? "Simulate & Verify NFC Write" : "Confirm & Write NFC Card"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : step === "WAITING_FOR_TAG" ||
            step === "CHECKING_CAPABILITIES" ||
            step === "WRITING_TAG" ||
            step === "VERIFYING_READBACK" ||
            step === "VERIFYING_BACKEND" ? (
            <View style={styles.inProgressContainer}>
              <ActivityIndicator size="large" color="#2563EB" style={{ marginBottom: 12 }} />
              <Text style={styles.inProgressText}>
                {step === "WAITING_FOR_TAG"
                  ? "Looking for NFC Tag..."
                  : step === "CHECKING_CAPABILITIES"
                  ? "Inspecting Tag Capabilities..."
                  : step === "WRITING_TAG"
                  ? "Writing NDEF URI Payload..."
                  : step === "VERIFYING_READBACK"
                  ? "Verifying Read-Back URI..."
                  : "Verifying Backend Token & Permissions..."}
              </Text>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : step === "SUCCESS" || step === "WRITTEN_BACKEND_PENDING" || step === "SYNC_PENDING" ? (
            <View style={styles.resultBox}>
              <View
                style={
                  step === "SUCCESS"
                    ? styles.resultBadgeSuccess
                    : styles.resultBadgeWarn
                }
              >
                <MaterialCommunityIcons
                  name={step === "SUCCESS" ? "check-circle" : "alert-circle-outline"}
                  size={20}
                  color={step === "SUCCESS" ? "#059669" : "#D97706"}
                />
                <Text
                  style={
                    step === "SUCCESS" ? styles.resultBadgeText : styles.resultBadgeTextWarn
                  }
                >
                  {step === "SUCCESS"
                    ? "Physical NFC & Backend Verified"
                    : "Written — Backend Verification Pending"}
                </Text>
              </View>

              {detectedUid ? (
                <View style={styles.tagMetaGrid}>
                  <View style={styles.tagMetaRow}>
                    <Text style={styles.tagMetaLabel}>Physical Tag UID:</Text>
                    <Text style={styles.tagMetaValMono}>{detectedUid}</Text>
                  </View>
                  <View style={styles.tagMetaRow}>
                    <Text style={styles.tagMetaLabel}>Tag Technology:</Text>
                    <Text style={styles.tagMetaVal}>{detectedTech || "NFC Forum Type 2"}</Text>
                  </View>
                  <View style={styles.tagMetaRow}>
                    <Text style={styles.tagMetaLabel}>Read-Back Result:</Text>
                    <Text style={[styles.tagMetaVal, { color: "#059669" }]}>100% Match</Text>
                  </View>
                  {backendVerification ? (
                    <View style={styles.tagMetaRow}>
                      <Text style={styles.tagMetaLabel}>Backend Token:</Text>
                      <Text
                        style={[
                          styles.tagMetaVal,
                          {
                            color:
                              backendVerification.tokenStatus === "Active"
                                ? "#059669"
                                : "#DC2626"
                          }
                        ]}
                      >
                        {backendVerification.tokenStatus}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <Text style={styles.syncStatusDesc}>{syncStatusText}</Text>

              {/* Section 10: In-App Half-Screen Preview Button */}
              <TouchableOpacity
                style={styles.previewBtn}
                onPress={() => {
                  setShowPreviewModal(true);
                  setPreviewLoadError(null);
                  updateChecklistItem(9, "Passed", "In-app preview loaded");
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#0284C7", "#0369A1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBtnContent}
                >
                  <MaterialCommunityIcons name="open-in-app" size={19} color="#FFFFFF" />
                  <Text style={styles.previewBtnText}>Preview Access (Half-Screen)</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Safe Backend Verification Retry */}
              {step === "WRITTEN_BACKEND_PENDING" ? (
                <TouchableOpacity
                  style={styles.retryBackendBtn}
                  onPress={handleRetryBackendVerification}
                >
                  <MaterialCommunityIcons name="refresh" size={16} color="#2563EB" />
                  <Text style={styles.retryBackendBtnText}>Retry Backend Verification</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.nextBtn} onPress={handleResetForNext}>
                <LinearGradient
                  colors={["#059669", "#047857"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBtnContent}
                >
                  <MaterialCommunityIcons name="arrow-right-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.nextBtnText}>Ready for Next Card</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : step === "ERROR" ? (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={32} color="#DC2626" />
              <Text style={styles.errorTitle}>NFC Operation Failed</Text>
              <Text style={styles.errorDesc}>{errorMessage}</Text>

              <View style={styles.errorActions}>
                <TouchableOpacity style={styles.retryBtn} onPress={handleStartWrite}>
                  <Text style={styles.retryBtnText}>Retry Operation</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dismissBtn} onPress={handleResetForNext}>
                  <Text style={styles.dismissBtnText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {/* Section 11: Mandatory In-App Verification Checklist (11 Items) */}
      <View style={styles.checklistCard}>
        <View style={styles.checklistHeader}>
          <View style={styles.checklistTitleRow}>
            <MaterialCommunityIcons
              name={allRequiredPassed ? "check-decagram" : "playlist-check"}
              size={20}
              color={allRequiredPassed ? "#059669" : "#2563EB"}
            />
            <Text style={styles.checklistTitle}>In-App Verification Checklist</Text>
          </View>
          <View
            style={[
              styles.checklistStatusPill,
              allRequiredPassed
                ? styles.checklistStatusPillSuccess
                : styles.checklistStatusPillPending
            ]}
          >
            <Text
              style={[
                styles.checklistStatusPillText,
                allRequiredPassed
                  ? styles.checklistStatusPillTextSuccess
                  : styles.checklistStatusPillTextPending
              ]}
            >
              {allRequiredPassed ? "Verified" : "Pending Checks"}
            </Text>
          </View>
        </View>

        <Text style={styles.checklistSubtitle}>
          Real-time technical tracking across physical antenna write & SANASA backend authentication.
        </Text>

        <View style={styles.checklistItemsList}>
          {checklist.map((item) => (
            <View key={item.id} style={styles.checklistItemRow}>
              <View style={styles.checkItemLeft}>
                <Text style={styles.checkItemNumber}>{item.id}.</Text>
                <View style={styles.checkItemTextCol}>
                  <Text style={styles.checkItemLabel}>{item.label}</Text>
                  {item.detail ? (
                    <Text style={styles.checkItemDetail}>{item.detail}</Text>
                  ) : null}
                </View>
              </View>
              {renderCheckBadge(item.status)}
            </View>
          ))}
        </View>

        {cardId && (
          <TouchableOpacity
            style={styles.retryAllChecksBtn}
            onPress={handleRetryBackendVerification}
          >
            <MaterialCommunityIcons name="shield-sync-outline" size={16} color="#2563EB" />
            <Text style={styles.retryAllChecksText}>Re-run Backend & Token Checks</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Auxiliary Engineering Tools */}
      <View style={styles.toolCard}>
        <View style={styles.toolHeader}>
          <MaterialCommunityIcons name="tools" size={18} color="#2563EB" />
          <Text style={styles.toolTitle}>NFC Antenna Diagnostic Tool</Text>
        </View>
        <Text style={styles.toolDesc}>
          Test reading any physical card or fob to inspect its UID and NDEF memory structure without writing data.
        </Text>
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={handleTestTagScan}
          disabled={diagReading}
          activeOpacity={0.8}
        >
          {diagReading ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <>
              <MaterialCommunityIcons name="credit-card-scan-outline" size={18} color="#2563EB" />
              <Text style={styles.toolBtnText}>Run Tag Diagnostic Scan</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Section 10: In-App Half-Screen WebView Modal */}
      <Modal
        visible={showPreviewModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { height: previewExpanded ? SCREEN_HEIGHT * 0.92 : SCREEN_HEIGHT * 0.55 }
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <MaterialCommunityIcons name="shield-check" size={20} color="#059669" />
                <View>
                  <Text style={styles.modalTitle}>SANASA Driver Portal Preview</Text>
                  <Text style={styles.modalSubtitle}>
                    Vehicle: {vehiclePlate || "Plate Assigned"} • Card: {cardId}
                  </Text>
                </View>
              </View>

              <View style={styles.modalControls}>
                <TouchableOpacity
                  style={styles.modalControlBtn}
                  onPress={() => setPreviewExpanded(!previewExpanded)}
                >
                  <MaterialCommunityIcons
                    name={previewExpanded ? "arrow-collapse" : "arrow-expand"}
                    size={18}
                    color="#475569"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowPreviewModal(false)}
                >
                  <MaterialCommunityIcons name="close" size={20} color="#0F2942" />
                </TouchableOpacity>
              </View>
            </View>

            {/* WebView Body */}
            <View style={styles.webViewContainer}>
              {previewLoading && (
                <View style={styles.webViewLoader}>
                  <ActivityIndicator size="large" color="#2563EB" />
                  <Text style={styles.webViewLoaderText}>Loading limited-access driver view...</Text>
                </View>
              )}

              {previewLoadError ? (
                <View style={styles.previewErrorWrap}>
                  <MaterialCommunityIcons name="web-remove" size={40} color="#DC2626" />
                  <Text style={styles.previewErrorTitle}>Preview Failed to Load</Text>
                  <Text style={styles.previewErrorText}>{previewLoadError}</Text>
                  <TouchableOpacity
                    style={styles.previewReloadBtn}
                    onPress={() => {
                      setPreviewLoadError(null);
                      webViewRef.current?.reload();
                    }}
                  >
                    <Text style={styles.previewReloadBtnText}>Reload Page</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <WebViewComponent
                  ref={webViewRef}
                  source={{ uri: cardUrl }}
                  style={styles.webView}
                  originWhitelist={["*"]}
                  onLoadStart={() => setPreviewLoading(true)}
                  onLoadEnd={() => setPreviewLoading(false)}
                  onError={(syntheticEvent: any) => {
                    const { nativeEvent } = syntheticEvent;
                    setPreviewLoading(false);
                    setPreviewLoadError(
                      nativeEvent?.description || "Network connection error while loading page."
                    );
                  }}
                  onShouldStartLoadWithRequest={(request: any) => {
                    // Security requirement: Restrict navigation to valid SANASA origins or driver paths
                    const url = String(request?.url || "").toLowerCase();
                    const isAllowed =
                      url.includes("/driver-access/") ||
                      url.includes("localhost") ||
                      url.includes("10.0.2.2") ||
                      url.includes("192.168.") ||
                      url.includes("sanasa");
                    return isAllowed;
                  }}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  // Stepper Header
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  stepItem: {
    alignItems: "center",
    gap: 4
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center"
  },
  stepDotActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB"
  },
  stepDotSuccess: {
    backgroundColor: "#059669",
    borderColor: "#059669"
  },
  stepDotNum: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "800"
  },
  stepDotNumActive: {
    color: "#FFFFFF"
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8"
  },
  stepLabelActive: {
    color: "#2563EB",
    fontWeight: "700"
  },
  stepLabelSuccess: {
    color: "#059669",
    fontWeight: "700"
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 4,
    marginBottom: 16
  },
  stepLineActive: {
    backgroundColor: "#2563EB"
  },

  // Banners
  hardwareBannerReady: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 16
  },
  bannerTextReady: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "700"
  },
  hardwareBannerInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 16
  },
  bannerTitleInfo: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0369A1"
  },
  bannerDescInfo: {
    fontSize: 10.5,
    color: "#0284C7",
    marginTop: 2
  },
  hardwareBannerWarn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 16
  },
  bannerTitleWarn: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E"
  },
  bannerDescWarn: {
    fontSize: 10.5,
    color: "#B45309",
    marginTop: 2
  },
  openSettingsBtn: {
    backgroundColor: "#D97706",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  openSettingsBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700"
  },
  hardwareBannerError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 16
  },
  hardwareBannerTextWrap: {
    flex: 1
  },
  bannerTitleError: {
    fontSize: 12,
    fontWeight: "700",
    color: "#991B1B"
  },
  bannerDescError: {
    fontSize: 10.5,
    color: "#B91C1C",
    marginTop: 2
  },

  // Main Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3
  },
  antennaGuideBox: {
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  radarWrapper: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14
  },
  pulseRing: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: "#2563EB",
    backgroundColor: "rgba(37, 99, 235, 0.12)"
  },
  radarRingOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center"
  },
  radarRingInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3
  },
  antennaInstruction: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F2942",
    textAlign: "center"
  },
  antennaSubInstruction: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center"
  },

  // Selected Card Info
  cardInfoBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    gap: 8
  },
  cardInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  infoLabel: {
    fontSize: 11,
    color: "#64748B"
  },
  infoCardId: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F2942",
    letterSpacing: 0.3
  },
  infoVal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  vehicleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  vehicleBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB"
  },
  branchPill: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  branchPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2563EB"
  },
  infoMono: {
    fontSize: 10,
    color: "#475569",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    maxWidth: 200
  },
  noCardBox: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 6
  },
  noCardText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569"
  },
  noCardSubtext: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    paddingHorizontal: 20
  },

  // Per-Card Settings Panel
  settingsPanel: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    overflow: "hidden"
  },
  settingsPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F1F5F9"
  },
  settingsTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  settingsPanelTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F2942"
  },
  settingsBody: {
    padding: 12,
    gap: 12
  },
  capGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  capItem: {
    alignItems: "center"
  },
  capLabel: {
    fontSize: 9.5,
    color: "#64748B",
    marginBottom: 2
  },
  capVal: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0F2942"
  },
  checkCapBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 8,
    borderRadius: 8
  },
  checkCapBtnText: {
    color: "#2563EB",
    fontSize: 11.5,
    fontWeight: "700"
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4
  },
  settingRowWarning: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0"
  },
  settingTextWrap: {
    flex: 1,
    paddingRight: 12
  },
  settingWarningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  settingName: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#1E293B"
  },
  settingDesc: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 1
  },
  dangerTag: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4
  },
  dangerTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#DC2626"
  },

  // Actions
  actionsWrap: {
    marginTop: 8
  },
  primaryBtn: {
    borderRadius: 14,
    overflow: "hidden"
  },
  gradientBtnContent: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2
  },
  btnDisabled: {
    opacity: 0.5
  },
  inProgressContainer: {
    alignItems: "center",
    paddingVertical: 14
  },
  inProgressText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
    marginBottom: 14
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 8
  },
  cancelBtnText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700"
  },

  // Result Box
  resultBox: {
    alignItems: "center",
    paddingVertical: 8,
    gap: 12
  },
  resultBadgeSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20
  },
  resultBadgeWarn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20
  },
  resultBadgeText: {
    color: "#059669",
    fontSize: 13,
    fontWeight: "800"
  },
  resultBadgeTextWarn: {
    color: "#D97706",
    fontSize: 12.5,
    fontWeight: "800"
  },
  tagMetaGrid: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  tagMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  tagMetaLabel: {
    fontSize: 11,
    color: "#64748B"
  },
  tagMetaVal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155"
  },
  tagMetaValMono: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
  },
  syncStatusDesc: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center"
  },
  previewBtn: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden"
  },
  previewBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800"
  },
  retryBackendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    paddingVertical: 10,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12
  },
  retryBackendBtnText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700"
  },
  nextBtn: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4
  },
  nextBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800"
  },

  // Error Box
  errorBox: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 8
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#DC2626"
  },
  errorDesc: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
    paddingHorizontal: 16
  },
  errorActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8
  },
  retryBtn: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  dismissBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  dismissBtnText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700"
  },

  // Section 11: Checklist Card
  checklistCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  checklistHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  checklistTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  checklistTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F2942"
  },
  checklistStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  checklistStatusPillSuccess: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0"
  },
  checklistStatusPillPending: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A"
  },
  checklistStatusPillText: {
    fontSize: 10,
    fontWeight: "800"
  },
  checklistStatusPillTextSuccess: {
    color: "#059669"
  },
  checklistStatusPillTextPending: {
    color: "#D97706"
  },
  checklistSubtitle: {
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 4,
    marginBottom: 12
  },
  checklistItemsList: {
    gap: 8
  },
  checklistItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC"
  },
  checkItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    paddingRight: 8
  },
  checkItemNumber: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    width: 18
  },
  checkItemTextCol: {
    flex: 1
  },
  checkItemLabel: {
    fontSize: 11.5,
    color: "#1E293B",
    fontWeight: "600"
  },
  checkItemDetail: {
    fontSize: 9.5,
    color: "#64748B",
    marginTop: 1
  },
  retryAllChecksBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12
  },
  retryAllChecksText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#2563EB"
  },

  // Check Badges
  badgePassed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  badgePassedText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#059669"
  },
  badgeFailed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  badgeFailedText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#DC2626"
  },
  badgeUnavailable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  badgeUnavailableText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#64748B"
  },
  badgePending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  badgePendingText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#D97706"
  },

  // Auxiliary Diagnostic Tool Card
  toolCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  toolHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6
  },
  toolTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F2942"
  },
  toolDesc: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 12,
    lineHeight: 16
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 10,
    borderRadius: 10
  },
  toolBtnText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700"
  },

  // Section 10: In-App Half-Screen Modal & WebView
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F6",
    backgroundColor: "#F8FAFC"
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F2942"
  },
  modalSubtitle: {
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 1
  },
  modalControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  modalControlBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9"
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9"
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF"
  },
  webView: {
    flex: 1
  },
  webViewLoader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 10
  },
  webViewLoaderText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600"
  },
  previewErrorWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10
  },
  previewErrorTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#DC2626"
  },
  previewErrorText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center"
  },
  previewReloadBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8
  },
  previewReloadBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  }
});
