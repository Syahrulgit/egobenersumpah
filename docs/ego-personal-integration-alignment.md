# EGO-PERSONAL Integration Alignment

Date: 2026-11-26  
Repository: `Syahrulgit/egobenersumpah`  
Target project: **EGO-PERSONAL** (`teudnrqmadbrxpguoqug`)  
Reference project: EGO-TEST (`vtfqmofkbovlnumpcadc`)  
Branch: `chore/ego-integration-alignment-2026-11-26`

## Owner decision

Owner confirmed that the running EGO application uses EGO-PERSONAL. Treat EGO-PERSONAL as the canonical runtime target for compatibility work. EGO-TEST remains a reference/test project only; do not assume its schema can be copied wholesale.

## Safety state

- This is a documentation and read-only inspection update.
- No SQL was executed against EGO-PERSONAL that changes schema or rows.
- No migration was applied to either project during this step.
- No production deployment, merge, or app code change was made.
- Existing EGO-PERSONAL financial rows were not modified.
- Do not apply staged SQL or deploy until Owner has reviewed a Draft PR and explicitly approved.

## Runtime RPC contract confirmed from application source

The application source `src/lib/queries.ts` calls these RPCs:

| Application call | Arguments passed by app | EGO-PERSONAL observed state | Alignment |
|---|---|---|---|
| `create_confirmed_transaction` | `p_id, p_transaction_type, p_source_account_id, p_destination_account_id, p_amount, p_transaction_date, p_category, p_description, p_owner_confirmed` | Function absent | Add a target-schema-compatible function |
| `cancel_confirmed_transaction` | `p_id` | Function absent | Add cancellation with debt-payment guard/reversal semantics |
| `approve_owner_command` | `p_command_id, p_owner_confirmed, p_draft` | Function absent | Add function adapted to PERSONAL owner_commands states |
| `pay_debt_atomically` | `p_debt_id, p_request_id, p_amount, p_source_account_id, p_notes, p_owner_confirmed` | Function absent; `ego_pay_debt_atomic` exists | Align one canonical contract or add a carefully reviewed compatibility wrapper |

The existing PERSONAL `ego_pay_debt_atomic` signature is:
`(p_request_id uuid, p_debt_id uuid, p_amount numeric, p_source_account_id uuid, p_owner_confirmed boolean, p_transaction_date date, p_notes text DEFAULT NULL)`.

It is SECURITY INVOKER and checks `auth.uid()`, explicit Owner confirmation, debt ownership, active source account, amount bounds, and retry identity. It uses `debt_payment_logs.request_id uuid`. The application call does not currently send `p_transaction_date`, so a compatibility design must explicitly decide whether to update the app call to pass a date or expose a wrapper that supplies the intended transaction date. Do not silently assume this.

## EGO-PERSONAL schema facts relevant to RPC design

- `transactions` has no `idempotency_key` column. Its primary key `id` is UUID; the app already supplies a transaction UUID.
- `transactions.status` allows `pending`, `posted`, and `cancelled`.
- `transactions.owner_confirmed` defaults false.
- `accounts.account_type` allows `cash`, `bank`, `e_wallet`, and `other`.
- `debts.status` allows `active` and `paid`.
- `owner_commands.status` allows `pending`, `processed`, and `rejected`; it has `parsed_draft` and `processed_at`.
- `debt_payment_logs.request_id` is UUID, with an existing owner-scoped payment implementation.
- RLS is enabled on `accounts`, `transactions`, `debts`, `debt_payment_logs`, and `owner_commands`.
- Authenticated has SELECT, INSERT, and UPDATE grants on `transactions`; no DELETE grant was observed for authenticated.
- EGO-PERSONAL migration history includes `transactions_require_owner_confirmation` and `atomic_debt_payment`. Confirmed migration versions are `20261126054259` and `20261126054318`.

## Required design decisions before writing the target migration

1. **Transaction idempotency:** use the application-supplied UUID primary key plus a transaction-scoped advisory lock, or add a separate idempotency column. Prefer avoiding a schema change if the UUID contract fully covers retries.
2. **Debt RPC contract:** either update the app to call the existing `ego_pay_debt_atomic` and pass `p_transaction_date`, or add a compatibility wrapper matching the app's current `pay_debt_atomically` signature. Compare both options and choose one; do not maintain two independent debt-payment implementations.
3. **Cancellation invariant:** debt-payment transactions must not be cancelled by a generic transaction-only status update. Either reject generic cancellation for linked debt-payment transactions and require a separately designed atomic reversal, or implement a fully atomic reversal of debt balance, payment log, and transaction state. Do not leave payment history and balance inconsistent.
4. **Security privilege model:** current finance RPCs are SECURITY INVOKER. Revoking authenticated direct DML would also prevent invoker RPCs from writing. Do not revoke grants or convert functions to SECURITY DEFINER without a reviewed privilege architecture, explicit `auth.uid()` and ownership checks, fixed search_path, narrow grants, and tests.
5. **Owner command workflow:** use only the PERSONAL enum/check states (`pending`, `processed`, `rejected`) unless a separately reviewed migration changes them. Avoid EGO-TEST-only states such as `approved` or `executed`.

## Target-specific validation plan

All runtime tests must use disposable synthetic identities and synthetic rows in a rollback transaction. Do not use the Owner's existing financial records.

1. Verify all four app RPC signatures match exactly, including argument names/types and return shapes.
2. Test unauthenticated rejection and Owner-only row scoping.
3. Test transaction income, expense, transfer, invalid account pair, inactive account, invalid amount, and explicit-confirmation false.
4. Test same transaction UUID retry returns the same row; conflicting retry is rejected; concurrent duplicate calls cannot double-post.
5. Test owner command pending -> processed exactly once; rejected/already-processed commands cannot create another transaction.
6. Test debt payment, retry replay, conflicting request reuse, overpayment, inactive/wrong-owner account, and concurrent requests.
7. Test generic cancellation of a debt-payment transaction is rejected until a safe reversal workflow exists.
8. Test all failure paths rollback the entire transaction.
9. Run schema contract assertions against EGO-PERSONAL only after an approved disposable test environment is available. Until then, keep PERSONAL inspection read-only.
10. Run app unit tests, typecheck, build, and GitHub Actions after any branch code changes.

## Immediate next step

Prepare a migration proposal specifically for the observed EGO-PERSONAL schema and matching tests, but keep it as an un-applied Draft PR. Do not copy the EGO-TEST migration verbatim. Before any database execution against EGO-PERSONAL, present the SQL diff, rollback/recovery plan, and test evidence to Owner for explicit approval.
