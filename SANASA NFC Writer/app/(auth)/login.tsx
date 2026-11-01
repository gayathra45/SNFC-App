import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { loginStaff } from "../../src/services/authService";
import { socketService } from "../../src/services/socketService";

export default function LoginScreen() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!loginId.trim() || !password.trim()) {
      Alert.alert("Input Required", "Please enter your Branch Email / NIC and Password.");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setLoading(true);
    try {
      const res = await loginStaff(loginId, password);
      if (res.success && res.user) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        socketService.connect().catch(() => {});
        router.replace("/(tabs)");
      } else {
        Alert.alert("Authentication Failed", res.error || "Invalid credentials.");
      }
    } catch (err: any) {
      Alert.alert("Connection Error", err.message || "Failed to reach server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Branding */}
        <View style={styles.header}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>SANASA NFC WRITER</Text>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="shield-check" size={14} color="#38BDF8" />
            <Text style={styles.badgeText}>Authorized Branch Staff Only</Text>
          </View>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Staff Sign In</Text>
          <Text style={styles.cardDesc}>
            Log in with your SANASA branch office credentials to pair with the web portal and write physical cards.
          </Text>

          {/* Login ID Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email / Staff NIC</Text>
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons name="account-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. galle@gmail.com or 1990..."
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                value={loginId}
                onChangeText={setLoginId}
                editable={!loading}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons name="lock-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#64748B"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <MaterialCommunityIcons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#2563EB", "#06B6D4"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginGradient}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.loginBtnText}>Sign In</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Settings link for Server IP */}
          <TouchableOpacity
            style={styles.settingsLink}
            onPress={() => router.push("/settings")}
          >
            <MaterialCommunityIcons name="cog-outline" size={16} color="#64748B" />
            <Text style={styles.settingsLinkText}>Configure Server IP / Host</Text>
          </TouchableOpacity>
        </View>

        {/* Security Notice */}
        <View style={styles.footerNotice}>
          <MaterialCommunityIcons name="shield-lock" size={14} color="#64748B" />
          <Text style={styles.footerText}>
            Protected by SANASA Security. All write operations are logged and branch-isolated.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1E"
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingTop: 50,
    paddingBottom: 40
  },
  header: {
    alignItems: "center",
    marginBottom: 28
  },
  logo: {
    width: 150,
    height: 75,
    marginBottom: 12
  },
  appTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#F8FAFC",
    letterSpacing: 1.5
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.3)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
    gap: 6
  },
  badgeText: {
    fontSize: 11,
    color: "#38BDF8",
    fontWeight: "700"
  },
  card: {
    backgroundColor: "#0E172E",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F8FAFC",
    marginBottom: 6
  },
  cardDesc: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 20,
    lineHeight: 17
  },
  inputGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#94A3B8",
    marginBottom: 6
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#162244",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 12
  },
  inputIcon: {
    marginRight: 8
  },
  input: {
    flex: 1,
    height: 48,
    color: "#F8FAFC",
    fontSize: 13
  },
  eyeBtn: {
    padding: 8
  },
  loginBtn: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 16
  },
  loginGradient: {
    height: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  btnDisabled: {
    opacity: 0.6
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800"
  },
  settingsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8
  },
  settingsLinkText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600"
  },
  footerNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 6,
    paddingHorizontal: 20
  },
  footerText: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center"
  }
});
