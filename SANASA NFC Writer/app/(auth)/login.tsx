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
  StatusBar,
  useWindowDimensions
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { loginStaff } from "../../src/services/authService";
import { socketService } from "../../src/services/socketService";
import { notificationService } from "../../src/services/notificationService";
import {
  LanguageCode,
  t,
  onLanguageChange,
  getStoredLanguage,
  setStoredLanguage
} from "../../src/services/i18nService";

export default function LoginScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState<LanguageCode>("en");

  // Custom Alert state matching Sanasa App
  const [customAlert, setCustomAlert] = useState<{ title: string; message: string } | null>(null);

  const showAlert = (title: string, message: string) => {
    setCustomAlert({ title, message });
  };

  useEffect(() => {
    getStoredLanguage().then((l) => setCurrentLang(l));
    const unsub = onLanguageChange((l) => setCurrentLang(l));
    return unsub;
  }, []);

  const handleSelectLanguage = async (lang: LanguageCode) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setCurrentLang(lang);
    await setStoredLanguage(lang);
  };

  const handleLogin = async () => {
    if (!loginId.trim() || !password.trim()) {
      showAlert(t("inputRequired"), t("inputRequired"));
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

        // Register push notifications safely
        notificationService
          .requestPermissionsAndRegister(res.user._id, res.user.branch)
          .catch(() => {});

        router.replace("/(tabs)");
      } else {
        showAlert(t("authFailed"), res.error || t("authFailed"));
      }
    } catch (err: any) {
      showAlert(t("connectionError"), err.message || t("connectionError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Deep Teal/Navy Gradient Background */}
      <LinearGradient
        colors={["#041215", "#06232A", "#0A343D"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Immersive Teal Overlay matching Sanasa Mobile App */}
      <View style={styles.overlay} />

      {/* Decorative Blur Ambient Lights */}
      <View style={[styles.ambientLightTop, { width: width * 0.75, height: width * 0.75 }]} />
      <View style={[styles.ambientLightBottom, { width: width * 0.65, height: width * 0.65 }]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { minHeight: height }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoWrapper}>
              <Image
                source={require("../../assets/logo.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appTitle}>SANASA NFC Writer</Text>
            <View style={styles.terminalBadge}>
              <MaterialCommunityIcons name="nfc" size={13} color="#10B981" />
              <Text style={styles.terminalBadgeText}>Contactless Provisioning Gateway</Text>
            </View>
          </View>

          {/* Frosted Glassmorphism Card */}
          <View style={[styles.glassCard, { maxWidth: width > 500 ? 460 : "100%" }]}>
            {/* Language Selector pills at TOP of card */}
            <View style={styles.langSelectorRow}>
              <TouchableOpacity
                onPress={() => handleSelectLanguage("en")}
                style={[styles.langSelectBtn, currentLang === "en" && styles.langSelectBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.langSelectText, currentLang === "en" && styles.langSelectTextActive]}>
                  English
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSelectLanguage("si")}
                style={[styles.langSelectBtn, currentLang === "si" && styles.langSelectBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.langSelectText, currentLang === "si" && styles.langSelectTextActive]}>
                  සිංහල
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSelectLanguage("ta")}
                style={[styles.langSelectBtn, currentLang === "ta" && styles.langSelectBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.langSelectText, currentLang === "ta" && styles.langSelectTextActive]}>
                  தமிழ்
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cardTitle}>{t("loginTitle") || "Staff Login"}</Text>
            <Text style={styles.cardSubtitle}>
              {t("loginDesc") || "Sign in with your authorized branch office credentials to pair with web portal"}
            </Text>

            {/* Inputs Section */}
            <View style={styles.inputsSection}>
              {/* Login ID Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t("loginIdLabel") || "Branch Email / NIC"}</Text>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons
                    name="account-outline"
                    size={20}
                    color="#64748B"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. galle@gmail.com or 1990..."
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={loginId}
                    onChangeText={setLoginId}
                    editable={!loading}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t("passwordLabel") || "Password"}</Text>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={20}
                    color="#64748B"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    editable={!loading}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={handleLogin}
              style={[styles.submitButton, loading && { opacity: 0.75 }]}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.btnLoadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.submitButtonText}>{t("signingIn") || "Verifying..."}</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.submitButtonText}>{t("signInBtn") || "Sign In to Terminal"}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </View>
              )}
            </TouchableOpacity>

            {/* Footer Badge Inside Card */}
            <View style={styles.cardFooterRow}>
              <MaterialCommunityIcons name="shield-check" size={14} color="#10B981" />
              <Text style={styles.cardFooterText}>{t("staffBadge") || "Authorized Branch Staff Only"}</Text>
            </View>
          </View>

          {/* Bottom Footer Text */}
          <View style={styles.footerInfo}>
            <Text style={styles.footerText}>SANASA General Insurance PLC • Official Mobile Terminal</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Custom Alert Modal Matching Sanasa App */}
      {customAlert && (
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <View style={styles.alertIconCircle}>
              <MaterialCommunityIcons name="alert-circle-outline" size={38} color="#FF9800" />
            </View>
            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMsg}>{customAlert.message}</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setCustomAlert(null)}
              style={styles.alertButton}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#041215"
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(4, 18, 21, 0.88)"
  },
  ambientLightTop: {
    position: "absolute",
    top: "-10%",
    left: "-10%",
    borderRadius: 9999,
    backgroundColor: "rgba(34, 211, 238, 0.16)",
    transform: [{ scale: 1.2 }]
  },
  ambientLightBottom: {
    position: "absolute",
    bottom: "-10%",
    right: "-10%",
    borderRadius: 9999,
    backgroundColor: "rgba(20, 184, 166, 0.12)"
  },
  keyboardContainer: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 50 : 36,
    paddingBottom: 36
  },
  logoSection: {
    marginBottom: 20,
    alignItems: "center"
  },
  logoWrapper: {
    width: 82,
    height: 82,
    borderRadius: 22,
    backgroundColor: "rgba(15, 45, 53, 0.85)",
    borderWidth: 1.5,
    borderColor: "rgba(34, 211, 238, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#22D3EE",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6
  },
  logoImage: {
    width: 62,
    height: 62,
    borderRadius: 16
  },
  appTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  terminalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6
  },
  terminalBadgeText: {
    color: "#34D399",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  glassCard: {
    width: "100%",
    backgroundColor: "rgba(15, 45, 53, 0.78)",
    borderRadius: 36,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.18)",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8
  },
  langSelectorRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: 16
  },
  langSelectBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.18)"
  },
  langSelectBtnActive: {
    backgroundColor: "#FF9800",
    borderColor: "#FF9800"
  },
  langSelectText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)"
  },
  langSelectTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold"
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.3
  },
  cardSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 20,
    paddingHorizontal: 8
  },
  inputsSection: {
    gap: 14,
    marginBottom: 22
  },
  inputContainer: {
    gap: 6
  },
  label: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
    letterSpacing: 0.2
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    height: 52,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  inputIcon: {
    marginRight: 10
  },
  textInput: {
    flex: 1,
    color: "#1E293B",
    fontSize: 14.5,
    fontWeight: "500",
    height: "100%"
  },
  eyeIcon: {
    padding: 6
  },
  submitButton: {
    backgroundColor: "#FF9800",
    borderRadius: 22,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF9800",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 16
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  btnLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.4
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 14
  },
  cardFooterText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.65)"
  },
  footerInfo: {
    marginTop: 20,
    alignItems: "center"
  },
  footerText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.45)",
    textAlign: "center"
  },
  alertOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(2, 11, 13, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    paddingHorizontal: 20
  },
  alertCard: {
    width: "90%",
    maxWidth: 340,
    backgroundColor: "rgba(10, 34, 40, 0.96)",
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10
  },
  alertIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 152, 0, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 152, 0, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14
  },
  alertTitle: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center"
  },
  alertMsg: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.75)",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20
  },
  alertButton: {
    backgroundColor: "#FF9800",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 32,
    shadowColor: "#FF9800",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3
  },
  alertButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold"
  }
});
