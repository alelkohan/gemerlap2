import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/src/components/screen-header";
import { Input, Button, PickerModal } from "@/src/components/ui";
import { DatePickerField } from "@/src/components/date-picker";
import { apiFetch } from "@/src/lib/api";
import { todayISO, rupiah } from "@/src/lib/format";
import { useColors } from "@/src/lib/theme-context";

type Jenis = { id: string; nama: string; tipe: string };
type Tipe = "penjualan" | "sumber lain" | "pengeluaran";
const KATEGORI = ["Operasional", "Peralatan", "Konsumsi", "Transport", "Lain-lain"];

export default function KeuanganForm() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const editing = !!id;

  const [tipe, setTipe] = useState<Tipe>("penjualan");
  const [tanggal, setTanggal] = useState(todayISO());
  const [jenisId, setJenisId] = useState("");
  const [jenisName, setJenisName] = useState("");
  const [namaPihak, setNamaPihak] = useState("");
  const [bobot, setBobot] = useState("");
  const [harga, setHarga] = useState("");
  const [nominal, setNominal] = useState("");
  const [kategori, setKategori] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [jenisList, setJenisList] = useState<Jenis[]>([]);
  const [showJenis, setShowJenis] = useState(false);
  const [showKategori, setShowKategori] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const j = await apiFetch<Jenis[]>("/jenis-sampah");
      setJenisList(j.filter((x) => x.tipe === "komoditas"));
      if (editing) {
        const cur = await apiFetch<any>(`/keuangan/${id}`);
        setTipe(cur.tipe);
        setTanggal(cur.tanggal);
        setJenisId(cur.jenis_sampah_id || "");
        setJenisName(cur.jenis_sampah_nama || j.find((x) => x.id === cur.jenis_sampah_id)?.nama || "");
        setNamaPihak(cur.nama_pihak || "");
        setBobot(cur.bobot_kg ? String(cur.bobot_kg) : "");
        setHarga(cur.harga_per_kg ? String(cur.harga_per_kg) : "");
        setNominal(String(cur.total || ""));
        setKategori(cur.kategori || "");
        setKeterangan(cur.keterangan || "");
      }
    })();
  }, [id, editing]);

  const totalPenjualan = useMemo(() => {
    const b = parseFloat(bobot.replace(",", "."));
    const h = parseFloat(harga.replace(/[^0-9.]/g, ""));
    if (isNaN(b) || isNaN(h)) return 0;
    return b * h;
  }, [bobot, harga]);

  const handleSave = async () => {
    let body: any = { tanggal, tipe };
    if (tipe === "penjualan") {
      const b = parseFloat(bobot.replace(",", "."));
      const h = parseFloat(harga.replace(/[^0-9.]/g, ""));
      if (!jenisId) return Alert.alert("Error", "Pilih jenis komoditas");
      if (!namaPihak.trim()) return Alert.alert("Error", "Nama pembeli wajib diisi");
      if (!b || b <= 0) return Alert.alert("Error", "Berat tidak valid");
      if (!h || h <= 0) return Alert.alert("Error", "Harga tidak valid");
      body = { ...body, jenis_sampah_id: jenisId, nama_pihak: namaPihak, bobot_kg: b, harga_per_kg: h, total: b * h, keterangan };
    } else if (tipe === "sumber lain") {
      const n = parseFloat(nominal.replace(/[^0-9.]/g, ""));
      if (!namaPihak.trim()) return Alert.alert("Error", "Sumber pemasukan wajib diisi");
      if (!n || n <= 0) return Alert.alert("Error", "Nominal tidak valid");
      body = { ...body, nama_pihak: namaPihak, total: n, keterangan };
    } else {
      const n = parseFloat(nominal.replace(/[^0-9.]/g, ""));
      if (!kategori) return Alert.alert("Error", "Kategori wajib diisi");
      if (!n || n <= 0) return Alert.alert("Error", "Nominal tidak valid");
      body = { ...body, kategori, total: n, keterangan };
    }
    setLoading(true);
    try {
      if (editing) {
        await apiFetch(`/keuangan/${id}`, { method: "PUT", body });
      } else {
        await apiFetch(`/keuangan`, { method: "POST", body });
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer title={editing ? "Edit Transaksi" : "Tambah Transaksi"}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Jenis Transaksi</Text>
        <View style={styles.segmentRow}>
          {(["penjualan", "sumber lain", "pengeluaran"] as Tipe[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTipe(t)}
              style={[styles.segment, tipe === t && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, tipe === t && styles.segmentTextActive]}>
                {t === "penjualan" ? "Penjualan" : t === "sumber lain" ? "Sumber Lain" : "Pengeluaran"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <DatePickerField label="Tanggal" value={tanggal} onChange={setTanggal} />

        {tipe === "penjualan" && (
          <>
            <Text style={styles.label}>Jenis Komoditas</Text>
            <TouchableOpacity onPress={() => setShowJenis(true)} style={styles.pickerBtn}>
              <Ionicons name="leaf-outline" size={18} color={Colors.textSecondary} />
              <Text style={{ flex: 1, color: jenisName ? Colors.text : Colors.textTertiary, fontSize: 15 }}>
                {jenisName || "Pilih komoditas"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <View style={{ marginTop: 14 }} />
            <Input label="Nama Pembeli" value={namaPihak} onChangeText={setNamaPihak} placeholder="Nama / Instansi pembeli" />
            <Input label="Berat (kg)" value={bobot} onChangeText={setBobot} keyboardType="decimal-pad" placeholder="0.0" />
            <Input label="Harga per kg (Rp)" value={harga} onChangeText={setHarga} keyboardType="numeric" placeholder="0" />
            <View style={styles.totalBox}>
              <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: "700", textTransform: "uppercase" }}>Total</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.primary, marginTop: 4 }}>
                {rupiah(totalPenjualan)}
              </Text>
            </View>
            <Input label="Keterangan (opsional)" value={keterangan} onChangeText={setKeterangan} multiline />
          </>
        )}

        {tipe === "sumber lain" && (
          <>
            <Input label="Sumber Pemasukan" value={namaPihak} onChangeText={setNamaPihak} placeholder="Nama donatur / instansi / sumber" />
            <Input label="Nominal (Rp)" value={nominal} onChangeText={setNominal} keyboardType="numeric" placeholder="0" />
            <Input label="Keterangan (opsional)" value={keterangan} onChangeText={setKeterangan} multiline />
          </>
        )}

        {tipe === "pengeluaran" && (
          <>
            <Text style={styles.label}>Kategori</Text>
            <TouchableOpacity onPress={() => setShowKategori(true)} style={styles.pickerBtn}>
              <Ionicons name="pricetag-outline" size={18} color={Colors.textSecondary} />
              <Text style={{ flex: 1, color: kategori ? Colors.text : Colors.textTertiary, fontSize: 15 }}>
                {kategori || "Pilih kategori"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <View style={{ marginTop: 14 }} />
            <Input label="Keterangan Detail" value={keterangan} onChangeText={setKeterangan} multiline placeholder="Untuk pembelian sapu, dll..." />
            <Input label="Nominal (Rp)" value={nominal} onChangeText={setNominal} keyboardType="numeric" placeholder="0" />
          </>
        )}

        <View style={{ marginTop: 12 }}>
          <Button title="Simpan Transaksi" onPress={handleSave} loading={loading} />
        </View>
      </ScrollView>

      <PickerModal
        visible={showJenis}
        title="Pilih Komoditas"
        items={jenisList}
        selectedId={jenisId}
        onSelect={(j) => {
          setJenisId(j.id);
          setJenisName(j.nama);
        }}
        onClose={() => setShowJenis(false)}
      />
      <PickerModal
        visible={showKategori}
        title="Pilih Kategori"
        items={KATEGORI.map((k) => ({ id: k, nama: k }))}
        selectedId={kategori}
        onSelect={(k) => setKategori(k.id)}
        onClose={() => setShowKategori(false)}
      />
    </ScreenContainer>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 6 },
  segmentRow: { flexDirection: "row", backgroundColor: Colors.borderLight, borderRadius: 12, padding: 4, marginBottom: 14 },
  segment: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 8 },
  segmentActive: { backgroundColor: Colors.surface },
  segmentText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  segmentTextActive: { color: Colors.primary },
  pickerBtn: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  totalBox: {
    backgroundColor: Colors.successBg,
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
  },
});
