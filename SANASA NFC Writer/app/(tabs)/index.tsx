import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  getStoredStaff,
  getStoredPairing,
  getWriteHistory,
  getPendingSyncs,
  StaffUser,
  PairedSession,
  WriteHistoryItem,
  PendingSyncItem,
  maskUrlToken
} from "../../src/services/storageService";
import { socketService, TransferJobPayload } from "../../src/services/socketService";
import { getServerUrl } from "../../src/config/api";
import { flushPendingSyncs } from "../../src/services/syncService";

export default function DashboardScreen() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [pairing, setPairing] = useState<PairedSession | null>(null);
  const [history, setHistory] = useState<WriteHistoryItem[]>([]);
  const [pendingSyncs, setPendingSyncs] = useState<PendingSyncItem[]>([]);
  const [activeTransfer, setActiveTransfer] = useState<TransferJobPayload | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingOffline, setSyncingOffline] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const storedStaff = await getStoredStaff();
      const storedPairing = await getStoredPairing();
      const writeHist = await getWriteHistory();
      const pend = await getPendingSyncs();

      setStaff(storedStaff);
      setPairing(storedPairing);
      setHistory(writeHist);
      setPendingSyncs(pend);

      // Fetch pending queue from server
      if (storedStaff?.branch) {
        const baseUrl = await getServerUrl();
        const res = await fetch(`${baseUrl}/api/nfc-card/writer/pending-jobs?branch=${encodeURIComponent(storedStaff.branch)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.jobs && data.jobs.length > 0) {
            setActiveTransfer(data.jobs[0]);
          }
        }
      }
    } catch {
      // safe fallback
    }
  }, []);

  useEffect(() => {
    loadData();

    // Socket.IO listeners
    const unsubConn = socketService.onConnectionChange((connected) => {
      setSocketConnected(connected);
    });

    const unsubJob = socketService.onTransferJob((job) => {
      setActiveTransfer(job);
    });

    const unsubPair = socketService.onPairingUpdate(() => {
      loadData();
    });

    return () => {
      unsubConn();
      unsubJob();
      unsubPair();
    };
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleFlushPending = async () => {
    setSyncingOffline(true);
    try {
      const res = await flushPendingSyncs();
      Alert.alert(
        "Sync Complete",
        `Synchronized ${res.successCount} cards successfully.${res.failCount > 0 ? ` (${res.failCount} failed)` : ""}`
      );
      await loadData();
    } catch (err: any) {
      Alert.alert("Sync Error", err.message || "Failed to sync pending items.");
    } finally {
      setSyncingOffline(false);
    }
  };

  const verifiedTodayCount = history.filter((h) => {
    const today = new Date().toDateString();
    return h.status === "Success" && new Date(h.timestamp).toDateString() === today;
  }).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#102A43"]} />}
    >
      {/* Branch & Staff Profile Banner */}
      <View style={styles.profileBanner}>
        <View>
          <View style={styles.branchTag}>
            <MaterialCommunityIcons name="office-building" size={13} color="#FFFFFF" />
            <Text style={styles.branchTagText}>{staff?.branch || "Branch Office"} Branch</Text>
          </View>
          <Text style={styles.staffName}>{staff?.name || "Branch Staff Member"}</Text>
          <Text style={styles.staffEmail}>{staff?.email || "Branch Office Portal"}</Text>
        </View>

        <View style={styles.statusPill}>
          <View style={[styles.statusDot, socketConnected ? styles.dotGreen : styles.dotAmber]} />
          <Text style={styles.statusText}>{socketConnected ? "Live Connected" : "Reconnecting"}</Text>
        </View>
      </View>

      {/* Offline Sync Alert if any pending */}
      {pendingSyncs.length > 0 && (
        <View style={styles.syncAlertCard}>
          <View style={styles.syncAlertLeft}>
            <MaterialCommunityIcons name="cloud-alert" size={24} color="#D97706" />
            <View>
              <Text style={styles.syncAlertTitle}>
                {pendingSyncs.length} Card{pendingSyncs.length > 1 ? "s" : ""} Awaiting Server Sync
              </Text>
              <Text style={styles.syncAlertDesc}>
                Physical NFC write succeeded while offline.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.syncAlertBtn}
            onPress={handleFlushPending}
            disabled={syncingOffline}
          >
            <Text style={styles.syncAlertBtnText}>
              {syncingOffline ? "Syncing..." : "Sync Now"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Incoming Wireless Card Transfer Card */}
      {activeTransfer ? (
        <View style={styles.transferCard}>
          <View style={styles.transferHeader}>
            <View style={styles.transferIconBox}>
              <MaterialCommunityIcons name="nfc-variant" size={24} color="#059669" />
            </View>
            <View style={styles.transferTitleWrap}>
              <Text style={styles.transferBadge}>NEW TRANSFER RECEIVED</Text>
              <Text style={styles.transferCardId}>{activeTransfer.cardId}</Text>
            </View>
          </View>

          <View style={styles.transferDetails}>
            <Text style={styles.transferDetailRow}>
              Request: <Text style={styles.detailBold}>{activeTransfer.orderNumber}</Text>
            </Text>
            {activeTransfer.policyHolderName ? (
              <Text style={styles.transferDetailRow}>
                Policyholder: <Text style={styles.detailBold}>{activeTransfer.policyHolderName}</Text>
              </Text>
            ) : null}
            <Text style={styles.transferDetailRow}>
              Payload: <Text style={styles.detailMono}>{maskUrlToken(activeTransfer.cardUrl)}</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={styles.writeNowBtn}
            onPress={() => {
              // Navigate to writer tab with this card parameters
              router.push({
                pathname: "/(tabs)/writer",
                params: {
                  jobId: activeTransfer.jobId,
                  cardId: activeTransfer.cardId,
                  orderId: activeTransfer.orderId,
                  orderNumber: activeTransfer.orderNumber,
                  cardUrl: activeTransfer.cardUrl,
                  policyHolderName: activeTransfer.policyHolderName
                }
              });
            }}
          >
            <MaterialCommunityIcons name="credit-card-wireless" size={20} color="#FFFFFF" />
            <Text style={styles.writeNowBtnText}>Hold Card to Phone & Write</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Metrics Row */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: "#ECFDF5" }]}>
            <MaterialCommunityIcons name="check-decagram" size={20} color="#059669" />
          </View>
          <Text style={styles.metricVal}>{verifiedTodayCount}</Text>
          <Text style={styles.metricLbl}>Verified Today</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: "#EFF6FF" }]}>
            <MaterialCommunityIcons name="tray-full" size={20} color="#2563EB" />
          </View>
          <Text style={styles.metricVal}>{activeTransfer ? 1 : 0}</Text>
          <Text style={styles.metricLbl}>Pending Queue</Text>
        </View>

        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => router.push("/(tabs)/pairing")}
        >
          <View style={[styles.metricIconWrap, { backgroundColor: pairing ? "#ECFDF5" : "#FEF3C7" }]}>
            <MaterialCommunityIcons
              name={pairing ? "cellphone-check" : "cellphone-link"}
              size={20}
              color={pairing ? "#059669" : "#D97706"}
            />
          </View>
          <Text style={[styles.metricVal, { fontSize: 13, marginTop: 4 }]}>
            {pairing ? "Paired" : "Unpaired"}
          </Text>
          <Text style={styles.metricLbl}>Portal Pairing</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Quick Operations</Text>

        <View style={styles.actionList}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/(tabs)/writer")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#EEF2FF" }]}>
              <MaterialCommunityIcons name="nfc" size={20} color="#4F46E5" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Write NFC Card</Text>
              <Text style={styles.actionDesc}>Hold physical NDEF card against antenna to write</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/(tabs)/pairing")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#F0FDF4" }]}>
              <MaterialCommunityIcons name="cellphone-link" size={20} color="#16A34A" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Device Pairing</Text>
              <Text style={styles.actionDesc}>Pair phone with desktop website via 6-digit code</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/(tabs)/history")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#F8FAFC" }]}>
              <MaterialCommunityIcons name="history" size={20} color="#475569" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Audit History & Diagnostics</Text>
              <Text style={styles.actionDesc}>Review previous writes and NFC tag read-backs</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      {history.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recent Card Writes</Text>
          <View style={styles.historyList}>
            {history.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <MaterialCommunityIcons
                    name={item.status === "Success" ? "check-circle" : "alert-circle"}
                    size={18}
                    color={item.status === "Success" ? "#059669" : "#DC2626"}
                  />
                  <View>
                    <Text style={styles.historyCardId}>{item.cardId}</Text>
                    <Text style={styles.historyTime}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {item.tagUid ? ` • UID: ${item.tagUid}` : ""}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.historyBadge,
                    item.status === "Success" ? styles.badgeSuccess : styles.badgeFailed
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            ))}
          </View>
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
    paddingBottom: 32
  },
  profileBanner: {
    backgroundColor: "#102A43",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16
  },
  branchTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 6,
    gap: 4
  },
  branchTagText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700"
  },
  staffName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  },
  staffEmail: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  dotGreen: {
    backgroundColor: "#10B981"
  },
  dotAmber: {
    backgroundColor: "#F59E0B"
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600"
  },
  syncAlertCard: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  syncAlertLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  syncAlertTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E"
  },
  syncAlertDesc: {
    fontSize: 10,
    color: "#B45309"
  },
  syncAlertBtn: {
    backgroundColor: "#D97706",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  syncAlertBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700"
  },
  transferCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#10B981",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4
  },
  transferHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12
  },
  transferIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center"
  },
  transferTitleWrap: {
    flex: 1
  },
  transferBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.5
  },
  transferCardId: {
    fontSize: 16,
    fontWeight: "800",
    color: "#102A43"
  },
  transferDetails: {
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 4
  },
  transferDetailRow: {
    fontSize: 11,
    color: "#64748B"
  },
  detailBold: {
    fontWeight: "700",
    color: "#1E293B"
  },
  detailMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 10,
    color: "#334155"
  },
  writeNowBtn: {
    backgroundColor: "#059669",
    borderRadius: 12,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  writeNowBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6
  },
  metricVal: {
    fontSize: 17,
    fontWeight: "800",
    color: "#102A43"
  },
  metricLbl: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600"
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#102A43",
    marginBottom: 12
  },
  actionList: {
    gap: 10
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  actionInfo: {
    flex: 1
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B"
  },
  actionDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1
  },
  historyList: {
    gap: 10
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  historyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  historyCardId: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B"
  },
  historyTime: {
    fontSize: 10,
    color: "#94A3B8"
  },
  historyBadge: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  badgeSuccess: {
    backgroundColor: "#ECFDF5",
    color: "#059669"
  },
  badgeFailed: {
    backgroundColor: "#FEE2E2",
    color: "#DC2626"
  }
});
