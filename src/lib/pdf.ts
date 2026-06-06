import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform, Alert } from "react-native";

import { LOGO_URL, ORG } from "./theme";
import { rupiah, formatTanggalID } from "./format";

const HEADER_HTML = `
<div style="display:flex;align-items:center;gap:16px;border-bottom:2px solid #1a7a4a;padding-bottom:12px;margin-bottom:16px;">
  <img src="${LOGO_URL}" style="height:64px;width:64px;object-fit:contain;border-radius:8px;padding:4px;" />
  <div>
    <h2 style="margin:0;color:#1a7a4a;font-size:20px;">${ORG.name}</h2>
    <div style="font-size:11px;color:#4b5563;margin-top:4px;">${ORG.alamat}</div>
    <div style="font-size:11px;color:#1a7a4a;font-weight:600;margin-top:2px;">${ORG.org}</div>
  </div>
</div>
`;

const FOOTER_HTML = `
<div style="margin-top:32px;padding-top:12px;border-top:1px dashed #9ca3af;font-size:10px;color:#9ca3af;text-align:center;">
  Dokumen ini dicetak secara otomatis oleh sistem TPS Manager
</div>
`;

function baseStyles() {
  return `
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #1f2937; }
    table { width: 100%; border-collapse: collapse; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; }
    .row .label { color: #6b7280; }
    .row .value { font-weight: 600; }
    .total-box { background: #f0fdf4; border: 2px solid #1a7a4a; border-radius: 8px; padding: 16px; margin-top: 16px; }
    .total-label { color: #1a7a4a; font-size: 12px; text-transform: uppercase; font-weight: 700; }
    .total-val { color: #1a7a4a; font-size: 26px; font-weight: 800; margin-top: 4px; }
    .sig { margin-top: 48px; display: flex; justify-content: flex-end; }
    .sig-box { text-align: center; min-width: 180px; }
    .sig-line { border-bottom: 1px solid #9ca3af; height: 60px; }
    .sig-name { font-size: 12px; margin-top: 8px; color: #4b5563; }
    h1.title { font-size: 22px; margin: 8px 0 4px; color: #1a7a4a; }
    .invoice-no { font-family: monospace; font-size: 14px; color: #4b5563; }
    th, td { padding: 8px; text-align: left; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
    th { background: #f0fdf4; color: #1a7a4a; font-weight: 700; }
  `;
}

export async function printPdf(html: string, fileName: string) {
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles()}</style></head><body>${html}</body></html>`;
  try {
    const { uri } = await Print.printToFileAsync({ html: fullHtml, base64: false });
    if (Platform.OS === "web") {
      // On web, open in new tab
      window.open(uri, "_blank");
      return;
    }
    const can = await Sharing.isAvailableAsync();
    if (can) {
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: fileName, UTI: "com.adobe.pdf" });
    } else {
      Alert.alert("PDF tersimpan", `File: ${uri}`);
    }
  } catch (e: any) {
    Alert.alert("Error", e.message || "Gagal membuat PDF");
  }
}

export async function generateInvoicePdf(trx: any) {
  const isPenjualan = trx.tipe === "penjualan";
  const isPengeluaran = trx.tipe === "pengeluaran";
  const isSumberLain = trx.tipe === "sumber lain" || trx.tipe === "bantuan";

  let bodyRows = "";
  if (isPenjualan) {
    bodyRows = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>No. Invoice:</span> <span>${trx.no_invoice}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Tanggal:</span> <span>${formatTanggalID(trx.tanggal)}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Pembeli:</span> <span>${trx.nama_pihak || "-"}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Komoditas:</span> <span>${trx.jenis_sampah_nama || "-"}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Berat:</span> <span>${trx.bobot_kg || 0} kg</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Harga/kg:</span> <span>${rupiah(trx.harga_per_kg || 0)}</span></div>
      ${trx.keterangan ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Ket:</span> <span>${trx.keterangan}</span></div>` : ""}
    `;
  } else if (isSumberLain) {
    bodyRows = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>No. Bukti:</span> <span>${trx.no_invoice}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Tanggal:</span> <span>${formatTanggalID(trx.tanggal)}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Sumber:</span> <span>${trx.nama_pihak || "-"}</span></div>
      ${trx.keterangan ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Ket:</span> <span>${trx.keterangan}</span></div>` : ""}
    `;
  } else if (isPengeluaran) {
    bodyRows = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>No. Bukti:</span> <span>${trx.no_invoice}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Tanggal:</span> <span>${formatTanggalID(trx.tanggal)}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Kategori:</span> <span>${trx.kategori || "-"}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Keperluan:</span> <span>${trx.keterangan || "-"}</span></div>
    `;
  }

  const title = isPenjualan ? "INVOICE PENJUALAN" : isSumberLain ? "BUKTI PEMASUKAN" : "BUKTI PENGELUARAN";
  const totalLabel = isPenjualan ? "TOTAL PENJUALAN" : isSumberLain ? "NOMINAL PEMASUKAN" : "TOTAL PENGELUARAN";

  const html = `
    <div style="max-width: 320px; margin: 0 auto; padding: 24px 16px; border: 1px solid #ddd; font-family: 'Courier New', Courier, monospace; color: #000; background: #fff;">
      <div style="text-align: center; margin-bottom: 16px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 800;">${ORG.name}</h2>
        <div style="font-size: 11px; margin-top: 4px;">${ORG.alamat}</div>
        <div style="font-size: 11px; margin-top: 2px;">${ORG.org}</div>
      </div>
      
      <div style="border-bottom: 1px dashed #000; margin-bottom: 12px;"></div>
      
      <div style="text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 12px; letter-spacing: 1px;">
        ${title}
      </div>
      
      <div style="font-size: 12px; margin-bottom: 12px;">
        ${bodyRows}
      </div>
      
      <div style="border-bottom: 1px dashed #000; margin-bottom: 12px;"></div>
      
      <div style="font-size: 14px; font-weight: bold; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between;"><span>${totalLabel}</span> <span>${rupiah(trx.total)}</span></div>
      </div>
      
      <div style="border-bottom: 1px dashed #000; margin-bottom: 24px;"></div>
      
      <div style="text-align: center; font-size: 11px;">
        <div>Hormat kami,</div>
        <div style="margin-top: 40px; text-decoration: underline;">( Admin TPS )</div>
      </div>
      
      <div style="text-align: center; font-size: 9px; margin-top: 24px; color: #666;">
        Dicetak pada ${formatTanggalID(new Date().toISOString().slice(0, 10))}
      </div>
    </div>
  `;
  await printPdf(html, `${trx.no_invoice}.pdf`);
}

