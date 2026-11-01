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
          <MaterialCommunityIcons name="credit-card-wireless" size={28} color="#102A43" />
        </View>
        <Text style={styles.cardIdText}>{cardId}</Text>
        <Text style={styles.statusPill}>{status}</Text>
      </View>

      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Associated Request:</Text>
          <Text style={styles.detailValue}>{orderNumber}</Text>
        </View>

        {policyHolderName ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Policy Holder:</Text>
            <Text style={styles.detailValue}>{policyHolderName}</Text>
          </View>
        ) : null}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Payload URI (Masked):</Text>
          <Text style={[styles.detailValue, styles.mono]}>
            {cardUrl ? maskUrlToken(cardUrl) : "Not Issued"}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Security Bound:</Text>
          <Text style={[styles.detailValue, { color: "#059669" }]}>Branch Authorized Token</Text>
        </View>
      </View>

      <View style={styles.infoBanner}>
        <MaterialCommunityIcons name="shield-lock-outline" size={18} color="#059669" />
        <Text style={styles.infoBannerText}>
          The complete access token URL is protected and masked to prevent unauthorized disclosure.
        </Text>
      </View>

      <TouchableOpacity style={styles.writeBtn} onPress={handleProceedToWrite}>
        <MaterialCommunityIcons name="nfc" size={20} color="#FFFFFF" />
        <Text style={styles.writeBtnText}>Proceed to Write NFC Card</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Text style={styles.closeBtnText}>Close</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9"
  },
  content: {
    padding: 20
  },
  cardHeader: {
    alignItems: "center",
    marginBottom: 20
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  cardIdText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#102A43",
    marginBottom: 6
  },
  statusPill: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden"
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748B"
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B"
  },
  mono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 10,
    maxWidth: 200
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 20
  },
  infoBannerText: {
    fontSize: 11,
    color: "#065F46",
    flex: 1,
    lineHeight: 16
  },
  writeBtn: {
    backgroundColor: "#102A43",
    borderRadius: 12,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10
  },
  writeBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  closeBtn: {
    alignItems: "center",
    paddingVertical: 12
  },
  closeBtnText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600"
  }
});
