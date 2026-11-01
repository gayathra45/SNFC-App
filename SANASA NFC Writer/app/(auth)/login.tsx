import React, { useState, useEffect } from "react";
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
  Alert,
  StatusBar
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { loginStaff } from "../../src/services/authService";
import { socketService } from "../../src/services/socketService";
import { notificationService } from "../../src/services/notificationService";
import { t, onLanguageChange, getStoredLanguage } from "../../src/services/i18nService";

export default function LoginScreen() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, setLangState] = useState("en");

  useEffect(() => {
    getStoredLanguage().then((l) => setLangState(l));
    const unsub = onLanguageChange((l) => setLangState(l));
    return unsub;
  }, []);

  const handleLogin = async () => {
    if (!loginId.trim() || !password.trim()) {
      Alert.alert(t("inputRequired"), t("inputRequired"));
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

        // Connect socket
        socketService.connect().catch(() => {});

        // Register push notifications
        notificationService
          .requestPermissionsAndRegister(res.user._id, res.user.branch)
          .catch(() => {});

        router.replace("/(tabs)");
      } else {
        Alert.alert(t("authFailed"), res.error || t("authFailed"));
      }
    } catch (err: any) {
      Alert.alert(t("connectionError"), err.message || t("connectionError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#102A43", "#0F172A", "#091422"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appTitle}>{t("appName")}</Text>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="shield-check" size={14} color="#34D399" />
            <Text style={styles.badgeText}>{t("staffBadge")}</Text>
          </View>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("loginTitle")}</Text>
          <Text style={styles.cardDesc}>{t("loginDesc")}</Text>

          {/* Login ID Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("loginIdLabel")}</Text>
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons
                name="account-outline"
                size={20}
                color="#64748B"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. galle@gmail.com or 1990..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                value={loginId}
                onChangeText={setLoginId}
                editable={!loading}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("passwordLabel")}</Text>
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={20}
                color="#64748B"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
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
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#2563EB", "#1D4ED8"]}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.btnText}>{t("signingIn")}</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.btnText}>{t("signInBtn")}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => router.replace("/")}
            style={styles.switchLangBtn}
          >
            <MaterialCommunityIcons name="translate" size={15} color="#60A5FA" />
            <Text style={styles.switchLangText}>Change Language</Text>
          </TouchableOpacity>
          <Text style={styles.footerSub}>SANASA General Insurance PLC • Official Mobile Gateway</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#102A43"
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 48,
    paddingBottom: 24,
    justifyContent: "center"
  },
  header: {
    alignItems: "center",
    marginBottom: 24
  },
  logoWrapper: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: "#0B1D30",
    borderWidth: 1.5,
    borderColor: "#1E3A8A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8
  },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 16
  },
  appTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    letterSpacing: 1.2
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8
  },
  badgeText: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "600"
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 6
  },
  cardDesc: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 20
  },
  inputGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12
  },
  inputIcon: {
    marginRight: 8
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: "#0F172A"
  },
  eyeBtn: {
    padding: 6
  },
  loginBtn: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden"
  },
  loginBtnDisabled: {
    opacity: 0.7
  },
  btnGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold"
  },
  footer: {
    marginTop: 24,
    alignItems: "center",
    gap: 8
  },
  switchLangBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    borderRadius: 16
  },
  switchLangText: {
    color: "#60A5FA",
    fontSize: 12,
    fontWeight: "600"
  },
  footerSub: {
    color: "#64748B",
    fontSize: 10,
    textAlign: "center"
  }
});
