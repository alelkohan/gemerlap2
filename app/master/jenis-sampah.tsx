import { useCallback, useState, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, Alert, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button, Input, FAB, EmptyState, ConfirmDialog, Badge, PickerModal } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";

type Jenis = { id: string; nama: string; tipe: "komoditas" | "bakar" | "lain" };
const TIPES = [
  { id: "komoditas", nama: "Komoditas (bisa dijual)" },
  { id: "bakar", nama: "Bakar" },
  { id: "lain", nama: "Lain-lain" },
];

export default function JenisSampahScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const [items, setItems] = useState<Jenis[]>([]);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [tipe, setTipe] = useState<Jenis["tipe"]>("komoditas");
  const [showTipe, setShowTipe] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<Jenis[]>("/jenis-sampah");
    setItems(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => {
    setEditId(null);
    setNama("");
    setTipe("komoditas");
    setShow(true);
  };

  const openEdit = (j: Jenis) => {
    setEditId(j.id);
    setNama(j.nama);
    setTipe(j.tipe);
    setShow(true);
  };

  const save = async () => {
    if (!nama.trim()) return Alert.alert("Error", "Nama wajib diisi");
    try {
      const body = { nama, tipe };
      if (editId) await apiFetch(`/jenis-sampah/${editId}`, { method: "PUT", body });
      else await apiFetch(`/jenis-sampah`, { method: "POST", body });
      setShow(false);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    await apiFetch(`/jenis-sampah/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    await load();
  };

  const tipeBadge = (t: string) => {
    if (t === "komoditas") return <Badge label="Komoditas" variant="success" small />;
    if (t === "bakar") return <Badge label="Bakar" variant="error" small />;
    return <Badge label="Lain" variant="neutral" small />;
  };

  return (
    <ScreenContainer title="Jenis Komoditas">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {items.length === 0 ? (
          <EmptyState icon="leaf-outline" title="Belum ada jenis komoditas" />
        ) : (
          items.map((j) => (
            <Card key={j.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.successBg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="leaf" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{j.nama}</Text>
                  <View style={{ marginTop: 4, alignSelf: "flex-start" }}>{tipeBadge(j.tipe)}</View>
                </View>
                <TouchableOpacity onPress={() => openEdit(j)} style={{ padding: 8 }}>
                  <Ionicons name="create-outline" size={20} color={Colors.info} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDeleteId(j.id)} style={{ padding: 8 }}>
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <FAB onPress={openNew} />

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editId ? "Edit Jenis Sampah" : "Tambah Jenis Sampah"}</Text>
            <Input label="Nama" value={nama} onChangeText={setNama} autoFocus />
            <Text style={styles.label}>Tipe</Text>
            <TouchableOpacity onPress={() => setShowTipe(true)} style={styles.pickerBtn}>
              <Text style={{ flex: 1, color: Colors.text, fontSize: 15 }}>
                {TIPES.find((t) => t.id === tipe)?.nama}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <View style={{ flex: 1 }}><Button title="Batal" variant="outline" onPress={() => setShow(false)} /></View>
              <View style={{ flex: 1 }}><Button title="Simpan" onPress={save} /></View>
            </View>
          </View>
        </View>
      </Modal>

      <PickerModal
        visible={showTipe}
        title="Pilih Tipe"
        items={TIPES}
        selectedId={tipe}
        onSelect={(t) => setTipe(t.id as any)}
        onClose={() => setShowTipe(false)}
      />

      <ConfirmDialog
        visible={!!deleteId}
        title="Hapus?"
        message="Jenis komoditas akan dihapus permanen."
        onCancel={() => setDeleteId(null)}
        onConfirm={remove}
      />
    </ScreenContainer>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24 },
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
});
