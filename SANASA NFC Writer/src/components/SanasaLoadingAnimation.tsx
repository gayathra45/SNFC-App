import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image,
  Dimensions,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export interface SanasaLoadingProps {
  message?: string;
  subMessage?: string;
  fullscreen?: boolean;
  size?: "small" | "medium" | "large";
}

export default function SanasaLoadingAnimation({
  message = "Initializing Contactless Terminal...",
  subMessage = "Sanasa General Insurance • Field Operations",
  fullscreen = true,
  size = "large",
}: SanasaLoadingProps) {
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.7)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.7)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const barShimmer = useRef(new Animated.Value(-120)).current;
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // 1. Central Logo Breathing Scale
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.07,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // 2. Wave Ring 1 Loop
    const ring1Loop = Animated.loop(
      Animated.parallel([
        Animated.timing(ring1Scale, {
          toValue: 1.85,
          duration: 2200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ring1Opacity, {
          toValue: 0,
          duration: 2200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Wave Ring 2 Loop (staggered delay)
    let ring2Loop: Animated.CompositeAnimation | null = null;
    const ring2Timer = setTimeout(() => {
      ring2Loop = Animated.loop(
        Animated.parallel([
          Animated.timing(ring2Scale, {
            toValue: 1.85,
            duration: 2200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ring2Opacity, {
            toValue: 0,
            duration: 2200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      ring2Loop.start();
    }, 700);

    // 4. Orbit Spinner Rotation
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // 5. Progress Bar Shimmer
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(barShimmer, {
          toValue: 160,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(barShimmer, {
          toValue: -120,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ])
    );

    // 6. Typing / Progress Dots Sequence
    const dotsLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dot1Opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(dot2Opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(dot3Opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(dot1Opacity, { toValue: 0.3, duration: 200, useNativeDriver: true }),
          Animated.timing(dot2Opacity, { toValue: 0.3, duration: 200, useNativeDriver: true }),
          Animated.timing(dot3Opacity, { toValue: 0.3, duration: 200, useNativeDriver: true }),
        ]),
        Animated.delay(200),
      ])
    );

    pulseLoop.start();
    ring1Loop.start();
    spinLoop.start();
    shimmerLoop.start();
    dotsLoop.start();

    return () => {
      pulseLoop.stop();
      ring1Loop.stop();
      if (ring2Loop) ring2Loop.stop();
      clearTimeout(ring2Timer);
      spinLoop.stop();
      shimmerLoop.stop();
      dotsLoop.stop();
    };
  }, []);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const isSmall = size === "small";
  const discSize = isSmall ? 70 : size === "medium" ? 95 : 110;
  const logoSize = isSmall ? 44 : size === "medium" ? 58 : 68;

  const content = (
    <View style={[styles.centerWrap, isSmall && styles.centerWrapSmall]}>
      {/* ── RADAR PULSE WAVES CONTAINER ── */}
      <View style={[styles.wavesContainer, { width: discSize * 2, height: discSize * 2 }]}>
        {/* Pulsing Wave 1 */}
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: discSize,
              height: discSize,
              borderRadius: discSize / 2,
              transform: [{ scale: ring1Scale }],
              opacity: ring1Opacity,
            },
          ]}
        />
        {/* Pulsing Wave 2 */}
        <Animated.View
          style={[
            styles.pulseRing,
            styles.pulseRingSecondary,
            {
              width: discSize,
              height: discSize,
              borderRadius: discSize / 2,
              transform: [{ scale: ring2Scale }],
              opacity: ring2Opacity,
            },
          ]}
        />

        {/* Orbit Rotating Dash Ring */}
        <Animated.View
          style={[
            styles.orbitSpinner,
            {
              width: discSize + 18,
              height: discSize + 18,
              borderRadius: (discSize + 18) / 2,
              transform: [{ rotate: spinInterpolate }],
            },
          ]}
        >
          <View style={styles.orbitDot} />
        </Animated.View>

        {/* ── LOGO DISC ── */}
        <Animated.View
          style={[
            styles.logoDisc,
            {
              width: discSize,
              height: discSize,
              borderRadius: discSize / 2,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={["#0c2238", "#081b2e"]}
            style={[styles.logoGradient, { borderRadius: discSize / 2 }]}
          >
            <Image
              source={require("../../assets/logo.png")}
              style={[styles.logoImg, { width: logoSize, height: logoSize }]}
              resizeMode="contain"
            />
          </LinearGradient>
        </Animated.View>
      </View>

      {/* ── BRAND TITLES & METRICS ── */}
      {!isSmall && (
        <View style={styles.infoSection}>
          <Text style={styles.brandTitle}>SANASA LIFE & GENERAL</Text>

          <View style={styles.terminalBadgeRow}>
            <View style={styles.terminalPulseDot} />
            <MaterialCommunityIcons name="nfc" size={13} color="#10B981" />
            <Text style={styles.terminalBadgeText}>NFC WRITER • FIELD TERMINAL</Text>
          </View>

          {/* Dynamic Loading Message */}
          <View style={styles.messageRow}>
            <Text style={styles.statusMessage}>{message}</Text>
            <View style={styles.dotsRow}>
              <Animated.View style={[styles.miniDot, { opacity: dot1Opacity }]} />
              <Animated.View style={[styles.miniDot, { opacity: dot2Opacity }]} />
              <Animated.View style={[styles.miniDot, { opacity: dot3Opacity }]} />
            </View>
          </View>

          {subMessage ? <Text style={styles.subStatus}>{subMessage}</Text> : null}

          {/* ── SLEEK SHIMMERING PROGRESS BAR ── */}
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarGleam,
                {
                  transform: [{ translateX: barShimmer }],
                },
              ]}
            >
              <LinearGradient
                colors={["rgba(16, 185, 129, 0)", "#10B981", "#38BDF8", "rgba(56, 189, 248, 0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          {/* Security Registry Watermark */}
          <View style={styles.securitySeal}>
            <MaterialCommunityIcons name="shield-check" size={12} color="#10b981" />
            <Text style={styles.securitySealText}>
              Sanasa Central Cryptographic Engine • Sri Lanka
            </Text>
          </View>
        </View>
      )}

      {isSmall && (
        <View style={{ marginTop: 10, alignItems: "center" }}>
          <Text style={[styles.statusMessage, { fontSize: 13 }]}>{message}</Text>
        </View>
      )}
    </View>
  );

  if (!fullscreen) {
    return <View style={styles.inlineContainer}>{content}</View>;
  }

  return (
    <View style={styles.fullscreenContainer}>
      <StatusBar style="light" />

      {/* Deep Sanasa Mobile App Theme Background Gradient */}
      <LinearGradient
        colors={["#081726", "#0B1E32", "#071321"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient Lighting Orbs */}
      <View style={styles.ambientGlowTop} />
      <View style={styles.ambientGlowBottom} />

      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#081726",
    justifyContent: "center",
    alignItems: "center",
  },
  inlineContainer: {
    paddingVertical: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  ambientGlowTop: {
    position: "absolute",
    top: -SCREEN_W * 0.3,
    right: -SCREEN_W * 0.2,
    width: SCREEN_W * 0.8,
    height: SCREEN_W * 0.8,
    borderRadius: (SCREEN_W * 0.8) / 2,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  ambientGlowBottom: {
    position: "absolute",
    bottom: -SCREEN_W * 0.3,
    left: -SCREEN_W * 0.2,
    width: SCREEN_W * 0.8,
    height: SCREEN_W * 0.8,
    borderRadius: (SCREEN_W * 0.8) / 2,
    backgroundColor: "rgba(2, 132, 199, 0.08)",
  },
  centerWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  centerWrapSmall: {
    paddingHorizontal: 12,
  },
  wavesContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 1.8,
    borderColor: "rgba(16, 185, 129, 0.55)",
    backgroundColor: "rgba(16, 185, 129, 0.04)",
  },
  pulseRingSecondary: {
    borderColor: "rgba(56, 189, 248, 0.45)",
    backgroundColor: "rgba(56, 189, 248, 0.03)",
  },
  orbitSpinner: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderTopColor: "#10B981",
    borderRightColor: "#38BDF8",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  orbitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#38BDF8",
    marginRight: -3,
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
  logoDisc: {
    backgroundColor: "#0A192F",
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.45)",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
  },
  logoGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    opacity: 0.96,
  },
  infoSection: {
    alignItems: "center",
    marginTop: 26,
  },
  brandTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center",
  },
  terminalBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.28)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    marginTop: 8,
  },
  terminalPulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#10B981",
  },
  terminalBadgeText: {
    color: "#6EE7B7",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    gap: 4,
  },
  statusMessage: {
    color: "#E2E8F0",
    fontSize: 14.5,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  miniDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "#38BDF8",
  },
  subStatus: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
  },
  progressBarTrack: {
    width: 170,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    marginTop: 18,
  },
  progressBarGleam: {
    width: 80,
    height: "100%",
  },
  securitySeal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 28,
    paddingHorizontal: 10,
  },
  securitySealText: {
    color: "#64748b",
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
