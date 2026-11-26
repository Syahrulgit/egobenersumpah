# EGO Integration Alignment Plan

Date: 2026-11-26  
Repository: `Syahrulgit/egobenersumpah`  
Base branch: `main`  
Audit branch: `chore/ego-integration-alignment-2026-11-26`  
Production changes: **none**  
Database migrations applied during this plan: **none**

## Owner guardrails

- Keep all work on the audit branch until review.
- Do not merge, deploy, or apply migrations to EGO-PERSONAL without explicit Owner approval.
- Do not copy EGO-TEST schema wholesale into EGO-PERSONAL.
- Do not reset either database or modify existing Owner financial rows.
- Use EGO-TEST for disposable integration tests; synthetic test data must be wrapped in a transaction and rolled back.
- Prefer existing free resources. Do not create a Supabase development branch because branch compute may incur charges.

## Confirmed projects and repository state

- EGO-TEST: `vtfqmofkbovlnumpcadc`, ACTIVE_HEALTHY, Postgres 17.12.
- EGO-PERSONAL: `teudnrqmadbrxpguoqug`, ACTIVE_HEALTHY, Postgres 17.12.
- GitHub `main` at audit start: `376899aa3644a782173253a4bfe743239f4359c8`.
- Current application source calls four RPCs: `create_confirmed_transaction`, `cancel_confirmed_transaction`, `pay_debt_atomically`, and `approve_owner_command`.
- The current EGO-TEST database has all four RPCs as SECURITY INVOKER and grants EXECUTE to authenticated while denying anon execution.
- EGO-PERSONAL currently exposes a different debt-payment RPC contract: `ego_pay_debt_atomic(p_request_id uuid, p_debt_id uuid, p_amount numeric, p_source_account_id uuid, p_owner_confirmed boolean, p_transaction_date date, p_notes text)`. It does not currently have the four RPC names expected by the application.

## Verified schema drift

All inspected public tables had RLS enabled in both projects. However, the schemas are not equivalent.

| Area | EGO-TEST | EGO-PERSONAL | Impact |
|---|---|---|---|
| `owner_preferences` | Present | Missing | Feature/schema mismatch |
| `transactions.idempotency_key` | Present (text) | Missing | Retry protection differs |
| `debt_payment_logs.request_id` | text | uuid | RPC/data contract mismatch |
| `accounts.account_type` | Allows `ewallet` and `e_wallet` | Allows `e_wallet` only | Input compatibility |
| `debts.status` | active, paid, unpaid, partial | active, paid | Existing states may be rejected |
| `debts.interest_rate_annual` | nullable, no default | default 0 with range check | Write semantics differ |
| `debts.monthly_fee` | nullable, no default | default 0 with nonnegative check | Write semantics differ |
| `debts.installment_amount` | nullable, no check | nonnegative check | Validation differs |
| `debts.payment_frequency` | nullable, no default | default monthly | Write semantics differ |
| `financial_health_scores.total_score` | numeric | integer | Type mismatch |
| `financial_health_scores.available_weight` | numeric | integer | Type mismatch |
| `financial_health_scores.is_data_incomplete` | default true | default false | Default semantics differ |
| `financial_reminder_logs.scheduled_for` | timestamptz | date | Type mismatch |
| `savings_goals.target_amount` | permits zero | must be > 0 | Validation differs |
| `owner_commands.status` | includes approved/executed | pending/processed/rejected | Workflow state mismatch |
| `budget_alert_logs.limit_amount` | permits zero | must be > 0 | Validation differs |
| `category_budgets.last_alert_period` | no check shown | YYYY-MM validation | Validation differs |

There are also multiple foreign-key names and ownership-scope definitions that differ. A migration plan must compare the actual constraint definitions, not just their names, before deciding whether to add, replace, or retain a constraint.

Other observed differences include defaults and validation checks in `category_budgets`, `budget_alert_logs`, `financial_reminders`, `recurring_bills`, `savings_goals`, and `whatif_scenarios`. These must be included in a full schema contract check before any migration is proposed.

## Security findings

### EGO-TEST

- Transaction RLS is enabled with an owner-isolation policy.
- The four finance RPCs are SECURITY INVOKER.
- RPC execution is denied to anon and granted to authenticated.
- Direct table privilege inspection reports broad grants on `transactions`: anon has INSERT/UPDATE and authenticated has INSERT/UPDATE/DELETE/TRUNCATE. RLS currently limits row access, but these grants are broader than required and the authenticated direct-write route can bypass the intended RPC-only workflow for a row that satisfies the table constraints.
- Supabase Security Advisor returned no security findings for this project during this audit.

### EGO-PERSONAL

