import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Building2,
  Car,
  Coins,
  CreditCard,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  Package,
  Shield,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react";
import type { AccountType, AssetType, TransactionType } from "../../types/ego";

export function CategoryIcon({
  category,
  transactionType,
  className = "h-4 w-4",
}: {
  category?: string | null;
  transactionType?: TransactionType;
  className?: string;
}) {
  const cat = (category ?? "").toLowerCase();

  if (transactionType === "transfer" || cat.includes("transfer") || cat.includes("tarik") || cat.includes("top up")) {
    return <ArrowLeftRight className={className} aria-hidden="true" />;
  }
  if (cat.includes("makan") || cat.includes("minum") || cat.includes("kopi")) {
    return <Utensils className={className} aria-hidden="true" />;
  }
  if (cat.includes("transport") || cat.includes("bensin") || cat.includes("ojek") || cat.includes("parkir")) {
    return <Car className={className} aria-hidden="true" />;
  }
  if (cat.includes("utilitas") || cat.includes("listrik") || cat.includes("internet") || cat.includes("tagihan")) {
    return <Zap className={className} aria-hidden="true" />;
  }
  if (cat.includes("belanja") || cat.includes("mart") || cat.includes("toko")) {
    return <ShoppingBag className={className} aria-hidden="true" />;
  }
  if (cat.includes("kesehatan") || cat.includes("medis") || cat.includes("obat") || cat.includes("dokter")) {
    return <HeartPulse className={className} aria-hidden="true" />;
  }
  if (cat.includes("asuransi") || cat.includes("proteksi")) {
    return <Shield className={className} aria-hidden="true" />;
  }
  if (cat.includes("langganan") || cat.includes("digital") || cat.includes("streaming")) {
    return <Laptop className={className} aria-hidden="true" />;
  }
  if (cat.includes("tempat tinggal") || cat.includes("rumah") || cat.includes("sewa") || cat.includes("kos")) {
    return <Home className={className} aria-hidden="true" />;
  }
  if (cat.includes("investasi") || cat.includes("aset") || cat.includes("saham") || cat.includes("emas")) {
    return <TrendingUp className={className} aria-hidden="true" />;
  }
  if (cat.includes("utang") || cat.includes("cicilan")) {
    return <CreditCard className={className} aria-hidden="true" />;
  }
  if (cat.includes("gaji") || cat.includes("pendapatan") || cat.includes("bonus")) {
    return <ArrowDownLeft className={className} aria-hidden="true" />;
  }
  if (transactionType === "income") {
    return <ArrowDownLeft className={className} aria-hidden="true" />;
  }
  if (transactionType === "expense") {
    return <ArrowUpRight className={className} aria-hidden="true" />;
  }
  return <Wallet className={className} aria-hidden="true" />;
}

export function AccountTypeIcon({
  type,
  className = "h-4 w-4",
}: {
  type: AccountType;
  className?: string;
}) {
  switch (type) {
    case "bank":
      return <Landmark className={className} aria-hidden="true" />;
    case "ewallet":
      return <Smartphone className={className} aria-hidden="true" />;
    case "cash":
      return <Banknote className={className} aria-hidden="true" />;
  }
}

export function AssetTypeIcon({
  type,
  className = "h-4 w-4",
}: {
  type: AssetType;
  className?: string;
}) {
  switch (type) {
    case "emas":
      return <Coins className={className} aria-hidden="true" />;
    case "investasi":
      return <TrendingUp className={className} aria-hidden="true" />;
    case "properti":
      return <Home className={className} aria-hidden="true" />;
    case "kendaraan":
      return <Car className={className} aria-hidden="true" />;
    case "elektronik":
      return <Laptop className={className} aria-hidden="true" />;
    case "lainnya":
      return <Package className={className} aria-hidden="true" />;
    default:
      return <Building2 className={className} aria-hidden="true" />;
  }
}
