import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Device from "expo-device";
import {
  getStoredStaff,
  StaffUser
} from "../src/services/storageService";
import { logoutStaff } from "../src/services/authService";
import { getServerUrl, setCustomServerUrl, resetServerUrl } from "../src/config/api";
import { socketService } from "../src/services/socketService";

export default function SettingsScreen() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [serverUrl, setServerUrl] = useState<string>("");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const s = await getStoredStaff();
      setStaff(s);
      const url = await getServerUrl();
      setServerUrl(url);
      setCustomUrl(url);
    }
    load();
  }, []);

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
        Alert.alert("Connection Success", `Connected to: ${data.service || "SANASA API"}\nStatus: ${data.status}`);
      } else {
        Alert.alert("Connection Error", "Server responded with an unexpected status.");
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
      // Reconnect socket
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
    Alert.alert("Reset", `Server URL reset to default: ${def}`);
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
      {/* Staff Account Info */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="account-circle" size={24} color="#102A43" />
          <Text style={styles.cardTitle}>Staff Account</Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoVal}>{staff?.name || "Staff Member"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoVal}>{staff?.email || "N/A"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Assigned Branch:</Text>
            <Text style={[styles.infoVal, styles.branchBadge]}>{staff?.branch || "Galle"} Branch</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role Scope:</Text>
            <Text style={styles.infoVal}>{staff?.role || "office_staff"}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={16} color="#DC2626" />
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Server & Network Configuration */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="server-network" size={24} color="#102A43" />
          <Text style={styles.cardTitle}>Backend Server Configuration</Text>
        </View>
        <Text style={styles.descText}>
          Configure the SANASA API server endpoint. Useful when testing on physical devices across local Wi-Fi.
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
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={styles.serverBtnRow}>
          <TouchableOpacity
            style={styles.testBtn}
            onPress={handleTestConnection}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator size="small" color="#102A43" />
            ) : (
              <Text style={styles.testBtnText}>Test Ping</Text>
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

      {/* App & Build Details */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="information-outline" size={22} color="#102A43" />
          <Text style={styles.cardTitle}>About SANASA NFC Writer</Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Application:</Text>
            <Text style={styles.infoVal}>SANASA NFC Writer for Android</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version:</Text>
            <Text style={styles.infoVal}>1.0.0 (Production Release)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Device Model:</Text>
            <Text style={styles.infoVal}>
              {Device.brand} {Device.modelName}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>NFC Framework:</Text>
            <Text style={styles.infoVal}>react-native-nfc-manager</Text>
          </View>
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#102A43"
  },
  descText: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
    marginBottom: 14
  },
  infoGrid: {
    gap: 8,
    marginBottom: 14
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748B"
  },
  infoVal: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E293B"
  },
  branchBadge: {
    color: "#059669",
    fontWeight: "700"
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    height: 40,
    gap: 6
  },
  logoutBtnText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700"
  },
  inputGroup: {
    marginBottom: 12
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 4
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: "#1E293B",
    backgroundColor: "#F8FAFC"
  },
  serverBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10
  },
  testBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#102A43"
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#102A43",
    borderRadius: 10,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  resetBtn: {
    alignItems: "center",
    paddingVertical: 6
  },
  resetBtnText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600"
  }
});
