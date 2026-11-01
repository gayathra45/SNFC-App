import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { maskUrlToken } from "../src/services/storageService";

export default function CardDetailModal() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const cardId = params.cardId ? String(params.cardId) : "SANASA-CARD";
  const orderNumber = params.orderNumber ? String(params.orderNumber) : "N/A";
  const cardUrl = params.cardUrl ? String(params.cardUrl) : "";
  const policyHolderName = params.policyHolderName ? String(params.policyHolderName) : "";
  const status = params.status ? String(params.status) : "Ready for Write";

  const handleProceedToWrite = () => {
    router.push({
      pathname: "/(tabs)/writer",
      params: {
        cardId,
        cardUrl,
        orderNumber,
        policyHolderName
      }
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.cardHeader}>
        <LinearGradient
          colors={["#2563EB", "#06B6D4"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconCircle}
        >
          <MaterialCommunityIcons name="credit-card-wireless" size={28} color="#FFFFFF" />
        </LinearGradient>
        <Text style={styles.cardIdText}>{cardId}</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{status}</Text>
        </View>
      </View>

      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Associated Request:</Text>
          <Text style={styles.detailValue}>{orderNumber}</Text>
        </View>

        {policyHolderName ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Policyholder:</Text>
            <Text style={styles.detailValue}>{policyHolderName}</Text>
          </View>
        ) : null}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Payload URI (Masked):</Text>
          <Text style={styles.monoValue}>{maskUrlToken(cardUrl)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>NFC Format:</Text>
          <Text style={styles.detailValue}>NDEF URI Record (NFC Forum Type 2)</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Security:</Text>
          <Text style={[styles.detailValue, { color: "#10B981" }]}>Cryptographic Token Protected</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.writeBtn}
        onPress={handleProceedToWrite}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={["#2563EB", "#06B6D4"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientBtn}
        >
          <MaterialCommunityIcons name="nfc" size={20} color="#FFFFFF" />
          <Text style={styles.writeBtnText}>Proceed to Write Card</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1E"
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  cardHeader: {
    alignItems: "center",
    marginBottom: 24
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4
  },
  cardIdText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#F8FAFC",
    letterSpacing: 0.5,
    marginBottom: 6
  },
  statusPill: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14
  },
  statusPillText: {
    fontSize: 11,
    color: "#38BDF8",
    fontWeight: "800"
  },
  detailsCard: {
    backgroundColor: "#0E172E",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 12,
    marginBottom: 24
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  detailLabel: {
    fontSize: 11,
    color: "#94A3B8"
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#E2E8F0"
  },
  monoValue: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#64748B",
    maxWidth: 180
  },
  writeBtn: {
    borderRadius: 14,
    overflow: "hidden"
  },
  gradientBtn: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  writeBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800"
  }
});
