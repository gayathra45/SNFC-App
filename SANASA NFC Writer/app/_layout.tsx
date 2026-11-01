import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import { nfcService } from "../src/services/nfcService";
import { socketService } from "../src/services/socketService";

export default function RootLayout() {
  useEffect(() => {
    // Initialize hardware NFC service
    nfcService.init().catch((err) => {
      console.warn("NFC service init warning:", err);
    });

    // Initialize Socket connection
    socketService.connect().catch((err) => {
      console.warn("Socket connect warning:", err);
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#102A43"
          },
          headerTintColor: "#ffffff",
          headerTitleStyle: {
            fontWeight: "bold",
            fontSize: 18
          },
          contentStyle: {
            backgroundColor: "#F8FAFC"
          }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="card-detail"
          options={{
            title: "Card Details",
            presentation: "modal"
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: "Settings & Diagnostics",
            presentation: "modal"
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
