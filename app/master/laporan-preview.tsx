import { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { useColors } from "@/src/lib/theme-context";
import { rupiah, formatTanggalID, bulanLabel } from "@/src/lib/format";
import {
  generateLaporanTimbanganPdf,
  generateLaporanKeuanganPdf,
  generateLaporanAbsensiPdf,
  generateLaporanAbsensiDetailPdf,
  generateLaporanPenjualanPdf,
  generateLaporanNeracaMassaPdf,
  generateLaporanNeracaSkontroPdf,
  generateLaporanLabaRugiPdf,
} from "@/src/lib/pdf";

export default function LaporanPreviewScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    jenis: string;
    start: string;
    end: string;
    bulan: string;
    petugas_ids: string;
    jenis_ids: string;
    semua_petugas: string;
    semua_komoditas: string;
  }>();

  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const filterLabel = useMemo(() => {
    if (params.jenis === "absensi" || params.jenis === "neraca_skontro") {
      return bulanLabel(params.bulan || "");
    }
    return `${formatTanggalID(params.start || "")} - ${formatTanggalID(params.end || "")}`;
  }, [params]);

  const reportTitle = useMemo(() => {
    const titleMap: Record<string, string> = {
      timbangan: "Laporan Timbangan",
      neraca: "Neraca Massa & Recovery",
      keuangan: "Laporan Keuangan",
      neraca_skontro: "Neraca Keuangan (Skontro)",
      penjualan: "Laporan Penjualan Komoditas",
      absensi: params.semua_petugas === "true" ? "Rekap Absensi Bulanan" : "Laporan Absensi Detail",
      laba_rugi: "Laporan Laba/Rugi",
    };
    return titleMap[params.jenis || ""] || "Preview Laporan";
  }, [params]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let endpoint = "";
      if (params.jenis === "timbangan") {
        endpoint = `/laporan/timbangan?start=${params.start}&end=${params.end}`;
      } else if (params.jenis === "keuangan") {
        endpoint = `/laporan/keuangan?start=${params.start}&end=${params.end}`;
      } else if (params.jenis === "penjualan") {
        endpoint = `/laporan/penjualan?start=${params.start}&end=${params.end}`;
        if (params.semua_komoditas !== "true" && params.jenis_ids) {
          endpoint += `&jenis_ids=${params.jenis_ids}`;
        }
      } else if (params.jenis === "neraca") {
        endpoint = `/laporan/neraca-massa?start=${params.start}&end=${params.end}`;
      } else if (params.jenis === "absensi") {
        if (params.semua_petugas === "true") {
          endpoint = `/laporan/absensi?bulan=${params.bulan}`;
        } else {
          endpoint = `/laporan/absensi-detail?bulan=${params.bulan}&petugas_ids=${params.petugas_ids}`;
        }
      } else if (params.jenis === "neraca_skontro") {
        endpoint = `/laporan/neraca-skontro?bulan=${params.bulan}`;
      } else if (params.jenis === "laba_rugi") {
        endpoint = `/laporan/neraca-keuangan?start=${params.start}&end=${params.end}`;
      }

      if (endpoint) {
        const data = await apiFetch<any>(endpoint);
        setReportData(data);
      }
    } catch (e: any) {
      Alert.alert("Error", "Gagal mengambil data laporan: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [
    params.jenis,
    params.start,
    params.end,
    params.bulan,
    params.petugas_ids,
    params.jenis_ids,
    params.semua_petugas,
    params.semua_komoditas,
  ]);

  const handleDownloadPdf = async () => {
    if (!reportData) return;
    setDownloading(true);
    try {
      if (params.jenis === "timbangan") {
        await generateLaporanTimbanganPdf(reportData, filterLabel, user?.nama || "User");
      } else if (params.jenis === "keuangan") {
        await generateLaporanKeuanganPdf(reportData, filterLabel, user?.nama || "User");
      } else if (params.jenis === "penjualan") {
        await generateLaporanPenjualanPdf(reportData, filterLabel, user?.nama || "User");
      } else if (params.jenis === "neraca") {
        await generateLaporanNeracaMassaPdf(reportData, filterLabel, user?.nama || "User");
      } else if (params.jenis === "absensi") {
        if (params.semua_petugas === "true") {
          await generateLaporanAbsensiPdf(reportData, filterLabel, user?.nama || "User");
        } else {
          await generateLaporanAbsensiDetailPdf(reportData, filterLabel, user?.nama || "User");
        }
      } else if (params.jenis === "neraca_skontro") {
        await generateLaporanNeracaSkontroPdf(reportData, filterLabel, user?.nama || "User");
      } else if (params.jenis === "laba_rugi") {
        await generateLaporanLabaRugiPdf(reportData, filterLabel, user?.nama || "User");
      }
    } catch (e: any) {
      Alert.alert("Error", "Gagal mengunduh PDF: " + e.message);
    } finally {
      setDownloading(false);
    }
  };

  // ─── RENDER HELPER PER TIPE LAPORAN ──────────────────────────────────────────

  // 1. Timbangan
  const renderTimbangan = () => {
    const items = (reportData || []) as any[];
    const totalBobot = items.reduce((acc, curr) => acc + (curr.bobot_total || 0), 0);

    return (
      <View style={{ gap: 16 }}>
        <View style={styles.kpiRow}>
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Entri</Text>
            <Text style={[styles.kpiVal, { color: Colors.primary }]}>{items.length}</Text>
          </Card>
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Bobot</Text>
            <Text style={[styles.kpiVal, { color: Colors.info }]}>{totalBobot.toLocaleString("id-ID")} kg</Text>
          </Card>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>Rincian Timbangan</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, { flex: 2 }]}>Waktu & Unit</Text>
            <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>Bobot</Text>
            <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>Pilah</Text>
          </View>
          {items.length === 0 ? (
            <Text style={styles.emptyText}>Tidak ada data.</Text>
          ) : (
            items.map((item, idx) => (
              <View key={idx} style={styles.tableRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.rowTitle}>{item.tanggal} {item.jam}</Text>
                  <Text style={styles.rowSub}>{item.unit_nama || "Unit Umum"}</Text>
                </View>
                <Text style={[styles.rowVal, { flex: 1, textAlign: "right" }]}>{item.bobot_total} kg</Text>
                <Text style={[styles.rowVal, { flex: 1, textAlign: "right", color: item.status_pilah ? Colors.success : Colors.textSecondary }]}>
                  {item.status_pilah ? `${item.total_pilahan} kg` : "Belum"}
                </Text>
              </View>
            ))
          )}
        </Card>
      </View>
    );
  };

  // 2. Neraca Massa
  const renderNeracaMassa = () => {
    const items = (reportData || []) as any[];
    return (
      <Card>
        <Text style={styles.sectionTitle}>Rekap Bulanan</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: 500 }}>
            <View style={styles.tableHeader}>
              <Text style={[styles.thText, { width: 90 }]}>Bulan</Text>
              <Text style={[styles.thText, { width: 100, textAlign: "right" }]}>Masuk (kg)</Text>
              <Text style={[styles.thText, { width: 100, textAlign: "right" }]}>Kompos (kg)</Text>
              <Text style={[styles.thText, { width: 90, textAlign: "right" }]}>Dijual (kg)</Text>
              <Text style={[styles.thText, { width: 90, textAlign: "right" }]}>Residu (kg)</Text>
              <Text style={[styles.thText, { width: 80, textAlign: "right" }]}>Recovery</Text>
            </View>
            {items.length === 0 ? (
              <Text style={styles.emptyText}>Tidak ada data.</Text>
            ) : (
              items.map((item, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.rowTitle, { width: 90 }]}>{bulanLabel(item.bulan)}</Text>
                  <Text style={[styles.rowVal, { width: 100, textAlign: "right" }]}>{item.sampah_masuk.toLocaleString("id-ID")}</Text>
                  <Text style={[styles.rowVal, { width: 100, textAlign: "right" }]}>{item.dikomposkan.toLocaleString("id-ID")}</Text>
                  <Text style={[styles.rowVal, { width: 90, textAlign: "right" }]}>{item.dijual.toLocaleString("id-ID")}</Text>
                  <Text style={[styles.rowVal, { width: 90, textAlign: "right" }]}>{item.residu.toLocaleString("id-ID")}</Text>
                  <Text style={[styles.rowVal, { width: 80, textAlign: "right", fontWeight: "700", color: Colors.primary }]}>
                    {item.recovery_factor}%
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </Card>
    );
  };

  // 3. Keuangan
  const renderKeuangan = () => {
    const items = (reportData || []) as any[];
    const totalMasuk = items
      .filter((it) => ["penjualan", "sumber lain", "retribusi"].includes(it.tipe))
      .reduce((acc, curr) => acc + (curr.total || 0), 0);
    const totalKeluar = items
      .filter((it) => it.tipe === "pengeluaran")
      .reduce((acc, curr) => acc + (curr.total || 0), 0);
    const saldoAkhir = totalMasuk - totalKeluar;

    return (
      <View style={{ gap: 16 }}>
        <View style={styles.kpiRow}>
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Pemasukan</Text>
            <Text style={[styles.kpiVal, { color: Colors.success, fontSize: 16 }]}>{rupiah(totalMasuk)}</Text>
          </Card>
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Pengeluaran</Text>
            <Text style={[styles.kpiVal, { color: Colors.error, fontSize: 16 }]}>{rupiah(totalKeluar)}</Text>
          </Card>
        </View>
        <Card style={{ backgroundColor: Colors.infoBg, borderColor: Colors.info, borderWidth: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontWeight: "800", color: Colors.text, fontSize: 15 }}>SALDO AKHIR PERIODE</Text>
            <Text style={{ fontWeight: "800", color: Colors.info, fontSize: 17 }}>{rupiah(saldoAkhir)}</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Riwayat Transaksi Keuangan</Text>
          {items.length === 0 ? (
            <Text style={styles.emptyText}>Tidak ada data transaksi.</Text>
          ) : (
            items.map((item, idx) => {
              const isIncome = ["penjualan", "sumber lain", "retribusi"].includes(item.tipe);
              return (
                <View key={idx} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.rowTitle}>{item.no_invoice || "INV-Manual"}</Text>
                    <Text style={styles.rowSub}>{formatTanggalID(item.tanggal)} • {item.nama_pihak}</Text>
                    {item.keterangan ? <Text style={styles.rowSub}>{item.keterangan}</Text> : null}
                  </View>
                  <Text style={[styles.rowVal, { flex: 1, textAlign: "right", fontWeight: "700", color: isIncome ? Colors.success : Colors.error }]}>
                    {isIncome ? "+" : "-"}{rupiah(item.total)}
                  </Text>
                </View>
              );
            })
          )}
        </Card>
      </View>
    );
  };

  // 4. Neraca Skontro
  const renderNeracaSkontro = () => {
    const data = reportData || {};
    const isBalanced = data.total_aktiva === data.total_pasiva;

    return (
      <View style={{ gap: 16 }}>
        <Card style={{ backgroundColor: isBalanced ? Colors.successBg : Colors.errorBg, borderColor: isBalanced ? Colors.success : Colors.error, borderWidth: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name={isBalanced ? "checkmark-circle" : "alert-circle"} size={24} color={isBalanced ? Colors.success : Colors.error} />
            <View>
              <Text style={{ fontWeight: "800", color: Colors.text }}>STATUS NERACA</Text>
              <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                {isBalanced ? "Neraca dalam keadaan seimbang (Balanced)." : "Peringatan: Jumlah Aktiva dan Pasiva berbeda!"}
              </Text>
            </View>
          </View>
        </Card>

        {/* SISI AKTIVA (ASET) */}
        <Card>
          <Text style={[styles.sectionTitle, { color: Colors.primary }]}>AKTIVA (ASET)</Text>
          
          <Text style={styles.subsectionTitle}>Aktiva Lancar</Text>
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>Kas / Bank</Text>
            <Text style={styles.rowValue}>{rupiah(data.kas)}</Text>
          </View>
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>Piutang Umum</Text>
            <Text style={styles.rowValue}>{rupiah(data.piutang_umum)}</Text>
          </View>
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>Piutang Kasbon Petugas</Text>
            <Text style={styles.rowValue}>{rupiah(data.piutang_kasbon)}</Text>
          </View>
          <View style={[styles.rowContainer, styles.rowTotal]}>
            <Text style={styles.totalLabel}>Total Aktiva Lancar</Text>
            <Text style={styles.totalValue}>{rupiah((data.kas || 0) + (data.piutang || 0))}</Text>
          </View>

          <Text style={styles.subsectionTitle}>Aktiva Tetap</Text>
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>Peralatan & Mesin</Text>
            <Text style={styles.rowValue}>{rupiah(data.aset)}</Text>
          </View>
          <View style={[styles.rowContainer, styles.rowTotal]}>
            <Text style={styles.totalLabel}>Total Aktiva Tetap</Text>
            <Text style={styles.totalValue}>{rupiah(data.aset)}</Text>
          </View>

          <View style={styles.netBox}>
            <Text style={styles.netLabel}>TOTAL AKTIVA</Text>
            <Text style={[styles.netVal, { color: Colors.primary }]}>{rupiah(data.total_aktiva)}</Text>
          </View>
        </Card>

        {/* SISI PASIVA */}
        <Card>
          <Text style={[styles.sectionTitle, { color: Colors.primary }]}>PASIVA (KEWAJIBAN & EKUITAS)</Text>
          
          <Text style={styles.subsectionTitle}>Kewajiban (Hutang)</Text>
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>Hutang Usaha / Lain-lain</Text>
            <Text style={styles.rowValue}>{rupiah(data.hutang)}</Text>
          </View>
          <View style={[styles.rowContainer, styles.rowTotal]}>
            <Text style={styles.totalLabel}>Total Kewajiban</Text>
            <Text style={styles.totalValue}>{rupiah(data.hutang)}</Text>
          </View>

          <Text style={styles.subsectionTitle}>Ekuitas (Modal)</Text>
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>Modal Disetor (Yayasan)</Text>
            <Text style={styles.rowValue}>{rupiah(data.modal)}</Text>
          </View>
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>Laba Ditahan</Text>
            <Text style={styles.rowValue}>{rupiah(data.laba_ditahan)}</Text>
          </View>
          <View style={[styles.rowContainer, styles.rowTotal]}>
            <Text style={styles.totalLabel}>Total Ekuitas</Text>
            <Text style={styles.totalValue}>{rupiah((data.modal || 0) + (data.laba_ditahan || 0))}</Text>
          </View>

          <View style={styles.netBox}>
            <Text style={styles.netLabel}>TOTAL PASIVA</Text>
            <Text style={[styles.netVal, { color: Colors.primary }]}>{rupiah(data.total_pasiva)}</Text>
          </View>
        </Card>
      </View>
    );
  };

  // 5. Penjualan
  const renderPenjualan = () => {
    const data = reportData || {};
    const items = (data.items || []) as any[];
    const summary = (data.summary || []) as any[];
    const totalKg = summary.reduce((s: number, r: any) => s + (r.total_kg || 0), 0);
    const totalRp = summary.reduce((s: number, r: any) => s + (r.total_rp || 0), 0);

    return (
      <View style={{ gap: 16 }}>
        <View style={styles.kpiRow}>
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Terjual</Text>
            <Text style={[styles.kpiVal, { color: Colors.info }]}>{totalKg.toFixed(1)} kg</Text>
          </Card>
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Pendapatan</Text>
            <Text style={[styles.kpiVal, { color: Colors.success, fontSize: 16 }]}>{rupiah(totalRp)}</Text>
          </Card>
        </View>

        {/* Rekap Per Komoditas */}
        <Card>
          <Text style={styles.sectionTitle}>Rekap Per Komoditas</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, { flex: 2 }]}>Komoditas</Text>
            <Text style={[styles.thText, { flex: 1, textAlign: "center" }]}>Transaksi</Text>
            <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>Total Berat</Text>
            <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>Total Hasil</Text>
          </View>
          {summary.length === 0 ? (
            <Text style={styles.emptyText}>Tidak ada data rekap.</Text>
          ) : (
            summary.map((s, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.rowTitle, { flex: 2 }]}>{s.nama}</Text>
                <Text style={[styles.rowVal, { flex: 1, textAlign: "center" }]}>{s.transaksi}</Text>
                <Text style={[styles.rowVal, { flex: 1, textAlign: "right" }]}>{s.total_kg.toFixed(1)} kg</Text>
                <Text style={[styles.rowVal, { flex: 2, textAlign: "right", fontWeight: "700", color: Colors.success }]}>
                  {rupiah(s.total_rp)}
                </Text>
              </View>
            ))
          )}
        </Card>

        {/* Detail Transaksi */}
        <Card>
          <Text style={styles.sectionTitle}>Detail Transaksi Penjualan</Text>
          {items.length === 0 ? (
            <Text style={styles.emptyText}>Tidak ada data transaksi.</Text>
          ) : (
            items.map((it, idx) => (
              <View key={idx} style={styles.tableRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.rowTitle}>{it.no_invoice || "INV-Manual"}</Text>
                  <Text style={styles.rowSub}>
                    {formatTanggalID(it.tanggal)} • {it.jenis_sampah_nama || "-"}
                  </Text>
                  <Text style={styles.rowSub}>Pembeli: {it.nama_pihak || "-"}</Text>
                </View>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={styles.rowVal}>{it.bobot_kg || 0} kg</Text>
                  <Text style={styles.rowSub}>{rupiah(it.harga_per_kg || 0)}/kg</Text>
                </View>
                <Text style={[styles.rowVal, { flex: 2, textAlign: "right", fontWeight: "700", color: Colors.success }]}>
                  {rupiah(it.total)}
                </Text>
              </View>
            ))
          )}
        </Card>
      </View>
    );
  };

  // 6. Absensi (Rekap / Detail)
  const renderAbsensi = () => {
    if (params.semua_petugas === "true") {
      const items = (reportData || []) as any[];
      return (
        <Card>
          <Text style={styles.sectionTitle}>Rekap Kehadiran Bulanan</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 550 }}>
              <View style={styles.tableHeader}>
                <Text style={[styles.thText, { width: 120 }]}>Nama Petugas</Text>
                <Text style={[styles.thText, { width: 60, textAlign: "center" }]}>Hadir</Text>
                <Text style={[styles.thText, { width: 50, textAlign: "center" }]}>Izin</Text>
                <Text style={[styles.thText, { width: 50, textAlign: "center" }]}>Sakit</Text>
                <Text style={[styles.thText, { width: 50, textAlign: "center" }]}>Alpha</Text>
                <Text style={[styles.thText, { width: 60, textAlign: "center" }]}>Lembur</Text>
                <Text style={[styles.thText, { width: 120, textAlign: "right" }]}>Gaji Bersih</Text>
              </View>
              {items.length === 0 ? (
                <Text style={styles.emptyText}>Tidak ada data absensi.</Text>
              ) : (
                items.map((item, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.rowTitle, { width: 120 }]} numberOfLines={1}>{item.nama}</Text>
                    <Text style={[styles.rowVal, { width: 60, textAlign: "center" }]}>{item.hadir}</Text>
                    <Text style={[styles.rowVal, { width: 50, textAlign: "center" }]}>{item.izin}</Text>
                    <Text style={[styles.rowVal, { width: 50, textAlign: "center" }]}>{item.sakit}</Text>
                    <Text style={[styles.rowVal, { width: 50, textAlign: "center", color: item.alpha > 0 ? Colors.error : Colors.textSecondary }]}>{item.alpha}</Text>
                    <Text style={[styles.rowVal, { width: 60, textAlign: "center" }]}>{item.total_lembur_jam}j</Text>
                    <Text style={[styles.rowVal, { width: 120, textAlign: "right", fontWeight: "700", color: Colors.primary }]}>
                      {rupiah(item.gaji_bersih)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </Card>
      );
    } else {
      const officers = (reportData || []) as any[];
      if (officers.length === 0) {
        return (
          <Card>
            <Text style={styles.emptyText}>Tidak ada data absensi untuk petugas yang dipilih.</Text>
          </Card>
        );
      }

      return (
        <View style={{ gap: 16 }}>
          {officers.map((petugas, pIdx) => {
            // Calculate summary for this officer
            let hadir = 0, izin = 0, sakit = 0, alpha = 0;
            petugas.kehadiran.forEach((k: any) => {
              if (k.status === 'hadir') hadir++;
              else if (k.status === 'izin') izin++;
              else if (k.status === 'sakit') sakit++;
              else alpha++;
            });

            return (
              <Card key={pIdx}>
                <Text style={[styles.sectionTitle, { color: Colors.primary, marginBottom: 8 }]}>{petugas.nama}</Text>
                
                {/* Mini Summary Badges */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  <View style={[styles.miniBadge, { backgroundColor: Colors.successBg }]}>
                    <Text style={[styles.miniBadgeText, { color: Colors.success }]}>Hadir: {hadir}</Text>
                  </View>
                  <View style={[styles.miniBadge, { backgroundColor: Colors.infoBg }]}>
                    <Text style={[styles.miniBadgeText, { color: Colors.info }]}>Sakit: {sakit}</Text>
                  </View>
                  <View style={[styles.miniBadge, { backgroundColor: Colors.warningBg }]}>
                    <Text style={[styles.miniBadgeText, { color: Colors.warning }]}>Izin: {izin}</Text>
                  </View>
                  <View style={[styles.miniBadge, { backgroundColor: Colors.errorBg }]}>
                    <Text style={[styles.miniBadgeText, { color: Colors.error }]}>Alpha: {alpha}</Text>
                  </View>
                </View>

                {/* List Kehadiran Harian */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.thText, { flex: 2 }]}>Tanggal & Status</Text>
                  <Text style={[styles.thText, { flex: 1, textAlign: "center" }]}>Durasi</Text>
                  <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>Detail Sesi / Alasan</Text>
                </View>
                {petugas.kehadiran.length === 0 ? (
                  <Text style={styles.emptyText}>Tidak ada data kehadiran bulan ini.</Text>
                ) : (
                  petugas.kehadiran.map((k: any, kIdx: number) => {
                    const isHadir = k.status === 'hadir';
                    const color = isHadir
                      ? Colors.success
                      : k.status === 'izin'
                      ? Colors.warning
                      : k.status === 'sakit'
                      ? Colors.info
                      : Colors.error;

                    let sessionDesc = "-";
                    if (isHadir && k.sessions && k.sessions.length > 0) {
                      sessionDesc = k.sessions.map((s: any) => {
                        const dIn = s.check_in ? s.check_in.slice(11, 16) : "..";
                        const dOut = s.check_out ? s.check_out.slice(11, 16) : "..";
                        return `[${dIn}-${dOut}]`;
                      }).join(", ");
                    } else if (!isHadir) {
                      sessionDesc = k.alasan || "-";
                    }

                    return (
                      <View key={kIdx} style={styles.tableRow}>
                        <View style={{ flex: 2 }}>
                          <Text style={styles.rowTitle}>{formatTanggalID(k.tanggal)}</Text>
                          <Text style={[styles.rowSub, { color, fontWeight: "700", textTransform: "capitalize" }]}>
                            {k.status}
                          </Text>
                        </View>
                        <Text style={[styles.rowVal, { flex: 1, textAlign: "center" }]}>
                          {isHadir ? `${k.jam.toFixed(1)} jam` : "-"}
                        </Text>
                        <Text style={[styles.rowVal, { flex: 2, textAlign: "right", fontSize: 12, color: Colors.textSecondary }]} numberOfLines={2}>
                          {sessionDesc}
                        </Text>
                      </View>
                    );
                  })
                )}
              </Card>
            );
          })}
        </View>
      );
    }
  };

  // 7. Laba Rugi
  const renderLabaRugi = () => {
    const items = (reportData || []) as any[];
    const iuran = items.reduce((s, r) => s + (r.iuran || 0), 0);
    const penjualan = items.reduce((s, r) => s + (r.penjualan || 0), 0);
    const lainMasuk = items.reduce((s, r) => s + (r.lain_masuk || 0), 0);
    const upah = items.reduce((s, r) => s + (r.upah || 0), 0);
    const residu = items.reduce((s, r) => s + (r.distribusi_residu || 0), 0);
    const lainKeluar = items.reduce((s, r) => s + (r.lain_keluar || 0), 0);

    const totalPendapatan = iuran + penjualan + lainMasuk;
    const totalBeban = upah + residu + lainKeluar;
    const labaRugi = totalPendapatan - totalBeban;
    const isLaba = labaRugi >= 0;

    return (
      <View style={{ gap: 16 }}>
        <Card style={{ backgroundColor: isLaba ? Colors.successBg : Colors.errorBg, borderColor: isLaba ? Colors.success : Colors.error, borderWidth: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name={isLaba ? "checkmark-circle" : "alert-circle"} size={24} color={isLaba ? Colors.success : Colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", color: Colors.text }}>{isLaba ? "SURPLUS OPERASIONAL" : "DEFISIT OPERASIONAL"}</Text>
              <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                {isLaba ? "TPS membukukan laba bersih pada periode ini." : "Peringatan: Biaya pengeluaran melebihi pendapatan!"}
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.kpiRow}>
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Pendapatan</Text>
            <Text style={[styles.kpiVal, { color: Colors.success, fontSize: 15 }]}>{rupiah(totalPendapatan)}</Text>
          </Card>
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Beban</Text>
            <Text style={[styles.kpiVal, { color: Colors.error, fontSize: 15 }]}>{rupiah(totalBeban)}</Text>
          </Card>
        </View>

        {/* DETAIL PENDAPATAN */}
        <Card>
          <Text style={[styles.sectionTitle, { color: Colors.success }]}>PENDAPATAN OPERASIONAL</Text>
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>Retribusi Yayasan</Text>
            <Text style={styles.rowValue}>{rupiah(iuran)}</Text>
          </View>
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>Penjualan Komoditas</Text>
            <Text style={styles.rowValue}>{rupiah(penjualan)}</Text>
          </View>
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>Pemasukan Sumber Lain</Text>
            <Text style={styles.rowValue}>{rupiah(lainMasuk)}</Text>
          </View>
          <View style={[styles.rowContainer, styles.rowTotal]}>
            <Text style={styles.totalLabel}>Total Pendapatan</Text>
            <Text style={[styles.totalValue, { color: Colors.success }]}>{rupiah(totalPendapatan)}</Text>
          </View>
        </Card>

        {/* DETAIL BEBAN */}
        <Card>
          <Text style={[styles.sectionTitle, { color: Colors.error }]}>BEBAN OPERASIONAL</Text>
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>Beban Gaji & Upah Petugas</Text>
            <Text style={styles.rowValue}>{rupiah(upah)}</Text>
          </View>
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>Beban Distribusi Residu TPA</Text>
            <Text style={styles.rowValue}>{rupiah(residu)}</Text>
          </View>
          <View style={styles.rowContainer}>
            <Text style={styles.rowLabel}>Beban Operasional Lainnya</Text>
            <Text style={styles.rowValue}>{rupiah(lainKeluar)}</Text>
          </View>
          <View style={[styles.rowContainer, styles.rowTotal]}>
            <Text style={styles.totalLabel}>Total Beban Operasional</Text>
            <Text style={[styles.totalValue, { color: Colors.error }]}>{rupiah(totalBeban)}</Text>
          </View>
        </Card>

        {/* TOTAL LABA RUGI */}
        <Card style={{ backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: isLaba ? Colors.success : Colors.error }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
            <Text style={{ fontWeight: "800", color: Colors.text, fontSize: 14 }}>LABA / (RUGI) BERSIH</Text>
            <Text style={{ fontWeight: "900", color: isLaba ? Colors.success : Colors.error, fontSize: 17 }}>{rupiah(labaRugi)}</Text>
          </View>
        </Card>
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 12, color: Colors.textSecondary }}>Memuat laporan...</Text>
        </View>
      );
    }

    if (!reportData) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle" size={48} color={Colors.error} />
          <Text style={{ marginTop: 12, color: Colors.textSecondary }}>Gagal memuat data laporan.</Text>
        </View>
      );
    }

    switch (params.jenis) {
      case "timbangan":
        return renderTimbangan();
      case "neraca":
        return renderNeracaMassa();
      case "keuangan":
        return renderKeuangan();
      case "neraca_skontro":
        return renderNeracaSkontro();
      case "penjualan":
        return renderPenjualan();
      case "absensi":
        return renderAbsensi();
      case "laba_rugi":
        return renderLabaRugi();
      default:
        return (
          <Text style={{ textAlign: "center", color: Colors.textSecondary }}>
            Tipe laporan tidak dikenal.
          </Text>
        );
    }
  };

  return (
    <ScreenContainer title="Preview Laporan">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 24) }}>
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.title}>{reportTitle}</Text>
          <Text style={styles.subtitle}>{filterLabel}</Text>
        </View>

        {!loading && reportData && (
          <View style={{ marginBottom: 16 }}>
            <Button
              title="Unduh PDF"
              icon="document-text"
              onPress={handleDownloadPdf}
              loading={downloading}
              variant="outline"
            />
          </View>
        )}

        {renderContent()}
      </ScrollView>
    </ScreenContainer>
  );
}

