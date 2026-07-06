import { useCallback, useState, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, Alert, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, Modal } from "react-native";
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

      {/* Form Modal */}
      <Modal transparent animationType="fade" visible={show} onRequestClose={() => setShow(false)} statusBarTranslucent>
        <Pressable style={styles.modalOverlay} onPress={() => setShow(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, width: "100%" }}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Pressable style={[styles.modalSheet, { backgroundColor: Colors.surface }]} onPress={() => {}}>
                <Text style={[styles.modalTitle, { color: Colors.text }]}>{editId ? "Edit Akun" : "Tambah Akun"}</Text>
                <Text style={styles.modalBody}>
                  {editId ? "Ubah detail informasi akun pengguna." : "Daftarkan akun pengguna baru ke sistem."}
                </Text>

                <View style={{ width: "100%", gap: 12 }}>
                  <Input label="Nama Lengkap" value={nama} onChangeText={setNama} placeholder="Nama Lengkap" />
                  <Input label="Nomor HP" value={noHp} onChangeText={setNoHp} keyboardType="phone-pad" placeholder="08xxxxxxxxxx" />
                  <Input
                    label={editId ? "Reset Password (kosongkan jika tidak diubah)" : "Password"}
                    value={password}
                    onChangeText={setPassword}
                    isPassword
                    placeholder={editId ? "Min 6 karakter" : "Min 6 karakter"}
                  />
                  <DatePickerField label="Tanggal Bergabung" value={tanggalBergabung} onChange={setTanggalBergabung} />
                  
                  <Text style={styles.label}>Role</Text>
                  <TouchableOpacity onPress={() => setShowRole(!showRole)} style={[styles.pickerBtn, { borderColor: Colors.borderLight, backgroundColor: Colors.surface, marginBottom: showRole ? 4 : 12 }]}>
                    <Text style={{ color: role ? Colors.text : Colors.textSecondary }}>
                      {ROLES.find(r => r.id === role)?.nama || "-- Pilih Role --"}
                    </Text>
                    <Ionicons name={showRole ? "chevron-up" : "chevron-down"} size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  {showRole && (
                    <View style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 12, marginBottom: 12, maxHeight: 180, overflow: "hidden" }}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true}>
                        {ROLES.map((r, idx, arr) => {
                          const isSelected = r.id === role;
                          return (
                            <TouchableOpacity
                              key={r.id}
                              style={{
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                                borderBottomColor: Colors.borderLight,
                                backgroundColor: isSelected ? Colors.primary + "12" : Colors.surface,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between"
                              }}
                              onPress={() => {
                                setRole(r.id as any);
                                setShowRole(false);
                              }}
                            >
                              <Text style={{ fontSize: 14, color: Colors.text, fontWeight: isSelected ? "700" : "400" }}>{r.nama}</Text>
                              {isSelected && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Checklist Status */}
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 8 }}
                    onPress={() => setStatus(status === "Aktif" ? "Resign" : "Aktif")}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={status === "Aktif" ? "checkbox" : "square-outline"}
                      size={22}
                      color={status === "Aktif" ? Colors.primary : Colors.textTertiary}
                    />
                    <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.text }}>
                      Akun Aktif (Uncheck jika Resign)
                    </Text>
                  </TouchableOpacity>

                  {status === "Resign" && (
                    <DatePickerField label="Tanggal Keluar (Resign)" value={tanggalKeluar} onChange={setTanggalKeluar} />
                  )}
                </View>

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: Colors.borderLight }]}
                    onPress={() => setShow(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalBtnText, { color: Colors.textSecondary }]}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: Colors.primary, flex: 1.4 }]}
                    onPress={save}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalBtnText, { color: Colors.textOnPrimary }]}>Simpan</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)"
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 28,
    paddingVertical: 40
  },
  modalSheet: {
    width: "100%",
    backgroundColor: Colors.surface,
    padding: 28,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
    alignItems: "center"
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.3
  },
  modalBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 16
  },
  modalBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "800"
  },
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
