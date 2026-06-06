import { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/src/lib/theme-context";
import { Colors } from "@/src/lib/theme";
import { formatTanggalID } from "@/src/lib/format";

const BULAN_FULL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function daysInMonth(year: number, month: number) {
  // month 1-12
  return new Date(year, month, 0).getDate();
}

function parseISO(iso: string): { y: number; m: number; d: number } {
  const today = new Date();
  if (!iso) return { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() };
  const [y, m, d] = iso.split("-").map(Number);
  return { y: y || today.getFullYear(), m: m || today.getMonth() + 1, d: d || today.getDate() };
}

function parseTime(hhmm: string): { h: number; mi: number } {
  if (!hhmm) {
    const t = new Date();
    return { h: t.getHours(), mi: t.getMinutes() };
  }
  const [h, mi] = hhmm.split(":").map(Number);
  return { h: h || 0, mi: mi || 0 };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ============== DATE PICKER (cross-platform) ==============
export function DatePickerField({
  label,
  value,
  onChange,
  testID,
}: {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  testID?: string;
}) {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const [show, setShow] = useState(false);
  const initial = useMemo(() => parseISO(value), [value]);
  const [year, setYear] = useState(initial.y);
  const [month, setMonth] = useState(initial.m);
  const [day, setDay] = useState(initial.d);

  useEffect(() => {
    if (show) {
      const p = parseISO(value);
      setYear(p.y);
      setMonth(p.m);
      setDay(p.d);
    }
  }, [show, value]);

  const maxDay = daysInMonth(year, month);
  useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [maxDay, day]);

  const save = () => {
    const iso = `${year}-${pad(month)}-${pad(day)}`;
    onChange(iso);
    setShow(false);
  };

  const setToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth() + 1);
    setDay(t.getDate());
  };

  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity testID={testID} onPress={() => setShow(true)} style={styles.field} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
        <Text style={{ flex: 1, color: value ? Colors.text : Colors.textTertiary, fontSize: 15 }}>
          {value ? formatTanggalID(value) : "Pilih tanggal"}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShow(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Pilih Tanggal</Text>

            {/* Day */}
            <Stepper
              label="Tanggal"
              value={day}
              min={1}
              max={maxDay}
              onChange={setDay}
              testID="picker-day"
            />
            {/* Month */}
            <Stepper
              label="Bulan"
              value={month}
              min={1}
              max={12}
              display={BULAN_FULL[month - 1]}
              onChange={setMonth}
              testID="picker-month"
            />
            {/* Year */}
            <Stepper
              label="Tahun"
              value={year}
              min={2020}
              max={2099}
              onChange={setYear}
              testID="picker-year"
            />

            <View style={styles.preview}>
              <Ionicons name="calendar" size={18} color={Colors.primary} />
              <Text style={styles.previewText}>
                {formatTanggalID(`${year}-${pad(month)}-${pad(day)}`)}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
              <TouchableOpacity onPress={setToday} style={styles.todayBtn} activeOpacity={0.7}>
                <Ionicons name="today-outline" size={16} color={Colors.primary} />
                <Text style={{ color: Colors.primary, fontWeight: "700", fontSize: 13 }}>Hari ini</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShow(false)} style={styles.cancelBtn} activeOpacity={0.7}>
                <Text style={{ color: Colors.textSecondary, fontWeight: "700", fontSize: 14 }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={save} style={styles.saveBtn} activeOpacity={0.85} testID="picker-save">
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ============== TIME PICKER (cross-platform) ==============
export function TimePickerField({
  label,
  value,
  onChange,
  testID,
}: {
  label?: string;
  value: string; // HH:MM
  onChange: (v: string) => void;
  testID?: string;
}) {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const [show, setShow] = useState(false);
  const initial = useMemo(() => parseTime(value), [value]);
  const [hour, setHour] = useState(initial.h);
  const [minute, setMinute] = useState(initial.mi);

  useEffect(() => {
    if (show) {
      const p = parseTime(value);
      setHour(p.h);
      setMinute(p.mi);
    }
  }, [show, value]);

  const save = () => {
    onChange(`${pad(hour)}:${pad(minute)}`);
    setShow(false);
  };

  const setNow = () => {
    const t = new Date();
    setHour(t.getHours());
    setMinute(t.getMinutes());
  };

  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity testID={testID} onPress={() => setShow(true)} style={styles.field} activeOpacity={0.7}>
        <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
        <Text style={{ flex: 1, color: value ? Colors.text : Colors.textTertiary, fontSize: 15 }}>
          {value || "Pilih jam"}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShow(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Pilih Jam</Text>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <WheelPicker label="Jam" value={hour} items={Array.from({ length: 24 }, (_, i) => i)} onChange={setHour} />
              </View>
              <View style={{ flex: 1 }}>
                <WheelPicker label="Menit" value={minute} items={Array.from({ length: 60 }, (_, i) => i)} onChange={setMinute} />
              </View>
            </View>

            <View style={styles.preview}>
              <Ionicons name="time" size={18} color={Colors.primary} />
              <Text style={styles.previewText}>{pad(hour)}:{pad(minute)}</Text>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
              <TouchableOpacity onPress={setNow} style={styles.todayBtn} activeOpacity={0.7}>
                <Ionicons name="alarm-outline" size={16} color={Colors.primary} />
                <Text style={{ color: Colors.primary, fontWeight: "700", fontSize: 13 }}>Sekarang</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShow(false)} style={styles.cancelBtn} activeOpacity={0.7}>
                <Text style={{ color: Colors.textSecondary, fontWeight: "700", fontSize: 14 }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={save} style={styles.saveBtn} activeOpacity={0.85}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ============== STEPPER ==============
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  display,
  testID,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  display?: string;
  testID?: string;
}) {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const dec = () => onChange(value > min ? value - 1 : max);
  const inc = () => onChange(value < max ? value + 1 : min);
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity onPress={dec} style={styles.stepperBtn} activeOpacity={0.7} testID={`${testID}-dec`}>
          <Ionicons name="remove" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.stepperValue} testID={testID}>{display || value}</Text>
        <TouchableOpacity onPress={inc} style={styles.stepperBtn} activeOpacity={0.7} testID={`${testID}-inc`}>
          <Ionicons name="add" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============== WHEEL PICKER (scroll-based for hour/minute) ==============
function WheelPicker({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: number;
  items: number[];
  onChange: (v: number) => void;
}) {
  const Colors = useColors();
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 11, color: Colors.textSecondary, fontWeight: "700", textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </Text>
      <ScrollView
        style={{ height: 160, width: "100%" }}
        contentContainerStyle={{ paddingVertical: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {items.map((it) => (
          <TouchableOpacity
            key={it}
            onPress={() => onChange(it)}
            style={{ paddingVertical: 8, alignItems: "center" }}
          >
            <Text
              style={{
                fontSize: value === it ? 24 : 16,
                fontWeight: value === it ? "800" : "500",
                color: value === it ? Colors.primary : Colors.textTertiary,
              }}
            >
              {pad(it)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 6 },
  field: {
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 12, textAlign: "center" },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  stepperLabel: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  stepperControls: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.successBg,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: { fontSize: 18, fontWeight: "800", color: Colors.text, minWidth: 100, textAlign: "center" },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.successBg,
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
    justifyContent: "center",
  },
  previewText: { fontSize: 16, fontWeight: "800", color: Colors.primary },
  todayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
    alignItems: "center",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
});
