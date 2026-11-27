# EGO-PERSONAL Security Review — 2026-11-27

Project: `teudnrqmadbrxpguoqug` (EGO-PERSONAL)  
Review type: read-only catalog and Supabase Security Advisor inspection  
Production changes made: **none**

## Findings summary

Supabase Security Advisor reports:
- 6 public `SECURITY DEFINER` RPCs executable by `authenticated`.
- 1 Auth warning: leaked-password protection is disabled.

The RPC warning is a review signal, not by itself proof of an authorization vulnerability. The six functions were inspected individually in the live catalog.

## Reviewed public RPCs

| Function | Requires `auth.uid()` | Owner-scoped row lookup/write | Explicit Owner confirmation | Fixed empty search_path | anon EXECUTE | authenticated EXECUTE |
|---|---:|---:|---:|---:|---:|---:|
| `approve_owner_command` | Yes | Yes | Yes | Yes | No | Yes |
| `cancel_confirmed_transaction` | Yes | Yes | N/A (cancellation state guard) | Yes | No | Yes |
| `create_confirmed_transaction` | Yes | Yes | Yes | Yes | No | Yes |
| `ego_pay_debt_atomic` | Yes | Yes | Yes | Yes | No | Yes |
| `reject_owner_command` | Yes | Yes | N/A (pending-state guard) | Yes | No | Yes |
| `save_owner_command_draft` | Yes | Yes | N/A (pending-state guard) | Yes | No | Yes |

All six functions:
- Set `search_path TO ''`.
- Schema-qualify table and internal-function references.
- Resolve the caller from `auth.uid()` and reject a null Owner identity.
- Scope records by the authenticated Owner ID.
- Are not executable by `anon`.

The two privileged internal helpers were also inspected:
- `create_confirmed_transaction_internal`
- `ego_pay_debt_atomic_internal`

Both use an empty search path, enforce `auth.uid()`, validate Owner-scoped accounts/debts, and are not executable by either `anon` or `authenticated`.

## Decision

**Do not blindly revoke or convert the six public RPCs.** The app uses them as the authenticated, Owner-checked transaction boundary; removing authenticated EXECUTE would break core transaction and debt-payment workflows. Keep their public execution grants only with the reviewed Owner checks, fixed search path, and regression coverage intact.

The internal helper functions remain non-callable by client roles.

## Remaining action requiring separate Owner approval

Leaked-password protection is currently disabled in Supabase Auth. This setting was observed but not changed. Enabling it is an Auth configuration change and is outside this read-only review.

## Security Center UI behavior

The browser cannot truthfully verify database policies and function grants from its publishable key alone. The Settings diagnostic therefore reports RLS posture as **not verifiable from this device**, rather than displaying a false green success state. This UI wording does not replace a server-side security audit.
