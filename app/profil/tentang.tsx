import { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { LOGO_IMG, ORG } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";

export default function TentangScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tentang Aplikasi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.logoWrap}>
            <Image source={LOGO_IMG} style={styles.logo} resizeMode="contain" />
          </View>

          <Text style={styles.appName}>ASA Green</Text>
          <Text style={styles.appSub}>{ORG.name}</Text>
          <Text style={styles.org}>{ORG.org}</Text>

          <View style={styles.card}>
            <Text style={styles.version}>Versi 3.0</Text>
            <Text style={styles.description}>
              Aplikasi Manajemen TPS ini dirancang untuk memudahkan manajemen operasional Tempat Pengolahan Sampah, pencatatan kehadiran petugas secara otomatis menggunakan sistem GPS, serta rekapitulasi data keuangan dan komoditas secara cerdas.
            </Text>
            
            <View style={styles.infoBox}>
              <Ionicons name="business" size={28} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Dikembangkan oleh</Text>
                <Text style={styles.infoValue}>Gemerlap</Text>
                <Text style={styles.infoSub}>(Gerakan Melestarikan Lingkungan Pesantren)</Text>
              </View>
            </View>
          </View>

          <Text style={styles.footer}>
            © 2026 Gemerlap • Hak Cipta Dilindungi
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  container: {
    padding: 24,
    paddingTop: 10,
    flexGrow: 1,
    alignItems: "center",
  },
  inner: {
    width: "100%",
    maxWidth: 440,
  },
  logoWrap: {
    alignSelf: "center",
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  logo: { width: 100, height: 100 },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  appSub: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 4,
  },
  org: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: "center",
    marginBottom: 32,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 },
      android: { elevation: 3 },
    }),
  },
  version: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bg,
    padding: 16,
    borderRadius: 16,
    gap: 16,
  },
  infoTitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 2,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  infoSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 32,
    fontWeight: "500",
  },
});
