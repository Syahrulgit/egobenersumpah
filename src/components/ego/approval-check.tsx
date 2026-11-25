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
          ? "border-[#087BFF]/45 bg-[#087BFF]/8 text-[#06132F] dark:border-[#19D8FF]/45 dark:bg-[#087BFF]/15 dark:text-white"
          : "border-[#DCE4F0] bg-[#F4F7FB] text-slate-700 hover:border-[#087BFF]/30 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0] dark:hover:border-[#087BFF]/40"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 bg-white text-[#087BFF] accent-[#087BFF] focus:ring-2 focus:ring-[#087BFF]/30 dark:border-[#233E7A] dark:bg-[#091634] dark:accent-[#19D8FF]"
      />
      <span className="flex flex-col gap-0.5 text-sm leading-snug">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#06132F] dark:text-white">
          <ShieldCheck
            className="h-4 w-4 shrink-0 text-[#087BFF] dark:text-[#19D8FF]"
            aria-hidden="true"
          />
          Saya, Owner, menyetujui tindakan ini secara sadar &amp; eksplisit.
        </span>
        <span className="text-xs text-slate-500 dark:text-[#C7D0E0]/75">
          Demi keamanan brankas Anda, saldo tidak akan berubah sebelum kotak ini dicentang.
        </span>
      </span>
    </label>
  );
}
