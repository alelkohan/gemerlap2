import { useCallback, useState, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, Alert, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button, Input, FAB, EmptyState, ConfirmDialog, PickerModal, Badge } from "@/src/components/ui";
import { DatePickerField } from "@/src/components/date-picker";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { useColors } from "@/src/lib/theme-context";
import { todayISO } from "@/src/lib/format";

type Petugas = {
  id: string;
  nama: string;
  no_hp?: string;
  jabatan?: string;
  tgl_bergabung?: string;
  status: boolean;
};

const JABATANS = [
  { id: "Petugas", nama: "Petugas" },
  { id: "Koordinator", nama: "Koordinator" },
];

export default function PetugasScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [items, setItems] = useState<Petugas[]>([]);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [noHp, setNoHp] = useState("");
  const [jabatan, setJabatan] = useState("Petugas");
  const [tglBergabung, setTglBergabung] = useState(todayISO());
  const [status, setStatus] = useState(true);
  const [showJabatan, setShowJabatan] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = await apiFetch<Petugas[]>("/petugas");
    setItems(p);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => {
    if (!isAdmin) return;
    setEditId(null);
    setNama("");
    setNoHp("");
    setJabatan("Petugas");
    setTglBergabung(todayISO());
    setStatus(true);
    setShow(true);
  };

  const openEdit = (p: Petugas) => {
    if (!isAdmin) return;
    setEditId(p.id);
    setNama(p.nama);
    setNoHp(p.no_hp || "");
    setJabatan(p.jabatan || "Petugas");
    setTglBergabung(p.tgl_bergabung || todayISO());
    setStatus(p.status);
    setShow(true);
  };

  const save = async () => {
    if (!nama.trim()) return Alert.alert("Error", "Nama wajib diisi");
    try {
      const body = {
        nama,
        no_hp: noHp,
        jabatan,
        tgl_bergabung: tglBergabung,
        status,
      };
      if (editId) await apiFetch(`/petugas/${editId}`, { method: "PUT", body });
      else await apiFetch(`/petugas`, { method: "POST", body });
      setShow(false);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    await apiFetch(`/petugas/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    await load();
  };

  const initials = (n: string) => n.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <ScreenContainer title="Petugas">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {items.length === 0 ? (
          <EmptyState icon="people-outline" title="Belum ada petugas" subtitle="Tap + untuk menambah petugas" />
        ) : (
          items.map((p) => (
            <Card key={p.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "800" }}>{initials(p.nama)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text }}>{p.nama}</Text>
                    {!p.status && <Badge label="Nonaktif" variant="neutral" small />}
                  </View>
                  <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                    {p.jabatan} • {p.no_hp || "-"}
                  </Text>
                </View>
                {isAdmin && (
                  <>
                    <TouchableOpacity onPress={() => openEdit(p)} style={{ padding: 8 }}>
                      <Ionicons name="create-outline" size={20} color={Colors.info} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setDeleteId(p.id)} style={{ padding: 8 }}>
                      <Ionicons name="trash-outline" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {isAdmin && <FAB onPress={openNew} />}

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editId ? "Edit Petugas" : "Tambah Petugas"}</Text>
              <Input label="Nama Lengkap" value={nama} onChangeText={setNama} />
              <Input label="Nomor HP" value={noHp} onChangeText={setNoHp} keyboardType="phone-pad" />
              <Text style={styles.label}>Jabatan</Text>
              <TouchableOpacity onPress={() => setShowJabatan(true)} style={styles.pickerBtn}>
                <Text style={{ flex: 1, color: Colors.text, fontSize: 15 }}>{jabatan}</Text>
                <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ marginTop: 14 }} />
              <DatePickerField label="Tanggal Bergabung" value={tglBergabung} onChange={setTglBergabung} />
              <TouchableOpacity onPress={() => setStatus(!status)} style={styles.toggle}>
                <Ionicons name={status ? "checkbox" : "square-outline"} size={22} color={status ? Colors.primary : Colors.textSecondary} />
                <Text style={{ fontSize: 14, color: Colors.text }}>Status Aktif</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                <View style={{ flex: 1 }}><Button title="Batal" variant="outline" onPress={() => setShow(false)} /></View>
                <View style={{ flex: 1 }}><Button title="Simpan" onPress={save} /></View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PickerModal visible={showJabatan} title="Pilih Jabatan" items={JABATANS} selectedId={jabatan} onSelect={(j) => setJabatan(j.id)} onClose={() => setShowJabatan(false)} />
      <ConfirmDialog visible={!!deleteId} title="Hapus?" message="Data petugas akan dihapus permanen." onCancel={() => setDeleteId(null)} onConfirm={remove} />
    </ScreenContainer>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, maxHeight: "85%" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 14 },
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
  toggle: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
});
