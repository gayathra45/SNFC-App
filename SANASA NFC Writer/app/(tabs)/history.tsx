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
import SanasaAppHeader from "../../src/components/SanasaAppHeader";

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
    <View style={styles.container}>
      <SanasaAppHeader
        title="Audit & History"
        subtitle="Hardware Write & Verification Logs"
        statusBadge={{ text: `${history.length} Logs`, color: "#10B981" }}
        rightAction={
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={handleExportDiagnostics}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="file-export-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        }
        overlappingContent={
          <View style={styles.headerOverlapFilterCard}>
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
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Diagnostics Card */}
        <View style={styles.diagCard}>
          <View style={styles.diagHeader}>
            <View style={styles.diagIconBox}>
              <MaterialCommunityIcons name="chip" size={18} color="#10B981" />
            </View>
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
            <MaterialCommunityIcons name="share-variant-outline" size={16} color="#0D2A3A" />
            <Text style={styles.exportBtnText}>Share Sanitized Audit Log</Text>
          </TouchableOpacity>
        </View>

        {/* History List */}
        <View style={styles.historySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recorded Card Writes ({filteredHistory.length})</Text>
            {history.length > 0 && (
              <TouchableOpacity onPress={handleClearHistory}>
                <Text style={styles.clearText}>Clear Log</Text>
              </TouchableOpacity>
            )}
          </View>

        {filteredHistory.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="history" size={32} color="#94A3B8" />
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
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)"
  },
  headerOverlapFilterCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 5,
    shadowColor: "#0D2A3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6
  },
  diagCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    shadowColor: "#0D2A3A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  diagHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12
  },
  diagIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  diagTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F2942"
  },
  diagGrid: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6"
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
  textAmber: {
    color: "#D97706"
  },
  textRed: {
    color: "#DC2626"
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(13, 42, 58, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(13, 42, 58, 0.15)",
    paddingVertical: 11,
    borderRadius: 12
  },
  exportBtnText: {
    color: "#0D2A3A",
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
    alignItems: "center",
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F2942"
  },
  clearText: {
    fontSize: 11.5,
    color: "#DC2626",
    fontWeight: "700"
  },
  pill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center"
  },
  pillActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "#10B981"
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B"
  },
  pillTextActive: {
    color: "#065F46",
    fontWeight: "800"
  },

  // Empty Box
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
  },
  emptySubtext: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center"
  },

  // Card Item
  listWrap: {
    gap: 10
  },
  cardItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
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
    color: "#0F2942",
    letterSpacing: 0.3
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  statusBadgeSuccess: {
    backgroundColor: "#ECFDF5"
  },
  statusBadgeSync: {
    backgroundColor: "#FFFBEB"
  },
  statusBadgeFailed: {
    backgroundColor: "#FEF2F2"
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800"
  },
  statusBadgeTextSuccess: {
    color: "#059669"
  },
  statusBadgeTextSync: {
    color: "#D97706"
  },
  statusBadgeTextFailed: {
    color: "#DC2626"
  },
  cardItemBody: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  metaLabel: {
    fontSize: 10.5,
    color: "#64748B"
  },
  metaVal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155"
  }
});
