#!/usr/bin/env bash
set -euo pipefail
export PGPASSWORD=ego_test_only
CONN=(psql -h localhost -U ego_test -d ego_finance_test -v ON_ERROR_STOP=1 -q)
OWNER=11111111-1111-4111-8111-111111111111
DEBT=ffffffff-ffff-4fff-8fff-ffffffffffff
ACCOUNT=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
SQL_A="SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${OWNER}',false); SELECT public.ego_pay_debt_atomic('11111111-aaaa-4aaa-8aaa-111111111111','${DEBT}',40.00,'${ACCOUNT}',true,DATE '2026-11-26','concurrent A');"
SQL_B="SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${OWNER}',false); SELECT public.ego_pay_debt_atomic('22222222-bbbb-4bbb-8bbb-222222222222','${DEBT}',40.00,'${ACCOUNT}',true,DATE '2026-11-26','concurrent B');"
"${CONN[@]}" -c "${SQL_A}" >/tmp/ego-concurrent-a.log 2>&1 &
PID_A=$!
"${CONN[@]}" -c "${SQL_B}" >/tmp/ego-concurrent-b.log 2>&1 &
PID_B=$!
set +e
wait "$PID_A"; RC_A=$?
wait "$PID_B"; RC_B=$?
set -e
if [[ $RC_A -eq 0 && $RC_B -ne 0 ]]; then :;
elif [[ $RC_B -eq 0 && $RC_A -ne 0 ]]; then :;
else
  cat /tmp/ego-concurrent-a.log /tmp/ego-concurrent-b.log
  echo "Expected exactly one concurrent payment to succeed; got A=$RC_A B=$RC_B"
  exit 1
fi
RESULT=$("${CONN[@]}" -Atc "SELECT d.outstanding_balance::text || '|' || (SELECT count(*) FROM public.debt_payment_logs l WHERE l.debt_id=d.id)::text || '|' || (SELECT count(*) FROM public.transactions t WHERE t.description='Pembayaran utang ke Concurrent test')::text FROM public.debts d WHERE d.id='${DEBT}'")
if [[ "$RESULT" != "10.00|1|1" ]]; then
  echo "Unexpected concurrent result: $RESULT"
  exit 1
fi
echo "Concurrent debt payment serialization passed (one payment committed, one rejected)."
