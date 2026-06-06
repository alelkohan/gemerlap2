import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "@/src/lib/api";
import { Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";
import { formatTanggalID } from "@/src/lib/format";
import { Card, Badge, EmptyState, FAB, Input, ConfirmDialog } from "@/src/components/ui";

type Timbangan = {
  id: string;
  tanggal: string;
  jam: string;
  unit_id: string;
  unit_nama?: string;
  bobot_total: number;
  status_pilah: boolean;
};

type Filter = "all" | "belum" | "sudah";

export default function TimbanganScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const router = useRouter();
  const [items, setItems] = useState<Timbangan[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Timbangan[]>("/timbangan");
      setItems(data);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filter === "belum" && it.status_pilah) return false;
      if (filter === "sudah" && !it.status_pilah) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          (it.unit_nama || "").toLowerCase().includes(q) ||
          it.tanggal.includes(q)
        );
      }
      return true;
    });
  }, [items, search, filter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/timbangan/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Timbangan</Text>
        <Text style={styles.subtitle}>Catatan berat sampah masuk</Text>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Input
          placeholder="Cari unit atau tanggal..."
          value={search}
          onChangeText={setSearch}
          containerStyle={{ marginBottom: 10 }}
        />
        <View style={styles.segmentRow}>
          {(["all", "belum", "sudah"] as Filter[]).map((f) => (
            <TouchableOpacity
              key={f}
              testID={`filter-${f}`}
              onPress={() => setFilter(f)}
              style={[styles.segment, filter === f && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, filter === f && styles.segmentTextActive]}>
                {f === "all" ? "Semua" : f === "belum" ? "Belum Dipilah" : "Sudah Dipilah"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={Colors.primary}
          />
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon="scale-outline"
            title="Belum ada catatan timbangan"
            subtitle="Tap tombol + untuk menambah catatan baru"
          />
        ) : (
          filtered.map((it) => (
            <Card key={it.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[styles.icon, { backgroundColor: it.status_pilah ? Colors.successBg : Colors.errorBg }]}>
                  <Ionicons
                    name={it.status_pilah ? "checkmark-circle" : "warning"}
                    size={22}
                    color={it.status_pilah ? Colors.success : Colors.error}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Text style={{ fontWeight: "700", color: Colors.text, fontSize: 15 }}>
                      {it.unit_nama || "-"}
                    </Text>
                    <Badge
                      label={it.status_pilah ? "Sudah" : "Belum"}
                      variant={it.status_pilah ? "success" : "error"}
                      small
                    />
                  </View>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
                    {formatTanggalID(it.tanggal)} • {it.jam} • {it.bobot_total} kg
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setOpenMenuId(openMenuId === it.id ? null : it.id)} style={{ padding: 6 }}>
                  <Ionicons name="ellipsis-vertical" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {openMenuId === it.id && (
                <View style={styles.menuActions}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setOpenMenuId(null);
                      router.push(`/timbangan/${it.id}/kelola`);
                    }}
                  >
                    <Ionicons name="layers-outline" size={18} color={Colors.primary} />
                    <Text style={styles.menuText}>Kelola Pilahan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setOpenMenuId(null);
                      router.push(`/timbangan/form?id=${it.id}`);
                    }}
                  >
                    <Ionicons name="create-outline" size={18} color={Colors.info} />
                    <Text style={styles.menuText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setOpenMenuId(null);
                      setDeleteId(it.id);
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                    <Text style={[styles.menuText, { color: Colors.error }]}>Hapus</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      <FAB onPress={() => router.push("/timbangan/form")} testID="add-timbangan-fab" />

      <ConfirmDialog
        visible={!!deleteId}
        title="Hapus Catatan?"
        message="Catatan timbangan beserta pilahannya akan dihapus permanen."
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </SafeAreaView>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "800", color: Colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  segmentRow: {
    flexDirection: "row",
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  segment: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  segmentActive: { backgroundColor: Colors.surface, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  segmentText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  segmentTextActive: { color: Colors.primary },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  menuActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-around",
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  menuText: { fontSize: 13, fontWeight: "600", color: Colors.text },
});
