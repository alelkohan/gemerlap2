import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "@/src/lib/api";
import { Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";
import { rupiah, formatTanggalID } from "@/src/lib/format";
import { Card, EmptyState, FAB, ConfirmDialog } from "@/src/components/ui";

type Trx = {
  id: string;
  tanggal: string;
  tipe: "penjualan" | "sumber lain" | "bantuan" | "pengeluaran";
  nama_pihak?: string;
  total: number;
  keterangan?: string;
  no_invoice: string;
  kategori?: string;
};

type Filter = "all" | "in" | "out";

export default function KeuanganScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const router = useRouter();
  const [items, setItems] = useState<Trx[]>([]);
  const [saldo, setSaldo] = useState({ saldo: 0, pemasukan: 0, pengeluaran: 0 });
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([
        apiFetch<Trx[]>("/keuangan"),
        apiFetch<typeof saldo>("/keuangan/saldo"),
      ]);
      setItems(list);
      setSaldo(s);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (filter === "in") return t.tipe === "penjualan" || t.tipe === "sumber lain" || t.tipe === "bantuan";
      if (filter === "out") return t.tipe === "pengeluaran";
      return true;
    });
  }, [items, filter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/keuangan/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const labelTipe = (t: string) => {
    if (t === "penjualan") return "Penjualan Komoditas";
    if (t === "sumber lain" || t === "bantuan") return "Pemasukan Lain";
    return "Pengeluaran";
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={{ padding: 16, paddingBottom: 8 }}>
          <Text style={styles.title}>Keuangan</Text>
          <Text style={styles.subtitle}>Transaksi & saldo TPS</Text>
        </View>

        {/* Saldo card */}
        <View style={styles.saldoWrap}>
          <View style={styles.saldoCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="wallet" size={18} color="#fff" />
              <Text style={styles.saldoLabel}>Saldo Utama</Text>
            </View>
            <Text style={styles.saldoValue}>{rupiah(saldo.saldo)}</Text>
            <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
              <View>
                <Text style={styles.saldoSubLabel}>Pemasukan</Text>
                <Text style={styles.saldoSubVal}>{rupiah(saldo.pemasukan)}</Text>
              </View>
              <View>
                <Text style={styles.saldoSubLabel}>Pengeluaran</Text>
                <Text style={styles.saldoSubVal}>{rupiah(saldo.pengeluaran)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.segmentRow}>
            {(["all", "in", "out"] as Filter[]).map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.segment, filter === f && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, filter === f && styles.segmentTextActive]}>
                  {f === "all" ? "Semua" : f === "in" ? "Pemasukan" : "Pengeluaran"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filtered.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title="Belum ada transaksi"
              subtitle="Tap tombol + untuk menambah transaksi"
            />
          ) : (
            filtered.map((t) => {
              const isIn = t.tipe === "penjualan" || t.tipe === "sumber lain" || t.tipe === "bantuan";
              return (
                <Card key={t.id} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={[styles.icon, { backgroundColor: isIn ? Colors.successBg : Colors.errorBg }]}>
                      <Ionicons
                        name={isIn ? "arrow-down" : "arrow-up"}
                        size={22}
                        color={isIn ? Colors.success : Colors.error}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "700", color: Colors.text, fontSize: 14 }} numberOfLines={1}>
                        {labelTipe(t.tipe)}
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                        {t.nama_pihak || t.kategori || t.keterangan || t.no_invoice}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.textTertiary, marginTop: 2 }}>
                        {formatTanggalID(t.tanggal)} • {t.no_invoice}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontWeight: "800", color: isIn ? Colors.success : Colors.error }}>
                        {isIn ? "+" : "-"} {rupiah(t.total)}
                      </Text>
                      <TouchableOpacity onPress={() => setOpenMenuId(openMenuId === t.id ? null : t.id)} style={{ padding: 4, marginTop: 4 }}>
                        <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {openMenuId === t.id && (
                    <View style={styles.menuActions}>
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => { setOpenMenuId(null); router.push(`/keuangan/invoice/${t.id}`); }}
                      >
                        <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
                        <Text style={styles.menuText}>Invoice</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => { setOpenMenuId(null); router.push(`/keuangan/form?id=${t.id}`); }}
                      >
                        <Ionicons name="create-outline" size={18} color={Colors.info} />
                        <Text style={styles.menuText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => { setOpenMenuId(null); setDeleteId(t.id); }}
                      >
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                        <Text style={[styles.menuText, { color: Colors.error }]}>Hapus</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      <FAB onPress={() => router.push("/keuangan/form")} testID="add-trx-fab" />

      <ConfirmDialog
        visible={!!deleteId}
        title="Hapus Transaksi?"
        message="Transaksi akan dihapus permanen."
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </SafeAreaView>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  title: { fontSize: 26, fontWeight: "800", color: Colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  saldoWrap: { paddingHorizontal: 16, marginBottom: 12 },
  saldoCard: {
    backgroundColor: Colors.primary,
    padding: 20,
    borderRadius: 20,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  saldoLabel: { color: "#ffffffcc", fontSize: 13, fontWeight: "600" },
  saldoValue: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 8, letterSpacing: -0.5 },
  saldoSubLabel: { color: "#ffffff99", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  saldoSubVal: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 2 },
  segmentRow: { flexDirection: "row", backgroundColor: Colors.borderLight, borderRadius: 12, padding: 4, marginBottom: 12 },
  segment: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  segmentActive: { backgroundColor: Colors.surface },
  segmentText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  segmentTextActive: { color: Colors.primary },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  menuActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-around",
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  menuText: { fontSize: 13, fontWeight: "600", color: Colors.text },
});
