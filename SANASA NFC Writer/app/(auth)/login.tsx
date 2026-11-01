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

    setLoading(true);
    try {
      const res = await loginStaff(loginId, password);
      if (res.success && res.user) {
        // Reconnect socket with authenticated identity
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
            <MaterialCommunityIcons name="shield-check" size={14} color="#059669" />
            <Text style={styles.badgeText}>Authorized Branch Staff Only</Text>
          </View>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Staff Sign In</Text>
          <Text style={styles.cardDesc}>
            Log in with your SANASA branch office credentials to pair with the web portal and write NFC cards.
          </Text>

          {/* Login ID Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email / Staff NIC</Text>
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons name="account-outline" size={20} color="#64748B" style={styles.inputIcon} />
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
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons name="lock-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
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
            style={[styles.loginBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.btnRow}>
                <Text style={styles.loginBtnText}>Sign In</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
              </View>
            )}
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
          <MaterialCommunityIcons name="lock" size={14} color="#64748B" />
          <Text style={styles.footerText}>
            Protected by SANASA Security. Actions are logged and branch-isolated.
          </Text>
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
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1.5
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(5, 150, 105, 0.15)",
    borderColor: "rgba(5, 150, 105, 0.4)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
    gap: 6
  },
  badgeText: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "600"
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#102A43",
    marginBottom: 4
  },
  cardDesc: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 20,
    lineHeight: 18
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
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    height: 48
  },
  inputIcon: {
    marginRight: 8
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B"
  },
  eyeBtn: {
    padding: 6
  },
  loginBtn: {
    backgroundColor: "#102A43",
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#102A43",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
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
    fontSize: 15,
    fontWeight: "700"
  },
  settingsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    gap: 6
  },
  settingsLinkText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500"
  },
  footerNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 6
  },
  footerText: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center"
  }
});
