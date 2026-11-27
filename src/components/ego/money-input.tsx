import { formatThousandsInput, parseThousandsInput } from "../../lib/finance";

interface MoneyInputProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  large?: boolean;
}

export function MoneyInput({
  id,
  label,
  value,
  onChange,
  placeholder = "0",
  required = false,
  disabled = false,
  hint,
  large = false,
}: MoneyInputProps) {
  const displayValue =
    value > 0 ? formatThousandsInput(String(Math.round(value))) : "";

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
        {required ? (
          <span className="ml-1 text-[#EF4444]">*</span>
        ) : null}
      </label>
      <div className="relative flex items-center">
        <span
          className={`pointer-events-none absolute left-3.5 font-mono font-semibold text-slate-500 dark:text-[#D4AF37]/80 ${
            large ? "text-base" : "text-sm"
          }`}
        >
          Rp
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={displayValue}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          onChange={(e) => {
            const parsed = parseThousandsInput(e.target.value);
            onChange(parsed);
          }}
          className={`w-full rounded-xl border border-slate-200 bg-white pr-3.5 pl-11 font-mono tabular-nums text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25 disabled:opacity-50 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37] dark:focus:bg-[#0B111E] ${
            large ? "min-h-[52px] py-3 text-xl font-bold" : "min-h-[44px] py-2.5 text-sm font-semibold"
          }`}
        />
      </div>
      {hint ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
