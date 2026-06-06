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
  const isAdmin = user?.role === "admin";

  const menus: { icon: any; label: string; sub: string; path: string; color: string; adminOnly?: boolean }[] = [
    { icon: "business-outline", label: "Unit", sub: "Kelola unit penugasan", path: "/master/unit", color: Colors.primary },
    { icon: "leaf-outline", label: "Jenis Komoditas", sub: "Kelola jenis komoditas", path: "/master/jenis-sampah", color: Colors.success },
    { icon: "people-outline", label: "Petugas", sub: "Data petugas TPS", path: "/master/petugas", color: Colors.info },
    { icon: "calendar-outline", label: "Absensi", sub: "Input absensi harian", path: "/master/absensi", color: Colors.accent },
    { icon: "stats-chart-outline", label: "Rekap Absensi", sub: "Rekap kehadiran bulanan", path: "/master/rekap-absensi", color: Colors.warning },
    { icon: "shield-outline", label: "Kelola Akun", sub: "Akun & role pengguna", path: "/master/akun", color: Colors.error, adminOnly: true },
    { icon: "document-outline", label: "Laporan", sub: "Cetak laporan PDF", path: "/master/laporan", color: Colors.primary, adminOnly: true },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Master Data</Text>
        <Text style={styles.subtitle}>Pengaturan & laporan</Text>

        <View style={{ marginTop: 16, gap: 10 }}>
          {menus.map((m) => {
            const locked = m.adminOnly && !isAdmin;
            return (
              <TouchableOpacity
                key={m.path}
                disabled={locked}
                activeOpacity={0.85}
                onPress={() => router.push(m.path as any)}
                testID={`master-${m.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Card style={{ opacity: locked ? 0.45 : 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <View style={[styles.iconBox, { backgroundColor: m.color + "20" }]}>
                      <Ionicons name={m.icon} size={24} color={m.color} />
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
                    <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
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
