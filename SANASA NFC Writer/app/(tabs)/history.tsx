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
import { LinearGradient } from "expo-linear-gradient";
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
      "SANASA NFC WRITER - SYSTEM AUDIT LOG",
      `Timestamp: ${new Date().toISOString()}`,
      `Branch: ${staff?.branch || "Unknown"}`,
      `Staff Member: ${staff?.name || "Unknown"}`,
      `Backend Server: ${serverUrl}`,
      "----------------------------------------",
      "HARDWARE & ENVIRONMENT:",
      `Device: ${Device.brand} ${Device.modelName} (Android ${Platform.Version})`,
      `NFC Hardware: ${nfcDiag?.supported ? "SUPPORTED" : "UNAVAILABLE"}`,
      `NFC Active: ${nfcDiag?.enabled ? "YES" : "NO"}`,
      `Paired Portal: ${pairing ? `${pairing.branch} (${pairing.pairingId})` : "None"}`,
      "----------------------------------------",
      `TOTAL RECORDED WRITES: ${history.length}`,
      ...history.slice(0, 30).map((h, i) => {
        return `[${i + 1}] Card: ${h.cardId} | Status: ${h.status} | Tag UID: ${h.tagUid || "N/A"} | Verified: ${h.readBackVerified ? "YES" : "NO"} | Time: ${h.timestamp}`;
      }),
      "========================================"
    ].join("\n");

    try {
      await Share.share({
        title: "SANASA NFC Writer Audit Diagnostics",
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
          <MaterialCommunityIcons name="chip" size={20} color="#38BDF8" />
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

        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExportDiagnostics}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="file-export-outline" size={16} color="#38BDF8" />
          <Text style={styles.exportBtnText}>Export Sanitized Audit Log</Text>
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
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, filter === tab && styles.pillTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredHistory.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="history" size={32} color="#64748B" />
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
                          ? "#10B981"
                          : item.status === "Sync Pending"
                          ? "#F59E0B"
                          : "#EF4444"
                      }
                    />
                    <Text style={styles.cardIdText}>{item.cardId}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      item.status === "Success"
                        ? styles.statusBadgeSuccess
                        : item.status === "Sync Pending"
                        ? styles.statusBadgeSync
                        : styles.statusBadgeFailed
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        item.status === "Success"
                          ? styles.statusBadgeTextSuccess
                          : item.status === "Sync Pending"
                          ? styles.statusBadgeTextSync
                          : styles.statusBadgeTextFailed
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardItemBody}>
                  {item.tagUid ? (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Tag UID:</Text>
                      <Text style={[styles.metaVal, styles.mono]}>{item.tagUid}</Text>
                    </View>
                  ) : null}
                  {item.orderNumber ? (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Order #:</Text>
                      <Text style={styles.metaVal}>{item.orderNumber}</Text>
                    </View>
                  ) : null}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Timestamp:</Text>
                    <Text style={styles.metaVal}>
                      {new Date(item.timestamp).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Verified:</Text>
                    <Text style={[styles.metaVal, item.readBackVerified ? styles.textGreen : styles.textAmber]}>
                      {item.readBackVerified ? "Read-Back Confirmed (100%)" : "Unverified"}
                    </Text>
                  </View>
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
    backgroundColor: "#070D1E"
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  diagCard: {
    backgroundColor: "#0E172E",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 16
  },
  diagHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12
  },
  diagTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#F8FAFC"
  },
  diagGrid: {
    backgroundColor: "#162244",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 12
  },
  diagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  diagLabel: {
    fontSize: 11,
    color: "#94A3B8"
  },
  diagVal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E2E8F0"
  },
  mono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 10
  },
  textGreen: {
    color: "#10B981"
  },
  textAmber: {
    color: "#F59E0B"
  },
  textRed: {
    color: "#EF4444"
  },
  exportBtn: {
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
  exportBtnText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "700"
  },

  // History Section
  historySection: {
    gap: 12
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F8FAFC"
  },
  clearText: {
    fontSize: 11.5,
    color: "#EF4444",
    fontWeight: "700"
  },
  filterPills: {
    flexDirection: "row",
    gap: 8
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#0E172E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  pillActive: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "#38BDF8"
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B"
  },
  pillTextActive: {
    color: "#38BDF8"
  },

  // Empty Box
  emptyBox: {
    backgroundColor: "#0E172E",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)"
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E2E8F0"
  },
  emptySubtext: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center"
  },

  // Card Item
  listWrap: {
    gap: 10
  },
  cardItem: {
    backgroundColor: "#0E172E",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 10
  },
  cardItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  cardIdWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  cardIdText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: 0.3
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  statusBadgeSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.15)"
  },
  statusBadgeSync: {
    backgroundColor: "rgba(245, 158, 11, 0.15)"
  },
  statusBadgeFailed: {
    backgroundColor: "rgba(239, 68, 68, 0.15)"
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800"
  },
  statusBadgeTextSuccess: {
    color: "#10B981"
  },
  statusBadgeTextSync: {
    color: "#F59E0B"
  },
  statusBadgeTextFailed: {
    color: "#EF4444"
  },
  cardItemBody: {
    backgroundColor: "#162244",
    borderRadius: 10,
    padding: 10,
    gap: 6
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  metaLabel: {
    fontSize: 10.5,
    color: "#94A3B8"
  },
  metaVal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E2E8F0"
  }
});
