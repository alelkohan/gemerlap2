import { useCallback, useState, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, Alert, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button, Input, FAB, EmptyState, ConfirmDialog, Badge, PickerModal } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";

type User = { id: string; nama: string; no_hp: string; role: "admin" | "petugas" };
const ROLES = [
  { id: "admin", nama: "Admin" },
  { id: "petugas", nama: "Petugas" },
];

export default function KelolaAkun() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const [items, setItems] = useState<User[]>([]);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [noHp, setNoHp] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "petugas">("petugas");
  const [showRole, setShowRole] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<User[]>("/users");
      setItems(data);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => {
    setEditId(null);
    setNama("");
    setNoHp("");
    setPassword("");
    setRole("petugas");
    setShow(true);
  };

  const openEdit = (u: User) => {
    setEditId(u.id);
    setNama(u.nama);
    setNoHp(u.no_hp);
    setPassword("");
    setRole(u.role);
    setShow(true);
  };

  const save = async () => {
    if (!nama.trim()) return Alert.alert("Error", "Nama wajib diisi");
    if (!editId) {
      if (!noHp.trim()) return Alert.alert("Error", "No HP wajib diisi");
      if (!password || password.length < 6) return Alert.alert("Error", "Password min 6 karakter");
    }
    try {
      if (editId) {
        const body: any = { nama, role };
        if (password) body.password = password;
        await apiFetch(`/users/${editId}`, { method: "PUT", body });
      } else {
        await apiFetch(`/users`, { method: "POST", body: { nama, no_hp: noHp, password, role } });
      }
      setShow(false);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/users/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
      setDeleteId(null);
    }
  };

  const initials = (n: string) => n.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <ScreenContainer title="Kelola Akun">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {items.length === 0 ? (
          <EmptyState icon="people-outline" title="Belum ada akun" />
        ) : (
          items.map((u) => (
            <Card key={u.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{initials(u.nama)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{u.nama}</Text>
                    <Badge label={u.role === "admin" ? "Admin" : "Petugas"} variant={u.role === "admin" ? "success" : "info"} small />
                  </View>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>{u.no_hp}</Text>
                </View>
                <TouchableOpacity onPress={() => openEdit(u)} style={{ padding: 8 }}>
                  <Ionicons name="create-outline" size={20} color={Colors.info} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDeleteId(u.id)} style={{ padding: 8 }}>
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
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editId ? "Edit Akun" : "Tambah Akun"}</Text>
              <Input label="Nama Lengkap" value={nama} onChangeText={setNama} />
              <Input label="Nomor HP" value={noHp} onChangeText={setNoHp} keyboardType="phone-pad" editable={!editId} />
              <Input
                label={editId ? "Reset Password (kosongkan jika tidak diubah)" : "Password"}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={editId ? "Min 6 karakter" : "Min 6 karakter"}
              />
              <Text style={styles.label}>Role</Text>
              <TouchableOpacity onPress={() => setShowRole(true)} style={styles.pickerBtn}>
                <Text style={{ flex: 1, color: Colors.text, fontSize: 15 }}>
                  {role === "admin" ? "Admin" : "Petugas"}
                </Text>
                <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                <View style={{ flex: 1 }}><Button title="Batal" variant="outline" onPress={() => setShow(false)} /></View>
                <View style={{ flex: 1 }}><Button title="Simpan" onPress={save} /></View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PickerModal
        visible={showRole}
        title="Pilih Role"
        items={ROLES}
        selectedId={role}
        onSelect={(r) => setRole(r.id as any)}
        onClose={() => setShowRole(false)}
      />

      <ConfirmDialog
        visible={!!deleteId}
        title="Hapus Akun?"
        message="Akun akan dihapus permanen."
        onCancel={() => setDeleteId(null)}
        onConfirm={remove}
      />
    </ScreenContainer>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, maxHeight: "80%" },
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
