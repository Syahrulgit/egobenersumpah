import { ShieldCheck } from "lucide-react";

interface ApprovalCheckProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ApprovalCheck({
  id,
  checked,
  onChange,
  disabled = false,
}: ApprovalCheckProps) {
  return (
    <label
      htmlFor={id}
      className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors select-none ${
        checked
          ? "border-[#D4AF37]/65 bg-[#D4AF37]/10 text-[#101827] dark:border-[#D4AF37]/55 dark:bg-[#D4AF37]/14 dark:text-white"
          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#D4AF37]/40 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-300 dark:hover:border-[#D4AF37]/45"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 bg-white text-[#D4AF37] accent-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/30 dark:border-[#334155] dark:bg-[#101827] dark:accent-[#D4AF37]"
      />
      <span className="flex flex-col gap-0.5 text-sm leading-snug">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#101827] dark:text-white">
          <ShieldCheck
            className="h-4 w-4 shrink-0 text-[#B8901F] dark:text-[#D4AF37]"
            aria-hidden="true"
          />
          Saya, Owner, menyetujui tindakan ini secara sadar &amp; eksplisit.
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Demi keamanan brankas Anda, saldo tidak akan berubah sebelum kotak ini dicentang.
        </span>
      </span>
    </label>
  );
}
