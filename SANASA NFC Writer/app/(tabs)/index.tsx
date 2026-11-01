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
import { notificationService } from "../../src/services/notificationService";

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
      notificationService.addNotification(
        "New Card Job Transferred",
        `Card ${job.cardId} received for ${job.policyHolderName || "Claim Order"}.`,
        job.cardId,
        job
      );
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

  const completedCount = history.filter((h) => h.status === "Success").length;
  const failedCount = history.filter((h) => h.status === "Failed").length;
  const pendingSyncCount = pendingSyncs.length;
  const pendingQueueCount = activeTransfer ? 1 : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" colors={["#2563EB"]} />}
    >
      {/* Branch & Staff Profile Header Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileLeft}>
          <View style={styles.branchTag}>
            <MaterialCommunityIcons name="shield-check" size={13} color="#2563EB" />
            <Text style={styles.branchTagText}>{staff?.branch || "Galle"} Branch</Text>
          </View>
          <Text style={styles.staffName}>{staff?.name || "Branch Staff Member"}</Text>
          <Text style={styles.staffEmail}>{staff?.email || "Branch Office Portal"}</Text>
        </View>

        <View style={styles.profileRight}>
          <View style={[styles.statusPill, socketConnected ? styles.statusPillLive : styles.statusPillOffline]}>
            <View style={[styles.statusDot, socketConnected ? styles.dotGreen : styles.dotAmber]} />
            <Text style={[styles.statusText, socketConnected ? styles.statusTextLive : styles.statusTextOffline]}>
              {socketConnected ? "Live Gateway" : "Reconnecting"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.pairingMiniBadge}
            onPress={() => router.push("/(tabs)/pairing")}
          >
            <MaterialCommunityIcons
              name={pairing ? "cellphone-check" : "cellphone-link"}
              size={12}
              color={pairing ? "#059669" : "#D97706"}
            />
            <Text style={[styles.pairingMiniText, { color: pairing ? "#059669" : "#D97706" }]}>
              {pairing ? "Device Paired" : "Unpaired"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Sync Alert if any pending */}
      {pendingSyncs.length > 0 && (
        <View style={styles.syncAlertCard}>
          <View style={styles.syncAlertLeft}>
            <View style={styles.syncAlertIconBox}>
              <MaterialCommunityIcons name="cloud-alert" size={20} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.syncAlertTitle}>
                {pendingSyncs.length} Card{pendingSyncs.length > 1 ? "s" : ""} Awaiting Cloud Sync
              </Text>
              <Text style={styles.syncAlertDesc}>
                Physical writes completed offline. Ready to sync.
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

      {/* Metrics Grid: 4 Core Counters */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: "#ECFDF5" }]}>
            <MaterialCommunityIcons name="check-decagram" size={18} color="#059669" />
          </View>
          <Text style={styles.metricVal}>{completedCount}</Text>
          <Text style={styles.metricLbl}>Completed</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: "#EFF6FF" }]}>
            <MaterialCommunityIcons name="tray-full" size={18} color="#2563EB" />
          </View>
          <Text style={styles.metricVal}>{pendingQueueCount}</Text>
          <Text style={styles.metricLbl}>Pending Queue</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: "#FFFBEB" }]}>
            <MaterialCommunityIcons name="cloud-sync-outline" size={18} color="#D97706" />
          </View>
          <Text style={styles.metricVal}>{pendingSyncCount}</Text>
          <Text style={styles.metricLbl}>Verify Pending</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: "#FEF2F2" }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#DC2626" />
          </View>
          <Text style={styles.metricVal}>{failedCount}</Text>
          <Text style={styles.metricLbl}>Failed Cards</Text>
        </View>
      </View>

      {/* Incoming Wireless Card Transfer Card */}
      {activeTransfer ? (
        <View style={styles.transferCard}>
          <View style={styles.transferHeader}>
            <View style={styles.transferIconBox}>
              <MaterialCommunityIcons name="credit-card-wireless" size={22} color="#2563EB" />
            </View>
            <View style={styles.transferTitleWrap}>
              <View style={styles.badgeRow}>
                <Text style={styles.transferBadge}>INCOMING WIRELESS JOB</Text>
                <View style={styles.livePulseDot} />
              </View>
              <Text style={styles.transferCardId}>{activeTransfer.cardId}</Text>
            </View>
          </View>

          <View style={styles.transferDetails}>
            <View style={styles.transferRow}>
              <Text style={styles.transferLabel}>Order Number:</Text>
              <Text style={styles.detailBold}>{activeTransfer.orderNumber}</Text>
            </View>
            {activeTransfer.policyHolderName ? (
              <View style={styles.transferRow}>
                <Text style={styles.transferLabel}>Policyholder:</Text>
                <Text style={styles.detailBold}>{activeTransfer.policyHolderName}</Text>
              </View>
            ) : null}
            <View style={styles.transferRow}>
              <Text style={styles.transferLabel}>Authorized URL:</Text>
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
              colors={["#2563EB", "#1D4ED8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.writeNowGradient}
            >
              <MaterialCommunityIcons name="nfc" size={20} color="#FFFFFF" />
              <Text style={styles.writeNowBtnText}>Hold Card to Phone & Write</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Quick Operations Menu */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>NFC Card Provisioning Workflows</Text>

        <View style={styles.actionList}>
          {/* Option 1: Receive from Website */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push({ pathname: "/(tabs)/writer", params: { mode: "website" } })}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#EFF6FF" }]}>
              <MaterialCommunityIcons name="cellphone-link" size={22} color="#2563EB" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Receive from Website</Text>
              <Text style={styles.actionDesc}>Pick up wireless card jobs sent from desktop portal</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          {/* Option 2: Enter URL Manually */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push({ pathname: "/(tabs)/writer", params: { mode: "manual" } })}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#ECFDF5" }]}>
              <MaterialCommunityIcons name="link-plus" size={22} color="#059669" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Enter URL Manually</Text>
              <Text style={styles.actionDesc}>Directly paste or type verified driver access URL</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          {/* Option 3: Desktop Terminal Pairing */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/(tabs)/pairing")}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#FFFBEB" }]}>
              <MaterialCommunityIcons name="qrcode-scan" size={22} color="#D97706" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Desktop Terminal Pairing</Text>
              <Text style={styles.actionDesc}>Pair phone with desktop staff portal via PIN</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          {/* Option 4: Audit History */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/(tabs)/history")}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#F5F3FF" }]}>
              <MaterialCommunityIcons name="history" size={22} color="#7C3AED" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Audit History & Logs</Text>
              <Text style={styles.actionDesc}>Review previous writes and tag verifications</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
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
                    size={20}
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
    backgroundColor: "#F8FAFC"
  },
  content: {
    padding: 16,
    paddingBottom: 36
  },
  // Profile Card
  profileCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  profileLeft: {
    flex: 1
  },
  profileRight: {
    alignItems: "flex-end",
    gap: 6
  },
  pairingMiniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  pairingMiniText: {
    fontSize: 10,
    fontWeight: "700"
  },
  branchTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 6
  },
  branchTagText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#2563EB"
  },
  staffName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F2942"
  },
  staffEmail: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12
  },
  statusPillLive: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0"
  },
  statusPillOffline: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A"
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
    fontSize: 11,
    fontWeight: "700"
  },
  statusTextLive: {
    color: "#059669"
  },
  statusTextOffline: {
    color: "#D97706"
  },

  // Sync Alert
  syncAlertCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
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
  syncAlertIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center"
  },
  syncAlertTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#92400E"
  },
  syncAlertDesc: {
    fontSize: 10.5,
    color: "#B45309",
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

  // Metrics Grid
  metricsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  metricVal: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F2942"
  },
  metricLbl: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2
  },

  // Incoming Wireless Transfer Card
  transferCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3
  },
  transferHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12
  },
  transferIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EFF6FF",
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
    color: "#2563EB",
    letterSpacing: 0.5
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2563EB"
  },
  transferCardId: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F2942",
    letterSpacing: 0.3,
    marginTop: 2
  },
  transferDetails: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  transferRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  transferLabel: {
    fontSize: 11,
    color: "#64748B"
  },
  detailBold: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#1E293B"
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
    fontSize: 13.5,
    fontWeight: "800"
  },

  // Section Card
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F2942",
    marginBottom: 12
  },
  actionList: {
    gap: 10
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  actionInfo: {
    flex: 1
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F2942"
  },
  actionDesc: {
    fontSize: 11,
    color: "#64748B",
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
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  historyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  historyCardId: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F2942"
  },
  historyTime: {
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 2
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  historyBadgeSuccess: {
    backgroundColor: "#ECFDF5"
  },
  historyBadgeFail: {
    backgroundColor: "#FEF2F2"
  },
  historyBadgeText: {
    fontSize: 10.5,
    fontWeight: "700"
  },
  historyBadgeTextSuccess: {
    color: "#059669"
  },
  historyBadgeTextFail: {
    color: "#DC2626"
  }
});
