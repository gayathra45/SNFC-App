import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { getStoredStaff } from "../src/services/storageService";
import {
  LanguageCode,
  getStoredLanguage,
  setStoredLanguage,
  t,
  onLanguageChange
} from "../src/services/i18nService";

export default function WelcomeScreen() {
  const router = useRouter();
  const [selectedLang, setSelectedLang] = useState<LanguageCode>("en");
  const [loading, setLoading] = useState(true);
  const [hasLoggedInStaff, setHasLoggedInStaff] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const lang = await getStoredLanguage();
        setSelectedLang(lang);
        const staff = await getStoredStaff();
        if (staff && staff._id) {
          setHasLoggedInStaff(true);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }
    init();

    const unsub = onLanguageChange((l) => setSelectedLang(l));
    return unsub;
  }, []);

  const handleSelectLanguage = async (lang: LanguageCode) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setSelectedLang(lang);
    await setStoredLanguage(lang);
  };

  const handleContinue = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    if (hasLoggedInStaff) {
      router.replace("/(tabs)");
    } else {
      router.replace("/(auth)/login");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#102A43", "#0F172A", "#091422"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Image
              source={require("../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>{t("welcomeTitle")}</Text>
          <View style={styles.pillBadge}>
            <MaterialCommunityIcons name="nfc" size={14} color="#10B981" />
            <Text style={styles.pillText}>SANASA Contactless Provisioning</Text>
          </View>
          <Text style={styles.description}>{t("welcomeDesc")}</Text>
        </View>

        {/* Language Selection Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="translate" size={18} color="#2563EB" />
            <Text style={styles.cardTitle}>{t("chooseLang")}</Text>
          </View>

          <View style={styles.langList}>
            {/* English */}
            <TouchableOpacity
              style={[
                styles.langBtn,
                selectedLang === "en" ? styles.langBtnActive : null
              ]}
              onPress={() => handleSelectLanguage("en")}
              activeOpacity={0.8}
            >
              <View style={styles.langTextCol}>
                <Text
                  style={[
                    styles.langName,
                    selectedLang === "en" ? styles.langNameActive : null
                  ]}
                >
                  English
                </Text>
                <Text style={styles.langSub}>Default System Language</Text>
              </View>
              {selectedLang === "en" && (
                <MaterialCommunityIcons name="check-circle" size={20} color="#059669" />
              )}
            </TouchableOpacity>

            {/* Sinhala */}
            <TouchableOpacity
              style={[
                styles.langBtn,
                selectedLang === "si" ? styles.langBtnActive : null
              ]}
              onPress={() => handleSelectLanguage("si")}
              activeOpacity={0.8}
            >
              <View style={styles.langTextCol}>
                <Text
                  style={[
                    styles.langName,
                    selectedLang === "si" ? styles.langNameActive : null
                  ]}
                >
                  සිංහල (Sinhala)
                </Text>
                <Text style={styles.langSub}>ශ්‍රී ලංකා ප්‍රාදේශීය භාෂාව</Text>
              </View>
              {selectedLang === "si" && (
                <MaterialCommunityIcons name="check-circle" size={20} color="#059669" />
              )}
            </TouchableOpacity>

            {/* Tamil */}
            <TouchableOpacity
              style={[
                styles.langBtn,
                selectedLang === "ta" ? styles.langBtnActive : null
              ]}
              onPress={() => handleSelectLanguage("ta")}
              activeOpacity={0.8}
            >
              <View style={styles.langTextCol}>
                <Text
                  style={[
                    styles.langName,
                    selectedLang === "ta" ? styles.langNameActive : null
                  ]}
                >
                  தமிழ் (Tamil)
                </Text>
                <Text style={styles.langSub}>இலங்கை தேசிய மொழி</Text>
              </View>
              {selectedLang === "ta" && (
                <MaterialCommunityIcons name="check-circle" size={20} color="#059669" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#2563EB", "#1D4ED8"]}
              style={styles.continueGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.continueText}>{t("getStarted")}</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.versionText}>S NFC Writer v1.0.0 • SANASA General Insurance</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#102A43"
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#102A43",
    alignItems: "center",
    justifyContent: "center"
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 24,
    justifyContent: "space-between"
  },
  header: {
    alignItems: "center",
    marginTop: 10
  },
  logoWrapper: {
    width: 104,
    height: 104,
    borderRadius: 24,
    backgroundColor: "#0B1D30",
    borderWidth: 1.5,
    borderColor: "#1E3A8A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16
  },
  logo: {
    width: 82,
    height: 82,
    borderRadius: 18
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "bold",
    letterSpacing: 1.2,
    textAlign: "center"
  },
  pillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 12
  },
  pillText: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "600"
  },
  description: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: 12
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginVertical: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  cardTitle: {
    color: "#1E293B",
    fontSize: 13,
    fontWeight: "bold"
  },
  langList: {
    gap: 10
  },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0"
  },
  langBtnActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB"
  },
  langTextCol: {
    flex: 1
  },
  langName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#334155"
  },
  langNameActive: {
    color: "#1E40AF"
  },
  langSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2
  },
  footer: {
    alignItems: "center",
    gap: 12
  },
  continueBtn: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden"
  },
  continueGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15
  },
  continueText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold"
  },
  versionText: {
    color: "#64748B",
    fontSize: 11
  }
});
