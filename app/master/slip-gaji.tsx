import { useState, useMemo, useEffect } from "react";
import { ScrollView, View, Text, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button, Input, ConfirmDialog } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { useColors } from "@/src/lib/theme-context";
import { bulanLabel, rupiah } from "@/src/lib/format";
import { generateSlipGajiPdf } from "@/src/lib/pdf";

export default function SlipGajiScreen() {
  const Colors = useColors();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  
  const petugas_id = params.petugas_id as string;
  const nama = params.nama as string;
  const bulan = params.bulan as string; // YYYY-MM
  const hadir = parseInt(params.hadir as string || "0");
  const total_jam = parseFloat(params.total_jam as string || "0");

  const [gajiPokok, setGajiPokok] = useState("");
  const [tunjangan, setTunjangan] = useState("");
  const [potongan, setPotongan] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLunas, setIsLunas] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [gajiId, setGajiId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const gaji = await apiFetch(`/gaji/${petugas_id}?periode=${bulan}`);
        if (gaji) {
          setGajiId(gaji.id);
          setGajiPokok(gaji.gaji_pokok.toString());
          setTunjangan(gaji.tunjangan.toString());
          setPotongan(gaji.potongan.toString());
          setKeterangan(gaji.keterangan || "");
          setIsLunas(true);
        }
      } catch (e) {
        // Not found, normal flow
      } finally {
        setInitLoading(false);
      }
    }
    load();
  }, [petugas_id, bulan]);

  const numGajiPokok = Number(gajiPokok.replace(/[^0-9.-]+/g,"")) || 0;
  const numTunjangan = Number(tunjangan.replace(/[^0-9.-]+/g,"")) || 0;
  const numPotongan = Number(potongan.replace(/[^0-9.-]+/g,"")) || 0;
  const totalBersih = numGajiPokok + numTunjangan - numPotongan;

  const handleCetak = async () => {
    await generateSlipGajiPdf({
      nama,
      periodeLabel: bulanLabel(bulan),
      hadir,
      total_jam,
      gaji_pokok: numGajiPokok,
      tunjangan: numTunjangan,
      potongan: numPotongan,
      total_bersih: totalBersih,
      adminName: user?.nama || "Admin"
    });
  };

  const confirmDelete = async () => {
    if (!gajiId) return;
    try {
      setLoading(true);
      setShowConfirm(false);
      await apiFetch(`/gaji/${gajiId}`, { method: "DELETE" });
      Alert.alert("Sukses", "Slip gaji berhasil dihapus.");
      router.back();
    } catch (e: any) {
      Alert.alert("Gagal", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleHapus = () => {
    if (!gajiId) {
      Alert.alert("Error", "ID Slip Gaji tidak ditemukan. Silakan refresh halaman.");
      return;
    }
    setShowConfirm(true);
  };

  const handleSimpan = async () => {
    if (numGajiPokok <= 0) {
      Alert.alert("Error", "Gaji Pokok harus lebih dari 0");
      return;
    }

    try {
      setLoading(true);
      await apiFetch("/gaji", {
        method: "POST",
        body: {
          petugas_id,
          periode: bulan,
          gaji_pokok: numGajiPokok,
          tunjangan: numTunjangan,
          potongan: numPotongan,
          total_bersih: totalBersih,
          keterangan
        }
      });

      await handleCetak();

      Alert.alert("Sukses", "Slip gaji berhasil dibuat dan dicatat di keuangan.", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert("Gagal", e.message);
    } finally {
      setLoading(false);
    }
  };

  if (initLoading) return <View style={{flex: 1, justifyContent: "center"}}><ActivityIndicator size="large" color={Colors.primary}/></View>;

  return (
    <ScreenContainer title={isLunas ? "Detail Slip Gaji" : "Buat Slip Gaji"}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        
        <Card style={{ marginBottom: 16, backgroundColor: Colors.infoBg }}>
          <Text style={{ fontSize: 13, color: Colors.info, fontWeight: "700", marginBottom: 8 }}>INFORMASI PETUGAS & ABSENSI</Text>
          <View style={styles.row}>
            <Text style={{ color: Colors.text }}>Nama Petugas</Text>
            <Text style={{ fontWeight: "700", color: Colors.text }}>{nama}</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ color: Colors.text }}>Periode</Text>
            <Text style={{ fontWeight: "700", color: Colors.text }}>{bulanLabel(bulan)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ color: Colors.text }}>Total Kehadiran</Text>
            <Text style={{ fontWeight: "700", color: Colors.success }}>{hadir} hari</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ color: Colors.text }}>Total Jam Kerja</Text>
            <Text style={{ fontWeight: "700", color: Colors.primary }}>{total_jam} jam</Text>
          </View>
        </Card>

        <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 12, marginLeft: 4 }}>
          {isLunas ? "Rincian Gaji (Telah Dibayar)" : "Input Komponen Gaji"}
        </Text>
        
        <Input 
          label="Gaji Pokok (Rp)" 
          keyboardType="numeric" 
          placeholder="0"
          value={gajiPokok} 
          onChangeText={setGajiPokok} 
          editable={!isLunas}
        />
        <Input 
          label="Tunjangan (Opsional)" 
          keyboardType="numeric" 
          placeholder="0"
          value={tunjangan} 
          onChangeText={setTunjangan} 
          editable={!isLunas}
        />
        <Input 
          label="Potongan / Kasbon (Opsional)" 
          keyboardType="numeric" 
          placeholder="0"
          value={potongan} 
          onChangeText={setPotongan} 
          editable={!isLunas}
        />
        <Input 
          label="Keterangan (Opsional)" 
          placeholder="Catatan tambahan"
          value={keterangan} 
          onChangeText={setKeterangan} 
          editable={!isLunas}
        />

        <Card style={{ marginTop: 16, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary }}>
          <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: "700" }}>TOTAL BERSIH DITERIMA</Text>
          <Text style={{ fontSize: 28, fontWeight: "800", color: Colors.primary, marginTop: 4 }}>
            {rupiah(totalBersih)}
          </Text>
        </Card>

        <View style={{ marginTop: 24 }}>
          {isLunas ? (
            <>
              <Button title="Cetak Ulang PDF" icon="print-outline" onPress={handleCetak} />
              <View style={{ height: 12 }} />
              <Button 
                title="Hapus Slip Gaji" 
                icon="trash-outline" 
                variant="danger" 
                onPress={handleHapus} 
                disabled={loading}
              />
            </>
          ) : loading ? (
            <ActivityIndicator size="large" color={Colors.primary} />
          ) : (
            <Button title="Simpan & Cetak Slip" icon="print-outline" onPress={handleSimpan} />
          )}
        </View>

        <ConfirmDialog
          visible={showConfirm}
          title="Konfirmasi Hapus"
          message="Apakah Anda yakin ingin menghapus slip gaji ini? Transaksi pengeluaran terkait juga akan dihapus dari laporan keuangan."
          onCancel={() => setShowConfirm(false)}
          onConfirm={confirmDelete}
          confirmText="Hapus"
        />

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }
});