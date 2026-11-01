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
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  getStoredPairing,
  getStoredStaff,
  PairedSession,
  StaffUser
} from "../../src/services/storageService";
import { pairWithPortal, unpairDevice, getDeviceIdentifier } from "../../src/services/pairingService";
import { socketService } from "../../src/services/socketService";
import SanasaAppHeader from "../../src/components/SanasaAppHeader";

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

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setLoading(true);
    try {
      const res = await pairWithPortal(clean);
      if (res.success && res.pairing) {
        setPairing(res.pairing);
        setPairingCode("");
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        Alert.alert("Success", `Device paired to ${res.pairing.branch} branch portal!`);
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
      "This will disconnect wireless card transfers from the branch desktop portal.",
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
    <View style={styles.container}>
      <SanasaAppHeader
        title="Terminal Pairing"
        subtitle="Desktop Web Portal Connection"
        statusBadge={
          pairing
            ? { text: "Paired", color: "#10B981" }
            : { text: "Disconnected", color: "#FF9800" }
        }
        overlappingContent={
          <View style={styles.headerOverlapCard}>
            <View style={styles.overlapStatusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: pairing ? "#10B981" : "#FF9800" }
                ]}
              />
              <Text style={styles.overlapStatusText}>
                {pairing
                  ? `${pairing.branch} Branch Terminal Linked`
                  : "Awaiting 6-Digit Pairing PIN"}
              </Text>
            </View>
            <Text style={styles.overlapSubText}>
              {pairing
                ? "Ready to receive card requests wirelessly"
                : "Connect to receive NFC write transfers from desktop"}
            </Text>
          </View>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Paired Status Card */}
        {pairing ? (
          <View style={styles.pairedCard}>
            <View style={styles.pairedHeader}>
              <View style={styles.checkCircle}>
                <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.pairedTitle}>Terminal Connected</Text>
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
            <MaterialCommunityIcons name="information" size={16} color="#10B981" />
            <Text style={styles.instructionText}>
              On the website, click "Transfer to NFC Writer" on any card to send it directly to this phone.
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
          <Text style={styles.formTitle}>Enter 6-Digit Pairing PIN</Text>
          <Text style={styles.formDesc}>
            Type the code shown on the desktop portal screen:
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
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                loading || pairingCode.length < 6
                  ? ["#CBD5E1", "#94A3B8"]
                  : ["#059669", "#10B981"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.pairGradientContent}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="link-variant" size={20} color="#FFFFFF" />
                  <Text style={styles.pairBtnText}>Connect & Pair Device</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Step by step guide */}
          <View style={styles.stepsBox}>
            <Text style={styles.stepsTitle}>How to get a Pairing Code:</Text>
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
              <Text style={styles.stepText}>Log in to SANASA Insurance portal on desktop PC.</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
              <Text style={styles.stepText}>Navigate to Branch Office Staff &gt; Third Party &gt; Optional NFC Cards.</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
              <Text style={styles.stepText}>Click the button labeled "Pair NFC Writer Phone".</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>4</Text></View>
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
            Device: {deviceInfo.deviceName} ({deviceInfo.deviceId})
          </Text>
        </View>
      )}
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
    paddingTop: 14,
    paddingBottom: 40
  },
  headerOverlapCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#0D2A3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  overlapStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  overlapStatusText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F2942"
  },
  overlapSubText: {
    fontSize: 11,
    color: "#64748B",
    marginLeft: 16
  },
  header: {
    alignItems: "center",
    marginBottom: 20
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DBEAFE"
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F2942",
    marginBottom: 6
  },
  subtitle: {
    fontSize: 11.5,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 16
  },

  // Paired Card
  pairedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginBottom: 16,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  pairedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16
  },
  checkCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center"
  },
  pairedTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F2942"
  },
  pairedBranch: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "700"
  },
  pairedDetails: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF2F6"
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
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 10
  },
  instructionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    marginBottom: 14
  },
  instructionText: {
    flex: 1,
    fontSize: 11,
    color: "#065F46",
    lineHeight: 16
  },
  unpairBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA"
  },
  unpairBtnText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "700"
  },

  // Unpaired Form
  unpairedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    marginBottom: 16,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  formTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F2942",
    marginBottom: 4
  },
  formDesc: {
    fontSize: 11.5,
    color: "#64748B",
    marginBottom: 16
  },
  codeInputContainer: {
    marginBottom: 16
  },
  codeInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    height: 56,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "900",
    color: "#0F2942",
    letterSpacing: 8,
    borderWidth: 1.5,
    borderColor: "#BFDBFE"
  },
  pairBtn: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20
  },
  pairGradientContent: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  pairBtnDisabled: {
    opacity: 0.5
  },
  pairBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800"
  },
  stepsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  stepsTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#0F2942",
    marginBottom: 4
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(13, 42, 58, 0.08)",
    alignItems: "center",
    justifyContent: "center"
  },
  stepBadgeText: {
    color: "#0D2A3A",
    fontSize: 10,
    fontWeight: "800"
  },
  stepText: {
    flex: 1,
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16
  },
  diagPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8
  },
  diagText: {
    fontSize: 10.5,
    color: "#94A3B8"
  }
});
