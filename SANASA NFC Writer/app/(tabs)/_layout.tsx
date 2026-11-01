import { Tabs, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TouchableOpacity, StyleSheet, View, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function TabsLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: "#070D1E",
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 255, 255, 0.08)"
        },
        headerTintColor: "#F8FAFC",
        headerTitleStyle: {
          fontWeight: "800",
          fontSize: 17,
          letterSpacing: 0.3
        },
        headerRight: () => (
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={styles.settingsHeaderBtn}
            activeOpacity={0.7}
          >
            <View style={styles.settingsIconCircle}>
              <MaterialCommunityIcons name="cog-outline" size={20} color="#38BDF8" />
            </View>
          </TouchableOpacity>
        ),
        tabBarStyle: {
          backgroundColor: "#070D1E",
          borderTopColor: "rgba(255, 255, 255, 0.08)",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 68,
          paddingBottom: Platform.OS === "ios" ? 24 : 10,
          paddingTop: 8,
          elevation: 10
        },
        tabBarActiveTintColor: "#38BDF8",
        tabBarInactiveTintColor: "#64748B",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.2
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "view-dashboard" : "view-dashboard-outline"}
              size={22}
              color={String(color)}
            />
          )
        }}
      />
      <Tabs.Screen
        name="pairing"
        options={{
          title: "Terminal Pairing",
          tabBarLabel: "Pairing",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "cellphone-link" : "cellphone-link"}
              size={22}
              color={String(color)}
            />
          )
        }}
      />
      <Tabs.Screen
        name="writer"
        options={{
          title: "NFC Writer",
          tabBarLabel: "Write Card",
          tabBarIcon: ({ focused }) => (
            <View style={styles.centerWriterBtnWrap}>
              <LinearGradient
                colors={focused ? ["#2563EB", "#06B6D4"] : ["#1E293B", "#0F172A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.centerWriterBtn, focused && styles.centerWriterBtnActive]}
              >
                <MaterialCommunityIcons
                  name="nfc"
                  size={24}
                  color={focused ? "#FFFFFF" : "#38BDF8"}
                />
              </LinearGradient>
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
            <MaterialCommunityIcons
              name={focused ? "history" : "history"}
              size={22}
              color={String(color)}
            />
          )
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  settingsHeaderBtn: {
    marginRight: 16
  },
  settingsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    alignItems: "center",
    justifyContent: "center"
  },
  centerWriterBtnWrap: {
    top: -12,
    alignItems: "center",
    justifyContent: "center"
  },
  centerWriterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(56, 189, 248, 0.4)",
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6
  },
  centerWriterBtnActive: {
    borderColor: "#38BDF8",
    shadowOpacity: 0.6
  }
});
