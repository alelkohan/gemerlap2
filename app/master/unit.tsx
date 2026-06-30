import { useCallback, useState, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button, Input, FAB, EmptyState, ConfirmDialog } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";

type Unit = { id: string; nama: string; aktif: boolean };

// ─── Result Modal (error/info) ────────────────────────────────────────────────
function ResultModal({
  visible,
  title,
  message,
  onClose,
  Colors,
}: {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  Colors: any;
}) {
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}>
      <Pressable style={customModalStyles.overlay} onPress={onClose}>
        <Pressable style={[customModalStyles.sheet, { backgroundColor: Colors.surface }]} onPress={() => {}}>
          <View style={[customModalStyles.iconWrap, { backgroundColor: Colors.errorBg }]}>
            <Ionicons name="close-circle" size={38} color={Colors.error} />
          </View>
          <Text style={[customModalStyles.title, { color: Colors.text }]}>{title}</Text>
          {!!message && (
            <Text style={[customModalStyles.body, { color: Colors.textSecondary }]}>{message}</Text>
          )}
          <TouchableOpacity
            style={[customModalStyles.singleBtn, { backgroundColor: Colors.error }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={customModalStyles.singleBtnText}>OK</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </View>
  );
}

const customModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  sheet: {
    width: "100%",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  singleBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  singleBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
});

export default function UnitScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState<Unit[]>([]);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [aktif, setAktif] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState({ visible: false, title: "", message: "" });

  const load = useCallback(async () => {
    const data = await apiFetch<Unit[]>("/units");
    setItems(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => {
    setEditId(null);
    setNama("");
    setAktif(true);
    setShow(true);
  };

  const openEdit = (u: Unit) => {
    setEditId(u.id);
    setNama(u.nama);
    setAktif(u.aktif);
    setShow(true);
  };

  const save = async () => {
    if (!nama.trim()) {
      setErrorModal({ visible: true, title: "Error", message: "Nama unit wajib diisi" });
      return;
    }
    try {
      if (editId) {
        await apiFetch(`/units/${editId}`, { method: "PUT", body: { nama, aktif } });
      } else {
        await apiFetch(`/units`, { method: "POST", body: { nama, aktif } });
      }
      setShow(false);
      await load();
    } catch (e: any) {
      setErrorModal({ visible: true, title: "Error", message: e.message });
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/units/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } catch (e: any) {
      setDeleteId(null);
      setErrorModal({ visible: true, title: "Gagal Menghapus", message: e.message || "Unit tidak bisa dihapus karena masih dipakai." });
    }
  };

  return (
    <ScreenContainer title="Unit">
      <ResultModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => setErrorModal({ visible: false, title: "", message: "" })}
        Colors={Colors}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {items.length === 0 ? (
          <EmptyState icon="business-outline" title="Belum ada unit" subtitle="Tap + untuk menambah unit baru" />
        ) : (
          items.map((u) => (
            <Card key={u.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.successBg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="business" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{u.nama}</Text>
                  <Text style={{ fontSize: 11, color: u.aktif ? Colors.success : Colors.textTertiary }}>
                    {u.aktif ? "Aktif" : "Nonaktif"}
                  </Text>
                </View>
                {isAdmin && (
                  <TouchableOpacity onPress={() => openEdit(u)} style={{ padding: 8 }}>
                    <Ionicons name="create-outline" size={20} color={Colors.info} />
                  </TouchableOpacity>
                )}
                {isAdmin && (
                  <TouchableOpacity onPress={() => setDeleteId(u.id)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
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
            <Text style={styles.modalTitle}>{editId ? "Edit Unit" : "Tambah Unit"}</Text>
            <Input label="Nama Unit" value={nama} onChangeText={setNama} placeholder="Contoh: Asrama Putra" autoFocus />
            <TouchableOpacity onPress={() => setAktif(!aktif)} style={styles.toggle}>
              <Ionicons name={aktif ? "checkbox" : "square-outline"} size={22} color={aktif ? Colors.primary : Colors.textSecondary} />
              <Text style={{ fontSize: 14, color: Colors.text }}>Aktif</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}><Button title="Batal" variant="outline" onPress={() => setShow(false)} /></View>
              <View style={{ flex: 1 }}><Button title="Simpan" onPress={save} /></View>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!deleteId}
        title="Hapus Unit?"
        message="Unit akan dihapus permanen."
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
  toggle: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 },
});
