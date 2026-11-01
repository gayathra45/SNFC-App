import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { nfcService } from "../src/services/nfcService";
import { socketService } from "../src/services/socketService";
import { notificationService } from "../src/services/notificationService";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Initialize hardware NFC service
    nfcService.init().catch((err) => {
      console.warn("NFC service init warning:", err);
    });

    // Initialize Socket connection
    socketService.connect().catch((err) => {
      console.warn("Socket connect warning:", err);
    });

    // Register push notifications
    notificationService.requestPermissionsAndRegister().catch(() => {});

    // Listen for notification taps to navigate directly to NFC Writer
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.cardId && data?.cardUrl) {
        router.push({
          pathname: "/(tabs)/writer",
          params: {
            cardId: String(data.cardId),
            cardUrl: String(data.cardUrl),
            orderId: String(data.orderId || ""),
            orderNumber: String(data.orderNumber || ""),
            jobId: String(data.jobId || ""),
            policyHolderName: String(data.policyHolderName || "")
          }
        });
      }
    });

    return () => {
      sub.remove();
      socketService.disconnect();
    };
  }, [router]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#FFFFFF"
          },
          headerTintColor: "#0F2942",
          headerTitleStyle: {
            fontWeight: "800",
            fontSize: 17
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
          name="notifications"
          options={{
            headerShown: false,
            presentation: "modal"
          }}
        />
        <Stack.Screen
          name="card-detail"
          options={{
            headerShown: false,
            presentation: "modal"
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
            presentation: "modal"
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
