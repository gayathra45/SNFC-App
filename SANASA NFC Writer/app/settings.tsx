import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  getStoredStaff,
  getStoredPairing,
  getPendingSyncs,
  getStoredSettings,
  storeSettings,
  StaffUser,
  PairedSession,
  PendingSyncItem,
  WriterSettings
} from "../src/services/storageService";
import { logoutStaff } from "../src/services/authService";
import { getServerUrl, setCustomServerUrl, resetServerUrl } from "../src/config/api";
import { socketService } from "../src/services/socketService";
import { nfcService } from "../src/services/nfcService";
import { flushPendingSyncs } from "../src/services/syncService";

export default function SettingsScreen() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [pairing, setPairing] = useState<PairedSession | null>(null);
  const [pendingSyncs, setPendingSyncs] = useState<PendingSyncItem[]>([]);
  const [serverUrl, setServerUrl] = useState<string>("");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flushing, setFlushing] = useState(false);

  // Settings
  const [settings, setSettings] = useState<WriterSettings>({
    lockTagAfterWrite: false,
    strictReadBackVerify: true,
    overwriteProtection: true,
    hapticFeedback: true,
    soundChimes: true,
    antennaTimeoutSeconds: 30
  });

  useEffect(() => {
    async function load() {
      const s = await getStoredStaff();
      setStaff(s);
      const p = await getStoredPairing();
      setPairing(p);
      const pend = await getPendingSyncs();
      setPendingSyncs(pend);
      const url = await getServerUrl();
      setServerUrl(url);
      setCustomUrl(url);
      const sett = await getStoredSettings();
      setSettings(sett);
    }
    load();
  }, []);

  const handleUpdateSetting = async (key: keyof WriterSettings, value: any) => {
    if (key === "lockTagAfterWrite" && value === true) {
      Alert.alert(
        "Permanent Tag Lock Warning",
        "Enabling this permanently locks physical NTAG chips to read-only after writing. Locked cards can NEVER be rewritten or repurposed. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Enable Lock Mode",
            style: "destructive",
            onPress: async () => {
              const updated = await storeSettings({ [key]: value });
              setSettings(updated);
            }
          }
        ]
      );
      return;
    }

    try {
      if (settings.hapticFeedback) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}

    const updated = await storeSettings({ [key]: value });
    setSettings(updated);
  };

  const handleTestConnection = async () => {
    if (!customUrl.trim()) return;
    setTesting(true);
    try {
      const clean = customUrl.trim().replace(/\/+$/, "");
      const res = await fetch(`${clean}/api/health`, {
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (res.ok && data.status) {
        Alert.alert("Connection Success", `Connected to SANASA API: ${clean}\nService: ${data.service || "Online"}`);
      } else {
        Alert.alert("Connection Alert", "Server responded with an unexpected status.");
      }
    } catch (err: any) {
      Alert.alert("Connection Failed", `Could not reach ${customUrl}:\n${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveServerUrl = async () => {
    if (!customUrl.trim()) return;
    setSaving(true);
    try {
      await setCustomServerUrl(customUrl);
      setServerUrl(customUrl.trim().replace(/\/+$/, ""));
      socketService.disconnect();
      socketService.connect().catch(() => {});
      Alert.alert("Saved", "Server configuration updated successfully.");
    } catch {
      Alert.alert("Error", "Failed to save server URL.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetServerUrl = async () => {
    const def = await resetServerUrl();
    setServerUrl(def);
    setCustomUrl(def);
    socketService.disconnect();
    socketService.connect().catch(() => {});
    Alert.alert("Reset", `Server URL reset to system default: ${def}`);
  };

  const handleFlushPending = async () => {
    setFlushing(true);
    try {
      const res = await flushPendingSyncs();
      const updatedPend = await getPendingSyncs();
      setPendingSyncs(updatedPend);
      Alert.alert("Sync Complete", `Successfully synced ${res.successCount} card(s) with the backend database.`);
    } catch (err: any) {
      Alert.alert("Sync Error", err.message || "Failed to flush sync queue.");
    } finally {
      setFlushing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out?", "Are you sure you want to log out of the NFC Writer?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logoutStaff();
          socketService.disconnect();
          router.replace("/(auth)/login");
        }
      }
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Staff Account Header Card */}
      <View style={styles.card}>
        <View style={styles.accountHeaderRow}>
          <LinearGradient
            colors={["#2563EB", "#06B6D4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarWrap}
          >
            <MaterialCommunityIcons name="account" size={26} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.accountMeta}>
            <Text style={styles.accountName}>{staff?.name || "Staff Member"}</Text>
            <Text style={styles.accountEmail}>{staff?.email || "staff@sanasa.lk"}</Text>
          </View>
          <View style={styles.branchBadge}>
            <Text style={styles.branchBadgeText}>{staff?.branch || "Galle"} Branch</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <MaterialCommunityIcons name="logout" size={16} color="#EF4444" />
          <Text style={styles.logoutBtnText}>Sign Out of Device</Text>
        </TouchableOpacity>
      </View>

      {/* NFC Tag Safety & Engineering Settings */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="shield-lock-outline" size={20} color="#38BDF8" />
          <Text style={styles.cardTitle}>NFC Tag Safety & Engineering</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Hardware write controls and read-back verification policies.
        </Text>

        <View style={styles.settingRow}>
          <View style={styles.settingTextWrap}>
            <Text style={styles.settingTitle}>Strict Read-Back Verification</Text>
            <Text style={styles.settingSubtitle}>
              Re-reads physical card sectors to confirm URI matches before completing.
            </Text>
          </View>
          <Switch
            value={settings.strictReadBackVerify}
            onValueChange={(val) => handleUpdateSetting("strictReadBackVerify", val)}
            thumbColor={settings.strictReadBackVerify ? "#38BDF8" : "#64748B"}
            trackColor={{ false: "#1E293B", true: "rgba(56, 189, 248, 0.4)" }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingTextWrap}>
            <Text style={styles.settingTitle}>Tag Overwrite Protection</Text>
            <Text style={styles.settingSubtitle}>
              Warns operator before writing if the tag already contains existing data.
            </Text>
          </View>
          <Switch
            value={settings.overwriteProtection}
            onValueChange={(val) => handleUpdateSetting("overwriteProtection", val)}
            thumbColor={settings.overwriteProtection ? "#38BDF8" : "#64748B"}
            trackColor={{ false: "#1E293B", true: "rgba(56, 189, 248, 0.4)" }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingTextWrap}>
            <Text style={[styles.settingTitle, settings.lockTagAfterWrite && { color: "#EF4444" }]}>
              Permanent Tag Lock (Make Read-Only)
            </Text>
            <Text style={styles.settingSubtitle}>
              Permanently write-locks the physical card so it can never be rewritten.
            </Text>
          </View>
          <Switch
            value={settings.lockTagAfterWrite}
            onValueChange={(val) => handleUpdateSetting("lockTagAfterWrite", val)}
            thumbColor={settings.lockTagAfterWrite ? "#EF4444" : "#64748B"}
            trackColor={{ false: "#1E293B", true: "rgba(239, 68, 68, 0.4)" }}
          />
        </View>
      </View>

      {/* Audio & Haptic Feedback */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="vibrate" size={20} color="#38BDF8" />
          <Text style={styles.cardTitle}>Audio & Haptics</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingTextWrap}>
            <Text style={styles.settingTitle}>Haptic Touch Vibrations</Text>
            <Text style={styles.settingSubtitle}>
              Tactile vibrations on tag detection, writing, and successful verification.
            </Text>
          </View>
          <Switch
            value={settings.hapticFeedback}
            onValueChange={(val) => handleUpdateSetting("hapticFeedback", val)}
            thumbColor={settings.hapticFeedback ? "#38BDF8" : "#64748B"}
            trackColor={{ false: "#1E293B", true: "rgba(56, 189, 248, 0.4)" }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingTextWrap}>
            <Text style={styles.settingTitle}>Sound Chimes</Text>
            <Text style={styles.settingSubtitle}>
              Auditory cues when operations succeed or encounter hardware errors.
            </Text>
          </View>
          <Switch
            value={settings.soundChimes}
            onValueChange={(val) => handleUpdateSetting("soundChimes", val)}
            thumbColor={settings.soundChimes ? "#38BDF8" : "#64748B"}
            trackColor={{ false: "#1E293B", true: "rgba(56, 189, 248, 0.4)" }}
          />
        </View>
      </View>

      {/* Desktop Terminal Pairing */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="cellphone-link" size={20} color="#38BDF8" />
          <Text style={styles.cardTitle}>Paired Desktop Terminal</Text>
        </View>

        {pairing ? (
          <View style={styles.pairingBox}>
            <View style={styles.pairingRow}>
              <Text style={styles.pairingLabel}>Terminal Name:</Text>
              <Text style={styles.pairingVal}>{pairing.deviceName || "Desktop Portal"}</Text>
            </View>
            <View style={styles.pairingRow}>
              <Text style={styles.pairingLabel}>Branch Link:</Text>
              <Text style={styles.pairingVal}>{pairing.branch || "Galle"} Branch</Text>
            </View>
            <View style={styles.pairingRow}>
              <Text style={styles.pairingLabel}>Paired At:</Text>
              <Text style={styles.pairingVal}>{new Date(pairing.pairedAt).toLocaleTimeString()}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.unpairedBox}>
            <MaterialCommunityIcons name="link-off" size={24} color="#64748B" />
            <Text style={styles.unpairedText}>No desktop terminal currently linked.</Text>
            <TouchableOpacity
              style={styles.pairNowBtn}
              onPress={() => router.push("/(tabs)/pairing")}
            >
              <Text style={styles.pairNowBtnText}>Pair Terminal with 6-Digit Code</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Backend API Configuration */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="server-network" size={20} color="#38BDF8" />
          <Text style={styles.cardTitle}>Backend Server Configuration</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Set API endpoint IP when testing across physical Wi-Fi.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Server Base URL</Text>
          <TextInput
            style={styles.input}
            value={customUrl}
            onChangeText={setCustomUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="http://192.168.x.x:5000"
            placeholderTextColor="#64748B"
          />
        </View>

        <View style={styles.serverBtnRow}>
          <TouchableOpacity
            style={styles.testBtn}
            onPress={handleTestConnection}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator size="small" color="#38BDF8" />
            ) : (
              <>
                <MaterialCommunityIcons name="wifi-check" size={16} color="#38BDF8" />
                <Text style={styles.testBtnText}>Test Ping</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveServerUrl}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>Save URL</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.resetBtn} onPress={handleResetServerUrl}>
          <Text style={styles.resetBtnText}>Reset to System Default</Text>
        </TouchableOpacity>
      </View>

      {/* Offline Storage Queue */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="database-sync" size={20} color="#38BDF8" />
          <Text style={styles.cardTitle}>Offline Sync & Local Queue</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Cards written during network disconnects are queued safely in local encrypted storage.
        </Text>

        <View style={styles.offlineRow}>
          <View>
            <Text style={styles.offlineCount}>{pendingSyncs.length}</Text>
            <Text style={styles.offlineLabel}>Pending Cloud Syncs</Text>
          </View>
          <TouchableOpacity
            style={[styles.flushBtn, pendingSyncs.length === 0 && { opacity: 0.5 }]}
            onPress={handleFlushPending}
            disabled={flushing || pendingSyncs.length === 0}
          >
            {flushing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="cloud-upload" size={16} color="#FFFFFF" />
                <Text style={styles.flushBtnText}>Sync Now</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
    paddingBottom: 40
  },
  card: {
    backgroundColor: "#0E172E",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F8FAFC"
  },
  sectionDesc: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 12,
    lineHeight: 16
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginVertical: 12
  },

  // Account
  accountHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  accountMeta: {
    flex: 1
  },
  accountName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F8FAFC"
  },
  accountEmail: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2
  },
  branchBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  branchBadgeText: {
    color: "#38BDF8",
    fontSize: 10,
    fontWeight: "700"
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)"
  },
  logoutBtnText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700"
  },

  // Settings Rows
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  settingTextWrap: {
    flex: 1
  },
  settingTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#E2E8F0"
  },
  settingSubtitle: {
    fontSize: 10.5,
    color: "#94A3B8",
    marginTop: 2,
    lineHeight: 14
  },

  // Pairing
  pairingBox: {
    backgroundColor: "#162244",
    borderRadius: 12,
    padding: 12,
    gap: 6
  },
  pairingRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  pairingLabel: {
    fontSize: 11,
    color: "#94A3B8"
  },
  pairingVal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E2E8F0"
  },
  unpairedBox: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8
  },
  unpairedText: {
    fontSize: 12,
    color: "#94A3B8"
  },
  pairNowBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)"
  },
  pairNowBtnText: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "700"
  },

  // Server
  inputGroup: {
    marginBottom: 12
  },
  inputLabel: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 6
  },
  input: {
    backgroundColor: "#162244",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F8FAFC",
    fontSize: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  serverBtnRow: {
    flexDirection: "row",
    gap: 10
  },
  testBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    paddingVertical: 10,
    borderRadius: 10
  },
  testBtnText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "700"
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  resetBtn: {
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 6
  },
  resetBtnText: {
    color: "#64748B",
    fontSize: 11
  },

  // Offline
  offlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#162244",
    padding: 14,
    borderRadius: 12
  },
  offlineCount: {
    fontSize: 22,
    fontWeight: "800",
    color: "#38BDF8"
  },
  offlineLabel: {
    fontSize: 11,
    color: "#94A3B8"
  },
  flushBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10
  },
  flushBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  }
});
