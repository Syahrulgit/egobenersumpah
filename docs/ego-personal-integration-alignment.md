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


## Application write-path audit (source: `src/lib/queries.ts` on main)

The runtime uses a mixed write model. This must be reflected in the migration design; it is not correct to treat every direct table write as a posted financial transaction.

| Operation | Current app path | Risk / design implication |
|---|---|---|
| Post income/expense/transfer | `create_confirmed_transaction` RPC | RPC missing in PERSONAL; implement validated atomic insert |
| Cancel transaction | `cancel_confirmed_transaction` RPC | RPC missing; must reject debt-payment transactions linked to payment logs until reversal exists |
| Pay debt | `pay_debt_atomically` RPC | App RPC absent; PERSONAL has `ego_pay_debt_atomic` with required `p_transaction_date` |
| Approve queued Owner command | `approve_owner_command` RPC | RPC missing; must atomically create transaction and change command from pending to processed |
| Queue ordinary Owner command | Direct INSERT into `owner_commands` as pending | Queueing a draft is not a posted financial write; preserve this workflow or replace with a safe narrow RPC |
| Reject Owner command | Direct UPDATE `owner_commands.status='rejected'` | Ensure owner-scoped RLS and only pending -> rejected transition |
| Create/update debt metadata | Direct INSERT/UPDATE `debts` | Separate from paying debt; do not break existing metadata forms while tightening ledger writes |
| Queue recurring bill/reminder | Direct INSERT pending command plus update reminder/bill | Current flow uses multiple requests and compensating DELETE on failure; consider a separate atomic queue RPC later, but not part of critical transaction RPC migration |

The application does not currently issue direct INSERT/UPDATE calls to `transactions` in the inspected Supabase branch; it reads transactions directly and posts/cancels via RPC. This supports a future least-privilege design, but the debt and owner-command direct-write flows mean table grants cannot be globally revoked without first migrating those flows.

## Additional confirmed idempotency detail

EGO-PERSONAL already has a unique partial index:
`debt_payment_logs_owner_request_id_uidx ON (owner_id, request_id) WHERE request_id IS NOT NULL`.
Therefore, do not add a duplicate idempotency column/index merely to match EGO-TEST. The existing UUID request identity and unique index are the natural basis for debt-payment retry protection.

## Refined implementation decisions

