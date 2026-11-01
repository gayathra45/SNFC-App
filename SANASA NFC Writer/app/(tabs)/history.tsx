import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Platform
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Device from "expo-device";
import {
  getWriteHistory,
  clearWriteHistory,
  getStoredStaff,
  getStoredPairing,
  WriteHistoryItem,
  StaffUser,
  PairedSession
} from "../../src/services/storageService";
import { nfcService, NfcDiagnosticStatus } from "../../src/services/nfcService";
import { getServerUrl } from "../../src/config/api";

export default function HistoryScreen() {
  const [history, setHistory] = useState<WriteHistoryItem[]>([]);
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [pairing, setPairing] = useState<PairedSession | null>(null);
  const [nfcDiag, setNfcDiag] = useState<NfcDiagnosticStatus | null>(null);
  const [serverUrl, setServerUrl] = useState<string>("");
  const [filter, setFilter] = useState<"All" | "Success" | "Failed" | "Sync Pending">("All");

  const loadAll = useCallback(async () => {
    const hist = await getWriteHistory();
    const st = await getStoredStaff();
    const pr = await getStoredPairing();
    const diag = await nfcService.checkDiagnosticStatus();
    const url = await getServerUrl();

    setHistory(hist);
    setStaff(st);
    setPairing(pr);
    setNfcDiag(diag);
    setServerUrl(url);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleClearHistory = () => {
    Alert.alert(
      "Clear History?",
      "This will remove the local record of past writes from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearWriteHistory();
            setHistory([]);
          }
        }
      ]
    );
  };

  const handleExportDiagnostics = async () => {
    const report = [
      "========================================",
      "SANASA NFC WRITER - SYSTEM DIAGNOSTICS",
      `Timestamp: ${new Date().toISOString()}`,
      `App Version: 1.0.0`,
      `Branch: ${staff?.branch || "Unknown"}`,
      `Staff Member: ${staff?.name || "Unknown"}`,
      `Backend Server: ${serverUrl}`,
      "----------------------------------------",
      "HARDWARE & ENVIRONMENT:",
      `Device: ${Device.brand} ${Device.modelName} (Android ${Platform.Version})`,
      `NFC Hardware Supported: ${nfcDiag?.supported ? "YES" : "NO"}`,
      `NFC Enabled: ${nfcDiag?.enabled ? "YES" : "NO"}`,
      `Paired Portal: ${pairing ? `${pairing.branch} (ID: ${pairing.pairingId})` : "None"}`,
      "----------------------------------------",
      `TOTAL RECORDED WRITES: ${history.length}`,
      ...history.slice(0, 20).map((h, i) => {
        return `[${i + 1}] Card: ${h.cardId} | Status: ${h.status} | Time: ${h.timestamp} | Tag UID: ${h.tagUid || "N/A"} | URL: ${h.maskedUrlPreview || "[REDACTED]"}`;
      }),
      "========================================"
    ].join("\n");

    try {
      await Share.share({
        title: "SANASA NFC Writer Diagnostics",
        message: report
      });
    } catch {
      // safe fallback
    }
  };

  const filteredHistory = history.filter((item) => {
    if (filter === "All") return true;
    return item.status === filter;
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Diagnostics Card */}
      <View style={styles.diagCard}>
        <View style={styles.diagHeader}>
          <MaterialCommunityIcons name="chip" size={20} color="#102A43" />
          <Text style={styles.diagTitle}>NFC & Hardware Diagnostics</Text>
        </View>

        <View style={styles.diagGrid}>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Device Model:</Text>
            <Text style={styles.diagVal}>
              {Device.brand} {Device.modelName}
            </Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>NFC Hardware:</Text>
            <Text style={[styles.diagVal, nfcDiag?.supported ? styles.textGreen : styles.textRed]}>
              {nfcDiag?.supported ? "Available" : "Not Detected"}
            </Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>NFC Power State:</Text>
            <Text style={[styles.diagVal, nfcDiag?.enabled ? styles.textGreen : styles.textAmber]}>
              {nfcDiag?.enabled ? "Active / Enabled" : "Disabled"}
            </Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Branch Isolation:</Text>
            <Text style={styles.diagVal}>{staff?.branch || "Not Set"} Branch</Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Backend Host:</Text>
            <Text style={[styles.diagVal, styles.mono]}>{serverUrl}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.exportBtn} onPress={handleExportDiagnostics}>
          <MaterialCommunityIcons name="file-export-outline" size={16} color="#102A43" />
          <Text style={styles.exportBtnText}>Export Sanitized Diagnostics</Text>
        </TouchableOpacity>
      </View>

      {/* History Filter Bar */}
      <View style={styles.historySection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Write History ({history.length})</Text>
          {history.length > 0 && (
            <TouchableOpacity onPress={handleClearHistory}>
              <Text style={styles.clearText}>Clear Log</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterPills}>
          {(["All", "Success", "Sync Pending", "Failed"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.pill, filter === tab && styles.pillActive]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[styles.pillText, filter === tab && styles.pillTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredHistory.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="history" size={32} color="#CBD5E1" />
            <Text style={styles.emptyText}>No write events recorded yet.</Text>
            <Text style={styles.emptySubtext}>
              Completed physical card write events will be logged here.
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {filteredHistory.map((item) => (
              <View key={item.id} style={styles.cardItem}>
                <View style={styles.cardItemHeader}>
                  <View style={styles.cardIdWrap}>
                    <MaterialCommunityIcons
                      name={
                        item.status === "Success"
                          ? "check-circle"
                          : item.status === "Sync Pending"
                          ? "cloud-sync"
                          : "alert-circle"
                      }
                      size={18}
                      color={
                        item.status === "Success"
                          ? "#059669"
                          : item.status === "Sync Pending"
                          ? "#D97706"
                          : "#DC2626"
                      }
                    />
                    <Text style={styles.cardItemTitle}>{item.cardId}</Text>
                  </View>

                  <Text
                    style={[
                      styles.statusTag,
                      item.status === "Success"
                        ? styles.tagSuccess
                        : item.status === "Sync Pending"
                        ? styles.tagPending
                        : styles.tagFailed
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>

                {item.maskedUrlPreview ? (
                  <Text style={styles.cardUrlText} numberOfLines={1}>
                    {item.maskedUrlPreview}
                  </Text>
                ) : null}

                <View style={styles.cardMetaRow}>
                  <Text style={styles.metaText}>
                    {new Date(item.timestamp).toLocaleDateString()} at{" "}
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  {item.tagUid ? <Text style={styles.metaText}>UID: {item.tagUid}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}
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
  diagCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  diagHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12
  },
  diagTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#102A43"
  },
  diagGrid: {
    gap: 8,
    marginBottom: 14
  },
  diagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  diagLabel: {
    fontSize: 11,
    color: "#64748B"
  },
  diagVal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E293B"
  },
  mono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 10
  },
  textGreen: {
    color: "#059669"
  },
  textRed: {
    color: "#DC2626"
  },
  textAmber: {
    color: "#D97706"
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    height: 38,
    gap: 6
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#102A43"
  },
  historySection: {},
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#102A43"
  },
  clearText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600"
  },
  filterPills: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  pillActive: {
    backgroundColor: "#102A43",
    borderColor: "#102A43"
  },
  pillText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600"
  },
  pillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 6
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B"
  },
  emptySubtext: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center"
  },
  listWrap: {
    gap: 8
  },
  cardItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  cardItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  cardIdWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  cardItemTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E293B"
  },
  statusTag: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  tagSuccess: {
    backgroundColor: "#ECFDF5",
    color: "#059669"
  },
  tagPending: {
    backgroundColor: "#FEF3C7",
    color: "#D97706"
  },
  tagFailed: {
    backgroundColor: "#FEE2E2",
    color: "#DC2626"
  },
  cardUrlText: {
    fontSize: 10,
    color: "#64748B",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 6
  },
  cardMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  metaText: {
    fontSize: 10,
    color: "#94A3B8"
  }
});
