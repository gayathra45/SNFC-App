import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  notificationService,
  AppNotificationItem
} from "../src/services/notificationService";
import { t } from "../src/services/i18nService";
import SanasaAppHeader from "../src/components/SanasaAppHeader";

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    const list = await notificationService.getNotifications();
    setNotifications(list);
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
    const unsub = notificationService.onChange(() => {
      loadNotifications();
    });
    return unsub;
  }, []);

  const handleMarkAllRead = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    await notificationService.markAllAsRead();
  };

  const handleClearAll = () => {
    Alert.alert(
      t("clearNotifications"),
      "Are you sure you want to remove all notification history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {}
            await notificationService.clearAll();
          }
        }
      ]
    );
  };

  const handleTapNotification = async (item: AppNotificationItem) => {
    await notificationService.markAsRead(item.id);

    // If notification has card information, open writer screen
    if (item.data?.cardId && item.data?.cardUrl) {
      router.push({
        pathname: "/(tabs)/writer",
        params: {
          cardId: item.data.cardId,
          cardUrl: item.data.cardUrl,
          orderId: item.data.orderId || "",
          orderNumber: item.data.orderNumber || "",
          jobId: item.data.jobId || "",
          policyHolderName: item.data.policyHolderName || ""
        }
      });
    }
  };

  const renderItem = ({ item }: { item: AppNotificationItem }) => {
    const dateFormatted = new Date(item.timestamp).toLocaleString("en-LK", {
      timeZone: "Asia/Colombo",
      dateStyle: "short",
      timeStyle: "short"
    });

    return (
      <TouchableOpacity
        style={[styles.itemCard, !item.read ? styles.itemUnread : null]}
        onPress={() => handleTapNotification(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemHeader}>
          <View style={styles.itemLeft}>
            <View
              style={[
                styles.iconBadge,
                item.relatedCardId ? styles.iconBadgeCard : styles.iconBadgeGeneral
              ]}
            >
              <MaterialCommunityIcons
                name={item.relatedCardId ? "nfc" : "bell-outline"}
                size={16}
                color={item.relatedCardId ? "#2563EB" : "#059669"}
              />
            </View>
            <Text style={[styles.itemTitle, !item.read && styles.itemTitleUnread]}>
              {item.title}
            </Text>
          </View>
          {!item.read && <View style={styles.unreadDot} />}
        </View>

        <Text style={styles.itemBody}>{item.body}</Text>

        <View style={styles.itemFooter}>
          <Text style={styles.itemTime}>{dateFormatted}</Text>
          {item.relatedCardId && (
            <View style={styles.cardTag}>
              <Text style={styles.cardTagText}>{item.relatedCardId}</Text>
              <MaterialCommunityIcons name="arrow-right" size={12} color="#10B981" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.container}>
      <SanasaAppHeader
        title="Notifications"
        subtitle="Staff Alerts & NFC Job Queue"
        showBack={true}
        onBackPress={() => router.back()}
        statusBadge={{
          text: unreadCount > 0 ? `${unreadCount} Unread` : "All Caught Up",
          color: unreadCount > 0 ? "#FF9800" : "#10B981"
        }}
        rightAction={
          notifications.length > 0 ? (
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={handleClearAll}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null
        }
        overlappingContent={
          <View style={styles.headerOverlapCard}>
            <Text style={styles.topBarCount}>
              {notifications.length} {notifications.length === 1 ? "Notification" : "Notifications"}
            </Text>
            {unreadCount > 0 && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleMarkAllRead}>
                <MaterialCommunityIcons name="check-all" size={16} color="#10B981" />
                <Text style={styles.actionBtnText}>{t("markAllRead")}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="bell-off-outline" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>{t("noNotifications")}</Text>
              <Text style={styles.emptySub}>
                Website transfer events, staff alerts, and NFC operation statuses will appear here.
              </Text>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC"
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
  headerOverlapCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
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
  topBarCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B"
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10B981"
  },
  listContent: {
    padding: 16,
    paddingTop: 14,
    gap: 12
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0D2A3A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  itemUnread: {
    borderColor: "rgba(16, 185, 129, 0.4)",
    backgroundColor: "rgba(16, 185, 129, 0.03)"
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  iconBadgeCard: {
    backgroundColor: "rgba(16, 185, 129, 0.12)"
  },
  iconBadgeGeneral: {
    backgroundColor: "rgba(13, 42, 58, 0.08)"
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    flex: 1
  },
  itemTitleUnread: {
    fontWeight: "bold",
    color: "#0F172A"
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF9800"
  },
  itemBody: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
    marginBottom: 10
  },
  itemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9"
  },
  itemTime: {
    fontSize: 11,
    color: "#94A3B8"
  },
  cardTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(13, 42, 58, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  cardTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0D2A3A",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 6
  },
  emptySub: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18
  }
});
