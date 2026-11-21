import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export interface SanasaLoadingProps {
  message?: string;
  subMessage?: string;
  fullscreen?: boolean;
  size?: "small" | "medium" | "large";
}

export default function SanasaLoadingAnimation({
  message = "Initializing Contactless Terminal...",
  subMessage,
  fullscreen = true,
  size = "large",
}: SanasaLoadingProps) {
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const waveBreathe = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    // 1. Smooth entrance animation
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 600,
        delay: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 2. Subtle rhythmic contactless wave pulse loop
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(waveBreathe, {
              toValue: 1.05,
              duration: 1600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(waveBreathe, {
              toValue: 1,
              duration: 1600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(glowOpacity, {
              toValue: 0.28,
              duration: 1600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.12,
              duration: 1600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    });
  }, [logoOpacity, logoScale, contentOpacity, waveBreathe, glowOpacity]);

  const isSmall = size === "small";
  const isMedium = size === "medium";
  const emblemSize = isSmall ? 46 : isMedium ? 64 : 96;

  const content = (
    <View style={[styles.centerWrap, isSmall && styles.centerWrapSmall]}>
      {/* Contactless Wave Emblem with Subtle Glow */}
      <View style={[styles.emblemWrapper, { width: emblemSize, height: emblemSize }]}>
        {!isSmall && (
          <Animated.View
            style={[
              styles.glowAura,
              {
                width: emblemSize * 1.35,
                height: emblemSize * 1.35,
                borderRadius: (emblemSize * 1.35) / 2,
                opacity: glowOpacity,
              },
            ]}
          />
        )}
        <Animated.View
          style={[
            styles.emblemContainer,
            {
              width: emblemSize,
              height: emblemSize,
              opacity: logoOpacity,
              transform: [{ scale: Animated.multiply(logoScale, waveBreathe) }],
            },
          ]}
        >
          <Image
            source={require("../../assets/logo-icon.png")}
            style={styles.emblemImg}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Clean Tracked Brand Header & Status */}
      <Animated.View style={[styles.textWrap, { opacity: contentOpacity }]}>
        {!isSmall && (
          <Text style={styles.brandTitle}>SANASA NFC WRITER</Text>
        )}

        {/* Minimal Status Row */}
        {message ? (
          <View style={styles.messageRow}>
            <ActivityIndicator size="small" color="#00E5FF" style={styles.indicator} />
            <Text style={[styles.statusText, isSmall && styles.statusTextSmall]}>
              {message}
            </Text>
          </View>
        ) : null}

        {subMessage && !isSmall ? (
          <Text style={styles.subText}>{subMessage}</Text>
        ) : null}
      </Animated.View>
    </View>
  );

  if (!fullscreen) {
    return <View style={styles.inlineContainer}>{content}</View>;
  }

  return (
    <View style={styles.fullscreenContainer}>
      <LinearGradient
        colors={["#051422", "#0A1E2E", "#0D263D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#0A1E2E",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  centerWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerWrapSmall: {
    paddingVertical: 4,
  },
  emblemWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    position: "relative",
  },
  glowAura: {
    position: "absolute",
    backgroundColor: "#00E5FF",
    filter: "blur(18px)",
  },
  emblemContainer: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00E5FF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  emblemImg: {
    width: "100%",
    height: "100%",
  },
  textWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 4.5,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 14,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  indicator: {
    transform: [{ scale: 0.72 }],
  },
  statusText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  statusTextSmall: {
    fontSize: 11,
  },
  subText: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.5,
    marginTop: 6,
    textAlign: "center",
  },
});
