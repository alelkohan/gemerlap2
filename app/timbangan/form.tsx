import { useEffect, useState, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/src/components/screen-header";
import { Input, Button, PickerModal } from "@/src/components/ui";
import { DatePickerField, TimePickerField } from "@/src/components/date-picker";
import { apiFetch } from "@/src/lib/api";
import { todayISO, nowHHMM } from "@/src/lib/format";
import { Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";

type Unit = { id: string; nama: string };

export default function TimbanganForm() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const editing = !!id;

  const [tanggal, setTanggal] = useState(todayISO());
  const [jam, setJam] = useState(nowHHMM());
  const [unitId, setUnitId] = useState<string>("");
  const [bobot, setBobot] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitName, setUnitName] = useState("");
  const [showUnits, setShowUnits] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const u = await apiFetch<Unit[]>("/units");
      setUnits(u);
      if (editing) {
        const list = await apiFetch<any[]>("/timbangan");
        const cur = list.find((x) => x.id === id);
        if (cur) {
          setTanggal(cur.tanggal);
          setJam(cur.jam);
          setUnitId(cur.unit_id);
          setBobot(String(cur.bobot_total));
          setUnitName(cur.unit_nama || u.find((x) => x.id === cur.unit_id)?.nama || "");
        }
      }
    })();
  }, [id, editing]);

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!tanggal) errs.tanggal = "Wajib diisi";
    if (!jam) errs.jam = "Wajib diisi";
    if (!unitId) errs.unitId = "Wajib pilih unit";
    const b = parseFloat(bobot.replace(",", "."));
    if (!bobot || isNaN(b) || b <= 0) errs.bobot = "Bobot harus > 0";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const body = { tanggal, jam, unit_id: unitId, bobot_total: b };
      if (editing) {
        await apiFetch(`/timbangan/${id}`, { method: "PUT", body });
      } else {
        await apiFetch("/timbangan", { method: "POST", body });
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer title={editing ? "Edit Timbangan" : "Tambah Timbangan"}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <DatePickerField label="Tanggal" value={tanggal} onChange={setTanggal} testID="timbangan-tanggal" />
        <TimePickerField label="Jam" value={jam} onChange={setJam} testID="timbangan-jam" />

        <Text style={styles.label}>Unit</Text>
        <TouchableOpacity
          onPress={() => setShowUnits(true)}
          style={styles.pickerBtn}
          testID="timbangan-unit"
        >
          <Ionicons name="business-outline" size={18} color={Colors.textSecondary} />
          <Text style={{ flex: 1, color: unitName ? Colors.text : Colors.textTertiary, fontSize: 15 }}>
            {unitName || "Pilih unit"}
          </Text>
          <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
        {errors.unitId && <Text style={styles.err}>{errors.unitId}</Text>}

        <View style={{ marginTop: 14 }} />
        <Input
          label="Bobot Total (kg)"
          placeholder="0.0"
          value={bobot}
          onChangeText={setBobot}
          keyboardType="decimal-pad"
          error={errors.bobot}
          testID="timbangan-bobot"
        />

        <View style={{ marginTop: 12 }}>
          <Button title={editing ? "Simpan Perubahan" : "Simpan"} onPress={handleSave} loading={loading} testID="timbangan-save" />
        </View>
      </ScrollView>

      <PickerModal
        visible={showUnits}
        title="Pilih Unit"
        items={units}
        selectedId={unitId}
        onSelect={(u) => {
          setUnitId(u.id);
          setUnitName(u.nama);
        }}
        onClose={() => setShowUnits(false)}
      />
    </ScreenContainer>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 6 },
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
  err: { color: Colors.error, fontSize: 12, marginTop: 4 },
});
