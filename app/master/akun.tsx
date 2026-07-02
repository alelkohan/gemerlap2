import { useCallback, useState, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, Alert, Modal, StyleSheet, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button, Input, FAB, EmptyState, ConfirmDialog, Badge, PickerModal } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";
import { DatePickerField } from "@/src/components/date-picker";
import { formatTanggalID } from "@/src/lib/format";

type User = { id: string; nama: string; no_hp: string; role: "admin" | "petugas" | "auditor"; tanggal_bergabung?: string; tanggal_keluar?: string };
const ROLES = [
  { id: "admin", nama: "Admin" },
  { id: "petugas", nama: "Petugas" },
  { id: "auditor", nama: "Auditor" },
];

export default function KelolaAkun() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { user } = useAuth();
  const isAuditor = user?.role === "auditor";
  const [items, setItems] = useState<User[]>([]);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [noHp, setNoHp] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "petugas" | "auditor">("petugas");
  const [showRole, setShowRole] = useState(false);
  const [tanggalBergabung, setTanggalBergabung] = useState("");
  const [tanggalKeluar, setTanggalKeluar] = useState("");
  const [status, setStatus] = useState<"Aktif" | "Resign">("Aktif");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    let result = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((u) => u.nama.toLowerCase().includes(q) || u.no_hp.includes(q));
    }
    // Sort: auditor first, then admin, then petugas. If same role, sort by name
    return result.sort((a, b) => {
      const roleWeight = { auditor: 1, admin: 2, petugas: 3 };
      const wA = roleWeight[a.role] || 4;
      const wB = roleWeight[b.role] || 4;
      if (wA !== wB) return wA - wB;
      return a.nama.localeCompare(b.nama);
    });
  }, [items, searchQuery]);

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
    setTanggalBergabung("");
    setTanggalKeluar("");
    setStatus("Aktif");
    setShow(true);
  };

  const openEdit = (u: User) => {
    setEditId(u.id);
    setNama(u.nama);
    setNoHp(u.no_hp);
    setPassword("");
    setRole(u.role);
    setTanggalBergabung(u.tanggal_bergabung || "");
    setTanggalKeluar(u.tanggal_keluar || "");
    setStatus(u.tanggal_keluar ? "Resign" : "Aktif");
    setShow(true);
  };

  const save = async () => {
    if (!nama.trim()) return Alert.alert("Error", "Nama wajib diisi");
    if (!tanggalBergabung) return Alert.alert("Error", "Tanggal bergabung wajib diisi");
    if (!editId) {
      if (!noHp.trim()) return Alert.alert("Error", "No HP wajib diisi");
      if (!password || password.length < 6) return Alert.alert("Error", "Password min 6 karakter");
    }
    try {
      const payload: any = { 
        nama, 
        role, 
        no_hp: noHp,
        tanggal_bergabung: tanggalBergabung,
        tanggal_keluar: status === "Resign" ? tanggalKeluar : null
      };

      if (editId) {
        if (password) payload.password = password;
        await apiFetch(`/users/${editId}`, { method: "PUT", body: payload });
      } else {
        payload.password = password;
        await apiFetch(`/users`, { method: "POST", body: payload });
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
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textTertiary} />
          <TextInput
            placeholder="Cari nama atau no hp..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: Colors.text }]}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {filteredItems.length === 0 ? (
          <EmptyState icon="people-outline" title={searchQuery ? "Pencarian tidak ditemukan" : "Belum ada akun"} />
        ) : (
          filteredItems.map((u) => (
            <Card key={u.id} style={{ marginBottom: 10, opacity: u.tanggal_keluar ? 0.6 : 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{initials(u.nama)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{u.nama}</Text>
                    <Badge label={u.role === "admin" ? "Admin" : (u.role === "auditor" ? "Auditor" : "Petugas")} variant={u.role === "admin" ? "success" : (u.role === "auditor" ? "warning" : "info")} small />
                    {u.tanggal_keluar && <Badge label="Resign" variant="error" small />}
                  </View>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>{u.no_hp}</Text>
                  {u.tanggal_bergabung ? (
                    <Text style={{ fontSize: 11, color: Colors.textTertiary, marginTop: 4 }}>
                      Bergabung: {formatTanggalID(u.tanggal_bergabung)}
                      {u.tanggal_keluar ? `  •  Resign: ${formatTanggalID(u.tanggal_keluar)}` : ""}
                    </Text>
                  ) : null}
                </View>
                {!isAuditor && (
                  <TouchableOpacity onPress={() => openEdit(u)} style={{ padding: 8 }}>
                    <Ionicons name="create-outline" size={20} color={Colors.info} />
                  </TouchableOpacity>
                )}
                {!isAuditor && u.id !== user?.id && (
                  <TouchableOpacity onPress={() => setDeleteId(u.id)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {!isAuditor && <FAB onPress={openNew} />}

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editId ? "Edit Akun" : "Tambah Akun"}</Text>
              <Input label="Nama Lengkap" value={nama} onChangeText={setNama} />
              <Input label="Nomor HP" value={noHp} onChangeText={setNoHp} keyboardType="phone-pad" />
              <Input
                label={editId ? "Reset Password (kosongkan jika tidak diubah)" : "Password"}
                value={password}
                onChangeText={setPassword}
                isPassword
                placeholder={editId ? "Min 6 karakter" : "Min 6 karakter"}
              />
              <DatePickerField label="Tanggal Bergabung" value={tanggalBergabung} onChange={setTanggalBergabung} />
              
              <Text style={styles.label}>Role</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => setRole(r.id as any)}
                    style={[
                      styles.pickerBtn,
                      {
                        flex: 1,
                        backgroundColor: role === r.id ? Colors.primary + "15" : Colors.surface,
                        borderColor: role === r.id ? Colors.primary : Colors.border,
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: role === r.id ? Colors.primary : Colors.text,
                        fontSize: 14,
                        fontWeight: "700",
                        textAlign: "center",
                      }}
                    >
                      {r.nama}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Status Akun</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                {["Aktif", "Resign"].map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setStatus(s as any)}
                    style={[
                      styles.pickerBtn,
                      {
                        flex: 1,
                        backgroundColor: status === s ? Colors.primary + "15" : Colors.surface,
                        borderColor: status === s ? Colors.primary : Colors.border,
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: status === s ? Colors.primary : Colors.text,
                        fontSize: 14,
                        fontWeight: "700",
                        textAlign: "center",
                      }}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {status === "Resign" && (
                <DatePickerField label="Tanggal Keluar (Resign)" value={tanggalKeluar} onChange={setTanggalKeluar} />
              )}

              <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                <View style={{ flex: 1 }}><Button title="Batal" variant="outline" onPress={() => setShow(false)} /></View>
                <View style={{ flex: 1 }}><Button title="Simpan" onPress={save} /></View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>


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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
  },
});
