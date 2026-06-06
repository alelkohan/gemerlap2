import { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Alert, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/src/components/screen-header";
import { Button, Card, Badge } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";
import { formatTanggalID } from "@/src/lib/format";

type Jenis = { id: string; nama: string; tipe: "komoditas" | "bakar" | "lain" };

export default function KelolaPilahan() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [timbangan, setTimbangan] = useState<any | null>(null);
  const [jenisList, setJenisList] = useState<Jenis[]>([]);
  const [bobotMap, setBobotMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [list, pilahan] = await Promise.all([
        apiFetch<any[]>("/timbangan"),
        apiFetch<any[]>(`/timbangan/${id}/pilahan`),
      ]);
      const cur = list.find((x) => x.id === id);
      setTimbangan(cur);
      setJenisList([
        { id: "Bakar", nama: "Bakar", tipe: "bakar" },
        { id: "Komoditas", nama: "Komoditas", tipe: "komoditas" },
        { id: "Lain-lain", nama: "Lain-lain", tipe: "lain" },
      ]);
      const map: Record<string, string> = {};
      for (const p of pilahan) {
        map[p.jenis_sampah_id] = String(p.bobot);
      }
      setBobotMap(map);
    })();
  }, [id]);

  const totalPilah = Object.values(bobotMap).reduce((sum, v) => {
    const n = parseFloat((v || "").replace(",", "."));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const bobotTotal = timbangan?.bobot_total || 0;
  const sisa = bobotTotal - totalPilah;
  const exceeded = totalPilah > bobotTotal + 0.001;

  const handleSave = async () => {
    if (exceeded) return;
    setLoading(true);
    try {
      const items = Object.entries(bobotMap)
        .map(([jid, v]) => ({ jenis_sampah_id: jid, bobot: parseFloat((v || "0").replace(",", ".")) || 0 }))
        .filter((it) => it.bobot > 0);
      await apiFetch(`/timbangan/${id}/pilahan`, { method: "POST", body: { items } });
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const tipeBadge = (tipe: string) => {
    if (tipe === "komoditas") return <Badge label="Komoditas" variant="success" small />;
    if (tipe === "bakar") return <Badge label="Bakar" variant="error" small />;
    return <Badge label="Lain" variant="neutral" small />;
  };

  return (
    <ScreenContainer title="Kelola Pilahan">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {timbangan && (
          <Card style={{ marginBottom: 16, backgroundColor: Colors.primary }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: "#ffffff99", fontSize: 11, textTransform: "uppercase", fontWeight: "700" }}>
                  Unit
                </Text>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 2 }}>
                  {timbangan.unit_nama}
                </Text>
                <Text style={{ color: "#ffffffcc", fontSize: 12, marginTop: 4 }}>
                  {formatTanggalID(timbangan.tanggal)} • {timbangan.jam}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: "#ffffff99", fontSize: 11, fontWeight: "700" }}>BOBOT TOTAL</Text>
                <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800" }}>{bobotTotal} kg</Text>
              </View>
            </View>
          </Card>
        )}

        <View
          style={[
            styles.warningBar,
            { backgroundColor: exceeded ? Colors.errorBg : sisa < 0.001 ? Colors.successBg : Colors.warningBg },
          ]}
        >
          <Ionicons
            name={exceeded ? "alert-circle" : sisa < 0.001 ? "checkmark-circle" : "information-circle"}
            size={20}
            color={exceeded ? Colors.error : sisa < 0.001 ? Colors.success : Colors.warning}
          />
          <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: Colors.text }}>
            {exceeded
              ? `Total pilahan melebihi bobot (${totalPilah.toFixed(2)} kg)`
              : `Dipilah: ${totalPilah.toFixed(2)} / ${bobotTotal} kg • Sisa: ${sisa.toFixed(2)} kg`}
          </Text>
        </View>

        {jenisList.map((j) => (
          <Card key={j.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: Colors.text, fontSize: 14 }}>{j.nama}</Text>
                <View style={{ marginTop: 4, alignSelf: "flex-start" }}>{tipeBadge(j.tipe)}</View>
              </View>
              <View style={styles.bobotInput}>
                <TextInput
                  value={bobotMap[j.id] || ""}
                  onChangeText={(v) => setBobotMap((m) => ({ ...m, [j.id]: v }))}
                  placeholder="0"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                  style={{ flex: 1, fontSize: 15, color: Colors.text, textAlign: "right" }}
                  testID={`pilah-input-${j.id}`}
                />
                <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: "600" }}>kg</Text>
              </View>
            </View>
          </Card>
        ))}

        <View style={{ marginTop: 16 }}>
          <Button
            title="Simpan Pilahan"
            onPress={handleSave}
            loading={loading}
            disabled={exceeded}
            testID="pilahan-save"
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  warningBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  bobotInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 110,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
