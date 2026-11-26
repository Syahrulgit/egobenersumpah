import test from "node:test";
import assert from "node:assert/strict";
import {
  fromDatabaseAccountType,
  toDatabaseAccountType,
} from "./account-types";

test("E-Wallet maps to the Supabase enum/check value and back", () => {
  assert.equal(toDatabaseAccountType("ewallet"), "e_wallet");
  assert.equal(fromDatabaseAccountType("e_wallet"), "ewallet");
});

test("cash and bank account types remain unchanged", () => {
  assert.equal(toDatabaseAccountType("cash"), "cash");
  assert.equal(toDatabaseAccountType("bank"), "bank");
  assert.equal(fromDatabaseAccountType("cash"), "cash");
  assert.equal(fromDatabaseAccountType("bank"), "bank");
});
