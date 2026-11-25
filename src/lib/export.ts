import type { Account, Transaction } from "../types/ego";
import type { VaultSnapshot } from "./queries";

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

function txTypeLabelID(type: Transaction["transaction_type"]): string {
  if (type === "income") return "Pemasukan";
  if (type === "expense") return "Pengeluaran";
  return "Transfer";
}

function txStatusLabelID(status: Transaction["status"]): string {
  if (status === "posted") return "Terposting";
  if (status === "cancelled") return "Dibatalkan";
  return "Menunggu";
}

export function transactionsToCsv(
  transactions: Transaction[],
  accounts: Pick<Account, "id" | "account_name">[]
): string {
  const accountMap = new Map<string, string>();
  for (const acc of accounts) {
    accountMap.set(acc.id, acc.account_name);
  }

  const headers = [
    "Tanggal",
    "Jenis",
    "Kategori",
    "Keterangan",
    "Akun Sumber",
    "Akun Tujuan",
    "Nominal (IDR)",
    "Status",
    "Disetujui Owner",
  ];

  const rows = transactions.map((tx) => [
    tx.transaction_date,
    txTypeLabelID(tx.transaction_type),
    tx.category ?? "Umum",
    tx.description ?? "",
    tx.source_account_id ? accountMap.get(tx.source_account_id) ?? "" : "",
    tx.destination_account_id
      ? accountMap.get(tx.destination_account_id) ?? ""
      : "",
    tx.amount,
    txStatusLabelID(tx.status),
    tx.owner_confirmed ? "Ya" : "Tidak",
  ]);

  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvCell).join(",")
  );
  // Prepend UTF-8 BOM so Microsoft Excel & Google Sheets preserve Indonesian text cleanly
  return `\uFEFF${lines.join("\r\n")}`;
}

export interface VaultBackupPayload {
  app: "EGO Personal AI";
  version: "1.0";
  exported_at: string;
  owner_email: string | null;
  data: VaultSnapshot;
}

export function vaultSnapshotToBackupJson(
  snapshot: VaultSnapshot,
  ownerEmail: string | null,
  exportedAt = new Date().toISOString()
): string {
  const payload: VaultBackupPayload = {
    app: "EGO Personal AI",
    version: "1.0",
    exported_at: exportedAt,
    owner_email: ownerEmail,
    data: snapshot,
  };
  return JSON.stringify(payload, null, 2);
}

export function triggerBrowserDownload(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
