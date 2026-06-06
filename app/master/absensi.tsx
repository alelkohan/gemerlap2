import { useCallback, useEffect, useState, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button, EmptyState } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { useColors } from "@/src/lib/theme-context";
import { todayISO, formatTanggalID, addDays } from "@/src/lib/format";

type Petugas = { id: string; nama: string; status: boolean };
type Absen = { petugas_id: string; status: "hadir" | "absen" | "izin" | "sakit"; keterangan?: string; jam?: number };

const STATUS_OPTS: { id: Absen["status"]; label: string; color: string; bg: string }[] = [
  { id: "hadir", label: "Hadir", color: "#10b981", bg: "#d1fae5" },
  { id: "absen", label: "Absen", color: "#ef4444", bg: "#fee2e2" },
  { id: "izin", label: "Izin", color: "#f5a623", bg: "#fef3c7" },
  { id: "sakit", label: "Sakit", color: "#3b82f6", bg: "#dbeafe" },
];

export default function AbsensiScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [tanggal, setTanggal] = useState(todayISO());
  const [petugas, setPetugas] = useState<Petugas[]>([]);
  const [absen, setAbsen] = useState<Record<string, Absen["status"]>>({});
  const [jamMap, setJamMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [p, a] = await Promise.all([
      apiFetch<Petugas[]>("/petugas"),
      apiFetch<Absen[]>(`/absensi?tanggal=${tanggal}`),
    ]);
    setPetugas(p.filter((x) => x.status));
    const aMap: Record<string, Absen["status"]> = {};
    const jMap: Record<string, string> = {};
    for (const it of a) {
      aMap[it.petugas_id] = it.status;
      if (it.jam) jMap[it.petugas_id] = String(it.jam);
    }
    setAbsen(aMap);
    setJamMap(jMap);
  }, [tanggal]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cycle = (pid: string) => {
    if (!isAdmin) return;
    const order: Absen["status"][] = ["hadir", "absen", "izin", "sakit"];
    const cur = absen[pid] || "hadir";
    const idx = order.indexOf(cur);
    const next = order[(idx + 1) % order.length];
    setAbsen((a) => ({ ...a, [pid]: next }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const items = petugas.map((p) => {
        let j = parseFloat(jamMap[p.id] || "0");
        if (isNaN(j)) j = 0;
        if (j > 8) j = 8;
        return {
          petugas_id: p.id,
          status: absen[p.id] || "hadir",
          keterangan: "",
          jam: (absen[p.id] || "hadir") === "hadir" ? j : 0,
        };
      });
      await apiFetch(`/absensi`, { method: "POST", body: { tanggal, items } });
      Alert.alert("Sukses", "Absensi petugas berhasil disimpan!");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer title="Absensi Harian">
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => setTanggal(addDays(tanggal, -1))} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text }}>{formatTanggalID(tanggal)}</Text>
          {tanggal === todayISO() && <Text style={{ fontSize: 11, color: Colors.primary }}>Hari ini</Text>}
        </View>
        <TouchableOpacity onPress={() => setTanggal(addDays(tanggal, 1))} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {petugas.length === 0 ? (
          <EmptyState icon="people-outline" title="Belum ada petugas aktif" subtitle="Tambahkan petugas terlebih dahulu" />
        ) : (
          petugas.map((p) => {
            const st = absen[p.id] || "hadir";
            const opt = STATUS_OPTS.find((o) => o.id === st)!;
            return (
              <Card key={p.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                      {p.nama.split(" ").slice(0, 2).map((x) => x[0]).join("").toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text }}>{p.nama}</Text>
                    {st === "hadir" && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                        <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Jam Kerja:</Text>
                        <TextInput
                          value={jamMap[p.id] || ""}
                          onChangeText={(v) => {
                            if (!isAdmin) return;
                            const n = parseFloat(v);
                            if (n > 8) setJamMap((m) => ({ ...m, [p.id]: "8" }));
                            else setJamMap((m) => ({ ...m, [p.id]: v }));
                          }}
                          editable={isAdmin}
                          keyboardType="numeric"
                          placeholder="0-8"
                          placeholderTextColor={Colors.textTertiary}
                          style={{
                            borderWidth: 1,
                            borderColor: Colors.border,
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            fontSize: 12,
                            color: Colors.text,
                            backgroundColor: isAdmin ? Colors.surface : Colors.borderLight,
                            minWidth: 50,
                            textAlign: "center",
                          }}
                        />
                        <Text style={{ fontSize: 12, color: Colors.textSecondary }}>jam</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => cycle(p.id)}
                    disabled={!isAdmin}
                    style={[styles.statusBadge, { backgroundColor: opt.bg, opacity: isAdmin ? 1 : 0.8 }]}
                    testID={`absensi-${p.id}`}
                  >
                    <Text style={{ color: opt.color, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {petugas.length > 0 && isAdmin && (
        <View style={styles.bottomBar}>
          <Button title="Simpan Semua" onPress={save} loading={saving} icon="save-outline" />
        </View>
      )}
    </ScreenContainer>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
});
