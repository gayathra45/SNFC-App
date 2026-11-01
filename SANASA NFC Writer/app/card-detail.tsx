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
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="credit-card-wireless" size={28} color="#2563EB" />
        </View>
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
          <Text style={[styles.detailValue, { color: "#059669" }]}>Cryptographic Token Protected</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.writeBtn}
        onPress={handleProceedToWrite}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={["#2563EB", "#1D4ED8"]}
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
    backgroundColor: "#F8FAFC"
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
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE"
  },
  cardIdText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F2942",
    letterSpacing: 0.3,
    marginBottom: 6
  },
  statusPill: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14
  },
  statusPillText: {
    fontSize: 11,
    color: "#2563EB",
    fontWeight: "800"
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
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
    color: "#64748B"
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B"
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
