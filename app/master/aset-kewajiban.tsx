import { useCallback, useState, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, Modal, StyleSheet, Pressable, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button, Input, FAB, EmptyState, ConfirmDialog, Badge } from "@/src/components/ui";
import { DatePickerField } from "@/src/components/date-picker";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { useColors } from "@/src/lib/theme-context";
import { todayISO, rupiah, formatTanggalID } from "@/src/lib/format";

type Tab = "aset" | "hutang" | "piutang";

type Aset = {
  id: string;
  nama_aset: string;
  tanggal_perolehan: string;
  harga_perolehan: number;
  keterangan?: string;
};

type Cicilan = {
  id: string;
  tanggal: string;
  nominal: number;
  keterangan?: string;
};

type Hutang = {
  id: string;
  nama_kreditor: string;
  tanggal_pinjam: string;
  jumlah_hutang: number;
  sisa_hutang: number;
  keterangan?: string;
  status: "belum_lunas" | "lunas";
  riwayat_cicilan: Cicilan[];
};

type Piutang = {
  id: string;
  nama_debitur: string;
  tanggal_piutang: string;
  jumlah_piutang: number;
  sisa_piutang: number;
  keterangan?: string;
  status: "belum_lunas" | "lunas";
  riwayat_cicilan: Cicilan[];
};