- Transaction RLS is enabled with an owner-isolation policy.
- Authenticated currently has INSERT and UPDATE on `transactions`; anon does not.
- Existing SECURITY DEFINER helpers `ego_check_tx_accounts` and `ego_single_owner_guard` are not executable by anon or authenticated according to privilege checks. Do not change their security mode or grants without inspecting their trigger dependencies and function bodies.
- Supabase Security Advisor reported leaked-password protection disabled. This is an Auth configuration warning, not a schema migration item.

**Important architecture constraint:** revoking direct DML from authenticated while keeping all finance RPCs SECURITY INVOKER would also prevent those RPCs from writing. Any RPC-only write design must explicitly choose and review a safe privilege model. Do not mechanically revoke grants or convert functions to SECURITY DEFINER. If a privileged function is justified, it needs a narrow internal schema, fixed search_path, explicit auth.uid()/ownership checks, tightly scoped EXECUTE grants, and adversarial tests.

## Existing test evidence

- The repository contains `supabase/tests/ego_storage_rpc_smoke_test.sql`, which creates synthetic users and financial rows inside a transaction and ends with ROLLBACK.
- That smoke test was executed against EGO-TEST during this audit and returned without a SQL error.
- The integration test file `finance_integrity_integration.sql` targets the older `ego_pay_debt_atomic` signature and is not aligned with the current EGO-TEST RPC contract. It must not be treated as a passing test for the current RPC implementation.
- No production database tests or changes were performed.

## Transaction integrity issue to cover

The current `cancel_confirmed_transaction(p_id)` RPC only changes a transaction's status to `cancelled`. A debt payment, however, is represented by a transaction, a debt balance update, and a debt-payment log. Cancelling the payment transaction alone can leave the debt balance and payment log unchanged.

Before implementing cancellation, decide and test one explicit invariant:
1. Either debt-payment transactions cannot be cancelled through the generic cancellation RPC and must use a dedicated atomic reversal operation; or
2. Generic cancellation detects the linked payment log and atomically reverses the debt balance, log state, and transaction state.

Do not choose one silently; document the intended accounting behavior and test it on synthetic data first.

## Alignment work sequence

1. **Contract inventory:** capture current application RPC names/argument types, table columns, defaults, checks, foreign keys, indexes, RLS policies, grants, and migration history for both projects.
2. **Canonical target decision:** confirm which Supabase project the deployed app should use. Repository source only reads build-time environment variables; it does not reveal the deployed secret configuration.
3. **Compatibility design:** prepare additive, reversible migrations for EGO-TEST first. Do not derive a migration by copying the TEST schema wholesale.
4. **Security design review:** decide how to enforce Owner-confirmed writes without breaking the chosen RPC execution privilege model.
5. **Integrity tests:** cover create/retry/conflicting retry, transfer account ownership, explicit confirmation, cancellation, debt payment/retry, payment reversal, rollback on injected failure, and concurrent duplicate requests.
6. **Schema contract tests:** assert expected columns, types, defaults, checks, constraints, RLS, grants, and RPC signatures for the target.
7. **Validation:** run smoke/integration tests and Supabase advisors on EGO-TEST; run app typecheck/build/tests through GitHub Actions.
8. **Review gate:** prepare a Draft PR with diffs and evidence. Owner reviews and explicitly approves before any merge or production migration.

## Acceptance criteria

- App RPC calls and target database signatures match exactly.
- No financial write can be posted without explicit Owner confirmation.
- Duplicate requests cannot create duplicate transactions or payments.
- A cancelled/reversed debt payment leaves debt balance, transaction status, and payment history consistent.
- Owner isolation is verified for every relevant table and RPC.
- No existing Owner rows are reset, deleted, or silently transformed.
- EGO-PERSONAL remains unchanged until Owner approval.
- All tests and advisors have recorded, reproducible results.


## Performance advisor snapshot

- EGO-TEST: 11 unused-index INFO findings; no performance WARN finding in the advisor response.
- EGO-PERSONAL: 7 unindexed foreign-key INFO findings, 2 `auth_rls_initplan` WARN findings, and 5 unused-index INFO findings.
- Do not drop unused indexes automatically: the projects are new/low-traffic and usage statistics may not yet be representative.
- Add missing FK indexes only after reviewing existing indexes, expected query patterns, and the exact FK definitions. Keep the two RLS init-plan warnings as a separate, low-risk optimization; do not combine them with critical ledger changes.

## Test execution notes

- The current EGO-TEST smoke-test script completed through the Supabase SQL tool without a SQL error. The script itself wraps its synthetic fixtures in a transaction and ends with ROLLBACK.
- A separate direct-write runtime probe did not complete: the first attempt stopped at a synthetic account foreign-key failure, and the follow-up probe was blocked by a safety check. Therefore, the direct-write finding is based on catalog privilege inspection plus the current RLS policy definition, not a completed exploit simulation.
- The Draft PR triggered GitHub Actions. At the time of this note, `database-integration` was in progress and `app-checks` was queued; no passing conclusion is claimed yet.
