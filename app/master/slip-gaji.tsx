import { useState, useMemo, useEffect } from "react";
import { ScrollView, View, Text, StyleSheet, Alert, ActivityIndicator, Image, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button, Input, ConfirmDialog, AlertDialog } from "@/src/components/ui";
import { ImagePickerField } from "@/src/components/image-picker";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { useColors } from "@/src/lib/theme-context";
import { bulanLabel, rupiah, formatRupiahInput } from "@/src/lib/format";
import { generateSlipGajiPdf } from "@/src/lib/pdf";

export default function SlipGajiScreen() {
  const Colors = useColors();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  
  const petugas_id = params.petugas_id as string;
  const nama = params.nama as string;
  const bulan = params.bulan as string; // YYYY-MM
  const hadir = parseInt(params.hadir as string || "0");
  const absen = parseInt(params.absen as string || "0");
  const izin = parseInt(params.izin as string || "0");
  const sakit = parseInt(params.sakit as string || "0");
  const total_jam = parseFloat(params.total_jam as string || "0");

  const targetJamSebulan = hadir * 8;
  const deficitJam = Math.max(0, targetJamSebulan - total_jam);
  const extraJam = Math.max(0, total_jam - targetJamSebulan);
  
  const dendaTelat = deficitJam * 8300;
  const uangLembur = extraJam * 8300;
  const baseGaji = targetJamSebulan * 8300;
  const dendaAlpha = absen * 66400;

  const initGajiPokok = baseGaji + uangLembur;
  const initPotongan = dendaTelat + dendaAlpha;

  const [gajiPokok, setGajiPokok] = useState(() => formatRupiahInput(Math.round(initGajiPokok).toString()));
  const [tunjangan, setTunjangan] = useState("");
  const [potongan, setPotongan] = useState(() => initPotongan > 0 ? formatRupiahInput(Math.round(initPotongan).toString()) : "");
  const [keterangan, setKeterangan] = useState(() => {
    let ket = [];
    if (dendaAlpha > 0) ket.push(`Potongan Alpha (${absen} hari)`);
    if (dendaTelat > 0) ket.push(`Potongan Keterlambatan (${deficitJam.toFixed(2)} jam)`);
    if (uangLembur > 0) ket.push(`Termasuk lembur (${extraJam.toFixed(2)} jam)`);
    return ket.join(", ");
  });
  const [buktiUrl, setBuktiUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLunas, setIsLunas] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [gajiId, setGajiId] = useState<string | null>(null);
  const [kasbonIds, setKasbonIds] = useState<string[]>([]);
  const [kasbonDetails, setKasbonDetails] = useState<any[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    variant: "primary" | "danger" | "outline";
    onConfirm?: () => void;
  }>({ visible: false, title: "", message: "", variant: "primary" });

  useEffect(() => {
    async function load() {
      try {
        let kasbons: any[] = [];
        try {
          kasbons = await apiFetch(`/kasbon/pending/${petugas_id}`);
        } catch(e) {}
        
        let pot = initPotongan;
        let ketList: string[] = [];
        if (dendaAlpha > 0) ketList.push(`Potongan Alpha (${absen} hari)`);
        if (dendaTelat > 0) ketList.push(`Potongan Keterlambatan (${deficitJam.toFixed(2)} jam)`);
        if (uangLembur > 0) ketList.push(`Termasuk lembur (${extraJam.toFixed(2)} jam)`);

        let kIds: string[] = [];
        if (kasbons && kasbons.length > 0) {
           setKasbonDetails(kasbons);
           const sumKasbon = kasbons.reduce((acc: number, k: any) => acc + k.nominal, 0);
           pot += sumKasbon;
           kasbons.forEach((k: any) => kIds.push(k.id));
           ketList.push(`Potongan Kasbon (Rp ${sumKasbon.toLocaleString("id-ID")})`);
        }

        const gaji = await apiFetch(`/gaji/${petugas_id}?periode=${bulan}`);
        if (gaji) {
          setGajiId(gaji.id);
          setGajiPokok(formatRupiahInput(gaji.gaji_pokok.toString()));
          setTunjangan(formatRupiahInput(gaji.tunjangan.toString()));
          setPotongan(formatRupiahInput(gaji.potongan.toString()));
          setKeterangan(gaji.keterangan || "");
          setBuktiUrl(gaji.bukti_url || "");
          setIsLunas(true);
        } else {
           if (kasbons && kasbons.length > 0) {
               setPotongan(formatRupiahInput(Math.round(pot).toString()));
               setKeterangan(ketList.join(", "));
               setKasbonIds(kIds);
           }
        }
      } catch (e) {
        // Not found, normal flow
      } finally {
        setInitLoading(false);
      }
    }
    load();
  }, [petugas_id, bulan]);

  const numGajiPokok = Number(gajiPokok.replace(/[^0-9-]/g,"")) || 0;
  const numTunjangan = Number(tunjangan.replace(/[^0-9-]/g,"")) || 0;
  const numPotongan = Number(potongan.replace(/[^0-9-]/g,"")) || 0;
  const totalBersih = numGajiPokok + numTunjangan - numPotongan;

  const handleCetak = async () => {
    await generateSlipGajiPdf({
      nama,
      periodeLabel: bulanLabel(bulan),
      hadir,
      absen,
      izin,
      sakit,
      total_jam,
      gaji_pokok: numGajiPokok,
      tunjangan: numTunjangan,
      potongan: numPotongan,
      total_bersih: totalBersih,
      keterangan: keterangan,
      adminName: user?.nama || "Admin"
    });
  };

  const confirmDelete = async () => {
    if (!gajiId) return;
    try {
      setLoading(true);
      setShowConfirm(false);
      await apiFetch(`/gaji/${gajiId}`, { method: "DELETE" });
      setAlertConfig({
        visible: true,
        title: "Sukses",
        message: "Slip gaji berhasil dihapus.",
        variant: "primary",
        onConfirm: () => router.back()
      });
    } catch (e: any) {
      setAlertConfig({ visible: true, title: "Gagal", message: e.message, variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const handleHapus = () => {
    if (!gajiId) {
      setAlertConfig({ visible: true, title: "Error", message: "ID Slip Gaji tidak ditemukan. Silakan refresh halaman.", variant: "danger" });
      return;
    }
    setShowConfirm(true);
  };

  const handleSimpan = async () => {
    if (numGajiPokok <= 0) {
      setAlertConfig({ visible: true, title: "Error", message: "Gaji Pokok harus lebih dari 0", variant: "danger" });
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
          keterangan,
          bukti_url: buktiUrl,
          kasbon_ids: kasbonIds
        }
      });

      await handleCetak();

      setAlertConfig({
        visible: true,
        title: "Sukses",
        message: "Slip gaji berhasil dibuat dan dicatat di keuangan.",
        variant: "primary",
        onConfirm: () => router.back()
      });
    } catch (e: any) {
      setAlertConfig({ visible: true, title: "Gagal", message: e.message, variant: "danger" });
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
            <Text style={{ color: Colors.text }}>Total Hadir</Text>
            <Text style={{ fontWeight: "700", color: Colors.success }}>{hadir} hari</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ color: Colors.text }}>Total Izin</Text>
            <Text style={{ fontWeight: "700", color: Colors.warning }}>{izin} hari</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ color: Colors.text }}>Total Sakit</Text>
            <Text style={{ fontWeight: "700", color: Colors.info }}>{sakit} hari</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ color: Colors.text }}>Total Absen</Text>
            <Text style={{ fontWeight: "700", color: Colors.error }}>{absen} hari</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ color: Colors.text }}>Total Jam Kerja</Text>
            <Text style={{ fontWeight: "700", color: Colors.primary }}>{Number(total_jam || 0).toFixed(2)} jam</Text>
          </View>
        </Card>

        <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 12, marginLeft: 4 }}>
          {isLunas ? "Rincian Gaji (Telah Dibayar)" : "Input Komponen Gaji (Otomatis)"}
        </Text>
        
        <Input 
          label="Gaji Pokok (Rp)" 
          keyboardType="numeric" 
          placeholder="Rp 0"
          value={gajiPokok} 
          onChangeText={(text) => setGajiPokok(formatRupiahInput(text))} 
          editable={!isLunas}
        />
        <Input 
          label="Tunjangan (Opsional)" 
          keyboardType="numeric" 
          placeholder="Rp 0"
          value={tunjangan} 
          onChangeText={(text) => setTunjangan(formatRupiahInput(text))} 
          editable={!isLunas}
        />
        <View>
              <Input
                label="Potongan (Rp)"
                placeholder="0"
                keyboardType="number-pad"
                value={potongan}
                onChangeText={(val) => {
                  if (!isLunas) setPotongan(formatRupiahInput(val));
                }}
                editable={!isLunas}
              />
              {!isLunas && kasbonDetails.length > 0 && (
                <View style={{ backgroundColor: Colors.warningBg, padding: 12, borderRadius: 8, marginTop: -12, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.warning, marginBottom: 4 }}>
                    Peringatan Kasbon
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.warning }}>
                    Petugas ini memiliki {kasbonDetails.length} pinjaman kasbon yang belum lunas (total Rp {kasbonDetails.reduce((a, b) => a + b.nominal, 0).toLocaleString('id-ID')}). Nilai ini sudah otomatis ditambahkan ke kolom Potongan dan Keterangan. Saat slip gaji disimpan, kasbon akan otomatis dilunasi.
                  </Text>
                </View>
              )}
            </View>
        <Input 
          label="Keterangan (Opsional)" 
          placeholder="Catatan tambahan"
          value={keterangan} 
          onChangeText={setKeterangan} 
          editable={!isLunas}
        />

        {!isLunas && (
          <View style={{ marginTop: 12 }}>
            <ImagePickerField label="Upload Bukti Transfer (Opsional)" value={buktiUrl} onChange={setBuktiUrl} />
          </View>
        )}

        {isLunas && buktiUrl ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", marginBottom: 8, color: Colors.text }}>Bukti Transfer:</Text>
            <TouchableOpacity onPress={() => setShowImageZoom(true)}>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <Image source={{ uri: buktiUrl }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
              </Card>
            </TouchableOpacity>
          </View>
        ) : null}

        <Card style={{ marginTop: 16, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary }}>
          <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: "700" }}>TOTAL BERSIH DITERIMA</Text>
          <Text style={{ fontSize: 28, fontWeight: "800", color: Colors.primary, marginTop: 4 }}>
            {rupiah(totalBersih)}
          </Text>
        </Card>

        <View style={{ marginTop: 24 }}>
          {isLunas ? (
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Button title="Cetak Ulang PDF" icon="print-outline" onPress={handleCetak} />
              </View>
              <View style={{ flex: 1 }}>
                <Button 
                  title="Hapus Slip Gaji" 
                  icon="trash-outline" 
                  variant="danger" 
                  onPress={handleHapus} 
                  disabled={loading}
                />
              </View>
            </View>
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

        {/* Zoom Image Modal */}
        <Modal visible={showImageZoom} transparent animationType="fade" onRequestClose={() => setShowImageZoom(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}
              maximumZoomScale={5}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={{ width: '100%', height: '100%' }}
            >
              <Image 
                source={{ uri: buktiUrl }} 
                style={{ width: 350, height: 600 }} 
                resizeMode="contain" 
              />
            </ScrollView>
            <TouchableOpacity 
              onPress={() => setShowImageZoom(false)}
              style={{ position: 'absolute', top: 50, right: 20, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 24 }}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>

        <AlertDialog
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          variant={alertConfig.variant as any}
          onConfirm={() => {
            setAlertConfig(prev => ({ ...prev, visible: false }));
            if (alertConfig.onConfirm) alertConfig.onConfirm();
          }}
        />

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }
});