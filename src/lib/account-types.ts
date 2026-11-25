import type { AccountType } from "../types/ego";

/** Translate the UI's stable account type to the Supabase CHECK-constraint value. */
export function toDatabaseAccountType(type: AccountType): string {
  return type === "ewallet" ? "e_wallet" : type;
}

/** Translate persisted account types back to the value used by the application UI. */
export function fromDatabaseAccountType(type: string): AccountType {
  return type === "e_wallet" ? "ewallet" : (type as AccountType);
}
