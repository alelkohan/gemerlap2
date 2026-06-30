import { useEffect, useState, useMemo } from "react";
import { ScrollView, View, Text, StyleSheet, Image, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/src/components/screen-header";
import { Button, Card } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { LOGO_IMG, ORG, Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";
import { rupiah, formatTanggalID } from "@/src/lib/format";
import { generateInvoicePdf } from "@/src/lib/pdf";

export default function InvoiceScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trx, setTrx] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const decodedId = decodeURIComponent(id);
      const data = await apiFetch<any>(`/keuangan/invoice/${decodedId}`);
      setTrx(data);
    })();
  }, [id]);

  if (!trx) {
    return (
      <ScreenContainer title="Invoice">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const isPenjualan = trx.tipe === "penjualan";
  const isSumberLain = trx.tipe === "sumber lain";
  const title = isPenjualan ? "INVOICE PENJUALAN" : isSumberLain ? "BUKTI PEMASUKAN" : "BUKTI PENGELUARAN";

  return (
    <ScreenContainer title="Invoice / Bukti">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card>
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Image source={LOGO_IMG} style={{ width: 56, height: 56 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.orgName}>{ORG.name}</Text>
              <Text style={styles.orgAddr}>{ORG.alamat}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.title}>{title}</Text>

          <View style={styles.rows}>
            <Row label="No. Invoice" value={trx.no_invoice} mono />
            <Row label="Tanggal" value={formatTanggalID(trx.tanggal)} />
            {isPenjualan && (
              <>
                <Row label="Nama Pembeli" value={trx.nama_pihak || "-"} />
                {trx.keterangan && <Row label="Keterangan" value={trx.keterangan} />}
                
                <View style={{ marginTop: 16, backgroundColor: Colors.surface, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderLight }}>
                  <View style={{ flexDirection: 'row', backgroundColor: Colors.bg, padding: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                    <Text style={{ flex: 2, fontSize: 11, fontWeight: '700', color: Colors.textSecondary }}>Komoditas</Text>
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textAlign: 'right' }}>Berat</Text>
                    <Text style={{ flex: 1.5, fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textAlign: 'right' }}>Harga/kg</Text>
                    <Text style={{ flex: 1.5, fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textAlign: 'right' }}>Subtotal</Text>
                  </View>
                  {(trx.items || []).map((it: any, i: number) => (
                    <View key={i} style={{ flexDirection: 'row', padding: 8, borderBottomWidth: i === (trx.items?.length - 1) ? 0 : 1, borderBottomColor: Colors.borderLight }}>
                      <Text style={{ flex: 2, fontSize: 12, color: Colors.text }}>{it.jenis_sampah_nama || "-"}</Text>
                      <Text style={{ flex: 1, fontSize: 12, color: Colors.text, textAlign: 'right' }}>{it.bobot_kg} kg</Text>
                      <Text style={{ flex: 1.5, fontSize: 12, color: Colors.text, textAlign: 'right' }}>{rupiah(it.harga_per_kg)}</Text>
                      <Text style={{ flex: 1.5, fontSize: 12, color: Colors.text, textAlign: 'right', fontWeight: '600' }}>{rupiah(it.total)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {isSumberLain && <Row label="Sumber" value={trx.nama_pihak || "-"} />}
            {trx.tipe === "pengeluaran" && (
              <>
                <Row label="Kategori" value={trx.kategori || "-"} />
                <Row label="Keperluan" value={trx.keterangan || "-"} />
              </>
            )}
            {trx.keterangan && !isPenjualan && <Row label="Keterangan" value={trx.keterangan} />}
          </View>

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>
              {isPenjualan ? "Total Penjualan" : isSumberLain ? "Nominal Pemasukan" : "Total Pengeluaran"}
            </Text>
            <Text style={styles.totalVal}>{rupiah(trx.total)}</Text>
          </View>

          <View style={styles.sigBox}>
            <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 30 }}>Hormat kami,</Text>
            <View style={styles.sigLine} />
            <Text style={styles.sigName}>Admin TPS</Text>
          </View>
        </Card>

        <View style={{ marginTop: 16, gap: 8 }}>
          <Button
            title="Bagikan / Simpan PDF"
            icon="share-social-outline"
            onPress={() => generateInvoicePdf(trx)}
            testID="share-invoice-btn"
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono ? { fontFamily: "monospace" } : null]}>{value}</Text>
    </View>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  header: { flexDirection: "row", gap: 12, alignItems: "center" },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  orgName: { fontSize: 16, fontWeight: "800", color: Colors.primary },
  orgAddr: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  divider: { height: 2, backgroundColor: Colors.primary, marginVertical: 12, borderRadius: 1 },
  title: { fontSize: 18, fontWeight: "800", color: Colors.primary, marginBottom: 12 },
  rows: { gap: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { fontSize: 13, color: Colors.textSecondary },
  rowValue: { fontSize: 13, fontWeight: "700", color: Colors.text, maxWidth: "60%", textAlign: "right" },
  totalBox: {
    backgroundColor: Colors.successBg,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  totalLabel: { fontSize: 11, color: Colors.primary, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  totalVal: { fontSize: 26, color: Colors.primary, fontWeight: "800", marginTop: 4 },
  sigBox: { alignItems: "flex-end", marginTop: 32 },
  sigLine: { width: 160, height: 1, backgroundColor: Colors.textSecondary, marginBottom: 6 },
  sigName: { fontSize: 12, color: Colors.textSecondary },
});
