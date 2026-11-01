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
  Easing
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { nfcService, NfcDiagnosticStatus, DetectedTagInfo } from "../../src/services/nfcService";
import { completeCardWriteAndSync } from "../../src/services/syncService";
import { getStoredStaff, maskUrlToken, StaffUser } from "../../src/services/storageService";
import { socketService } from "../../src/services/socketService";

type WriteStep =
  | "IDLE"
  | "READY_TO_WRITE"
  | "WAITING_FOR_TAG"
  | "WRITING_TAG"
  | "VERIFYING_READBACK"
  | "SUCCESS"
  | "SYNC_PENDING"
  | "ERROR";

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

  // Write State Machine
  const [step, setStep] = useState<WriteStep>("IDLE");
  const [detectedUid, setDetectedUid] = useState<string>("");
  const [detectedTech, setDetectedTech] = useState<string>("");
  const [readBackUrl, setReadBackUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [syncStatusText, setSyncStatusText] = useState<string>("");

  // Diagnostics Reader State
  const [diagReading, setDiagReading] = useState(false);
  const [diagTag, setDiagTag] = useState<DetectedTagInfo | null>(null);

  // Pulse animation for radar ring
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (step === "WAITING_FOR_TAG" || step === "WRITING_TAG" || diagReading) {
      anim = Animated.loop(
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.45,
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
      pulseOpacity.setValue(0.6);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [step, diagReading, pulseAnim, pulseOpacity]);

  // Load incoming params from route or socket
  useEffect(() => {
    if (params.cardId && params.cardUrl) {
      setCardId(String(params.cardId));
      setCardUrl(String(params.cardUrl));
      setOrderId(params.orderId ? String(params.orderId) : "");
      setOrderNumber(params.orderNumber ? String(params.orderNumber) : "");
      setJobId(params.jobId ? String(params.jobId) : "");
      setPolicyHolderName(params.policyHolderName ? String(params.policyHolderName) : "");
      setStep("READY_TO_WRITE");
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

  // Listen for incoming transfer jobs while on this screen
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
      setStep("READY_TO_WRITE");
      setErrorMessage("");
    });
    return () => unsub();
  }, []);

  // Main NFC Writing and Read-Back Verification Flow
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
        Alert.alert(
          "NFC is Disabled",
          "Please enable NFC in your system settings to continue.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => nfcService.openSystemNfcSettings() }
          ]
        );
        return;
      }
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    // Step 1: Waiting for Tag
    setStep("WAITING_FOR_TAG");
    setErrorMessage("");
    setDetectedUid("");

    // Notify backend that phone is writing tag
    if (jobId) {
      socketService.reportJobStatus(jobId, "Writing").catch(() => {});
    }

    try {
      setStep("WRITING_TAG");
      const writeRes = await nfcService.writeAndVerifyUri(cardUrl);

      if (!writeRes.success) {
        throw new Error(writeRes.error || "NFC write operation failed.");
      }

      setDetectedUid(writeRes.tagUid);
      setDetectedTech(writeRes.tagTech);
      setReadBackUrl(writeRes.readBackUrl);

      // Step 2: Read-back Verification Succeeded
      setStep("VERIFYING_READBACK");

      // Step 3: Synchronize with SANASA Backend
      setSyncStatusText("Synchronizing verified card with SANASA backend...");
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

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      if (syncRes.synchronized) {
        setStep("SUCCESS");
        setSyncStatusText("Physical write and backend synchronization completed successfully!");
      } else {
        setStep("SYNC_PENDING");
        setSyncStatusText("Physical tag verified! Server sync is pending network connection.");
      }
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
    setErrorMessage("");
    setDiagTag(null);
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
          `UID: ${tag.tagUid || "Unknown"}\nTechnologies: ${tag.techList.join(", ") || "NDEF"}\nWritable: ${tag.isWritable ? "Yes" : "Locked / Read-Only"}`
        );
      }
    } catch (err: any) {
      Alert.alert("Diagnostic Scan", err.message || "No tag detected or cancelled.");
    } finally {
      setDiagReading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Workflow Stepper */}
      <View style={styles.stepperContainer}>
        <View style={styles.stepItem}>
          <View style={[styles.stepDot, cardId ? styles.stepDotActive : null]}>
            <Text style={styles.stepDotNum}>1</Text>
          </View>
          <Text style={[styles.stepLabel, cardId ? styles.stepLabelActive : null]}>Card Ready</Text>
        </View>
        <View style={[styles.stepLine, step !== "IDLE" && styles.stepLineActive]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepDot, (step === "WAITING_FOR_TAG" || step === "WRITING_TAG" || step === "VERIFYING_READBACK" || step === "SUCCESS") && styles.stepDotActive]}>
            <Text style={styles.stepDotNum}>2</Text>
          </View>
          <Text style={[styles.stepLabel, (step === "WAITING_FOR_TAG" || step === "WRITING_TAG" || step === "VERIFYING_READBACK" || step === "SUCCESS") && styles.stepLabelActive]}>Scan Tag</Text>
        </View>
        <View style={[styles.stepLine, (step === "WRITING_TAG" || step === "VERIFYING_READBACK" || step === "SUCCESS") && styles.stepLineActive]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepDot, (step === "WRITING_TAG" || step === "VERIFYING_READBACK" || step === "SUCCESS") && styles.stepDotActive]}>
            <Text style={styles.stepDotNum}>3</Text>
          </View>
          <Text style={[styles.stepLabel, (step === "WRITING_TAG" || step === "VERIFYING_READBACK" || step === "SUCCESS") && styles.stepLabelActive]}>Write NDEF</Text>
        </View>
        <View style={[styles.stepLine, step === "SUCCESS" && styles.stepLineActive]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepDot, step === "SUCCESS" && styles.stepDotSuccess]}>
            <MaterialCommunityIcons name={step === "SUCCESS" ? "check" : "numeric-4"} size={12} color="#FFFFFF" />
          </View>
          <Text style={[styles.stepLabel, step === "SUCCESS" && styles.stepLabelSuccess]}>Verified</Text>
        </View>
      </View>

      {/* NFC Hardware Status Banner */}
      {nfcStatus.isExpoGo ? (
        <View style={styles.hardwareBannerInfo}>
          <MaterialCommunityIcons name="cellphone-nfc" size={22} color="#38BDF8" />
          <View style={styles.hardwareBannerTextWrap}>
            <Text style={styles.bannerTitleInfo}>Expo Go • Simulation Mode Active</Text>
            <Text style={styles.bannerDescInfo}>
              Your phone has NFC, but Expo Go cannot load native drivers. Simulation Mode is enabled so you can test end-to-end writing & backend sync!
            </Text>
          </View>
        </View>
      ) : !nfcStatus.supported ? (
        <View style={styles.hardwareBannerError}>
          <MaterialCommunityIcons name="nfc-search-variant" size={22} color="#EF4444" />
          <View style={styles.hardwareBannerTextWrap}>
            <Text style={styles.bannerTitleError}>NFC Hardware Unavailable</Text>
            <Text style={styles.bannerDescError}>
              This Android device lacks NFC hardware and cannot directly write physical tags.
            </Text>
          </View>
        </View>
      ) : !nfcStatus.enabled ? (
        <View style={styles.hardwareBannerWarn}>
          <MaterialCommunityIcons name="nfc-search-variant" size={22} color="#F59E0B" />
          <View style={styles.hardwareBannerTextWrap}>
            <Text style={styles.bannerTitleWarn}>NFC is Turned OFF</Text>
            <Text style={styles.bannerDescWarn}>Enable NFC in system settings to write physical cards.</Text>
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
          <MaterialCommunityIcons name="check-decagram" size={18} color="#10B981" />
          <Text style={styles.bannerTextReady}>NFC Antenna Active • ISO 14443-A NDEF Mode</Text>
        </View>
      )}

      {/* Main Interactive Card */}
      <View style={styles.card}>
        {/* Antenna Illustration & Concentric Radar */}
        <View style={styles.antennaGuideBox}>
          <View style={styles.radarWrapper}>
            {/* Animated Pulse Ring */}
            {(step === "WAITING_FOR_TAG" || step === "WRITING_TAG" || diagReading) && (
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
                    : step === "WAITING_FOR_TAG" || step === "WRITING_TAG"
                    ? ["#2563EB", "#06B6D4"]
                    : ["#1E293B", "#0F172A"]
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
                  color="#FFFFFF"
                />
              </LinearGradient>
            </View>
          </View>

          <Text style={styles.antennaInstruction}>
            {step === "WAITING_FOR_TAG"
              ? "Hold card steady against the back of your phone..."
              : step === "WRITING_TAG"
              ? "Card detected! Writing NDEF payload..."
              : step === "VERIFYING_READBACK"
              ? "Reading back from card to verify URI..."
              : step === "SUCCESS"
              ? "Physical Card Successfully Verified!"
              : step === "SYNC_PENDING"
              ? "Card Written (Sync Pending)"
              : step === "ERROR"
              ? "Operation Failed"
              : "Antenna Placement Guide"}
          </Text>
          <Text style={styles.antennaSubInstruction}>
            Hold the card near the top-center on the back of the phone.
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
                <Text style={styles.infoLabel}>Request Order:</Text>
                <Text style={styles.infoVal}>{orderNumber}</Text>
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
            <MaterialCommunityIcons name="tray-alert" size={26} color="#64748B" />
            <Text style={styles.noCardText}>No card currently selected for writing.</Text>
            <Text style={styles.noCardSubtext}>
              Click "Transfer to NFC Writer" on any card in the website portal, or select from the Dashboard.
            </Text>
          </View>
        )}

        {/* Dynamic Action Buttons based on Step */}
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
                    ? ["#334155", "#1E293B"]
                    : ["#2563EB", "#06B6D4"]
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
                  {nfcStatus.isExpoGo ? "Simulate & Verify NFC Write" : "Confirm & Start NFC Write"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : step === "WAITING_FOR_TAG" || step === "WRITING_TAG" || step === "VERIFYING_READBACK" ? (
            <View style={styles.inProgressContainer}>
              <ActivityIndicator size="large" color="#38BDF8" style={{ marginBottom: 12 }} />
              <Text style={styles.inProgressText}>
                {step === "WAITING_FOR_TAG"
                  ? "Looking for NFC Tag..."
                  : step === "WRITING_TAG"
                  ? "Writing NDEF Record..."
                  : "Verifying Read-Back URI..."}
              </Text>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : step === "SUCCESS" || step === "SYNC_PENDING" ? (
            <View style={styles.resultBox}>
              <View style={styles.resultBadgeSuccess}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
                <Text style={styles.resultBadgeText}>NDEF Payload Verified</Text>
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
                    <Text style={styles.tagMetaLabel}>Read-Back Verified:</Text>
                    <Text style={[styles.tagMetaVal, { color: "#10B981" }]}>100% Exact Match</Text>
                  </View>
                </View>
              ) : null}

              <Text style={styles.syncStatusDesc}>{syncStatusText}</Text>

              <TouchableOpacity style={styles.nextBtn} onPress={handleResetForNext}>
                <LinearGradient
                  colors={["#059669", "#10B981"]}
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
              <MaterialCommunityIcons name="alert-circle-outline" size={32} color="#EF4444" />
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

      {/* Auxiliary Engineering Tools */}
      <View style={styles.toolCard}>
        <View style={styles.toolHeader}>
          <MaterialCommunityIcons name="tools" size={18} color="#38BDF8" />
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
            <ActivityIndicator size="small" color="#38BDF8" />
          ) : (
            <>
              <MaterialCommunityIcons name="credit-card-scan-outline" size={18} color="#38BDF8" />
              <Text style={styles.toolBtnText}>Run Tag Diagnostic Scan</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1E"
  },
  content: {
    padding: 16,
    paddingBottom: 36
  },
  // Stepper Header
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0E172E",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)"
  },
  stepItem: {
    alignItems: "center",
    gap: 4
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#475569",
    alignItems: "center",
    justifyContent: "center"
  },
  stepDotActive: {
    backgroundColor: "#2563EB",
    borderColor: "#38BDF8"
  },
  stepDotSuccess: {
    backgroundColor: "#059669",
    borderColor: "#10B981"
  },
  stepDotNum: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800"
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B"
  },
  stepLabelActive: {
    color: "#38BDF8",
    fontWeight: "700"
  },
  stepLabelSuccess: {
    color: "#10B981",
    fontWeight: "700"
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#1E293B",
    marginHorizontal: 4,
    marginBottom: 16
  },
  stepLineActive: {
    backgroundColor: "#38BDF8"
  },

  // Banners
  hardwareBannerReady: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 16
  },
  bannerTextReady: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "700"
  },
  hardwareBannerInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 16
  },
  bannerTitleInfo: {
    fontSize: 12,
    fontWeight: "700",
    color: "#38BDF8"
  },
  bannerDescInfo: {
    fontSize: 10.5,
    color: "#94A3B8",
    marginTop: 2
  },
  hardwareBannerWarn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 16
  },
  bannerTitleWarn: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F59E0B"
  },
  bannerDescWarn: {
    fontSize: 10.5,
    color: "#FCD34D",
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
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
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
    color: "#EF4444"
  },
  bannerDescError: {
    fontSize: 10.5,
    color: "#FCA5A5",
    marginTop: 2
  },

  // Main Card
  card: {
    backgroundColor: "#0E172E",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4
  },
  antennaGuideBox: {
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)"
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
    borderColor: "#38BDF8",
    backgroundColor: "rgba(56, 189, 248, 0.15)"
  },
  radarRingOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#162244",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)"
  },
  radarRingInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4
  },
  antennaInstruction: {
    fontSize: 16,
    fontWeight: "800",
    color: "#F8FAFC",
    textAlign: "center"
  },
  antennaSubInstruction: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
    textAlign: "center"
  },

  // Selected Card Box
  cardInfoBox: {
    backgroundColor: "#162244",
    borderRadius: 14,
    padding: 14,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 8
  },
  cardInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  infoLabel: {
    fontSize: 11,
    color: "#94A3B8"
  },
  infoCardId: {
    fontSize: 13,
    fontWeight: "800",
    color: "#38BDF8",
    letterSpacing: 0.5
  },
  infoVal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#E2E8F0"
  },
  branchPill: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  branchPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#38BDF8"
  },
  infoMono: {
    fontSize: 10,
    color: "#64748B",
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
    color: "#E2E8F0"
  },
  noCardSubtext: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
    paddingHorizontal: 20
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
    color: "#38BDF8",
    marginBottom: 14
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#1E293B",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  cancelBtnText: {
    fontSize: 12,
    color: "#94A3B8",
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
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20
  },
  resultBadgeText: {
    color: "#10B981",
    fontSize: 13,
    fontWeight: "800"
  },
  tagMetaGrid: {
    width: "100%",
    backgroundColor: "#162244",
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)"
  },
  tagMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  tagMetaLabel: {
    fontSize: 11,
    color: "#94A3B8"
  },
  tagMetaVal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E2E8F0"
  },
  tagMetaValMono: {
    fontSize: 11,
    fontWeight: "800",
    color: "#38BDF8",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
  },
  syncStatusDesc: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center"
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
    color: "#EF4444"
  },
  errorDesc: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    paddingHorizontal: 16
  },
  errorActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8
  },
  retryBtn: {
    backgroundColor: "#EF4444",
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
    backgroundColor: "#1E293B",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  dismissBtnText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700"
  },

  // Auxiliary Diagnostic Tool Card
  toolCard: {
    backgroundColor: "#0E172E",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)"
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
    color: "#F8FAFC"
  },
  toolDesc: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 12,
    lineHeight: 16
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    paddingVertical: 10,
    borderRadius: 10
  },
  toolBtnText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "700"
  }
});
