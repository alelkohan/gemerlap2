import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/src/components/screen-header";
import { Input, Button, PickerModal } from "@/src/components/ui";
import { DatePickerField } from "@/src/components/date-picker";
import { ImagePickerField } from "@/src/components/image-picker";
import { apiFetch } from "@/src/lib/api";
import { todayISO, rupiah, formatRupiahInput } from "@/src/lib/format";
import { useColors } from "@/src/lib/theme-context";

type Jenis = { id: string; nama: string; tipe: string };
type Tipe = "penjualan" | "sumber lain" | "retribusi" | "pengeluaran";
const KATEGORI = ["Operasional", "Peralatan", "Konsumsi", "Transport", "Lain-lain"];

export default function KeuanganForm() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const editing = !!id;

  const [tipe, setTipe] = useState<Tipe>("penjualan");
  const [cartItems, setCartItems] = useState<any[]>([]);
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
  const [buktiUrl, setBuktiUrl] = useState("");
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
        setHarga(cur.harga_per_kg ? formatRupiahInput(String(cur.harga_per_kg)) : "");
        setNominal(cur.total ? formatRupiahInput(String(cur.total)) : "");
        setKategori(cur.kategori || "");
        setKeterangan(cur.keterangan || "");
        setBuktiUrl(cur.bukti_url || "");
      }
    })();
  }, [id, editing]);

  const totalPenjualan = useMemo(() => {
    const b = parseFloat(bobot.replace(",", "."));
    const h = parseFloat(harga.replace(/[^0-9]/g, ""));
    if (isNaN(b) || isNaN(h)) return 0;
    return b * h;
  }, [bobot, harga]);

  
  const handleAddToCart = () => {
    const b = parseFloat(bobot.replace(",", "."));
    const h = parseFloat(harga.replace(/[^0-9]/g, ""));
    if (!jenisId) return Alert.alert("Error", "Pilih jenis komoditas");
    if (!b || b <= 0) return Alert.alert("Error", "Berat tidak valid");
    if (!h || h <= 0) return Alert.alert("Error", "Harga tidak valid");
    
    setCartItems([...cartItems, {
      jenis_sampah_id: jenisId,
      jenis_sampah_nama: jenisName,
      bobot_kg: b,
      harga_per_kg: h,
      total: b * h
    }]);
    
    setJenisId("");
    setJenisName("");
    setBobot("");
    setHarga("");
  };

  const removeCartItem = (index: number) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    let body: any = { tanggal, tipe };
    if (tipe === "penjualan") {
      if (!namaPihak.trim()) return Alert.alert("Error", "Nama pembeli wajib diisi");
      if (!editing && cartItems.length === 0) {
        // Automatically add to cart if filled, or alert
        const b = parseFloat(bobot.replace(",", "."));
        const h = parseFloat(harga.replace(/[^0-9]/g, ""));
        if (jenisId && b > 0 && h > 0) {
           cartItems.push({ jenis_sampah_id: jenisId, jenis_sampah_nama: jenisName, bobot_kg: b, harga_per_kg: h, total: b*h });
        } else {
           return Alert.alert("Error", "Keranjang komoditas masih kosong. Tambahkan minimal 1 komoditas.");
        }
      }
      
      if (editing) {
        const b = parseFloat(bobot.replace(",", "."));
        const h = parseFloat(harga.replace(/[^0-9]/g, ""));
        if (!b || b <= 0) return Alert.alert("Error", "Berat tidak valid");
        if (!h || h <= 0) return Alert.alert("Error", "Harga tidak valid");
        body = { ...body, jenis_sampah_id: jenisId, nama_pihak: namaPihak, bobot_kg: b, harga_per_kg: h, total: b * h, keterangan, bukti_url: buktiUrl };
      } else {
        body = { ...body, nama_pihak: namaPihak, keterangan, bukti_url: buktiUrl, items: cartItems };
      }
    } else if (tipe === "sumber lain") {
      const n = parseFloat(nominal.replace(/[^0-9]/g, ""));
      if (!namaPihak.trim()) return Alert.alert("Error", "Sumber pemasukan wajib diisi");
      if (!n || n <= 0) return Alert.alert("Error", "Nominal tidak valid");
      body = { ...body, nama_pihak: namaPihak, total: n, keterangan, bukti_url: buktiUrl };
    } else if (tipe === "retribusi") {
      const n = parseFloat(nominal.replace(/[^0-9]/g, ""));
      if (!n || n <= 0) return Alert.alert("Error", "Nominal tidak valid");
      body = { ...body, nama_pihak: "Yayasan", total: n, keterangan, bukti_url: buktiUrl };
    } else {
      const n = parseFloat(nominal.replace(/[^0-9]/g, ""));
      if (!kategori) return Alert.alert("Error", "Kategori wajib diisi");
      if (!n || n <= 0) return Alert.alert("Error", "Nominal tidak valid");
      body = { ...body, kategori, total: n, keterangan, bukti_url: buktiUrl };
    }
    setLoading(true);
    try {
      if (editing) {
        await apiFetch(`/keuangan/${id}`, { method: "PUT", body });
      } else {
        if (tipe === "penjualan") {
            await apiFetch(`/keuangan/bulk_penjualan`, { method: "POST", body });
        } else {
            await apiFetch(`/keuangan`, { method: "POST", body });
        }
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
          {(["penjualan", "sumber lain", "retribusi", "pengeluaran"] as Tipe[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTipe(t)}
              style={[styles.segment, tipe === t && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, tipe === t && styles.segmentTextActive]}>
                {t === "penjualan" ? "Penjualan" : t === "sumber lain" ? "Sumber Lain" : t === "retribusi" ? "Retribusi" : "Pengeluaran"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <DatePickerField label="Tanggal" value={tanggal} onChange={setTanggal} />

        {tipe === "penjualan" && (
          <>
            <Input label="Nama Pembeli" value={namaPihak} onChangeText={setNamaPihak} placeholder="Nama / Instansi pembeli" />
            <Input label="Keterangan (opsional)" value={keterangan} onChangeText={setKeterangan} multiline />
            
            <View style={{ marginVertical: 16, height: 1, backgroundColor: Colors.borderLight }} />
            
            {!editing && cartItems.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.label}>Keranjang Komoditas</Text>
                {cartItems.map((item, idx) => (
                   <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight }}>
                     <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: Colors.text }}>{item.jenis_sampah_nama}</Text>
                        <Text style={{ fontSize: 12, color: Colors.textSecondary }}>{item.bobot_kg} kg x {rupiah(item.harga_per_kg)}</Text>
                     </View>
                     <Text style={{ fontWeight: '800', color: Colors.text, marginRight: 12 }}>{rupiah(item.total)}</Text>
                     <TouchableOpacity onPress={() => removeCartItem(idx)} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                     </TouchableOpacity>
                   </View>
                ))}
              </View>
            )}
            
            <Text style={styles.label}>{editing ? "Jenis Komoditas" : "Tambah Komoditas ke Keranjang"}</Text>
            <View style={{ backgroundColor: Colors.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight }}>
                <TouchableOpacity onPress={() => setShowJenis(true)} style={[styles.pickerBtn, { paddingVertical: 10, paddingHorizontal: 12 }]}>
                  <Ionicons name="leaf-outline" size={16} color={Colors.textSecondary} />
                  <Text style={{ flex: 1, color: jenisName ? Colors.text : Colors.textTertiary, fontSize: 14 }}>
                    {jenisName || "Pilih komoditas"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
                <View style={{ marginTop: 10 }} />
                
                <View style={{ flexDirection: 'row', gap: 10 }}>
                   <View style={{ flex: 1 }}>
                     <Input label="Berat (kg)" value={bobot} onChangeText={setBobot} keyboardType="decimal-pad" placeholder="0.0" />
                   </View>
                   <View style={{ flex: 1 }}>
                     <Input label="Harga/kg (Rp)" value={harga} onChangeText={(text) => setHarga(formatRupiahInput(text))} keyboardType="numeric" placeholder="Rp 0" />
                   </View>
                </View>
                
                {!editing && (
                    <View style={{ marginTop: 4 }}>
                      <Button title="Tambahkan ke Keranjang" onPress={handleAddToCart} variant="outline" />
                    </View>
                )}
            </View>

            <View style={[styles.totalBox, { marginTop: 16 }]}>
              <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: "700", textTransform: "uppercase" }}>Total Seluruh Penjualan</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.primary, marginTop: 4 }}>
                {editing ? rupiah(totalPenjualan) : rupiah(cartItems.reduce((acc, it) => acc + it.total, 0) + (totalPenjualan || 0))}
              </Text>
            </View>
          </>
        )}

        {tipe === "sumber lain" && (
          <>
            <Input label="Sumber Pemasukan" value={namaPihak} onChangeText={setNamaPihak} placeholder="Nama donatur / instansi / sumber" />
            <Input label="Nominal (Rp)" value={nominal} onChangeText={(text) => setNominal(formatRupiahInput(text))} keyboardType="numeric" placeholder="Rp 0" />
            <Input label="Keterangan (opsional)" value={keterangan} onChangeText={setKeterangan} multiline />
          </>
        )}

        {tipe === "retribusi" && (
          <>
            <Input label="Nominal dari Yayasan (Rp)" value={nominal} onChangeText={(text) => setNominal(formatRupiahInput(text))} keyboardType="numeric" placeholder="Rp 0" />
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
            <Input label="Nominal (Rp)" value={nominal} onChangeText={(text) => setNominal(formatRupiahInput(text))} keyboardType="numeric" placeholder="Rp 0" />
          </>
        )}

        <View style={{ marginTop: 12 }}>
          <ImagePickerField label="Upload Struk / Nota (Opsional)" value={buktiUrl} onChange={setBuktiUrl} />
        </View>

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
