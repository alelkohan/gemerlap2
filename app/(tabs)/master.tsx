import { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/lib/auth-context";
import { Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";
import { Card } from "@/src/components/ui";

export default function MasterScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const router = useRouter();
  const { user } = useAuth();
  const hasAdminAccess = user?.role === "admin" || user?.role === "auditor";
  const isAuditor = user?.role === "auditor";

  const isPetugas = user?.role === "petugas";

  const groupedMenus = [
    {
      title: "Kepegawaian",
      items: [
        { icon: "people-outline", label: "Petugas", sub: "Data petugas TPS", path: "/master/petugas", color: Colors.info },
        { icon: "time-outline", label: "Persetujuan Lembur", sub: "Setujui pengajuan lembur", path: "/master/persetujuan-lembur", color: Colors.warning, adminOnly: true },
        { icon: "wallet-outline", label: "Pinjaman / Kasbon", sub: "Kelola kasbon petugas", path: "/master/kasbon", color: Colors.error },
        { icon: "stats-chart-outline", label: "Rekap Absensi & Gaji", sub: "Kehadiran dan cetak slip gaji", path: "/master/rekap-absensi", color: Colors.warning, adminOnly: true, petugasAllowed: true },
        { icon: "shield-outline", label: "Kelola Akun", sub: "Akun & role pengguna", path: "/master/akun", color: Colors.error, adminOnly: true },
      ]
    },
    {
      title: "Operasional & Laporan",
      items: [
        { icon: "wallet-outline", label: "Keuangan", sub: "Transaksi & saldo TPS", path: "/keuangan", color: Colors.accent, auditorHidden: true },
        { icon: "business-outline", label: "Aset & Kewajiban", sub: "Aset, hutang & piutang TPS", path: "/master/aset-kewajiban", color: Colors.info },
        { icon: "cart-outline", label: "Penjualan Komoditas", sub: "Riwayat penjualan", path: "/master/penjualan", color: Colors.success },
        { icon: "document-outline", label: "Laporan", sub: "Cetak laporan PDF", path: "/master/laporan", color: Colors.primary, adminOnly: true },
      ]
    },
    {
      title: "Data Pokok",
      items: [
        { icon: "business-outline", label: "Unit", sub: "Kelola unit penugasan", path: "/master/unit", color: Colors.primary },
        { icon: "leaf-outline", label: "Jenis Komoditas", sub: "Kelola jenis komoditas", path: "/master/jenis-sampah", color: Colors.success },
        { icon: "location-outline", label: "Lokasi TPS", sub: "Kelola wilayah lokasi TPS", path: "/master/lokasi-tps", color: Colors.primary },
      ]
    }
  ];

  // Flat menu structure for petugas
  const petugasMenuPaths = [
    "/master/petugas",
    "/master/rekap-absensi",
    "/keuangan",
    "/master/penjualan",
    "/master/unit",
    "/master/jenis-sampah"
  ];

  const flatPetugasMenu = useMemo(() => {
    const items: any[] = [];
    groupedMenus.forEach(g => {
      g.items.forEach(item => {
        if (petugasMenuPaths.includes(item.path)) {
          items.push(item);
        }
      });
    });
    return items;
  }, [Colors]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Master Data</Text>
        <Text style={styles.subtitle}>Pengaturan & laporan</Text>

        <View style={{ marginTop: 16, gap: 24 }}>
          {isPetugas ? (
            <View style={{ gap: 10 }}>
              {flatPetugasMenu.map((m) => (
                <TouchableOpacity
                  key={m.path}
                  activeOpacity={0.85}
                  onPress={() => router.push(m.path as any)}
                  testID={`master-${m.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Card>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}>
                        <View style={[styles.iconBox, { backgroundColor: m.color + "20" }]}>
                          <Ionicons name={m.icon as any} size={24} color={m.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{m.label}</Text>
                          <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>{m.sub}</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            groupedMenus.map((group, groupIdx) => (
              <View key={groupIdx}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginBottom: 12, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {group.title}
                </Text>
                <View style={{ gap: 10 }}>
                  {group.items.filter((m: any) => !(isAuditor && m.auditorHidden)).map((m) => {
                    const locked = m.adminOnly && !hasAdminAccess && !m.petugasAllowed;
                    return (
                      <TouchableOpacity
                        key={m.path}
                        disabled={locked}
                        activeOpacity={0.85}
                        onPress={() => router.push(m.path as any)}
                        testID={`master-${m.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <Card style={{ opacity: locked ? 0.45 : 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}>
                              <View style={[styles.iconBox, { backgroundColor: m.color + "20" }]}>
                                <Ionicons name={m.icon as any} size={24} color={m.color} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{m.label}</Text>
                                  {locked && (
                                    <View style={styles.adminBadge}>
                                      <Text style={{ fontSize: 9, fontWeight: "700", color: Colors.textSecondary }}>ADMIN</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>{m.sub}</Text>
                              </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                          </View>
                        </Card>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  title: { fontSize: 26, fontWeight: "800", color: Colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  iconBox: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  adminBadge: { backgroundColor: Colors.borderLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});
