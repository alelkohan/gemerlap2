import { useState, useMemo, useEffect, useCallback } from "react";
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
import { generateLaporanTimbanganPdf, generateLaporanKeuanganPdf, generateLaporanAbsensiPdf, generateLaporanAbsensiDetailPdf, generateLaporanPenjualanPdf, generateLaporanNeracaMassaPdf, generateLaporanNeracaSkontroPdf } from "@/src/lib/pdf";

type Jenis = "timbangan" | "keuangan" | "absensi" | "penjualan" | "neraca" | "neraca_skontro";

type JenisSampah = {
  id: string;
  nama: string;
  tipe: string;
};

export default function LaporanScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { user } = useAuth();
  const [jenis, setJenis] = useState<Jenis>("timbangan");
  const [start, setStart] = useState(todayISO().slice(0, 8) + "01");
  const [end, setEnd] = useState(todayISO());
  const [bulan, setBulan] = useState(currentBulan());
  const [loading, setLoading] = useState(false);

  // Komoditas filter state
  const [komoditasList, setKomoditasList] = useState<JenisSampah[]>([]);
  const [selectedKomoditas, setSelectedKomoditas] = useState<Set<string>>(new Set());
  const [loadingKomoditas, setLoadingKomoditas] = useState(false);

  // Petugas filter state
  const [petugasList, setPetugasList] = useState<any[]>([]);
  const [selectedPetugas, setSelectedPetugas] = useState<Set<string>>(new Set());
  const [loadingPetugas, setLoadingPetugas] = useState(false);

  // Load daftar komoditas saat pilih penjualan
  const loadKomoditas = useCallback(async () => {
    setLoadingKomoditas(true);
    try {
      const list = await apiFetch<JenisSampah[]>("/jenis-sampah");
      const komoditas = list.filter((j) => j.tipe === "komoditas");
      setKomoditasList(komoditas);
      setSelectedKomoditas(new Set(komoditas.map((k) => k.id)));
    } catch (e: any) {
      Alert.alert("Error", "Gagal memuat daftar komoditas: " + e.message);
    } finally {
      setLoadingKomoditas(false);
    }
  }, []);

  const loadPetugas = useCallback(async () => {
    setLoadingPetugas(true);
    try {
      const list = await apiFetch<any[]>("/petugas");
      const activePetugas = list.filter((p) => p.status === true);
      setPetugasList(activePetugas);
      setSelectedPetugas(new Set(activePetugas.map((p) => p.id)));
    } catch (e: any) {
      Alert.alert("Error", "Gagal memuat daftar petugas: " + e.message);
    } finally {
      setLoadingPetugas(false);
    }
  }, []);

  useEffect(() => {
    if (jenis === "penjualan") {
      loadKomoditas();
    } else if (jenis === "absensi") {
      loadPetugas();
    }
  }, [jenis, loadKomoditas, loadPetugas]);

  const semuaDipilih = komoditasList.length > 0 && selectedKomoditas.size === komoditasList.length;
  const sebagianDipilih = selectedKomoditas.size > 0 && !semuaDipilih;

  const togglePilihSemua = () => {
    if (semuaDipilih) {
      setSelectedKomoditas(new Set());
    } else {
      setSelectedKomoditas(new Set(komoditasList.map((k) => k.id)));
    }
  };

  const toggleKomoditas = (id: string) => {
    setSelectedKomoditas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const semuaDipilihPetugas = petugasList.length > 0 && selectedPetugas.size === petugasList.length;
  const sebagianDipilihPetugas = selectedPetugas.size > 0 && !semuaDipilihPetugas;

  const togglePilihSemuaPetugas = () => {
    if (semuaDipilihPetugas) {
      setSelectedPetugas(new Set());
    } else {
      setSelectedPetugas(new Set(petugasList.map((p) => p.id)));
    }
  };

  const togglePetugas = (id: string) => {
    setSelectedPetugas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const generate = async () => {
    if (jenis === "penjualan" && selectedKomoditas.size === 0) {
      Alert.alert("Perhatian", "Pilih minimal satu komoditas.");
      return;
    }
    if (jenis === "absensi" && selectedPetugas.size === 0) {
      Alert.alert("Perhatian", "Pilih minimal satu petugas.");
      return;
    }
    setLoading(true);
    try {
      if (jenis === "timbangan") {
        const items = await apiFetch<any[]>(`/laporan/timbangan?start=${start}&end=${end}`);
        await generateLaporanTimbanganPdf(items, `${formatTanggalID(start)} - ${formatTanggalID(end)}`, user?.nama || "User");
      } else if (jenis === "keuangan") {
        const items = await apiFetch<any[]>(`/laporan/keuangan?start=${start}&end=${end}`);
        await generateLaporanKeuanganPdf(items, `${formatTanggalID(start)} - ${formatTanggalID(end)}`, user?.nama || "User");
      } else if (jenis === "penjualan") {
        // Kirim jenis_ids hanya jika tidak semua dipilih
        let url = `/laporan/penjualan?start=${start}&end=${end}`;
        if (!semuaDipilih) {
          url += `&jenis_ids=${Array.from(selectedKomoditas).join(",")}`;
        }
        const data = await apiFetch<any>(url);
        await generateLaporanPenjualanPdf(data, `${formatTanggalID(start)} - ${formatTanggalID(end)}`, user?.nama || "User");
      } else if (jenis === "neraca") {
        const items = await apiFetch<any[]>(`/laporan/neraca-massa?start=${start}&end=${end}`);
        await generateLaporanNeracaMassaPdf(items, `${formatTanggalID(start)} - ${formatTanggalID(end)}`, user?.nama || "User");
      } else if (jenis === "absensi") {
        if (semuaDipilihPetugas) {
          const items = await apiFetch<any[]>(`/laporan/absensi?bulan=${bulan}`);
          await generateLaporanAbsensiPdf(items, bulanLabel(bulan), user?.nama || "User");
        } else {
          const pids = Array.from(selectedPetugas).join(",");
          const items = await apiFetch<any[]>(`/laporan/absensi-detail?bulan=${bulan}&petugas_ids=${pids}`);
          await generateLaporanAbsensiDetailPdf(items, bulanLabel(bulan), user?.nama || "User");
        }
      } else if (jenis === "neraca_skontro") {
        const data = await apiFetch<any>(`/laporan/neraca-skontro?bulan=${bulan}`);
        await generateLaporanNeracaSkontroPdf(data, bulanLabel(bulan), user?.nama || "User");
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
            { id: "neraca", icon: "pie-chart", label: "Neraca Massa & Recovery Factor", sub: "Volume pilahan & efisiensi" },
            { id: "keuangan", icon: "wallet", label: "Laporan Keuangan", sub: "Pemasukan, pengeluaran, saldo" },
            { id: "neraca_skontro", icon: "newspaper", label: "Laporan Neraca Skontro", sub: "Aktiva & pasiva (posisi keuangan)" },
            { id: "penjualan", icon: "cart", label: "Laporan Penjualan Komoditas", sub: "Rekap penjualan per komoditas" },
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

        {(jenis === "absensi" || jenis === "neraca_skontro") ? (
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

            {jenis === "absensi" && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.label}>Filter Petugas</Text>
                <View style={styles.komoditasContainer}>
                  {loadingPetugas ? (
                    <Text style={{ color: Colors.textSecondary, fontSize: 13, padding: 8 }}>Memuat petugas...</Text>
                  ) : petugasList.length === 0 ? (
                    <Text style={{ color: Colors.textSecondary, fontSize: 13, padding: 8 }}>Tidak ada petugas tersedia.</Text>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={togglePilihSemuaPetugas}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.checkbox,
                          (semuaDipilihPetugas || sebagianDipilihPetugas) && { borderColor: Colors.primary, backgroundColor: semuaDipilihPetugas ? Colors.primary : Colors.surface },
                        ]}>
                          {semuaDipilihPetugas && <Ionicons name="checkmark" size={14} color="#fff" />}
                          {sebagianDipilihPetugas && (
                            <View style={{ width: 8, height: 2, backgroundColor: Colors.primary, borderRadius: 2 }} />
                          )}
                        </View>
                        <Text style={[styles.checkboxLabel, { fontWeight: "700", color: Colors.text }]}>
                          Pilih Semua (Rekap Saja)
                        </Text>
                        <Text style={styles.checkboxBadge}>
                          {selectedPetugas.size}/{petugasList.length}
                        </Text>
                      </TouchableOpacity>

                      <View style={{ height: 1, backgroundColor: Colors.borderLight, marginVertical: 4 }} />

                      {petugasList.map((p) => {
                        const checked = selectedPetugas.has(p.id);
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={styles.checkboxRow}
                            onPress={() => togglePetugas(p.id)}
                            activeOpacity={0.7}
                          >
                            <View style={[
                              styles.checkbox,
                              checked && { borderColor: Colors.primary, backgroundColor: Colors.primary },
                            ]}>
                              {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </View>
                            <Text style={[styles.checkboxLabel, { color: Colors.text }]}>{p.nama}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}
                </View>
                {sebagianDipilihPetugas && (
                  <Text style={{ fontSize: 11, color: Colors.textTertiary, marginTop: 6, fontStyle: 'italic' }}>
                    *Memilih spesifik petugas akan menghasilkan Laporan Detail (termasuk durasi, catatan & log sesi).
                  </Text>
                )}
              </View>
            )}
          </>
        ) : (
          <>
            <DatePickerField label="Dari Tanggal" value={start} onChange={setStart} />
            <DatePickerField label="Sampai Tanggal" value={end} onChange={setEnd} />
          </>
        )}

        {/* Filter Komoditas — hanya tampil saat penjualan */}
        {jenis === "penjualan" && (
          <View style={{ marginTop: 4 }}>
            <Text style={styles.label}>Filter Komoditas</Text>
            <View style={styles.komoditasContainer}>
              {loadingKomoditas ? (
                <Text style={{ color: Colors.textSecondary, fontSize: 13, padding: 8 }}>Memuat komoditas...</Text>
              ) : komoditasList.length === 0 ? (
                <Text style={{ color: Colors.textSecondary, fontSize: 13, padding: 8 }}>Tidak ada komoditas tersedia.</Text>
              ) : (
                <>
                  {/* Baris Pilih Semua */}
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={togglePilihSemua}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.checkbox,
                      (semuaDipilih || sebagianDipilih) && { borderColor: Colors.primary, backgroundColor: semuaDipilih ? Colors.primary : Colors.surface },
                    ]}>
                      {semuaDipilih && <Ionicons name="checkmark" size={14} color="#fff" />}
                      {sebagianDipilih && (
                        <View style={{ width: 8, height: 2, backgroundColor: Colors.primary, borderRadius: 2 }} />
                      )}
                    </View>
                    <Text style={[styles.checkboxLabel, { fontWeight: "700", color: Colors.text }]}>
                      Pilih Semua
                    </Text>
                    <Text style={styles.checkboxBadge}>
                      {selectedKomoditas.size}/{komoditasList.length}
                    </Text>
                  </TouchableOpacity>

                  {/* Divider */}
                  <View style={{ height: 1, backgroundColor: Colors.borderLight, marginVertical: 4 }} />

                  {/* Daftar Komoditas */}
                  {komoditasList.map((k) => {
                    const checked = selectedKomoditas.has(k.id);
                    return (
                      <TouchableOpacity
                        key={k.id}
                        style={styles.checkboxRow}
                        onPress={() => toggleKomoditas(k.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.checkbox,
                          checked && { borderColor: Colors.primary, backgroundColor: Colors.primary },
                        ]}>
                          {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                        <Text style={[styles.checkboxLabel, { color: Colors.text }]}>{k.nama}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </View>
          </View>
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

  // Komoditas filter styles
  komoditasContainer: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
  },
  checkboxBadge: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
});
