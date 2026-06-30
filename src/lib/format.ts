export function rupiah(n: number | null | undefined): string {
  if (n == null) return "Rp 0";
  const num = Math.round(n);
  return "Rp " + num.toLocaleString("id-ID");
}

export function formatRupiahInput(value: string): string {
  if (!value) return "";
  const numberString = value.replace(/[^0-9]/g, "");
  if (!numberString) return "";
  return "Rp " + parseInt(numberString, 10).toLocaleString("id-ID");
}

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function formatTanggalID(iso: string): string {
  // expects YYYY-MM-DD
  if (!iso) return "-";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const d = parseInt(parts[2], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parts[0];
  return `${d} ${BULAN[m] || ""} ${y}`;
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nowHHMM(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function currentBulan(): string {
  // YYYY-MM
  return todayISO().slice(0, 7);
}

export function bulanLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const mi = parseInt(m, 10) - 1;
  return `${BULAN[mi] || ""} ${y}`;
}

export function addMonths(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
