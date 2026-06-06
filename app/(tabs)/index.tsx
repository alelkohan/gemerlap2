import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Rect, Text as SvgText, Line } from "react-native-svg";

import { useAuth } from "@/src/lib/auth-context";
import { apiFetch } from "@/src/lib/api";
import { LOGO_IMG, Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";
import { rupiah, currentBulan, bulanLabel, addMonths, formatTanggalID } from "@/src/lib/format";
import { Card, Badge, EmptyState } from "@/src/components/ui";

type Stats = {
  total_berat: number;
  saldo: number;
  catatan_masuk: number;
  belum_dipilah: number;
  chart: { tanggal: string; total: number }[];
  recent: any[];
  bulan: string;
};

export default function HomeScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [bulan, setBulan] = useState(currentBulan());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Stats>(`/dashboard/stats?bulan=${bulan}`);
      setStats(data);
    } catch (e) {
      console.warn(e);
    }
  }, [bulan]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Image source={LOGO_IMG} style={{ width: 44, height: 44 }} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Assalamu'alaikum,</Text>
            <Text style={styles.userName}>{user?.nama}</Text>
          </View>
          <Badge
            label={user?.role === "admin" ? "Admin" : "Petugas"}
            variant={user?.role === "admin" ? "success" : "info"}
          />
        </View>

        {/* Stat cards */}
        <View style={styles.statGrid}>
          <StatCard
            icon="scale-outline"
            label="Berat Bulan Ini"
            value={`${(stats?.total_berat || 0).toFixed(1)} kg`}
            color={Colors.primary}
          />
          <StatCard
            icon="wallet-outline"
            label="Saldo Utama"
            value={rupiah(stats?.saldo || 0)}
            color={Colors.success}
          />
          <StatCard
            icon="document-text-outline"
            label="Catatan Masuk"
            value={`${stats?.catatan_masuk || 0}`}
            color={Colors.info}
          />
          <StatCard
            icon="warning-outline"
            label="Belum Dipilah"
            value={`${stats?.belum_dipilah || 0}`}
            color={Colors.error}
          />
        </View>

        {/* Chart */}
        <Card style={{ marginTop: 16 }}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Berat per Hari</Text>
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={() => setBulan(addMonths(bulan, -1))} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={18} color={Colors.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.text, minWidth: 100, textAlign: "center" }}>
                {bulanLabel(bulan)}
              </Text>
              <TouchableOpacity onPress={() => setBulan(addMonths(bulan, 1))} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          <BarChart data={stats?.chart || []} maxBobot={stats?.total_berat} />
        </Card>

        {/* Recent */}
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={styles.sectionTitle}>Aktivitas Terbaru</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/timbangan")}>
              <Text style={{ color: Colors.primary, fontWeight: "600", fontSize: 13 }}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>
          {(stats?.recent || []).length === 0 ? (
            <EmptyState
              icon="time-outline"
              title="Belum ada catatan"
              subtitle="Mulai catat timbangan sampah pertama Anda"
            />
          ) : (
            (stats?.recent || []).map((it) => (
              <Card key={it.id} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[styles.iconCircle, { backgroundColor: Colors.successBg }]}>
                    <Ionicons name="scale" size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700", color: Colors.text, fontSize: 14 }}>
                      {it.unit_nama} • {it.bobot_total} kg
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
                      {formatTanggalID(it.tanggal)} • {it.jam}
                    </Text>
                  </View>
                  <Badge
                    label={it.status_pilah ? "Dipilah" : "Belum"}
                    variant={it.status_pilah ? "success" : "error"}
                    small
                  />
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  return (
    <View style={[styles.statCard]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BarChart({ data }: { data: { tanggal: string; total: number }[]; maxBobot?: number }) {
  const { width: screenW } = useWindowDimensions();
  // 16 padding outer + 16 card padding each side ~= 64
  const W = Math.max(260, Math.min(screenW - 64, 560));
  const H = 170;
  const padding = { l: 32, r: 8, t: 16, b: 28 };
  const chartW = W - padding.l - padding.r;
  const chartH = H - padding.t - padding.b;
  const Colors = useColors();
  if (data.length === 0) {
    return (
      <View style={{ height: 160, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="bar-chart-outline" size={36} color={Colors.textTertiary} />
        <Text style={{ color: Colors.textTertiary, marginTop: 6, fontSize: 13 }}>Belum ada data</Text>
      </View>
    );
  }
  const max = Math.max(...data.map((d) => d.total), 1);
  const barW = Math.max(4, (chartW - data.length * 4) / data.length);
  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={W} height={H}>
        <Line x1={padding.l} y1={padding.t + chartH} x2={W - padding.r} y2={padding.t + chartH} stroke={Colors.border} strokeWidth={1} />
        {data.map((d, i) => {
          const h = (d.total / max) * chartH;
          const x = padding.l + i * (barW + 4);
          const y = padding.t + chartH - h;
          return (
            <Rect
              key={d.tanggal}
              x={x}
              y={y}
              width={barW}
              height={h}
              fill={Colors.primary}
              rx={3}
            />
          );
        })}
        <SvgText x={padding.l} y={padding.t + chartH + 16} fontSize={9} fill={Colors.textSecondary}>
          {data[0]?.tanggal.slice(8)}
        </SvgText>
        <SvgText x={W - padding.r - 16} y={padding.t + chartH + 16} fontSize={9} fill={Colors.textSecondary}>
          {data[data.length - 1]?.tanggal.slice(8)}
        </SvgText>
        <SvgText x={4} y={padding.t + 4} fontSize={9} fill={Colors.textSecondary}>
          {max.toFixed(0)}kg
        </SvgText>
      </Svg>
    </View>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: { fontSize: 12, color: Colors.textSecondary },
  userName: { fontSize: 18, fontWeight: "700", color: Colors.text },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    width: "48%",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: { fontSize: 16, fontWeight: "800", color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 10,
    padding: 2,
  },
  navBtn: { padding: 4 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
