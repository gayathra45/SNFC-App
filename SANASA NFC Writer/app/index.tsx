import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Image, Text } from "react-native";
import { useRouter } from "expo-router";
import { getStoredStaff } from "../src/services/storageService";

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const staff = await getStoredStaff();
        if (staff && staff._id) {
          router.replace("/(tabs)");
        } else {
          router.replace("/(auth)/login");
        }
      } catch {
        router.replace("/(auth)/login");
      } finally {
        setChecking(false);
      }
    }

    checkAuth();
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.brandBox}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>SANASA NFC WRITER</Text>
        <Text style={styles.subtitle}>Branch Staff Digital Provisioning</Text>
      </View>
      <ActivityIndicator size="large" color="#059669" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#102A43",
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  brandBox: {
    alignItems: "center",
    marginBottom: 40
  },
  logo: {
    width: 140,
    height: 70,
    marginBottom: 16
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 1.5
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 6
  },
  spinner: {
    marginTop: 20
  }
});
