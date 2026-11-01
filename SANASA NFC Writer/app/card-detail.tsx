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

import SanasaAppHeader from "../src/components/SanasaAppHeader";

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
    <View style={styles.container}>
      <SanasaAppHeader
        title="Card Specification"
        subtitle="Provisioning Payload & Security"
        showBack={true}
        onBackPress={() => router.back()}
        statusBadge={{ text: status, color: "#10B981" }}
        overlappingContent={
          <View style={styles.headerOverlapCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="credit-card-wireless" size={24} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardIdText}>{cardId}</Text>
                <Text style={styles.cardSubText}>
                  {policyHolderName ? `${policyHolderName} • ` : ""}{orderNumber}
                </Text>
              </View>
            </View>
          </View>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
            colors={["#059669", "#10B981"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientBtn}
          >
            <MaterialCommunityIcons name="nfc" size={20} color="#FFFFFF" />
            <Text style={styles.writeBtnText}>Proceed to Write Card</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  content: {
    padding: 16,
    paddingTop: 14,
    paddingBottom: 40
  },
  headerOverlapCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#0D2A3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)"
  },
  cardIdText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F2942",
    letterSpacing: 0.3
  },
  cardSubText: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0D2A3A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 14,
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