const baseStyles = (Colors: any) =>
  StyleSheet.create({
    title: { fontSize: 22, fontWeight: "800", color: Colors.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    centerContainer: { paddingVertical: 64, alignItems: "center", justifyContent: "center" },
    
    // KPI Cards
    kpiRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
    kpiCard: { flex: 1, padding: 14 },
    kpiLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: "600", textTransform: "uppercase" },
    kpiVal: { fontSize: 18, fontWeight: "800", marginTop: 4 },

    // Tables
    sectionTitle: { fontSize: 15, fontWeight: "800", color: Colors.text, marginBottom: 14 },
    tableHeader: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1.5, borderColor: Colors.border },
    thText: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
    tableRow: { flexDirection: "row", paddingVertical: 12, borderBottomWidth: 1, borderColor: Colors.borderLight, alignItems: "center" },
    rowTitle: { fontSize: 14, fontWeight: "700", color: Colors.text },
    rowSub: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
    rowVal: { fontSize: 13, color: Colors.text },
    emptyText: { textAlign: "center", color: Colors.textSecondary, paddingVertical: 24, fontSize: 13 },

    // Skontro specific
    subsectionTitle: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary, marginTop: 14, marginBottom: 6, textTransform: "uppercase" },
    rowContainer: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, paddingLeft: 8 },
    rowLabel: { fontSize: 13, color: Colors.textSecondary },
    rowValue: { fontSize: 13, color: Colors.text, fontWeight: "600" },
    rowTotal: { borderTopWidth: 1, borderTopColor: Colors.borderLight, marginTop: 4, paddingTop: 6 },
    totalLabel: { fontSize: 13, fontWeight: "700", color: Colors.text },
    totalValue: { fontSize: 13, fontWeight: "700", color: Colors.primary },
    netBox: { marginTop: 18, padding: 12, backgroundColor: Colors.borderLight, borderRadius: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    netLabel: { fontSize: 13, fontWeight: "800", color: Colors.text },
    netVal: { fontSize: 15, fontWeight: "900" },

    // Absensi specific
    miniBadge: { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: "center", justifyContent: "center" },
    miniBadgeText: { fontSize: 10, fontWeight: "700" },
  });
