import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, EmptyState, Input } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { useColors } from "@/src/lib/theme-context";
import { currentBulan, bulanLabel, addMonths, formatTanggalID, rupiah } from "@/src/lib/format";

type Penjualan = {
  id: string;
  tanggal: string;
  no_invoice: string;
  nama_pihak: string;
  jenis_sampah_id: string;
  jenis_sampah_nama: string;
  bobot_kg: number;
  harga_per_kg: number;
  total: number;
  keterangan?: string;
};

type Jenis = { id: string; nama: string; tipe: string };

export default function PenjualanScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const [bulan, setBulan] = useState(currentBulan());
  const [items, setItems] = useState<Penjualan[]>([]);
  const [jenisList, setJenisList] = useState<Jenis[]>([]);
  const [filterJenis, setFilterJenis] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async (b: string) => {
    try {
      const [data, jenis] = await Promise.all([
        apiFetch<Penjualan[]>(`/penjualan?bulan=${b}`),
        apiFetch<Jenis[]>("/jenis-sampah"),
      ]);
      setItems(data);
      setJenisList(jenis.filter((j) => j.tipe === "komoditas"));
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => { load(bulan); }, [bulan, load]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filterJenis !== "all" && it.jenis_sampah_id !== filterJenis) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!(it.nama_pihak || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, filterJenis, search]);

  const summary = useMemo(() => {
    const totals: Record<string, { nama: string; kg: number; rp: number }> = {};
    for (const it of filtered) {
      if (!totals[it.jenis_sampah_id]) {
        totals[it.jenis_sampah_id] = { nama: it.jenis_sampah_nama, kg: 0, rp: 0 };
      }
      totals[it.jenis_sampah_id].kg += it.bobot_kg || 0;
      totals[it.jenis_sampah_id].rp += it.total || 0;
    }
    return Object.values(totals).sort((a, b) => b.rp - a.rp);
  }, [filtered]);

  const totalKg = summary.reduce((s, t) => s + t.kg, 0);
  const totalRp = summary.reduce((s, t) => s + t.rp, 0);

  return (
    <ScreenContainer title="Penjualan Komoditas">
      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setBulan(addMonths(bulan, -1))} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text }}>{bulanLabel(bulan)}</Text>
        <TouchableOpacity onPress={() => setBulan(addMonths(bulan, 1))} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Summary Cards */}
        {summary.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <View style={[styles.totalCard, { backgroundColor: Colors.successBg }]}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.primary, textTransform: "uppercase" }}>Total Terjual</Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.primary }}>{totalKg.toFixed(1)} kg</Text>
              </View>
              <View style={[styles.totalCard, { backgroundColor: Colors.successBg }]}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.success, textTransform: "uppercase" }}>Total Pendapatan</Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.success }}>{rupiah(totalRp)}</Text>
              </View>
            </View>
            {summary.map((s, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.text }}>{s.nama}</Text>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <Text style={{ fontSize: 13, color: Colors.textSecondary }}>{s.kg.toFixed(1)} kg</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.success }}>{rupiah(s.rp)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Filters */}
        <Input
          placeholder="Cari pembeli..."
          value={search}
          onChangeText={setSearch}
          containerStyle={{ marginBottom: 10 }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TouchableOpacity
              onPress={() => setFilterJenis("all")}
              style={[styles.chip, { backgroundColor: filterJenis === "all" ? Colors.primary : Colors.borderLight }]}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: filterJenis === "all" ? "#fff" : Colors.textSecondary }}>Semua</Text>
            </TouchableOpacity>
            {jenisList.map((j) => (
              <TouchableOpacity
                key={j.id}
                onPress={() => setFilterJenis(j.id)}
                style={[styles.chip, { backgroundColor: filterJenis === j.id ? Colors.primary : Colors.borderLight }]}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: filterJenis === j.id ? "#fff" : Colors.textSecondary }}>{j.nama}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Transaction List */}
        {filtered.length === 0 ? (
          <EmptyState icon="cart-outline" title="Tidak ada data penjualan" subtitle="Belum ada transaksi penjualan komoditas bulan ini" />
        ) : (
          filtered.map((it) => (
            <Card key={it.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[styles.iconBox, { backgroundColor: Colors.successBg }]}>
                  <Ionicons name="cart" size={20} color={Colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", color: Colors.text, fontSize: 14 }}>
                    {it.nama_pihak || "-"}
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
                    {it.jenis_sampah_nama} • {it.bobot_kg} kg @ {rupiah(it.harga_per_kg)}
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.textTertiary, marginTop: 2 }}>
                    {formatTanggalID(it.tanggal)} • {it.no_invoice}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.success }}>
                  {rupiah(it.total)}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
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
  totalCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
