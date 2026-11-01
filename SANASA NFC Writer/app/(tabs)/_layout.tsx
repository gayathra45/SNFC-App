import React, { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TouchableOpacity, StyleSheet, View, Platform, Text } from "react-native";
import { notificationService } from "../../src/services/notificationService";

export default function TabsLayout() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    notificationService.getUnreadCount().then(setUnreadCount);
    const unsub = notificationService.onChange(() => {
      notificationService.getUnreadCount().then(setUnreadCount);
    });
    return unsub;
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: "#FFFFFF",
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: "#EEF2F6"
        },
        headerTintColor: "#0F2942",
        headerTitleStyle: {
          fontWeight: "800",
          fontSize: 18,
          color: "#0F2942",
          letterSpacing: -0.3
        },
        headerRight: () => (
          <View style={styles.headerRightRow}>
            {/* Notification Bell with Badge */}
            <TouchableOpacity
              onPress={() => router.push("/notifications")}
              style={styles.headerBtn}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="bell-outline" size={20} color="#334155" />
                {unreadCount > 0 && (
                  <View style={styles.badgeWrap}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Settings */}
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              style={styles.headerBtn}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="cog-outline" size={20} color="#475569" />
              </View>
            </TouchableOpacity>
          </View>
        ),
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#EEF2F6",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingBottom: Platform.OS === "ios" ? 22 : 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: "#64748B",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.06,
          shadowRadius: 8
        },
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: 2
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "S NFC Writer",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              <MaterialCommunityIcons
                name={focused ? "view-dashboard" : "view-dashboard-outline"}
                size={22}
                color={focused ? "#2563EB" : String(color || "#94A3B8")}
              />
            </View>
          )
        }}
      />
      <Tabs.Screen
        name="pairing"
        options={{
          title: "Terminal Pairing",
          tabBarLabel: "Pairing",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              <MaterialCommunityIcons
                name={focused ? "cellphone-link" : "cellphone-link"}
                size={22}
                color={focused ? "#2563EB" : String(color || "#94A3B8")}
              />
            </View>
          )
        }}
      />
      <Tabs.Screen
        name="writer"
        options={{
          title: "NFC Writer",
          tabBarLabel: "Write Card",
          tabBarIcon: ({ focused }) => (
            <View
              style={[
                styles.writerIconWrap,
                focused ? styles.writerIconWrapActive : styles.writerIconWrapInactive
              ]}
            >
              <MaterialCommunityIcons
                name="nfc"
                size={22}
                color={focused ? "#FFFFFF" : "#2563EB"}
              />
            </View>
          )
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Audit History",
          tabBarLabel: "History",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              <MaterialCommunityIcons
                name={focused ? "history" : "history"}
                size={22}
                color={focused ? "#2563EB" : String(color || "#94A3B8")}
              />
            </View>
          )
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 14
  },
  headerBtn: {
    padding: 2
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    position: "relative"
  },
  badgeWrap: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: "#DC2626",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF"
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "bold"
  },
  tabIconWrap: {
    width: 38,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14
  },
  tabIconWrapActive: {
    backgroundColor: "rgba(37, 99, 235, 0.08)"
  },
  writerIconWrap: {
    width: 38,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  writerIconWrapActive: {
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  writerIconWrapInactive: {
    backgroundColor: "rgba(37, 99, 235, 0.1)"
  }
});