export async function generateLaporanTimbanganPdf(items: any[], judul: string, userName: string) {
  const totalBobot = items.reduce((s, it) => s + (it.bobot_total || 0), 0);
  const rows = items
    .map(
      (it) => `
    <tr>
      <td>${formatTanggalID(it.tanggal)}</td>
      <td>${it.jam}</td>
      <td>${it.unit_nama}</td>
      <td style="text-align:right">${it.bobot_total} kg</td>
      <td style="text-align:center">${it.status_pilah ? "✓" : "—"}</td>
    </tr>
  `
    )
    .join("");
  const html = `
    ${HEADER_HTML}
    <h1 class="title">LAPORAN TIMBANGAN</h1>
    <div style="font-size:12px;color:#4b5563;margin-bottom:12px;">${judul}</div>
    <table>
      <thead><tr><th>Tanggal</th><th>Jam</th><th>Unit</th><th style="text-align:right">Bobot</th><th>Dipilah</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#9ca3af">Tidak ada data</td></tr>`}</tbody>
      <tfoot>
        <tr><td colspan="3" style="font-weight:700;text-align:right">TOTAL</td>
            <td style="text-align:right;font-weight:800;color:#1a7a4a">${totalBobot.toFixed(2)} kg</td>
            <td></td></tr>
      </tfoot>
    </table>
    <div style="margin-top:32px;font-size:10px;color:#9ca3af;">Dicetak oleh: ${userName} pada ${formatTanggalID(new Date().toISOString().slice(0, 10))}</div>
    ${FOOTER_HTML}
  `;
  await printPdf(html, `laporan-timbangan.pdf`);
}

export async function generateLaporanKeuanganPdf(items: any[], judul: string, userName: string) {
  let masuk = 0;
  let keluar = 0;
  const rows = items
    .map((t) => {
      const isIn = t.tipe !== "pengeluaran";
      if (isIn) masuk += t.total;
      else keluar += t.total;
      return `
      <tr>
        <td>${formatTanggalID(t.tanggal)}</td>
        <td>${t.no_invoice}</td>
        <td>${t.tipe === "penjualan" ? "Penjualan" : t.tipe === "sumber lain" || t.tipe === "bantuan" ? "Sumber Lain" : "Pengeluaran"}</td>
        <td>${t.nama_pihak || t.kategori || "-"}</td>
        <td style="text-align:right;color:${isIn ? "#10b981" : "#ef4444"};font-weight:700">${isIn ? "+" : "-"} ${rupiah(t.total)}</td>
      </tr>
    `;
    })
    .join("");
  const saldo = masuk - keluar;
  const html = `
    ${HEADER_HTML}
    <h1 class="title">LAPORAN KEUANGAN</h1>
    <div style="font-size:12px;color:#4b5563;margin-bottom:12px;">${judul}</div>
    <table>
      <thead><tr><th>Tanggal</th><th>No. Invoice</th><th>Tipe</th><th>Pihak/Kategori</th><th style="text-align:right">Nominal</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#9ca3af">Tidak ada data</td></tr>`}</tbody>
    </table>
    <div style="display:flex;gap:12px;margin-top:16px;">
      <div style="flex:1;background:#d1fae5;padding:12px;border-radius:8px;">
        <div style="font-size:10px;color:#065f46;font-weight:700">PEMASUKAN</div>
        <div style="font-size:16px;color:#065f46;font-weight:800;margin-top:4px">${rupiah(masuk)}</div>
      </div>
      <div style="flex:1;background:#fee2e2;padding:12px;border-radius:8px;">
        <div style="font-size:10px;color:#991b1b;font-weight:700">PENGELUARAN</div>
        <div style="font-size:16px;color:#991b1b;font-weight:800;margin-top:4px">${rupiah(keluar)}</div>
      </div>
      <div style="flex:1;background:#1a7a4a;padding:12px;border-radius:8px;">
        <div style="font-size:10px;color:#ffffffcc;font-weight:700">SALDO AKHIR</div>
        <div style="font-size:16px;color:#fff;font-weight:800;margin-top:4px">${rupiah(saldo)}</div>
      </div>
    </div>
    <div style="margin-top:32px;font-size:10px;color:#9ca3af;">Dicetak oleh: ${userName} pada ${formatTanggalID(new Date().toISOString().slice(0, 10))}</div>
    ${FOOTER_HTML}
  `;
  await printPdf(html, `laporan-keuangan.pdf`);
}

export async function generateLaporanAbsensiPdf(rekap: any[], bulanLabel: string, userName: string) {
  const rows = rekap
    .map(
      (r) => `
    <tr>
      <td>${r.nama}</td>
      <td style="text-align:center;color:#10b981;font-weight:700">${r.hadir}</td>
      <td style="text-align:center;color:#ef4444;font-weight:700">${r.absen}</td>
      <td style="text-align:center;color:#f5a623;font-weight:700">${r.izin}</td>
      <td style="text-align:center;color:#3b82f6;font-weight:700">${r.sakit}</td>
    </tr>
  `
    )
    .join("");
  const html = `
    ${HEADER_HTML}
    <h1 class="title">LAPORAN ABSENSI</h1>
    <div style="font-size:12px;color:#4b5563;margin-bottom:12px;">Bulan: ${bulanLabel}</div>
    <table>
      <thead><tr><th>Nama Petugas</th><th style="text-align:center">Hadir</th><th style="text-align:center">Absen</th><th style="text-align:center">Izin</th><th style="text-align:center">Sakit</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#9ca3af">Tidak ada data</td></tr>`}</tbody>
    </table>
    <div style="margin-top:32px;font-size:10px;color:#9ca3af;">Dicetak oleh: ${userName} pada ${formatTanggalID(new Date().toISOString().slice(0, 10))}</div>
    ${FOOTER_HTML}
  `;
  await printPdf(html, `laporan-absensi.pdf`);
}

export async function generateSlipGajiPdf(data: any) {
  const html = `
    ${HEADER_HTML}
    <h1 class="title">SLIP GAJI</h1>
    <div style="font-size:12px;color:#4b5563;margin-bottom:16px;">Periode: ${data.periodeLabel}</div>
    
    <div style="background:#f9fafb;padding:12px;border-radius:8px;margin-bottom:16px;">
      <div class="row"><span class="label">Nama Petugas</span><span class="value">${data.nama}</span></div>
      <div class="row"><span class="label">Total Kehadiran</span><span class="value">${data.hadir} hari</span></div>
      <div class="row"><span class="label">Total Jam Kerja</span><span class="value">${data.total_jam} jam</span></div>
    </div>

    <div style="margin-bottom:16px;">
      <div class="row"><span class="label">Gaji Pokok</span><span class="value">${rupiah(data.gaji_pokok)}</span></div>
      <div class="row"><span class="label">Tunjangan</span><span class="value" style="color:#10b981;">+ ${rupiah(data.tunjangan)}</span></div>
      <div class="row"><span class="label">Potongan / Kasbon</span><span class="value" style="color:#ef4444;">- ${rupiah(data.potongan)}</span></div>
    </div>

    <div class="total-box">
      <div class="total-label">Gaji Bersih Diterima</div>
      <div class="total-val">${rupiah(data.total_bersih)}</div>
    </div>

    <div class="sig">
      <div style="display:flex; justify-content:space-between; width:100%; margin-top: 16px;">
        <div class="sig-box">
          <div style="font-size:12px;margin-bottom:8px;">Penerima,</div>
          <div class="sig-line"></div>
          <div class="sig-name">${data.nama}</div>
        </div>
        <div class="sig-box">
          <div style="font-size:12px;margin-bottom:8px;">Mengetahui,</div>
          <div class="sig-line"></div>
          <div class="sig-name">${data.adminName}</div>
        </div>
      </div>
    </div>
    
    <div style="margin-top:32px;font-size:10px;color:#9ca3af;">Dicetak oleh: ${data.adminName} pada ${formatTanggalID(new Date().toISOString().slice(0, 10))}</div>
    ${FOOTER_HTML}
  `;
  await printPdf(html, `slip-gaji-${data.nama.replace(/\s+/g, '-')}-${data.periodeLabel}.pdf`);
}
