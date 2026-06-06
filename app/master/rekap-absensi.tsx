import { useCallback, useState, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, router } from "expo-router";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button, EmptyState } from "@/src/components/ui";
import { apiFetch, authApi } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";
import { currentBulan, bulanLabel, addMonths } from "@/src/lib/format";
import { generateLaporanAbsensiPdf } from "@/src/lib/pdf";

type Rekap = { petugas_id: string; nama: string; hadir: number; absen: number; izin: number; sakit: number; total_jam: number; gaji_status?: string };

export default function RekapAbsensiScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [bulan, setBulan] = useState(currentBulan());
  const [rekap, setRekap] = useState<Rekap[]>([]);

  const load = useCallback(async () => {
    const data = await apiFetch<Rekap[]>(`/absensi/rekap?bulan=${bulan}`);
    
    // Fetch gaji status for each petugas
    const enrichedData = await Promise.all(data.map(async (r) => {
      try {
        const gaji = await apiFetch(`/gaji/${r.petugas_id}?periode=${bulan}`);
        return { ...r, gaji_status: gaji ? "DIBAYAR" : "BELUM" };
      } catch (e) {
        return { ...r, gaji_status: "BELUM" };
      }
    }));
    
    setRekap(enrichedData);
  }, [bulan]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScreenContainer title="Rekap Absensi">
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setBulan(addMonths(bulan, -1))} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text }}>{bulanLabel(bulan)}</Text>
        <TouchableOpacity onPress={() => setBulan(addMonths(bulan, 1))} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {rekap.length === 0 ? (
          <EmptyState icon="stats-chart-outline" title="Belum ada data" />
        ) : (
          rekap.map((r) => (
            <Card key={r.petugas_id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{r.nama}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {r.gaji_status === "DIBAYAR" && (
                    <View style={{ backgroundColor: Colors.successBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 10, color: Colors.success, fontWeight: "800" }}>LUNAS</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: "600" }}>{r.total_jam} jam kerja</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <StatPill label="Hadir" value={r.hadir} color={Colors.success} bg={Colors.successBg} />
                <StatPill label="Absen" value={r.absen} color={Colors.error} bg={Colors.errorBg} />
                <StatPill label="Izin" value={r.izin} color={Colors.warning} bg={Colors.warningBg} />
                <StatPill label="Sakit" value={r.sakit} color={Colors.info} bg={Colors.infoBg} />
              </View>
              {isAdmin && (
                <Button 
                  title={r.gaji_status === "DIBAYAR" ? "Lihat Slip Gaji (Sudah Dibayar)" : "Buat Slip Gaji"} 
                  variant={r.gaji_status === "DIBAYAR" ? "ghost" : "outline"} 
                  icon="cash-outline" 
                  onPress={() => router.push(`/master/slip-gaji?petugas_id=${r.petugas_id}&nama=${encodeURIComponent(r.nama)}&bulan=${bulan}&hadir=${r.hadir}&absen=${r.absen}&izin=${r.izin}&sakit=${r.sakit}&total_jam=${r.total_jam}`)}
                />
              )}
            </Card>
          ))
        )}
      </ScrollView>

      {rekap.length > 0 && isAdmin && (
        <View style={styles.bottomBar}>
          <Button
            title="Download / Share PDF"
            icon="document-text-outline"
            onPress={() => generateLaporanAbsensiPdf(rekap, bulanLabel(bulan), user?.nama || "User")}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

function StatPill({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 10, padding: 10, alignItems: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color }}>{value}</Text>
      <Text style={{ fontSize: 10, color, fontWeight: "700", textTransform: "uppercase", marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  navBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.borderLight, alignItems: "center", justifyContent: "center" },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
});
