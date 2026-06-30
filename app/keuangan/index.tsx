import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Pressable,
  Image,
  Modal,
  TextInput
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { useColors } from "@/src/lib/theme-context";
import { rupiah, formatTanggalID, currentBulan, bulanLabel, addMonths, todayISO } from "@/src/lib/format";
import { Card, EmptyState, FAB, ConfirmDialog, Button } from "@/src/components/ui";
import { ScreenContainer } from "@/src/components/screen-header";
import { DatePickerField } from "@/src/components/date-picker";

type Trx = {
  id: string;
  tanggal: string;
  tipe: "penjualan" | "sumber lain" | "bantuan" | "pengeluaran" | "retribusi";
  nama_pihak?: string;
  total: number;
  keterangan?: string;
  no_invoice: string;
  kategori?: string;
  bukti_url?: string;
  _items?: any[];
};

type Filter = "all" | "in" | "out";

export default function KeuanganScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState<Trx[]>([]);
  const [saldo, setSaldo] = useState({ saldo: 0, pemasukan: 0, pengeluaran: 0 });
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailTrx, setDetailTrx] = useState<Trx | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [periodMode, setPeriodMode] = useState<"bulan" | "rentang" | "semua">("bulan");
  const [bulan, setBulan] = useState(currentBulan());
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [showPeriodFilter, setShowPeriodFilter] = useState(false);

  const [tempMode, setTempMode] = useState<"bulan" | "rentang" | "semua">("bulan");
  const [tempStart, setTempStart] = useState(todayISO());
  const [tempEnd, setTempEnd] = useState(todayISO());

  const load = useCallback(async () => {
    try {
      let query = "";
      if (periodMode === "bulan") query = `?bulan=${bulan}`;
      else if (periodMode === "rentang") query = `?start_date=${startDate}&end_date=${endDate}`;

      const [rawList, s] = await Promise.all([
        apiFetch<Trx[]>(`/keuangan${query}`),
        apiFetch<typeof saldo>("/keuangan/saldo"),
      ]);

      const grouped = Object.values(rawList.reduce((acc, t) => {
        if (!acc[t.no_invoice]) {
          acc[t.no_invoice] = { ...t, _items: [t] };
        } else {
          acc[t.no_invoice].total += t.total;
          acc[t.no_invoice]._items.push(t);
        }
        return acc;
      }, {} as Record<string, Trx & { _items: any[] }>));
      
      // Sort descending by tanggal and no_invoice
      grouped.sort((a, b) => {
        if (a.tanggal === b.tanggal) return b.no_invoice.localeCompare(a.no_invoice);
        return b.tanggal.localeCompare(a.tanggal);
      });

      setItems(grouped);
      setSaldo(s);
    } catch (e) {
      console.warn(e);
    }
  }, [periodMode, bulan, startDate, endDate]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalPemasukanPeriode = useMemo(() => items.filter(t => t.tipe !== "pengeluaran").reduce((acc, t) => acc + t.total, 0), [items]);
  const totalPengeluaranPeriode = useMemo(() => items.filter(t => t.tipe === "pengeluaran").reduce((acc, t) => acc + t.total, 0), [items]);

  const labelTipe = useCallback((t: string) => {
    if (t === "penjualan") return "Penjualan Komoditas";
    if (t === "retribusi") return "Retribusi Yayasan";
    if (t === "sumber lain" || t === "bantuan") return "Pemasukan Lain";
    return "Pengeluaran";
  }, []);

  const filtered = useMemo(() => {
    return items.filter((t) => {
      // 1. Cek tipe (in / out / all)
      if (filter === "in" && t.tipe === "pengeluaran") return false;
      if (filter === "out" && t.tipe !== "pengeluaran") return false;

      // 2. Cek pencarian (search)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const tipeLabel = labelTipe(t.tipe).toLowerCase();
        const nama = (t.nama_pihak || "").toLowerCase();
        const kat = (t.kategori || "").toLowerCase();
        const ket = (t.keterangan || "").toLowerCase();
        const nom = t.total.toString();
        
        if (!tipeLabel.includes(q) && !nama.includes(q) && !kat.includes(q) && !ket.includes(q) && !nom.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [items, filter, searchQuery]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/keuangan/invoice/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };


  return (
    <ScreenContainer title="Keuangan">
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
        <View style={styles.monthNav}>
          <TouchableOpacity disabled={periodMode !== "bulan"} onPress={() => setBulan(addMonths(bulan, -1))} style={[styles.navBtn, periodMode !== "bulan" && { opacity: 0 }]}>
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setTempMode(periodMode); setTempStart(startDate); setTempEnd(endDate); setShowPeriodFilter(true); }} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text }}>
              {periodMode === "semua" ? "Semua Waktu" : periodMode === "bulan" ? bulanLabel(bulan) : "Rentang Tanggal"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity disabled={periodMode !== "bulan"} onPress={() => setBulan(addMonths(bulan, 1))} style={[styles.navBtn, periodMode !== "bulan" && { opacity: 0 }]}>
            <Ionicons name="chevron-forward" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {periodMode === "rentang" && (
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: "600" }}>{formatTanggalID(startDate)} - {formatTanggalID(endDate)}</Text>
          </View>
        )}

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
                <Text style={styles.saldoSubVal}>{rupiah(totalPemasukanPeriode)}</Text>
              </View>
              <View>
                <Text style={styles.saldoSubLabel}>Pengeluaran</Text>
                <Text style={styles.saldoSubVal}>{rupiah(totalPengeluaranPeriode)}</Text>
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

          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, height: 48, borderWidth: 1, borderColor: Colors.borderLight }}>
            <Ionicons name="search" size={20} color={Colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Cari transaksi, nominal, kategori..."
              placeholderTextColor={Colors.textTertiary}
              style={{ flex: 1, fontSize: 14, color: Colors.text }}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {filtered.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title="Belum ada transaksi"
              subtitle="Tap tombol + untuk menambah transaksi"
            />
          ) : (
            filtered.map((t) => {
              const isIn = t.tipe !== "pengeluaran";
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
                        onPress={() => { setOpenMenuId(null); router.push(`/keuangan/invoice/${encodeURIComponent(t.no_invoice)}`); }}
                      >
                        <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
                        <Text style={styles.menuText}>Invoice</Text>
                      </TouchableOpacity>
                      {t.bukti_url && (
                        <TouchableOpacity
                          style={styles.menuItem}
                          onPress={() => { setOpenMenuId(null); setDetailTrx(t); }}
                        >
                          <Ionicons name="image-outline" size={18} color={Colors.textSecondary} />
                          <Text style={styles.menuText}>Nota</Text>
                        </TouchableOpacity>
                      )}
                      {isAdmin && (
                        <TouchableOpacity
                          style={styles.menuItem}
                          onPress={() => {
                            setOpenMenuId(null);
                            if (t.kategori === 'Slip Gaji') {
                              router.push('/master/rekap-absensi');
                            } else if (t._items && t._items.length > 1) {
                              Alert.alert('Info', 'Edit untuk transaksi multi-barang tidak dapat dilakukan saat ini.');
                            } else {
                              router.push(`/keuangan/form?id=${t.id}`);
                            }
                          }}
                        >
                          <Ionicons name="create-outline" size={18} color={Colors.info} />
                          <Text style={styles.menuText}>Edit</Text>
                        </TouchableOpacity>
                      )}
                      {isAdmin && (
                        <TouchableOpacity
                          style={styles.menuItem}
                          onPress={() => {
                            setOpenMenuId(null);
                            if (t.kategori === 'Slip Gaji') {
                              router.push('/master/rekap-absensi');
                            } else {
                              setDeleteId(t.no_invoice);
                            }
                          }}
                        >
                          <Ionicons name="trash-outline" size={18} color={Colors.error} />
                          <Text style={[styles.menuText, { color: Colors.error }]}>Hapus</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      {isAdmin && <FAB onPress={() => router.push("/keuangan/form")} testID="add-trx-fab" />}

      <ConfirmDialog
        visible={!!deleteId}
        title="Hapus Transaksi?"
        message="Transaksi akan dihapus permanen."
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />

      {/* Detail Modal */}
      <Modal visible={!!detailTrx} transparent animationType="fade" onRequestClose={() => setDetailTrx(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}
            maximumZoomScale={5}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            style={{ width: '100%', height: '100%' }}
          >
            {detailTrx?.bukti_url && (
              <Image 
                source={{ uri: detailTrx.bukti_url }} 
                style={{ width: 350, height: 600 }} 
                resizeMode="contain" 
              />
            )}
          </ScrollView>
          <TouchableOpacity 
            onPress={() => setDetailTrx(null)}
            style={{ position: 'absolute', top: 50, right: 20, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 24 }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Period Filter Overlay */}
      {showPeriodFilter && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowPeriodFilter(false)}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={{ alignItems: "center", paddingTop: 8 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 16 }} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 16, color: Colors.text }}>Filter Waktu</Text>

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {(["bulan", "rentang", "semua"] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setTempMode(m)}
                    style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10, backgroundColor: tempMode === m ? Colors.primary + "15" : Colors.surface, borderWidth: 1, borderColor: tempMode === m ? Colors.primary : Colors.borderLight }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: tempMode === m ? Colors.primary : Colors.textSecondary }}>
                      {m === "bulan" ? "Per Bulan" : m === "rentang" ? "Rentang" : "Semua"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tempMode === "rentang" && (
                <View style={{ marginBottom: 16, gap: 12 }}>
                  <DatePickerField label="Dari Tanggal" value={tempStart} onChange={setTempStart} />
                  <DatePickerField label="Sampai Tanggal" value={tempEnd} onChange={setTempEnd} />
                </View>
              )}

              <View style={{ marginTop: 8 }}>
                <Button title="Terapkan" onPress={() => {
                  setPeriodMode(tempMode);
                  setStartDate(tempStart);
                  setEndDate(tempEnd);
                  setShowPeriodFilter(false);
                }} />
              </View>
            </Pressable>
          </Pressable>
        </View>
      )}
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
  },
  navBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.borderLight, alignItems: "center", justifyContent: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
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
