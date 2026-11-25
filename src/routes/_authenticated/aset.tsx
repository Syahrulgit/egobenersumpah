import {
  Briefcase,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { ApprovalCheck } from "../../components/ego/approval-check";
import { AssetTypeIcon } from "../../components/ego/category-icon";
import { ModalSheet } from "../../components/ego/modal-sheet";
import { MoneyInput } from "../../components/ego/money-input";
import { useTransactionSheet } from "../../components/ego/transaction-input-sheet";
import { assetTypeLabel, formatIDR } from "../../lib/finance";
import {
  useCreateAsset,
  useFinancialSearch,
  useUpdateAssetValue,
  useVaultSnapshot,
} from "../../lib/queries";
import type { Asset, AssetType } from "../../types/ego";

export function AsetPage() {
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAssetValue();
  const searchMutation = useFinancialSearch();
  const { openTransactionSheet } = useTransactionSheet();

  // Modal Create Asset
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // New Asset Form
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("emas");
  const [currentValue, setCurrentValue] = useState(0);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);

  // Edit Value State
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editValue, setEditValue] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [editConfirmed, setEditConfirmed] = useState(false);

  // Market Search Query
  const [marketQuery, setMarketQuery] = useState(
    "Harga emas Antam 1 gram hari ini dalam IDR"
  );

  const assets = vault?.assets ?? [];
  const totalAssetValue = assets.reduce((sum, a) => sum + a.current_value, 0);

  async function handleCreateAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerConfirmed) return;
    if (!assetName.trim()) {
      toast.error("Nama aset wajib diisi.");
      return;
    }

    try {
      await createAsset.mutateAsync({
        asset_name: assetName.trim(),
        asset_type: assetType,
        current_value: currentValue,
        quantity: quantity ? Number(quantity) : null,
        unit: unit.trim() || null,
        notes: notes.trim() || null,
        owner_confirmed: true,
      });
      toast.success(`Aset "${assetName.trim()}" berhasil dicatat.`);
      setAssetName("");
      setCurrentValue(0);
      setQuantity("");
      setUnit("");
      setNotes("");
      setOwnerConfirmed(false);
      setCreateModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mencatat aset.");
    }
  }

  function startEdit(asset: Asset) {
    setEditingAsset(asset);
    setEditValue(asset.current_value);
    setEditNotes(asset.notes ?? "");
    setEditConfirmed(false);
  }

  async function handleUpdateAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAsset || !editConfirmed) return;
    try {
      await updateAsset.mutateAsync({
        id: editingAsset.id,
        current_value: editValue,
        notes: editNotes.trim() || null,
        owner_confirmed: true,
      });
      toast.success(`Nilai "${editingAsset.asset_name}" diperbarui.`);
      setEditingAsset(null);
      setEditConfirmed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memperbarui nilai aset."
      );
    }
  }

  async function handleMarketLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!marketQuery.trim()) return;
    try {
      await searchMutation.mutateAsync(marketQuery.trim());
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal mencari referensi harga pasar."
      );
    }
  }

  return (
    <AppShell
      title="Portofolio Aset"
      subtitle="Pantau nilai aset fisik maupun instrumen investasi Anda dengan pembaruan valuasi kapan saja."
      action={
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#087BFF]/20 hover:brightness-110 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tambah Aset</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Portfolio Hero Card */}
        <section className="ego-card-hero flex flex-col justify-between gap-4 rounded-3xl border border-[#1B3163] p-5 text-white shadow-lg shadow-[#06132F]/15 sm:flex-row sm:items-center sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#C7D0E0]/80">
              Total Nilai Portofolio Aset
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">
              {formatIDR(totalAssetValue)}
            </p>
            <p className="mt-1 text-xs text-[#C7D0E0]/80">
              {assets.length} instrumen / kepemilikan tercatat
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                openTransactionSheet({
                  type: "expense",
                  category: "Investasi & Aset",
                })
              }
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#19D8FF]/35 bg-[#19D8FF]/15 px-4 py-2 text-xs font-semibold text-[#19D8FF] transition-colors hover:bg-[#19D8FF]/25"
            >
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Catat Pembelian Aset</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0666DB]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tambah Aset Baru</span>
            </button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Asset List */}
          <section className="space-y-4 lg:col-span-8">
            <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                  Daftar Aset Terdaftar ({assets.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-[#087BFF]/10 px-2.5 py-1 text-xs font-semibold text-[#087BFF] hover:bg-[#087BFF]/15 dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Baru</span>
                </button>
              </div>

              {isLoading ? (
                <div className="mt-4 space-y-3">
                  {[1, 2, 3].map((k) => (
                    <div
                      key={k}
                      className="h-20 animate-pulse rounded-2xl bg-[#F4F7FB] dark:bg-[#06132F]"
                    />
                  ))}
                </div>
              ) : assets.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB] p-8 text-center dark:border-[#1B3163] dark:bg-[#06132F]/60">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                    <Briefcase className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-[#06132F] dark:text-white">
                    Portofolio aset masih kosong
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
                    Catat kepemilikan emas, properti, kendaraan, atau instrumen investasi Anda agar kekayaan bersih terhitung utuh.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(true)}
                    className="mt-4 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0666DB]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Catat Aset Pertama</span>
                  </button>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {assets.map((asset) => {
                    const sharePct =
                      totalAssetValue > 0
                        ? Math.round((asset.current_value / totalAssetValue) * 100)
                        : 0;
                    return (
                      <div
                        key={asset.id}
                        className="flex flex-col justify-between gap-4 rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB]/70 p-4 transition-colors hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F]/80 dark:hover:border-[#19D8FF]/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                              <AssetTypeIcon
                                type={asset.asset_type}
                                className="h-4 w-4"
                              />
                            </span>
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-bold text-[#06132F] dark:text-white">
                                {asset.asset_name}
                              </h3>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                                {assetTypeLabel(asset.asset_type)}
                                {asset.quantity !== null
                                  ? ` · ${asset.quantity} ${asset.unit ?? "unit"}`
                                  : ""}
                              </p>
                            </div>
                          </div>

                          <span className="shrink-0 rounded-full bg-[#087BFF]/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                            {sharePct}%
                          </span>
                        </div>

                        {asset.notes ? (
                          <p className="truncate text-xs text-slate-500 dark:text-[#C7D0E0]/70">
                            {asset.notes}
                          </p>
                        ) : null}

                        <div className="flex items-end justify-between gap-2 border-t border-[#DCE4F0]/80 pt-3 dark:border-[#1B3163]">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#C7D0E0]/65">
                              Nilai Taksiran
                            </p>
                            <p className="font-mono text-base font-bold tabular-nums text-[#06132F] dark:text-white">
                              {formatIDR(asset.current_value)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => startEdit(asset)}
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#06132F] transition-colors hover:border-[#087BFF]/40 hover:text-[#087BFF] whitespace-nowrap dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0] dark:hover:border-[#19D8FF]/40 dark:hover:text-[#19D8FF]"
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                            <span>Perbarui</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Market Search Reference */}
          <section className="lg:col-span-4">
            <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
              <h2 className="text-sm font-bold text-[#06132F] dark:text-white">
                Referensi Nilai Pasar (Google Search)
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
                Cek harga emas, kurs, atau nilai pasar terkini sebelum memperbarui taksiran aset Anda.
              </p>
              <form onSubmit={handleMarketLookup} className="mt-3 flex gap-2">
                <input
                  type="text"
                  aria-label="Kueri harga pasar"
                  value={marketQuery}
                  onChange={(e) => setMarketQuery(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-2 text-xs text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                />
                <button
                  type="submit"
                  disabled={searchMutation.isPending}
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-[#087BFF] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0666DB] disabled:opacity-50 whitespace-nowrap"
                >
                  {searchMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Cek</span>
                </button>
              </form>

              {searchMutation.isError ? (
                <div className="mt-3 space-y-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <p className="leading-relaxed">
                    {searchMutation.error instanceof Error
                      ? searchMutation.error.message
                      : "Gagal mencari referensi harga pasar."}
                  </p>
                  {marketQuery.trim() ? (
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(marketQuery.trim())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#06132F] hover:bg-slate-50 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white"
                    >
                      <span>Cari Langsung di Google</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              ) : searchMutation.data ? (
                <div className="mt-3 space-y-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 text-xs leading-relaxed text-slate-700 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]">
                  <p className="whitespace-pre-line">
                    {searchMutation.data.answer}
                  </p>
                  {searchMutation.data.sources.length > 0 ? (
                    <div className="border-t border-[#DCE4F0] pt-2 dark:border-[#1B3163]">
                      <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-[#C7D0E0]/70">
                        Sumber:
                      </p>
                      <ul className="space-y-1">
                        {searchMutation.data.sources.slice(0, 3).map((src) => (
                          <li key={src.uri}>
                            <a
                              href={src.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#087BFF] hover:underline dark:text-[#19D8FF]"
                            >
                              <span className="max-w-56 truncate">{src.title}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      {/* Modal Tambah Aset Baru */}
      <ModalSheet
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Tambah Aset Baru"
        subtitle="Catat aset fisik atau investasi ke portofolio kekayaan Anda."
      >
        <form onSubmit={handleCreateAsset} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="asset-name"
              className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
            >
              Nama Aset <span className="text-rose-600 dark:text-rose-400">*</span>
            </label>
            <input
              id="asset-name"
              type="text"
              required
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="Contoh: Emas Antam / Reksadana"
              className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-[#C7D0E0]/45 dark:focus:border-[#19D8FF]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="asset-type"
              className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
            >
              Kategori Aset
            </label>
            <select
              id="asset-type"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
              className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
            >
              <option value="emas">Emas</option>
              <option value="investasi">Investasi</option>
              <option value="properti">Properti</option>
              <option value="kendaraan">Kendaraan</option>
              <option value="elektronik">Elektronik</option>
              <option value="lainnya">Lainnya</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="asset-qty"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Kuantitas
              </label>
              <input
                id="asset-qty"
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 font-mono text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-[#C7D0E0]/45 dark:focus:border-[#19D8FF]"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="asset-unit"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Satuan
              </label>
              <input
                id="asset-unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="gram / unit"
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-[#C7D0E0]/45 dark:focus:border-[#19D8FF]"
              />
            </div>
          </div>

          <MoneyInput
            id="asset-value"
            label="Nilai Pasar Taksiran (IDR)"
            value={currentValue}
            onChange={setCurrentValue}
            required
          />

          <div className="space-y-1.5">
            <label
              htmlFor="asset-notes"
              className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
            >
              Catatan
            </label>
            <input
              id="asset-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lokasi simpan / nomor seri"
              className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-[#C7D0E0]/45 dark:focus:border-[#19D8FF]"
            />
          </div>

          <ApprovalCheck
            id="asset-owner-confirm"
            checked={ownerConfirmed}
            onChange={setOwnerConfirmed}
          />

          <button
            type="submit"
            disabled={!ownerConfirmed || createAsset.isPending}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#087BFF]/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-[#102452] dark:disabled:to-[#102452] dark:disabled:text-[#C7D0E0]/45"
          >
            {createAsset.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            <span>Simpan Aset</span>
          </button>
        </form>
      </ModalSheet>

      {/* Modal Perbarui Nilai Aset */}
      <ModalSheet
        open={Boolean(editingAsset)}
        onClose={() => setEditingAsset(null)}
        title={
          editingAsset
            ? `Perbarui Nilai: ${editingAsset.asset_name}`
            : "Perbarui Nilai Aset"
        }
        subtitle="Sesuaikan nilai pasar terkini dengan persetujuan Owner."
      >
        {editingAsset ? (
          <form onSubmit={handleUpdateAsset} className="space-y-4">
            <MoneyInput
              id="edit-asset-val"
              label="Nilai Taksiran Terkini (IDR)"
              value={editValue}
              onChange={setEditValue}
              required
            />
            <div className="space-y-1.5">
              <label
                htmlFor="edit-asset-notes"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Catatan Pembaruan
              </label>
              <input
                id="edit-asset-notes"
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
              />
            </div>
            <ApprovalCheck
              id="edit-asset-confirm"
              checked={editConfirmed}
              onChange={setEditConfirmed}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="min-h-[44px] flex-1 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-4 py-2.5 text-xs font-semibold text-[#06132F] hover:bg-slate-200 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!editConfirmed || updateAsset.isPending}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2.5 text-xs font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 dark:disabled:from-[#102452] dark:disabled:to-[#102452] dark:disabled:text-[#C7D0E0]/45"
              >
                {updateAsset.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                <span>Simpan Nilai Baru</span>
              </button>
            </div>
          </form>
        ) : null}
      </ModalSheet>
    </AppShell>
  );
}
