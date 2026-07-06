import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform, Alert } from "react-native";

import { LOGO_URL, ORG } from "./theme";
import { rupiah, formatTanggalID } from "./format";

const HEADER_HTML = `
<div style="display:flex;align-items:center;gap:16px;border-bottom:2px solid #1a7a4a;padding-bottom:12px;margin-bottom:16px;">
  <img src="GEMERLAP_LOGO_PLACEHOLDER" style="height:64px;width:64px;object-fit:contain;border-radius:8px;padding:4px;" />
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
  `;
}

import { LOGO_B64 } from "./logo-b64";

import * as FileSystem from "expo-file-system/legacy";

export async function printPdf(html: string, fileName: string) {
  let finalHtml = html;
  if (finalHtml.includes("GEMERLAP_LOGO_PLACEHOLDER")) {
    finalHtml = finalHtml.replace(/GEMERLAP_LOGO_PLACEHOLDER/g, LOGO_B64);
  }
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles()}</style></head><body>${finalHtml}</body></html>`;
  try {
    const { uri } = await Print.printToFileAsync({ html: fullHtml, base64: false });
    if (Platform.OS === "web") {
      // On web, open in new tab
      window.open(uri, "_blank");
      return;
    }
    
    // Rename the file to the desired fileName so it shows up correctly when sharing
    const newUri = FileSystem.cacheDirectory + fileName;
    await FileSystem.moveAsync({
      from: uri,
      to: newUri
    });
    
    const can = await Sharing.isAvailableAsync();
    if (can) {
      await Sharing.shareAsync(newUri, { mimeType: "application/pdf", dialogTitle: fileName, UTI: "com.adobe.pdf" });
    } else {
      Alert.alert("PDF tersimpan", `File: ${newUri}`);
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
    const itemsHtml = (trx.items || []).map((it: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${it.jenis_sampah_nama || "-"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${it.bobot_kg} kg</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${rupiah(it.harga_per_kg)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">${rupiah(it.total)}</td>
      </tr>
    `).join("");

    bodyRows = `
      <div class="row"><span class="label">No. Invoice</span> <span class="value">${trx.no_invoice}</span></div>
      <div class="row"><span class="label">Tanggal</span> <span class="value">${formatTanggalID(trx.tanggal)}</span></div>
      <div class="row"><span class="label">Pembeli</span> <span class="value">${trx.nama_pihak || "-"}</span></div>
      ${trx.keterangan ? `<div class="row"><span class="label">Keterangan</span> <span class="value">${trx.keterangan}</span></div>` : ""}
      
      <div style="margin-top: 16px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Komoditas</th>
              <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Berat</th>
              <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Harga/kg</th>
              <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>
    `;
  } else if (isSumberLain) {
    bodyRows = `
      <div class="row"><span class="label">No. Bukti</span> <span class="value">${trx.no_invoice}</span></div>
      <div class="row"><span class="label">Tanggal</span> <span class="value">${formatTanggalID(trx.tanggal)}</span></div>
      <div class="row"><span class="label">Sumber Dana</span> <span class="value">${trx.nama_pihak || "-"}</span></div>
      ${trx.keterangan ? `<div class="row"><span class="label">Keterangan</span> <span class="value">${trx.keterangan}</span></div>` : ""}
    `;
  } else if (isPengeluaran) {
    bodyRows = `
      <div class="row"><span class="label">No. Bukti</span> <span class="value">${trx.no_invoice}</span></div>
      <div class="row"><span class="label">Tanggal</span> <span class="value">${formatTanggalID(trx.tanggal)}</span></div>
      <div class="row"><span class="label">Kategori</span> <span class="value">${trx.kategori || "-"}</span></div>
      <div class="row"><span class="label">Keperluan</span> <span class="value">${trx.keterangan || "-"}</span></div>
    `;
  }

  const title = isPenjualan ? "INVOICE PENJUALAN" : isSumberLain ? "BUKTI PEMASUKAN" : "BUKTI PENGELUARAN";
  const totalLabel = isPenjualan ? "Total Penjualan" : isSumberLain ? "Nominal Pemasukan" : "Total Pengeluaran";

  const html = `
    ${HEADER_HTML}
    
    <div style="margin-bottom: 24px;">
      <h1 class="title" style="text-align: center; margin-bottom: 24px;">${title}</h1>
      
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        ${bodyRows}
      </div>
      
      <div class="total-box" style="display: flex; justify-content: space-between; align-items: center;">
        <div class="total-label">${totalLabel}</div>
        <div class="total-val">${rupiah(trx.total)}</div>
      </div>
    </div>
    
    <div class="sig">
      <div class="sig-box">
        <div style="font-size: 12px; margin-bottom: 48px;">Hormat kami,</div>
        <div class="sig-line"></div>
        <div class="sig-name">Admin TPS</div>
      </div>
    </div>
    
    ${FOOTER_HTML}
  `;
  
  const typeStr = isPenjualan ? "Penjualan" : isSumberLain ? "Pemasukan" : "Pengeluaran";
  const dateStr = formatTanggalID(trx.tanggal).replace(/\s+/g, '-').toLowerCase();
  await printPdf(html, `Invoice-${typeStr}-${dateStr}.pdf`);
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
  const safeJudul = judul.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
  await printPdf(html, `Laporan-Timbangan-${safeJudul}.pdf`);
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
  const safeJudul = judul.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
  await printPdf(html, `Laporan-Keuangan-${safeJudul}.pdf`);
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
    <h1 class="title">LAPORAN ABSENSI (REKAP)</h1>
    <div style="font-size:12px;color:#4b5563;margin-bottom:12px;">Bulan: ${bulanLabel}</div>
    <table>
      <thead><tr><th>Nama Petugas</th><th style="text-align:center">Hadir</th><th style="text-align:center">Absen</th><th style="text-align:center">Izin</th><th style="text-align:center">Sakit</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#9ca3af">Tidak ada data</td></tr>`}</tbody>
    </table>
    <div style="margin-top:32px;font-size:10px;color:#9ca3af;">Dicetak oleh: ${userName} pada ${formatTanggalID(new Date().toISOString().slice(0, 10))}</div>
    ${FOOTER_HTML}
  `;
  const safeBulan = bulanLabel.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
  await printPdf(html, `Laporan-Absensi-Rekap-${safeBulan}.pdf`);
}

export async function generateLaporanAbsensiDetailPdf(data: any[], bulanLabel: string, userName: string) {
  let content = "";
  
  if (data.length === 0) {
    content = `<div style="text-align:center;padding:20px;color:#9ca3af">Tidak ada data untuk petugas yang dipilih.</div>`;
  } else {
    content = data.map(petugas => {
      let hadir=0, izin=0, sakit=0, absen=0;
      const detailRows = petugas.kehadiran.map((k: any) => {
        if (k.status === 'hadir') hadir++;
        else if (k.status === 'izin') izin++;
        else if (k.status === 'sakit') sakit++;
        else absen++;
        
        const isHadir = k.status === 'hadir';
        const color = isHadir ? '#10b981' : (k.status === 'izin' ? '#f5a623' : (k.status === 'sakit' ? '#3b82f6' : '#ef4444'));
        
        let sessionDesc = "-";
        if (isHadir && k.sessions && k.sessions.length > 0) {
          sessionDesc = k.sessions.map((s: any) => {
            const dIn = new Date(s.check_in);
            const inStr = String(dIn.getHours()).padStart(2, '0') + '.' + String(dIn.getMinutes()).padStart(2, '0');
            
            let outStr = "...";
            if (s.check_out) {
              const dOut = new Date(s.check_out);
              outStr = String(dOut.getHours()).padStart(2, '0') + '.' + String(dOut.getMinutes()).padStart(2, '0');
            }
            return `[${inStr} - ${outStr}]`;
          }).join(", ");
        } else if (!isHadir) {
          sessionDesc = k.alasan || "-";
        }
        
        return `
        <tr>
          <td>${formatTanggalID(k.tanggal)}</td>
          <td style="color:${color};font-weight:700;text-transform:capitalize">${k.status}</td>
          <td>${isHadir ? k.jam.toFixed(1) + " jam" : "-"}</td>
          <td>${sessionDesc}</td>
        </tr>
        `;
      }).join("");

      return `
      <div style="margin-top: 24px; margin-bottom: 16px;">
        <h2 style="font-size: 14px; font-weight: 700; color: #1a7a4a; margin-bottom: 8px;">${petugas.nama}</h2>
        <div style="display:flex;gap:12px;margin-bottom:12px;">
          <div style="background:#f3f4f6;padding:8px;border-radius:4px;font-size:11px;flex:1;text-align:center">Hadir: <strong style="color:#10b981">${hadir}</strong></div>
          <div style="background:#f3f4f6;padding:8px;border-radius:4px;font-size:11px;flex:1;text-align:center">Sakit: <strong style="color:#3b82f6">${sakit}</strong></div>
          <div style="background:#f3f4f6;padding:8px;border-radius:4px;font-size:11px;flex:1;text-align:center">Izin: <strong style="color:#f5a623">${izin}</strong></div>
          <div style="background:#f3f4f6;padding:8px;border-radius:4px;font-size:11px;flex:1;text-align:center">Alpha: <strong style="color:#ef4444">${absen}</strong></div>
        </div>
        <table>
          <thead><tr><th>Tanggal</th><th>Status</th><th>Durasi</th><th>Detail Sesi / Alasan</th></tr></thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>
      `;
    }).join("");
  }

  const html = `
    ${HEADER_HTML}
    <h1 class="title">LAPORAN ABSENSI (DETAIL)</h1>
    <div style="font-size:12px;color:#4b5563;margin-bottom:12px;">Bulan: ${bulanLabel}</div>
    ${content}
    <div style="margin-top:32px;font-size:10px;color:#9ca3af;">Dicetak oleh: ${userName} pada ${formatTanggalID(new Date().toISOString().slice(0, 10))}</div>
    ${FOOTER_HTML}
  `;
  const safeBulan = bulanLabel.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
  await printPdf(html, `Laporan-Absensi-Detail-${safeBulan}.pdf`);
}


export async function generateLaporanPenjualanPdf(data: any, judul: string, userName: string) {
  const items = data.items || [];
  const summary = data.summary || [];
  const totalKg = summary.reduce((s: number, r: any) => s + (r.total_kg || 0), 0);
  const totalRp = summary.reduce((s: number, r: any) => s + (r.total_rp || 0), 0);

  const rows = items.map((it: any) => `
    <tr>
      <td>${formatTanggalID(it.tanggal)}</td>
      <td>${it.no_invoice}</td>
      <td>${it.nama_pihak || "-"}</td>
      <td>${it.jenis_sampah_nama || "-"}</td>
      <td style="text-align:right">${it.bobot_kg || 0} kg</td>
      <td style="text-align:right">${rupiah(it.harga_per_kg || 0)}</td>
      <td style="text-align:right;font-weight:700">${rupiah(it.total)}</td>
    </tr>
  `).join("");

  const summaryRows = summary.map((s: any) => `
    <tr>
      <td style="font-weight:700">${s.nama}</td>
      <td style="text-align:center">${s.transaksi}</td>
      <td style="text-align:right">${s.total_kg.toFixed(1)} kg</td>
      <td style="text-align:right;font-weight:700;color:#1a7a4a">${rupiah(s.total_rp)}</td>
    </tr>
  `).join("");

  const html = `
    ${HEADER_HTML}
    <h1 class="title">LAPORAN PENJUALAN KOMODITAS</h1>
    <div style="font-size:12px;color:#4b5563;margin-bottom:16px;">${judul}</div>

    <div style="display:flex;gap:12px;margin-bottom:16px;">
      <div style="flex:1;background:#d1fae5;padding:12px;border-radius:8px;">
        <div style="font-size:10px;color:#065f46;font-weight:700">TOTAL TERJUAL</div>
        <div style="font-size:16px;color:#065f46;font-weight:800;margin-top:4px">${totalKg.toFixed(1)} kg</div>
      </div>
      <div style="flex:1;background:#d1fae5;padding:12px;border-radius:8px;">
        <div style="font-size:10px;color:#065f46;font-weight:700">TOTAL PENDAPATAN</div>
        <div style="font-size:16px;color:#065f46;font-weight:800;margin-top:4px">${rupiah(totalRp)}</div>
      </div>
    </div>

    <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:#1a7a4a">Rekap Per Komoditas</div>
    <table>
      <thead><tr><th>Komoditas</th><th style="text-align:center">Transaksi</th><th style="text-align:right">Total Kg</th><th style="text-align:right">Total Rp</th></tr></thead>
      <tbody>${summaryRows || `<tr><td colspan="4" style="text-align:center;color:#9ca3af">Tidak ada data</td></tr>`}</tbody>
    </table>

    <div style="font-size:13px;font-weight:700;margin:20px 0 8px;color:#1a7a4a">Detail Transaksi</div>
    <table>
      <thead><tr><th>Tanggal</th><th>No. Invoice</th><th>Pembeli</th><th>Komoditas</th><th style="text-align:right">Berat</th><th style="text-align:right">Harga/kg</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" style="text-align:center;color:#9ca3af">Tidak ada data</td></tr>`}</tbody>
      <tfoot>
        <tr>
          <td colspan="4" style="font-weight:700;text-align:right">TOTAL</td>
          <td style="text-align:right;font-weight:800">${totalKg.toFixed(1)} kg</td>
          <td></td>
          <td style="text-align:right;font-weight:800;color:#1a7a4a">${rupiah(totalRp)}</td>
        </tr>
      </tfoot>
    </table>
    <div style="margin-top:32px;font-size:10px;color:#9ca3af;">Dicetak oleh: ${userName} pada ${formatTanggalID(new Date().toISOString().slice(0, 10))}</div>
    ${FOOTER_HTML}
  `;
  const safeJudul = judul.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
  await printPdf(html, `Laporan-Penjualan-${safeJudul}.pdf`);
}

export async function generateSlipGajiPdf(data: any) {
  const html = `
    ${HEADER_HTML}
    <h1 class="title">SLIP GAJI</h1>
    <div style="font-size:12px;color:#4b5563;margin-bottom:16px;">Periode: ${data.periodeLabel}</div>
    
    <div style="background:#f9fafb;padding:12px;border-radius:8px;margin-bottom:16px;">
      <div class="row"><span class="label">Nama Petugas</span><span class="value">${data.nama}</span></div>
      <div class="row"><span class="label">Total Hadir</span><span class="value" style="color:#10b981">${data.hadir} hari</span></div>
      <div class="row"><span class="label">Total Izin</span><span class="value" style="color:#f5a623">${data.izin} hari</span></div>
      <div class="row"><span class="label">Total Sakit</span><span class="value" style="color:#3b82f6">${data.sakit} hari</span></div>
      <div class="row"><span class="label">Total Absen</span><span class="value" style="color:#ef4444">${data.absen} hari</span></div>
      <div class="row"><span class="label">Total Jam Kerja</span><span class="value">${data.total_jam} jam</span></div>
    </div>

    <div style="margin-bottom:16px;">
      <div class="row"><span class="label">Gaji Pokok</span><span class="value">${rupiah(data.gaji_pokok)}</span></div>
      <div class="row"><span class="label">Tunjangan</span><span class="value" style="color:#10b981;">+ ${rupiah(data.tunjangan)}</span></div>
      <div class="row"><span class="label">Potongan / Kasbon</span><span class="value" style="color:#ef4444;">- ${rupiah(data.potongan)}</span></div>
      ${data.keterangan ? `<div style="font-size:10px; color:#ef4444; margin-top: 4px; padding-left: 8px; border-left: 2px solid #ef4444;">${data.keterangan}</div>` : ""}
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