1. **Debt payment compatibility:** prefer updating the application call to invoke the existing `ego_pay_debt_atomic` contract and explicitly pass `p_transaction_date` (defaulting from the app's `todayISO()`) rather than creating a second independent payment function. Confirm the exact PostgREST argument names and return shape in tests.
2. **Debt cancellation:** generic cancellation must reject a transaction referenced by `debt_payment_logs.transaction_id`. A dedicated reversal is a separate feature requiring its own accounting policy and Owner approval.
3. **Owner command approval:** use a row lock on the pending command, verify `owner_id = auth.uid()`, require `p_owner_confirmed IS TRUE`, validate the draft and both account owners/active states, insert exactly one posted confirmed transaction, then transition the command to `processed` in the same database transaction. Reject duplicate approval attempts.
4. **Owner command queue/reject:** because the app currently performs direct INSERT/UPDATE on `owner_commands`, either retain those limited owner-scoped permissions with strict RLS and state-transition validation, or migrate the queue/reject paths to narrow RPCs before revoking DML. Do not revoke first.
5. **Debt metadata:** preserve direct debt metadata CRUD as a separate path for now; verify RLS enforces owner scoping. Payment balance updates remain exclusively inside the atomic debt-payment function.
6. **Security model:** transaction posting should ultimately be protected against a caller setting `owner_confirmed=true` through arbitrary table DML. A reviewed least-privilege design is required. If SECURITY DEFINER is selected for finance RPCs, use a fixed empty/controlled search_path, schema-qualified object names, explicit `auth.uid()` and row-owner checks, narrowly scoped EXECUTE grants, and tests for cross-owner IDs. Do not mechanically convert existing functions or remove grants as part of a broad cleanup.

## Revised migration/test staging

- Stage 0: keep this proposal documentation-only; no SQL changes.
- Stage 1: create RPC implementations and SQL tests in a disposable local/test database matching EGO-PERSONAL schema. Do not use EGO-TEST as if its schema were equivalent.
- Stage 2: update application RPC calls on this feature branch, including debt RPC name and transaction date argument; add tests for the application contract.
- Stage 3: review SQL privilege model and RLS together with all remaining direct writes (owner command queue/reject, debt metadata, recurring bill/reminder queue).
- Stage 4: only after disposable integration tests pass, publish an unapplied migration candidate in the Draft PR for Owner review.
- Stage 5: EGO-PERSONAL migration remains blocked until Owner approves the exact SQL diff, test report, and recovery plan.

No SQL migration file has been added to `supabase/migrations` at this stage. This is intentional: the next code artifact must be backed by a complete, tested privilege model rather than speculative production SQL.


## Security and debt-function body review (read-only, 2026-11-26)

Reviewed the complete EGO-PERSONAL function definitions, policies, and triggers for the five core tables.

- `ego_pay_debt_atomic` is SECURITY INVOKER (not SECURITY DEFINER), returns JSONB, explicitly requires `auth.uid()` and `p_owner_confirmed IS TRUE`, locks the debt row with `FOR UPDATE`, validates owner and active source account, and atomically inserts a posted expense transaction, updates debt balance/status, and inserts the payment log.
- The existing debt function checks replay identity by owner + request UUID and compares debt, amount, notes, transaction type, source account, category, posted status, and owner confirmation before replaying. The unique partial index on `(owner_id, request_id)` is present.
- The debt function sets `search_path = public, pg_temp`; its relation references are schema-qualified. Keep it SECURITY INVOKER unless a concrete privilege issue and a complete security redesign justify otherwise.
- `transactions` has an INSERT/UPDATE trigger `trg_ego_check_tx_accounts` calling `ego_check_tx_accounts()`. The trigger function is SECURITY DEFINER, has `search_path=public`, and schema-qualifies its account reads. It validates that source/destination accounts belong to the transaction owner. It does not itself establish that the caller is authorized to post a confirmed transaction; the RPC and table privilege/RLS contract must do that.
- Core table RLS policies are owner-scoped for authenticated users on accounts, transactions, debts, debt_payment_logs, and owner_commands. These policies use `auth.uid()` in the row predicate and WITH CHECK.
- `ego_single_owner_guard()` is also SECURITY DEFINER; it is an auth.users registration trigger concern, not part of finance RPC alignment. Do not modify it in this workstream.

## Correction: current app debt RPC arguments

A fresh source inspection of `src/lib/queries.ts` confirms that the current application calls `pay_debt_atomically` with six arguments:
`p_debt_id, p_request_id, p_amount, p_source_account_id, p_notes, p_owner_confirmed`.
It does **not** currently pass `p_transaction_date`. The earlier proposal to pass `todayISO()` is a recommended app change, not an existing behavior. The app should be updated explicitly before relying on the PERSONAL function's required date argument. Confirm whether date should be generated once per request and retained across retries; do not recompute a different date on replay.

The existing `ego_pay_debt_atomic` returns a JSONB object with `debt`, `transaction`, `log`, and `replayed`. App consumers must be checked against this exact shape before changing the RPC name. The app currently checks only that returned data is non-null in the mutation shown; downstream UI/cache behavior still requires an integration test.

## Current migration readiness decision

The function review supports reusing `ego_pay_debt_atomic`; it does not yet justify changing its security mode. However, the missing create/cancel/approve RPCs still need implementations that fit the existing invoker privilege model and current RLS. Before authoring those SQL bodies, inspect all transaction check constraints and grants, then validate the exact JSON draft schema consumed by `approve_owner_command`.

The latest GitHub Actions checks for commit `1f0c378ab0771a4926d130b3abcb05b449fd8e88` completed successfully:
- `app-checks`: success
- `database-integration`: success

These checks ran against the documentation-only alignment branch state; they are not evidence that the missing PERSONAL RPCs have been implemented or that a production integration test has passed.


## Implementation package prepared on feature branch (2026-11-26)

Branch: `feat/ego-personal-rpc-alignment-2026-11-26`

The following artifacts are prepared for review; the SQL candidate has **not** been applied to EGO-PERSONAL:

- `docs/ego-personal-rpc-alignment-candidate.sql` — target-specific RPC + privilege candidate.
- `docs/ego-personal-rpc-alignment-rollback.sql` — rollback SQL for the function/grant changes.
- `supabase/tests/ego_personal_schema_fixture.sql` — synthetic PostgreSQL fixture matching observed PERSONAL core columns and constraints.
- `supabase/tests/ego_personal_rpc_alignment.sql` — authorization, RPC, retry, cancellation, debt atomicity, and rollback checks.
- `supabase/tests/ego_personal_rpc_concurrency.sh` — concurrent duplicate debt-payment retry check.
- `src/lib/queries.ts` — debt payment now calls the canonical `ego_pay_debt_atomic` function with `p_transaction_date`.
- `src/routes/_authenticated/utang.tsx` — persists transaction date with the pending request in sessionStorage, preserving the same date on subsequent retries. Legacy pending requests without a date fall back to the current local date while retaining the original request UUID.
- `.github/workflows/finance-integrity.yml` — adds a separate ephemeral PostgreSQL job to apply the candidate to the synthetic PERSONAL fixture and run the tests.

### Security design in the candidate

The candidate changes the five finance write RPCs to narrowly-scoped `SECURITY DEFINER` functions with an empty `search_path`, schema-qualified application objects, and explicit `auth.uid()` ownership checks. It revokes `INSERT/UPDATE/DELETE` on `transactions` and `debt_payment_logs` from `anon` and `authenticated`, while retaining authenticated SELECT access. This is necessary because the current app writes ledger rows only through RPCs; leaving direct DML grants would let a client bypass the explicit confirmation RPC. Owner command queue remains a direct INSERT of pending drafts; rejection now uses a dedicated `reject_owner_command` RPC, and direct UPDATE on `owner_commands` is revoked. DELETE remains available for the app's existing compensating cleanup when recurring bill/reminder queue creation fails. Debt metadata CRUD remains unchanged.

This deliberately exposed authenticated RPC surface is a privilege boundary and must be reviewed carefully: SECURITY DEFINER bypasses RLS. The body therefore scopes every row lookup/update by `auth.uid()`, validates active account ownership, requires explicit confirmation, and has a fixed empty search path. Function EXECUTE is revoked from PUBLIC and anon and granted only to authenticated. The isolated test job includes checks for direct-write denial and cross-owner access. Supabase security advisors must be re-run on a disposable PERSONAL-equivalent database before production approval.

### Important accounting invariants

- Generic transaction cancellation rejects any transaction referenced by `debt_payment_logs`; a dedicated atomic reversal is not included.
- Debt payment reuses the existing UUID `request_id` and the existing unique partial index; no `idempotency_key` column or duplicate payment RPC is introduced.
- Debt payment retries are serialized by an Owner-scoped advisory transaction lock. A request UUID identifies one immutable payment attempt; the original transaction date is returned on replay. This preserves compatibility with older pending requests that did not persist a date.
- Owner command approval locks the pending command row, posts one transaction using the command UUID as the transaction UUID, and updates the command to `processed` in the same database transaction.
- No existing Owner financial rows are updated by the candidate migration.

### Validation status and limits

The workflow now has an isolated PostgreSQL 16 fixture job. Its result must be checked on the new PR commit before describing the candidate as tested. This fixture is synthetic and is not a clone of the complete Supabase platform; it verifies the observed table contract, RLS owner predicates, grants, and RPC behavior, but it does not replace an approved disposable Supabase branch test with actual Supabase Auth/PostgREST.

No Supabase development branch was created because branch compute can incur charges and the EGO budget is zero. No changes have been applied to EGO-PERSONAL or EGO-TEST. Production migration, merge, and deployment remain blocked pending Owner review of the exact diff, successful CI evidence, advisor output from a disposable Supabase environment, and explicit approval.


### Additional command-state protection

A source audit found that `useRejectCommand` was the only ordinary application path performing a direct UPDATE on `owner_commands`; recurring bill/reminder workflows only insert pending drafts and may delete a just-inserted draft as compensating cleanup. The candidate therefore adds `reject_owner_command(p_command_id)`, which locks the Owner-scoped row and permits only `pending -> rejected` (with idempotent retry of an already rejected row). Direct UPDATE on `owner_commands` is revoked, and the app's rejection mutation now calls the RPC. The rollback script restores the pre-alignment authenticated UPDATE grant.

The latest concurrency test now covers both:
- Two simultaneous calls with the same request UUID both return successfully but create exactly one payment transaction/log.
- Two simultaneous calls with different request UUIDs against an insufficient remaining balance allow exactly one payment to commit and prevent overpayment.
