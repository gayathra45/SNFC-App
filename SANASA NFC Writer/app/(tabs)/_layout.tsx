import { Tabs, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TouchableOpacity, StyleSheet, View } from "react-native";

export default function TabsLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: "#102A43",
          elevation: 4,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: {
          fontWeight: "800",
          fontSize: 17
        },
        headerRight: () => (
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={styles.settingsHeaderBtn}
          >
            <MaterialCommunityIcons name="cog-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ),
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E2E8F0",
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8
        },
        tabBarActiveTintColor: "#102A43",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600"
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" size={size} color={String(color)} />
          )
        }}
      />
      <Tabs.Screen
        name="pairing"
        options={{
          title: "Device Pairing",
          tabBarLabel: "Pairing",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cellphone-link" size={size} color={String(color)} />
          )
        }}
      />
      <Tabs.Screen
        name="writer"
        options={{
          title: "NFC Writer",
          tabBarLabel: "Write Card",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.writerIconWrap, focused && styles.writerIconWrapActive]}>
              <MaterialCommunityIcons
                name="nfc"
                size={24}
                color={focused ? "#FFFFFF" : String(color)}
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
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="history" size={size} color={String(color)} />
          )
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  settingsHeaderBtn: {
    marginRight: 16,
    padding: 6
  },
  writerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  writerIconWrapActive: {
    backgroundColor: "#102A43"
  }
});
