import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  getStoredPairing,
  getStoredStaff,
  PairedSession,
  StaffUser
} from "../../src/services/storageService";
import { pairWithPortal, unpairDevice, getDeviceIdentifier } from "../../src/services/pairingService";
import { socketService } from "../../src/services/socketService";

export default function PairingScreen() {
  const [pairingCode, setPairingCode] = useState("");
  const [pairing, setPairing] = useState<PairedSession | null>(null);
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<{ deviceId: string; deviceName: string } | null>(null);

  const loadPairing = useCallback(async () => {
    const p = await getStoredPairing();
    const s = await getStoredStaff();
    const dev = await getDeviceIdentifier();
    setPairing(p);
    setStaff(s);
    setDeviceInfo(dev);
  }, []);

  useEffect(() => {
    loadPairing();

    const unsub = socketService.onPairingUpdate(() => {
      loadPairing();
    });

    return () => unsub();
  }, [loadPairing]);

  const handlePair = async () => {
    const clean = pairingCode.trim().toUpperCase();
    if (clean.length < 6) {
      Alert.alert("Invalid Code", "Please enter the complete 6-character pairing code.");
      return;
    }

    setLoading(true);
    try {
      const res = await pairWithPortal(clean);
      if (res.success && res.pairing) {
        setPairing(res.pairing);
        setPairingCode("");
        Alert.alert("Success", `Device paired to ${res.pairing.branch} branch portal!`);
        // Connect socket
        socketService.connect().catch(() => {});
      } else {
        Alert.alert("Pairing Failed", res.error || "Invalid or expired pairing code.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to pair device.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnpair = async () => {
    Alert.alert(
      "Unpair Device?",
      "This will disconnect wireless transfers from the branch portal.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unpair",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await unpairDevice();
              setPairing(null);
              Alert.alert("Unpaired", "Device disconnected from portal.");
            } catch {
              Alert.alert("Error", "Failed to unpair.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Info */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="cellphone-link" size={32} color="#102A43" />
        </View>
        <Text style={styles.title}>Portal Device Pairing</Text>
        <Text style={styles.subtitle}>
          Securely link this phone with your branch desktop session to receive card URLs wirelessly.
        </Text>
      </View>

      {/* Paired Status Card */}
      {pairing ? (
        <View style={styles.pairedCard}>
          <View style={styles.pairedHeader}>
            <View style={styles.checkCircle}>
              <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.pairedTitle}>Device Connected</Text>
              <Text style={styles.pairedBranch}>{pairing.branch} Branch Session</Text>
            </View>
          </View>

          <View style={styles.pairedDetails}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Device Name</Text>
              <Text style={styles.detailVal}>{pairing.deviceName}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Device ID</Text>
              <Text style={[styles.detailVal, styles.mono]}>{pairing.deviceId}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Paired At</Text>
              <Text style={styles.detailVal}>
                {new Date(pairing.pairedAt).toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={styles.instructionBanner}>
            <MaterialCommunityIcons name="information-outline" size={16} color="#059669" />
            <Text style={styles.instructionText}>
              On the website, click "Transfer to NFC Writer" on any card to send it here.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.unpairBtn}
            onPress={handleUnpair}
            disabled={loading}
          >
            <MaterialCommunityIcons name="link-off" size={18} color="#DC2626" />
            <Text style={styles.unpairBtnText}>Disconnect / Unpair Phone</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Not Paired: Input Form */
        <View style={styles.unpairedCard}>
          <Text style={styles.formTitle}>Enter Pairing Code</Text>
          <Text style={styles.formDesc}>
            Type the 6-character code displayed in the portal modal:
          </Text>

          {/* 6-character input */}
          <View style={styles.codeInputContainer}>
            <TextInput
              style={styles.codeInput}
              placeholder="e.g. 7X3M9A"
              placeholderTextColor="#94A3B8"
              value={pairingCode}
              onChangeText={(t) => setPairingCode(t.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.pairBtn, (loading || pairingCode.length < 6) && styles.pairBtnDisabled]}
            onPress={handlePair}
            disabled={loading || pairingCode.length < 6}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.btnRow}>
                <MaterialCommunityIcons name="link-variant" size={20} color="#FFFFFF" />
                <Text style={styles.pairBtnText}>Connect & Pair Device</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Step by step guide */}
          <View style={styles.stepsBox}>
            <Text style={styles.stepsTitle}>How to get a Pairing Code:</Text>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>1</Text>
              <Text style={styles.stepText}>Log in to the SANASA Insurance website on your computer.</Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>2</Text>
              <Text style={styles.stepText}>Go to Branch Office Staff &gt; Third Party &gt; Optional NFC Cards.</Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>3</Text>
              <Text style={styles.stepText}>Click the button labeled "Pair NFC Writer Phone".</Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>4</Text>
              <Text style={styles.stepText}>Enter the generated code into this phone and tap Connect.</Text>
            </View>
          </View>
        </View>
      )}

      {/* Hardware Diagnostics Pill */}
      {deviceInfo && (
        <View style={styles.diagPill}>
          <MaterialCommunityIcons name="cellphone-cog" size={14} color="#64748B" />
          <Text style={styles.diagText}>
            Phone: {deviceInfo.deviceName} ({deviceInfo.deviceId})
          </Text>
        </View>
      )}
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
  header: {
    alignItems: "center",
    marginBottom: 20
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#102A43",
    marginBottom: 4
  },
  subtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16
  },
  pairedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "#10B981",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  pairedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16
  },
  checkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center"
  },
  pairedTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#059669"
  },
  pairedBranch: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600"
  },
  pairedDetails: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 14
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  detailLabel: {
    fontSize: 11,
    color: "#64748B"
  },
  detailVal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E293B"
  },
  mono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
  },
  instructionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 16
  },
  instructionText: {
    fontSize: 11,
    color: "#065F46",
    flex: 1,
    lineHeight: 16
  },
  unpairBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    height: 42,
    gap: 6
  },
  unpairBtnText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700"
  },
  unpairedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#102A43",
    marginBottom: 4
  },
  formDesc: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 16
  },
  codeInputContainer: {
    marginBottom: 16
  },
  codeInput: {
    height: 56,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    fontSize: 26,
    fontWeight: "800",
    color: "#102A43",
    textAlign: "center",
    letterSpacing: 6,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
  },
  pairBtn: {
    backgroundColor: "#102A43",
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20
  },
  pairBtnDisabled: {
    opacity: 0.5
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  pairBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  stepsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8
  },
  stepsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 2
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#102A43",
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18
  },
  stepText: {
    fontSize: 11,
    color: "#64748B",
    flex: 1,
    lineHeight: 16
  },
  diagPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    gap: 6
  },
  diagText: {
    fontSize: 11,
    color: "#64748B"
  }
});
