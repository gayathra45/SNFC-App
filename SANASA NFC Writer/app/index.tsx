import React, { useEffect } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { getStoredStaff } from "../src/services/storageService";
import SanasaLoadingAnimation from "../src/components/SanasaLoadingAnimation";

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndRoute() {
      try {
        // Small graceful pause to show branded radar animation
        await new Promise((res) => setTimeout(res, 800));
        if (!isMounted) return;

        const staff = await getStoredStaff();
        if (staff && staff._id) {
          router.replace("/(tabs)");
        } else {
          router.replace("/(auth)/login");
        }
      } catch {
        if (isMounted) {
          router.replace("/(auth)/login");
        }
      }
    }

    checkAuthAndRoute();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SanasaLoadingAnimation
        message="Verifying Terminal & Staff Credentials..."
        subMessage="SANASA Contactless Provisioning System"
        fullscreen={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1528"
  }
});
