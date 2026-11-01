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
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E2E8F0",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingBottom: Platform.OS === "ios" ? 22 : 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.06,
          shadowRadius: 8
        },
        tabBarActiveTintColor: "#10B981",
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
                color={focused ? "#10B981" : String(color || "#94A3B8")}
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
                color={focused ? "#10B981" : String(color || "#94A3B8")}
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
                color={focused ? "#FFFFFF" : "#10B981"}
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
                color={focused ? "#10B981" : String(color || "#94A3B8")}
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
    backgroundColor: "rgba(16, 185, 129, 0.12)"
  },
  writerIconWrap: {
    width: 38,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  writerIconWrapActive: {
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3
  },
  writerIconWrapInactive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)"
  }
});