export default function AsetKewajibanScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState<Tab>("aset");
  const [loading, setLoading] = useState(false);

  // Lists
  const [asetList, setAsetList] = useState<Aset[]>([]);
  const [hutangList, setHutangList] = useState<Hutang[]>([]);
  const [piutangList, setPiutangList] = useState<Piutang[]>([]);

  // Modals visibility
  const [showAsetModal, setShowAsetModal] = useState(false);
  const [showHutangModal, setShowHutangModal] = useState(false);
  const [showPiutangModal, setShowPiutangModal] = useState(false);
  const [showBayarModal, setShowBayarModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<any>(null); // holds item for detail modal

  // Form states - Aset
  const [namaAset, setNamaAset] = useState("");
  const [tglAset, setTglAset] = useState(todayISO());
  const [hargaAset, setHargaAset] = useState("");
  const [ketAset, setKetAset] = useState("");

  // Form states - Hutang
  const [namaKreditor, setNamaKreditor] = useState("");
  const [tglHutang, setTglHutang] = useState(todayISO());
  const [jumlahHutang, setJumlahHutang] = useState("");
  const [ketHutang, setKetHutang] = useState("");

  // Form states - Piutang
  const [namaDebitur, setNamaDebitur] = useState("");
  const [tglPiutang, setTglPiutang] = useState(todayISO());
  const [jumlahPiutang, setJumlahPiutang] = useState("");
  const [ketPiutang, setKetPiutang] = useState("");

  // Form states - Cicilan (Hutang / Piutang)
  const [nominalBayar, setNominalBayar] = useState("");
  const [tglBayar, setTglBayar] = useState(todayISO());
  const [ketBayar, setKetBayar] = useState("");
  const [bayarTargetId, setBayarTargetId] = useState<string | null>(null);

  // Confirm delete states
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<Tab | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === "aset") {
        const data = await apiFetch<Aset[]>("/aset");
        setAsetList(data || []);
      } else if (activeTab === "hutang") {
        const data = await apiFetch<Hutang[]>("/hutang");
        setHutangList(data || []);
      } else {
        const data = await apiFetch<Piutang[]>("/piutang");
        setPiutangList(data || []);
      }
    } catch (e: any) {
      Alert.alert("Gagal", e.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // ─── ASET ACTIONS ───────────────────────────────────────────────────────────
  const handleSaveAset = async () => {
    if (!namaAset.trim()) return Alert.alert("Error", "Nama aset wajib diisi");
    const numHarga = Number(hargaAset.replace(/\D/g, ""));
    if (isNaN(numHarga) || numHarga <= 0) return Alert.alert("Error", "Harga perolehan harus valid");

    try {
      setLoading(true);
      await apiFetch("/aset", {
        method: "POST",
        body: {
          nama_aset: namaAset,
          tanggal_perolehan: tglAset,
          harga_perolehan: numHarga,
          keterangan: ketAset
        }
      });
      setShowAsetModal(false);
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Gagal menyimpan aset");
    } finally {
      setLoading(false);
    }
  };

  // ─── HUTANG ACTIONS ─────────────────────────────────────────────────────────
  const handleSaveHutang = async () => {
    if (!namaKreditor.trim()) return Alert.alert("Error", "Nama kreditor wajib diisi");
    const numJumlah = Number(jumlahHutang.replace(/\D/g, ""));
    if (isNaN(numJumlah) || numJumlah <= 0) return Alert.alert("Error", "Jumlah hutang harus valid");

    try {
      setLoading(true);
      await apiFetch("/hutang", {
        method: "POST",
        body: {
          nama_kreditor: namaKreditor,
          tanggal_pinjam: tglHutang,
          jumlah_hutang: numJumlah,
          keterangan: ketHutang
        }
      });
      setShowHutangModal(false);
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Gagal mencatat hutang");
    } finally {
      setLoading(false);
    }
  };

  // ─── PIUTANG ACTIONS ────────────────────────────────────────────────────────
  const handleSavePiutang = async () => {
    if (!namaDebitur.trim()) return Alert.alert("Error", "Nama debitur wajib diisi");
    const numJumlah = Number(jumlahPiutang.replace(/\D/g, ""));
    if (isNaN(numJumlah) || numJumlah <= 0) return Alert.alert("Error", "Jumlah piutang harus valid");

    try {
      setLoading(true);
      await apiFetch("/piutang", {
        method: "POST",
        body: {
          nama_debitur: namaDebitur,
          tanggal_piutang: tglPiutang,
          jumlah_piutang: numJumlah,
          keterangan: ketPiutang
        }
      });
      setShowPiutangModal(false);
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Gagal mencatat piutang");
    } finally {
      setLoading(false);
    }
  };

  // ─── BAYAR/CICIL ACTIONS ────────────────────────────────────────────────────
  const handleSaveBayar = async () => {
    const numNominal = Number(nominalBayar.replace(/\D/g, ""));
    if (isNaN(numNominal) || numNominal <= 0) return Alert.alert("Error", "Nominal pembayaran harus valid");
    if (!bayarTargetId) return;

    try {
      setLoading(true);
      const endpoint = activeTab === "hutang"
        ? `/hutang/${bayarTargetId}/bayar`
        : `/piutang/${bayarTargetId}/bayar`;

      await apiFetch(endpoint, {
        method: "POST",
        body: {
          tanggal: tglBayar,
          nominal: numNominal,
          keterangan: ketBayar
        }
      });
      setShowBayarModal(false);
      if (showDetailModal) {
        // Refresh detail modal if open
        const refreshedItems = activeTab === "hutang"
          ? await apiFetch<Hutang[]>("/hutang")
          : await apiFetch<Piutang[]>("/piutang");
        
        if (activeTab === "hutang") {
          setHutangList(refreshedItems);
          const found = refreshedItems.find(x => x.id === bayarTargetId);
          setShowDetailModal(found || null);
        } else {
          setPiutangList(refreshedItems as any);
          const found = (refreshedItems as any).find((x: any) => x.id === bayarTargetId);
          setShowDetailModal(found || null);
        }
      }
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Gagal memproses transaksi pembayaran");
    } finally {
      setLoading(false);
    }
  };

  // ─── DELETE ACTIONS ─────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId || !deleteType) return;
    try {
      setLoading(true);
      const endpoint = deleteType === "aset"
        ? `/aset/${deleteId}`
        : deleteType === "hutang"
          ? `/hutang/${deleteId}`
          : `/piutang/${deleteId}`;

      await apiFetch(endpoint, { method: "DELETE" });
      setDeleteId(null);
      setDeleteType(null);
      setShowDetailModal(null);
      loadData();
    } catch (e: any) {
      Alert.alert("Gagal Menghapus", e.message || "Data tidak bisa dihapus.");
    } finally {
      setLoading(false);
    }
  };

  const openForm = () => {
    if (!isAdmin) return;
    if (activeTab === "aset") {
      setNamaAset("");
      setTglAset(todayISO());
      setHargaAset("");
      setKetAset("");
      setShowAsetModal(true);
    } else if (activeTab === "hutang") {
      setNamaKreditor("");
      setTglHutang(todayISO());
      setJumlahHutang("");
      setKetHutang("");
      setShowHutangModal(true);
    } else {
      setNamaDebitur("");
      setTglPiutang(todayISO());
      setJumlahPiutang("");
      setKetPiutang("");
      setShowPiutangModal(true);
    }
  };

  // Format rupiah while typing
  const formatRupiahInput = (val: string) => {
    const clean = val.replace(/\D/g, "");
    if (!clean) return "";
    return new Intl.NumberFormat("id-ID").format(Number(clean));
  };

  // Calculations for summary card
  const summaryText = useMemo(() => {
    if (activeTab === "aset") {
      const sum = asetList.reduce((acc, it) => acc + it.harga_perolehan, 0);
      return { title: "Total Nilai Aset", val: rupiah(sum) };
    } else if (activeTab === "hutang") {
      const sum = hutangList.reduce((acc, it) => acc + it.sisa_hutang, 0);
      return { title: "Total Sisa Hutang", val: rupiah(sum) };
    } else {
      const sum = piutangList.reduce((acc, it) => acc + it.sisa_piutang, 0);
      return { title: "Total Sisa Piutang", val: rupiah(sum) };
    }
  }, [activeTab, asetList, hutangList, piutangList]);

  return (
    <ScreenContainer title="Aset & Kewajiban">
      {/* Tab Selectors */}
      <View style={styles.tabRow}>
        {(["aset", "hutang", "piutang"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{summaryText.title}</Text>
          <Text style={styles.summaryValue}>{summaryText.val}</Text>
        </Card>

        {/* Tab Aset Content */}
        {activeTab === "aset" && (
          asetList.length === 0 ? (
            <EmptyState icon="business-outline" title="Belum ada data aset" subtitle="Gunakan tombol + untuk menambah" />
          ) : (
            asetList.map((a) => (
              <Card key={a.id} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.text }}>{a.nama_aset}</Text>
                    <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 4 }}>
                      Perolehan: {formatTanggalID(a.tanggal_perolehan)}
                    </Text>
                    {!!a.keterangan && (
                      <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 6, fontStyle: "italic" }}>
                        "{a.keterangan}"
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.text }}>
                      {rupiah(a.harga_perolehan)}
                    </Text>
                    {isAdmin && (
                      <TouchableOpacity
                        style={{ marginTop: 16, padding: 6 }}
                        onPress={() => {
                          setDeleteId(a.id);
                          setDeleteType("aset");
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </Card>
            ))
          )
        )}

        {/* Tab Hutang Content */}
        {activeTab === "hutang" && (
          hutangList.length === 0 ? (
            <EmptyState icon="wallet-outline" title="Belum ada catatan hutang" subtitle="Gunakan tombol + untuk menambah" />
          ) : (
            hutangList.map((h) => (
              <TouchableOpacity key={h.id} onPress={() => setShowDetailModal(h)} activeOpacity={0.95}>
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.text }}>{h.nama_kreditor}</Text>
                        <Badge
                          label={h.status === "lunas" ? "LUNAS" : "BELUM LUNAS"}
                          variant={h.status === "lunas" ? "success" : "danger"}
                        />
                      </View>
                      <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 6 }}>
                        Pinjam: {formatTanggalID(h.tanggal_pinjam)}
                      </Text>
                      <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 6 }}>
                        Awal: <Text style={{ fontWeight: "600", color: Colors.text }}>{rupiah(h.jumlah_hutang)}</Text>
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Sisa Hutang</Text>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: h.status === "lunas" ? Colors.success : Colors.error, marginTop: 2 }}>
                        {rupiah(h.sisa_hutang)}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )
        )}

        {/* Tab Piutang Content */}
        {activeTab === "piutang" && (
          piutangList.length === 0 ? (
            <EmptyState icon="people-outline" title="Belum ada catatan piutang" subtitle="Gunakan tombol + untuk menambah" />
          ) : (
            piutangList.map((p) => (
              <TouchableOpacity key={p.id} onPress={() => setShowDetailModal(p)} activeOpacity={0.95}>
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.text }}>{p.nama_debitur}</Text>
                        <Badge
                          label={p.status === "lunas" ? "LUNAS" : "BELUM LUNAS"}
                          variant={p.status === "lunas" ? "success" : "danger"}
                        />
                      </View>
                      <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 6 }}>
                        Tanggal: {formatTanggalID(p.tanggal_piutang)}
                      </Text>
                      <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 6 }}>
                        Awal: <Text style={{ fontWeight: "600", color: Colors.text }}>{rupiah(p.jumlah_piutang)}</Text>
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Sisa Piutang</Text>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: p.status === "lunas" ? Colors.success : Colors.warning, marginTop: 2 }}>
                        {rupiah(p.sisa_piutang)}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )
        )}
      </ScrollView>

      {/* FAB - Add Button */}
      {isAdmin && <FAB onPress={openForm} />}

      {/* ────────────────── MODALS FORM ────────────────── */}

      {/* Modal Aset */}
      <Modal visible={showAsetModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <Card style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Tambah Aset Tetap</Text>
              <Input label="Nama Aset" value={namaAset} onChangeText={setNamaAset} placeholder="Misal: Mesin Pencacah Sampah" />
              <DatePickerField label="Tanggal Pembelian" value={tglAset} onChange={setTglAset} />
              <Input label="Harga Perolehan (Rp)" value={hargaAset} onChangeText={(text) => setHargaAset(formatRupiahInput(text))} keyboardType="numeric" placeholder="Rp 0" />
              <Input label="Keterangan (Opsional)" value={ketAset} onChangeText={setKetAset} multiline placeholder="Beli baru / bekas..." />

              <View style={styles.btnRow}>
                <Button title="Batal" onPress={() => setShowAsetModal(false)} variant="ghost" style={{ flex: 1 }} />
                <Button title="Simpan" onPress={handleSaveAset} style={{ flex: 1.5 }} />
              </View>
            </Card>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Hutang */}
      <Modal visible={showHutangModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <Card style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Catat Hutang Baru</Text>
              <Input label="Nama Kreditor (Pemberi Pinjaman)" value={namaKreditor} onChangeText={setNamaKreditor} placeholder="Nama Instansi / Perorangan" />
              <DatePickerField label="Tanggal Pinjam" value={tglHutang} onChange={setTglHutang} />
              <Input label="Jumlah Hutang (Rp)" value={jumlahHutang} onChangeText={(text) => setJumlahHutang(formatRupiahInput(text))} keyboardType="numeric" placeholder="Rp 0" />
              <Input label="Keterangan (Opsional)" value={ketHutang} onChangeText={setKetHutang} multiline placeholder="Hutang operasional..." />

              <View style={styles.btnRow}>
                <Button title="Batal" onPress={() => setShowHutangModal(false)} variant="ghost" style={{ flex: 1 }} />
                <Button title="Simpan" onPress={handleSaveHutang} style={{ flex: 1.5 }} />
              </View>
            </Card>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Piutang */}
      <Modal visible={showPiutangModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <Card style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Catat Piutang Baru</Text>
              <Input label="Nama Debitur (Penerima Pinjaman)" value={namaDebitur} onChangeText={setNamaDebitur} placeholder="Nama Pihak Luar / Pembeli" />
              <DatePickerField label="Tanggal Piutang" value={tglPiutang} onChange={setTglPiutang} />
              <Input label="Jumlah Piutang (Rp)" value={jumlahPiutang} onChangeText={(text) => setJumlahPiutang(formatRupiahInput(text))} keyboardType="numeric" placeholder="Rp 0" />
              <Input label="Keterangan (Opsional)" value={ketPiutang} onChangeText={setKetPiutang} multiline placeholder="Piutang komoditas..." />

              <View style={styles.btnRow}>
                <Button title="Batal" onPress={() => setShowPiutangModal(false)} variant="ghost" style={{ flex: 1 }} />
                <Button title="Simpan" onPress={handleSavePiutang} style={{ flex: 1.5 }} />
              </View>
            </Card>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Bayar Cicilan */}
      <Modal visible={showBayarModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <Card style={styles.modalSheet}>
              <Text style={styles.modalTitle}>
                {activeTab === "hutang" ? "Bayar Cicilan Hutang" : "Terima Pelunasan Piutang"}
              </Text>
              <Input label="Nominal (Rp)" value={nominalBayar} onChangeText={(text) => setNominalBayar(formatRupiahInput(text))} keyboardType="numeric" placeholder="Rp 0" />
              <DatePickerField label="Tanggal Transaksi" value={tglBayar} onChange={setTglBayar} />
              <Input label="Keterangan (Opsional)" value={ketBayar} onChangeText={setKetBayar} multiline placeholder="Cicilan ke-..." />

              <View style={styles.btnRow}>
                <Button title="Batal" onPress={() => setShowBayarModal(false)} variant="ghost" style={{ flex: 1 }} />
                <Button title="Proses" onPress={handleSaveBayar} style={{ flex: 1.5 }} />
              </View>
            </Card>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Detail Hutang / Piutang */}
      <Modal visible={showDetailModal !== null} transparent animationType="slide" onRequestClose={() => setShowDetailModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowDetailModal(null)}>
          <Pressable style={[styles.modalSheet, { maxHeight: "80%", width: "90%" }]} onPress={() => {}}>
            {showDetailModal && (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text }}>Detail Rekaman</Text>
                  <TouchableOpacity onPress={() => setShowDetailModal(null)} style={{ padding: 4 }}>
                    <Ionicons name="close" size={24} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Nama Pihak</Text>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.text, marginTop: 2 }}>
                    {activeTab === "hutang" ? showDetailModal.nama_kreditor : showDetailModal.nama_debitur}
                  </Text>

                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 10 }}>Pinjaman Awal / Tanggal</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.text, marginTop: 2 }}>
                    {rupiah(activeTab === "hutang" ? showDetailModal.jumlah_hutang : showDetailModal.jumlah_piutang)} (
                    {formatTanggalID(activeTab === "hutang" ? showDetailModal.tanggal_pinjam : showDetailModal.tanggal_piutang)})
                  </Text>

                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 10 }}>Sisa Tagihan Aktif</Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: showDetailModal.status === "lunas" ? Colors.success : Colors.error, marginTop: 2 }}>
                    {rupiah(activeTab === "hutang" ? showDetailModal.sisa_hutang : showDetailModal.sisa_piutang)}
                  </Text>
                </View>

                {/* Cicilan History */}
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 8 }}>
                  Riwayat Pembayaran
                </Text>
                <ScrollView style={{ maxHeight: 150, marginBottom: 16 }}>
                  {showDetailModal.riwayat_cicilan.length === 0 ? (
                    <Text style={{ fontSize: 13, color: Colors.textTertiary, fontStyle: "italic", textAlign: "center", paddingVertical: 10 }}>
                      Belum ada transaksi pembayaran.
                    </Text>
                  ) : (
                    showDetailModal.riwayat_cicilan.map((c: any) => (
                      <View key={c.id} style={styles.historyRow}>
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.text }}>{rupiah(c.nominal)}</Text>
                          <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>{formatTanggalID(c.tanggal)}</Text>
                        </View>
                        {!!c.keterangan && (
                          <Text style={{ fontSize: 12, color: Colors.textSecondary, fontStyle: "italic" }}>"{c.keterangan}"</Text>
                        )}
                      </View>
                    ))
                  )}
                </ScrollView>

                {/* Actions */}
                <View style={[styles.btnRow, { borderTopWidth: 1, borderColor: Colors.borderLight, paddingTop: 16 }]}>
                  {isAdmin && (
                    <TouchableOpacity
                      style={[styles.btnDanger, { flex: 1 }]}
                      onPress={() => {
                        setDeleteId(showDetailModal.id);
                        setDeleteType(activeTab);
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Hapus</Text>
                    </TouchableOpacity>
                  )}
                  {isAdmin && showDetailModal.status !== "lunas" && (
                    <Button
                      title={activeTab === "hutang" ? "Cicil" : "Terima Bayar"}
                      onPress={() => {
                        setNominalBayar("");
                        setTglBayar(todayISO());
                        setKetBayar("");
                        setBayarTargetId(showDetailModal.id);
                        setShowBayarModal(true);
                      }}
                      style={{ flex: 1.5 }}
                    />
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        visible={deleteId !== null}
        title="Hapus Rekaman?"
        message="Menghapus rekaman ini akan menghapus riwayat transaksinya dari kas harian."
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteId(null);
          setDeleteType(null);
        }}
      />
    </ScreenContainer>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 8
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: Colors.bg
  },
  tabBtnActive: {
    backgroundColor: Colors.primary
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary
  },
  tabTextActive: {
    color: Colors.textOnPrimary
  },
  summaryCard: {
    backgroundColor: Colors.primary + "12",
    borderColor: Colors.primary + "30",
    borderWidth: 1,
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 16
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.primary,
    marginTop: 6
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    padding: 20
  },
  modalSheet: {
    width: "100%",
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 20,
    elevation: 5
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 16,
    textAlign: "center"
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight
  },
  btnDanger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 12
  }
});
