import { useState, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button } from "@/src/components/ui";
import { DatePickerField } from "@/src/components/date-picker";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";
import { todayISO, formatTanggalID, currentBulan, bulanLabel } from "@/src/lib/format";
import { generateLaporanTimbanganPdf, generateLaporanKeuanganPdf, generateLaporanAbsensiPdf } from "@/src/lib/pdf";

type Jenis = "timbangan" | "keuangan" | "absensi";

export default function LaporanScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { user } = useAuth();
  const [jenis, setJenis] = useState<Jenis>("timbangan");
  const [start, setStart] = useState(todayISO().slice(0, 8) + "01");
  const [end, setEnd] = useState(todayISO());
  const [bulan, setBulan] = useState(currentBulan());
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      if (jenis === "timbangan") {
        const items = await apiFetch<any[]>(`/laporan/timbangan?start=${start}&end=${end}`);
        await generateLaporanTimbanganPdf(items, `${formatTanggalID(start)} - ${formatTanggalID(end)}`, user?.nama || "User");
      } else if (jenis === "keuangan") {
        const items = await apiFetch<any[]>(`/laporan/keuangan?start=${start}&end=${end}`);
        await generateLaporanKeuanganPdf(items, `${formatTanggalID(start)} - ${formatTanggalID(end)}`, user?.nama || "User");
      } else {
        const items = await apiFetch<any[]>(`/laporan/absensi?bulan=${bulan}`);
        await generateLaporanAbsensiPdf(items, bulanLabel(bulan), user?.nama || "User");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer title="Laporan">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.label}>Jenis Laporan</Text>
        <View style={{ gap: 8, marginBottom: 16 }}>
          {([
            { id: "timbangan", icon: "scale", label: "Laporan Timbangan", sub: "Rekap berat masuk per unit" },
            { id: "keuangan", icon: "wallet", label: "Laporan Keuangan", sub: "Pemasukan, pengeluaran, saldo" },
            { id: "absensi", icon: "calendar", label: "Laporan Absensi", sub: "Rekap kehadiran petugas" },
          ] as { id: Jenis; icon: any; label: string; sub: string }[]).map((j) => (
            <TouchableOpacity
              key={j.id}
              onPress={() => setJenis(j.id)}
              activeOpacity={0.85}
            >
              <Card
                style={{
                  borderColor: jenis === j.id ? Colors.primary : Colors.borderLight,
                  borderWidth: jenis === j.id ? 2 : 1,
                  backgroundColor: jenis === j.id ? Colors.successBg + "60" : Colors.surface,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 14,
                    backgroundColor: jenis === j.id ? Colors.primary : Colors.borderLight,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Ionicons name={j.icon} size={22} color={jenis === j.id ? Colors.textOnPrimary : Colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700", color: Colors.text, fontSize: 15 }}>{j.label}</Text>
                    <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>{j.sub}</Text>
                  </View>
                  {jenis === j.id && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        {jenis === "absensi" ? (
          <>
            <Text style={styles.label}>Bulan</Text>
            <View style={styles.bulanRow}>
              <TouchableOpacity onPress={() => setBulan(addMonthsLocal(bulan, -1))} style={styles.bulanBtn}>
                <Ionicons name="chevron-back" size={20} color={Colors.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{bulanLabel(bulan)}</Text>
              <TouchableOpacity onPress={() => setBulan(addMonthsLocal(bulan, 1))} style={styles.bulanBtn}>
                <Ionicons name="chevron-forward" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <DatePickerField label="Dari Tanggal" value={start} onChange={setStart} />
            <DatePickerField label="Sampai Tanggal" value={end} onChange={setEnd} />
          </>
        )}

        <View style={{ marginTop: 16 }}>
          <Button title="Generate & Share PDF" icon="document-text" onPress={generate} loading={loading} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function addMonthsLocal(yyyymm: string, delta: number) {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const baseStyles = (Colors: any) => StyleSheet.create({
  label: { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  bulanRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  bulanBtn: { padding: 8, borderRadius: 8, backgroundColor: Colors.borderLight },
});
