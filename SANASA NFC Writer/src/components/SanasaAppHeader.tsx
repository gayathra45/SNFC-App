import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export interface SanasaAppHeaderProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeIcon?: any;
  statusBadge?: { text: string; color?: string };
  showBack?: boolean;
  onBack?: () => void;
  onBackPress?: () => void;
  rightAction?: React.ReactNode;
  children?: React.ReactNode;
  overlappingContent?: React.ReactNode;
  height?: number;
}

export default function SanasaAppHeader({
  title,
  subtitle,
  badgeText,
  badgeIcon = "shield-check",
  statusBadge,
  showBack = false,
  onBack,
  onBackPress,
  rightAction,
  children,
  overlappingContent,
  height = 190
}: SanasaAppHeaderProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const displayBadgeText = statusBadge?.text || badgeText;
  const displayBadgeColor = statusBadge?.color || "#10B981";
  const contentToOverlap = overlappingContent || children;

  return (
    <View style={[styles.headerContainer, { minHeight: height }]}>
      {/* ── Curved Deep Navy / Teal Gradient Background ── */}
      <LinearGradient
        colors={["#041215", "#0A242E", "#0D2A3A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { minHeight: height }]}
      >
        {/* Subtle Ambient Glow Circles */}
        <View style={[styles.ambientGlowTop, { width: width * 0.7, height: width * 0.7 }]} />
        <View style={[styles.ambientGlowBottom, { width: width * 0.5, height: width * 0.5 }]} />

        {/* Top Bar with Title and Actions */}
        <View style={styles.topBar}>
          {showBack && (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          <View style={styles.titleCol}>
            {displayBadgeText && (
              <View
                style={[
                  styles.badgeRow,
                  {
                    backgroundColor: `${displayBadgeColor}22`,
                    borderColor: `${displayBadgeColor}55`
                  }
                ]}
              >
                <MaterialCommunityIcons name={badgeIcon} size={12} color={displayBadgeColor} />
                <Text style={[styles.badgeText, { color: displayBadgeColor }]}>
                  {displayBadgeText}
                </Text>
              </View>
            )}
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitleText} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {rightAction ? (
            <View style={styles.rightActionWrap}>{rightAction}</View>
          ) : null}
        </View>
      </LinearGradient>

      {/* Overlapping Bottom Children (e.g. search bars, stats) */}
      {contentToOverlap ? <View style={styles.overlappingWrap}>{contentToOverlap}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    position: "relative"
  },
  headerGradient: {
    width: "100%",
    borderBottomRightRadius: 50,
    paddingTop: Platform.OS === "ios" ? 54 : 42,
    paddingHorizontal: 20,
    paddingBottom: 24,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative"
  },
  ambientGlowTop: {
    position: "absolute",
    top: -40,
    right: -30,
    borderRadius: 9999,
    backgroundColor: "rgba(34, 211, 238, 0.12)"
  },
  ambientGlowBottom: {
    position: "absolute",
    bottom: -30,
    left: -20,
    borderRadius: 9999,
    backgroundColor: "rgba(16, 185, 129, 0.08)"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center"
  },
  titleCol: {
    flex: 1,
    justifyContent: "center"
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
    marginBottom: 4
  },
  badgeText: {
    color: "#34D399",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  titleText: {
    fontSize: 26,
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: -0.4
  },
  subtitleText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
    marginTop: 2
  },
  rightActionWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  overlappingWrap: {
    marginTop: -22,
    paddingHorizontal: 16,
    zIndex: 10
  }
});
