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
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
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
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" colors={["#38BDF8"]} />}
    >
      {/* Branch & Staff Profile Header Card */}
      <View style={styles.profileBanner}>
        <View style={styles.profileLeft}>
          <View style={styles.branchTag}>
            <MaterialCommunityIcons name="shield-check" size={13} color="#38BDF8" />
            <Text style={styles.branchTagText}>{staff?.branch || "Galle"} Branch</Text>
          </View>
          <Text style={styles.staffName}>{staff?.name || "Branch Staff Member"}</Text>
          <Text style={styles.staffEmail}>{staff?.email || "Branch Office Portal"}</Text>
        </View>

        <View style={[styles.statusPill, socketConnected ? styles.statusPillLive : styles.statusPillOffline]}>
          <View style={[styles.statusDot, socketConnected ? styles.dotGreen : styles.dotAmber]} />
          <Text style={[styles.statusText, socketConnected ? styles.statusTextLive : styles.statusTextOffline]}>
            {socketConnected ? "Live Gateway" : "Reconnecting"}
          </Text>
        </View>
      </View>

      {/* Offline Sync Alert if any pending */}
      {pendingSyncs.length > 0 && (
        <View style={styles.syncAlertCard}>
          <View style={styles.syncAlertLeft}>
            <MaterialCommunityIcons name="cloud-alert" size={24} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.syncAlertTitle}>
                {pendingSyncs.length} Card{pendingSyncs.length > 1 ? "s" : ""} Awaiting Server Sync
              </Text>
              <Text style={styles.syncAlertDesc}>
                Physical NFC writes completed offline. Sync when ready.
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
            <LinearGradient
              colors={["#059669", "#10B981"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.transferIconBox}
            >
              <MaterialCommunityIcons name="nfc" size={24} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.transferTitleWrap}>
              <View style={styles.badgeRow}>
                <Text style={styles.transferBadge}>INCOMING TRANSFER</Text>
                <View style={styles.livePulseDot} />
              </View>
              <Text style={styles.transferCardId}>{activeTransfer.cardId}</Text>
            </View>
          </View>

          <View style={styles.transferDetails}>
            <View style={styles.transferRow}>
              <Text style={styles.transferLabel}>Order:</Text>
              <Text style={styles.detailBold}>{activeTransfer.orderNumber}</Text>
            </View>
            {activeTransfer.policyHolderName ? (
              <View style={styles.transferRow}>
                <Text style={styles.transferLabel}>Policyholder:</Text>
                <Text style={styles.detailBold}>{activeTransfer.policyHolderName}</Text>
              </View>
            ) : null}
            <View style={styles.transferRow}>
              <Text style={styles.transferLabel}>Payload:</Text>
              <Text style={styles.detailMono}>{maskUrlToken(activeTransfer.cardUrl)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.writeNowBtn}
            activeOpacity={0.8}
            onPress={() => {
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
            <LinearGradient
              colors={["#2563EB", "#06B6D4"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.writeNowGradient}
            >
              <MaterialCommunityIcons name="credit-card-wireless" size={20} color="#FFFFFF" />
              <Text style={styles.writeNowBtnText}>Hold Card to Phone & Write</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Metrics Row */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
            <MaterialCommunityIcons name="check-decagram" size={20} color="#10B981" />
          </View>
          <Text style={styles.metricVal}>{verifiedTodayCount}</Text>
          <Text style={styles.metricLbl}>Verified Today</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
            <MaterialCommunityIcons name="tray-full" size={20} color="#38BDF8" />
          </View>
          <Text style={styles.metricVal}>{activeTransfer ? 1 : 0}</Text>
          <Text style={styles.metricLbl}>Pending Queue</Text>
        </View>

        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => router.push("/(tabs)/pairing")}
          activeOpacity={0.7}
        >
          <View style={[styles.metricIconWrap, { backgroundColor: pairing ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)" }]}>
            <MaterialCommunityIcons
              name={pairing ? "cellphone-check" : "cellphone-link"}
              size={20}
              color={pairing ? "#10B981" : "#F59E0B"}
            />
          </View>
          <Text style={[styles.metricVal, { fontSize: 13, marginTop: 4, color: pairing ? "#10B981" : "#F59E0B" }]}>
            {pairing ? "Paired" : "Unpaired"}
          </Text>
          <Text style={styles.metricLbl}>Portal Pairing</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Operations Menu */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Quick Operations</Text>

        <View style={styles.actionList}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/(tabs)/writer")}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
              <MaterialCommunityIcons name="nfc" size={20} color="#38BDF8" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Write Physical NFC Card</Text>
              <Text style={styles.actionDesc}>Hold NTAG213/215/216 card against phone antenna</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/(tabs)/pairing")}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <MaterialCommunityIcons name="cellphone-link" size={20} color="#10B981" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Desktop Terminal Pairing</Text>
              <Text style={styles.actionDesc}>Sync phone with desktop website via 6-digit PIN</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/(tabs)/history")}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "rgba(148, 163, 184, 0.15)" }]}>
              <MaterialCommunityIcons name="history" size={20} color="#94A3B8" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Audit History & Logs</Text>
              <Text style={styles.actionDesc}>Review previous writes and tag read-back verifications</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#64748B" />
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
                    color={item.status === "Success" ? "#10B981" : "#EF4444"}
                  />
                  <View>
                    <Text style={styles.historyCardId}>{item.cardId}</Text>
                    <Text style={styles.historyTime}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {item.tagUid ? ` • UID: ${item.tagUid}` : ""}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.historyBadge,
                    item.status === "Success"
                      ? styles.historyBadgeSuccess
                      : styles.historyBadgeFail
                  ]}
                >
                  <Text
                    style={[
                      styles.historyBadgeText,
                      item.status === "Success"
                        ? styles.historyBadgeTextSuccess
                        : styles.historyBadgeTextFail
                    ]}
                  >
                    {item.status === "Success" ? "Verified" : "Failed"}
                  </Text>
                </View>
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
    backgroundColor: "#070D1E"
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  // Profile Banner
  profileBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0E172E",
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  profileLeft: {
    flex: 1
  },
  branchTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 6
  },
  branchTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#38BDF8"
  },
  staffName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#F8FAFC"
  },
  staffEmail: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12
  },
  statusPillLive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)"
  },
  statusPillOffline: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)"
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
    fontSize: 10.5,
    fontWeight: "700"
  },
  statusTextLive: {
    color: "#10B981"
  },
  statusTextOffline: {
    color: "#F59E0B"
  },

  // Sync Alert
  syncAlertCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    gap: 12
  },
  syncAlertLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  syncAlertTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#F59E0B"
  },
  syncAlertDesc: {
    fontSize: 10.5,
    color: "#FCD34D",
    marginTop: 2
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

  // Incoming Transfer Card
  transferCard: {
    backgroundColor: "#0E172E",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#38BDF8",
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
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
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  transferTitleWrap: {
    flex: 1
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  transferBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#38BDF8",
    letterSpacing: 0.5
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#38BDF8"
  },
  transferCardId: {
    fontSize: 15,
    fontWeight: "900",
    color: "#F8FAFC",
    letterSpacing: 0.3,
    marginTop: 2
  },
  transferDetails: {
    backgroundColor: "#162244",
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 12
  },
  transferRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  transferLabel: {
    fontSize: 11,
    color: "#94A3B8"
  },
  detailBold: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#E2E8F0"
  },
  detailMono: {
    fontSize: 10,
    color: "#64748B",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    maxWidth: 200
  },
  writeNowBtn: {
    borderRadius: 12,
    overflow: "hidden"
  },
  writeNowGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46
  },
  writeNowBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800"
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#0E172E",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  metricVal: {
    fontSize: 20,
    fontWeight: "900",
    color: "#F8FAFC"
  },
  metricLbl: {
    fontSize: 10.5,
    color: "#94A3B8",
    marginTop: 2
  },

  // Section Card
  sectionCard: {
    backgroundColor: "#0E172E",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#F8FAFC",
    marginBottom: 12
  },
  actionList: {
    gap: 10
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#162244",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)"
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  actionInfo: {
    flex: 1
  },
  actionTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#E2E8F0"
  },
  actionDesc: {
    fontSize: 10.5,
    color: "#94A3B8",
    marginTop: 2
  },

  // History List
  historyList: {
    gap: 8
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#162244",
    padding: 10,
    borderRadius: 10
  },
  historyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  historyCardId: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F8FAFC"
  },
  historyTime: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  historyBadgeSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.15)"
  },
  historyBadgeFail: {
    backgroundColor: "rgba(239, 68, 68, 0.15)"
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: "700"
  },
  historyBadgeTextSuccess: {
    color: "#10B981"
  },
  historyBadgeTextFail: {
    color: "#EF4444"
  }
});