export async function generateLaporanNeracaMassaPdf(items: any[], judul: string, userName: string) {
  const rows = items
    .map(
      (it) => `
    <tr>
      <td>${it.bulan}</td>
      <td style="text-align:right">${(it.sampah_masuk || 0).toFixed(1)}</td>
      <td style="text-align:right">${(it.dikomposkan || 0).toFixed(1)}</td>
      <td style="text-align:right">${(it.dijual || 0).toFixed(1)}</td>
      <td style="text-align:right">${((it.residu || 0) + (it.lain || 0)).toFixed(1)}</td>
      <td style="text-align:right;font-weight:bold;color:#1a7a4a">${(it.recovery_factor || 0).toFixed(2)}%</td>
    </tr>
  `
    )
    .join("");

  const totalMasuk = items.reduce((s, it) => s + (it.sampah_masuk || 0), 0);
  const totalKompos = items.reduce((s, it) => s + (it.dikomposkan || 0), 0);
  const totalJual = items.reduce((s, it) => s + (it.dijual || 0), 0);
  const totalResidu = items.reduce((s, it) => s + (it.residu || 0) + (it.lain || 0), 0);
  const avgRf = totalMasuk > 0 ? ((totalMasuk - totalResidu) / totalMasuk * 100).toFixed(2) : "0.00";

  const html = `
    ${HEADER_HTML}
    <h1 class="title">LAPORAN NERACA MASSA & RECOVERY FACTOR</h1>
    <div style="font-size:12px;color:#4b5563;margin-bottom:16px;">${judul}</div>
    
    <div style="background:#f0fdf4; border: 1px solid #1a7a4a; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
      <div style="font-size:12px; font-weight:bold; color:#1a7a4a; margin-bottom: 4px;">Rumus Recovery Factor:</div>
      <div style="font-size:12px; font-family:monospace; color:#374151;">(Recycle (Kompos) + Reuse (Komoditas)) / Sampah Masuk x 100%</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Bulan</th>
          <th style="text-align:right">Masuk (kg)</th>
          <th style="text-align:right">Dikomposkan (kg)</th>
          <th style="text-align:right">Dijual (kg)</th>
          <th style="text-align:right">Residu (kg)</th>
          <th style="text-align:right">Recovery Factor</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="6" style="text-align:center;color:#9ca3af">Tidak ada data</td></tr>`}</tbody>
      <tfoot>
        <tr>
          <td style="font-weight:700">TOTAL / RATA-RATA</td>
          <td style="text-align:right;font-weight:700">${totalMasuk.toFixed(1)}</td>
          <td style="text-align:right;font-weight:700">${totalKompos.toFixed(1)}</td>
          <td style="text-align:right;font-weight:700">${totalJual.toFixed(1)}</td>
          <td style="text-align:right;font-weight:700">${totalResidu.toFixed(1)}</td>
          <td style="text-align:right;font-weight:800;color:#1a7a4a">${avgRf}%</td>
        </tr>
      </tfoot>
    </table>
    
    <div style="margin-top:32px;font-size:10px;color:#9ca3af;">Dicetak oleh: ${userName} pada ${formatTanggalID(new Date().toISOString().slice(0, 10))}</div>
    ${FOOTER_HTML}
  `;
  const safeJudul = judul.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
  await printPdf(html, `Laporan-Neraca-Massa-${safeJudul}.pdf`);
}

export async function generateLaporanNeracaSkontroPdf(data: any, bulanLabelStr: string, userName: string) {
  const html = `
    ${HEADER_HTML}
    <h1 class="title" style="margin-bottom:2px;">Laporan Neraca Keuangan (Skontro)</h1>
    <div style="font-size:12px;color:#4b5563;margin-bottom:20px;">Periode Bulan: ${bulanLabelStr}</div>
    
    <div style="display:flex; gap:24px; margin-top:20px;">
      <!-- SISI AKTIVA (KIRI) -->
      <div style="flex:1; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: #fff;">
        <h3 style="margin-top:0; border-bottom:2px solid #1a7a4a; padding-bottom:6px; color:#1a7a4a;">AKTIVA (ASET)</h3>
        
        <h4 style="margin:10px 0 6px; font-size:13px; color:#4b5563;">Aktiva Lancar</h4>
        <div class="row">
          <span class="label" style="padding-left:10px;">Kas / Bank</span>
          <span class="value">${rupiah(data.kas)}</span>
        </div>
        <div class="row" style="border-bottom:1px solid #f3f4f6;">
          <span class="label" style="padding-left:10px;">Piutang Umum</span>
          <span class="value">${rupiah(data.piutang_umum)}</span>
        </div>
        <div class="row" style="border-bottom:1px solid #f3f4f6;">
          <span class="label" style="padding-left:10px;">Piutang Kasbon Petugas</span>
          <span class="value">${rupiah(data.piutang_kasbon)}</span>
        </div>
        <div class="row" style="font-weight:700; margin-top:4px;">
          <span style="padding-left:10px; color:#1a7a4a;">Total Aktiva Lancar</span>
          <span style="color:#1a7a4a;">${rupiah(data.kas + data.piutang)}</span>
        </div>
        
        <h4 style="margin:16px 0 6px; font-size:13px; color:#4b5563;">Aktiva Tetap</h4>
        <div class="row" style="border-bottom:1px solid #f3f4f6;">
          <span class="label" style="padding-left:10px;">Peralatan & Mesin</span>
          <span class="value">${rupiah(data.aset)}</span>
        </div>
        <div class="row" style="font-weight:700; margin-top:4px;">
          <span style="padding-left:10px; color:#1a7a4a;">Total Aktiva Tetap</span>
          <span style="color:#1a7a4a;">${rupiah(data.aset)}</span>
        </div>
        
        <div style="margin-top:32px; padding:12px; background:#f3f4f6; border-radius:6px; display:flex; justify-content:space-between; font-weight:800; font-size:14px; border:1px solid #e5e7eb;">
          <span style="color:#111827;">TOTAL AKTIVA</span>
          <span style="color:#1a7a4a;">${rupiah(data.total_aktiva)}</span>
        </div>
      </div>
      
      <!-- SISI PASIVA (KANAN) -->
      <div style="flex:1; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: #fff;">
        <h3 style="margin-top:0; border-bottom:2px solid #1a7a4a; padding-bottom:6px; color:#1a7a4a;">PASIVA (KEWAJIBAN & EKUITAS)</h3>
        
        <h4 style="margin:10px 0 6px; font-size:13px; color:#4b5563;">Kewajiban (Hutang)</h4>
        <div class="row" style="border-bottom:1px solid #f3f4f6;">
          <span class="label" style="padding-left:10px;">Hutang Usaha / Lain-lain</span>
          <span class="value">${rupiah(data.hutang)}</span>
        </div>
        <div class="row" style="font-weight:700; margin-top:4px;">
          <span style="padding-left:10px; color:#1a7a4a;">Total Kewajiban</span>
          <span style="color:#1a7a4a;">${rupiah(data.hutang)}</span>
        </div>
        
        <h4 style="margin:16px 0 6px; font-size:13px; color:#4b5563;">Ekuitas (Modal)</h4>
        <div class="row" style="border-bottom:1px solid #f3f4f6;">
          <span class="label" style="padding-left:10px;">Modal Disetor (Subsidi Yayasan)</span>
          <span class="value">${rupiah(data.modal)}</span>
        </div>
        <div class="row" style="border-bottom:1px solid #f3f4f6;">
          <span class="label" style="padding-left:10px;">Laba Ditahan</span>
          <span class="value">${rupiah(data.laba_ditahan)}</span>
        </div>
        <div class="row" style="font-weight:700; margin-top:4px;">
          <span style="padding-left:10px; color:#1a7a4a;">Total Ekuitas</span>
          <span style="color:#1a7a4a;">${rupiah(data.modal + data.laba_ditahan)}</span>
        </div>
        
        <div style="margin-top:32px; padding:12px; background:#f3f4f6; border-radius:6px; display:flex; justify-content:space-between; font-weight:800; font-size:14px; border:1px solid #e5e7eb;">
          <span style="color:#111827;">TOTAL PASIVA</span>
          <span style="color:#1a7a4a;">${rupiah(data.total_pasiva)}</span>
        </div>
      </div>
    </div>
    
    <div style="margin-top:32px;font-size:10px;color:#9ca3af;">Dicetak oleh: ${userName} pada ${formatTanggalID(new Date().toISOString().slice(0, 10))}</div>
    ${FOOTER_HTML}
  `;
  await printPdf(html, `Laporan-Neraca-Skontro-${bulanLabelStr.replace(/\s+/g, "-")}.pdf`);
}

