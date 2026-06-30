import { useCallback, useState, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, Alert, Modal, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button, Input, FAB, EmptyState, ConfirmDialog, AlertDialog } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { useColors } from "@/src/lib/theme-context";

type TPSLocation = {
  id: string;
  nama: string;
  latitude: number;
  longitude: number;
  radius_meter: number;
};

export default function TPSLocationsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState<TPSLocation[]>([]);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("100");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<TPSLocation[]>("/tps-locations");
      setItems(data);
    } catch (e: any) {
      console.warn("Failed to load TPS locations:", e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openNew = () => {
    setEditId(null);
    setNama("");
    setLatitude("");
    setLongitude("");
    setRadius("100");
    setShow(true);
  };

  const openEdit = (loc: TPSLocation) => {
    setEditId(loc.id);
    setNama(loc.nama);
    setLatitude(String(loc.latitude));
    setLongitude(String(loc.longitude));
    setRadius(String(loc.radius_meter));
    setShow(true);
  };

  const fetchCurrentLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Izin Ditolak", "Izin lokasi diperlukan untuk mengambil koordinat perangkat.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(String(loc.coords.latitude));
      setLongitude(String(loc.coords.longitude));
    } catch (e: any) {
      Alert.alert("Gagal Mendapatkan GPS", e.message || "Pastikan GPS perangkat Anda telah diaktifkan.");
    } finally {
      setGpsLoading(false);
    }
  };

  const save = async () => {
    if (!nama.trim()) return Alert.alert("Error", "Nama lokasi TPS wajib diisi");
    
    const lat = parseFloat(latitude.replace(",", "."));
    const lon = parseFloat(longitude.replace(",", "."));
    const rad = parseFloat(radius);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return Alert.alert("Error", "Latitude harus berupa angka antara -90 dan 90");
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      return Alert.alert("Error", "Longitude harus berupa angka antara -180 dan 180");
    }
    if (isNaN(rad) || rad <= 0) {
      return Alert.alert("Error", "Radius harus berupa angka positif dalam meter");
    }

    try {
      const body = { nama, latitude: lat, longitude: lon, radius_meter: rad };
      if (editId) {
        await apiFetch(`/tps-locations/${editId}`, { method: "PUT", body });
      } else {
        await apiFetch(`/tps-locations`, { method: "POST", body });
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
      await apiFetch(`/tps-locations/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } catch (e: any) {
      setDeleteId(null);
      setErrorMsg(e.message || "Lokasi ini tidak bisa dihapus.");
    }
  };

  return (
    <ScreenContainer title="Lokasi TPS">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {items.length === 0 ? (
          <EmptyState
            icon="location-outline"
            title="Belum ada wilayah TPS"
            subtitle="Tap tombol + untuk menambahkan lokasi baru"
          />
        ) : (
          items.map((loc, idx) => (
            <Card key={`${loc.id}-${idx}`} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[styles.iconBox, { backgroundColor: Colors.primary + "15" }]}>
                  <Ionicons name="location" size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{loc.nama}</Text>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 4 }}>
                    Radius: {loc.radius_meter} meter
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.textTertiary, marginTop: 2 }}>
                    GPS: {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                  </Text>
                </View>
                {isAdmin && (
                  <TouchableOpacity onPress={() => openEdit(loc)} style={{ padding: 8 }}>
                    <Ionicons name="create-outline" size={20} color={Colors.info} />
                  </TouchableOpacity>
                )}
                {isAdmin && (
                  <TouchableOpacity onPress={() => setDeleteId(loc.id)} style={{ padding: 8 }}>
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
          <ScrollView contentContainerStyle={{ justifyContent: "center", flexGrow: 1, padding: 24 }}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{editId ? "Edit Lokasi TPS" : "Tambah Lokasi TPS"}</Text>
              
              <Input
                label="Nama Lokasi / Wilayah"
                value={nama}
                onChangeText={setNama}
                placeholder="Contoh: TPS Area Barat"
                autoFocus
              />

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.text }}>Koordinat GPS</Text>
                <TouchableOpacity
                  onPress={fetchCurrentLocation}
                  disabled={gpsLoading}
                  style={styles.gpsBtn}
                  activeOpacity={0.7}
                >
                  {gpsLoading ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="locate" size={14} color={Colors.primary} />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.primary }}>Gunakan GPS HP</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Latitude"
                    value={latitude}
                    onChangeText={setLatitude}
                    placeholder="Contoh: -6.20084"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Longitude"
                    value={longitude}
                    onChangeText={setLongitude}
                    placeholder="Contoh: 106.81666"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Input
                label="Radius Batas Geofence (Meter)"
                value={radius}
                onChangeText={setRadius}
                placeholder="Default: 100"
                keyboardType="numeric"
              />

              <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                <View style={{ flex: 1 }}>
                  <Button title="Batal" variant="outline" onPress={() => setShow(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Simpan" onPress={save} />
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!deleteId}
        title="Hapus Lokasi TPS?"
        message="Wilayah lokasi TPS ini beserta batas geofencenya akan dihapus permanen."
        onCancel={() => setDeleteId(null)}
        onConfirm={remove}
      />

      <AlertDialog
        visible={!!errorMsg}
        title="Gagal Menghapus"
        message={errorMsg || ""}
        onConfirm={() => setErrorMsg(null)}
        variant="danger"
      />

    </ScreenContainer>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center" },
  modalCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 14 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary + "10",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
});
