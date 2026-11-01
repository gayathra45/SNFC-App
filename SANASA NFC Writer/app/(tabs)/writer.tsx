import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { nfcService, NfcDiagnosticStatus } from "../../src/services/nfcService";
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

      if (syncRes.synchronized) {
        setStep("SUCCESS");
        setSyncStatusText("Physical write and backend synchronization completed successfully!");
      } else {
        setStep("SYNC_PENDING");
        setSyncStatusText("Physical tag verified! Server sync is pending network connection.");
      }
    } catch (err: any) {
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
    setStep(cardId ? "READY_TO_WRITE" : "IDLE");
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
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* NFC Hardware Status Banner */}
      {!nfcStatus.supported ? (
        <View style={styles.hardwareBannerError}>
          <MaterialCommunityIcons name="nfc-search-variant" size={22} color="#DC2626" />
          <View style={styles.hardwareBannerTextWrap}>
            <Text style={styles.bannerTitleError}>NFC Hardware Unavailable</Text>
            <Text style={styles.bannerDescError}>
              This Android device lacks NFC hardware and cannot directly write physical tags.
            </Text>
          </View>
        </View>
      ) : !nfcStatus.enabled ? (
        <View style={styles.hardwareBannerWarn}>
          <MaterialCommunityIcons name="nfc-search-variant" size={22} color="#D97706" />
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
          <MaterialCommunityIcons name="check-circle" size={18} color="#059669" />
          <Text style={styles.bannerTextReady}>NFC Antenna Ready • NDEF URI Mode</Text>
        </View>
      )}

      {/* Main Interactive Card */}
      <View style={styles.card}>
        {/* Antenna Illustration & Placement Guide */}
        <View style={styles.antennaGuideBox}>
          <View
            style={[
              styles.radarRingOuter,
              (step === "WAITING_FOR_TAG" || step === "WRITING_TAG") && styles.radarPulse
            ]}
          >
            <View style={styles.radarRingInner}>
              <MaterialCommunityIcons
                name="credit-card-wireless"
                size={38}
                color={
                  step === "SUCCESS"
                    ? "#059669"
                    : step === "ERROR"
                    ? "#DC2626"
                    : (step === "WAITING_FOR_TAG" || step === "WRITING_TAG")
                    ? "#2563EB"
                    : "#102A43"
                }
              />
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
              <Text style={styles.infoLabel}>Authorized URL:</Text>
              <Text style={styles.infoMono}>{maskUrlToken(cardUrl)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.noCardBox}>
            <MaterialCommunityIcons name="tray-alert" size={24} color="#94A3B8" />
            <Text style={styles.noCardText}>No card currently selected for writing.</Text>
            <Text style={styles.noCardSubtext}>
              Click "Transfer to NFC Writer" on any card in the website portal, or wait for wireless push.
            </Text>
          </View>
        )}

        {/* Dynamic Action Buttons based on Step */}
        <View style={styles.actionsWrap}>
          {step === "IDLE" || step === "READY_TO_WRITE" ? (
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (!cardId || !nfcStatus.enabled) && styles.btnDisabled
              ]}
              onPress={handleStartWrite}
              disabled={!cardId || !nfcStatus.enabled}
            >
              <MaterialCommunityIcons name="nfc" size={20} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Confirm & Start NFC Write</Text>
            </TouchableOpacity>
          ) : step === "WAITING_FOR_TAG" || step === "WRITING_TAG" || step === "VERIFYING_READBACK" ? (
            <View style={styles.inProgressContainer}>
              <ActivityIndicator size="large" color="#102A43" style={{ marginBottom: 12 }} />
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
          ) : step === "SUCCESS" ? (
            <View style={styles.resultBox}>
              <View style={styles.successBadge}>
                <MaterialCommunityIcons name="check-circle" size={24} color="#059669" />
                <Text style={styles.successBadgeText}>Physical NFC Verification PASS</Text>
              </View>

              <View style={styles.resultDetails}>
                <Text style={styles.resultRow}>
                  Tag UID: <Text style={styles.monoBold}>{detectedUid || "NDEF Compatible"}</Text>
                </Text>
                <Text style={styles.resultRow}>
                  Read-Back: <Text style={styles.monoSmall}>{maskUrlToken(readBackUrl)}</Text>
                </Text>
                <Text style={styles.resultRow}>
                  Sync Status: <Text style={styles.textGreen}>Synchronized with SANASA Server</Text>
                </Text>
              </View>

              <TouchableOpacity style={styles.nextBtn} onPress={handleResetForNext}>
                <Text style={styles.nextBtnText}>Done / Ready for Next Card</Text>
              </TouchableOpacity>
            </View>
          ) : step === "SYNC_PENDING" ? (
            <View style={styles.resultBox}>
              <View style={[styles.successBadge, { backgroundColor: "#FEF3C7" }]}>
                <MaterialCommunityIcons name="cloud-sync" size={24} color="#D97706" />
                <Text style={[styles.successBadgeText, { color: "#92400E" }]}>
                  Tag Written (Sync Pending)
                </Text>
              </View>

              <Text style={styles.syncPendingDesc}>
                Physical card was verified on the chip! The server synchronization was queued offline and will auto-sync once connection restores.
              </Text>

              <TouchableOpacity style={styles.nextBtn} onPress={handleResetForNext}>
                <Text style={styles.nextBtnText}>Done / Next Card</Text>
              </TouchableOpacity>
            </View>
          ) : step === "ERROR" ? (
            <View style={styles.resultBox}>
              <View style={[styles.successBadge, { backgroundColor: "#FEE2E2" }]}>
                <MaterialCommunityIcons name="alert-circle" size={24} color="#DC2626" />
                <Text style={[styles.successBadgeText, { color: "#991B1B" }]}>Write Failed</Text>
              </View>
              <Text style={styles.errorMsgText}>{errorMessage}</Text>

              <View style={styles.errorBtnRow}>
                <TouchableOpacity style={styles.retryBtn} onPress={handleStartWrite}>
                  <MaterialCommunityIcons name="reload" size={16} color="#FFFFFF" />
                  <Text style={styles.retryBtnText}>Retry Write</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelErrorBtn} onPress={handleCancel}>
                  <Text style={styles.cancelErrorBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9"
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  hardwareBannerReady: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 16
  },
  bannerTextReady: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065F46"
  },
  hardwareBannerWarn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 16
  },
  hardwareBannerTextWrap: {
    flex: 1
  },
  bannerTitleWarn: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E"
  },
  bannerDescWarn: {
    fontSize: 10,
    color: "#B45309"
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
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 16
  },
  bannerTitleError: {
    fontSize: 12,
    fontWeight: "700",
    color: "#991B1B"
  },
  bannerDescError: {
    fontSize: 10,
    color: "#B91C1C"
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3
  },
  antennaGuideBox: {
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  radarRingOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  radarRingInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  radarPulse: {
    borderWidth: 2,
    borderColor: "#3B82F6"
  },
  antennaInstruction: {
    fontSize: 15,
    fontWeight: "800",
    color: "#102A43",
    textAlign: "center"
  },
  antennaSubInstruction: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center"
  },
  cardInfoBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    marginVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0"
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
    color: "#102A43"
  },
  infoVal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
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
  actionsWrap: {
    marginTop: 8
  },
  primaryBtn: {
    backgroundColor: "#102A43",
    borderRadius: 12,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  btnDisabled: {
    opacity: 0.5
  },
  inProgressContainer: {
    alignItems: "center",
    paddingVertical: 12
  },
  inProgressText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#102A43",
    marginBottom: 12
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 8
  },
  cancelBtnText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600"
  },
  resultBox: {
    alignItems: "center",
    gap: 12
  },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8
  },
  successBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#065F46"
  },
  resultDetails: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    width: "100%",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  resultRow: {
    fontSize: 11,
    color: "#64748B"
  },
  monoBold: {
    fontWeight: "700",
    color: "#1E293B",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
  },
  monoSmall: {
    fontSize: 10,
    color: "#334155",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
  },
  textGreen: {
    color: "#059669",
    fontWeight: "700"
  },
  nextBtn: {
    backgroundColor: "#059669",
    borderRadius: 12,
    height: 46,
    width: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  nextBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  syncPendingDesc: {
    fontSize: 11,
    color: "#92400E",
    textAlign: "center",
    lineHeight: 16
  },
  errorMsgText: {
    fontSize: 12,
    color: "#DC2626",
    textAlign: "center"
  },
  errorBtnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%"
  },
  retryBtn: {
    flex: 1,
    backgroundColor: "#102A43",
    borderRadius: 10,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
  cancelErrorBtn: {
    paddingHorizontal: 16,
    borderRadius: 10,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9"
  },
  cancelErrorBtnText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600"
  }
});
