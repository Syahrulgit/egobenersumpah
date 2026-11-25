# EGO Personal AI — Full Source Code Bundle

Total files: 56

## Daftar Isi

1. `metadata.json` (7 lines)
2. `package.json` (45 lines)
3. `tsconfig.json` (29 lines)
4. `index.html` (44 lines)
5. `vite.config.ts` (122 lines)
6. `.env.example` (14 lines)
7. `public/manifest.webmanifest` (33 lines)
8. `public/icon.svg` (24 lines)
9. `docs/ego-supabase-setup.sql` (261 lines)
10. `server.ts` (1584 lines)
11. `server/loadEnv.ts` (27 lines)
12. `server/authVerify.ts` (105 lines)
13. `server/vaultRules.ts` (251 lines)
14. `server/vaultStore.ts` (113 lines)
15. `server/gemini.ts` (714 lines)
16. `server/gemini.test.ts` (64 lines)
17. `server/vaultRules.test.ts` (323 lines)
18. `src/main.tsx` (6 lines)
19. `src/App.tsx` (7 lines)
20. `src/index.css` (27 lines)
21. `src/routeTree.ts` (126 lines)
22. `src/types/ego.ts` (144 lines)
23. `src/lib/supabase.ts` (46 lines)
24. `src/lib/vault-validation.ts` (221 lines)
25. `src/lib/queries.ts` (1464 lines)
26. `src/lib/finance.ts` (537 lines)
27. `src/lib/command-parser.ts` (356 lines)
28. `src/lib/export.ts` (105 lines)
29. `src/lib/pin-lock.ts` (153 lines)
30. `src/lib/pwa.ts` (86 lines)
31. `src/lib/theme.tsx` (118 lines)
32. `src/lib/command-parser.test.ts` (79 lines)
33. `src/lib/export.test.ts` (79 lines)
34. `src/lib/finance.test.ts` (519 lines)
35. `src/lib/vault-validation.test.ts` (230 lines)
36. `src/components/ego/app-shell.tsx` (369 lines)
37. `src/components/ego/approval-check.tsx` (48 lines)
38. `src/components/ego/cashflow-chart.tsx` (413 lines)
39. `src/components/ego/category-breakdown.tsx` (245 lines)
40. `src/components/ego/live-voice-panel.tsx` (497 lines)
41. `src/components/ego/money-input.tsx` (63 lines)
42. `src/components/ego/pin-lock-screen.tsx` (230 lines)
43. `src/components/ego/pwa-controls.tsx` (146 lines)
44. `src/components/ego/receipt-scanner.tsx` (297 lines)
45. `src/components/ego/tts-button.tsx` (122 lines)
46. `src/routes/__root.tsx` (61 lines)
47. `src/routes/auth.tsx` (414 lines)
48. `src/routes/_authenticated/route.tsx` (45 lines)
49. `src/routes/_authenticated/index.tsx` (566 lines)
50. `src/routes/_authenticated/transaksi.tsx` (663 lines)
51. `src/routes/_authenticated/akun.tsx` (260 lines)
52. `src/routes/_authenticated/aset.tsx` (457 lines)
53. `src/routes/_authenticated/utang.tsx` (671 lines)
54. `src/routes/_authenticated/owner.tsx` (596 lines)
55. `src/routes/_authenticated/rencana.tsx` (1114 lines)
56. `src/routes/_authenticated/pengaturan.tsx` (1059 lines)

---

## 1. `metadata.json` (7 lines)

```json
{
  "name": "EGO Personal AI",
  "description": "Asisten Keuangan Pribadi Cerdas Single-Owner dengan Prinsip Kendali Brankas Mutlak.",
  "requestFramePermissions": ["microphone"],
  "majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]
}
```

---

## 2. `package.json` (45 lines)

```json
{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "start": "NODE_ENV=production node server.js",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=server.js",
    "preview": "vite preview",
    "clean": "rm -rf dist server.js",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@google/genai": "^3.6.1",
    "@supabase/supabase-js": "^2.119.2",
    "@tailwindcss/vite": "^4.3.3",
    "@tanstack/react-query": "^5.108.4",
    "@tanstack/react-router": "^1.170.46",
    "@types/ws": "^8.18.2",
    "@vitejs/plugin-react": "^6.1.1",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "sonner": "^2.0.8",
    "vite": "^8.3.0",
    "ws": "^8.23.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "autoprefixer": "^10.4.21",
    "esbuild": "^0.25.0",
    "tailwindcss": "^4.3.3",
    "tsx": "^4.21.0",
    "typescript": "^7.0.2",
    "vite-plugin-pwa": "^2.0.0"
  }
}
```

---

## 3. `tsconfig.json` (29 lines)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "types": ["vite/client", "vite-plugin-pwa/client"],
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "exclude": ["dist"]
}
```

---

## 4. `index.html` (44 lines)

```html
<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EGO Personal AI — Asisten Keuangan Single-Owner</title>
    <meta name="description" content="Asisten Keuangan Pribadi Cerdas Single-Owner dengan Prinsip Kendali Brankas Mutlak." />
    <meta property="og:title" content="EGO Personal AI — Asisten Keuangan Single-Owner" />
    <meta property="og:description" content="Asisten Keuangan Pribadi Cerdas Single-Owner dengan Prinsip Kendali Brankas Mutlak." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#059669" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="EGO" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <script>
      (function () {
        try {
          var saved = localStorage.getItem("ego_theme");
          if (saved === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        } catch (e) {}
      })();
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body class="bg-stone-50 text-stone-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900 dark:bg-zinc-950 dark:text-zinc-100 dark:selection:bg-emerald-500/30 dark:selection:text-emerald-200">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 5. `vite.config.ts` (122 lines)

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import {hydrateEnvFromDotEnv} from './server/loadEnv';

export default defineConfig(() => {
  hydrateEnvFromDotEnv();
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-1024.png'],
        manifest: {
          id: '/',
          name: 'EGO Personal AI',
          short_name: 'EGO',
          description: 'Asisten Keuangan Pribadi Cerdas Single-Owner dengan Prinsip Kendali Brankas Mutlak.',
          theme_color: '#059669',
          background_color: '#faf9f6',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          lang: 'id',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icon-1024.png',
              sizes: '1024x1024',
              type: 'image/png',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          const srcAssets = path.resolve(import.meta.dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
```

---

## 6. `.env.example` (14 lines)

```dotenv
# GEMINI_API_KEY: Required for Gemini AI API calls.
# AI Studio automatically injects this at runtime from user secrets.
# Users configure this via the Secrets panel in the AI Studio UI.
GEMINI_API_KEY="MY_GEMINI_API_KEY"

# APP_URL: The URL where this applet is hosted.
# AI Studio automatically injects this at runtime with the Cloud Run service URL.
# Used for self-referential links, OAuth callbacks, and API endpoints.
APP_URL="MY_APP_URL"

# Optional Supabase Configuration (leave empty to use local Single-Owner Vault server)
VITE_SUPABASE_URL=""
VITE_SUPABASE_PUBLISHABLE_KEY=""
```

---

## 7. `public/manifest.webmanifest` (33 lines)

```json
{
  "id": "/",
  "name": "EGO Personal AI",
  "short_name": "EGO",
  "description": "Asisten Keuangan Pribadi Cerdas Single-Owner dengan Prinsip Kendali Brankas Mutlak.",
  "theme_color": "#059669",
  "background_color": "#faf9f6",
  "display": "standalone",
  "start_url": "/",
  "scope": "/",
  "lang": "id",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-1024.png",
      "sizes": "1024x1024",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

---

## 8. `public/icon.svg` (24 lines)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="ego-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#ego-bg)" />
  <path
    d="M256 96L128 148V248C128 332 182 406 256 428C330 406 384 332 384 248V148L256 96Z"
    stroke="#FFFFFF"
    stroke-width="26"
    stroke-linejoin="round"
    fill="rgba(255,255,255,0.12)"
  />
  <path
    d="M210 262L242 294L306 226"
    stroke="#FFFFFF"
    stroke-width="28"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
```

---

## 9. `docs/ego-supabase-setup.sql` (261 lines)

```sql
-- =====================================================================
-- EGO PERSONAL AI — IDEMPOTENT SUPABASE SETUP SCRIPT
-- Jalankan skrip ini pada Supabase SQL Editor.
-- Prinsip: Single-Owner Guard + Absolute Owner Vault Control + RLS
-- =====================================================================

create extension if not exists pgcrypto;

-- 1. Tabel Akun Keuangan (Kas, Bank, E-Wallet)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_name text not null check (char_length(account_name) between 1 and 80),
  account_type text not null check (account_type in ('cash', 'bank', 'ewallet')),
  opening_balance numeric(18,2) not null default 0,
  currency text not null default 'IDR',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Tabel Transaksi (Mutasi Kas Terkontrol)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('income', 'expense', 'transfer')),
  source_account_id uuid references public.accounts(id),
  destination_account_id uuid references public.accounts(id),
  amount numeric(18,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  category text,
  description text,
  status text not null default 'pending' check (status in ('posted', 'pending', 'cancelled')),
  owner_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ego_posted_requires_confirmation check (status <> 'posted' or owner_confirmed = true),
  constraint ego_income_requires_dest check (transaction_type <> 'income' or destination_account_id is not null),
  constraint ego_expense_requires_source check (transaction_type <> 'expense' or source_account_id is not null),
  constraint ego_transfer_accounts check (
    transaction_type <> 'transfer' or (
      source_account_id is not null
      and destination_account_id is not null
      and source_account_id <> destination_account_id
    )
  )
);

create index if not exists transactions_owner_date_idx
  on public.transactions (owner_id, transaction_date desc);

-- 3. Tabel Aset Fisik & Investasi
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  asset_name text not null check (char_length(asset_name) between 1 and 120),
  asset_type text not null default 'lainnya' check (asset_type in ('emas', 'properti', 'kendaraan', 'investasi', 'elektronik', 'lainnya')),
  current_value numeric(18,2) not null default 0 check (current_value >= 0),
  quantity numeric(18,4),
  unit text,
  notes text,
  created_at timestamptz not null default now()
);

-- 4. Tabel Utang & Kewajiban
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creditor text not null check (char_length(creditor) between 1 and 120),
  original_amount numeric(18,2) not null check (original_amount > 0),
  outstanding_balance numeric(18,2) not null check (outstanding_balance >= 0),
  due_date date,
  status text not null default 'active' check (status in ('active', 'paid')),
  description text,
  created_at timestamptz not null default now()
);

-- 5. Tabel Antrean Perintah Owner AI
create table if not exists public.owner_commands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  command_text text not null check (char_length(command_text) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'processed', 'rejected')),
  parsed_draft jsonb,
  created_at timestamptz not null default now()
);

-- 6. View Saldo Akun Riil (Security Invoker)
drop view if exists public.account_balances;
create view public.account_balances
with (security_invoker = true)
as
select
  a.id,
  a.owner_id,
  a.account_name,
  a.account_type,
  a.opening_balance,
  a.currency,
  a.is_active,
  a.created_at,
  (
    a.opening_balance
    + coalesce((
      select sum(t.amount)
      from public.transactions t
      where t.destination_account_id = a.id
        and t.status = 'posted'
        and t.owner_confirmed = true
    ), 0)
    - coalesce((
      select sum(t.amount)
      from public.transactions t
      where t.source_account_id = a.id
        and t.status = 'posted'
        and t.owner_confirmed = true
    ), 0)
  )::numeric(18,2) as current_balance
from public.accounts a;

-- 7. Row Level Security (RLS)
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.assets enable row level security;
alter table public.debts enable row level security;
alter table public.owner_commands enable row level security;

drop policy if exists ego_accounts_owner_all on public.accounts;
create policy ego_accounts_owner_all on public.accounts
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists ego_transactions_owner_all on public.transactions;
create policy ego_transactions_owner_all on public.transactions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists ego_assets_owner_all on public.assets;
create policy ego_assets_owner_all on public.assets
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists ego_debts_owner_all on public.debts;
create policy ego_debts_owner_all on public.debts
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists ego_commands_owner_all on public.owner_commands;
create policy ego_commands_owner_all on public.owner_commands
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 8. Trigger Validasi Integritas Akun Transaksi
create or replace function public.ego_check_tx_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  src_owner uuid;
  dst_owner uuid;
begin
  if new.source_account_id is not null then
    select owner_id into src_owner from public.accounts where id = new.source_account_id;
    if src_owner is null or src_owner <> new.owner_id then
      raise exception 'Akun sumber tidak valid atau bukan milik Owner.';
    end if;
  end if;

  if new.destination_account_id is not null then
    select owner_id into dst_owner from public.accounts where id = new.destination_account_id;
    if dst_owner is null or dst_owner <> new.owner_id then
      raise exception 'Akun tujuan tidak valid atau bukan milik Owner.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ego_check_tx_accounts on public.transactions;
create trigger trg_ego_check_tx_accounts
  before insert or update on public.transactions
  for each row execute function public.ego_check_tx_accounts();

-- 9. Trigger Proteksi Single-Owner pada auth.users
create or replace function public.ego_single_owner_guard()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  existing_count integer;
begin
  select count(*) into existing_count from auth.users;
  if existing_count >= 1 then
    raise exception 'Sistem Single-Owner: Akun Owner sudah terdaftar. Pendaftaran kedua ditolak.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ego_single_owner_guard on auth.users;
create trigger trg_ego_single_owner_guard
  before insert on auth.users
  for each row execute function public.ego_single_owner_guard();

-- 10. Tabel Tagihan & Pemasukan Rutin (Recurring)
create table if not exists public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  amount numeric(18,2) not null check (amount > 0),
  category text not null default 'Utilitas & Tagihan',
  account_id uuid references public.accounts(id) on delete set null,
  frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'yearly')),
  next_due_date date not null,
  is_active boolean not null default true,
  notes text,
  last_queued_date date,
  created_at timestamptz not null default now()
);

alter table public.recurring_bills enable row level security;

drop policy if exists ego_recurring_owner_all on public.recurring_bills;
create policy ego_recurring_owner_all on public.recurring_bills
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 11. Tabel Target Tabungan & Dana Darurat (Financial Goals)
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  goal_type text not null default 'savings_target' check (goal_type in ('emergency_fund', 'savings_target')),
  target_amount numeric(18,2) not null check (target_amount > 0),
  current_amount numeric(18,2) not null default 0 check (current_amount >= 0),
  target_date date,
  linked_account_id uuid references public.accounts(id) on delete set null,
  notes text,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.savings_goals enable row level security;

drop policy if exists ego_goals_owner_all on public.savings_goals;
create policy ego_goals_owner_all on public.savings_goals
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

```

---

## 10. `server.ts` (1584 lines)

```ts
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import "./server/loadEnv";
import express from "express";
import { WebSocketServer } from "ws";
import { parseNaturalCommand } from "./src/lib/command-parser";
import {
  advanceDueDate,
  computeAccountBalances,
  roundCurrency,
  todayISO,
} from "./src/lib/finance";
import type {
  Account,
  Asset,
  Debt,
  OwnerCommand,
  OwnerPreferences,
  ParsedCommandDraft,
  RecurringBill,
  SavingsGoal,
  Transaction,
} from "./src/types/ego";
import {
  createAuthedSupabaseClient,
  isServerSupabaseConfigured,
  verifyOwnerToken,
} from "./server/authVerify";
import {
  attachLiveVoiceSession,
  classifyGeminiError,
  runFinancialSearch,
  scanReceiptToDraft,
  synthesizeIndonesianTTS,
} from "./server/gemini";
import {
  OWNER_EMAIL_REGEX,
  assertSingleOwnerAvailable,
  createEmptyVault,
  createLoginRateLimiter,
  validateAccountInput,
  validateAssetInput,
  validateChangePasswordInput,
  validateDebtInput,
  validateDebtPayment,
  validateOwnerEmailUpdateInput,
  validatePinFormat,
  validateRecurringBillInput,
  validateResetOwnerConfirmation,
  validateSavingsGoalInput,
  validateTransactionInvariants,
} from "./server/vaultRules";
import {
  clearAllSessions,
  createSession,
  hashPassword,
  loadVault,
  revokeSessionToken,
  rotateSessionsForOwner,
  saveVault,
  validateSessionToken,
  verifyPassword,
} from "./server/vaultStore";

const PORT =
  process.env.NODE_ENV === "production"
    ? Number(process.env.PORT) || 3000
    : 3000;
const loginRateLimiter = createLoginRateLimiter(5, 15 * 60 * 1000);
const passwordRateLimiter = createLoginRateLimiter(5, 15 * 60 * 1000);
const pinRateLimiter = createLoginRateLimiter(5, 15 * 60 * 1000);

function extractToken(req: express.Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [k, ...rest] = part.trim().split("=");
      if (k === "ego_session") {
        return decodeURIComponent(rest.join("="));
      }
    }
  }
  return undefined;
}

function isHttpsRequest(req: express.Request): boolean {
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  return req.secure || forwardedProto === "https";
}

function setSessionCookie(req: express.Request, res: express.Response, token: string): void {
  const https = isHttpsRequest(req);
  res.cookie("ego_session", token, {
    httpOnly: true,
    secure: https,
    sameSite: https ? "none" : "lax",
    partitioned: https,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(req: express.Request, res: express.Response): void {
  const https = isHttpsRequest(req);
  res.clearCookie("ego_session", {
    httpOnly: true,
    secure: https,
    sameSite: https ? "none" : "lax",
    partitioned: https,
    path: "/",
  });
}

function verifyMutationOrigin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }
  // Requests carrying explicit custom header or Bearer header cannot be forged by plain cross-site forms
  if (req.headers["x-requested-with"] === "EGO-Vault-SPA" || req.headers.authorization?.startsWith("Bearer ")) {
    next();
    return;
  }
  const origin = req.headers.origin;
  const expectedHost = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "")
    .split(",")[0]
    .trim();
  if (origin && expectedHost) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === expectedHost) {
        next();
        return;
      }
    } catch {
      // Invalid origin URL
    }
  }
  res.status(403).json({ error: "Asal permintaan tidak diizinkan." });
}

async function requireOwner(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  const token = extractToken(req);
  const verified = await verifyOwnerToken(token);
  if (!verified) {
    res.status(401).json({ error: "Autentikasi Owner diperlukan." });
    return;
  }
  (req as express.Request & { ownerId: string }).ownerId = verified.ownerId;
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "6mb" }));
  app.use("/api", verifyMutationOrigin);

  app.get("/api/health", (_req, res) => {
    const supabaseConfigured = isServerSupabaseConfigured();
    res.json({
      ok: true,
      mode: supabaseConfigured ? "supabase" : "local",
      supabaseConfigured,
      timestamp: new Date().toISOString(),
    });
  });

  // =========================================================
  // AUTH ROUTES (SINGLE-OWNER GUARD)
  // =========================================================
  app.get("/api/auth/status", (req, res) => {
    const db = loadVault();
    const token = extractToken(req);
    const sessionOwnerId = validateSessionToken(token);
    const authenticated =
      Boolean(sessionOwnerId && db.owner && db.owner.id === sessionOwnerId);

    res.json({
      hasOwner: db.owner !== null,
      authenticated,
      hasPin: authenticated ? Boolean(db.owner?.pin_hash) : false,
      owner: authenticated && db.owner
        ? {
            id: db.owner.id,
            email: db.owner.email,
            full_name: db.owner.full_name,
            created_at: db.owner.created_at,
          }
        : null,
    });
  });

  app.post("/api/auth/register", (req, res) => {
    try {
      const db = loadVault();
      assertSingleOwnerAvailable(db);

      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const password = String(req.body?.password ?? "");
      const fullName = String(req.body?.full_name ?? "Owner Utama").trim() || "Owner Utama";

      if (!email || !OWNER_EMAIL_REGEX.test(email)) {
        res.status(400).json({ error: "Format email Owner tidak valid." });
        return;
      }
      if (fullName.length < 1 || fullName.length > 80) {
        res.status(400).json({ error: "Nama panggilan Owner wajib 1–80 karakter." });
        return;
      }
      if (password.length < 6 || password.length > 128) {
        res.status(400).json({ error: "Kata sandi wajib 6–128 karakter." });
        return;
      }

      const ownerId = crypto.randomUUID();
      db.owner = {
        id: ownerId,
        email,
        full_name: fullName,
        password_hash: hashPassword(password),
        created_at: new Date().toISOString(),
      };
      saveVault(db);

      const clientKey = req.ip || "local-owner";
      loginRateLimiter.reset(clientKey);
      const token = createSession(ownerId);
      setSessionCookie(req, res, token);
      res.status(201).json({
        token,
        owner: {
          id: db.owner.id,
          email: db.owner.email,
          full_name: db.owner.full_name,
          created_at: db.owner.created_at,
        },
      });
    } catch (err) {
      res.status(403).json({
        error: err instanceof Error ? err.message : "Registrasi Owner ditolak.",
      });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const clientKey = req.ip || "local-owner";
    const rateCheck = loginRateLimiter.check(clientKey);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: rateCheck.message,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      });
      return;
    }

    const db = loadVault();
    if (!db.owner) {
      res.status(404).json({
        error: "Belum ada akun Owner terdaftar. Silakan registrasi Owner perdana.",
      });
      return;
    }

    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (
      email !== db.owner.email ||
      !verifyPassword(password, db.owner.password_hash)
    ) {
      const failure = loginRateLimiter.recordFailure(clientKey);
      res.status(failure.allowed ? 401 : 429).json({
        error: failure.allowed
          ? `Email atau kata sandi Owner tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
          : failure.message,
        remainingAttempts: failure.remainingAttempts,
        retryAfterSeconds: failure.retryAfterSeconds,
      });
      return;
    }

    loginRateLimiter.reset(clientKey);
    const token = createSession(db.owner.id);
    setSessionCookie(req, res, token);
    res.json({
      token,
      owner: {
        id: db.owner.id,
        email: db.owner.email,
        full_name: db.owner.full_name,
        created_at: db.owner.created_at,
      },
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = extractToken(req);
    revokeSessionToken(token);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post("/api/auth/reset-owner", (req, res) => {
    try {
      const db = loadVault();
      if (!db.owner) {
        clearAllSessions();
        clearSessionCookie(req, res);
        loginRateLimiter.reset(req.ip || "local-owner");
        res.json({ ok: true, hasOwner: false });
        return;
      }

      validateResetOwnerConfirmation({
        confirmed: req.body?.confirmed === true,
        confirmation_text: String(req.body?.confirmation_text ?? ""),
      });

      const previousOwnerId = db.owner.id;
      const clientKey = req.ip || "local-owner";

      saveVault(createEmptyVault());
      clearAllSessions();
      clearSessionCookie(req, res);
      loginRateLimiter.reset(clientKey);
      passwordRateLimiter.reset(`${previousOwnerId}:${clientKey}`);
      pinRateLimiter.reset(`${previousOwnerId}:${clientKey}`);

      res.json({ ok: true, hasOwner: false });
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : "Gagal menghapus akun Owner lokal.",
      });
    }
  });

  app.patch("/api/auth/profile", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
        return;
      }

      const normalized = validateOwnerEmailUpdateInput({
        email: String(req.body?.email ?? ""),
        full_name: String(req.body?.full_name ?? ""),
        current_password: String(req.body?.current_password ?? ""),
      });

      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId) {
        res.status(404).json({ error: "Akun Owner tidak ditemukan." });
        return;
      }

      if (!verifyPassword(String(req.body?.current_password ?? ""), db.owner.password_hash)) {
        const failure = passwordRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed
            ? `Kata sandi saat ini tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
            : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
        return;
      }

      passwordRateLimiter.reset(clientKey);
      db.owner.email = normalized.email;
      db.owner.full_name = normalized.full_name;
      saveVault(db);

      res.json({
        ok: true,
        owner: {
          id: db.owner.id,
          email: db.owner.email,
          full_name: db.owner.full_name,
          created_at: db.owner.created_at,
        },
      });
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : "Gagal memperbarui identitas Owner.",
      });
    }
  });

  app.delete("/api/auth/owner", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
        return;
      }

      if (req.body?.confirmed !== true) {
        res.status(400).json({
          error: "Centang konfirmasi penghapusan akun Owner terlebih dahulu.",
        });
        return;
      }

      const currentPassword = String(req.body?.current_password ?? "");
      if (!currentPassword) {
        res.status(400).json({
          error: "Masukkan kata sandi Owner saat ini untuk verifikasi.",
        });
        return;
      }

      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId) {
        res.status(404).json({ error: "Akun Owner tidak ditemukan." });
        return;
      }

      if (!verifyPassword(currentPassword, db.owner.password_hash)) {
        const failure = passwordRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed
            ? `Kata sandi Owner tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
            : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
        return;
      }

      saveVault(createEmptyVault());
      clearAllSessions();
      clearSessionCookie(req, res);
      loginRateLimiter.reset(req.ip || "local-owner");
      passwordRateLimiter.reset(clientKey);
      pinRateLimiter.reset(clientKey);

      res.json({ ok: true, hasOwner: false });
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : "Gagal menghapus akun Owner.",
      });
    }
  });

  app.post("/api/auth/change-password", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
        return;
      }

      const currentPassword = String(req.body?.current_password ?? "");
      const newPassword = String(req.body?.new_password ?? "");
      validateChangePasswordInput({
        current_password: currentPassword,
        new_password: newPassword,
      });

      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId) {
        res.status(404).json({ error: "Akun Owner tidak ditemukan." });
        return;
      }

      if (!verifyPassword(currentPassword, db.owner.password_hash)) {
        const failure = passwordRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed
            ? `Kata sandi saat ini tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
            : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
        return;
      }

      passwordRateLimiter.reset(clientKey);
      db.owner.password_hash = hashPassword(newPassword);
      saveVault(db);

      const currentToken = extractToken(req);
      rotateSessionsForOwner(ownerId, currentToken);

      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal mengganti kata sandi.",
      });
    }
  });

  app.post("/api/auth/pin/setup", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
        return;
      }

      const currentPassword = String(req.body?.current_password ?? "");
      const pin = String(req.body?.pin ?? "").trim();
      validatePinFormat(pin);

      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId) {
        res.status(404).json({ error: "Akun Owner tidak ditemukan." });
        return;
      }

      if (!verifyPassword(currentPassword, db.owner.password_hash)) {
        const failure = passwordRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed
            ? `Kata sandi Owner tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
            : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
        return;
      }

      passwordRateLimiter.reset(clientKey);
      pinRateLimiter.reset(clientKey);
      db.owner.pin_hash = hashPassword(pin);
      saveVault(db);

      res.json({ ok: true, hasPin: true });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal mengaktifkan kunci PIN.",
      });
    }
  });

  app.post("/api/auth/pin/verify", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = pinRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
        return;
      }

      const pin = String(req.body?.pin ?? "").trim();
      validatePinFormat(pin);

      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId || !db.owner.pin_hash) {
        res.status(400).json({ error: "Kunci PIN belum diaktifkan untuk akun ini." });
        return;
      }

      if (!verifyPassword(pin, db.owner.pin_hash)) {
        const failure = pinRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed
            ? `PIN 6 digit tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
            : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
        return;
      }

      pinRateLimiter.reset(clientKey);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Verifikasi PIN gagal.",
      });
    }
  });

  app.post("/api/auth/pin/disable", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
        return;
      }

      const currentPassword = String(req.body?.current_password ?? "");
      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId) {
        res.status(404).json({ error: "Akun Owner tidak ditemukan." });
        return;
      }

      if (!verifyPassword(currentPassword, db.owner.password_hash)) {
        const failure = passwordRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed
            ? `Kata sandi Owner tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
            : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
        return;
      }

      passwordRateLimiter.reset(clientKey);
      pinRateLimiter.reset(clientKey);
      db.owner.pin_hash = null;
      saveVault(db);

      res.json({ ok: true, hasPin: false });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menonaktifkan kunci PIN.",
      });
    }
  });

  // =========================================================
  // VAULT DATA & MUTATION ROUTES (OWNER-ONLY)
  // =========================================================
  app.get("/api/vault/snapshot", requireOwner, (_req, res) => {
    const db = loadVault();
    const accountBalances = computeAccountBalances(db.accounts, db.transactions);
    res.json({
      accounts: accountBalances,
      transactions: [...db.transactions].sort((a, b) =>
        b.transaction_date === a.transaction_date
          ? b.created_at.localeCompare(a.created_at)
          : b.transaction_date.localeCompare(a.transaction_date)
      ),
      assets: [...db.assets].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      debts: [...db.debts].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      owner_commands: [...db.owner_commands].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      ),
      recurring_bills: [...(db.recurring_bills ?? [])].sort((a, b) =>
        a.next_due_date.localeCompare(b.next_due_date)
      ),
      savings_goals: [...(db.savings_goals ?? [])].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      ),
      preferences: db.preferences,
    });
  });

  app.post("/api/accounts", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const accountName = String(req.body?.account_name ?? "").trim();
      const accountType = String(req.body?.account_type ?? "") as Account["account_type"];
      const openingBalance = Number(req.body?.opening_balance ?? 0);

      validateAccountInput({
        account_name: accountName,
        account_type: accountType,
        opening_balance: openingBalance,
        owner_confirmed: ownerConfirmed,
      });

      const db = loadVault();
      const newAccount: Account = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        account_name: accountName,
        account_type: accountType,
        opening_balance: roundCurrency(openingBalance),
        currency: "IDR",
        is_active: true,
        created_at: new Date().toISOString(),
      };
      db.accounts.push(newAccount);
      saveVault(db);
      res.status(201).json(newAccount);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal membuat akun.",
      });
    }
  });

  app.patch("/api/accounts/:id/archive", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    if (typeof req.body?.is_active !== "boolean") {
      res.status(400).json({ error: "Status aktif akun wajib berupa boolean." });
      return;
    }
    const db = loadVault();
    const acc = db.accounts.find((a) => a.id === req.params.id && a.owner_id === ownerId);
    if (!acc) {
      res.status(404).json({ error: "Akun tidak ditemukan." });
      return;
    }
    acc.is_active = req.body.is_active;
    saveVault(db);
    res.json(acc);
  });

  app.post("/api/transactions", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const db = loadVault();

      const txType = req.body?.transaction_type as Transaction["transaction_type"];
      const sourceId = req.body?.source_account_id ? String(req.body.source_account_id) : null;
      const destId = req.body?.destination_account_id
        ? String(req.body.destination_account_id)
        : null;
      const amount = Number(req.body?.amount ?? 0);
      const txDate = String(req.body?.transaction_date ?? todayISO()).slice(0, 10);
      const category = req.body?.category ? String(req.body.category).trim() : null;
      const description = req.body?.description ? String(req.body.description).trim() : null;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const status: Transaction["status"] = ownerConfirmed ? "posted" : "pending";

      validateTransactionInvariants(
        {
          owner_id: ownerId,
          transaction_type: txType,
          source_account_id: sourceId,
          destination_account_id: destId,
          amount,
          status,
          owner_confirmed: ownerConfirmed,
        },
        db.accounts
      );

      const newTx: Transaction = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        transaction_type: txType,
        source_account_id: txType === "income" ? null : sourceId,
        destination_account_id: txType === "expense" ? null : destId,
        amount: roundCurrency(amount),
        transaction_date: txDate || todayISO(),
        category,
        description,
        status,
        owner_confirmed: ownerConfirmed,
        created_at: new Date().toISOString(),
      };

      db.transactions.unshift(newTx);
      saveVault(db);
      res.status(201).json(newTx);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal mencatat transaksi.",
      });
    }
  });

  app.patch("/api/transactions/:id/cancel", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const tx = db.transactions.find((t) => t.id === req.params.id && t.owner_id === ownerId);
    if (!tx) {
      res.status(404).json({ error: "Transaksi tidak ditemukan." });
      return;
    }
    if (tx.status === "cancelled") {
      res.status(400).json({ error: "Transaksi ini sudah dibatalkan sebelumnya." });
      return;
    }
    tx.status = "cancelled";
    saveVault(db);
    res.json(tx);
  });

  app.post("/api/assets", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const assetName = String(req.body?.asset_name ?? "").trim();
      const assetType = String(req.body?.asset_type ?? "lainnya") as Asset["asset_type"];
      const currentValue = Number(req.body?.current_value ?? 0);
      const rawQuantity =
        req.body?.quantity !== undefined && req.body?.quantity !== null && req.body?.quantity !== ""
          ? Number(req.body.quantity)
          : null;
      const unit = req.body?.unit ? String(req.body.unit).trim() : null;
      const notes = req.body?.notes ? String(req.body.notes).trim() : null;

      validateAssetInput({
        asset_name: assetName,
        asset_type: assetType,
        current_value: currentValue,
        quantity: rawQuantity,
        owner_confirmed: ownerConfirmed,
      });

      const db = loadVault();
      const asset: Asset = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        asset_name: assetName,
        asset_type: assetType,
        current_value: roundCurrency(currentValue),
        quantity: rawQuantity,
        unit,
        notes,
        created_at: new Date().toISOString(),
      };
      db.assets.unshift(asset);
      saveVault(db);
      res.status(201).json(asset);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal mencatat aset.",
      });
    }
  });

  app.patch("/api/assets/:id", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    if (req.body?.owner_confirmed !== true) {
      res.status(400).json({
        error: "Persetujuan eksplisit Owner wajib dicentang sebelum memperbarui nilai aset.",
      });
      return;
    }
    const currentValue = Number(req.body?.current_value ?? NaN);
    if (!Number.isFinite(currentValue) || currentValue < 0) {
      res.status(400).json({ error: "Nilai taksiran baru tidak valid." });
      return;
    }

    const db = loadVault();
    const asset = db.assets.find((a) => a.id === req.params.id && a.owner_id === ownerId);
    if (!asset) {
      res.status(404).json({ error: "Aset tidak ditemukan." });
      return;
    }
    asset.current_value = roundCurrency(currentValue);
    if (req.body?.notes !== undefined) {
      asset.notes = req.body.notes ? String(req.body.notes).trim() : null;
    }
    saveVault(db);
    res.json(asset);
  });

  app.post("/api/debts", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const creditor = String(req.body?.creditor ?? "").trim();
      const originalAmount = Number(req.body?.original_amount ?? 0);
      const outstandingBalance =
        req.body?.outstanding_balance !== undefined
          ? Number(req.body.outstanding_balance)
          : originalAmount;
      const dueDate = req.body?.due_date ? String(req.body.due_date).slice(0, 10) : null;
      const description = req.body?.description ? String(req.body.description).trim() : null;

      validateDebtInput({
        creditor,
        original_amount: originalAmount,
        outstanding_balance: outstandingBalance,
        owner_confirmed: ownerConfirmed,
      });

      const db = loadVault();
      const debt: Debt = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        creditor,
        original_amount: roundCurrency(originalAmount),
        outstanding_balance: roundCurrency(outstandingBalance),
        due_date: dueDate,
        status: outstandingBalance === 0 ? "paid" : "active",
        description,
        created_at: new Date().toISOString(),
      };
      db.debts.unshift(debt);
      saveVault(db);
      res.status(201).json(debt);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal mencatat utang.",
      });
    }
  });

  app.post("/api/debts/:id/pay", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const db = loadVault();
      const debt = db.debts.find((d) => d.id === req.params.id && d.owner_id === ownerId);
      if (!debt) {
        res.status(404).json({ error: "Data utang tidak ditemukan." });
        return;
      }

      const paymentAmount = Number(req.body?.amount ?? 0);
      const sourceAccountId = String(req.body?.source_account_id ?? "");
      const ownerConfirmed = req.body?.owner_confirmed === true;

      validateDebtPayment(debt, paymentAmount, sourceAccountId, ownerConfirmed);
      validateTransactionInvariants(
        {
          owner_id: ownerId,
          transaction_type: "expense",
          source_account_id: sourceAccountId,
          destination_account_id: null,
          amount: paymentAmount,
          status: "posted",
          owner_confirmed: ownerConfirmed,
        },
        db.accounts
      );

      const newBalance = roundCurrency(debt.outstanding_balance - paymentAmount);
      debt.outstanding_balance = Math.max(0, newBalance);
      if (debt.outstanding_balance === 0) {
        debt.status = "paid";
      }

      const tx: Transaction = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        transaction_type: "expense",
        source_account_id: sourceAccountId,
        destination_account_id: null,
        amount: roundCurrency(paymentAmount),
        transaction_date: todayISO(),
        category: "Utang & Cicilan",
        description: `Pembayaran utang ke ${debt.creditor}`,
        status: "posted",
        owner_confirmed: true,
        created_at: new Date().toISOString(),
      };

      db.transactions.unshift(tx);
      saveVault(db);
      res.json({ debt, transaction: tx });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal memproses pembayaran utang.",
      });
    }
  });

  // =========================================================
  // OWNER CONTROL QUEUE ROUTES (/owner)
  // =========================================================
  app.post("/api/commands", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const commandText = String(req.body?.command_text ?? "").trim();
    if (commandText.length < 1 || commandText.length > 500) {
      res.status(400).json({ error: "Perintah harus berisi 1–500 karakter." });
      return;
    }

    const db = loadVault();
    const rawDraft = req.body?.parsed_draft as ParsedCommandDraft | undefined;
    const parsedDraft: ParsedCommandDraft =
      rawDraft &&
      typeof rawDraft === "object" &&
      ["income", "expense", "transfer"].includes(rawDraft.transaction_type)
        ? {
            transaction_type: rawDraft.transaction_type,
            amount:
              typeof rawDraft.amount === "number" && Number.isFinite(rawDraft.amount) && rawDraft.amount > 0
                ? roundCurrency(rawDraft.amount)
                : null,
            category: String(rawDraft.category || "Lainnya").trim(),
            description: String(rawDraft.description || commandText).trim().slice(0, 140),
            source_account_id: rawDraft.source_account_id ? String(rawDraft.source_account_id) : null,
            destination_account_id: rawDraft.destination_account_id
              ? String(rawDraft.destination_account_id)
              : null,
            source_hint: rawDraft.source_hint ? String(rawDraft.source_hint) : null,
            destination_hint: rawDraft.destination_hint ? String(rawDraft.destination_hint) : null,
            transaction_date: /^\d{4}-\d{2}-\d{2}$/.test(String(rawDraft.transaction_date ?? ""))
              ? String(rawDraft.transaction_date)
              : todayISO(),
            confidence: ["high", "medium", "low"].includes(rawDraft.confidence)
              ? rawDraft.confidence
              : "medium",
            warnings: Array.isArray(rawDraft.warnings)
              ? rawDraft.warnings.map((w) => String(w))
              : [],
          }
        : parseNaturalCommand(commandText, db.accounts);

    const cmd: OwnerCommand = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      command_text: commandText,
      status: "pending",
      parsed_draft: parsedDraft,
      created_at: new Date().toISOString(),
    };
    db.owner_commands.unshift(cmd);
    saveVault(db);
    res.status(201).json(cmd);
  });

  app.post("/api/commands/:id/approve", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const db = loadVault();
      const cmd = db.owner_commands.find(
        (c) => c.id === req.params.id && c.owner_id === ownerId
      );
      if (!cmd) {
        res.status(404).json({ error: "Perintah tidak ditemukan." });
        return;
      }
      if (cmd.status !== "pending") {
        res.status(400).json({ error: "Perintah ini sudah diproses sebelumnya." });
        return;
      }
      if (req.body?.owner_confirmed !== true) {
        res.status(400).json({
          error:
            "Prinsip Brankas Mutlak: Persetujuan eksplisit Owner wajib dicentang sebelum mengeksekusi draf.",
        });
        return;
      }

      const override = req.body?.draft ?? cmd.parsed_draft;
      if (!override) {
        res.status(400).json({ error: "Draf transaksi tidak tersedia." });
        return;
      }

      const txType = override.transaction_type as Transaction["transaction_type"];
      const amount = Number(override.amount ?? 0);
      const sourceId = override.source_account_id ? String(override.source_account_id) : null;
      const destId = override.destination_account_id
        ? String(override.destination_account_id)
        : null;
      const txDate = String(override.transaction_date ?? todayISO()).slice(0, 10);
      const category = String(override.category ?? "Lainnya").trim();
      const description = String(override.description ?? cmd.command_text).trim();

      validateTransactionInvariants(
        {
          owner_id: ownerId,
          transaction_type: txType,
          source_account_id: sourceId,
          destination_account_id: destId,
          amount,
          status: "posted",
          owner_confirmed: true,
        },
        db.accounts
      );

      const tx: Transaction = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        transaction_type: txType,
        source_account_id: txType === "income" ? null : sourceId,
        destination_account_id: txType === "expense" ? null : destId,
        amount: roundCurrency(amount),
        transaction_date: txDate || todayISO(),
        category,
        description,
        status: "posted",
        owner_confirmed: true,
        created_at: new Date().toISOString(),
      };

      cmd.status = "processed";
      cmd.parsed_draft = {
        ...(cmd.parsed_draft ?? override),
        transaction_type: txType,
        amount: roundCurrency(amount),
        source_account_id: tx.source_account_id,
        destination_account_id: tx.destination_account_id,
        category,
        description,
        transaction_date: tx.transaction_date,
      };
      db.transactions.unshift(tx);
      saveVault(db);

      res.json({ command: cmd, transaction: tx });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menyetujui perintah.",
      });
    }
  });

  app.post("/api/commands/:id/reject", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const cmd = db.owner_commands.find(
      (c) => c.id === req.params.id && c.owner_id === ownerId
    );
    if (!cmd) {
      res.status(404).json({ error: "Perintah tidak ditemukan." });
      return;
    }
    if (cmd.status !== "pending") {
      res.status(400).json({ error: "Perintah ini sudah diproses sebelumnya." });
      return;
    }
    cmd.status = "rejected";
    saveVault(db);
    res.json({ command: cmd });
  });

  // =========================================================
  // SETTINGS & PREFERENCES
  // =========================================================
  app.patch("/api/preferences", requireOwner, (req, res) => {
    const db = loadVault();
    const dateFormat = req.body?.date_format as OwnerPreferences["date_format"] | undefined;
    const expenseLimit = req.body?.expense_alert_limit;

    if (dateFormat !== undefined) {
      if (!["DD/MM/YYYY", "YYYY-MM-DD", "DD MMM YYYY"].includes(dateFormat)) {
        res.status(400).json({ error: "Format tanggal tidak valid." });
        return;
      }
      db.preferences.date_format = dateFormat;
    }
    if (expenseLimit !== undefined) {
      const parsed = Number(expenseLimit);
      if (!Number.isFinite(parsed) || parsed < 0) {
        res.status(400).json({ error: "Batas peringatan pengeluaran harus >= Rp 0." });
        return;
      }
      db.preferences.expense_alert_limit = roundCurrency(parsed);
    }
    saveVault(db);
    res.json(db.preferences);
  });

  // =========================================================
  // GEMINI SERVER ROUTES (SEARCH GROUNDING & TTS)
  // =========================================================
  app.post("/api/ai/search", requireOwner, async (req, res) => {
    try {
      const query = String(req.body?.query ?? "").trim();
      if (!query) {
        res.status(400).json({ error: "Pertanyaan riset keuangan wajib diisi." });
        return;
      }
      const result = await runFinancialSearch(query);
      res.json(result);
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.statusCode).json({
        error: classified.message,
        code: classified.code,
      });
    }
  });

  app.post("/api/ai/tts", requireOwner, async (req, res) => {
    try {
      const text = String(req.body?.text ?? "").trim();
      if (!text) {
        res.status(400).json({ error: "Teks untuk dibacakan tidak boleh kosong." });
        return;
      }
      const style = req.body?.style ? String(req.body.style) : undefined;
      const result = await synthesizeIndonesianTTS(text, style);
      res.json(result);
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.statusCode).json({
        error: classified.message,
        code: classified.code,
      });
    }
  });

  app.post("/api/ai/scan-receipt", requireOwner, async (req, res) => {
    try {
      const imageBase64 = String(req.body?.imageBase64 ?? "");
      const mimeType = String(req.body?.mimeType ?? "image/jpeg");
      if (!imageBase64.trim()) {
        res.status(400).json({ error: "Foto struk wajib diunggah sebelum dianalisis." });
        return;
      }

      const providedAccounts = Array.isArray(req.body?.accounts)
        ? (req.body.accounts as Account[])
        : null;
      let accounts = providedAccounts ?? [];
      if (accounts.length === 0) {
        const token = extractToken(req);
        const authedSupabase = token ? createAuthedSupabaseClient(token) : null;
        if (authedSupabase) {
          const { data } = await authedSupabase.from("accounts").select("*");
          accounts = (data ?? []) as Account[];
        }
        if (accounts.length === 0) {
          accounts = loadVault().accounts;
        }
      }

      const result = await scanReceiptToDraft(imageBase64, mimeType, accounts);
      res.json(result);
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.statusCode).json({
        error: classified.message,
        code: classified.code,
      });
    }
  });

  // =========================================================
  // RECURRING BILLS & REMINDERS ROUTES (/rencana)
  // =========================================================
  app.post("/api/recurring", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const title = String(req.body?.title ?? "").trim();
      const txType = String(req.body?.transaction_type ?? "expense") as "income" | "expense";
      const amount = Number(req.body?.amount ?? 0);
      const category = String(req.body?.category ?? "Utilitas & Tagihan").trim() || "Utilitas & Tagihan";
      const accountId = req.body?.account_id ? String(req.body.account_id) : null;
      const frequency = String(req.body?.frequency ?? "monthly") as RecurringBill["frequency"];
      const nextDueDate = String(req.body?.next_due_date ?? todayISO()).slice(0, 10);
      const notes = req.body?.notes ? String(req.body.notes).trim() : null;
      const ownerConfirmed = req.body?.owner_confirmed === true;

      validateRecurringBillInput({
        title,
        transaction_type: txType,
        amount,
        frequency,
        next_due_date: nextDueDate,
        owner_confirmed: ownerConfirmed,
      });

      const db = loadVault();
      const bill: RecurringBill = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        title,
        transaction_type: txType,
        amount: roundCurrency(amount),
        category,
        account_id: accountId,
        frequency,
        next_due_date: nextDueDate,
        last_queued_date: null,
        is_active: true,
        notes,
        created_at: new Date().toISOString(),
      };
      db.recurring_bills.push(bill);
      saveVault(db);
      res.status(201).json(bill);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menyimpan jadwal rutin.",
      });
    }
  });

  app.patch("/api/recurring/:id", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const bill = db.recurring_bills.find(
      (b) => b.id === req.params.id && b.owner_id === ownerId
    );
    if (!bill) {
      res.status(404).json({ error: "Jadwal rutin tidak ditemukan." });
      return;
    }
    if (req.body?.is_active !== undefined) {
      bill.is_active = Boolean(req.body.is_active);
    }
    saveVault(db);
    res.json(bill);
  });

  app.post("/api/recurring/:id/queue", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const bill = db.recurring_bills.find(
      (b) => b.id === req.params.id && b.owner_id === ownerId
    );
    if (!bill) {
      res.status(404).json({ error: "Jadwal rutin tidak ditemukan." });
      return;
    }

    const accountExists =
      bill.account_id !== null &&
      db.accounts.some((a) => a.id === bill.account_id && a.owner_id === ownerId);
    const resolvedAccountId = accountExists ? bill.account_id : null;

    const warnings: string[] = [];
    if (!resolvedAccountId) {
      warnings.push(
        bill.transaction_type === "income"
          ? "Pilih akun tujuan pemasukan sebelum menyetujui."
          : "Pilih akun sumber dana sebelum menyetujui."
      );
    }

    const draft: ParsedCommandDraft = {
      transaction_type: bill.transaction_type,
      amount: bill.amount,
      category: bill.category,
      description: `${bill.title} (Tagihan Rutin ${bill.next_due_date})`,
      source_account_id: bill.transaction_type === "expense" ? resolvedAccountId : null,
      destination_account_id: bill.transaction_type === "income" ? resolvedAccountId : null,
      source_hint: null,
      destination_hint: null,
      transaction_date: todayISO(),
      confidence: resolvedAccountId ? "high" : "medium",
      warnings,
    };

    const cmd: OwnerCommand = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      command_text: `[Tagihan Rutin] ${bill.title} · Rp ${bill.amount.toLocaleString("id-ID")} (Jatuh tempo ${bill.next_due_date})`,
      status: "pending",
      parsed_draft: draft,
      created_at: new Date().toISOString(),
    };

    // Vault invariant: only insert pending OwnerCommand; never mutate balances here
    db.owner_commands.unshift(cmd);
    bill.last_queued_date = bill.next_due_date;
    bill.next_due_date = advanceDueDate(bill.next_due_date, bill.frequency);
    saveVault(db);

    res.status(201).json({ command: cmd, bill });
  });

  app.delete("/api/recurring/:id", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const before = db.recurring_bills.length;
    db.recurring_bills = db.recurring_bills.filter(
      (b) => !(b.id === req.params.id && b.owner_id === ownerId)
    );
    if (db.recurring_bills.length === before) {
      res.status(404).json({ error: "Jadwal rutin tidak ditemukan." });
      return;
    }
    saveVault(db);
    res.json({ ok: true });
  });

  // =========================================================
  // SAVINGS GOALS & EMERGENCY FUND ROUTES (/rencana)
  // =========================================================
  app.post("/api/goals", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const title = String(req.body?.title ?? "").trim();
      const goalType = String(req.body?.goal_type ?? "savings_target") as SavingsGoal["goal_type"];
      const targetAmount = Number(req.body?.target_amount ?? 0);
      const currentAmount = Number(req.body?.current_amount ?? 0);
      const linkedAccountId = req.body?.linked_account_id
        ? String(req.body.linked_account_id)
        : null;
      const targetDate = req.body?.target_date ? String(req.body.target_date).slice(0, 10) : null;
      const notes = req.body?.notes ? String(req.body.notes).trim() : null;
      const ownerConfirmed = req.body?.owner_confirmed === true;

      validateSavingsGoalInput({
        title,
        goal_type: goalType,
        target_amount: targetAmount,
        current_amount: currentAmount,
        owner_confirmed: ownerConfirmed,
      });

      const db = loadVault();
      const goal: SavingsGoal = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        title,
        goal_type: goalType,
        target_amount: roundCurrency(targetAmount),
        current_amount: linkedAccountId ? 0 : roundCurrency(currentAmount),
        linked_account_id: linkedAccountId,
        target_date: targetDate,
        status:
          !linkedAccountId && currentAmount >= targetAmount ? "completed" : "active",
        notes,
        created_at: new Date().toISOString(),
      };
      db.savings_goals.unshift(goal);
      saveVault(db);
      res.status(201).json(goal);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menyimpan target tabungan.",
      });
    }
  });

  app.patch("/api/goals/:id", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const goal = db.savings_goals.find(
      (g) => g.id === req.params.id && g.owner_id === ownerId
    );
    if (!goal) {
      res.status(404).json({ error: "Target tabungan tidak ditemukan." });
      return;
    }

    if (req.body?.current_amount !== undefined) {
      if (req.body?.owner_confirmed !== true) {
        res.status(400).json({
          error: "Persetujuan eksplisit Owner wajib dicentang saat mengubah progres dana.",
        });
        return;
      }
      const nextAmount = Number(req.body.current_amount);
      if (!Number.isFinite(nextAmount) || nextAmount < 0) {
        res.status(400).json({ error: "Nominal progres tabungan harus >= Rp 0." });
        return;
      }
      goal.current_amount = roundCurrency(nextAmount);
      if (goal.current_amount >= goal.target_amount) {
        goal.status = "completed";
      }
    }

    if (req.body?.status === "active" || req.body?.status === "completed") {
      goal.status = req.body.status;
    }

    saveVault(db);
    res.json(goal);
  });

  app.delete("/api/goals/:id", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const before = db.savings_goals.length;
    db.savings_goals = db.savings_goals.filter(
      (g) => !(g.id === req.params.id && g.owner_id === ownerId)
    );
    if (db.savings_goals.length === before) {
      res.status(404).json({ error: "Target tabungan tidak ditemukan." });
      return;
    }
    saveVault(db);
    res.json({ ok: true });
  });

  // =========================================================
  // HTTP + WEBSOCKET + VITE MIDDLEWARE / STATIC DIST
  // =========================================================
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  const distDir = path.resolve(process.cwd(), "dist");
  const isProd = process.env.NODE_ENV === "production" && fs.existsSync(distDir);

  httpServer.on("upgrade", (req, socket, head) => {
    try {
      const host = req.headers.host || `127.0.0.1:${PORT}`;
      const url = new URL(req.url ?? "/", `http://${host}`);
      if (url.pathname === "/ws/live") {
        wss.handleUpgrade(req, socket, head, (ws) => {
          const tokenFromQuery = url.searchParams.get("token") ?? undefined;
          let tokenFromCookie: string | undefined;
          const cookieHeader = req.headers.cookie;
          if (cookieHeader) {
            for (const part of cookieHeader.split(";")) {
              const [k, ...rest] = part.trim().split("=");
              if (k === "ego_session") {
                tokenFromCookie = decodeURIComponent(rest.join("="));
              }
            }
          }
          void attachLiveVoiceSession(ws, tokenFromQuery || tokenFromCookie);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  let viteServer: { close: () => Promise<void> } | null = null;

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const hmrDisabled = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: "spa",
    });
    viteServer = vite;
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  const shutdown = () => {
    wss.close();
    httpServer.close(() => {
      if (viteServer) {
        void viteServer.close().finally(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`EGO Personal AI berjalan pada http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Gagal menjalankan server EGO Personal AI:", err);
  process.exit(1);
});
```

---

## 11. `server/loadEnv.ts` (27 lines)

```ts
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export function isPlaceholderEnvValue(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return !trimmed || trimmed === "Xzx1@2@3xzX" || trimmed.startsWith("MY_");
}

export function hydrateEnvFromDotEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  try {
    const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
    for (const [key, val] of Object.entries(parsed)) {
      if (isPlaceholderEnvValue(process.env[key]) && !isPlaceholderEnvValue(val)) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore malformed .env
  }
}

hydrateEnvFromDotEnv();
```

---

## 12. `server/authVerify.ts` (105 lines)

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadVault, validateSessionToken } from "./vaultStore";

let cachedSupabaseVerifier: SupabaseClient | null | undefined;

function normalizeSupabaseUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url || url.startsWith("MY_")) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function getSupabaseCredentials(): { url: string; key: string } | null {
  const url = normalizeSupabaseUrl(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ""
  );
  const key = (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();

  if (!url || !key || key === "Xzx1@2@3xzX" || key.startsWith("MY_")) {
    return null;
  }
  return { url, key };
}

export function isServerSupabaseConfigured(): boolean {
  return getSupabaseCredentials() !== null;
}

function getSupabaseVerifier(): SupabaseClient | null {
  if (cachedSupabaseVerifier !== undefined) {
    return cachedSupabaseVerifier;
  }
  const creds = getSupabaseCredentials();
  if (!creds) {
    cachedSupabaseVerifier = null;
    return null;
  }

  cachedSupabaseVerifier = createClient(creds.url, creds.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedSupabaseVerifier;
}

export function createAuthedSupabaseClient(token: string): SupabaseClient | null {
  const cleanToken = token.trim();
  if (!cleanToken) return null;
  const creds = getSupabaseCredentials();
  if (!creds) return null;

  return createClient(creds.url, creds.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
      },
    },
  });
}

export async function verifyOwnerToken(
  token: string | undefined
): Promise<{ ownerId: string; mode: "supabase" | "local" } | null> {
  if (!token) return null;

  const supabaseVerifier = getSupabaseVerifier();
  if (supabaseVerifier) {
    try {
      const { data, error } = await supabaseVerifier.auth.getUser(token);
      if (!error && data.user?.id) {
        return { ownerId: data.user.id, mode: "supabase" };
      }
    } catch {
      // Fall through to local check if token is a local session token
    }
  }

  const localOwnerId = validateSessionToken(token);
  const db = loadVault();
  if (localOwnerId && db.owner && db.owner.id === localOwnerId) {
    return { ownerId: localOwnerId, mode: "local" };
  }
  return null;
}
```

---

## 13. `server/vaultRules.ts` (251 lines)

```ts
import {
  OWNER_EMAIL_REGEX,
  validateAccountInput,
  validateAssetInput,
  validateDebtInput,
  validateDebtPaymentInput,
  validateRecurringBillInput,
  validateSavingsGoalInput,
  validateTransactionPayload,
} from "../src/lib/vault-validation";
import type {
  Account,
  Asset,
  Debt,
  OwnerCommand,
  OwnerPreferences,
  OwnerUser,
  RecurringBill,
  SavingsGoal,
  Transaction,
} from "../src/types/ego";

export {
  OWNER_EMAIL_REGEX,
  validateAccountInput,
  validateAssetInput,
  validateDebtInput,
  validateRecurringBillInput,
  validateSavingsGoalInput,
};

export interface StoredOwner extends OwnerUser {
  password_hash: string;
  pin_hash?: string | null;
}

export interface VaultDatabase {
  owner: StoredOwner | null;
  preferences: OwnerPreferences;
  accounts: Account[];
  transactions: Transaction[];
  assets: Asset[];
  debts: Debt[];
  owner_commands: OwnerCommand[];
  recurring_bills: RecurringBill[];
  savings_goals: SavingsGoal[];
}

export const DEFAULT_PREFERENCES: OwnerPreferences = {
  date_format: "DD MMM YYYY",
  expense_alert_limit: 5_000_000,
};

export function createEmptyVault(): VaultDatabase {
  return {
    owner: null,
    preferences: { ...DEFAULT_PREFERENCES },
    accounts: [],
    transactions: [],
    assets: [],
    debts: [],
    owner_commands: [],
    recurring_bills: [],
    savings_goals: [],
  };
}

export function assertSingleOwnerAvailable(db: VaultDatabase): void {
  if (db.owner !== null) {
    throw new Error(
      "Sistem Single-Owner: Akun Owner sudah terdaftar. Pendaftaran kedua ditolak."
    );
  }
}

export interface ValidateTransactionInput {
  owner_id: string;
  transaction_type: Transaction["transaction_type"];
  source_account_id: string | null;
  destination_account_id: string | null;
  amount: number;
  status: Transaction["status"];
  owner_confirmed: boolean;
}

export function validateTransactionInvariants(
  input: ValidateTransactionInput,
  accounts: Account[]
): void {
  validateTransactionPayload(input);

  const ownsAccount = (id: string | null) =>
    id !== null && accounts.some((a) => a.id === id && a.owner_id === input.owner_id);

  if (input.transaction_type === "income") {
    if (!input.destination_account_id || !ownsAccount(input.destination_account_id)) {
      throw new Error("Pemasukan wajib memilih akun tujuan yang valid milik Owner.");
    }
  } else if (input.transaction_type === "expense") {
    if (!input.source_account_id || !ownsAccount(input.source_account_id)) {
      throw new Error("Pengeluaran wajib memilih akun sumber yang valid milik Owner.");
    }
  } else if (input.transaction_type === "transfer") {
    if (
      !input.source_account_id ||
      !input.destination_account_id ||
      !ownsAccount(input.source_account_id) ||
      !ownsAccount(input.destination_account_id)
    ) {
      throw new Error("Transfer wajib memilih akun sumber dan akun tujuan yang valid.");
    }
  }
}

export function validateDebtPayment(
  debt: Debt,
  paymentAmount: number,
  sourceAccountId: string,
  ownerConfirmed: boolean
): void {
  validateDebtPaymentInput(debt, paymentAmount, sourceAccountId, ownerConfirmed);
}

export interface LoginRateCheckResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
  message?: string;
}

export interface LoginRateLimiter {
  check: (key: string, nowMs?: number) => LoginRateCheckResult;
  recordFailure: (key: string, nowMs?: number) => LoginRateCheckResult;
  reset: (key: string) => void;
}

export function createLoginRateLimiter(
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000
): LoginRateLimiter {
  const attempts = new Map<string, { count: number; windowStart: number }>();

  function getActiveEntry(key: string, nowMs: number) {
    const entry = attempts.get(key);
    if (!entry) return null;
    if (nowMs - entry.windowStart >= windowMs) {
      attempts.delete(key);
      return null;
    }
    return entry;
  }

  return {
    check(key: string, nowMs = Date.now()): LoginRateCheckResult {
      const entry = getActiveEntry(key, nowMs);
      if (!entry || entry.count < maxAttempts) {
        return {
          allowed: true,
          remainingAttempts: maxAttempts - (entry?.count ?? 0),
          retryAfterSeconds: 0,
        };
      }
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.windowStart + windowMs - nowMs) / 1000)
      );
      const waitMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds,
        message: `Terlalu banyak percobaan masuk gagal. Demi keamanan brankas, silakan tunggu sekitar ${waitMinutes} menit sebelum mencoba lagi.`,
      };
    },

    recordFailure(key: string, nowMs = Date.now()): LoginRateCheckResult {
      const existing = getActiveEntry(key, nowMs);
      const next = existing
        ? { count: existing.count + 1, windowStart: existing.windowStart }
        : { count: 1, windowStart: nowMs };
      attempts.set(key, next);
      return this.check(key, nowMs);
    },

    reset(key: string): void {
      attempts.delete(key);
    },
  };
}

// Recurring bill and savings goal validators are re-exported from src/lib/vault-validation.ts

export function validateChangePasswordInput(input: {
  current_password: string;
  new_password: string;
}): void {
  if (!input.current_password) {
    throw new Error("Kata sandi saat ini wajib diisi.");
  }
  if (!input.new_password || input.new_password.length < 6) {
    throw new Error("Kata sandi baru minimal 6 karakter.");
  }
  if (input.new_password.length > 128) {
    throw new Error("Kata sandi baru maksimal 128 karakter.");
  }
  if (input.new_password === input.current_password) {
    throw new Error("Kata sandi baru harus berbeda dari kata sandi saat ini.");
  }
}

export function validatePinFormat(pin: string): void {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("PIN cepat wajib terdiri dari tepat 6 digit angka.");
  }
}

export function validateOwnerEmailUpdateInput(input: {
  email: string;
  full_name: string;
  current_password: string;
}): { email: string; full_name: string } {
  const email = input.email.trim().toLowerCase();
  const fullName = input.full_name.trim();

  if (!email || !OWNER_EMAIL_REGEX.test(email)) {
    throw new Error("Format email Owner tidak valid.");
  }
  if (fullName.length < 1 || fullName.length > 80) {
    throw new Error("Nama panggilan Owner wajib 1–80 karakter.");
  }
  if (!input.current_password) {
    throw new Error("Kata sandi saat ini wajib diisi untuk mengubah email Owner.");
  }
  return { email, full_name: fullName };
}

export function validateResetOwnerConfirmation(input: {
  confirmed: boolean;
  confirmation_text: string;
}): void {
  if (!input.confirmed) {
    throw new Error(
      "Centang persetujuan bahwa seluruh data brankas lokal akan dikosongkan."
    );
  }
  if (input.confirmation_text.trim().toUpperCase() !== "HAPUS") {
    throw new Error('Ketik kata "HAPUS" untuk mengonfirmasi penghapusan akun Owner.');
  }
}

```

---

## 14. `server/vaultStore.ts` (113 lines)

```ts
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  createEmptyVault,
  type VaultDatabase,
} from "./vaultRules";

const DATA_DIR = path.resolve(process.cwd(), "data");
const VAULT_FILE = path.join(DATA_DIR, "ego-vault.json");

export function loadVault(): VaultDatabase {
  if (!fs.existsSync(VAULT_FILE)) {
    return createEmptyVault();
  }
  try {
    const raw = fs.readFileSync(VAULT_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<VaultDatabase>;
    return {
      ...createEmptyVault(),
      ...parsed,
      preferences: {
        ...createEmptyVault().preferences,
        ...(parsed.preferences ?? {}),
      },
    };
  } catch {
    return createEmptyVault();
  }
}

export function saveVault(db: VaultDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${VAULT_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmpFile, VAULT_FILE);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHex] = storedHash.split(":");
  if (!salt || !originalHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, "hex");
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

// In-memory session map persisted in a lightweight sessions file so dev restarts keep sessions valid
const SESSIONS_FILE = path.join(DATA_DIR, "ego-sessions.json");

interface SessionRecord {
  token: string;
  owner_id: string;
  created_at: string;
}

function loadSessions(): SessionRecord[] {
  if (!fs.existsSync(SESSIONS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8")) as SessionRecord[];
  } catch {
    return [];
  }
}

function saveSessions(sessions: SessionRecord[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf8");
}

export function createSession(ownerId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const sessions = loadSessions().filter((s) => s.owner_id === ownerId).slice(-4);
  sessions.push({ token, owner_id: ownerId, created_at: new Date().toISOString() });
  saveSessions(sessions);
  return token;
}

export function validateSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const sessions = loadSessions();
  const found = sessions.find((s) => s.token === token);
  return found ? found.owner_id : null;
}

export function revokeSessionToken(token: string | undefined): void {
  if (!token) return;
  const sessions = loadSessions().filter((s) => s.token !== token);
  saveSessions(sessions);
}

export function rotateSessionsForOwner(ownerId: string, keepToken?: string): void {
  const sessions = loadSessions().filter(
    (s) => s.owner_id !== ownerId || (keepToken !== undefined && s.token === keepToken)
  );
  saveSessions(sessions);
}

export function clearAllSessions(): void {
  saveSessions([]);
}

```

---

## 15. `server/gemini.ts` (714 lines)

```ts
import {
  FunctionDeclaration,
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Type,
} from "@google/genai";
import type { WebSocket } from "ws";
import { findBestAccountMatch, parseNaturalCommand } from "../src/lib/command-parser";
import { todayISO } from "../src/lib/finance";
import type {
  Account,
  OwnerCommand,
  ParsedCommandDraft,
  SearchSource,
} from "../src/types/ego";
import { createAuthedSupabaseClient, verifyOwnerToken } from "./authVerify";
import { isPlaceholderEnvValue } from "./loadEnv";
import { loadVault, saveVault } from "./vaultStore";

export type GeminiErrorCode = "QUOTA_EXCEEDED" | "AUTH_ERROR" | "MODEL_NOT_FOUND" | "AI_ERROR";

export class GeminiApiError extends Error {
  statusCode: number;
  code: GeminiErrorCode;

  constructor(message: string, statusCode = 500, code: GeminiErrorCode = "AI_ERROR") {
    super(message);
    this.name = "GeminiApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function classifyGeminiError(err: unknown): GeminiApiError {
  if (err instanceof GeminiApiError) return err;

  const rawMsg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : JSON.stringify(err ?? "");

  const numericStatus =
    typeof err === "object" && err !== null && "status" in err
      ? Number((err as { status?: unknown }).status)
      : NaN;

  const lower = rawMsg.toLowerCase();

  if (
    numericStatus === 429 ||
    lower.includes("resource_exhausted") ||
    lower.includes("exceeded your current quota") ||
    lower.includes("\"code\":429") ||
    lower.includes("rate limit")
  ) {
    return new GeminiApiError(
      "Kuota atau batas permintaan Gemini API saat ini telah penuh. Anda tetap dapat memakai alternatif lokal di layar ini, menunggu reset kuota, atau memeriksa paket billing di Google AI Studio.",
      429,
      "QUOTA_EXCEEDED"
    );
  }

  if (
    numericStatus === 403 ||
    numericStatus === 401 ||
    lower.includes("permission_denied") ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid")
  ) {
    return new GeminiApiError(
      "Kunci Gemini API tidak valid atau tidak memiliki izin akses. Periksa pengaturan GEMINI_API_KEY di panel Secrets.",
      numericStatus === 400 || lower.includes("api_key_invalid") ? 400 : 403,
      "AUTH_ERROR"
    );
  }

  if (numericStatus === 404 || lower.includes("not_found")) {
    return new GeminiApiError(
      "Model Gemini yang diminta tidak tersedia untuk proyek ini.",
      404,
      "MODEL_NOT_FOUND"
    );
  }

  if (rawMsg.startsWith("{") && rawMsg.includes("\"error\"")) {
    return new GeminiApiError(
      "Layanan Gemini AI sedang mengalami gangguan sementara. Silakan coba lagi atau gunakan mode alternatif lokal.",
      502,
      "AI_ERROR"
    );
  }

  return new GeminiApiError(
    rawMsg || "Terjadi gangguan saat menghubungi layanan Gemini AI.",
    500,
    "AI_ERROR"
  );
}

export async function withGeminiRetryAndFallback<T>(
  models: string[],
  runner: (model: string) => Promise<T>,
  retryDelayMs = 850
): Promise<T> {
  let lastError: GeminiApiError | null = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await runner(model);
      } catch (err) {
        const classified = classifyGeminiError(err);
        lastError = classified;

        if (classified.code === "AUTH_ERROR") {
          throw classified;
        }

        const isRetryable =
          classified.code === "QUOTA_EXCEEDED" || classified.statusCode >= 500;

        if (attempt === 0 && isRetryable && retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }
        break;
      }
    }
  }

  throw lastError ?? new GeminiApiError("Gagal memproses permintaan Gemini AI.", 500, "AI_ERROR");
}

function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || isPlaceholderEnvValue(apiKey)) {
    throw new GeminiApiError(
      "GEMINI_API_KEY belum tersedia di environment server. Silakan periksa panel Secrets.",
      403,
      "AUTH_ERROR"
    );
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const searchCache = new Map<
  string,
  { expiresAt: number; result: { answer: string; sources: SearchSource[] } }
>();
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

export async function runFinancialSearch(query: string): Promise<{
  answer: string;
  sources: SearchSource[];
}> {
  const cacheKey = query.trim().toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const ai = getAIClient();
  const response = await withGeminiRetryAndFallback(
    ["gemini-4-hydrogen", "gemini-3.1-flash-lite"],
    (model) =>
      ai.models.generateContent({
        model,
        contents: query,
        config: {
          systemInstruction:
            "Anda adalah EGO Personal AI, asisten riset keuangan pribadi berbahasa Indonesia formal dan ringkas. Gunakan hasil pencarian Google Search terkini untuk memberikan data akurat (kurs mata uang, harga emas Antam, suku bunga BI, inflasi, atau berita ekonomi). Sertakan tanggal/konteks waktu bila tersedia. Jangan mengarang angka.",
          tools: [{ googleSearch: {} }],
        },
      })
  );

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources: SearchSource[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    const title = chunk.web?.title;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({
        uri,
        title: title || uri,
      });
    }
  }

  const result = {
    answer: response.text ?? "Tidak ada ringkasan yang dapat ditampilkan.",
    sources,
  };
  searchCache.set(cacheKey, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    result,
  });
  return result;
}

export async function scanReceiptToDraft(
  imageBase64: string,
  mimeType: string,
  accounts: Account[]
): Promise<{
  commandText: string;
  draft: ParsedCommandDraft;
  merchant: string;
}> {
  const ai = getAIClient();
  const allowedMimes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
  const safeMime = allowedMimes.has(mimeType) ? mimeType : "image/jpeg";
  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "").trim();
  if (!cleanBase64) {
    throw new Error("Data gambar struk tidak valid atau kosong.");
  }

  const activeAccountNames = accounts
    .filter((a) => a.is_active)
    .map((a) => `${a.account_name} (${a.account_type})`)
    .join(", ");

  const today = todayISO();

  const response = await withGeminiRetryAndFallback(
    ["gemini-4-hydrogen", "gemini-3.1-flash-lite"],
    (model) =>
      ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: safeMime,
                  data: cleanBase64,
                },
              },
              {
                text: `Analisis foto struk/nota/bukti transfer Indonesia ini dan ekstrak rincian transaksi utamanya. Tanggal hari ini adalah ${today}. Akun aktif milik Owner: ${activeAccountNames || "belum ada akun"}. Pastikan nominal menggunakan angka bulat Rupiah (tanpa pemisah ribuan), tanggal dalam format YYYY-MM-DD, dan isi warning jika ada bagian struk yang buram atau metode bayar tidak tertulis.`,
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            "Anda adalah ekstraktor struk transaksi keuangan pribadi Indonesia. Keluarkan JSON terstruktur yang akurat dari foto struk belanja, nota restoran, tagihan listrik/internet, atau bukti transfer bank/QRIS. Pilih kategori yang paling tepat: Makanan & Minuman, Transportasi, Utilitas & Tagihan, Belanja, Investasi & Aset, Kesehatan, Hiburan, Utang & Cicilan, Transfer Internal, Gaji & Pendapatan, atau Pengeluaran Lainnya.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transaction_type: {
                type: Type.STRING,
                enum: ["expense", "income", "transfer"],
              },
              amount: {
                type: Type.NUMBER,
                description: "Total akhir yang dibayarkan atau diterima dalam Rupiah.",
              },
              transaction_date: {
                type: Type.STRING,
                description: "Tanggal transaksi format YYYY-MM-DD.",
              },
              category: {
                type: Type.STRING,
              },
              merchant: {
                type: Type.STRING,
                description: "Nama toko, merchant, atau pihak transaksi.",
              },
              description: {
                type: Type.STRING,
                description: "Ringkasan singkat isi transaksi dalam bahasa Indonesia.",
              },
              account_hint: {
                type: Type.STRING,
                description:
                  "Nama metode pembayaran/bank/e-wallet yang terlihat di struk (misal BCA, Mandiri, GoPay, QRIS, Tunai) atau string kosong jika tidak terlihat.",
              },
              warnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              "transaction_type",
              "amount",
              "transaction_date",
              "category",
              "merchant",
              "description",
              "account_hint",
              "warnings",
            ],
          },
        },
      })
  );

  const rawJson = response.text?.trim();
  if (!rawJson) {
    throw new Error("Gemini tidak mengembalikan hasil pembacaan struk.");
  }

  let parsed: {
    transaction_type: "expense" | "income" | "transfer";
    amount: number;
    transaction_date: string;
    category: string;
    merchant: string;
    description: string;
    account_hint: string;
    warnings: string[];
  };
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("Format respons analisis struk tidak dapat dibaca.");
  }

  const txType = ["expense", "income", "transfer"].includes(parsed.transaction_type)
    ? parsed.transaction_type
    : "expense";
  const amount =
    Number.isFinite(parsed.amount) && parsed.amount > 0
      ? Math.round(parsed.amount)
      : null;
  const txDate = /^\d{4}-\d{2}-\d{2}$/.test(parsed.transaction_date ?? "")
    ? parsed.transaction_date
    : today;

  const accountHint = (parsed.account_hint ?? "").trim();
  const matchedAcc = accountHint
    ? findBestAccountMatch(accountHint, accounts)
    : null;

  const warnings: string[] = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((w) => typeof w === "string" && w.trim().length > 0)
    : [];

  let sourceAccountId: string | null = null;
  let destinationAccountId: string | null = null;

  if (txType === "expense") {
    sourceAccountId = matchedAcc?.id ?? null;
    if (!sourceAccountId) {
      warnings.push("Pilih akun sumber dana sebelum menyetujui draf struk ini.");
    }
  } else if (txType === "income") {
    destinationAccountId = matchedAcc?.id ?? null;
    if (!destinationAccountId) {
      warnings.push("Pilih akun tujuan dana sebelum menyetujui draf struk ini.");
    }
  } else {
    sourceAccountId = matchedAcc?.id ?? null;
    warnings.push("Periksa akun sumber dan tujuan transfer dari bukti ini.");
  }

  if (amount === null) {
    warnings.push("Nominal total struk belum terbaca jelas. Mohon isi manual.");
  }

  const merchant = (parsed.merchant ?? "").trim() || "Merchant Struk";
  const description = (parsed.description ?? "").trim() || `Struk ${merchant}`;
  const category = (parsed.category ?? "").trim() || "Belanja";

  const commandText = `[Scan Struk] ${merchant} · ${description}${
    amount ? ` · Rp ${amount.toLocaleString("id-ID")}` : ""
  }`;

  const draft: ParsedCommandDraft = {
    transaction_type: txType,
    amount,
    category,
    description: `${merchant} — ${description}`.slice(0, 140),
    source_account_id: sourceAccountId,
    destination_account_id: destinationAccountId,
    source_hint: txType !== "income" ? accountHint || null : null,
    destination_hint: txType !== "expense" ? accountHint || null : null,
    transaction_date: txDate,
    confidence:
      amount === null || warnings.length >= 2
        ? "low"
        : warnings.length === 1
          ? "medium"
          : "high",
    warnings,
  };

  return {
    commandText,
    draft,
    merchant,
  };
}

export async function synthesizeIndonesianTTS(
  text: string,
  style?: string
): Promise<{ audioBase64: string; mimeType: string }> {
  const ai = getAIClient();
  const cleanText = text.trim().slice(0, 2500);
  if (!cleanText) {
    throw new Error("Teks untuk dibacakan tidak boleh kosong.");
  }

  const response = await withGeminiRetryAndFallback(
    ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"],
    (model) =>
      ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style:
                    style ||
                    "Jelas, tenang, formal, ringkas, seperti asisten keuangan pribadi Indonesia profesional.",
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
        },
      })
  );

  const base64Audio =
    response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Model TTS tidak mengembalikan data audio.");
  }

  return {
    audioBase64: base64Audio,
    mimeType: "audio/wav",
  };
}

const createDraftProposalTool: FunctionDeclaration = {
  name: "buat_draf_mutasi",
  description:
    "Membuat draf mutasi transaksi keuangan ke Antrean Persetujuan Owner (status pending, belum memotong atau menambah saldo sampai Owner menyetujui di layar).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command_text: {
        type: Type.STRING,
        description:
          "Ringkasan perintah bahasa alami transaksi, misalnya 'bayar kopi 25rb pakai gopay' atau 'terima gaji 15jt ke bca'.",
      },
    },
    required: ["command_text"],
  },
};

export async function attachLiveVoiceSession(
  clientWs: WebSocket,
  sessionToken: string | undefined
): Promise<void> {
  const verified = await verifyOwnerToken(sessionToken);
  if (!verified) {
    clientWs.send(
      JSON.stringify({
        error: "Sesi Owner tidak valid. Silakan masuk kembali terlebih dahulu.",
      })
    );
    clientWs.close();
    return;
  }
  const ownerId = verified.ownerId;

  let ai: GoogleGenAI;
  try {
    ai = getAIClient();
  } catch (err) {
    clientWs.send(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Konfigurasi Gemini belum siap.",
      })
    );
    clientWs.close();
    return;
  }

  const authedSupabase =
    verified.mode === "supabase" && sessionToken
      ? createAuthedSupabaseClient(sessionToken)
      : null;

  let initialAccounts: Account[] = [];
  if (authedSupabase) {
    const { data } = await authedSupabase
      .from("accounts")
      .select("*")
      .eq("is_active", true);
    initialAccounts = (data ?? []) as Account[];
  } else {
    initialAccounts = loadVault().accounts.filter((a) => a.is_active);
  }

  const accountList = initialAccounts
    .map((a) => `${a.account_name} (${a.account_type})`)
    .join(", ");

  let session: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
  let closed = false;

  try {
    session = await ai.live.connect({
      model: "gemini-3.8-live",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: [createDraftProposalTool] }],
        systemInstruction: `Anda adalah EGO Personal AI, asisten keuangan pribadi untuk satu Owner tunggal berbahasa Indonesia formal dan ringkas. Akun aktif Owner saat ini: ${accountList || "belum ada akun"}. ATURAN BRANKAS MUTLAK: Anda hanya boleh membuat DRAF ke Antrean Persetujuan menggunakan alat buat_draf_mutasi; Anda TIDAK PERNAH bisa langsung memotong atau memindahkan saldo tanpa persetujuan manual Owner di layar. Selalu konfirmasi secara lisan bahwa draf telah dikirim ke Antrean Persetujuan untuk ditinjau Owner.`,
      },
      callbacks: {
        onopen: () => {
          if (!closed && clientWs.readyState === 1) {
            clientWs.send(JSON.stringify({ status: "connected" }));
          }
        },
        onmessage: (message: LiveServerMessage) => {
          if (closed || clientWs.readyState !== 1) return;

          const content = message.serverContent;
          if (content?.inputTranscription?.text) {
            clientWs.send(
              JSON.stringify({ inputTranscript: content.inputTranscription.text })
            );
          }
          if (content?.outputTranscription?.text) {
            clientWs.send(
              JSON.stringify({ outputTranscript: content.outputTranscription.text })
            );
          }
          if (content?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }

          for (const part of content?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
            }
          }

          for (const call of message.toolCall?.functionCalls ?? []) {
            if (call.name === "buat_draf_mutasi") {
              const commandText = String(
                (call.args as Record<string, unknown> | undefined)?.command_text ?? ""
              )
                .trim()
                .slice(0, 500);

              if (commandText) {
                void (async () => {
                  try {
                    let savedCmd: OwnerCommand;
                    if (authedSupabase) {
                      const { data: accRows } = await authedSupabase
                        .from("accounts")
                        .select("*");
                      const currentAccounts = (accRows ?? initialAccounts) as Account[];
                      const draft = parseNaturalCommand(commandText, currentAccounts);

                      const { data: inserted, error: insertErr } = await authedSupabase
                        .from("owner_commands")
                        .insert({
                          command_text: commandText,
                          status: "pending",
                          parsed_draft: draft,
                        })
                        .select("*")
                        .single();

                      if (insertErr || !inserted) {
                        throw new Error(
                          insertErr?.message || "Gagal menyimpan draf suara ke Supabase."
                        );
                      }
                      savedCmd = inserted as OwnerCommand;
                    } else {
                      const currentDb = loadVault();
                      const draft = parseNaturalCommand(commandText, currentDb.accounts);
                      savedCmd = {
                        id: crypto.randomUUID(),
                        owner_id: ownerId,
                        command_text: commandText,
                        status: "pending",
                        parsed_draft: draft,
                        created_at: new Date().toISOString(),
                      };
                      currentDb.owner_commands.unshift(savedCmd);
                      saveVault(currentDb);
                    }

                    if (!closed && clientWs.readyState === 1) {
                      clientWs.send(JSON.stringify({ draftCreated: savedCmd }));
                    }

                    session?.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: {
                            ok: true,
                            message:
                              "Draf berhasil masuk ke Antrean Persetujuan (status pending). Saldo belum berubah sampai Owner menyetujui.",
                          },
                        },
                      ],
                    });
                  } catch (toolErr) {
                    session?.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: {
                            ok: false,
                            message:
                              toolErr instanceof Error
                                ? toolErr.message
                                : "Gagal mengirim draf suara ke antrean.",
                          },
                        },
                      ],
                    });
                  }
                })();
              }
            }
          }
        },
        onerror: (err: unknown) => {
          if (!closed && clientWs.readyState === 1) {
            const classified = classifyGeminiError(err);
            clientWs.send(JSON.stringify({ error: classified.message }));
          }
        },
        onclose: () => {
          if (!closed && clientWs.readyState === 1) {
            clientWs.send(JSON.stringify({ status: "closed" }));
          }
        },
      },
    });
  } catch (err) {
    if (clientWs.readyState === 1) {
      const classified = classifyGeminiError(err);
      clientWs.send(JSON.stringify({ error: classified.message }));
      clientWs.close();
    }
    return;
  }

  clientWs.on("message", (raw) => {
    if (closed || !session) return;
    try {
      const msg = JSON.parse(raw.toString()) as { audio?: string; text?: string };
      if (msg.audio) {
        session.sendRealtimeInput({
          audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
        });
      }
      if (msg.text) {
        session.sendRealtimeInput({ text: msg.text });
      }
    } catch {
      // Ignore malformed websocket frame
    }
  });

  clientWs.on("close", () => {
    closed = true;
    try {
      session?.close();
    } catch {
      // Ignore close error
    }
  });
}
```

---

## 16. `server/gemini.test.ts` (64 lines)

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { classifyGeminiError, withGeminiRetryAndFallback } from "./gemini";

test("classifyGeminiError maps 429 RESOURCE_EXHAUSTED raw JSON into clean Indonesian quota error", () => {
  const raw = new Error(
    JSON.stringify({
      error: {
        code: 429,
        message: "You exceeded your current quota, please check your plan and billing details.",
        status: "RESOURCE_EXHAUSTED",
      },
    })
  );

  const classified = classifyGeminiError(raw);
  assert.equal(classified.statusCode, 429);
  assert.equal(classified.code, "QUOTA_EXCEEDED");
  assert.equal(classified.message.includes("RESOURCE_EXHAUSTED"), false);
  assert.equal(classified.message.includes("Kuota"), true);
});

test("withGeminiRetryAndFallback retries primary and switches to fallback model on 429", async () => {
  const calls: string[] = [];
  const result = await withGeminiRetryAndFallback(
    ["gemini-4-hydrogen", "gemini-3.1-flash-lite"],
    async (model) => {
      calls.push(model);
      if (model === "gemini-4-hydrogen") {
        throw new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}');
      }
      return `ok-from-${model}`;
    },
    1
  );

  assert.equal(result, "ok-from-gemini-3.1-flash-lite");
  assert.deepEqual(calls, [
    "gemini-4-hydrogen",
    "gemini-4-hydrogen",
    "gemini-3.1-flash-lite",
  ]);
});

test("withGeminiRetryAndFallback fails immediately without fallback on AUTH_ERROR", async () => {
  const calls: string[] = [];
  await assert.rejects(
    () =>
      withGeminiRetryAndFallback(
        ["gemini-4-hydrogen", "gemini-3.1-flash-lite"],
        async (model) => {
          calls.push(model);
          throw new Error("API_KEY_INVALID");
        },
        1
      ),
    (err: unknown) =>
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "AUTH_ERROR"
  );
  assert.deepEqual(calls, ["gemini-4-hydrogen"]);
});
```

---

## 17. `server/vaultRules.test.ts` (323 lines)

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSingleOwnerAvailable,
  createEmptyVault,
  createLoginRateLimiter,
  validateChangePasswordInput,
  validateDebtPayment,
  validateOwnerEmailUpdateInput,
  validatePinFormat,
  validateRecurringBillInput,
  validateResetOwnerConfirmation,
  validateSavingsGoalInput,
  validateTransactionInvariants,
} from "./vaultRules";
import type { Account, Debt } from "../src/types/ego";

const ownerId = "owner-uuid-1";

const sampleAccounts: Account[] = [
  {
    id: "acc-1",
    owner_id: ownerId,
    account_name: "BCA",
    account_type: "bank",
    opening_balance: 5_000_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
  {
    id: "acc-2",
    owner_id: ownerId,
    account_name: "GoPay",
    account_type: "ewallet",
    opening_balance: 200_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
];

test("assertSingleOwnerAvailable rejects second owner registration", () => {
  const db = createEmptyVault();
  assert.doesNotThrow(() => assertSingleOwnerAvailable(db));

  db.owner = {
    id: ownerId,
    email: "owner@ego.local",
    full_name: "Owner Utama",
    password_hash: "hashed",
    created_at: "2026-11-01T00:00:00Z",
  };

  assert.throws(() => assertSingleOwnerAvailable(db), /Single-Owner/i);
});

test("validateTransactionInvariants blocks posted transaction without owner_confirmed", () => {
  assert.throws(
    () =>
      validateTransactionInvariants(
        {
          owner_id: ownerId,
          transaction_type: "expense",
          source_account_id: "acc-1",
          destination_account_id: null,
          amount: 50_000,
          status: "posted",
          owner_confirmed: false,
        },
        sampleAccounts
      ),
    /Prinsip Brankas Mutlak/i
  );
});

test("validateTransactionInvariants enforces transfer source != destination", () => {
  assert.throws(
    () =>
      validateTransactionInvariants(
        {
          owner_id: ownerId,
          transaction_type: "transfer",
          source_account_id: "acc-1",
          destination_account_id: "acc-1",
          amount: 100_000,
          status: "posted",
          owner_confirmed: true,
        },
        sampleAccounts
      ),
    /tidak boleh sama/i
  );
});

test("validateDebtPayment rejects overpayment and missing confirmation", () => {
  const debt: Debt = {
    id: "debt-1",
    owner_id: ownerId,
    creditor: "Kartu Kredit",
    original_amount: 2_000_000,
    outstanding_balance: 1_000_000,
    due_date: "2026-12-01",
    status: "active",
    description: null,
    created_at: "2026-11-01T00:00:00Z",
  };

  assert.throws(() => validateDebtPayment(debt, 500_000, "acc-1", false));
  assert.throws(() => validateDebtPayment(debt, 1_500_000, "acc-1", true));
  assert.doesNotThrow(() => validateDebtPayment(debt, 500_000, "acc-1", true));
});

test("createLoginRateLimiter blocks after 5 failures and resets after cooldown or success", () => {
  const limiter = createLoginRateLimiter(5, 15 * 60 * 1000);
  const start = 1_700_000_000_000;

  assert.equal(limiter.check("ip1", start).allowed, true);
  for (let i = 0; i < 4; i++) {
    const res = limiter.recordFailure("ip1", start + i * 1000);
    assert.equal(res.allowed, true);
    assert.equal(res.remainingAttempts, 4 - i);
  }

  const locked = limiter.recordFailure("ip1", start + 5000);
  assert.equal(locked.allowed, false);
  assert.equal(locked.remainingAttempts, 0);
  assert.ok(locked.retryAfterSeconds > 0);
  assert.match(locked.message ?? "", /tunggu/i);

  // Still locked before 15 minutes pass
  assert.equal(limiter.check("ip1", start + 60_000).allowed, false);

  // Unlocks cleanly after 15 minutes
  assert.equal(limiter.check("ip1", start + 15 * 60 * 1000 + 1).allowed, true);

  // Reset on success clears counter immediately
  limiter.recordFailure("ip2", start);
  limiter.reset("ip2");
  assert.equal(limiter.check("ip2", start + 1000).remainingAttempts, 5);
});

test("validateRecurringBillInput enforces owner confirmation and valid schedule fields", () => {
  assert.throws(
    () =>
      validateRecurringBillInput({
        title: "Internet Rumah",
        transaction_type: "expense",
        amount: 350_000,
        frequency: "monthly",
        next_due_date: "2026-12-01",
        owner_confirmed: false,
      }),
    /Persetujuan eksplisit Owner/i
  );

  assert.throws(
    () =>
      validateRecurringBillInput({
        title: "Tagihan",
        transaction_type: "expense",
        amount: 0,
        frequency: "monthly",
        next_due_date: "2026-12-01",
        owner_confirmed: true,
      }),
    /lebih besar dari Rp 0/i
  );

  assert.doesNotThrow(() =>
    validateRecurringBillInput({
      title: "Internet Rumah",
      transaction_type: "expense",
      amount: 350_000,
      frequency: "monthly",
      next_due_date: "2026-12-01",
      owner_confirmed: true,
    })
  );
});

test("validateSavingsGoalInput enforces owner confirmation and positive target amount", () => {
  assert.throws(
    () =>
      validateSavingsGoalInput({
        title: "Dana Darurat",
        goal_type: "emergency_fund",
        target_amount: 30_000_000,
        current_amount: 0,
        owner_confirmed: false,
      }),
    /Persetujuan eksplisit Owner/i
  );

  assert.throws(
    () =>
      validateSavingsGoalInput({
        title: "Dana Darurat",
        goal_type: "emergency_fund",
        target_amount: -100,
        current_amount: 0,
        owner_confirmed: true,
      }),
    /lebih besar dari Rp 0/i
  );

  assert.doesNotThrow(() =>
    validateSavingsGoalInput({
      title: "Dana Darurat",
      goal_type: "emergency_fund",
      target_amount: 30_000_000,
      current_amount: 5_000_000,
      owner_confirmed: true,
    })
  );
});

test("validateChangePasswordInput enforces minimum length, current password, and difference", () => {
  assert.throws(
    () =>
      validateChangePasswordInput({
        current_password: "",
        new_password: "baru123",
      }),
    /saat ini wajib diisi/i
  );
  assert.throws(
    () =>
      validateChangePasswordInput({
        current_password: "lama123",
        new_password: "123",
      }),
    /minimal 6 karakter/i
  );
  assert.throws(
    () =>
      validateChangePasswordInput({
        current_password: "sama123",
        new_password: "sama123",
      }),
    /harus berbeda/i
  );
  assert.doesNotThrow(() =>
    validateChangePasswordInput({
      current_password: "lama123",
      new_password: "baru123",
    })
  );
});

test("validatePinFormat requires exactly 6 numeric digits", () => {
  assert.throws(() => validatePinFormat("12345"), /6 digit angka/i);
  assert.throws(() => validatePinFormat("12345a"), /6 digit angka/i);
  assert.throws(() => validatePinFormat("1234567"), /6 digit angka/i);
  assert.doesNotThrow(() => validatePinFormat("048291"));
});

test("validateOwnerEmailUpdateInput validates email, full_name, and current_password", () => {
  assert.throws(
    () =>
      validateOwnerEmailUpdateInput({
        email: "bukan-email",
        full_name: "Syahrul",
        current_password: "secret",
      }),
    /Format email Owner tidak valid/i
  );
  assert.throws(
    () =>
      validateOwnerEmailUpdateInput({
        email: "owner@example.com",
        full_name: " ",
        current_password: "secret",
      }),
    /Nama panggilan Owner/i
  );
  assert.throws(
    () =>
      validateOwnerEmailUpdateInput({
        email: "owner@example.com",
        full_name: "Syahrul",
        current_password: "",
      }),
    /Kata sandi saat ini wajib diisi/i
  );

  const normalized = validateOwnerEmailUpdateInput({
    email: "  Syahrul.Baru@Example.COM ",
    full_name: " Syahrul Utama ",
    current_password: "secret",
  });
  assert.deepEqual(normalized, {
    email: "syahrul.baru@example.com",
    full_name: "Syahrul Utama",
  });
});

test("validateResetOwnerConfirmation requires checkbox acknowledgment and HAPUS keyword", () => {
  assert.throws(
    () =>
      validateResetOwnerConfirmation({
        confirmed: false,
        confirmation_text: "HAPUS",
      }),
    /Centang persetujuan/i
  );
  assert.throws(
    () =>
      validateResetOwnerConfirmation({
        confirmed: true,
        confirmation_text: "salah",
      }),
    /HAPUS/
  );
  assert.doesNotThrow(() =>
    validateResetOwnerConfirmation({
      confirmed: true,
      confirmation_text: "hapus",
    })
  );
});

```

---

## 18. `src/main.tsx` (6 lines)

```tsx
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
```

---

## 19. `src/App.tsx` (7 lines)

```tsx
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routeTree";

export default function App() {
  return <RouterProvider router={router} />;
}
```

---

## 20. `src/index.css` (27 lines)

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

@layer base {
  html {
    font-family: var(--font-sans);
    color-scheme: light;
    background-color: #faf9f6;
    color: #1c1917;
  }

  html.dark {
    color-scheme: dark;
    background-color: #09090b;
    color: #f4f4f5;
  }

  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }
}
```

---

## 21. `src/routeTree.ts` (126 lines)

```ts
import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { RootComponent } from "./routes/__root";
import { AuthenticatedLayout } from "./routes/_authenticated/route";
import { AkunPage } from "./routes/_authenticated/akun";
import { AsetPage } from "./routes/_authenticated/aset";
import { DashboardPage } from "./routes/_authenticated/index";
import { OwnerControlPage } from "./routes/_authenticated/owner";
import { PengaturanPage } from "./routes/_authenticated/pengaturan";
import { RencanaPage } from "./routes/_authenticated/rencana";
import { TransaksiPage } from "./routes/_authenticated/transaksi";
import { UtangPage } from "./routes/_authenticated/utang";
import { AuthRoutePage } from "./routes/auth";

const rootRoute = createRootRoute({
  component: RootComponent,
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth",
  component: AuthRoutePage,
});

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authenticated",
  component: AuthenticatedLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/",
  component: DashboardPage,
});

export interface TransaksiSearch {
  kategori?: string;
  jenis?: "all" | "income" | "expense" | "transfer";
}

const transaksiRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/transaksi",
  validateSearch: (search: Record<string, unknown>): TransaksiSearch => {
    const jenisRaw = search.jenis;
    const jenis =
      jenisRaw === "all" ||
      jenisRaw === "income" ||
      jenisRaw === "expense" ||
      jenisRaw === "transfer"
        ? jenisRaw
        : undefined;
    const kategori =
      typeof search.kategori === "string" && search.kategori.trim()
        ? search.kategori.trim()
        : undefined;
    return { kategori, jenis };
  },
  component: TransaksiPage,
});

const akunRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/akun",
  component: AkunPage,
});

const asetRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/aset",
  component: AsetPage,
});

const utangRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/utang",
  component: UtangPage,
});

const rencanaRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/rencana",
  component: RencanaPage,
});

const ownerRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/owner",
  component: OwnerControlPage,
});

const pengaturanRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/pengaturan",
  component: PengaturanPage,
});

export const routeTree = rootRoute.addChildren([
  authRoute,
  authenticatedRoute.addChildren([
    indexRoute,
    transaksiRoute,
    akunRoute,
    asetRoute,
    utangRoute,
    rencanaRoute,
    ownerRoute,
    pengaturanRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

---

## 22. `src/types/ego.ts` (144 lines)

```ts
export type AccountType = "cash" | "bank" | "ewallet";
export type TransactionType = "income" | "expense" | "transfer";
export type TransactionStatus = "posted" | "pending" | "cancelled";
export type AssetType =
  | "emas"
  | "properti"
  | "kendaraan"
  | "investasi"
  | "elektronik"
  | "lainnya";
export type DebtStatus = "active" | "paid";
export type CommandStatus = "pending" | "processed" | "rejected";
export type DateFormatPref = "DD/MM/YYYY" | "YYYY-MM-DD" | "DD MMM YYYY";

export interface Account {
  id: string;
  owner_id: string;
  account_name: string;
  account_type: AccountType;
  opening_balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface AccountBalance extends Account {
  current_balance: number;
}

export interface Transaction {
  id: string;
  owner_id: string;
  transaction_type: TransactionType;
  source_account_id: string | null;
  destination_account_id: string | null;
  amount: number;
  transaction_date: string;
  category: string | null;
  description: string | null;
  status: TransactionStatus;
  owner_confirmed: boolean;
  created_at: string;
}

export interface Asset {
  id: string;
  owner_id: string;
  asset_name: string;
  asset_type: AssetType;
  current_value: number;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  created_at: string;
}

export interface Debt {
  id: string;
  owner_id: string;
  creditor: string;
  original_amount: number;
  outstanding_balance: number;
  due_date: string | null;
  status: DebtStatus;
  description: string | null;
  created_at: string;
}

export interface ParsedCommandDraft {
  transaction_type: TransactionType;
  amount: number | null;
  category: string;
  description: string;
  source_account_id: string | null;
  destination_account_id: string | null;
  source_hint: string | null;
  destination_hint: string | null;
  transaction_date: string;
  confidence: "high" | "medium" | "low";
  warnings: string[];
}

export interface OwnerCommand {
  id: string;
  owner_id: string;
  command_text: string;
  status: CommandStatus;
  parsed_draft: ParsedCommandDraft | null;
  created_at: string;
}

export interface OwnerPreferences {
  date_format: DateFormatPref;
  expense_alert_limit: number;
}

export interface OwnerUser {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface SearchSource {
  title: string;
  uri: string;
}

export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export interface RecurringBill {
  id: string;
  owner_id: string;
  title: string;
  transaction_type: "income" | "expense";
  amount: number;
  category: string;
  account_id: string | null;
  frequency: RecurringFrequency;
  next_due_date: string;
  is_active: boolean;
  notes: string | null;
  last_queued_date: string | null;
  created_at: string;
}

export type GoalType = "emergency_fund" | "savings_target";
export type GoalStatus = "active" | "completed";

export interface SavingsGoal {
  id: string;
  owner_id: string;
  title: string;
  goal_type: GoalType;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  linked_account_id: string | null;
  notes: string | null;
  status: GoalStatus;
  created_at: string;
}

```

---

## 23. `src/lib/supabase.ts` (46 lines)

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const rawKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ??
  "";

function normalizeSupabaseUrl(value: string): string | null {
  if (!value || value.startsWith("MY_")) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function createSafeSupabaseClient(): SupabaseClient | null {
  const cleanUrl = normalizeSupabaseUrl(rawUrl);
  if (
    !cleanUrl ||
    !rawKey ||
    rawKey === "Xzx1@2@3xzX" ||
    rawKey.startsWith("MY_")
  ) {
    return null;
  }
  try {
    return createClient(cleanUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch {
    return null;
  }
}

export const supabase: SupabaseClient | null = createSafeSupabaseClient();
export const isSupabaseConfigured = supabase !== null;
```

---

## 24. `src/lib/vault-validation.ts` (221 lines)

```ts
import type {
  AccountType,
  AssetType,
  GoalType,
  RecurringFrequency,
  TransactionStatus,
  TransactionType,
} from "../types/ego";

export const OWNER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_ACCOUNT_TYPES = new Set<AccountType>(["cash", "bank", "ewallet"]);
const VALID_ASSET_TYPES = new Set<AssetType>([
  "emas",
  "properti",
  "kendaraan",
  "investasi",
  "elektronik",
  "lainnya",
]);
const VALID_FREQUENCIES = new Set<RecurringFrequency>([
  "weekly",
  "monthly",
  "yearly",
]);

export function validateAccountInput(input: {
  account_name: string;
  account_type: string;
  opening_balance: number;
  owner_confirmed: boolean;
}): void {
  if (!input.owner_confirmed) {
    throw new Error("Persetujuan eksplisit Owner wajib dicentang sebelum membuat akun.");
  }
  const name = input.account_name.trim();
  if (name.length < 1 || name.length > 80) {
    throw new Error("Nama akun wajib 1–80 karakter.");
  }
  if (!VALID_ACCOUNT_TYPES.has(input.account_type as AccountType)) {
    throw new Error("Jenis akun tidak valid.");
  }
  if (!Number.isFinite(input.opening_balance) || input.opening_balance < 0) {
    throw new Error("Saldo awal harus berupa angka >= 0.");
  }
}

export function validateTransactionPayload(input: {
  transaction_type: TransactionType;
  source_account_id: string | null;
  destination_account_id: string | null;
  amount: number;
  status: TransactionStatus;
  owner_confirmed: boolean;
}): void {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Nominal transaksi harus lebih besar dari Rp 0.");
  }

  if (input.status === "posted" && input.owner_confirmed !== true) {
    throw new Error(
      "Prinsip Brankas Mutlak: Transaksi berstatus posted wajib memiliki persetujuan eksplisit Owner."
    );
  }

  if (input.transaction_type === "income") {
    if (!input.destination_account_id) {
      throw new Error("Pemasukan wajib memilih akun tujuan yang valid milik Owner.");
    }
  } else if (input.transaction_type === "expense") {
    if (!input.source_account_id) {
      throw new Error("Pengeluaran wajib memilih akun sumber yang valid milik Owner.");
    }
  } else if (input.transaction_type === "transfer") {
    if (!input.source_account_id || !input.destination_account_id) {
      throw new Error("Transfer wajib memilih akun sumber dan akun tujuan yang valid.");
    }
    if (input.source_account_id === input.destination_account_id) {
      throw new Error("Akun sumber dan akun tujuan transfer tidak boleh sama.");
    }
  } else {
    throw new Error("Jenis transaksi tidak dikenali.");
  }
}

export function validateAssetInput(input: {
  asset_name: string;
  asset_type: string;
  current_value: number;
  quantity?: number | null;
  owner_confirmed: boolean;
}): void {
  if (!input.owner_confirmed) {
    throw new Error("Persetujuan eksplisit Owner wajib dicentang sebelum mencatat aset.");
  }
  const name = input.asset_name.trim();
  if (name.length < 1 || name.length > 120) {
    throw new Error("Nama aset wajib diisi (maks 120 karakter).");
  }
  if (!VALID_ASSET_TYPES.has(input.asset_type as AssetType)) {
    throw new Error("Kategori aset tidak valid.");
  }
  if (!Number.isFinite(input.current_value) || input.current_value < 0) {
    throw new Error("Nilai aset harus >= 0.");
  }
  if (
    input.quantity !== null &&
    input.quantity !== undefined &&
    (!Number.isFinite(input.quantity) || input.quantity < 0)
  ) {
    throw new Error("Kuantitas aset harus berupa angka >= 0.");
  }
}

export function validateDebtInput(input: {
  creditor: string;
  original_amount: number;
  outstanding_balance: number;
  owner_confirmed: boolean;
}): void {
  if (!input.owner_confirmed) {
    throw new Error("Persetujuan eksplisit Owner wajib dicentang sebelum mencatat utang.");
  }
  const creditor = input.creditor.trim();
  if (creditor.length < 1 || creditor.length > 120) {
    throw new Error("Nama kreditur wajib diisi (maks 120 karakter).");
  }
  if (!Number.isFinite(input.original_amount) || input.original_amount <= 0) {
    throw new Error("Plafon awal utang harus lebih besar dari Rp 0.");
  }
  if (!Number.isFinite(input.outstanding_balance) || input.outstanding_balance < 0) {
    throw new Error("Sisa pokok utang tidak valid.");
  }
}

export function validateDebtPaymentInput(
  debt: { status: string; outstanding_balance: number },
  paymentAmount: number,
  sourceAccountId: string,
  ownerConfirmed: boolean
): void {
  if (!ownerConfirmed) {
    throw new Error(
      "Persetujuan eksplisit Owner wajib dicentang sebelum membayar utang."
    );
  }
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error("Nominal pembayaran utang harus lebih besar dari Rp 0.");
  }
  if (debt.status === "paid" || Number(debt.outstanding_balance) <= 0) {
    throw new Error("Utang ini sudah berstatus lunas.");
  }
  if (paymentAmount > Number(debt.outstanding_balance)) {
    throw new Error("Nominal pembayaran melebihi sisa pokok utang saat ini.");
  }
  if (!sourceAccountId) {
    throw new Error("Pilih akun sumber pembayaran utang.");
  }
}

export function validateRecurringBillInput(input: {
  title: string;
  transaction_type: string;
  amount: number;
  frequency: string;
  next_due_date: string;
  owner_confirmed: boolean;
}): void {
  if (!input.owner_confirmed) {
    throw new Error(
      "Persetujuan eksplisit Owner wajib dicentang sebelum menyimpan jadwal rutin."
    );
  }
  if (!input.title || input.title.trim().length > 120) {
    throw new Error(
      "Nama tagihan atau pemasukan rutin wajib diisi (maks 120 karakter)."
    );
  }
  if (input.transaction_type !== "income" && input.transaction_type !== "expense") {
    throw new Error("Jenis transaksi rutin harus Pemasukan atau Pengeluaran.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Nominal tagihan rutin harus lebih besar dari Rp 0.");
  }
  if (!VALID_FREQUENCIES.has(input.frequency as RecurringFrequency)) {
    throw new Error("Frekuensi jadwal rutin tidak valid.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.next_due_date)) {
    throw new Error("Tanggal jatuh tempo wajib diisi dalam format YYYY-MM-DD.");
  }
}

export function validateSavingsGoalInput(input: {
  title: string;
  goal_type: string;
  target_amount: number;
  current_amount: number;
  owner_confirmed: boolean;
}): void {
  if (!input.owner_confirmed) {
    throw new Error(
      "Persetujuan eksplisit Owner wajib dicentang sebelum membuat target tabungan."
    );
  }
  if (!input.title || input.title.trim().length > 120) {
    throw new Error("Nama target tabungan wajib diisi (maks 120 karakter).");
  }
  if (
    input.goal_type !== ("emergency_fund" satisfies GoalType) &&
    input.goal_type !== ("savings_target" satisfies GoalType)
  ) {
    throw new Error("Jenis target tidak valid.");
  }
  if (!Number.isFinite(input.target_amount) || input.target_amount <= 0) {
    throw new Error("Target dana harus lebih besar dari Rp 0.");
  }
  if (!Number.isFinite(input.current_amount) || input.current_amount < 0) {
    throw new Error("Dana terkumpul awal harus >= Rp 0.");
  }
}
```

---

## 25. `src/lib/queries.ts` (1464 lines)

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { advanceDueDate, computeAccountBalances, roundCurrency, todayISO } from "./finance";
import {
  clearPinSessionState,
  hashPinWebCrypto,
  markPinSessionUnlocked,
  verifyPinWebCrypto,
} from "./pin-lock";
import { isSupabaseConfigured, supabase } from "./supabase";
import {
  OWNER_EMAIL_REGEX,
  validateAccountInput,
  validateAssetInput,
  validateDebtInput,
  validateDebtPaymentInput,
  validateRecurringBillInput,
  validateSavingsGoalInput,
  validateTransactionPayload,
} from "./vault-validation";
import type {
  Account,
  AccountBalance,
  AccountType,
  Asset,
  AssetType,
  DateFormatPref,
  Debt,
  GoalStatus,
  GoalType,
  OwnerCommand,
  OwnerPreferences,
  OwnerUser,
  ParsedCommandDraft,
  RecurringBill,
  RecurringFrequency,
  SavingsGoal,
  SearchSource,
  Transaction,
  TransactionType,
} from "../types/ego";

const PREFS_STORAGE_KEY = "ego_owner_preferences";

// Held strictly in JS memory rather than localStorage; HttpOnly cookie maintains persistence across page reloads.
let memorySessionToken: string | null = null;

export function setMemorySessionToken(token: string | null): void {
  memorySessionToken = token;
}

export async function getActiveBearerToken(): Promise<string | null> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
  return memorySessionToken;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getActiveBearerToken();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("X-Requested-With", "EGO-Vault-SPA");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    code?: string;
  };
  if (!res.ok) {
    throw new ApiError(
      data.error || `Permintaan gagal (${res.status}).`,
      res.status,
      data.code
    );
  }
  return data;
}

export interface AuthStatusResponse {
  hasOwner: boolean;
  authenticated: boolean;
  hasPin: boolean;
  owner: OwnerUser | null;
  mode: "supabase" | "local";
}

export interface VaultSnapshot {
  accounts: AccountBalance[];
  transactions: Transaction[];
  assets: Asset[];
  debts: Debt[];
  owner_commands: OwnerCommand[];
  recurring_bills: RecurringBill[];
  savings_goals: SavingsGoal[];
  preferences: OwnerPreferences;
}

function isMissingSupabaseTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

function formatSupabaseTableWriteError(err: { code?: string; message?: string }): Error {
  if (isMissingSupabaseTableError(err)) {
    return new Error(
      "Tabel baru belum tersedia di Supabase. Jalankan ulang skrip docs/ego-supabase-setup.sql pada SQL Editor Supabase Anda."
    );
  }
  return new Error(err.message || "Gagal menyimpan data ke Supabase.");
}

export const egoKeys = {
  auth: ["ego", "auth"] as const,
  vault: ["ego", "vault"] as const,
  health: ["ego", "health"] as const,
};

export function useHealthStatus() {
  return useQuery({
    queryKey: egoKeys.health,
    queryFn: () =>
      apiFetch<{ ok: boolean; mode: "supabase" | "local"; supabaseConfigured: boolean }>(
        "/api/health"
      ),
    staleTime: 30_000,
  });
}

export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    return {
      hasOwner: Boolean(user),
      authenticated: Boolean(user),
      hasPin: Boolean(user?.user_metadata?.ego_pin_hash),
      owner: user
        ? {
            id: user.id,
            email: user.email ?? "owner@ego.local",
            full_name:
              (user.user_metadata?.full_name as string | undefined) || "Owner Utama",
            created_at: user.created_at,
          }
        : null,
      mode: "supabase",
    };
  }

  const res = await apiFetch<{
    hasOwner: boolean;
    authenticated: boolean;
    hasPin?: boolean;
    owner: OwnerUser | null;
  }>("/api/auth/status");

  return {
    hasOwner: res.hasOwner,
    authenticated: res.authenticated,
    hasPin: Boolean(res.hasPin),
    owner: res.owner,
    mode: "local",
  };
}

export async function fetchVaultSnapshot(): Promise<VaultSnapshot> {
  if (isSupabaseConfigured && supabase) {
    const [accRes, txRes, assetRes, debtRes, cmdRes, recRes, goalRes] = await Promise.all([
      supabase.from("accounts").select("*").order("created_at", { ascending: true }),
      supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("assets").select("*").order("created_at", { ascending: false }),
      supabase.from("debts").select("*").order("created_at", { ascending: false }),
      supabase.from("owner_commands").select("*").order("created_at", { ascending: false }),
      supabase.from("recurring_bills").select("*").order("next_due_date", { ascending: true }),
      supabase.from("savings_goals").select("*").order("created_at", { ascending: false }),
    ]);

    if (accRes.error) throw new Error(accRes.error.message);
    if (txRes.error) throw new Error(txRes.error.message);
    if (assetRes.error) throw new Error(assetRes.error.message);
    if (debtRes.error) throw new Error(debtRes.error.message);
    if (cmdRes.error) throw new Error(cmdRes.error.message);
    if (recRes.error && !isMissingSupabaseTableError(recRes.error)) {
      throw new Error(recRes.error.message);
    }
    if (goalRes.error && !isMissingSupabaseTableError(goalRes.error)) {
      throw new Error(goalRes.error.message);
    }

    const accounts = (accRes.data ?? []) as Account[];
    const transactions = (txRes.data ?? []) as Transaction[];
    let prefs: OwnerPreferences = {
      date_format: "DD MMM YYYY",
      expense_alert_limit: 5_000_000,
    };
    try {
      const saved = window.localStorage.getItem(PREFS_STORAGE_KEY);
      if (saved) prefs = { ...prefs, ...(JSON.parse(saved) as Partial<OwnerPreferences>) };
    } catch {
      // Ignore
    }

    return {
      accounts: computeAccountBalances(accounts, transactions),
      transactions,
      assets: (assetRes.data ?? []) as Asset[],
      debts: (debtRes.data ?? []) as Debt[],
      owner_commands: (cmdRes.data ?? []) as OwnerCommand[],
      recurring_bills: recRes.error ? [] : ((recRes.data ?? []) as RecurringBill[]),
      savings_goals: goalRes.error ? [] : ((goalRes.data ?? []) as SavingsGoal[]),
      preferences: prefs,
    };
  }

  return apiFetch<VaultSnapshot>("/api/vault/snapshot");
}

export function useAuthStatus() {
  return useQuery({
    queryKey: egoKeys.auth,
    queryFn: fetchAuthStatus,
    staleTime: 10_000,
  });
}

export function useVaultSnapshot(enabled = true) {
  return useQuery({
    queryKey: egoKeys.vault,
    queryFn: fetchVaultSnapshot,
    enabled,
  });
}

function formatSupabaseAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Email atau kata sandi Owner tidak sesuai.";
  }
  if (lower.includes("email not confirmed")) {
    return "Email Owner belum dikonfirmasi. Buka tautan verifikasi di kotak masuk atau folder spam email Anda.";
  }
  if (lower.includes("user already registered")) {
    return "Email ini sudah terdaftar. Silakan pindah ke tab Masuk Owner.";
  }
  if (lower.includes("single-owner")) {
    return "Sistem Single-Owner: Akun Owner sudah terdaftar di Supabase. Silakan masuk dengan akun pertama.";
  }
  return message;
}

export function useRegisterOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string; full_name: string }) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: input.email.trim(),
          password: input.password,
          options: { data: { full_name: input.full_name.trim() || "Owner Utama" } },
        });
        if (error) throw new Error(formatSupabaseAuthError(error.message));
        return {
          needsEmailConfirmation: Boolean(data.user && !data.session),
          user: data.user,
          session: data.session,
        };
      }
      const res = await apiFetch<{ token: string; owner: OwnerUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setMemorySessionToken(res.token);
      return {
        needsEmailConfirmation: false,
        owner: res.owner,
      };
    },
    onSuccess: async (res) => {
      if (!res.needsEmailConfirmation) {
        markPinSessionUnlocked();
      }
      await qc.invalidateQueries({ queryKey: egoKeys.auth });
    },
  });
}

export function useLoginOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: input.email.trim(),
          password: input.password,
        });
        if (error) throw new Error(formatSupabaseAuthError(error.message));
        return data;
      }
      const res = await apiFetch<{ token: string; owner: OwnerUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setMemorySessionToken(res.token);
      return res;
    },
    onSuccess: async () => {
      markPinSessionUnlocked();
      await qc.invalidateQueries({ queryKey: egoKeys.auth });
    },
  });
}

export function useLogoutOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      } else {
        await apiFetch("/api/auth/logout", { method: "POST" });
        setMemorySessionToken(null);
      }
    },
    onSuccess: () => {
      clearPinSessionState();
      qc.clear();
    },
  });
}

export function useResetLocalOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { confirmed: boolean; confirmation_text: string }) => {
      if (isSupabaseConfigured && supabase) {
        throw new Error(
          "Reset akun lokal hanya tersedia pada mode Brankas Server Lokal."
        );
      }
      const res = await apiFetch<{ ok: boolean; hasOwner: boolean }>(
        "/api/auth/reset-owner",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      );
      setMemorySessionToken(null);
      return res;
    },
    onSuccess: async () => {
      clearPinSessionState();
      qc.removeQueries({ queryKey: egoKeys.vault });
      await qc.invalidateQueries({ queryKey: egoKeys.auth });
    },
  });
}

export function useUpdateOwnerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      full_name: string;
      current_password: string;
    }) => {
      const email = input.email.trim().toLowerCase();
      const fullName = input.full_name.trim();
      if (!email || !OWNER_EMAIL_REGEX.test(email)) {
        throw new Error("Format email Owner tidak valid.");
      }
      if (fullName.length < 1 || fullName.length > 80) {
        throw new Error("Nama panggilan Owner wajib 1–80 karakter.");
      }
      if (!input.current_password) {
        throw new Error("Kata sandi saat ini wajib diisi untuk verifikasi.");
      }

      if (isSupabaseConfigured && supabase) {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const currentEmail = userData.user?.email;
        if (userErr || !currentEmail) {
          throw new Error("Sesi Owner tidak ditemukan. Silakan masuk ulang.");
        }
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email: currentEmail,
          password: input.current_password,
        });
        if (verifyErr) {
          throw new Error("Kata sandi saat ini tidak sesuai.");
        }
        const emailChanged = email !== currentEmail.toLowerCase();
        const updatePayload: { email?: string; data: { full_name: string } } = {
          data: { full_name: fullName },
        };
        if (emailChanged) {
          updatePayload.email = email;
        }
        const { error: updateErr } = await supabase.auth.updateUser(updatePayload);
        if (updateErr) {
          throw new Error(updateErr.message || "Gagal memperbarui profil Owner.");
        }
        return { ok: true, emailChanged };
      }

      const res = await apiFetch<{ ok: boolean; owner: OwnerUser }>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          email,
          full_name: fullName,
          current_password: input.current_password,
        }),
      });
      return { ...res, emailChanged: false };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.auth });
    },
  });
}

export function useDeleteLocalOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { current_password: string; confirmed: boolean }) => {
      if (isSupabaseConfigured && supabase) {
        throw new Error(
          "Penghapusan akun otomatis hanya tersedia pada mode Brankas Server Lokal."
        );
      }
      const res = await apiFetch<{ ok: boolean; hasOwner: boolean }>(
        "/api/auth/owner",
        {
          method: "DELETE",
          body: JSON.stringify(input),
        }
      );
      setMemorySessionToken(null);
      return res;
    },
    onSuccess: () => {
      clearPinSessionState();
      qc.clear();
    },
  });
}

let supabasePinFailures = { count: 0, lockedUntilMs: 0 };

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: {
      current_password: string;
      new_password: string;
    }) => {
      if (!input.current_password) {
        throw new Error("Kata sandi saat ini wajib diisi.");
      }
      if (!input.new_password || input.new_password.length < 6) {
        throw new Error("Kata sandi baru minimal 6 karakter.");
      }
      if (input.new_password.length > 128) {
        throw new Error("Kata sandi baru maksimal 128 karakter.");
      }
      if (input.new_password === input.current_password) {
        throw new Error("Kata sandi baru harus berbeda dari kata sandi saat ini.");
      }

      if (isSupabaseConfigured && supabase) {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const email = userData.user?.email;
        if (userErr || !email) {
          throw new Error("Sesi Owner tidak ditemukan. Silakan masuk ulang.");
        }
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email,
          password: input.current_password,
        });
        if (verifyErr) {
          throw new Error("Kata sandi saat ini tidak sesuai.");
        }
        const { error: updateErr } = await supabase.auth.updateUser({
          password: input.new_password,
        });
        if (updateErr) {
          throw new Error(updateErr.message || "Gagal memperbarui kata sandi.");
        }
        return { ok: true };
      }

      return apiFetch<{ ok: boolean }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
  });
}

export function useSetupPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { current_password: string; pin: string }) => {
      if (!input.current_password) {
        throw new Error("Kata sandi Owner saat ini wajib diisi untuk verifikasi.");
      }
      if (!/^\d{6}$/.test(input.pin)) {
        throw new Error("PIN cepat wajib terdiri dari tepat 6 digit angka.");
      }

      if (isSupabaseConfigured && supabase) {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const email = userData.user?.email;
        if (userErr || !email) {
          throw new Error("Sesi Owner tidak ditemukan. Silakan masuk ulang.");
        }
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email,
          password: input.current_password,
        });
        if (verifyErr) {
          throw new Error("Kata sandi Owner tidak sesuai.");
        }
        const pinHash = await hashPinWebCrypto(input.pin);
        const { error: updateErr } = await supabase.auth.updateUser({
          data: { ego_pin_hash: pinHash },
        });
        if (updateErr) {
          throw new Error(updateErr.message || "Gagal menyimpan kunci PIN.");
        }
        supabasePinFailures = { count: 0, lockedUntilMs: 0 };
        return { ok: true, hasPin: true };
      }

      return apiFetch<{ ok: boolean; hasPin: boolean }>("/api/auth/pin/setup", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      markPinSessionUnlocked();
      await qc.invalidateQueries({ queryKey: egoKeys.auth });
    },
  });
}

export function useVerifyPin() {
  return useMutation({
    mutationFn: async (pin: string) => {
      if (!/^\d{6}$/.test(pin)) {
        throw new Error("Masukkan 6 digit angka PIN.");
      }

      if (isSupabaseConfigured && supabase) {
        const now = Date.now();
        if (supabasePinFailures.lockedUntilMs > now) {
          const waitMin = Math.max(
            1,
            Math.ceil((supabasePinFailures.lockedUntilMs - now) / 60000)
          );
          throw new Error(
            `Terlalu banyak percobaan PIN gagal. Tunggu sekitar ${waitMin} menit atau masuk dengan kata sandi lengkap.`
          );
        }

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const storedHash = userData.user?.user_metadata?.ego_pin_hash as
          | string
          | undefined;
        if (userErr || !storedHash) {
          throw new Error("Kunci PIN belum aktif pada akun ini.");
        }

        const valid = await verifyPinWebCrypto(pin, storedHash);
        if (!valid) {
          const nextCount = supabasePinFailures.count + 1;
          if (nextCount >= 5) {
            supabasePinFailures = {
              count: nextCount,
              lockedUntilMs: now + 15 * 60 * 1000,
            };
            throw new Error(
              "Terlalu banyak percobaan PIN gagal. Silakan tunggu 15 menit atau masuk dengan kata sandi lengkap."
            );
          }
          supabasePinFailures = { count: nextCount, lockedUntilMs: 0 };
          throw new Error(
            `PIN 6 digit tidak sesuai. Sisa percobaan: ${5 - nextCount}.`
          );
        }

        supabasePinFailures = { count: 0, lockedUntilMs: 0 };
        return { ok: true };
      }

      return apiFetch<{ ok: boolean }>("/api/auth/pin/verify", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
    },
    onSuccess: () => {
      markPinSessionUnlocked();
    },
  });
}

export function useDisablePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (currentPassword: string) => {
      if (!currentPassword) {
        throw new Error("Kata sandi Owner saat ini wajib diisi.");
      }

      if (isSupabaseConfigured && supabase) {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const email = userData.user?.email;
        if (userErr || !email) {
          throw new Error("Sesi Owner tidak ditemukan. Silakan masuk ulang.");
        }
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (verifyErr) {
          throw new Error("Kata sandi Owner tidak sesuai.");
        }
        const { error: updateErr } = await supabase.auth.updateUser({
          data: { ego_pin_hash: null },
        });
        if (updateErr) {
          throw new Error(updateErr.message || "Gagal menonaktifkan kunci PIN.");
        }
        supabasePinFailures = { count: 0, lockedUntilMs: 0 };
        return { ok: true, hasPin: false };
      }

      return apiFetch<{ ok: boolean; hasPin: boolean }>("/api/auth/pin/disable", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword }),
      });
    },
    onSuccess: async () => {
      clearPinSessionState();
      await qc.invalidateQueries({ queryKey: egoKeys.auth });
    },
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      account_name: string;
      account_type: AccountType;
      opening_balance: number;
      owner_confirmed: boolean;
    }) => {
      validateAccountInput(input);
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("accounts").insert({
          account_name: input.account_name.trim(),
          account_type: input.account_type,
          opening_balance: roundCurrency(input.opening_balance),
        });
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useToggleAccountActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; is_active: boolean }) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("accounts")
          .update({ is_active: input.is_active })
          .eq("id", input.id);
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch(`/api/accounts/${input.id}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: input.is_active }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      transaction_type: TransactionType;
      source_account_id: string | null;
      destination_account_id: string | null;
      amount: number;
      transaction_date: string;
      category: string;
      description: string;
      owner_confirmed: boolean;
    }) => {
      const normalized = {
        ...input,
        source_account_id:
          input.transaction_type === "income" ? null : input.source_account_id,
        destination_account_id:
          input.transaction_type === "expense" ? null : input.destination_account_id,
        amount: roundCurrency(input.amount),
        transaction_date: (input.transaction_date || todayISO()).slice(0, 10),
        category: input.category.trim() || "Umum",
        description: input.description.trim(),
      };
      validateTransactionPayload({
        transaction_type: normalized.transaction_type,
        source_account_id: normalized.source_account_id,
        destination_account_id: normalized.destination_account_id,
        amount: normalized.amount,
        status: "posted",
        owner_confirmed: normalized.owner_confirmed,
      });

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("transactions").insert({
          ...normalized,
          status: "posted",
        });
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch("/api/transactions", {
        method: "POST",
        body: JSON.stringify(normalized),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useCancelTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("transactions")
          .update({ status: "cancelled" })
          .eq("id", id);
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch(`/api/transactions/${id}/cancel`, { method: "PATCH" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      asset_name: string;
      asset_type: AssetType;
      current_value: number;
      quantity: number | null;
      unit: string | null;
      notes: string | null;
      owner_confirmed: boolean;
    }) => {
      validateAssetInput(input);
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("assets").insert({
          asset_name: input.asset_name.trim(),
          asset_type: input.asset_type,
          current_value: roundCurrency(input.current_value),
          quantity: input.quantity,
          unit: input.unit?.trim() || null,
          notes: input.notes?.trim() || null,
        });
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch("/api/assets", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useUpdateAssetValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      current_value: number;
      notes?: string | null;
      owner_confirmed: boolean;
    }) => {
      if (!input.owner_confirmed) {
        throw new Error("Persetujuan eksplisit Owner wajib dicentang.");
      }
      if (!Number.isFinite(input.current_value) || input.current_value < 0) {
        throw new Error("Nilai taksiran aset harus >= Rp 0.");
      }
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("assets")
          .update({
            current_value: roundCurrency(input.current_value),
            notes: input.notes ?? null,
          })
          .eq("id", input.id);
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch(`/api/assets/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      creditor: string;
      original_amount: number;
      outstanding_balance: number;
      due_date: string | null;
      description: string | null;
      owner_confirmed: boolean;
    }) => {
      validateDebtInput(input);
      if (isSupabaseConfigured && supabase) {
        const cleanOutstanding = roundCurrency(input.outstanding_balance);
        const { error } = await supabase.from("debts").insert({
          creditor: input.creditor.trim(),
          original_amount: roundCurrency(input.original_amount),
          outstanding_balance: cleanOutstanding,
          due_date: input.due_date || null,
          description: input.description?.trim() || null,
          status: cleanOutstanding === 0 ? "paid" : "active",
        });
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch("/api/debts", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function usePayDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      debt_id: string;
      amount: number;
      source_account_id: string;
      owner_confirmed: boolean;
    }) => {
      if (!input.owner_confirmed) {
        throw new Error("Persetujuan eksplisit Owner wajib dicentang.");
      }
      if (isSupabaseConfigured && supabase) {
        const { data: debt, error: getErr } = await supabase
          .from("debts")
          .select("*")
          .eq("id", input.debt_id)
          .single();
        if (getErr || !debt) throw new Error(getErr?.message || "Utang tidak ditemukan.");

        const paymentAmount = roundCurrency(input.amount);
        validateDebtPaymentInput(
          {
            status: String(debt.status ?? "active"),
            outstanding_balance: Number(debt.outstanding_balance ?? 0),
          },
          paymentAmount,
          input.source_account_id,
          input.owner_confirmed
        );

        const remaining = Math.max(
          0,
          roundCurrency(Number(debt.outstanding_balance) - paymentAmount)
        );
        const { data: insertedTx, error: txErr } = await supabase
          .from("transactions")
          .insert({
            transaction_type: "expense",
            source_account_id: input.source_account_id,
            destination_account_id: null,
            amount: paymentAmount,
            transaction_date: todayISO(),
            category: "Utang & Cicilan",
            description: `Pembayaran utang ke ${debt.creditor}`,
            status: "posted",
            owner_confirmed: true,
          })
          .select("id")
          .single();
        if (txErr || !insertedTx) {
          throw new Error(txErr?.message || "Gagal mencatat transaksi pembayaran utang.");
        }

        const { error: updErr } = await supabase
          .from("debts")
          .update({
            outstanding_balance: remaining,
            status: remaining === 0 ? "paid" : "active",
          })
          .eq("id", input.debt_id);
        if (updErr) {
          await supabase.from("transactions").delete().eq("id", insertedTx.id);
          throw new Error(updErr.message);
        }
        return;
      }

      return apiFetch(`/api/debts/${input.debt_id}/pay`, {
        method: "POST",
        body: JSON.stringify({
          amount: input.amount,
          source_account_id: input.source_account_id,
          owner_confirmed: input.owner_confirmed,
        }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useQueueCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { command_text: string; parsed_draft?: ParsedCommandDraft }) => {
      const cleanText = input.command_text.trim();
      if (cleanText.length < 1 || cleanText.length > 500) {
        throw new Error("Perintah harus berisi 1–500 karakter.");
      }
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("owner_commands").insert({
          command_text: cleanText,
          status: "pending",
          parsed_draft: input.parsed_draft ?? null,
        });
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch<OwnerCommand>("/api/commands", {
        method: "POST",
        body: JSON.stringify({
          command_text: cleanText,
          parsed_draft: input.parsed_draft,
        }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useApproveCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      draft: ParsedCommandDraft;
      owner_confirmed: boolean;
    }) => {
      if (!input.owner_confirmed) {
        throw new Error("Persetujuan eksplisit Owner wajib dicentang.");
      }
      const amount = roundCurrency(Number(input.draft.amount ?? 0));
      const txType = input.draft.transaction_type;
      const sourceId =
        txType === "income" ? null : input.draft.source_account_id || null;
      const destId =
        txType === "expense" ? null : input.draft.destination_account_id || null;

      validateTransactionPayload({
        transaction_type: txType,
        source_account_id: sourceId,
        destination_account_id: destId,
        amount,
        status: "posted",
        owner_confirmed: input.owner_confirmed,
      });

      if (isSupabaseConfigured && supabase) {
        const { data: existingCmd, error: cmdFetchErr } = await supabase
          .from("owner_commands")
          .select("id, status")
          .eq("id", input.id)
          .single();
        if (cmdFetchErr || !existingCmd) {
          throw new Error(cmdFetchErr?.message || "Perintah tidak ditemukan.");
        }
        if (existingCmd.status !== "pending") {
          throw new Error("Perintah ini sudah diproses sebelumnya.");
        }

        const cleanDraft: ParsedCommandDraft = {
          ...input.draft,
          amount,
          source_account_id: sourceId,
          destination_account_id: destId,
          transaction_date: (input.draft.transaction_date || todayISO()).slice(0, 10),
          category: (input.draft.category || "Lainnya").trim(),
          description: (input.draft.description || "Transaksi Owner").trim(),
        };

        const { data: insertedTx, error: txErr } = await supabase
          .from("transactions")
          .insert({
            transaction_type: cleanDraft.transaction_type,
            source_account_id: cleanDraft.source_account_id,
            destination_account_id: cleanDraft.destination_account_id,
            amount: cleanDraft.amount,
            transaction_date: cleanDraft.transaction_date,
            category: cleanDraft.category,
            description: cleanDraft.description,
            status: "posted",
            owner_confirmed: true,
          })
          .select("id")
          .single();
        if (txErr || !insertedTx) {
          throw new Error(txErr?.message || "Gagal memposting transaksi draf.");
        }

        const { error: cmdErr } = await supabase
          .from("owner_commands")
          .update({ status: "processed", parsed_draft: cleanDraft })
          .eq("id", input.id)
          .eq("status", "pending");
        if (cmdErr) {
          await supabase.from("transactions").delete().eq("id", insertedTx.id);
          throw new Error(cmdErr.message);
        }
        return;
      }

      return apiFetch(`/api/commands/${input.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          draft: input.draft,
          owner_confirmed: input.owner_confirmed,
        }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useRejectCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("owner_commands")
          .update({ status: "rejected" })
          .eq("id", id);
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch(`/api/commands/${id}/reject`, { method: "POST" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      date_format: DateFormatPref;
      expense_alert_limit: number;
    }) => {
      if (isSupabaseConfigured) {
        window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(input));
        return input;
      }
      return apiFetch<OwnerPreferences>("/api/preferences", {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useFinancialSearch() {
  return useMutation({
    mutationFn: async (query: string) => {
      return apiFetch<{ answer: string; sources: SearchSource[] }>("/api/ai/search", {
        method: "POST",
        body: JSON.stringify({ query }),
      });
    },
  });
}

export function useScanReceipt() {
  return useMutation({
    mutationFn: async (input: {
      imageBase64: string;
      mimeType: string;
      accounts?: Account[];
    }) => {
      return apiFetch<{
        commandText: string;
        draft: ParsedCommandDraft;
        merchant: string;
      }>("/api/ai/scan-receipt", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
  });
}

export function useCreateRecurringBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      transaction_type: "income" | "expense";
      amount: number;
      category: string;
      account_id: string | null;
      frequency: RecurringFrequency;
      next_due_date: string;
      notes: string | null;
      owner_confirmed: boolean;
    }) => {
      validateRecurringBillInput(input);
      if (isSupabaseConfigured && supabase) {
        const { owner_confirmed: _oc, ...payload } = input;
        const { error } = await supabase.from("recurring_bills").insert({
          ...payload,
          title: payload.title.trim(),
          amount: roundCurrency(payload.amount),
          category: payload.category.trim() || "Utilitas & Tagihan",
          notes: payload.notes?.trim() || null,
          is_active: true,
        });
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch<RecurringBill>("/api/recurring", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useToggleRecurringBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; is_active: boolean }) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("recurring_bills")
          .update({ is_active: input.is_active })
          .eq("id", input.id);
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch<RecurringBill>(`/api/recurring/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: input.is_active }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useQueueRecurringBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bill: RecurringBill) => {
      if (isSupabaseConfigured && supabase) {
        const draft: ParsedCommandDraft = {
          transaction_type: bill.transaction_type,
          amount: bill.amount,
          category: bill.category,
          description: `${bill.title} (Tagihan Rutin ${bill.next_due_date})`,
          source_account_id: bill.transaction_type === "expense" ? bill.account_id : null,
          destination_account_id: bill.transaction_type === "income" ? bill.account_id : null,
          source_hint: null,
          destination_hint: null,
          transaction_date: todayISO(),
          confidence: bill.account_id ? "high" : "medium",
          warnings: bill.account_id
            ? []
            : [
                bill.transaction_type === "income"
                  ? "Pilih akun tujuan pemasukan sebelum menyetujui."
                  : "Pilih akun sumber dana sebelum menyetujui.",
              ],
        };

        const { data: insertedCmd, error: cmdErr } = await supabase
          .from("owner_commands")
          .insert({
            command_text: `[Tagihan Rutin] ${bill.title} · Rp ${bill.amount.toLocaleString("id-ID")} (Jatuh tempo ${bill.next_due_date})`,
            status: "pending",
            parsed_draft: draft,
          })
          .select("id")
          .single();
        if (cmdErr || !insertedCmd) {
          throw new Error(cmdErr?.message || "Gagal mengajukan tagihan rutin ke antrean.");
        }

        const nextDue = advanceDueDate(bill.next_due_date, bill.frequency);
        const { error: updErr } = await supabase
          .from("recurring_bills")
          .update({
            last_queued_date: bill.next_due_date,
            next_due_date: nextDue,
          })
          .eq("id", bill.id);
        if (updErr) {
          await supabase.from("owner_commands").delete().eq("id", insertedCmd.id);
          throw formatSupabaseTableWriteError(updErr);
        }
        return;
      }

      return apiFetch<{ command: OwnerCommand; bill: RecurringBill }>(
        `/api/recurring/${bill.id}/queue`,
        { method: "POST" }
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useDeleteRecurringBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("recurring_bills").delete().eq("id", id);
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch(`/api/recurring/${id}`, { method: "DELETE" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useCreateSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      goal_type: GoalType;
      target_amount: number;
      current_amount: number;
      linked_account_id: string | null;
      target_date: string | null;
      notes: string | null;
      owner_confirmed: boolean;
    }) => {
      validateSavingsGoalInput(input);
      if (isSupabaseConfigured && supabase) {
        const { owner_confirmed: _oc, ...payload } = input;
        const cleanCurrent = payload.linked_account_id
          ? 0
          : roundCurrency(payload.current_amount);
        const cleanTarget = roundCurrency(payload.target_amount);
        const { error } = await supabase.from("savings_goals").insert({
          ...payload,
          title: payload.title.trim(),
          target_amount: cleanTarget,
          current_amount: cleanCurrent,
          notes: payload.notes?.trim() || null,
          status:
            !payload.linked_account_id && cleanCurrent >= cleanTarget
              ? "completed"
              : "active",
        });
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch<SavingsGoal>("/api/goals", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useUpdateGoalProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      current_amount?: number;
      status?: GoalStatus;
      owner_confirmed?: boolean;
      target_amount?: number;
    }) => {
      if (input.current_amount !== undefined) {
        if (!input.owner_confirmed) {
          throw new Error("Persetujuan eksplisit Owner wajib dicentang.");
        }
        if (!Number.isFinite(input.current_amount) || input.current_amount < 0) {
          throw new Error("Nominal progres tabungan harus >= Rp 0.");
        }
      }
      if (isSupabaseConfigured && supabase) {
        const updates: Record<string, unknown> = {};
        if (input.current_amount !== undefined) {
          const cleanAmount = roundCurrency(input.current_amount);
          updates.current_amount = cleanAmount;
          if (
            input.target_amount !== undefined &&
            cleanAmount >= input.target_amount
          ) {
            updates.status = "completed";
          }
        }
        if (input.status) {
          updates.status = input.status;
        }
        const { error } = await supabase
          .from("savings_goals")
          .update(updates)
          .eq("id", input.id);
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch<SavingsGoal>(`/api/goals/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          current_amount: input.current_amount,
          status: input.status,
          owner_confirmed: input.owner_confirmed,
        }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useDeleteSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("savings_goals").delete().eq("id", id);
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch(`/api/goals/${id}`, { method: "DELETE" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export async function requestSpeechAudio(text: string, style?: string): Promise<string> {
  const res = await apiFetch<{ audioBase64: string; mimeType: string }>("/api/ai/tts", {
    method: "POST",
    body: JSON.stringify({ text, style }),
  });
  return `data:${res.mimeType};base64,${res.audioBase64}`;
}
```

---

## 26. `src/lib/finance.ts` (537 lines)

```ts
import type {
  Account,
  AccountBalance,
  AccountType,
  Asset,
  DateFormatPref,
  Debt,
  RecurringBill,
  RecurringFrequency,
  SavingsGoal,
  Transaction,
} from "../types/ego";

export function roundCurrency(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function formatIDR(amount: number, compact = false): string {
  const safe = Number.isFinite(amount) ? roundCurrency(amount) : 0;
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);

  if (compact && abs >= 1_000_000_000) {
    const val = (abs / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
    return `${sign}Rp ${val} M`;
  }
  if (compact && abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(1).replace(/\.0$/, "").replace(".", ",");
    return `${sign}Rp ${val} jt`;
  }

  const hasFraction = Math.abs(abs - Math.round(abs)) > 0.001;
  const formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(abs);

  return `${sign}Rp ${formatted}`;
}

export function formatThousandsInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseThousandsInput(formatted: string): number {
  const digits = formatted.replace(/\D/g, "");
  if (!digits) return 0;
  const num = Number.parseInt(digits, 10);
  return Number.isFinite(num) ? num : 0;
}

export function formatDateID(isoDate: string | null | undefined, pref: DateFormatPref = "DD MMM YYYY"): string {
  if (!isoDate) return "—";
  const datePart = isoDate.slice(0, 10);
  if (pref === "YYYY-MM-DD") return datePart;

  const [y, m, d] = datePart.split("-").map((v) => Number.parseInt(v, 10));
  if (!y || !m || !d) return isoDate;

  if (pref === "DD/MM/YYYY") {
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${String(d).padStart(2, "0")} ${months[m - 1] ?? m} ${y}`;
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isPostedConfirmed(tx: Pick<Transaction, "status" | "owner_confirmed">): boolean {
  return tx.status === "posted" && tx.owner_confirmed === true;
}

export function computeAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): AccountBalance[] {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();

  for (const tx of transactions) {
    if (!isPostedConfirmed(tx)) continue;
    const amt = Number(tx.amount) || 0;
    if (amt <= 0) continue;

    if (tx.destination_account_id) {
      incoming.set(
        tx.destination_account_id,
        roundCurrency((incoming.get(tx.destination_account_id) ?? 0) + amt)
      );
    }
    if (tx.source_account_id) {
      outgoing.set(
        tx.source_account_id,
        roundCurrency((outgoing.get(tx.source_account_id) ?? 0) + amt)
      );
    }
  }

  return accounts.map((acc) => {
    const inSum = incoming.get(acc.id) ?? 0;
    const outSum = outgoing.get(acc.id) ?? 0;
    const current_balance = roundCurrency((Number(acc.opening_balance) || 0) + inSum - outSum);
    return {
      ...acc,
      current_balance,
    };
  });
}

export function groupAccountsByType(accounts: AccountBalance[]): Record<AccountType, AccountBalance[]> {
  return {
    cash: accounts.filter((a) => a.account_type === "cash"),
    bank: accounts.filter((a) => a.account_type === "bank"),
    ewallet: accounts.filter((a) => a.account_type === "ewallet"),
  };
}

export interface NetWorthSummary {
  totalAccountBalance: number;
  totalAssetValue: number;
  totalDebtBalance: number;
  netWorth: number;
}

export function computeNetWorth(
  accountBalances: AccountBalance[],
  assets: Asset[],
  debts: Debt[]
): NetWorthSummary {
  const totalAccountBalance = roundCurrency(
    accountBalances
      .filter((a) => a.is_active)
      .reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0)
  );
  const totalAssetValue = roundCurrency(
    assets.reduce((sum, a) => sum + (Number(a.current_value) || 0), 0)
  );
  const totalDebtBalance = roundCurrency(
    debts
      .filter((d) => d.status === "active")
      .reduce((sum, d) => sum + (Number(d.outstanding_balance) || 0), 0)
  );

  const netWorth = roundCurrency(totalAccountBalance + totalAssetValue - totalDebtBalance);

  return {
    totalAccountBalance,
    totalAssetValue,
    totalDebtBalance,
    netWorth,
  };
}

export interface CashflowSummary {
  income: number;
  expense: number;
  netCashflow: number;
  transactionCount: number;
}

export function computeMonthlyCashflow(
  transactions: Transaction[],
  yearMonth: string
): CashflowSummary {
  let income = 0;
  let expense = 0;
  let transactionCount = 0;

  for (const tx of transactions) {
    if (!isPostedConfirmed(tx)) continue;
    if (!tx.transaction_date.startsWith(yearMonth)) continue;

    if (tx.transaction_type === "income") {
      income = roundCurrency(income + Number(tx.amount));
      transactionCount += 1;
    } else if (tx.transaction_type === "expense") {
      expense = roundCurrency(expense + Number(tx.amount));
      transactionCount += 1;
    }
  }

  return {
    income,
    expense,
    netCashflow: roundCurrency(income - expense),
    transactionCount,
  };
}

export function accountTypeLabel(type: AccountType): string {
  switch (type) {
    case "cash":
      return "Tunai";
    case "bank":
      return "Bank";
    case "ewallet":
      return "E-Wallet";
  }
}

export function assetTypeLabel(type: Asset["asset_type"]): string {
  switch (type) {
    case "emas":
      return "Emas";
    case "properti":
      return "Properti";
    case "kendaraan":
      return "Kendaraan";
    case "investasi":
      return "Investasi";
    case "elektronik":
      return "Elektronik";
    case "lainnya":
      return "Lainnya";
  }
}

export function daysUntilDue(dueDate: string | null | undefined, referenceDateISO = todayISO()): number | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const ref = new Date(`${referenceDateISO.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(ref.getTime())) return null;
  return Math.round((due.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

const MONTHS_SHORT_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

export interface CashflowMonthPoint {
  monthKey: string;
  label: string;
  shortLabel: string;
  income: number;
  expense: number;
  net: number;
  transactionCount: number;
}

export function computeCashflowSeries(
  transactions: Transaction[],
  monthsCount: 3 | 6 | 12,
  referenceMonth = todayISO().slice(0, 7)
): CashflowMonthPoint[] {
  const match = /^(\d{4})-(\d{2})$/.exec(referenceMonth.slice(0, 7));
  const fallback = todayISO().slice(0, 7);
  const refYear = match
    ? Number.parseInt(match[1], 10)
    : Number.parseInt(fallback.slice(0, 4), 10);
  const refMonth = match
    ? Number.parseInt(match[2], 10)
    : Number.parseInt(fallback.slice(5, 7), 10);

  const buckets = new Map<string, CashflowMonthPoint>();
  const order: string[] = [];

  const refZeroBased = refYear * 12 + (refMonth - 1);
  for (let offset = monthsCount - 1; offset >= 0; offset--) {
    const idx = refZeroBased - offset;
    const year = Math.floor(idx / 12);
    const monthIndex = ((idx % 12) + 12) % 12;
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const shortLabel = MONTHS_SHORT_ID[monthIndex];
    const point: CashflowMonthPoint = {
      monthKey,
      label: `${shortLabel} ${year}`,
      shortLabel,
      income: 0,
      expense: 0,
      net: 0,
      transactionCount: 0,
    };
    buckets.set(monthKey, point);
    order.push(monthKey);
  }

  for (const tx of transactions) {
    if (!isPostedConfirmed(tx)) continue;
    if (tx.transaction_type !== "income" && tx.transaction_type !== "expense") {
      continue;
    }
    const amt = Number(tx.amount) || 0;
    if (amt <= 0) continue;

    const monthKey = tx.transaction_date.slice(0, 7);
    const bucket = buckets.get(monthKey);
    if (!bucket) continue;

    if (tx.transaction_type === "income") {
      bucket.income = roundCurrency(bucket.income + amt);
    } else {
      bucket.expense = roundCurrency(bucket.expense + amt);
    }
    bucket.net = roundCurrency(bucket.income - bucket.expense);
    bucket.transactionCount += 1;
  }

  return order.map((key) => buckets.get(key)!);
}

export interface CategoryBreakdownItem {
  category: string;
  total: number;
  percentage: number;
  count: number;
}

export interface CategoryBreakdownResult {
  type: "income" | "expense";
  totalAmount: number;
  totalCount: number;
  items: CategoryBreakdownItem[];
}

export interface CategoryBreakdownOptions {
  yearMonth?: string;
  fromDate?: string;
  toDate?: string;
}

export function computeCategoryBreakdown(
  transactions: Transaction[],
  type: "income" | "expense",
  options: CategoryBreakdownOptions = {}
): CategoryBreakdownResult {
  const groups = new Map<string, { total: number; count: number }>();
  let totalAmount = 0;
  let totalCount = 0;

  for (const tx of transactions) {
    if (!isPostedConfirmed(tx)) continue;
    if (tx.transaction_type !== type) continue;

    const txDate = tx.transaction_date.slice(0, 10);
    if (options.yearMonth && !txDate.startsWith(options.yearMonth)) continue;
    if (options.fromDate && txDate < options.fromDate) continue;
    if (options.toDate && txDate > options.toDate) continue;

    const amt = Number(tx.amount) || 0;
    if (amt <= 0) continue;

    const category = (tx.category ?? "").trim() || "Umum";
    const existing = groups.get(category) ?? { total: 0, count: 0 };
    existing.total = roundCurrency(existing.total + amt);
    existing.count += 1;
    groups.set(category, existing);

    totalAmount = roundCurrency(totalAmount + amt);
    totalCount += 1;
  }

  const items: CategoryBreakdownItem[] = Array.from(groups.entries())
    .map(([category, data]) => ({
      category,
      total: data.total,
      percentage:
        totalAmount > 0
          ? Math.round(((data.total / totalAmount) * 100 + Number.EPSILON) * 10) / 10
          : 0,
      count: data.count,
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.count !== a.count) return b.count - a.count;
      return a.category.localeCompare(b.category, "id");
    });

  return {
    type,
    totalAmount,
    totalCount,
    items,
  };
}

export function getGreetingID(hour = new Date().getHours()): string {
  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 19) return "Selamat sore";
  return "Selamat malam";
}

export function advanceDueDate(
  isoDate: string,
  frequency: RecurringFrequency
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return todayISO();

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (frequency === "weekly") {
    const dt = new Date(Date.UTC(year, month - 1, day + 7));
    return dt.toISOString().slice(0, 10);
  }

  if (frequency === "yearly") {
    const targetYear = year + 1;
    const maxDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
    const clampedDay = Math.min(day, maxDay);
    return `${targetYear}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
  }

  // monthly (clamp day to target month's last day, e.g. Jan 31 -> Feb 28/29)
  const zeroBasedMonth = month - 1 + 1;
  const targetYear = year + Math.floor(zeroBasedMonth / 12);
  const targetMonthIndex = ((zeroBasedMonth % 12) + 12) % 12;
  const maxDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, maxDay);
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export function getDueRecurringBills(
  bills: RecurringBill[],
  referenceDateISO = todayISO(),
  windowDays = 7
): RecurringBill[] {
  return bills
    .filter((bill) => {
      if (!bill.is_active) return false;
      if (bill.last_queued_date && bill.last_queued_date === bill.next_due_date) {
        return false;
      }
      const delta = daysUntilDue(bill.next_due_date, referenceDateISO);
      return delta !== null && delta <= windowDays;
    })
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
}

export function recurringFrequencyLabel(freq: RecurringFrequency): string {
  switch (freq) {
    case "weekly":
      return "Mingguan";
    case "monthly":
      return "Bulanan";
    case "yearly":
      return "Tahunan";
  }
}

export interface GoalProgressResult {
  savedAmount: number;
  targetAmount: number;
  remainingAmount: number;
  percentage: number;
  isCompleted: boolean;
}

export function computeGoalProgress(
  goal: SavingsGoal,
  linkedAccount?: Pick<AccountBalance, "current_balance">
): GoalProgressResult {
  const targetAmount = Math.max(0, roundCurrency(Number(goal.target_amount) || 0));
  const rawSaved = linkedAccount
    ? Math.max(0, Number(linkedAccount.current_balance) || 0)
    : Math.max(0, Number(goal.current_amount) || 0);
  const savedAmount = roundCurrency(rawSaved);
  const remainingAmount = roundCurrency(Math.max(0, targetAmount - savedAmount));
  const percentage =
    targetAmount > 0
      ? Math.min(100, Math.round(((savedAmount / targetAmount) * 100 + Number.EPSILON) * 10) / 10)
      : 0;
  const isCompleted =
    goal.status === "completed" || (targetAmount > 0 && savedAmount >= targetAmount);

  return {
    savedAmount,
    targetAmount,
    remainingAmount,
    percentage,
    isCompleted,
  };
}

export function computeAverageMonthlyCashflow(
  transactions: Transaction[],
  monthsCount: 3 | 6 | 12 = 3,
  referenceMonth = todayISO().slice(0, 7)
): { avgIncome: number; avgExpense: number; avgNet: number } {
  const series = computeCashflowSeries(transactions, monthsCount, referenceMonth);
  const activeMonths = series.filter((m) => m.transactionCount > 0);
  const divisor = Math.max(1, activeMonths.length);
  const totalIncome = activeMonths.reduce((s, m) => s + m.income, 0);
  const totalExpense = activeMonths.reduce((s, m) => s + m.expense, 0);
  const avgIncome = roundCurrency(totalIncome / divisor);
  const avgExpense = roundCurrency(totalExpense / divisor);
  return {
    avgIncome,
    avgExpense,
    avgNet: roundCurrency(avgIncome - avgExpense),
  };
}

export function estimateGoalCompletionMonths(
  remainingAmount: number,
  avgMonthlyNetCashflow: number
): number | null {
  if (remainingAmount <= 0) return 0;
  if (!Number.isFinite(avgMonthlyNetCashflow) || avgMonthlyNetCashflow <= 0) {
    return null;
  }
  return Math.ceil(remainingAmount / avgMonthlyNetCashflow);
}

export function computeEmergencyFundMonths(
  liquidBalance: number,
  avgMonthlyExpense: number
): number | null {
  if (!Number.isFinite(avgMonthlyExpense) || avgMonthlyExpense <= 0) return null;
  if (!Number.isFinite(liquidBalance) || liquidBalance <= 0) return 0;
  return Math.round(((liquidBalance / avgMonthlyExpense) + Number.EPSILON) * 10) / 10;
}


```

---

## 27. `src/lib/command-parser.ts` (356 lines)

```ts
import type { Account, ParsedCommandDraft, TransactionType } from "../types/ego";
import { todayISO } from "./finance";

const INCOME_KEYWORDS = [
  "terima",
  "gaji",
  "pemasukan",
  "bonus",
  "dapat",
  "masuk",
  "dividen",
  "refund",
  "jual",
  "pendapatan",
  "thr",
  "honor",
];

const TRANSFER_KEYWORDS = [
  "transfer ke",
  "pindah saldo",
  "pindah dana",
  "tarik tunai",
  "setor tunai",
  "topup",
  "top up",
  "isi saldo",
  "kirim ke",
];

const EXPENSE_KEYWORDS = [
  "bayar",
  "beli",
  "jajan",
  "makan",
  "minum",
  "ngopi",
  "kopi",
  "ongkir",
  "cicilan",
  "tagihan",
  "keluar",
  "pengeluaran",
  "belanja",
  "sewa",
  "langganan",
];

const KNOWN_PROVIDERS = [
  "bca",
  "mandiri",
  "bri",
  "bni",
  "bsi",
  "cimb",
  "jago",
  "blu",
  "seabank",
  "gopay",
  "ovo",
  "dana",
  "shopeepay",
  "linkaja",
  "tunai",
  "cash",
  "dompet",
  "kas",
];

function parseNumericToken(rawNum: string, suffix?: string): number | null {
  const sfx = (suffix ?? "").toLowerCase();
  let cleaned = rawNum.trim();

  if (sfx) {
    // With multiplier suffix like 1.4jt, 1,5jt, 25rb, 500k
    if (cleaned.includes(".") && cleaned.includes(",")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (cleaned.includes(",")) {
      cleaned = cleaned.replace(",", ".");
    } else if (cleaned.includes(".")) {
      // If e.g. 1.500 -> thousand separator, whereas 1.4 -> decimal
      const parts = cleaned.split(".");
      if (parts.length === 2 && parts[1].length === 3) {
        cleaned = parts.join("");
      }
    }
    const base = Number.parseFloat(cleaned);
    if (!Number.isFinite(base) || base <= 0) return null;

    if (sfx === "rb" || sfx === "ribu" || sfx === "k") {
      return Math.round(base * 1_000);
    }
    if (sfx === "jt" || sfx === "juta") {
      return Math.round(base * 1_000_000);
    }
    if (sfx === "m" || sfx === "miliar" || sfx === "milyar") {
      return Math.round(base * 1_000_000_000);
    }
    return Math.round(base);
  }

  // Without suffix: treat dots as thousand separators if grouped in 3 digits (e.g. 1.500.000)
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "");
  } else if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "");
  } else {
    cleaned = cleaned.replace(/,/g, ".");
  }

  const val = Number.parseFloat(cleaned);
  if (!Number.isFinite(val) || val <= 0) return null;
  return Math.round(val);
}

export function extractAmountFromCommand(text: string): number | null {
  // Prioritize numbers with explicit currency / Indonesian unit suffixes
  const withUnitRegex =
    /(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta|miliar|milyar|m)\b/gi;
  const unitMatches = [...text.matchAll(withUnitRegex)];
  if (unitMatches.length > 0) {
    // Pick the largest plausible financial amount if multiple numbers exist (e.g. "beli emas 1 gram 1.4jt")
    let best: number | null = null;
    for (const m of unitMatches) {
      const val = parseNumericToken(m[1], m[2]);
      if (val !== null && (best === null || val > best)) {
        best = val;
      }
    }
    if (best !== null) return best;
  }

  // Fallback: explicit Rp prefix or multi-digit number >= 1000
  const rpRegex = /rp\.?\s*(\d+(?:[.,]\d{3})+|\d{4,})/gi;
  const rpMatch = rpRegex.exec(text);
  if (rpMatch) {
    return parseNumericToken(rpMatch[1]);
  }

  const plainDigitsRegex = /\b(\d{1,3}(?:[.,]\d{3})+|\d{4,})\b/g;
  const plainMatch = plainDigitsRegex.exec(text);
  if (plainMatch) {
    return parseNumericToken(plainMatch[1]);
  }

  return null;
}

export function findBestAccountMatch(
  hintText: string,
  accounts: Account[]
): Account | null {
  const active = accounts.filter((a) => a.is_active);
  const pool = active.length > 0 ? active : accounts;
  if (pool.length === 0) return null;

  const lower = hintText.toLowerCase().trim();
  if (!lower) return null;

  // 1. Exact or substring match on account_name
  const exact = pool.find((a) => a.account_name.toLowerCase() === lower);
  if (exact) return exact;

  const contains = pool.find(
    (a) =>
      lower.includes(a.account_name.toLowerCase()) ||
      a.account_name.toLowerCase().includes(lower)
  );
  if (contains) return contains;

  // 2. Token overlap (e.g. "tabungan mandiri" matches "Bank Mandiri")
  const tokens = lower.split(/\s+/).filter((t) => t.length >= 3);
  for (const tok of tokens) {
    const tokMatch = pool.find((a) => a.account_name.toLowerCase().includes(tok));
    if (tokMatch) return tokMatch;
  }

  // 3. Fallback by account_type keywords
  if (/\b(tunai|cash|dompet|kas)\b/i.test(lower)) {
    return pool.find((a) => a.account_type === "cash") ?? null;
  }
  if (/\b(gopay|ovo|dana|shopeepay|linkaja|ewallet|e-wallet)\b/i.test(lower)) {
    return pool.find((a) => a.account_type === "ewallet") ?? null;
  }
  if (/\b(bca|mandiri|bri|bni|bsi|cimb|jago|blu|seabank|bank|rekening|tabungan)\b/i.test(lower)) {
    return pool.find((a) => a.account_type === "bank") ?? null;
  }

  return null;
}

function inferCategory(text: string, type: TransactionType): string {
  const lower = text.toLowerCase();
  if (type === "transfer") return "Transfer Internal";
  if (type === "income") {
    if (/\b(gaji|honor|upah|thr)\b/.test(lower)) return "Gaji & Pendapatan";
    if (/\b(bonus|komisi|dividen|bunga)\b/.test(lower)) return "Bonus & Investasi";
    if (/\b(jual|penjualan|refund|cashback)\b/.test(lower)) return "Penjualan & Refund";
    return "Pemasukan Lainnya";
  }

  if (/\b(kopi|ngopi|makan|minum|sarapan|siang|malam|resto|kafe|warteg|jajan)\b/.test(lower)) {
    return "Makanan & Minuman";
  }
  if (/\b(emas|antam|saham|reksadana|obligasi|crypto|investasi)\b/.test(lower)) {
    return "Investasi & Aset";
  }
  if (/\b(bensin|grab|gojek|ojol|tol|parkir|kereta|pesawat|tiket|transport)\b/.test(lower)) {
    return "Transportasi";
  }
  if (/\b(listrik|pln|air|pdam|internet|wifi|pulsa|kuota|tagihan|bpjs)\b/.test(lower)) {
    return "Utilitas & Tagihan";
  }
  if (/\b(cicilan|utang|pinjaman|kredit|kartu kredit)\b/.test(lower)) {
    return "Utang & Cicilan";
  }
  if (/\b(belanja|baju|sepatu|tokopedia|shopee|supermarket|minimarket)\b/.test(lower)) {
    return "Belanja";
  }
  return "Pengeluaran Lainnya";
}

function extractAccountHints(text: string, accounts: Account[]): {
  sourceHint: string | null;
  destHint: string | null;
} {
  const lower = text.toLowerCase();

  // Check explicit "dari X ke Y" pattern
  const fromToMatch = /\bdari\s+([a-z0-9\s-]{2,28}?)\s+ke\s+([a-z0-9\s-]{2,28})/i.exec(lower);
  if (fromToMatch) {
    return {
      sourceHint: fromToMatch[1].trim(),
      destHint: fromToMatch[2].trim(),
    };
  }

  // Check "pakai X" / "via X" / "dari X"
  const srcMatch = /\b(?:pakai|pake|via|lewat|menggunakan|dari)\s+([a-z0-9\s-]{2,28})/i.exec(lower);
  const dstMatch = /\b(?:ke|masuk ke|ke rekening|ke akun)\s+([a-z0-9\s-]{2,28})/i.exec(lower);

  let sourceHint = srcMatch ? srcMatch[1].trim() : null;
  let destHint = dstMatch ? dstMatch[1].trim() : null;

  // Also scan known account names or provider keywords anywhere in text
  if (!sourceHint && !destHint) {
    for (const acc of accounts) {
      if (lower.includes(acc.account_name.toLowerCase())) {
        sourceHint = acc.account_name;
        destHint = acc.account_name;
        break;
      }
    }
    if (!sourceHint) {
      for (const kw of KNOWN_PROVIDERS) {
        const rx = new RegExp(`\\b${kw}\\b`, "i");
        if (rx.test(lower)) {
          sourceHint = kw;
          destHint = kw;
          break;
        }
      }
    }
  }

  return { sourceHint, destHint };
}

export function parseNaturalCommand(
  commandText: string,
  accounts: Account[] = []
): ParsedCommandDraft {
  const trimmed = commandText.trim();
  const lower = trimmed.toLowerCase();
  const warnings: string[] = [];

  // 1. Determine transaction_type
  let transactionType: TransactionType = "expense";
  const hasFromTo = /\bdari\s+.+\s+ke\s+/i.test(lower);
  const isTransferKw = TRANSFER_KEYWORDS.some((kw) => lower.includes(kw));
  const isIncomeKw = INCOME_KEYWORDS.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(lower));
  const isExpenseKw = EXPENSE_KEYWORDS.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(lower));

  if (hasFromTo || isTransferKw) {
    transactionType = "transfer";
  } else if (isIncomeKw && !isExpenseKw) {
    transactionType = "income";
  } else if (isIncomeKw && /\b(terima|gaji|pemasukan|bonus|dividen|refund)\b/i.test(lower)) {
    transactionType = "income";
  } else {
    transactionType = "expense";
  }

  // 2. Extract amount
  const amount = extractAmountFromCommand(trimmed);
  if (amount === null) {
    warnings.push("Nominal belum terdeteksi. Mohon lengkapi atau koreksi nominal sebelum menyetujui.");
  }

  // 3. Extract & resolve accounts
  const { sourceHint, destHint } = extractAccountHints(trimmed, accounts);
  let sourceAccountId: string | null = null;
  let destinationAccountId: string | null = null;

  if (transactionType === "expense") {
    const hint = sourceHint ?? destHint ?? "";
    const matched = findBestAccountMatch(hint, accounts) ?? findBestAccountMatch(trimmed, accounts);
    sourceAccountId = matched?.id ?? null;
    if (!sourceAccountId) {
      warnings.push("Akun sumber dana belum cocok dengan daftar akun aktif Owner.");
    }
  } else if (transactionType === "income") {
    const hint = destHint ?? sourceHint ?? "";
    const matched = findBestAccountMatch(hint, accounts) ?? findBestAccountMatch(trimmed, accounts);
    destinationAccountId = matched?.id ?? null;
    if (!destinationAccountId) {
      warnings.push("Akun tujuan pemasukan belum cocok dengan daftar akun aktif Owner.");
    }
  } else {
    // transfer
    const srcMatch = sourceHint ? findBestAccountMatch(sourceHint, accounts) : null;
    const dstMatch = destHint ? findBestAccountMatch(destHint, accounts) : null;
    sourceAccountId = srcMatch?.id ?? null;
    destinationAccountId = dstMatch?.id ?? null;
    if (!sourceAccountId || !destinationAccountId || sourceAccountId === destinationAccountId) {
      warnings.push("Transfer membutuhkan akun sumber dan akun tujuan yang berbeda.");
    }
  }

  // 4. Category & clean description
  const category = inferCategory(trimmed, transactionType);
  const description = trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;

  // 5. Confidence
  let confidence: ParsedCommandDraft["confidence"] = "high";
  if (amount === null || warnings.length >= 2) {
    confidence = "low";
  } else if (warnings.length === 1) {
    confidence = "medium";
  }

  return {
    transaction_type: transactionType,
    amount,
    category,
    description,
    source_account_id: sourceAccountId,
    destination_account_id: destinationAccountId,
    source_hint: sourceHint,
    destination_hint: destHint,
    transaction_date: todayISO(),
    confidence,
    warnings,
  };
}
```

---

## 28. `src/lib/export.ts` (105 lines)

```ts
import type { Account, Transaction } from "../types/ego";
import type { VaultSnapshot } from "./queries";

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

function txTypeLabelID(type: Transaction["transaction_type"]): string {
  if (type === "income") return "Pemasukan";
  if (type === "expense") return "Pengeluaran";
  return "Transfer";
}

function txStatusLabelID(status: Transaction["status"]): string {
  if (status === "posted") return "Terposting";
  if (status === "cancelled") return "Dibatalkan";
  return "Menunggu";
}

export function transactionsToCsv(
  transactions: Transaction[],
  accounts: Pick<Account, "id" | "account_name">[]
): string {
  const accountMap = new Map<string, string>();
  for (const acc of accounts) {
    accountMap.set(acc.id, acc.account_name);
  }

  const headers = [
    "Tanggal",
    "Jenis",
    "Kategori",
    "Keterangan",
    "Akun Sumber",
    "Akun Tujuan",
    "Nominal (IDR)",
    "Status",
    "Disetujui Owner",
  ];

  const rows = transactions.map((tx) => [
    tx.transaction_date,
    txTypeLabelID(tx.transaction_type),
    tx.category ?? "Umum",
    tx.description ?? "",
    tx.source_account_id ? accountMap.get(tx.source_account_id) ?? "" : "",
    tx.destination_account_id
      ? accountMap.get(tx.destination_account_id) ?? ""
      : "",
    tx.amount,
    txStatusLabelID(tx.status),
    tx.owner_confirmed ? "Ya" : "Tidak",
  ]);

  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvCell).join(",")
  );
  // Prepend UTF-8 BOM so Microsoft Excel & Google Sheets preserve Indonesian text cleanly
  return `\uFEFF${lines.join("\r\n")}`;
}

export interface VaultBackupPayload {
  app: "EGO Personal AI";
  version: "1.0";
  exported_at: string;
  owner_email: string | null;
  data: VaultSnapshot;
}

export function vaultSnapshotToBackupJson(
  snapshot: VaultSnapshot,
  ownerEmail: string | null,
  exportedAt = new Date().toISOString()
): string {
  const payload: VaultBackupPayload = {
    app: "EGO Personal AI",
    version: "1.0",
    exported_at: exportedAt,
    owner_email: ownerEmail,
    data: snapshot,
  };
  return JSON.stringify(payload, null, 2);
}

export function triggerBrowserDownload(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

---

## 29. `src/lib/pin-lock.ts` (153 lines)

```ts
const PIN_LOCKED_STORAGE_KEY = "ego_pin_locked";
const PIN_AUTOLOCK_STORAGE_KEY = "ego_pin_autolock";
const PIN_SESSION_UNLOCKED_KEY = "ego_pin_unlocked_session";
const PIN_LOCK_CHANGE_EVENT = "ego-pin-lock-change";

function emitPinLockChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PIN_LOCK_CHANGE_EVENT));
  }
}

export function subscribePinLockChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PIN_LOCK_CHANGE_EVENT, listener);
  return () => window.removeEventListener(PIN_LOCK_CHANGE_EVENT, listener);
}

export function isPinLocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PIN_LOCKED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPinLocked(locked: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (locked) {
      window.localStorage.setItem(PIN_LOCKED_STORAGE_KEY, "1");
      window.sessionStorage.removeItem(PIN_SESSION_UNLOCKED_KEY);
    } else {
      window.localStorage.removeItem(PIN_LOCKED_STORAGE_KEY);
      window.sessionStorage.setItem(PIN_SESSION_UNLOCKED_KEY, "1");
    }
  } catch {
    // Ignore storage error
  }
  emitPinLockChange();
}

export function isAutoLockEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = window.localStorage.getItem(PIN_AUTOLOCK_STORAGE_KEY);
    return val !== "0";
  } catch {
    return true;
  }
}

export function setAutoLockEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PIN_AUTOLOCK_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore storage error
  }
  emitPinLockChange();
}

export function isPinSessionUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PIN_SESSION_UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPinSessionUnlocked(): void {
  setPinLocked(false);
}

export function clearPinSessionState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PIN_LOCKED_STORAGE_KEY);
    window.sessionStorage.removeItem(PIN_SESSION_UNLOCKED_KEY);
  } catch {
    // Ignore storage error
  }
  emitPinLockChange();
}

export function shouldShowPinLockScreen(hasPin: boolean): boolean {
  if (!hasPin) return false;
  if (isPinLocked()) return true;
  if (isAutoLockEnabled() && !isPinSessionUnlocked()) return true;
  return false;
}

// WebCrypto PBKDF2-SHA256 helpers used for Supabase Cloud mode PIN verification
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function derivePinBits(pin: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function hashPinWebCrypto(pin: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const derivedHex = await derivePinBits(pin, salt);
  return `${bytesToHex(salt)}:${derivedHex}`;
}

export async function verifyPinWebCrypto(
  pin: string,
  storedHash: string
): Promise<boolean> {
  const [saltHex, expectedHex] = storedHash.split(":");
  if (!saltHex || !expectedHex) return false;
  const salt = hexToBytes(saltHex);
  const actualHex = await derivePinBits(pin, salt);
  if (actualHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) {
    diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}
```

---

## 30. `src/lib/pwa.ts` (86 lines)

```ts
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function install(): Promise<boolean> {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }

  return {
    isInstallable: deferredPrompt !== null,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
```

---

## 31. `src/lib/theme.tsx` (118 lines)

```tsx
import { Moon, Sun } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export type EgoTheme = "light" | "dark";

const THEME_STORAGE_KEY = "ego_theme";

interface ThemeContextValue {
  theme: EgoTheme;
  setTheme: (theme: EgoTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): EgoTheme {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<EgoTheme>(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme]);

  function setTheme(next: EgoTheme) {
    setThemeState(next);
  }

  function toggleTheme() {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme harus dipanggil di dalam ThemeProvider.");
  }
  return ctx;
}

export function ThemeToggleButton({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Pilih tema tampilan"
      className={`inline-flex items-center rounded-xl border border-stone-200 bg-stone-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      <button
        type="button"
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light")}
        className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
          theme === "light"
            ? "bg-white text-stone-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
            : "text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
      >
        <Sun className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
        {!compact ? <span>Terang</span> : null}
      </button>
      <button
        type="button"
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
        className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
          theme === "dark"
            ? "bg-zinc-800 text-zinc-100 shadow-xs"
            : "text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
      >
        <Moon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        {!compact ? <span>Gelap</span> : null}
      </button>
    </div>
  );
}
```

---

## 32. `src/lib/command-parser.test.ts` (79 lines)

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseNaturalCommand } from "./command-parser";
import type { Account } from "../types/ego";

const mockAccounts: Account[] = [
  {
    id: "acc-gopay",
    owner_id: "owner-1",
    account_name: "GoPay",
    account_type: "ewallet",
    opening_balance: 500_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
  {
    id: "acc-bca",
    owner_id: "owner-1",
    account_name: "BCA",
    account_type: "bank",
    opening_balance: 10_000_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
  {
    id: "acc-mandiri",
    owner_id: "owner-1",
    account_name: "Tabungan Mandiri",
    account_type: "bank",
    opening_balance: 5_000_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
];

test("parses Indonesian expense slang with rb and GoPay", () => {
  const draft = parseNaturalCommand("tadi bayar kopi 25rb pakai gopay", mockAccounts);
  assert.equal(draft.transaction_type, "expense");
  assert.equal(draft.amount, 25_000);
  assert.equal(draft.source_account_id, "acc-gopay");
  assert.equal(draft.category, "Makanan & Minuman");
  assert.equal(draft.confidence, "high");
});

test("parses Indonesian income command with jt and BCA", () => {
  const draft = parseNaturalCommand("terima transfer gaji 15jt ke bca", mockAccounts);
  assert.equal(draft.transaction_type, "income");
  assert.equal(draft.amount, 15_000_000);
  assert.equal(draft.destination_account_id, "acc-bca");
  assert.equal(draft.category, "Gaji & Pendapatan");
  assert.equal(draft.confidence, "high");
});

test("parses decimal million expression for gold purchase", () => {
  const draft = parseNaturalCommand("beli emas 1 gram 1.4jt dari tabungan mandiri", mockAccounts);
  assert.equal(draft.transaction_type, "expense");
  assert.equal(draft.amount, 1_400_000);
  assert.equal(draft.source_account_id, "acc-mandiri");
  assert.equal(draft.category, "Investasi & Aset");
});

test("parses transfer between two accounts", () => {
  const draft = parseNaturalCommand("transfer 500k dari bca ke gopay", mockAccounts);
  assert.equal(draft.transaction_type, "transfer");
  assert.equal(draft.amount, 500_000);
  assert.equal(draft.source_account_id, "acc-bca");
  assert.equal(draft.destination_account_id, "acc-gopay");
});

test("marks missing amount as low confidence with warning", () => {
  const draft = parseNaturalCommand("bayar parkir di mall", mockAccounts);
  assert.equal(draft.amount, null);
  assert.equal(draft.confidence, "low");
  assert.ok(draft.warnings.length > 0);
});
```

---

## 33. `src/lib/export.test.ts` (79 lines)

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { transactionsToCsv, vaultSnapshotToBackupJson } from "./export";
import type { Account, Transaction } from "../types/ego";

const sampleAccounts: Pick<Account, "id" | "account_name">[] = [
  { id: "acc-bca", account_name: "BCA Utama" },
  { id: "acc-gopay", account_name: "GoPay" },
];

const sampleTransactions: Transaction[] = [
  {
    id: "tx-1",
    owner_id: "owner-1",
    transaction_type: "expense",
    source_account_id: "acc-gopay",
    destination_account_id: null,
    amount: 45_000,
    transaction_date: "2026-11-24",
    category: "Makanan & Minuman",
    description: 'Kopi, "Pagi" Spesial',
    status: "posted",
    owner_confirmed: true,
    created_at: "2026-11-24T08:00:00Z",
  },
  {
    id: "tx-2",
    owner_id: "owner-1",
    transaction_type: "income",
    source_account_id: null,
    destination_account_id: "acc-bca",
    amount: 15_000_000,
    transaction_date: "2026-11-01",
    category: "Gaji & Pendapatan",
    description: "Gaji Bulanan",
    status: "posted",
    owner_confirmed: true,
    created_at: "2026-11-01T08:00:00Z",
  },
];

test("transactionsToCsv emits UTF-8 BOM, headers, and properly escaped Indonesian cells", () => {
  const csv = transactionsToCsv(sampleTransactions, sampleAccounts);
  assert.equal(csv.startsWith("\uFEFFTanggal,Jenis,Kategori,"), true);
  assert.match(csv, /2026-11-24,Pengeluaran,Makanan & Minuman,"Kopi, ""Pagi"" Spesial",GoPay,,45000,Terposting,Ya/);
  assert.match(csv, /2026-11-01,Pemasukan,Gaji & Pendapatan,Gaji Bulanan,,BCA Utama,15000000,Terposting,Ya/);
});

test("vaultSnapshotToBackupJson serializes complete structured vault backup", () => {
  const jsonStr = vaultSnapshotToBackupJson(
    {
      accounts: [],
      transactions: sampleTransactions,
      assets: [],
      debts: [],
      owner_commands: [],
      recurring_bills: [],
      savings_goals: [],
      preferences: {
        date_format: "DD MMM YYYY",
        expense_alert_limit: 5_000_000,
      },
    },
    "owner@ego.id",
    "2026-11-24T09:00:00.000Z"
  );
  const parsed = JSON.parse(jsonStr) as {
    app: string;
    version: string;
    owner_email: string;
    exported_at: string;
    data: { transactions: Transaction[] };
  };
  assert.equal(parsed.app, "EGO Personal AI");
  assert.equal(parsed.version, "1.0");
  assert.equal(parsed.owner_email, "owner@ego.id");
  assert.equal(parsed.data.transactions.length, 2);
});
```

---

## 34. `src/lib/finance.test.ts` (519 lines)

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceDueDate,
  computeAccountBalances,
  computeCashflowSeries,
  computeCategoryBreakdown,
  computeEmergencyFundMonths,
  computeGoalProgress,
  computeMonthlyCashflow,
  computeNetWorth,
  estimateGoalCompletionMonths,
  formatIDR,
  formatThousandsInput,
  getDueRecurringBills,
  getGreetingID,
  parseThousandsInput,
} from "./finance";
import type {
  Account,
  Asset,
  Debt,
  RecurringBill,
  SavingsGoal,
  Transaction,
} from "../types/ego";

const OWNER = "owner-1";

const accounts: Account[] = [
  {
    id: "acc-bca",
    owner_id: OWNER,
    account_name: "BCA Utama",
    account_type: "bank",
    opening_balance: 10_000_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
  {
    id: "acc-gopay",
    owner_id: OWNER,
    account_name: "GoPay",
    account_type: "ewallet",
    opening_balance: 500_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
];

test("formatIDR produces standard Indonesian Rupiah notation", () => {
  assert.equal(formatIDR(1_500_000), "Rp 1.500.000");
  assert.equal(formatIDR(0), "Rp 0");
  assert.equal(formatIDR(-25_000), "-Rp 25.000");
});

test("formatThousandsInput and parseThousandsInput roundtrip cleanly", () => {
  assert.equal(formatThousandsInput("1500000"), "1.500.000");
  assert.equal(parseThousandsInput("1.500.000"), 1_500_000);
});

test("computeAccountBalances ignores pending and cancelled transactions (Vault Invariant)", () => {
  const transactions: Transaction[] = [
    {
      id: "tx-1",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 1_000_000,
      transaction_date: "2026-11-10",
      category: "Belanja",
      description: "Posted & confirmed",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-10T00:00:00Z",
    },
    {
      id: "tx-2",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 2_000_000,
      transaction_date: "2026-11-11",
      category: "Belanja",
      description: "Pending must not deduct",
      status: "pending",
      owner_confirmed: false,
      created_at: "2026-11-11T00:00:00Z",
    },
    {
      id: "tx-3",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 3_000_000,
      transaction_date: "2026-11-12",
      category: "Belanja",
      description: "Cancelled must not deduct",
      status: "cancelled",
      owner_confirmed: true,
      created_at: "2026-11-12T00:00:00Z",
    },
    {
      id: "tx-4",
      owner_id: OWNER,
      transaction_type: "transfer",
      source_account_id: "acc-bca",
      destination_account_id: "acc-gopay",
      amount: 500_000,
      transaction_date: "2026-11-13",
      category: "Transfer Internal",
      description: "Top up GoPay",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-13T00:00:00Z",
    },
  ];

  const balances = computeAccountBalances(accounts, transactions);
  const bca = balances.find((a) => a.id === "acc-bca");
  const gopay = balances.find((a) => a.id === "acc-gopay");

  assert.equal(bca?.current_balance, 8_500_000);
  assert.equal(gopay?.current_balance, 1_000_000);

  const cashflow = computeMonthlyCashflow(transactions, "2026-11");
  assert.equal(cashflow.income, 0);
  assert.equal(cashflow.expense, 1_000_000);
});

test("computeNetWorth calculates (accounts + assets) - active debts", () => {
  const balances = computeAccountBalances(accounts, []);
  const assets: Asset[] = [
    {
      id: "asset-1",
      owner_id: OWNER,
      asset_name: "Emas Antam",
      asset_type: "emas",
      current_value: 5_000_000,
      quantity: 3,
      unit: "gram",
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
    },
  ];
  const debts: Debt[] = [
    {
      id: "debt-1",
      owner_id: OWNER,
      creditor: "Bank KPR",
      original_amount: 10_000_000,
      outstanding_balance: 3_500_000,
      due_date: "2026-12-01",
      status: "active",
      description: null,
      created_at: "2026-11-01T00:00:00Z",
    },
  ];

  const summary = computeNetWorth(balances, assets, debts);
  assert.equal(summary.totalAccountBalance, 10_500_000);
  assert.equal(summary.totalAssetValue, 5_000_000);
  assert.equal(summary.totalDebtBalance, 3_500_000);
  assert.equal(summary.netWorth, 12_000_000);
});

test("computeCashflowSeries aggregates chronological months across year rollover and ignores unconfirmed/cancelled/transfer", () => {
  const txs: Transaction[] = [
    {
      id: "t-dec",
      owner_id: OWNER,
      transaction_type: "income",
      source_account_id: null,
      destination_account_id: "acc-bca",
      amount: 10_000_000,
      transaction_date: "2025-12-20",
      category: "Gaji & Pendapatan",
      description: "Gaji Desember",
      status: "posted",
      owner_confirmed: true,
      created_at: "2025-12-20T00:00:00Z",
    },
    {
      id: "t-jan-exp",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 2_500_000,
      transaction_date: "2026-01-10",
      category: "Utilitas & Tagihan",
      description: "Listrik",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-01-10T00:00:00Z",
    },
    {
      id: "t-feb-pending",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 9_000_000,
      transaction_date: "2026-02-05",
      category: "Belanja",
      description: "Pending must be excluded",
      status: "pending",
      owner_confirmed: false,
      created_at: "2026-02-05T00:00:00Z",
    },
    {
      id: "t-feb-cancelled",
      owner_id: OWNER,
      transaction_type: "income",
      source_account_id: null,
      destination_account_id: "acc-bca",
      amount: 4_000_000,
      transaction_date: "2026-02-07",
      category: "Bonus & Investasi",
      description: "Cancelled must be excluded",
      status: "cancelled",
      owner_confirmed: true,
      created_at: "2026-02-07T00:00:00Z",
    },
    {
      id: "t-feb-transfer",
      owner_id: OWNER,
      transaction_type: "transfer",
      source_account_id: "acc-bca",
      destination_account_id: "acc-gopay",
      amount: 1_500_000,
      transaction_date: "2026-02-12",
      category: "Transfer Internal",
      description: "Transfer must be excluded from cashflow",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-02-12T00:00:00Z",
    },
  ];

  const series = computeCashflowSeries(txs, 3, "2026-02");
  assert.equal(series.length, 3);
  assert.deepEqual(
    series.map((s) => s.monthKey),
    ["2025-12", "2026-01", "2026-02"]
  );
  assert.equal(series[0].label, "Des 2025");
  assert.equal(series[0].income, 10_000_000);
  assert.equal(series[0].expense, 0);
  assert.equal(series[0].net, 10_000_000);

  assert.equal(series[1].income, 0);
  assert.equal(series[1].expense, 2_500_000);
  assert.equal(series[1].net, -2_500_000);

  assert.equal(series[2].income, 0);
  assert.equal(series[2].expense, 0);
  assert.equal(series[2].transactionCount, 0);
});

test("computeCategoryBreakdown groups, sorts, computes percentages, and supports date filters", () => {
  const txs: Transaction[] = [
    {
      id: "e-1",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 600_000,
      transaction_date: "2026-11-05",
      category: "Makanan & Minuman",
      description: "Belanja dapur",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-05T00:00:00Z",
    },
    {
      id: "e-2",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 150_000,
      transaction_date: "2026-11-12",
      category: "Makanan & Minuman",
      description: "Makan siang",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-12T00:00:00Z",
    },
    {
      id: "e-3",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 250_000,
      transaction_date: "2026-11-14",
      category: "Transportasi",
      description: "BBM",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-14T00:00:00Z",
    },
    {
      id: "e-4-pending",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 5_000_000,
      transaction_date: "2026-11-15",
      category: "Belanja",
      description: "Pending excluded",
      status: "posted",
      owner_confirmed: false,
      created_at: "2026-11-15T00:00:00Z",
    },
    {
      id: "e-5-prev-month",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 500_000,
      transaction_date: "2026-10-28",
      category: "Utilitas & Tagihan",
      description: "Internet Oktober",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-10-28T00:00:00Z",
    },
  ];

  const novBreakdown = computeCategoryBreakdown(txs, "expense", {
    yearMonth: "2026-11",
  });
  assert.equal(novBreakdown.totalAmount, 1_000_000);
  assert.equal(novBreakdown.totalCount, 3);
  assert.equal(novBreakdown.items.length, 2);
  assert.deepEqual(novBreakdown.items[0], {
    category: "Makanan & Minuman",
    total: 750_000,
    percentage: 75,
    count: 2,
  });
  assert.deepEqual(novBreakdown.items[1], {
    category: "Transportasi",
    total: 250_000,
    percentage: 25,
    count: 1,
  });

  const rangedBreakdown = computeCategoryBreakdown(txs, "expense", {
    fromDate: "2026-10-01",
    toDate: "2026-11-10",
  });
  assert.equal(rangedBreakdown.totalAmount, 1_100_000);
  assert.equal(rangedBreakdown.items.length, 2);
  assert.equal(rangedBreakdown.items[0].category, "Makanan & Minuman");
  assert.equal(rangedBreakdown.items[1].category, "Utilitas & Tagihan");
});

test("getGreetingID returns natural Indonesian greetings by hour", () => {
  assert.equal(getGreetingID(7), "Selamat pagi");
  assert.equal(getGreetingID(13), "Selamat siang");
  assert.equal(getGreetingID(17), "Selamat sore");
  assert.equal(getGreetingID(21), "Selamat malam");
  assert.equal(getGreetingID(2), "Selamat malam");
});

test("advanceDueDate handles weekly, monthly end-of-month clamping, and yearly", () => {
  assert.equal(advanceDueDate("2026-11-10", "weekly"), "2026-11-17");
  assert.equal(advanceDueDate("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(advanceDueDate("2024-01-31", "monthly"), "2024-02-29");
  assert.equal(advanceDueDate("2026-12-15", "monthly"), "2027-01-15");
  assert.equal(advanceDueDate("2024-02-29", "yearly"), "2025-02-28");
});

test("getDueRecurringBills filters active bills within window and excludes already queued cycles", () => {
  const bills: RecurringBill[] = [
    {
      id: "b-overdue",
      owner_id: OWNER,
      title: "Internet Biznet",
      transaction_type: "expense",
      amount: 375_000,
      category: "Utilitas & Tagihan",
      account_id: "acc-bca",
      frequency: "monthly",
      next_due_date: "2026-11-18",
      last_queued_date: null,
      is_active: true,
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "b-already-queued",
      owner_id: OWNER,
      title: "Listrik PLN",
      transaction_type: "expense",
      amount: 500_000,
      category: "Utilitas & Tagihan",
      account_id: "acc-bca",
      frequency: "monthly",
      next_due_date: "2026-11-22",
      last_queued_date: "2026-11-22",
      is_active: true,
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "b-soon",
      owner_id: OWNER,
      title: "Gaji Bulanan",
      transaction_type: "income",
      amount: 12_000_000,
      category: "Gaji & Pendapatan",
      account_id: "acc-bca",
      frequency: "monthly",
      next_due_date: "2026-11-25",
      last_queued_date: null,
      is_active: true,
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "b-far",
      owner_id: OWNER,
      title: "Pajak Tahunan",
      transaction_type: "expense",
      amount: 2_000_000,
      category: "Utilitas & Tagihan",
      account_id: "acc-bca",
      frequency: "yearly",
      next_due_date: "2026-12-20",
      last_queued_date: null,
      is_active: true,
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "b-paused",
      owner_id: OWNER,
      title: "Gym",
      transaction_type: "expense",
      amount: 450_000,
      category: "Belanja",
      account_id: "acc-bca",
      frequency: "monthly",
      next_due_date: "2026-11-21",
      last_queued_date: null,
      is_active: false,
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
    },
  ];

  const due = getDueRecurringBills(bills, "2026-11-20", 7);
  assert.deepEqual(
    due.map((b) => b.id),
    ["b-overdue", "b-soon"]
  );
});

test("computeGoalProgress, estimateGoalCompletionMonths, and computeEmergencyFundMonths compute accurate metrics", () => {
  const balances = computeAccountBalances(accounts, []);
  const manualGoal: SavingsGoal = {
    id: "g-1",
    owner_id: OWNER,
    title: "Liburan Keluarga",
    goal_type: "savings_target",
    target_amount: 20_000_000,
    current_amount: 5_000_000,
    linked_account_id: null,
    target_date: "2027-06-01",
    status: "active",
    notes: null,
    created_at: "2026-11-01T00:00:00Z",
  };
  const linkedGoal: SavingsGoal = {
    id: "g-2",
    owner_id: OWNER,
    title: "Dana Darurat",
    goal_type: "emergency_fund",
    target_amount: 30_000_000,
    current_amount: 0,
    linked_account_id: "acc-bca",
    target_date: null,
    status: "active",
    notes: null,
    created_at: "2026-11-01T00:00:00Z",
  };

  const manualProg = computeGoalProgress(manualGoal);
  assert.equal(manualProg.savedAmount, 5_000_000);
  assert.equal(manualProg.remainingAmount, 15_000_000);
  assert.equal(manualProg.percentage, 25);
  assert.equal(manualProg.isCompleted, false);

  const bcaBalance = balances.find((a) => a.id === "acc-bca");
  const linkedProg = computeGoalProgress(linkedGoal, bcaBalance);
  assert.equal(linkedProg.savedAmount, 10_000_000);
  assert.equal(linkedProg.remainingAmount, 20_000_000);
  assert.equal(linkedProg.percentage, 33.3);

  assert.equal(estimateGoalCompletionMonths(15_000_000, 3_500_000), 5);
  assert.equal(estimateGoalCompletionMonths(15_000_000, 0), null);
  assert.equal(estimateGoalCompletionMonths(0, 3_500_000), 0);

  assert.equal(computeEmergencyFundMonths(10_500_000, 3_000_000), 3.5);
  assert.equal(computeEmergencyFundMonths(10_500_000, 0), null);
});
```

---

## 35. `src/lib/vault-validation.test.ts` (230 lines)

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  OWNER_EMAIL_REGEX,
  validateAccountInput,
  validateAssetInput,
  validateDebtInput,
  validateDebtPaymentInput,
  validateRecurringBillInput,
  validateSavingsGoalInput,
  validateTransactionPayload,
} from "./vault-validation.ts";

test("OWNER_EMAIL_REGEX accepts valid emails and rejects malformed ones", () => {
  assert.equal(OWNER_EMAIL_REGEX.test("uulsyahrul123@gmail.com"), true);
  assert.equal(OWNER_EMAIL_REGEX.test("invalid-email"), false);
  assert.equal(OWNER_EMAIL_REGEX.test("a@b"), false);
  assert.equal(OWNER_EMAIL_REGEX.test("user @domain.com"), false);
});

test("validateAccountInput enforces confirmation, name bounds, type, and opening balance", () => {
  assert.throws(() =>
    validateAccountInput({
      account_name: "BCA",
      account_type: "bank",
      opening_balance: 1000,
      owner_confirmed: false,
    })
  );
  assert.throws(() =>
    validateAccountInput({
      account_name: " ",
      account_type: "bank",
      opening_balance: 1000,
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateAccountInput({
      account_name: "Crypto",
      account_type: "crypto",
      opening_balance: 1000,
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateAccountInput({
      account_name: "BCA",
      account_type: "bank",
      opening_balance: -5,
      owner_confirmed: true,
    })
  );
  assert.doesNotThrow(() =>
    validateAccountInput({
      account_name: "Dompet Tunai",
      account_type: "cash",
      opening_balance: 0,
      owner_confirmed: true,
    })
  );
});

test("validateTransactionPayload enforces Prinsip Brankas Mutlak and transfer account rules", () => {
  assert.throws(() =>
    validateTransactionPayload({
      transaction_type: "expense",
      source_account_id: "acc-1",
      destination_account_id: null,
      amount: 0,
      status: "posted",
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateTransactionPayload({
      transaction_type: "expense",
      source_account_id: "acc-1",
      destination_account_id: null,
      amount: 50000,
      status: "posted",
      owner_confirmed: false,
    })
  );
  assert.throws(() =>
    validateTransactionPayload({
      transaction_type: "income",
      source_account_id: null,
      destination_account_id: null,
      amount: 50000,
      status: "posted",
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateTransactionPayload({
      transaction_type: "transfer",
      source_account_id: "acc-1",
      destination_account_id: "acc-1",
      amount: 50000,
      status: "posted",
      owner_confirmed: true,
    })
  );
  assert.doesNotThrow(() =>
    validateTransactionPayload({
      transaction_type: "transfer",
      source_account_id: "acc-1",
      destination_account_id: "acc-2",
      amount: 50000,
      status: "posted",
      owner_confirmed: true,
    })
  );
});

test("validateAssetInput, validateDebtInput, validateDebtPaymentInput enforce positive invariants", () => {
  assert.throws(() =>
    validateAssetInput({
      asset_name: "Emas Antam",
      asset_type: "invalid",
      current_value: 1000000,
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateAssetInput({
      asset_name: "Emas Antam",
      asset_type: "emas",
      current_value: 1000000,
      quantity: -1,
      owner_confirmed: true,
    })
  );
  assert.doesNotThrow(() =>
    validateAssetInput({
      asset_name: "Emas Antam",
      asset_type: "emas",
      current_value: 1500000,
      quantity: 1,
      owner_confirmed: true,
    })
  );

  assert.throws(() =>
    validateDebtInput({
      creditor: "Bank X",
      original_amount: 0,
      outstanding_balance: 0,
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateDebtPaymentInput(
      { status: "paid", outstanding_balance: 0 },
      10000,
      "acc-1",
      true
    )
  );
  assert.throws(() =>
    validateDebtPaymentInput(
      { status: "active", outstanding_balance: 100000 },
      150000,
      "acc-1",
      true
    )
  );
  assert.doesNotThrow(() =>
    validateDebtPaymentInput(
      { status: "active", outstanding_balance: 100000 },
      50000,
      "acc-1",
      true
    )
  );
});

test("validateRecurringBillInput and validateSavingsGoalInput validate schedule and goal fields", () => {
  assert.throws(() =>
    validateRecurringBillInput({
      title: "Internet",
      transaction_type: "transfer",
      amount: 350000,
      frequency: "monthly",
      next_due_date: "2026-12-01",
      owner_confirmed: true,
    })
  );
  assert.throws(() =>
    validateRecurringBillInput({
      title: "Internet",
      transaction_type: "expense",
      amount: 350000,
      frequency: "monthly",
      next_due_date: "01-12-2026",
      owner_confirmed: true,
    })
  );
  assert.doesNotThrow(() =>
    validateRecurringBillInput({
      title: "Internet",
      transaction_type: "expense",
      amount: 350000,
      frequency: "monthly",
      next_due_date: "2026-12-01",
      owner_confirmed: true,
    })
  );

  assert.throws(() =>
    validateSavingsGoalInput({
      title: "Dana Darurat",
      goal_type: "other",
      target_amount: 10000000,
      current_amount: 0,
      owner_confirmed: true,
    })
  );
  assert.doesNotThrow(() =>
    validateSavingsGoalInput({
      title: "Dana Darurat",
      goal_type: "emergency_fund",
      target_amount: 10000000,
      current_amount: 500000,
      owner_confirmed: true,
    })
  );
});
```

---

## 36. `src/components/ego/app-shell.tsx` (369 lines)

```tsx
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Bot,
  Briefcase,
  CreditCard,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Settings,
  Shield,
  Target,
  Wallet,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { getDueRecurringBills } from "../../lib/finance";
import { setPinLocked } from "../../lib/pin-lock";
import { useAuthStatus, useLogoutOwner, useVaultSnapshot } from "../../lib/queries";
import { ThemeToggleButton } from "../../lib/theme";
import { OfflineIndicator, PWAInstallButton } from "./pwa-controls";

export type NavTo =
  | "/"
  | "/transaksi"
  | "/akun"
  | "/aset"
  | "/utang"
  | "/rencana"
  | "/owner"
  | "/pengaturan";

interface NavItem {
  to: NavTo;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Beranda", icon: LayoutDashboard },
  { to: "/transaksi", label: "Transaksi", icon: ArrowLeftRight },
  { to: "/akun", label: "Akun", icon: Wallet },
  { to: "/aset", label: "Aset", icon: Briefcase },
  { to: "/utang", label: "Utang", icon: CreditCard },
  { to: "/rencana", label: "Rencana & Tagihan", icon: Target },
  { to: "/owner", label: "Owner Control", icon: Bot },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings },
];

interface AppShellProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, subtitle, action, children }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: auth } = useAuthStatus();
  const { data: vault } = useVaultSnapshot(Boolean(auth?.authenticated));
  const logout = useLogoutOwner();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pendingCount =
    vault?.owner_commands.filter((c) => c.status === "pending").length ?? 0;
  const dueCount = getDueRecurringBills(vault?.recurring_bills ?? []).length;

  async function handleLogout() {
    await logout.mutateAsync();
    toast.success("Sesi brankas Anda telah ditutup dengan aman.");
    await navigate({ to: "/auth" });
  }

  function handleQuickLock() {
    setMobileMenuOpen(false);
    setPinLocked(true);
    toast.success("Layar brankas dikunci dengan PIN cepat.");
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-stone-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-stone-200/80 px-6 dark:border-zinc-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            <Shield className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-base font-semibold tracking-tight text-stone-900 dark:text-zinc-100 whitespace-nowrap">
            EGO Personal AI
          </span>
        </div>

        <nav aria-label="Navigasi Utama" className="flex-1 space-y-1.5 px-3.5 py-5">
          {NAV_ITEMS.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "text-stone-600 hover:bg-stone-100/80 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-stone-400 dark:text-zinc-500"
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </span>
                {item.to === "/owner" && pendingCount > 0 ? (
                  <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {pendingCount}
                  </span>
                ) : item.to === "/rencana" && dueCount > 0 ? (
                  <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                    {dueCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-stone-200/80 p-4 dark:border-zinc-800">
          <div className="px-1">
            <p className="mb-1.5 text-[11px] font-medium text-stone-500 dark:text-zinc-400">
              Suasana Tampilan
            </p>
            <ThemeToggleButton className="w-full" />
          </div>

          <PWAInstallButton fullWidth />

          <div className="border-t border-stone-200/70 pt-3 px-1 dark:border-zinc-800/80">
            <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">
              Pemilik Brankas
            </p>
            <p className="truncate text-sm font-medium text-stone-900 dark:text-zinc-100">
              {auth?.owner?.full_name || auth?.owner?.email || "Owner"}
            </p>
          </div>
          {auth?.hasPin ? (
            <button
              type="button"
              onClick={handleQuickLock}
              className="flex w-full items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
            >
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Kunci Layar (PIN)</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            className="flex w-full items-center gap-2.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <LogOut className="h-3.5 w-3.5 text-stone-500 dark:text-zinc-400" aria-hidden="true" />
            <span>Kunci &amp; Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="md:pl-64">
        {/* Top Header */}
        <header className="border-b border-stone-200/80 bg-stone-50/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 md:sticky md:top-0 md:z-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-zinc-100 sm:truncate sm:text-xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-0.5 text-xs text-stone-600 dark:text-zinc-400 sm:truncate sm:text-sm">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6 sm:pt-7 md:pb-14 lg:px-8">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Sheet for Secondary Routes */}
      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-xs dark:bg-black/70 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-14 rounded-t-2xl border-t border-stone-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                Menu Brankas Owner
              </span>
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-stone-200/80 bg-stone-50 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
              <span className="text-xs font-medium text-stone-700 dark:text-zinc-300">
                Tema Tampilan
              </span>
              <ThemeToggleButton />
            </div>

            <div className="mb-4">
              <PWAInstallButton fullWidth />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active =
                  item.to === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-sm font-medium ${
                      active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "border-stone-200 bg-stone-50/70 text-stone-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            {auth?.hasPin ? (
              <button
                type="button"
                onClick={handleQuickLock}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span>Kunci Layar (PIN)</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleLogout}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-rose-400"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Kunci &amp; Keluar</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Mobile Bottom Bar with Central Emerald Owner Control Button */}
      <nav
        aria-label="Navigasi Mobile"
        className="fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-5 items-center border-t border-stone-200/90 bg-white/95 px-1 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden"
      >
        <Link
          to="/"
          className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            pathname === "/"
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-stone-500 dark:text-zinc-400"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          <span>Beranda</span>
        </Link>

        <Link
          to="/transaksi"
          className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            pathname.startsWith("/transaksi")
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-stone-500 dark:text-zinc-400"
          }`}
        >
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          <span>Transaksi</span>
        </Link>

        <Link
          to="/owner"
          aria-label="Owner Control"
          className="flex flex-col items-center justify-center"
        >
          <span
            className={`relative -mt-2 flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-600 text-white shadow-md shadow-emerald-600/20 transition-transform active:scale-95 dark:border-emerald-400/40 dark:bg-emerald-500 dark:text-zinc-950 dark:shadow-emerald-500/20 ${
              pathname.startsWith("/owner")
                ? "ring-2 ring-emerald-400 dark:ring-emerald-300"
                : ""
            }`}
          >
            <Bot className="h-5 w-5" aria-hidden="true" />
            {pendingCount > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-emerald-500/60 bg-white px-1 text-[10px] font-mono font-bold text-emerald-700 dark:bg-zinc-950 dark:text-emerald-400">
                {pendingCount}
              </span>
            ) : null}
          </span>
        </Link>

        <Link
          to="/akun"
          className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            pathname.startsWith("/akun")
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-stone-500 dark:text-zinc-400"
          }`}
        >
          <Wallet className="h-4 w-4" aria-hidden="true" />
          <span>Akun</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            mobileMenuOpen ||
            pathname.startsWith("/aset") ||
            pathname.startsWith("/utang") ||
            pathname.startsWith("/rencana") ||
            pathname.startsWith("/pengaturan")
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-stone-500 dark:text-zinc-400"
          }`}
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
          <span>Menu</span>
        </button>
      </nav>

      <OfflineIndicator />
    </div>
  );
}
```

---

## 37. `src/components/ego/approval-check.tsx` (48 lines)

```tsx
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
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors select-none ${
        checked
          ? "border-emerald-300 bg-emerald-50/90 text-stone-900 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-zinc-100"
          : "border-stone-200 bg-stone-50/80 text-stone-700 hover:border-stone-300 dark:border-zinc-800/80 dark:bg-zinc-950/60 dark:text-zinc-300 dark:hover:border-zinc-700"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 bg-white text-emerald-600 accent-emerald-600 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-emerald-500 dark:accent-emerald-500"
      />
      <span className="flex flex-col gap-0.5 text-sm leading-snug">
        <span className="inline-flex items-center gap-1.5 font-medium text-stone-900 dark:text-zinc-100">
          <ShieldCheck
            className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          Saya, Owner, menyetujui tindakan ini secara sadar &amp; eksplisit.
        </span>
        <span className="text-xs text-stone-500 dark:text-zinc-400">
          Demi keamanan brankas Anda, saldo tidak akan berubah sebelum kotak ini dicentang.
        </span>
      </span>
    </label>
  );
}
```

---

## 38. `src/components/ego/cashflow-chart.tsx` (413 lines)

```tsx
import { BarChart3, Bot, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { computeCashflowSeries, formatIDR } from "../../lib/finance";
import type { Transaction } from "../../types/ego";

interface CashflowChartProps {
  transactions: Transaction[];
  monthsCount: 3 | 6 | 12;
  onMonthsCountChange: (months: 3 | 6 | 12) => void;
  referenceMonth?: string;
}

const RANGE_OPTIONS: Array<{ value: 3 | 6 | 12; label: string }> = [
  { value: 3, label: "3 Bln" },
  { value: 6, label: "6 Bln" },
  { value: 12, label: "12 Bln" },
];

function computeNiceMax(maxValue: number): number {
  if (maxValue <= 0) return 1_000_000;
  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  const normalized = maxValue / magnitude;
  let niceFactor = 10;
  if (normalized <= 1.2) niceFactor = 1.2;
  else if (normalized <= 1.5) niceFactor = 1.5;
  else if (normalized <= 2) niceFactor = 2;
  else if (normalized <= 2.5) niceFactor = 2.5;
  else if (normalized <= 5) niceFactor = 5;
  else if (normalized <= 8) niceFactor = 8;
  return niceFactor * magnitude;
}

export function CashflowChart({
  transactions,
  monthsCount,
  onMonthsCountChange,
  referenceMonth,
}: CashflowChartProps) {
  const series = useMemo(
    () => computeCashflowSeries(transactions, monthsCount, referenceMonth),
    [transactions, monthsCount, referenceMonth]
  );

  const periodTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const point of series) {
      income += point.income;
      expense += point.expense;
    }
    return {
      income,
      expense,
      net: income - expense,
      hasData: income > 0 || expense > 0,
    };
  }, [series]);

  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);

  const defaultMonthKey = useMemo(() => {
    const reversed = [...series].reverse();
    const withData = reversed.find((p) => p.income > 0 || p.expense > 0);
    return withData?.monthKey ?? series[series.length - 1]?.monthKey ?? null;
  }, [series]);

  const activePoint = useMemo(() => {
    const key = hoveredMonthKey ?? defaultMonthKey;
    return series.find((p) => p.monthKey === key) ?? series[series.length - 1] ?? null;
  }, [series, hoveredMonthKey, defaultMonthKey]);

  const maxRaw = useMemo(() => {
    let m = 0;
    for (const p of series) {
      if (p.income > m) m = p.income;
      if (p.expense > m) m = p.expense;
    }
    return m;
  }, [series]);

  const niceMax = computeNiceMax(maxRaw);

  // SVG Layout geometry
  const svgWidth = 640;
  const svgHeight = 220;
  const padLeft = 74;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 30;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;
  const slotWidth = plotWidth / series.length;
  const barWidth = Math.min(20, Math.max(8, Math.floor((slotWidth - 10) / 2)));
  const barGap = monthsCount === 12 ? 3 : 5;

  const yTicks = [0, niceMax * 0.5, niceMax];

  return (
    <section
      aria-label="Tren Arus Kas Bulanan"
      className="flex h-full flex-col rounded-2xl border border-stone-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
            Tren Arus Kas Bulanan
          </h2>
          <p className="mt-0.5 text-xs text-stone-600 dark:text-zinc-400">
            Perbandingan uang masuk &amp; keluar yang sudah disetujui ({monthsCount} bulan terakhir)
          </p>
        </div>

        <div
          role="group"
          aria-label="Rentang waktu grafik"
          className="inline-flex self-start rounded-xl border border-stone-200 bg-stone-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-950 sm:self-auto"
        >
          {RANGE_OPTIONS.map((opt) => {
            const active = monthsCount === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => onMonthsCountChange(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? "bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 dark:text-zinc-950"
                    : "text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Period summary strip */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 border-y border-stone-200/80 py-3.5 text-xs dark:border-zinc-800 sm:grid-cols-3 sm:gap-4">
        <div className="flex items-center justify-between sm:block">
          <span className="inline-flex items-center gap-1.5 text-stone-600 dark:text-zinc-400">
            <span
              className="inline-block h-2 w-2 rounded-xs bg-emerald-600 dark:bg-emerald-500"
              aria-hidden="true"
            />
            Pemasukan
          </span>
          <p className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums sm:mt-0.5">
            {formatIDR(periodTotals.income)}
          </p>
        </div>

        <div className="flex items-center justify-between sm:block">
          <span className="inline-flex items-center gap-1.5 text-stone-600 dark:text-zinc-400">
            <span
              className="inline-block h-2 w-2 rounded-xs bg-rose-600 dark:bg-rose-500"
              aria-hidden="true"
            />
            Pengeluaran
          </span>
          <p className="font-mono text-sm font-semibold text-rose-600 dark:text-rose-400 tabular-nums sm:mt-0.5">
            {formatIDR(periodTotals.expense)}
          </p>
        </div>

        <div className="flex items-center justify-between sm:block sm:text-right">
          <span className="text-stone-600 dark:text-zinc-400">Selisih periode</span>
          <p
            className={`font-mono text-sm font-semibold tabular-nums sm:mt-0.5 ${
              periodTotals.net >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {formatIDR(periodTotals.net)}
          </p>
        </div>
      </div>

      {!periodTotals.hasData ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-400">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-zinc-200">
            Belum ada arus kas pada periode ini
          </p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
            Grafik terisi otomatis setelah transaksi pemasukan atau pengeluaran disetujui.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              to="/transaksi"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Catat Transaksi</span>
            </Link>
            <Link
              to="/owner"
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Bot className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tanya EGO AI</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col justify-between">
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="h-auto w-full select-none"
              role="img"
              aria-label={`Grafik batang tren arus kas ${monthsCount} bulan terakhir`}
              onMouseLeave={() => setHoveredMonthKey(null)}
            >
              {/* Horizontal Gridlines & Y-Axis Labels */}
              {yTicks.map((tickVal, idx) => {
                const ratio = niceMax > 0 ? tickVal / niceMax : 0;
                const y = padTop + plotHeight - ratio * plotHeight;
                return (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      x2={svgWidth - padRight}
                      y1={y}
                      y2={y}
                      className={
                        idx === 0
                          ? "stroke-stone-300 dark:stroke-zinc-700"
                          : "stroke-stone-200 dark:stroke-zinc-800"
                      }
                      strokeWidth={1}
                      strokeDasharray={idx === 0 ? undefined : "3 3"}
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-stone-500 dark:fill-zinc-400"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {tickVal === 0 ? "Rp 0" : formatIDR(tickVal, true)}
                    </text>
                  </g>
                );
              })}

              {/* Monthly Grouped Bars */}
              {series.map((point, index) => {
                const slotX = padLeft + index * slotWidth;
                const centerX = slotX + slotWidth / 2;
                const incomeHeight =
                  point.income > 0
                    ? Math.max(3, (point.income / niceMax) * plotHeight)
                    : 0;
                const expenseHeight =
                  point.expense > 0
                    ? Math.max(3, (point.expense / niceMax) * plotHeight)
                    : 0;

                const incomeX = centerX - barGap / 2 - barWidth;
                const expenseX = centerX + barGap / 2;
                const incomeY = padTop + plotHeight - incomeHeight;
                const expenseY = padTop + plotHeight - expenseHeight;
                const isActive = activePoint?.monthKey === point.monthKey;

                return (
                  <g
                    key={point.monthKey}
                    tabIndex={0}
                    role="button"
                    aria-label={`${point.label}: Pemasukan ${formatIDR(
                      point.income
                    )}, Pengeluaran ${formatIDR(
                      point.expense
                    )}, Selisih ${formatIDR(point.net)}`}
                    className="cursor-pointer outline-none"
                    onMouseEnter={() => setHoveredMonthKey(point.monthKey)}
                    onFocus={() => setHoveredMonthKey(point.monthKey)}
                    onClick={() => setHoveredMonthKey(point.monthKey)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setHoveredMonthKey(point.monthKey);
                      }
                    }}
                  >
                    <rect
                      x={slotX + 2}
                      y={padTop}
                      width={Math.max(0, slotWidth - 4)}
                      height={plotHeight}
                      rx={8}
                      className={
                        isActive
                          ? "fill-stone-100 dark:fill-zinc-800/50"
                          : "fill-transparent"
                      }
                    />

                    {/* Income Bar */}
                    {incomeHeight > 0 ? (
                      <rect
                        x={incomeX}
                        y={incomeY}
                        width={barWidth}
                        height={incomeHeight}
                        rx={3}
                        className="fill-emerald-600 dark:fill-emerald-500 transition-opacity duration-150 motion-reduce:transition-none"
                        opacity={isActive ? 1 : 0.85}
                      />
                    ) : (
                      <rect
                        x={incomeX}
                        y={padTop + plotHeight - 2}
                        width={barWidth}
                        height={2}
                        rx={1}
                        className="fill-stone-200 dark:fill-zinc-800"
                      />
                    )}

                    {/* Expense Bar */}
                    {expenseHeight > 0 ? (
                      <rect
                        x={expenseX}
                        y={expenseY}
                        width={barWidth}
                        height={expenseHeight}
                        rx={3}
                        className="fill-rose-500 transition-opacity duration-150 motion-reduce:transition-none"
                        opacity={isActive ? 1 : 0.85}
                      />
                    ) : (
                      <rect
                        x={expenseX}
                        y={padTop + plotHeight - 2}
                        width={barWidth}
                        height={2}
                        rx={1}
                        className="fill-stone-200 dark:fill-zinc-800"
                      />
                    )}

                    {/* X-Axis Month Label */}
                    <text
                      x={centerX}
                      y={svgHeight - 8}
                      textAnchor="middle"
                      className={
                        isActive
                          ? "fill-stone-900 dark:fill-zinc-100"
                          : "fill-stone-500 dark:fill-zinc-400"
                      }
                      fontSize={monthsCount === 12 ? "10" : "11"}
                      fontWeight={isActive ? "600" : "400"}
                    >
                      {point.shortLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Interactive Month Detail Inspector */}
          {activePoint ? (
            <div
              aria-live="polite"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/80 pt-3 text-xs dark:border-zinc-800"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-stone-900 dark:text-zinc-100">
                  {activePoint.label}
                </span>
                <span className="text-stone-400 dark:text-zinc-500" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-stone-600 dark:text-zinc-400 tabular-nums">
                  {activePoint.transactionCount} transaksi
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums">
                <span className="text-emerald-700 dark:text-emerald-400">
                  +{formatIDR(activePoint.income)}
                </span>
                <span className="text-rose-600 dark:text-rose-400">
                  -{formatIDR(activePoint.expense)}
                </span>
                <span
                  className={
                    activePoint.net >= 0
                      ? "font-semibold text-stone-900 dark:text-zinc-100"
                      : "font-semibold text-rose-700 dark:text-rose-300"
                  }
                >
                  Bersih {formatIDR(activePoint.net)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
```

---

## 39. `src/components/ego/category-breakdown.tsx` (245 lines)

```tsx
import { Link } from "@tanstack/react-router";
import { ArrowRight, PieChart, Plus } from "lucide-react";
import { useMemo } from "react";
import { computeCategoryBreakdown, formatIDR } from "../../lib/finance";
import type { Transaction } from "../../types/ego";

interface CategoryBreakdownProps {
  transactions: Transaction[];
  title: string;
  subtitle?: string;
  type: "income" | "expense";
  onTypeChange: (type: "income" | "expense") => void;
  yearMonth?: string;
  fromDate?: string;
  toDate?: string;
  selectedCategory?: string;
  onSelectCategory?: (category: string, type: "income" | "expense") => void;
  maxItems?: number;
  embedded?: boolean;
  showEmptyCta?: boolean;
}

export function CategoryBreakdown({
  transactions,
  title,
  subtitle,
  type,
  onTypeChange,
  yearMonth,
  fromDate,
  toDate,
  selectedCategory,
  onSelectCategory,
  maxItems = 6,
  embedded = false,
  showEmptyCta = true,
}: CategoryBreakdownProps) {
  const breakdown = useMemo(
    () =>
      computeCategoryBreakdown(transactions, type, {
        yearMonth,
        fromDate,
        toDate,
      }),
    [transactions, type, yearMonth, fromDate, toDate]
  );

  const visibleItems = breakdown.items.slice(0, maxItems);
  const hiddenCount = Math.max(0, breakdown.items.length - visibleItems.length);
  const amountColorClass =
    type === "income"
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";

  const wrapperClass = embedded
    ? "border-y border-stone-200/80 py-5 dark:border-zinc-800"
    : "flex h-full flex-col rounded-2xl border border-stone-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";

  return (
    <section aria-label={title} className={wrapperClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-stone-600 dark:text-zinc-400">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div
          role="group"
          aria-label="Jenis rincian kategori"
          className="inline-flex self-start rounded-xl border border-stone-200 bg-stone-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-950 sm:self-auto"
        >
          {(
            [
              { id: "expense", label: "Pengeluaran" },
              { id: "income", label: "Pemasukan" },
            ] as const
          ).map((tab) => {
            const active = type === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => onTypeChange(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? tab.id === "income"
                      ? "bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 dark:text-zinc-950"
                      : "bg-rose-600 text-white shadow-xs dark:bg-rose-500 dark:text-zinc-950"
                    : "text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {breakdown.items.length === 0 ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-400">
            <PieChart className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-zinc-200">
            Belum ada {type === "expense" ? "pengeluaran" : "pemasukan"} tercatat
          </p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
            Ringkasan muncul otomatis setelah transaksi Anda disetujui.
          </p>
          {showEmptyCta ? (
            <Link
              to="/transaksi"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Catat Transaksi</span>
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-stone-200/80 pb-2.5 text-xs dark:border-zinc-800">
            <span className="text-stone-600 dark:text-zinc-400">
              Total {type === "expense" ? "Pengeluaran" : "Pemasukan"}
            </span>
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <strong className={`font-semibold ${amountColorClass}`}>
                {formatIDR(breakdown.totalAmount)}
              </strong>
              <span className="text-stone-400 dark:text-zinc-500" aria-hidden="true">
                ·
              </span>
              <span className="text-stone-600 dark:text-zinc-400">
                {breakdown.totalCount} transaksi
              </span>
            </div>
          </div>

          <ul className="divide-y divide-stone-200/70 dark:divide-zinc-800/70">
            {visibleItems.map((item) => {
              const pctFormatted = item.percentage
                .toFixed(1)
                .replace(/\.0$/, "")
                .replace(".", ",");
              const isSelected =
                Boolean(selectedCategory) &&
                selectedCategory?.trim().toLowerCase() ===
                  item.category.toLowerCase();

              const content = (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium text-stone-900 dark:text-zinc-100">
                      {item.category}
                    </span>
                    <span className="shrink-0 font-mono text-sm font-semibold text-stone-900 dark:text-zinc-100 tabular-nums">
                      {formatIDR(item.total)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-stone-500 font-mono tabular-nums dark:text-zinc-400">
                    <span>{item.count} transaksi</span>
                    <span>{pctFormatted}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-950">
                    <svg
                      viewBox="0 0 100 6"
                      preserveAspectRatio="none"
                      className="block h-full w-full"
                      aria-hidden="true"
                    >
                      <rect
                        x={0}
                        y={0}
                        width={Math.max(3, Math.min(100, item.percentage))}
                        height={6}
                        rx={3}
                        className={`${
                          type === "income"
                            ? "fill-emerald-600 dark:fill-emerald-500"
                            : "fill-rose-500"
                        } transition-all duration-200 motion-reduce:transition-none`}
                      />
                    </svg>
                  </div>
                </>
              );

              return (
                <li key={item.category} className="py-2 first:pt-2.5 last:pb-1">
                  {onSelectCategory ? (
                    <button
                      type="button"
                      onClick={() => onSelectCategory(item.category, type)}
                      aria-pressed={isSelected}
                      aria-label={`Filter kategori ${item.category}, ${formatIDR(
                        item.total
                      )}, ${pctFormatted}%`}
                      className={`group block w-full rounded-xl px-2.5 py-2 text-left transition-colors ${
                        isSelected
                          ? "bg-emerald-50 ring-1 ring-emerald-400/60 dark:bg-emerald-500/10 dark:ring-emerald-500/40"
                          : "hover:bg-stone-50 dark:hover:bg-zinc-950/70"
                      }`}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="px-1 py-1">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>

          {hiddenCount > 0 || onSelectCategory ? (
            <div className="mt-auto flex items-center justify-between border-t border-stone-200/80 pt-3 text-xs text-stone-500 dark:border-zinc-800/80 dark:text-zinc-400">
              <span>
                {hiddenCount > 0
                  ? `+${hiddenCount} kategori lainnya`
                  : "Klik kategori untuk menyaring riwayat"}
              </span>
              {!embedded ? (
                <Link
                  to="/transaksi"
                  search={{ jenis: type }}
                  className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  <span>Lihat Semua</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
```

---

## 40. `src/components/ego/live-voice-panel.tsx` (497 lines)

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, MicOff, Radio, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { parseNaturalCommand } from "../../lib/command-parser";
import {
  egoKeys,
  getActiveBearerToken,
  useQueueCommand,
  useVaultSnapshot,
} from "../../lib/queries";

interface TranscriptEntry {
  id: string;
  speaker: "owner" | "ego" | "system";
  text: string;
}

function floatTo16BitPcmBase64(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function decode24kPcmToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(bytes.length / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = view.getInt16(i * 2, true) / 32768;
  }
  return samples;
}

export function LiveVoicePanel() {
  const qc = useQueryClient();
  const { data: vault } = useVaultSnapshot(true);
  const queueCommand = useQueueCommand();
  const [status, setStatus] = useState<"idle" | "connecting" | "active" | "local-dictating">("idle");
  const statusRef = useRef(status);
  statusRef.current = status;
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [textFollowup, setTextFollowup] = useState("");
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  function stopPlaybackQueue() {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // Ignore already stopped
      }
    }
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    }
  }

  function schedulePcmAudio(base64: string) {
    const ctx = outputCtxRef.current;
    if (!ctx) return;

    const samples = decode24kPcmToFloat32(base64);
    if (samples.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
    audioBuffer.getChannelData(0).set(samples);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now + 0.02;
    }
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
  }

  function appendTranscript(speaker: TranscriptEntry["speaker"], text: string) {
    const clean = text.trim();
    if (!clean) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && speaker !== "system") {
        return [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text} ${clean}`.trim() },
        ];
      }
      return [...prev.slice(-24), { id: crypto.randomUUID(), speaker, text: clean }];
    });
  }

  function cleanupSession() {
    stopPlaybackQueue();
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void inputCtxRef.current?.close().catch(() => {});
    inputCtxRef.current = null;
    void outputCtxRef.current?.close().catch(() => {});
    outputCtxRef.current = null;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("idle");
  }

  useEffect(() => {
    return () => {
      cleanupSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startLiveSession() {
    if (status !== "idle") return;
    setErrorNotice(null);
    setStatus("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const token = await getActiveBearerToken();
      const wsUrl = `${protocol}//${window.location.host}/ws/live${
        token ? `?token=${encodeURIComponent(token)}` : ""
      }`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const channelData = event.inputBuffer.getChannelData(0);
          const base64 = floatTo16BitPcmBase64(channelData);
          ws.send(JSON.stringify({ audio: base64 }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        let msg: {
          status?: string;
          audio?: string;
          interrupted?: boolean;
          inputTranscript?: string;
          outputTranscript?: string;
          draftCreated?: { command_text: string };
          error?: string;
        };
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }

        if (msg.status === "connected") {
          setStatus("active");
          appendTranscript(
            "system",
            "Sesi suara EGO Live aktif. Silakan ucapkan perintah transaksi atau pertanyaan."
          );
        }
        if (msg.error) {
          toast.error(msg.error);
          setErrorNotice(msg.error);
          appendTranscript("system", msg.error);
          cleanupSession();
          return;
        }
        if (msg.interrupted) {
          stopPlaybackQueue();
        }
        if (msg.audio) {
          schedulePcmAudio(msg.audio);
        }
        if (msg.inputTranscript) {
          appendTranscript("owner", msg.inputTranscript);
        }
        if (msg.outputTranscript) {
          appendTranscript("ego", msg.outputTranscript);
        }
        if (msg.draftCreated) {
          toast.success(
            `Draf suara masuk Antrean Persetujuan: "${msg.draftCreated.command_text}"`
          );
          void qc.invalidateQueries({ queryKey: egoKeys.vault });
        }
      };

      ws.onerror = () => {
        const msg = "Koneksi suara EGO Live terputus.";
        toast.error(msg);
        setErrorNotice(msg);
        cleanupSession();
      };

      ws.onclose = () => {
        if (wsRef.current === ws && statusRef.current !== "idle") {
          setErrorNotice((prev) => prev ?? "Sesi suara EGO Live berakhir atau terputus.");
          cleanupSession();
        }
      };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Izin mikrofon atau koneksi suara gagal dibuka.";
      toast.error(msg);
      setErrorNotice(msg);
      cleanupSession();
    }
  }

  function handleSendTextPrompt(e: React.FormEvent) {
    e.preventDefault();
    const clean = textFollowup.trim();
    if (!clean || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    wsRef.current.send(JSON.stringify({ text: clean }));
    appendTranscript("owner", clean);
    setTextFollowup("");
  }

  function startLocalDictation() {
    if (status !== "idle") return;
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: ((e: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: ((e: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
    };

    const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      toast.error(
        "Peramban Anda belum mendukung dikte suara lokal. Silakan ketik pada kolom Input Perintah Bahasa Alami di samping."
      );
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = "id-ID";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setStatus("local-dictating");

    recognition.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      setStatus("idle");
      if (!spoken) return;
      const draft = parseNaturalCommand(spoken, vault?.accounts ?? []);
      void queueCommand
        .mutateAsync({
          command_text: `[Dikte Lokal] ${spoken}`,
          parsed_draft: draft,
        })
        .then(() => {
          toast.success(
            `Dikte "${spoken}" masuk ke Antrean Persetujuan (mode lokal).`
          );
          setErrorNotice(null);
        })
        .catch((err) => {
          toast.error(
            err instanceof Error ? err.message : "Gagal menyimpan draf dikte."
          );
        });
    };

    recognition.onerror = () => {
      setStatus("idle");
      toast.error(
        "Dikte suara lokal tidak menangkap ucapan. Anda bisa mengetik langsung di kolom Parser Lokal."
      );
    };

    recognition.onend = () => {
      setStatus((prev) => (prev === "local-dictating" ? "idle" : prev));
    };

    recognition.start();
  }

  const supportsLocalSpeech =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  return (
    <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            <Mic className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
              Obrolan Suara Langsung (EGO Live)
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
              Cukup ceritakan transaksi Anda dengan suara—EGO akan menyiapkan drafnya untuk Anda setujui.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {supportsLocalSpeech && status === "idle" ? (
            <button
              type="button"
              onClick={startLocalDictation}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Mic className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>Dikte Lokal</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={status === "idle" ? startLiveSession : cleanupSession}
            disabled={status === "connecting" || status === "local-dictating"}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
              status === "active"
                ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
                : "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
            } disabled:opacity-60`}
          >
            {status === "connecting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Menghubungkan...</span>
              </>
            ) : status === "local-dictating" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Mendengarkan...</span>
              </>
            ) : status === "active" ? (
              <>
                <MicOff className="h-4 w-4" aria-hidden="true" />
                <span>Akhiri Sesi Suara</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" aria-hidden="true" />
                <span>Mulai Bicara</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorNotice ? (
        <div className="mt-4 space-y-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="leading-relaxed">{errorNotice}</p>
          {supportsLocalSpeech ? (
            <button
              type="button"
              onClick={startLocalDictation}
              disabled={status !== "idle"}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <Mic className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>Gunakan Dikte Suara Perangkat (Lokal)</span>
            </button>
          ) : (
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
              Alternatif lokal: Anda tetap dapat mengetik perintah di kolom Input Perintah Bahasa Alami (Parser Lokal) di sebelah kiri.
            </p>
          )}
        </div>
      ) : null}

      {status === "active" ? (
        <div className="mt-5 space-y-3 border-t border-stone-200/80 pt-4 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Mikrofon aktif (16kHz PCM) · Respons suara langsung (24kHz)</span>
          </div>

          <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-950">
            {transcripts.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-zinc-500">
                Ucapkan misalnya: "Catat beli makan siang 45 ribu pakai GoPay."
              </p>
            ) : (
              transcripts.map((entry) => (
                <div key={entry.id} className="text-xs leading-relaxed">
                  <span
                    className={`mr-2 font-semibold ${
                      entry.speaker === "owner"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : entry.speaker === "ego"
                          ? "text-stone-900 dark:text-zinc-200"
                          : "text-stone-500 dark:text-zinc-500"
                    }`}
                  >
                    {entry.speaker === "owner"
                      ? "Owner:"
                      : entry.speaker === "ego"
                        ? "EGO:"
                        : "Info:"}
                  </span>
                  <span className="text-stone-700 dark:text-zinc-300">
                    {entry.text}
                  </span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendTextPrompt} className="flex gap-2">
            <input
              type="text"
              value={textFollowup}
              onChange={(e) => setTextFollowup(e.target.value)}
              placeholder="Atau ketik pesan lanjutan di sesi aktif..."
              aria-label="Pesan teks lanjutan untuk sesi suara"
              className="flex-1 rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
            />
            <button
              type="submit"
              aria-label="Kirim pesan ke sesi suara"
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Kirim</span>
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
```

---

## 41. `src/components/ego/money-input.tsx` (63 lines)

```tsx
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
}: MoneyInputProps) {
  const displayValue =
    value > 0 ? formatThousandsInput(String(Math.round(value))) : "";

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
      >
        {label}
        {required ? (
          <span className="ml-1 text-rose-600 dark:text-rose-400">*</span>
        ) : null}
      </label>
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3.5 text-sm font-medium text-stone-500 font-mono dark:text-zinc-400">
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
          className="w-full rounded-xl border border-stone-200 bg-stone-50/70 py-2.5 pr-3.5 pl-11 text-sm font-mono tabular-nums text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
        />
      </div>
      {hint ? (
        <p className="text-xs text-stone-500 dark:text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}
```

---

## 42. `src/components/ego/pin-lock-screen.tsx` (230 lines)

```tsx
import { useNavigate } from "@tanstack/react-router";
import { Delete, Loader2, Lock, LogOut, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { markPinSessionUnlocked } from "../../lib/pin-lock";
import { useLogoutOwner, useVerifyPin } from "../../lib/queries";
import { ThemeToggleButton } from "../../lib/theme";

interface PinLockScreenProps {
  ownerName: string;
}

const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export function PinLockScreen({ ownerName }: PinLockScreenProps) {
  const navigate = useNavigate();
  const verifyPin = useVerifyPin();
  const logout = useLogoutOwner();

  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const submitPin = useCallback(
    async (candidate: string) => {
      if (submittingRef.current || candidate.length !== 6) return;
      submittingRef.current = true;
      setErrorMsg(null);
      try {
        await verifyPin.mutateAsync(candidate);
        markPinSessionUnlocked();
        toast.success("Brankas dibuka dengan PIN cepat.");
      } catch (err) {
        setPin("");
        setErrorMsg(
          err instanceof Error ? err.message : "PIN 6 digit tidak sesuai."
        );
      } finally {
        submittingRef.current = false;
      }
    },
    [verifyPin]
  );

  const appendDigit = useCallback(
    (digit: string) => {
      if (submittingRef.current || verifyPin.isPending) return;
      setErrorMsg(null);
      setPin((prev) => {
        if (prev.length >= 6) return prev;
        const next = `${prev}${digit}`;
        if (next.length === 6) {
          void submitPin(next);
        }
        return next;
      });
    },
    [submitPin, verifyPin.isPending]
  );

  const handleBackspace = useCallback(() => {
    if (submittingRef.current || verifyPin.isPending) return;
    setErrorMsg(null);
    setPin((prev) => prev.slice(0, -1));
  }, [verifyPin.isPending]);

  const handleClear = useCallback(() => {
    if (submittingRef.current || verifyPin.isPending) return;
    setErrorMsg(null);
    setPin("");
  }, [verifyPin.isPending]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        appendDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape" || e.key === "Delete") {
        e.preventDefault();
        handleClear();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appendDigit, handleBackspace, handleClear]);

  async function handleFallbackLogout() {
    await logout.mutateAsync();
    toast.success("Silakan masuk kembali dengan email dan kata sandi lengkap.");
    await navigate({ to: "/auth" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 py-8 text-stone-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mb-4 flex w-full max-w-sm justify-end">
        <ThemeToggleButton />
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-stone-200/90 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-7">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            <Lock className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Kunci PIN Brankas
            </p>
            <p className="truncate text-sm font-semibold text-stone-900 dark:text-zinc-100">
              EGO Personal AI
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
            Masukkan PIN 6 Digit
          </h1>
          <p className="mt-1 text-xs text-stone-600 dark:text-zinc-400">
            Brankas <span className="font-medium text-stone-800 dark:text-zinc-200">{ownerName}</span> terkunci. Ketik atau sentuh 6 digit PIN untuk melanjutkan.
          </p>
        </div>

        {/* 6-digit visual dots */}
        <div
          role="status"
          aria-label={`PIN terisi ${pin.length} dari 6 digit`}
          className="mt-6 flex items-center justify-center gap-3.5"
        >
          {Array.from({ length: 6 }).map((_, idx) => {
            const filled = idx < pin.length;
            return (
              <span
                key={idx}
                className={`h-3.5 w-3.5 rounded-full border transition-all duration-150 ${
                  filled
                    ? "scale-105 border-emerald-600 bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-400"
                    : "border-stone-300 bg-stone-100 dark:border-zinc-700 dark:bg-zinc-800"
                }`}
              />
            );
          })}
        </div>

        <div className="mt-4 min-h-10 text-center">
          {verifyPin.isPending ? (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>Memverifikasi PIN brankas...</span>
            </p>
          ) : errorMsg ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300"
            >
              {errorMsg}
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-zinc-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>Terlindungi batas 5 kali percobaan gagal</span>
            </p>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {KEYPAD_KEYS.map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={verifyPin.isPending}
              onClick={() => appendDigit(digit)}
              aria-label={`Angka ${digit}`}
              className="flex h-13 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 font-mono text-lg font-semibold text-stone-900 transition-colors hover:bg-stone-100 active:scale-[0.98] disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            disabled={verifyPin.isPending || pin.length === 0}
            onClick={handleClear}
            className="flex h-13 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Bersihkan
          </button>

          <button
            type="button"
            disabled={verifyPin.isPending}
            onClick={() => appendDigit("0")}
            aria-label="Angka 0"
            className="flex h-13 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 font-mono text-lg font-semibold text-stone-900 transition-colors hover:bg-stone-100 active:scale-[0.98] disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            0
          </button>

          <button
            type="button"
            disabled={verifyPin.isPending || pin.length === 0}
            onClick={handleBackspace}
            aria-label="Hapus satu digit"
            className="flex h-13 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Delete className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 border-t border-stone-200/80 pt-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleFallbackLogout}
            disabled={logout.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Masuk dengan Kata Sandi Lengkap</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 43. `src/components/ego/pwa-controls.tsx` (146 lines)

```tsx
import { Download, Share, Smartphone, WifiOff, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useOnlineStatus, usePWAInstall } from "../../lib/pwa";

export function PWAInstallButton({
  className = "",
  fullWidth = false,
}: {
  className?: string;
  fullWidth?: boolean;
}) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={async () => {
          const accepted = await install();
          if (accepted) {
            toast.success("EGO Personal AI berhasil dipasang ke perangkat.");
          }
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 whitespace-nowrap dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25 ${
          fullWidth ? "w-full" : ""
        } ${className}`}
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Pasang Aplikasi</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 whitespace-nowrap dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 ${
            fullWidth ? "w-full" : ""
          } ${className}`}
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Pasang di iPhone / iPad</span>
        </button>

        {showIOSGuide ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-pwa-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-xs dark:bg-black/75"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                    <Smartphone className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <h3
                    id="ios-pwa-title"
                    className="text-base font-semibold text-stone-900 dark:text-zinc-100"
                  >
                    Pasang di Layar Utama iOS
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Tutup panduan instalasi"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ol className="mt-4 space-y-2.5 text-xs leading-relaxed text-stone-600 dark:text-zinc-300">
                <li>
                  1. Ketuk tombol{" "}
                  <strong className="inline-flex items-center gap-1 text-stone-900 dark:text-zinc-100">
                    <Share className="h-3 w-3" aria-hidden="true" /> Bagikan
                    (Share)
                  </strong>{" "}
                  pada bilah bawah Safari.
                </li>
                <li>
                  2. Gulir ke bawah lalu pilih{" "}
                  <strong className="text-stone-900 dark:text-zinc-100">
                    Tambahkan ke Layar Utama (Add to Home Screen)
                  </strong>
                  .
                </li>
                <li>
                  3. Ketuk{" "}
                  <strong className="text-stone-900 dark:text-zinc-100">
                    Tambah
                  </strong>{" "}
                  di pojok kanan atas untuk membuka EGO Personal AI layaknya aplikasi harian.
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
              >
                Mengerti
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return null;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 z-50 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-md dark:border-amber-500/40 dark:bg-amber-950/90 dark:text-amber-200 md:bottom-5"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Mode Luring — Menampilkan data cache terakhir.</span>
    </div>
  );
}
```

---

## 44. `src/components/ego/receipt-scanner.tsx` (297 lines)

```tsx
import { Camera, ImagePlus, Loader2, Receipt, Send, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { parseNaturalCommand } from "../../lib/command-parser";
import { useQueueCommand, useScanReceipt } from "../../lib/queries";
import type { AccountBalance } from "../../types/ego";

async function compressReceiptImage(file: File): Promise<{
  dataUrl: string;
  base64: string;
  mimeType: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar struk."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () =>
        reject(new Error("Format gambar tidak didukung oleh peramban."));
      img.onload = () => {
        const maxEdge = 1400;
        let { width, height } = img;
        if (width > maxEdge || height > maxEdge) {
          if (width >= height) {
            height = Math.round((height * maxEdge) / width);
            width = maxEdge;
          } else {
            width = Math.round((width * maxEdge) / height);
            height = maxEdge;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Kanvas kompresi gambar tidak tersedia."));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        const base64 = dataUrl.split(",")[1] ?? "";
        resolve({ dataUrl, base64, mimeType: "image/jpeg" });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ReceiptScanner({ accounts }: { accounts: AccountBalance[] }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scanReceipt = useScanReceipt();
  const queueCommand = useQueueCommand();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualFallbackText, setManualFallbackText] = useState("");
  const [showManualFallback, setShowManualFallback] = useState(false);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    try {
      const compressed = await compressReceiptImage(file);
      setPreviewUrl(compressed.dataUrl);
      setImageBase64(compressed.base64);
      setMimeType(compressed.mimeType);
      setFileName(file.name);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal memproses foto struk."
      );
    } finally {
      e.target.value = "";
    }
  }

  function handleClear() {
    setPreviewUrl(null);
    setImageBase64(null);
    setFileName(null);
    setErrorMsg(null);
    setManualFallbackText("");
    setShowManualFallback(false);
  }

  async function handleAnalyzeAndQueue() {
    if (!imageBase64) return;
    setErrorMsg(null);

    try {
      const scanned = await scanReceipt.mutateAsync({
        imageBase64,
        mimeType,
        accounts,
      });

      await queueCommand.mutateAsync({
        command_text: scanned.commandText,
        parsed_draft: scanned.draft,
      });

      toast.success(
        `Struk "${scanned.merchant}" masuk ke Antrean Persetujuan. Tinjau dan setujui sebelum saldo berubah.`
      );
      handleClear();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal menganalisis struk melalui Gemini AI.";
      setErrorMsg(message);
      setShowManualFallback(true);
      toast.error(message);
    }
  }

  async function handleQueueManualFromPhoto(e: React.FormEvent) {
    e.preventDefault();
    const clean = manualFallbackText.trim();
    if (!clean) {
      toast.error("Tulis ringkasan transaksi dari foto struk terlebih dahulu.");
      return;
    }
    try {
      const draft = parseNaturalCommand(clean, accounts);
      await queueCommand.mutateAsync({
        command_text: `[Manual dari Foto Struk] ${clean}`,
        parsed_draft: draft,
      });
      toast.success(
        "Catatan dari foto struk masuk ke Antrean Persetujuan (mode parser lokal)."
      );
      handleClear();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memasukkan draf manual."
      );
    }
  }

  const busy = scanReceipt.isPending || queueCommand.isPending;

  return (
    <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            <Receipt className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
              Scan Struk / Nota Otomatis (Foto → Antrean Persetujuan)
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
              Unggah foto struk belanja, nota restoran, atau bukti transfer. Gemini AI mengekstrak nominal, tanggal, merchant, dan kategori ke Antrean Persetujuan tanpa mengubah saldo secara otomatis.
            </p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="sr-only"
        id="receipt-upload-input"
        aria-label="Pilih atau ambil foto struk transaksi"
      />

      {!previewUrl ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300/90 bg-stone-50/70 px-4 py-6 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-500 dark:bg-zinc-900 dark:text-zinc-400">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-2.5 text-xs font-semibold text-stone-900 dark:text-zinc-200">
            Pilih foto struk dari galeri atau kamera ponsel
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-zinc-400">
            Mendukung JPG, PNG, WebP · Gambar dikompres otomatis sebelum dikirim ke server
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3.5 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <ImagePlus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>Ambil Foto / Pilih Struk</span>
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4 rounded-xl border border-stone-200 bg-stone-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/70 sm:flex-row sm:items-center">
          <img
            src={previewUrl}
            alt="Pratinjau foto struk"
            className="h-32 w-32 shrink-0 rounded-xl border border-stone-200 object-cover dark:border-zinc-800"
          />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div>
              <p className="truncate text-xs font-semibold text-stone-900 dark:text-zinc-100">
                {fileName || "Foto Struk Siap Dianalisis"}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-500 dark:text-zinc-400">
                Hasil ekstraksi akan masuk ke Antrean Persetujuan Owner di bawah untuk Anda tinjau.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAnalyzeAndQueue}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>
                  {scanReceipt.isPending
                    ? "Menganalisis Struk..."
                    : "Analisis Struk & Kirim ke Antrean"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <span>Ganti Foto</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                disabled={busy}
                aria-label="Hapus pratinjau struk"
                className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {errorMsg ? (
        <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="leading-relaxed">{errorMsg}</p>
          {showManualFallback && previewUrl ? (
            <form onSubmit={handleQueueManualFromPhoto} className="space-y-2 border-t border-amber-200/80 pt-3 dark:border-amber-500/20">
              <label
                htmlFor="manual-receipt-fallback"
                className="block text-[11px] font-semibold text-amber-900 dark:text-amber-200"
              >
                Alternatif Cepat (Parser Lokal): Ketik isi struk sambil melihat foto di atas
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="manual-receipt-fallback"
                  type="text"
                  value={manualFallbackText}
                  onChange={(e) => setManualFallbackText(e.target.value)}
                  placeholder='Contoh: "Indomaret 85rb pakai BCA"'
                  className="min-w-0 flex-1 rounded-xl border border-amber-300/90 bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={queueCommand.isPending || !manualFallbackText.trim()}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-zinc-950"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Kirim ke Antrean</span>
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
```

---

## 45. `src/components/ego/tts-button.tsx` (122 lines)

```tsx
import { Loader2, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { requestSpeechAudio } from "../../lib/queries";

interface TtsButtonProps {
  text: string;
  label?: string;
  stylePrompt?: string;
  compact?: boolean;
}

export function TtsButton({
  text,
  label = "Bacakan",
  stylePrompt,
  compact = false,
}: TtsButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  async function handleToggle() {
    if (status === "playing") {
      audioRef.current?.pause();
      audioRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setStatus("idle");
      return;
    }
    if (!text.trim()) return;

    setStatus("loading");
    try {
      const dataUrl = await requestSpeechAudio(text, stylePrompt);
      const audio = new Audio(dataUrl);
      audioRef.current = audio;
      audio.onended = () => setStatus("idle");
      audio.onerror = () => {
        setStatus("idle");
        toast.error("Gagal memutar audio suara.");
      };
      await audio.play();
      setStatus("playing");
    } catch (err) {
      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        typeof SpeechSynthesisUtterance !== "undefined"
      ) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text.trim().slice(0, 2500));
          utterance.lang = "id-ID";
          utterance.rate = 1.0;
          utterance.onend = () => setStatus("idle");
          utterance.onerror = () => setStatus("idle");
          window.speechSynthesis.speak(utterance);
          setStatus("playing");
          toast.info("Suara dialihkan ke sintesis suara perangkat (alternatif hemat kuota AI).");
          return;
        } catch {
          // Fall through to error toast
        }
      }
      setStatus("idle");
      toast.error(
        err instanceof Error ? err.message : "Gagal menghasilkan audio TTS."
      );
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={status === "loading" || !text.trim()}
      aria-label={status === "playing" ? `Hentikan suara ${label}` : label}
      className={`inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white text-xs font-medium text-stone-700 shadow-2xs transition-colors hover:border-stone-300 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 whitespace-nowrap shrink-0 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-none dark:hover:border-zinc-700 dark:hover:bg-zinc-800 ${
        compact ? "px-3 py-1.5" : "px-3.5 py-2"
      }`}
    >
      {status === "loading" ? (
        <Loader2
          className="h-3.5 w-3.5 animate-spin text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
      ) : status === "playing" ? (
        <Square
          className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400"
          aria-hidden="true"
        />
      ) : (
        <Volume2
          className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
      )}
      <span>
        {status === "loading"
          ? "Menyiapkan Suara..."
          : status === "playing"
            ? "Hentikan"
            : label}
      </span>
    </button>
  );
}
```

---

## 46. `src/routes/__root.tsx` (61 lines)

```tsx
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { egoKeys } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { ThemeProvider, useTheme } from "../lib/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RootContent() {
  const { theme } = useTheme();
  const qc = useQueryClient();

  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void qc.invalidateQueries({ queryKey: egoKeys.auth });
      void qc.invalidateQueries({ queryKey: egoKeys.vault });
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [qc]);

  return (
    <>
      <Outlet />
      <Toaster
        position="bottom-right"
        theme={theme}
        toastOptions={{
          classNames: {
            toast:
              "rounded-xl border border-stone-200 bg-white text-stone-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
          },
        }}
      />
    </>
  );
}

export function RootComponent() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RootContent />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

---

## 47. `src/routes/auth.tsx` (414 lines)

```tsx
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useAuthStatus,
  useLoginOwner,
  useRegisterOwner,
  useResetLocalOwner,
} from "../lib/queries";
import { ThemeToggleButton } from "../lib/theme";

export function AuthRoutePage() {
  const navigate = useNavigate();
  const { data: auth, isLoading } = useAuthStatus();
  const registerMutation = useRegisterOwner();
  const loginMutation = useLoginOwner();
  const resetOwnerMutation = useResetLocalOwner();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("Owner Utama");
  const [supabaseAction, setSupabaseAction] = useState<"login" | "register">("login");
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [showResetPanel, setShowResetPanel] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetKeyword, setResetKeyword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (auth?.authenticated) {
      void navigate({ to: "/" });
    }
  }, [auth?.authenticated, navigate]);

  const isSupabaseMode = auth?.mode === "supabase";
  const isRegistrationMode = isSupabaseMode
    ? supabaseAction === "register"
    : auth
      ? !auth.hasOwner
      : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);
    try {
      if (isRegistrationMode) {
        const res = await registerMutation.mutateAsync({
          email,
          password,
          full_name: fullName,
        });
        if (res.needsEmailConfirmation) {
          const msg = `Pendaftaran berhasil. Silakan buka kotak masuk ${email.trim()} dan klik tautan konfirmasi dari Supabase sebelum masuk.`;
          setFormNotice(msg);
          setSupabaseAction("login");
          toast.success("Tautan konfirmasi telah dikirim ke email Anda.");
          return;
        }
        toast.success("Brankas pribadi Anda siap digunakan.");
      } else {
        await loginMutation.mutateAsync({ email, password });
        toast.success("Selamat datang kembali di brankas Anda.");
      }
      await navigate({ to: "/" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Autentikasi Owner gagal.";
      setFormError(message);
      toast.error(message);
    }
  }

  async function handleResetLocalOwner(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    try {
      await resetOwnerMutation.mutateAsync({
        confirmed: resetConfirmed,
        confirmation_text: resetKeyword,
      });
      setShowResetPanel(false);
      setResetConfirmed(false);
      setResetKeyword("");
      setFormError(null);
      setEmail("");
      setPassword("");
      toast.success(
        "Akun Owner lama berhasil dihapus. Silakan daftar ulang dengan email yang benar."
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus akun Owner.";
      setResetError(message);
      toast.error(message);
    }
  }

  const pending =
    registerMutation.isPending ||
    loginMutation.isPending ||
    resetOwnerMutation.isPending;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 py-12 transition-colors duration-200 dark:bg-zinc-950">
      <div className="mb-4 flex w-full max-w-md justify-end">
        <ThemeToggleButton />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-8">
        <div className="mb-6 flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
              EGO Personal AI
            </h1>
            <p className="text-xs text-stone-600 dark:text-zinc-400">
              Asisten Keuangan Pribadi · Kendali Penuh di Tangan Anda
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-stone-600 dark:text-zinc-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
            <span>Menyiapkan brankas Anda...</span>
          </div>
        ) : (
          <>
            {isSupabaseMode ? (
              <div
                role="tablist"
                aria-label="Mode autentikasi Supabase"
                className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-stone-200 bg-stone-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={supabaseAction === "login"}
                  onClick={() => {
                    setSupabaseAction("login");
                    setFormError(null);
                    setFormNotice(null);
                  }}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                    supabaseAction === "login"
                      ? "bg-white text-stone-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  Masuk Owner
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={supabaseAction === "register"}
                  onClick={() => {
                    setSupabaseAction("register");
                    setFormError(null);
                    setFormNotice(null);
                  }}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                    supabaseAction === "register"
                      ? "bg-white text-stone-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  Daftar Owner Pertama
                </button>
              </div>
            ) : null}

            <div className="mb-6 rounded-xl border border-stone-200/80 bg-stone-50/80 p-4 text-xs leading-relaxed text-stone-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              {isRegistrationMode ? (
                <span>
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    Selamat datang! Buat akun Owner pertama Anda:
                  </strong>{" "}
                  Sistem ini khusus untuk satu pemilik tunggal. Setelah terdaftar,
                  akun kedua akan ditolak otomatis demi privasi brankas.
                </span>
              ) : (
                <span>
                  <strong className="text-stone-900 dark:text-zinc-100">
                    Brankas Terkunci (Single-Owner):
                  </strong>{" "}
                  Silakan masuk menggunakan email dan kata sandi Anda untuk melanjutkan.
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistrationMode ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="owner-name"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Nama Panggilan / Owner
                  </label>
                  <input
                    id="owner-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Owner Utama"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
                  />
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label
                  htmlFor="owner-email"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Email Owner
                </label>
                <input
                  id="owner-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@domain.id"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="owner-password"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Kata Sandi Brankas
                </label>
                <input
                  id="owner-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
                />
              </div>

              {formNotice ? (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                >
                  {formNotice}
                </div>
              ) : null}

              {formError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  {formError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : isRegistrationMode ? (
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                )}
                <span>
                  {isRegistrationMode
                    ? "Daftarkan Owner Tunggal"
                    : "Buka Brankas Owner"}
                </span>
              </button>
            </form>

            {!isSupabaseMode && !isRegistrationMode ? (
              <div className="mt-5 border-t border-stone-200/80 pt-4 dark:border-zinc-800">
                <button
                  type="button"
                  aria-expanded={showResetPanel}
                  onClick={() => {
                    setShowResetPanel((v) => !v);
                    setResetError(null);
                  }}
                  className="text-xs font-medium text-stone-600 underline decoration-stone-300 underline-offset-4 transition-colors hover:text-rose-700 dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-rose-300"
                >
                  Email salah atau tidak bisa masuk? Hapus Akun Owner
                </button>

                {showResetPanel ? (
                  <form
                    onSubmit={handleResetLocalOwner}
                    className="mt-3 space-y-3 rounded-xl border border-rose-200/90 bg-rose-50/70 p-4 dark:border-rose-500/30 dark:bg-rose-950/20"
                  >
                    <div className="flex items-start gap-2.5 text-xs leading-relaxed text-rose-900 dark:text-rose-200">
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400"
                        aria-hidden="true"
                      />
                      <p>
                        Jika Anda salah memasukkan email saat pendaftaran atau lupa kata sandi, Anda dapat menghapus akun Owner saat ini untuk mendaftar ulang. Demi keamanan, seluruh data brankas lokal akan dikosongkan.
                      </p>
                    </div>

                    <label className="flex cursor-pointer items-start gap-2.5 text-xs text-stone-800 dark:text-zinc-200">
                      <input
                        type="checkbox"
                        checked={resetConfirmed}
                        onChange={(e) => setResetConfirmed(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-rose-300 accent-rose-600"
                      />
                      <span>
                        Saya setuju menghapus akun Owner dan mengosongkan seluruh data brankas lokal saat ini.
                      </span>
                    </label>

                    <div className="space-y-1">
                      <label
                        htmlFor="reset-owner-keyword"
                        className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                      >
                        Ketik <span className="font-mono font-semibold">HAPUS</span> untuk konfirmasi
                      </label>
                      <input
                        id="reset-owner-keyword"
                        type="text"
                        value={resetKeyword}
                        onChange={(e) => setResetKeyword(e.target.value)}
                        placeholder="HAPUS"
                        autoComplete="off"
                        className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-500 focus:outline-none dark:border-rose-500/30 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </div>

                    {resetError ? (
                      <div
                        role="alert"
                        className="rounded-xl border border-rose-300 bg-white/90 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/40 dark:bg-zinc-950 dark:text-rose-300"
                      >
                        {resetError}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={resetOwnerMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
                      >
                        {resetOwnerMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>Hapus Akun Owner &amp; Daftar Ulang</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowResetPanel(false);
                          setResetConfirmed(false);
                          setResetKeyword("");
                          setResetError(null);
                        }}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex items-center gap-2 border-t border-stone-200/80 pt-4 text-xs text-stone-500 dark:border-zinc-800 dark:text-zinc-500">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Penyimpanan:{" "}
                {auth?.mode === "supabase"
                  ? "Supabase Cloud (RLS Aktif)"
                  : "Brankas Server Lokal (Siap Supabase)"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

---

## 48. `src/routes/_authenticated/route.tsx` (45 lines)

```tsx
import { Outlet, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { PinLockScreen } from "../../components/ego/pin-lock-screen";
import {
  shouldShowPinLockScreen,
  subscribePinLockChange,
} from "../../lib/pin-lock";
import { useAuthStatus } from "../../lib/queries";

export function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { data: auth, isLoading } = useAuthStatus();
  const isPinLockedView = useSyncExternalStore(
    subscribePinLockChange,
    () => shouldShowPinLockScreen(Boolean(auth?.hasPin)),
    () => false
  );

  useEffect(() => {
    if (!isLoading && auth && !auth.authenticated) {
      void navigate({ to: "/auth" });
    }
  }, [auth, isLoading, navigate]);

  if (isLoading || !auth?.authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-sm text-stone-600 dark:bg-zinc-950 dark:text-zinc-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
        <span>Memverifikasi sesi brankas Anda...</span>
      </div>
    );
  }

  if (isPinLockedView) {
    return (
      <PinLockScreen
        ownerName={auth.owner?.full_name || auth.owner?.email || "Owner Utama"}
      />
    );
  }

  return <Outlet />;
}
```

---

## 49. `src/routes/_authenticated/index.tsx` (566 lines)

```tsx
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Bot, Plus } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../../components/ego/app-shell";
import { CashflowChart } from "../../components/ego/cashflow-chart";
import { CategoryBreakdown } from "../../components/ego/category-breakdown";
import { TtsButton } from "../../components/ego/tts-button";
import {
  accountTypeLabel,
  computeAverageMonthlyCashflow,
  computeEmergencyFundMonths,
  computeGoalProgress,
  computeMonthlyCashflow,
  computeNetWorth,
  daysUntilDue,
  formatDateID,
  formatIDR,
  getDueRecurringBills,
  getGreetingID,
  todayISO,
} from "../../lib/finance";
import { useAuthStatus, useVaultSnapshot } from "../../lib/queries";

export function DashboardPage() {
  const { data: auth } = useAuthStatus();
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const navigate = useNavigate();
  const [chartMonths, setChartMonths] = useState<3 | 6 | 12>(6);
  const [breakdownType, setBreakdownType] = useState<"income" | "expense">(
    "expense"
  );

  const accounts = vault?.accounts ?? [];
  const transactions = vault?.transactions ?? [];
  const assets = vault?.assets ?? [];
  const debts = vault?.debts ?? [];
  const recurringBills = vault?.recurring_bills ?? [];
  const savingsGoals = vault?.savings_goals ?? [];
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";

  const netWorth = computeNetWorth(accounts, assets, debts);
  const currentMonth = todayISO().slice(0, 7);
  const cashflow = computeMonthlyCashflow(transactions, currentMonth);
  const avgCashflow = computeAverageMonthlyCashflow(transactions, 3, currentMonth);
  const emergencyMonths = computeEmergencyFundMonths(
    netWorth.totalAccountBalance,
    avgCashflow.avgExpense
  );
  const dueBills = getDueRecurringBills(recurringBills);
  const activeGoals = savingsGoals.filter((g) => g.status === "active").slice(0, 2);

  const recentTx = transactions.slice(0, 5);
  const activeAccounts = accounts.filter((a) => a.is_active);
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const pendingCommands =
    vault?.owner_commands.filter((c) => c.status === "pending").length ?? 0;

  const ownerName = auth?.owner?.full_name?.trim() || "Owner";
  const greeting = getGreetingID();

  const summarySpeechText = `Ringkasan Keuangan Owner saat ini. Kekayaan bersih Anda adalah ${formatIDR(
    netWorth.netWorth
  )}. Total saldo kas dan rekening mencapai ${formatIDR(
    netWorth.totalAccountBalance
  )}, total nilai aset ${formatIDR(
    netWorth.totalAssetValue
  )}, dan sisa kewajiban utang sebesar ${formatIDR(
    netWorth.totalDebtBalance
  )}. Pada bulan ini, pemasukan terposting sebesar ${formatIDR(
    cashflow.income
  )} dan pengeluaran terposting sebesar ${formatIDR(cashflow.expense)}.`;

  return (
    <AppShell
      title={`${greeting}, ${ownerName}`}
      subtitle="Ringkasan kekayaan, arus kas, dan agenda keuangan Anda."
      action={
        <div className="flex items-center gap-2">
          <TtsButton
            text={summarySpeechText}
            label="Bacakan Ringkasan"
            compact
          />
          <Link
            to="/transaksi"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Catat Cepat</span>
          </Link>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-5">
          <div className="h-32 animate-pulse rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="h-80 animate-pulse rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-7" />
            <div className="h-80 animate-pulse rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-5" />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Unified Top Overview Strip */}
          <section
            aria-label="Ringkasan Utama"
            className="grid divide-y divide-stone-200/80 rounded-2xl border border-stone-200/90 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-12 lg:divide-x lg:divide-y-0"
          >
            {/* 1. Net Worth Anchor */}
            <div className="p-5 lg:col-span-5">
              <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                Kekayaan Bersih
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold tracking-tight text-stone-900 tabular-nums dark:text-zinc-100 sm:text-3xl">
                {formatIDR(netWorth.netWorth)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-600 dark:text-zinc-400">
                <span>
                  Saldo{" "}
                  <strong className="font-mono font-semibold tabular-nums text-stone-900 dark:text-zinc-200">
                    {formatIDR(netWorth.totalAccountBalance)}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Aset{" "}
                  <strong className="font-mono font-semibold tabular-nums text-stone-900 dark:text-zinc-200">
                    {formatIDR(netWorth.totalAssetValue)}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Utang{" "}
                  <strong className="font-mono font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {formatIDR(netWorth.totalDebtBalance)}
                  </strong>
                </span>
              </div>
            </div>

            {/* 2. Monthly Cashflow */}
            <div className="flex flex-col justify-between p-5 lg:col-span-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                  Arus Kas Bulan Ini
                </p>
                <span className="font-mono text-xs text-stone-400 tabular-nums dark:text-zinc-500">
                  {currentMonth}
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                    Pemasukan
                  </p>
                  <p className="mt-0.5 whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-base">
                    +{formatIDR(cashflow.income)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                    Pengeluaran
                  </p>
                  <p className="mt-0.5 whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400 sm:text-base">
                    -{formatIDR(cashflow.expense)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-stone-500 dark:text-zinc-400">
                <span>Selisih bersih</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    cashflow.netCashflow >= 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {formatIDR(cashflow.netCashflow)}
                </span>
              </div>
            </div>

            {/* 3. EGO AI Quick Action */}
            <div className="flex flex-col justify-between p-5 lg:col-span-3">
              <div>
                <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                  Asisten EGO AI
                </p>
                <p className="mt-1.5 text-sm leading-snug text-stone-700 dark:text-zinc-300">
                  {pendingCommands > 0
                    ? `${pendingCommands} draf menunggu persetujuan Anda.`
                    : "Catat via teks, suara, atau foto struk."}
                </p>
              </div>
              <div className="mt-3">
                <Link
                  to="/owner"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 whitespace-nowrap dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                >
                  <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Buka Owner Control</span>
                </Link>
              </div>
            </div>
          </section>

          {/* Row 2: Cashflow Chart & Category Breakdown */}
          <section className="grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <CashflowChart
                transactions={transactions}
                monthsCount={chartMonths}
                onMonthsCountChange={setChartMonths}
                referenceMonth={currentMonth}
              />
            </div>

            <div className="lg:col-span-5">
              <CategoryBreakdown
                title="Rincian Kategori Bulan Ini"
                subtitle={`${
                  breakdownType === "expense" ? "Pengeluaran" : "Pemasukan"
                } pada ${currentMonth}`}
                transactions={transactions}
                type={breakdownType}
                onTypeChange={setBreakdownType}
                yearMonth={currentMonth}
                maxItems={5}
                onSelectCategory={(cat, txType) => {
                  void navigate({
                    to: "/transaksi",
                    search: { kategori: cat, jenis: txType },
                  });
                }}
              />
            </div>
          </section>

          {/* Row 3: Accounts & Recent Transactions */}
          <section className="grid gap-5 lg:grid-cols-12">
            {/* Active Accounts */}
            <div className="rounded-2xl border border-stone-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-5">
              <div className="mb-3.5 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                  Dompet &amp; Rekening
                </h2>
                <Link
                  to="/akun"
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  <span>Kelola</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>

              {activeAccounts.length === 0 ? (
                <div className="py-5 text-center">
                  <p className="text-xs font-medium text-stone-700 dark:text-zinc-300">
                    Belum ada dompet atau rekening aktif.
                  </p>
                  <Link
                    to="/akun"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tambah Akun Pertama</span>
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-stone-200/70 dark:divide-zinc-800">
                  {activeAccounts.slice(0, 6).map((acc) => (
                    <li
                      key={acc.id}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-stone-900 dark:text-zinc-100">
                          {acc.account_name}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-zinc-400">
                          {accountTypeLabel(acc.account_type)} · {acc.currency}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-stone-900 dark:text-zinc-100">
                        {formatIDR(acc.current_balance)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 5 Latest Transactions */}
            <div className="rounded-2xl border border-stone-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-7">
              <div className="mb-3.5 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                  5 Transaksi Terakhir
                </h2>
                <Link
                  to="/transaksi"
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  <span>Riwayat Lengkap</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>

              {recentTx.length === 0 ? (
                <div className="py-5 text-center">
                  <p className="text-xs font-medium text-stone-700 dark:text-zinc-300">
                    Belum ada catatan transaksi terposting.
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Link
                      to="/transaksi"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Catat Transaksi</span>
                    </Link>
                    <Link
                      to="/owner"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Tanya EGO AI</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-stone-200/70 dark:divide-zinc-800">
                  {recentTx.map((tx) => {
                    const isCancelled = tx.status === "cancelled";
                    const sign =
                      tx.transaction_type === "income"
                        ? "+"
                        : tx.transaction_type === "expense"
                          ? "-"
                          : "⇄ ";
                    const amtColor = isCancelled
                      ? "text-stone-400 line-through dark:text-zinc-500"
                      : tx.transaction_type === "income"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : tx.transaction_type === "expense"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-stone-800 dark:text-zinc-200";

                    return (
                      <li
                        key={tx.id}
                        className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-stone-900 dark:text-zinc-100">
                            {tx.description || tx.category || "Mutasi Kas"}
                          </p>
                          <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                            {formatDateID(tx.transaction_date, dateFormat)} ·{" "}
                            {tx.category || "Umum"} ·{" "}
                            {tx.status === "posted"
                              ? "Terposting"
                              : tx.status === "cancelled"
                                ? "Dibatalkan"
                                : "Menunggu"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${amtColor}`}
                        >
                          {sign}
                          {formatIDR(tx.amount)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Row 4: Unified Planning Strip (Recurring Bills + Savings Goals) */}
          <section
            aria-label="Rencana Tagihan dan Target Tabungan"
            className="grid divide-y divide-stone-200/80 rounded-2xl border border-stone-200/90 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-12 lg:divide-x lg:divide-y-0"
          >
            {/* Left: Due Recurring Bills */}
            <div className="p-5 lg:col-span-5">
              <div className="mb-3.5 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                  Tagihan Rutin Terdekat
                </h2>
                <Link
                  to="/rencana"
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  <span>Kelola</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>

              {dueBills.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs text-stone-600 dark:text-zinc-400">
                  <span>
                    {recurringBills.length === 0
                      ? "Belum ada jadwal tagihan rutin."
                      : "Tidak ada tagihan jatuh tempo dalam 7 hari."}
                  </span>
                  <Link
                    to="/rencana"
                    className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Atur Jadwal
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-stone-200/70 dark:divide-zinc-800">
                  {dueBills.slice(0, 4).map((bill) => {
                    const delta = daysUntilDue(bill.next_due_date);
                    return (
                      <li
                        key={bill.id}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-stone-900 dark:text-zinc-100">
                            {bill.title}
                          </p>
                          <p
                            className={`mt-0.5 text-xs ${
                              delta !== null && delta < 0
                                ? "font-medium text-rose-600 dark:text-rose-400"
                                : "text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            {formatDateID(bill.next_due_date, dateFormat)}
                            {delta !== null
                              ? delta < 0
                                ? ` · Terlambat ${Math.abs(delta)} hari`
                                : delta === 0
                                  ? " · Hari ini"
                                  : ` · ${delta} hari lagi`
                              : ""}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                            bill.transaction_type === "income"
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {bill.transaction_type === "income" ? "+" : "-"}
                          {formatIDR(bill.amount)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Right: Savings Goals & Emergency Fund */}
            <div className="p-5 lg:col-span-7">
              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                  Target Tabungan &amp; Dana Darurat
                </h2>
                <div className="flex items-center gap-3">
                  {emergencyMonths !== null ? (
                    <span className="font-mono text-xs text-stone-500 tabular-nums dark:text-zinc-400">
                      Dana Darurat: {emergencyMonths} bln
                    </span>
                  ) : null}
                  <Link
                    to="/rencana"
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap dark:text-emerald-400 dark:hover:text-emerald-300"
                  >
                    <span>Kelola</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {activeGoals.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs text-stone-600 dark:text-zinc-400">
                  <span>Belum ada target tabungan atau dana darurat aktif.</span>
                  <Link
                    to="/rencana"
                    className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Buat Target Baru
                  </Link>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {activeGoals.map((goal) => {
                    const linkedAcc = goal.linked_account_id
                      ? accountMap.get(goal.linked_account_id)
                      : undefined;
                    const prog = computeGoalProgress(goal, linkedAcc);
                    return (
                      <div key={goal.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-stone-900 dark:text-zinc-100">
                              {goal.title}
                            </p>
                            <p className="text-xs text-stone-500 dark:text-zinc-400">
                              {goal.goal_type === "emergency_fund"
                                ? "Dana Darurat"
                                : "Target Tabungan"}
                              {linkedAcc ? ` · ${linkedAcc.account_name}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right font-mono tabular-nums">
                            <p className="text-xs font-semibold text-stone-900 dark:text-zinc-100">
                              {formatIDR(prog.savedAmount)} /{" "}
                              <span className="text-stone-500 dark:text-zinc-400">
                                {formatIDR(prog.targetAmount)}
                              </span>
                            </p>
                            <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                              {prog.percentage}%
                            </p>
                          </div>
                        </div>
                        <svg
                          viewBox="0 0 100 6"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                          className="h-1.5 w-full overflow-hidden rounded-full"
                        >
                          <rect
                            x={0}
                            y={0}
                            width={100}
                            height={6}
                            rx={3}
                            className="fill-stone-200 dark:fill-zinc-800"
                          />
                          {prog.percentage > 0 ? (
                            <rect
                              x={0}
                              y={0}
                              width={prog.percentage}
                              height={6}
                              rx={3}
                              className="fill-emerald-600 transition-all dark:fill-emerald-500"
                            />
                          ) : null}
                        </svg>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
```

---

## 50. `src/routes/_authenticated/transaksi.tsx` (663 lines)

```tsx
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Download, Loader2, Plus, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { ApprovalCheck } from "../../components/ego/approval-check";
import { CategoryBreakdown } from "../../components/ego/category-breakdown";
import { MoneyInput } from "../../components/ego/money-input";
import { transactionsToCsv, triggerBrowserDownload } from "../../lib/export";
import { formatDateID, formatIDR, todayISO } from "../../lib/finance";
import {
  useCancelTransaction,
  useCreateTransaction,
  useVaultSnapshot,
} from "../../lib/queries";
import type { TransactionType } from "../../types/ego";

const CATEGORIES_BY_TYPE: Record<TransactionType, string[]> = {
  expense: [
    "Makanan & Minuman",
    "Transportasi",
    "Utilitas & Tagihan",
    "Belanja",
    "Investasi & Aset",
    "Utang & Cicilan",
    "Pengeluaran Lainnya",
  ],
  income: [
    "Gaji & Pendapatan",
    "Bonus & Investasi",
    "Penjualan & Refund",
    "Pemasukan Lainnya",
  ],
  transfer: ["Transfer Internal", "Tarik Tunai", "Top Up E-Wallet"],
};

export function TransaksiPage() {
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const createTx = useCreateTransaction();
  const cancelTx = useCancelTransaction();
  const navigate = useNavigate();
  const routeSearch = useSearch({ strict: false }) as {
    kategori?: string;
    jenis?: "all" | TransactionType;
  };

  const accounts = vault?.accounts ?? [];
  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.is_active),
    [accounts]
  );
  const transactions = vault?.transactions ?? [];
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";
  const expenseLimit = vault?.preferences.expense_alert_limit ?? 5_000_000;

  // Form state
  const [txType, setTxType] = useState<TransactionType>("expense");
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [amount, setAmount] = useState(0);
  const [txDate, setTxDate] = useState(todayISO());
  const [category, setCategory] = useState(CATEGORIES_BY_TYPE.expense[0]);
  const [description, setDescription] = useState("");
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);

  // Filter state
  const [filterType, setFilterType] = useState<"all" | TransactionType>(
    routeSearch.jenis ?? "all"
  );
  const [filterCategory, setFilterCategory] = useState(
    routeSearch.kategori ?? ""
  );
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [breakdownType, setBreakdownType] = useState<"income" | "expense">(
    routeSearch.jenis === "income" ? "income" : "expense"
  );

  useEffect(() => {
    if (routeSearch.jenis) {
      setFilterType(routeSearch.jenis);
      if (routeSearch.jenis === "income" || routeSearch.jenis === "expense") {
        setBreakdownType(routeSearch.jenis);
      }
    }
    if (routeSearch.kategori !== undefined) {
      setFilterCategory(routeSearch.kategori);
    }
  }, [routeSearch.jenis, routeSearch.kategori]);

  const hasActiveFilter =
    filterType !== "all" ||
    filterCategory.trim() !== "" ||
    filterFrom !== "" ||
    filterTo !== "";

  function handleResetFilters() {
    setFilterType("all");
    setFilterCategory("");
    setFilterFrom("");
    setFilterTo("");
    void navigate({ to: "/transaksi", search: {}, replace: true });
  }

  function handleTabChange(nextType: TransactionType) {
    setTxType(nextType);
    setCategory(CATEGORIES_BY_TYPE[nextType][0]);
    setOwnerConfirmed(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerConfirmed) return;

    if (amount <= 0) {
      toast.error("Nominal transaksi wajib lebih besar dari Rp 0.");
      return;
    }

    if (txType === "expense" && !sourceId) {
      toast.error("Pilih akun sumber dana terlebih dahulu.");
      return;
    }
    if (txType === "income" && !destId) {
      toast.error("Pilih akun tujuan pemasukan terlebih dahulu.");
      return;
    }
    if (txType === "transfer") {
      if (!sourceId || !destId) {
        toast.error("Pilih akun sumber dan akun tujuan transfer.");
        return;
      }
      if (sourceId === destId) {
        toast.error("Akun sumber dan tujuan transfer tidak boleh sama.");
        return;
      }
    }

    try {
      await createTx.mutateAsync({
        transaction_type: txType,
        source_account_id: txType === "income" ? null : sourceId,
        destination_account_id: txType === "expense" ? null : destId,
        amount,
        transaction_date: txDate,
        category,
        description: description.trim() || category,
        owner_confirmed: true,
      });

      if (txType === "expense" && expenseLimit > 0 && amount >= expenseLimit) {
        toast.warning(
          `Transaksi dicatat. Nominal melebihi batas pengingat (${formatIDR(
            expenseLimit
          )}).`
        );
      } else {
        toast.success("Transaksi berhasil dicatat dan saldo diperbarui.");
      }

      setAmount(0);
      setDescription("");
      setOwnerConfirmed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan transaksi."
      );
    }
  }

  async function handleCancelTransaction(id: string) {
    try {
      await cancelTx.mutateAsync(id);
      toast.success("Transaksi dibatalkan dan saldo akun telah dikembalikan.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal membatalkan transaksi."
      );
    }
  }

  const accountNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const acc of accounts) map.set(acc.id, acc.account_name);
    return map;
  }, [accounts]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== "all" && tx.transaction_type !== filterType)
        return false;
      if (
        filterCategory.trim() &&
        !(tx.category ?? "")
          .toLowerCase()
          .includes(filterCategory.trim().toLowerCase()) &&
        !(tx.description ?? "")
          .toLowerCase()
          .includes(filterCategory.trim().toLowerCase())
      ) {
        return false;
      }
      if (filterFrom && tx.transaction_date < filterFrom) return false;
      if (filterTo && tx.transaction_date > filterTo) return false;
      return true;
    });
  }, [transactions, filterType, filterCategory, filterFrom, filterTo]);

  return (
    <AppShell
      title="Catatan Transaksi"
      subtitle="Catat uang masuk, keluar, atau pindah saldo antar-dompet dengan persetujuan Anda."
    >
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Form Mutasi */}
        <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none lg:col-span-5">
          <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
            Catat Transaksi Baru
          </h2>

          {activeAccounts.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-stone-300/80 bg-stone-50/70 p-6 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="text-sm font-semibold text-stone-900 dark:text-zinc-200">
                Belum ada akun aktif
              </p>
              <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
                Tambahkan minimal satu rekening, e-wallet, atau dompet tunai sebelum mencatat transaksi.
              </p>
              <Link
                to="/akun"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tambah Akun</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* 3 Tabs */}
              <div
                role="tablist"
                aria-label="Jenis Mutasi"
                className="grid grid-cols-3 gap-1 rounded-xl border border-stone-200 bg-stone-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-950"
              >
                {(
                  [
                    { id: "expense", label: "Pengeluaran" },
                    { id: "income", label: "Pemasukan" },
                    { id: "transfer", label: "Transfer" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={txType === tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      txType === tab.id
                        ? "bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 dark:text-zinc-950"
                        : "text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {txType !== "income" ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="tx-source"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Akun Sumber{" "}
                    <span className="text-rose-600 dark:text-rose-400">*</span>
                  </label>
                  <select
                    id="tx-source"
                    required
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
                  >
                    <option value="">Pilih akun sumber...</option>
                    {activeAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} ({formatIDR(acc.current_balance)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {txType !== "expense" ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="tx-dest"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Akun Tujuan{" "}
                    <span className="text-rose-600 dark:text-rose-400">*</span>
                  </label>
                  <select
                    id="tx-dest"
                    required
                    value={destId}
                    onChange={(e) => setDestId(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
                  >
                    <option value="">Pilih akun tujuan...</option>
                    {activeAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} ({formatIDR(acc.current_balance)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <MoneyInput
                id="tx-amount"
                label="Nominal (IDR)"
                value={amount}
                onChange={setAmount}
                required
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="tx-date"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Tanggal
                  </label>
                  <input
                    id="tx-date"
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2.5 text-sm font-mono text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="tx-category"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Kategori
                  </label>
                  <select
                    id="tx-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
                  >
                    {CATEGORIES_BY_TYPE[txType].map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="tx-desc"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Keterangan
                </label>
                <input
                  id="tx-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Kopi pagi / Gaji bulanan"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
                />
              </div>

              <ApprovalCheck
                id="tx-owner-confirm"
                checked={ownerConfirmed}
                onChange={setOwnerConfirmed}
              />

              <button
                type="submit"
                disabled={!ownerConfirmed || createTx.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                {createTx.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                <span>Eksekusi &amp; Posting Transaksi</span>
              </button>
            </form>
          )}
        </section>

        {/* Riwayat Transaksi */}
        <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none lg:col-span-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
              Riwayat Transaksi
            </h2>
            <div className="flex flex-wrap items-center gap-2.5">
              {hasActiveFilter ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset Filter</span>
                </button>
              ) : null}
              <button
                type="button"
                disabled={filteredTransactions.length === 0}
                onClick={() => {
                  const csv = transactionsToCsv(filteredTransactions, accounts);
                  triggerBrowserDownload(
                    `ego-transaksi-${todayISO()}.csv`,
                    csv,
                    "text/csv;charset=utf-8;"
                  );
                  toast.success(
                    `${filteredTransactions.length} transaksi diekspor ke CSV.`
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ekspor CSV</span>
              </button>
              <span className="text-xs font-mono text-stone-500 tabular-nums dark:text-zinc-400">
                {filteredTransactions.length} entri
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mt-4 grid gap-2.5 sm:grid-cols-4">
            <select
              aria-label="Filter jenis transaksi"
              value={filterType}
              onChange={(e) => {
                const next = e.target.value as "all" | TransactionType;
                setFilterType(next);
                if (next === "income" || next === "expense") {
                  setBreakdownType(next);
                }
              }}
              className="rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2 text-xs text-stone-800 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
            >
              <option value="all">Semua Jenis</option>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
              <option value="transfer">Transfer</option>
            </select>

            <div className="relative">
              <Search
                className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-stone-400 dark:text-zinc-500"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label="Cari kategori atau keterangan"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                placeholder="Cari kategori/ket..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 py-2 pr-3 pl-8 text-xs text-stone-800 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
              />
            </div>

            <input
              type="date"
              aria-label="Tanggal mulai"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="rounded-xl border border-stone-200 bg-stone-50/70 px-2.5 py-2 text-xs font-mono text-stone-800 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
            />
            <input
              type="date"
              aria-label="Tanggal akhir"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="rounded-xl border border-stone-200 bg-stone-50/70 px-2.5 py-2 text-xs font-mono text-stone-800 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
            />
          </div>

          {/* Embedded Category Breakdown synced with active date filter */}
          {!isLoading ? (
            <div className="mt-5">
              <CategoryBreakdown
                embedded
                title="Rincian Kategori Periode Filter"
                subtitle={
                  filterFrom || filterTo
                    ? `Menampilkan mutasi terposting${
                        filterFrom
                          ? ` dari ${formatDateID(filterFrom, dateFormat)}`
                          : ""
                      }${
                        filterTo
                          ? ` hingga ${formatDateID(filterTo, dateFormat)}`
                          : ""
                      }`
                    : "Seluruh transaksi terposting sesuai jenis yang dipilih"
                }
                transactions={transactions}
                type={breakdownType}
                onTypeChange={(nextType) => {
                  setBreakdownType(nextType);
                  if (filterType === "income" || filterType === "expense") {
                    setFilterType(nextType);
                  }
                }}
                fromDate={filterFrom || undefined}
                toDate={filterTo || undefined}
                selectedCategory={filterCategory}
                showEmptyCta={false}
                maxItems={8}
                onSelectCategory={(cat, txType) => {
                  const isSame =
                    filterCategory.trim().toLowerCase() === cat.toLowerCase() &&
                    filterType === txType;
                  if (isSame) {
                    setFilterCategory("");
                    setFilterType("all");
                  } else {
                    setFilterCategory(cat);
                    setFilterType(txType);
                  }
                }}
              />
            </div>
          ) : null}

          {isLoading ? (
            <div className="mt-4 space-y-2">
              {[1, 2, 3].map((k) => (
                <div
                  key={k}
                  className="h-14 animate-pulse rounded-xl bg-stone-100 dark:bg-zinc-950"
                />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-stone-300/80 bg-stone-50/70 p-8 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="text-sm font-semibold text-stone-900 dark:text-zinc-200">
                Belum ada transaksi yang sesuai
              </p>
              <p className="mt-1 text-xs text-stone-600 dark:text-zinc-400">
                Catat transaksi baru melalui formulir di samping atau ubah kata kunci pencarian.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs font-medium text-stone-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="py-2.5 pr-3">Tanggal &amp; Detail</th>
                    <th className="px-3 py-2.5">Akun</th>
                    <th className="px-3 py-2.5 text-right">Nominal</th>
                    <th className="py-2.5 pl-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/70 dark:divide-zinc-800/80">
                  {filteredTransactions.map((tx) => {
                    const srcName = tx.source_account_id
                      ? accountNameMap.get(tx.source_account_id) ?? "Akun"
                      : null;
                    const dstName = tx.destination_account_id
                      ? accountNameMap.get(tx.destination_account_id) ?? "Akun"
                      : null;
                    const accountFlow =
                      tx.transaction_type === "transfer"
                        ? `${srcName ?? "?"} → ${dstName ?? "?"}`
                        : tx.transaction_type === "income"
                          ? dstName ?? "—"
                          : srcName ?? "—";
                    const isCancelled = tx.status === "cancelled";

                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-stone-50/80 dark:hover:bg-zinc-950/50"
                      >
                        <td className="py-3.5 pr-3 align-top">
                          <p
                            className={`font-medium ${
                              isCancelled
                                ? "text-stone-400 line-through dark:text-zinc-500"
                                : "text-stone-900 dark:text-zinc-100"
                            }`}
                          >
                            {tx.description || tx.category || "Mutasi"}
                          </p>
                          <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                            {formatDateID(tx.transaction_date, dateFormat)} ·{" "}
                            {tx.category || "Umum"} ·{" "}
                            {isCancelled ? "Dibatalkan" : "Terposting"}
                          </p>
                        </td>
                        <td className="px-3 py-3.5 align-top text-xs text-stone-600 dark:text-zinc-300">
                          {accountFlow}
                        </td>
                        <td
                          className={`px-3 py-3.5 text-right align-top font-mono font-semibold tabular-nums whitespace-nowrap ${
                            isCancelled
                              ? "text-stone-400 line-through dark:text-zinc-500"
                              : tx.transaction_type === "income"
                                ? "text-emerald-700 dark:text-emerald-400"
                                : tx.transaction_type === "expense"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-stone-800 dark:text-zinc-200"
                          }`}
                        >
                          {tx.transaction_type === "income"
                            ? "+"
                            : tx.transaction_type === "expense"
                              ? "-"
                              : ""}
                          {formatIDR(tx.amount)}
                        </td>
                        <td className="py-3.5 pl-3 text-right align-top">
                          {!isCancelled ? (
                            <button
                              type="button"
                              onClick={() => handleCancelTransaction(tx.id)}
                              disabled={cancelTx.isPending}
                              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:border-rose-300 hover:text-rose-700 whitespace-nowrap dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-rose-500/40 dark:hover:text-rose-300"
                            >
                              <RotateCcw className="h-3 w-3" aria-hidden="true" />
                              <span>Batalkan Transaksi</span>
                            </button>
                          ) : (
                            <span className="text-xs text-stone-400 dark:text-zinc-600">
                              Saldo Dikembalikan
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
```

---

## 51. `src/routes/_authenticated/akun.tsx` (260 lines)

```tsx
import { Archive, ArchiveRestore, Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { ApprovalCheck } from "../../components/ego/approval-check";
import { MoneyInput } from "../../components/ego/money-input";
import {
  accountTypeLabel,
  formatIDR,
  groupAccountsByType,
} from "../../lib/finance";
import {
  useCreateAccount,
  useToggleAccountActive,
  useVaultSnapshot,
} from "../../lib/queries";
import type { AccountType } from "../../types/ego";

export function AkunPage() {
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const createAccount = useCreateAccount();
  const toggleActive = useToggleAccountActive();

  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("bank");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);

  const accounts = vault?.accounts ?? [];
  const grouped = groupAccountsByType(accounts);
  const totalLiquidity = accounts
    .filter((a) => a.is_active)
    .reduce((sum, a) => sum + a.current_balance, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerConfirmed) return;
    if (!accountName.trim()) {
      toast.error("Nama akun wajib diisi.");
      return;
    }

    try {
      await createAccount.mutateAsync({
        account_name: accountName.trim(),
        account_type: accountType,
        opening_balance: openingBalance,
        owner_confirmed: true,
      });
      toast.success(`Akun "${accountName.trim()}" berhasil ditambahkan.`);
      setAccountName("");
      setOpeningBalance(0);
      setOwnerConfirmed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menambahkan akun."
      );
    }
  }

  async function handleToggleArchive(id: string, nextActive: boolean) {
    try {
      await toggleActive.mutateAsync({ id, is_active: nextActive });
      toast.success(
        nextActive ? "Akun diaktifkan kembali." : "Akun berhasil diarsipkan."
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memperbarui status akun."
      );
    }
  }

  return (
    <AppShell
      title="Akun Keuangan"
      subtitle="Kelola dompet tunai, rekening bank, dan e-wallet Anda dengan pantauan saldo real-time."
      action={
        <div className="text-right">
          <p className="text-[11px] text-stone-500 dark:text-zinc-400">
            Total Likuiditas Aktif
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-base">
            {formatIDR(totalLiquidity)}
          </p>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Form Akun Baru */}
        <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none lg:col-span-4">
          <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
            Tambah Akun Baru
          </h2>
          <p className="mt-1 text-xs text-stone-600 dark:text-zinc-400">
            Daftarkan rekening atau dompet agar pencatatan mutasi tetap rapi.
          </p>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="acc-name"
                className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
              >
                Nama Akun <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <input
                id="acc-name"
                type="text"
                required
                maxLength={80}
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Contoh: BCA Utama / GoPay / Dompet"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="acc-type"
                className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
              >
                Jenis Akun
              </label>
              <select
                id="acc-type"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
              >
                <option value="bank">Bank</option>
                <option value="ewallet">E-Wallet</option>
                <option value="cash">Tunai</option>
              </select>
            </div>

            <MoneyInput
              id="acc-opening"
              label="Saldo Awal (IDR)"
              value={openingBalance}
              onChange={setOpeningBalance}
            />

            <ApprovalCheck
              id="acc-owner-confirm"
              checked={ownerConfirmed}
              onChange={setOwnerConfirmed}
            />

            <button
              type="submit"
              disabled={!ownerConfirmed || createAccount.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {createAccount.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              <span>Simpan Akun</span>
            </button>
          </form>
        </section>

        {/* Grid Akun berdasarkan Jenis */}
        <section className="space-y-6 lg:col-span-8">
          {isLoading ? (
            <div className="h-48 animate-pulse rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
          ) : accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300/80 bg-white p-10 text-center shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-500 dark:bg-zinc-950 dark:text-zinc-600">
                <Wallet className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-3.5 text-base font-semibold text-stone-900 dark:text-zinc-100">
                Belum Ada Akun Keuangan
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
                Yuk gunakan formulir di sebelah kiri untuk mendaftarkan rekening bank, e-wallet, atau kas tunai pertama Anda.
              </p>
            </div>
          ) : (
            (["bank", "ewallet", "cash"] as const).map((groupType) => {
              const items = grouped[groupType];
              if (items.length === 0) return null;
              return (
                <div key={groupType} className="space-y-3">
                  <h2 className="text-sm font-semibold text-stone-700 dark:text-zinc-300">
                    {accountTypeLabel(groupType)} ({items.length})
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {items.map((acc) => (
                      <div
                        key={acc.id}
                        className={`rounded-2xl border p-5 transition-colors ${
                          acc.is_active
                            ? "border-stone-200/90 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none"
                            : "border-stone-200/60 bg-stone-100/70 opacity-75 dark:border-zinc-800/60 dark:bg-zinc-950"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-stone-900 dark:text-zinc-100">
                              {acc.account_name}
                            </h3>
                            <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                              {accountTypeLabel(acc.account_type)} ·{" "}
                              {acc.is_active ? "Aktif" : "Diarsipkan"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleArchive(acc.id, !acc.is_active)
                            }
                            aria-label={
                              acc.is_active
                                ? `Arsipkan ${acc.account_name}`
                                : `Aktifkan ${acc.account_name}`
                            }
                            className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900 whitespace-nowrap dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
                          >
                            {acc.is_active ? (
                              <>
                                <Archive className="h-3 w-3" aria-hidden="true" />
                                <span>Arsipkan</span>
                              </>
                            ) : (
                              <>
                                <ArchiveRestore
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                                <span>Aktifkan</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="mt-4 border-t border-stone-200/70 pt-3.5 dark:border-zinc-800">
                          <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                            Saldo Real-Time
                          </p>
                          <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-stone-900 dark:text-zinc-100">
                            {formatIDR(acc.current_balance)}
                          </p>
                          <p className="mt-1 font-mono text-[11px] tabular-nums text-stone-500 dark:text-zinc-500">
                            Saldo awal: {formatIDR(acc.opening_balance)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </AppShell>
  );
}
```

---

## 52. `src/routes/_authenticated/aset.tsx` (457 lines)

```tsx
import { Briefcase, ExternalLink, Loader2, Pencil, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { ApprovalCheck } from "../../components/ego/approval-check";
import { MoneyInput } from "../../components/ego/money-input";
import { assetTypeLabel, formatIDR } from "../../lib/finance";
import {
  useCreateAsset,
  useFinancialSearch,
  useUpdateAssetValue,
  useVaultSnapshot,
} from "../../lib/queries";
import type { Asset, AssetType } from "../../types/ego";

export function AsetPage() {
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAssetValue();
  const searchMutation = useFinancialSearch();

  // New Asset Form
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("emas");
  const [currentValue, setCurrentValue] = useState(0);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);

  // Edit Value State
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editValue, setEditValue] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [editConfirmed, setEditConfirmed] = useState(false);

  // Market Search Query
  const [marketQuery, setMarketQuery] = useState(
    "Harga emas Antam 1 gram hari ini dalam IDR"
  );

  const assets = vault?.assets ?? [];
  const totalAssetValue = assets.reduce((sum, a) => sum + a.current_value, 0);

  async function handleCreateAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerConfirmed) return;
    if (!assetName.trim()) {
      toast.error("Nama aset wajib diisi.");
      return;
    }

    try {
      await createAsset.mutateAsync({
        asset_name: assetName.trim(),
        asset_type: assetType,
        current_value: currentValue,
        quantity: quantity ? Number(quantity) : null,
        unit: unit.trim() || null,
        notes: notes.trim() || null,
        owner_confirmed: true,
      });
      toast.success(`Aset "${assetName.trim()}" berhasil dicatat.`);
      setAssetName("");
      setCurrentValue(0);
      setQuantity("");
      setUnit("");
      setNotes("");
      setOwnerConfirmed(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mencatat aset.");
    }
  }

  function startEdit(asset: Asset) {
    setEditingAsset(asset);
    setEditValue(asset.current_value);
    setEditNotes(asset.notes ?? "");
    setEditConfirmed(false);
  }

  async function handleUpdateAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAsset || !editConfirmed) return;
    try {
      await updateAsset.mutateAsync({
        id: editingAsset.id,
        current_value: editValue,
        notes: editNotes.trim() || null,
        owner_confirmed: true,
      });
      toast.success(`Nilai "${editingAsset.asset_name}" diperbarui.`);
      setEditingAsset(null);
      setEditConfirmed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memperbarui nilai aset."
      );
    }
  }

  async function handleMarketLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!marketQuery.trim()) return;
    try {
      await searchMutation.mutateAsync(marketQuery.trim());
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal mencari referensi harga pasar."
      );
    }
  }

  return (
    <AppShell
      title="Portofolio Aset"
      subtitle="Catat aset fisik maupun investasi Anda dan perbarui taksiran nilai pasar kapan saja."
      action={
        <div className="text-right">
          <p className="text-[11px] text-stone-500 dark:text-zinc-400">
            Total Nilai Portofolio
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-base">
            {formatIDR(totalAssetValue)}
          </p>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Form Tambah Aset */}
        <section className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
              Tambah Aset Baru
            </h2>
            <form onSubmit={handleCreateAsset} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="asset-name"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Nama Aset <span className="text-rose-600 dark:text-rose-400">*</span>
                </label>
                <input
                  id="asset-name"
                  type="text"
                  required
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="Contoh: Emas Antam / Reksadana"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="asset-type"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Kategori Aset
                </label>
                <select
                  id="asset-type"
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value as AssetType)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                >
                  <option value="emas">Emas</option>
                  <option value="investasi">Investasi</option>
                  <option value="properti">Properti</option>
                  <option value="kendaraan">Kendaraan</option>
                  <option value="elektronik">Elektronik</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="asset-qty"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Kuantitas
                  </label>
                  <input
                    id="asset-qty"
                    type="number"
                    step="any"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="1"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 font-mono text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="asset-unit"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Satuan
                  </label>
                  <input
                    id="asset-unit"
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="gram / unit"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
                  />
                </div>
              </div>

              <MoneyInput
                id="asset-value"
                label="Nilai Pasar Taksiran (IDR)"
                value={currentValue}
                onChange={setCurrentValue}
                required
              />

              <div className="space-y-1.5">
                <label
                  htmlFor="asset-notes"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Catatan
                </label>
                <input
                  id="asset-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Lokasi simpan / nomor seri"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
                />
              </div>

              <ApprovalCheck
                id="asset-owner-confirm"
                checked={ownerConfirmed}
                onChange={setOwnerConfirmed}
              />

              <button
                type="submit"
                disabled={!ownerConfirmed || createAsset.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                {createAsset.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                <span>Simpan Aset</span>
              </button>
            </form>
          </div>

          {/* Referensi Harga Pasar (Google Search Grounding) */}
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
              Referensi Nilai Pasar (Google Search)
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
              Cek harga emas, kurs, atau nilai pasar terkini sebelum memperbarui taksiran aset Anda.
            </p>
            <form onSubmit={handleMarketLookup} className="mt-3 flex gap-2">
              <input
                type="text"
                aria-label="Kueri harga pasar"
                value={marketQuery}
                onChange={(e) => setMarketQuery(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2 text-xs text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={searchMutation.isPending}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-100 px-3.5 py-2 text-xs font-medium text-stone-800 transition-colors hover:bg-stone-200 disabled:opacity-50 whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                {searchMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Cek</span>
              </button>
            </form>
            {searchMutation.isError ? (
              <div className="mt-3 space-y-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <p className="leading-relaxed">
                  {searchMutation.error instanceof Error
                    ? searchMutation.error.message
                    : "Gagal mencari referensi harga pasar."}
                </p>
                {marketQuery.trim() ? (
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(marketQuery.trim())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    <span>Cari Langsung di Google</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            ) : searchMutation.data ? (
              <div className="mt-3 space-y-2 rounded-xl border border-stone-200 bg-stone-50/80 p-3.5 text-xs leading-relaxed text-stone-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                <p className="whitespace-pre-line">
                  {searchMutation.data.answer}
                </p>
                {searchMutation.data.sources.length > 0 ? (
                  <div className="border-t border-stone-200 pt-2 dark:border-zinc-800">
                    <p className="mb-1 text-[11px] font-medium text-stone-500 dark:text-zinc-400">
                      Sumber:
                    </p>
                    <ul className="space-y-1">
                      {searchMutation.data.sources.slice(0, 3).map((src) => (
                        <li key={src.uri}>
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            <span className="max-w-56 truncate">{src.title}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {/* Daftar Aset */}
        <section className="space-y-4 lg:col-span-8">
          {editingAsset ? (
            <form
              onSubmit={handleUpdateAsset}
              className="space-y-4 rounded-2xl border border-emerald-300 bg-white p-6 shadow-xs dark:border-emerald-500/40 dark:bg-zinc-900 dark:shadow-none"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                  Perbarui Nilai: {editingAsset.asset_name}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="text-xs font-medium text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Batal
                </button>
              </div>
              <MoneyInput
                id="edit-asset-val"
                label="Nilai Taksiran Terkini (IDR)"
                value={editValue}
                onChange={setEditValue}
                required
              />
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-asset-notes"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Catatan Pembaruan
                </label>
                <input
                  id="edit-asset-notes"
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                />
              </div>
              <ApprovalCheck
                id="edit-asset-confirm"
                checked={editConfirmed}
                onChange={setEditConfirmed}
              />
              <button
                type="submit"
                disabled={!editConfirmed || updateAsset.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                <span>Simpan Nilai Baru</span>
              </button>
            </form>
          ) : null}

          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
              Daftar Aset Terdaftar
            </h2>

            {isLoading ? (
              <div className="mt-4 h-40 animate-pulse rounded-xl bg-stone-100 dark:bg-zinc-950" />
            ) : assets.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-stone-300/80 bg-stone-50/70 p-8 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-500 dark:bg-zinc-900 dark:text-zinc-600">
                  <Briefcase className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-zinc-200">
                  Portofolio aset masih kosong
                </p>
                <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
                  Catat kepemilikan emas, properti, kendaraan, atau instrumen investasi Anda agar kekayaan bersih terhitung utuh.
                </p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-stone-200/70 dark:divide-zinc-800">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                        {asset.asset_name}
                      </h3>
                      <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                        {assetTypeLabel(asset.asset_type)}
                        {asset.quantity !== null
                          ? ` · ${asset.quantity} ${asset.unit ?? "unit"}`
                          : ""}
                        {asset.notes ? ` · ${asset.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className="font-mono text-sm font-semibold tabular-nums text-stone-900 dark:text-zinc-100">
                        {formatIDR(asset.current_value)}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(asset)}
                        className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900 whitespace-nowrap dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                        <span>Perbarui Nilai</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
```

---

## 53. `src/routes/_authenticated/utang.tsx` (671 lines)

```tsx
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { ApprovalCheck } from "../../components/ego/approval-check";
import { MoneyInput } from "../../components/ego/money-input";
import { daysUntilDue, formatDateID, formatIDR } from "../../lib/finance";
import {
  useCreateDebt,
  usePayDebt,
  useVaultSnapshot,
} from "../../lib/queries";
import type { Debt } from "../../types/ego";

export function UtangPage() {
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const createDebt = useCreateDebt();
  const payDebt = usePayDebt();

  const debts = vault?.debts ?? [];
  const transactions = vault?.transactions ?? [];
  const activeAccounts = (vault?.accounts ?? []).filter((a) => a.is_active);
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";

  // Form Utang Baru
  const [creditor, setCreditor] = useState("");
  const [originalAmount, setOriginalAmount] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);

  // Payment Form
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [paySourceAccountId, setPaySourceAccountId] = useState("");
  const [payConfirmed, setPayConfirmed] = useState(false);

  // Filter status
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paid">(
    "all"
  );

  const activeDebts = debts.filter((d) => d.status === "active");
  const totalDebt = activeDebts.reduce(
    (sum, d) => sum + d.outstanding_balance,
    0
  );

  const filteredDebts = useMemo(() => {
    if (statusFilter === "all") return debts;
    return debts.filter((d) => d.status === statusFilter);
  }, [debts, statusFilter]);

  const debtPaymentExpenses = useMemo(() => {
    return transactions
      .filter(
        (tx) =>
          tx.transaction_type === "expense" &&
          tx.category === "Utang & Cicilan" &&
          tx.status === "posted"
      )
      .slice(0, 6);
  }, [transactions]);

  const nearestDue = useMemo(() => {
    const withDates = activeDebts
      .filter((d) => Boolean(d.due_date))
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    return withDates[0] ?? null;
  }, [activeDebts]);

  const nearestDays = nearestDue ? daysUntilDue(nearestDue.due_date) : null;

  const accountNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const acc of vault?.accounts ?? []) map.set(acc.id, acc.account_name);
    return map;
  }, [vault?.accounts]);

  async function handleCreateDebt(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerConfirmed) return;
    if (!creditor.trim() || originalAmount <= 0) {
      toast.error("Kreditur dan nominal plafon awal wajib diisi.");
      return;
    }
    try {
      await createDebt.mutateAsync({
        creditor: creditor.trim(),
        original_amount: originalAmount,
        outstanding_balance: originalAmount,
        due_date: dueDate || null,
        description: description.trim() || null,
        owner_confirmed: true,
      });
      toast.success(`Kewajiban kepada "${creditor.trim()}" berhasil dicatat.`);
      setCreditor("");
      setOriginalAmount(0);
      setDueDate("");
      setDescription("");
      setOwnerConfirmed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mencatat data utang."
      );
    }
  }

  function startPayment(debt: Debt) {
    setPayingDebt(debt);
    setPayAmount(debt.outstanding_balance);
    setPaySourceAccountId(activeAccounts[0]?.id ?? "");
    setPayConfirmed(false);
  }

  async function handlePayDebt(e: React.FormEvent) {
    e.preventDefault();
    if (!payingDebt || !payConfirmed) return;
    if (!paySourceAccountId) {
      toast.error("Pilih akun sumber pembayaran.");
      return;
    }
    if (payAmount <= 0 || payAmount > payingDebt.outstanding_balance) {
      toast.error(
        "Nominal pembayaran harus lebih dari Rp 0 dan tidak melebihi sisa pokok."
      );
      return;
    }
    try {
      await payDebt.mutateAsync({
        debt_id: payingDebt.id,
        amount: payAmount,
        source_account_id: paySourceAccountId,
        owner_confirmed: true,
      });
      const isFull = payAmount >= payingDebt.outstanding_balance;
      toast.success(
        isFull
          ? `Utang kepada ${payingDebt.creditor} lunas dan tercatat di Pengeluaran.`
          : `Cicilan ${formatIDR(payAmount)} ke ${payingDebt.creditor} tercatat di Pengeluaran.`
      );
      setPayingDebt(null);
      setPayConfirmed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memproses pembayaran utang."
      );
    }
  }

  return (
    <AppShell
      title="Utang & Kewajiban"
      subtitle="Pantau daftar kreditur, sisa pokok, dan pembayaran cicilan yang terhubung otomatis ke buku pengeluaran."
    >
      {/* Metrics Summary */}
      <section className="mb-6 grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
          <p className="text-xs font-medium text-stone-600 dark:text-zinc-400">
            Total Utang Beredar
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {formatIDR(totalDebt)}
          </p>
          <p className="mt-2 text-xs text-stone-500 dark:text-zinc-400">
            {activeDebts.length} kewajiban aktif ·{" "}
            {debts.filter((d) => d.status === "paid").length} lunas
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
          <p className="text-xs font-medium text-stone-600 dark:text-zinc-400">
            Indikator Jatuh Tempo Terdekat
          </p>
          {nearestDue ? (
            <>
              <p className="mt-2 text-base font-semibold text-stone-900 dark:text-zinc-100">
                {nearestDue.creditor} ·{" "}
                <span className="font-mono tabular-nums">
                  {formatIDR(nearestDue.outstanding_balance)}
                </span>
              </p>
              <p
                className={`mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium ${
                  nearestDays !== null && nearestDays <= 7
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-stone-600 dark:text-zinc-400"
                }`}
              >
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Jatuh tempo {formatDateID(nearestDue.due_date, dateFormat)}
                  {nearestDays !== null
                    ? nearestDays < 0
                      ? ` (Terlambat ${Math.abs(nearestDays)} hari)`
                      : nearestDays === 0
                        ? " (Hari ini)"
                        : ` (${nearestDays} hari lagi)`
                    : ""}
                </span>
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
              Tidak ada jatuh tempo aktif yang terjadwal saat ini.
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Form Pencatatan Utang Baru */}
        <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none lg:col-span-4">
          <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
            Catat Utang Baru
          </h2>
          <form onSubmit={handleCreateDebt} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="debt-creditor"
                className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
              >
                Nama Kreditur <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <input
                id="debt-creditor"
                type="text"
                required
                value={creditor}
                onChange={(e) => setCreditor(e.target.value)}
                placeholder="Contoh: Bank BCA KPR / Rekan Bisnis"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
              />
            </div>

            <MoneyInput
              id="debt-original"
              label="Plafon / Pokok Awal (IDR)"
              value={originalAmount}
              onChange={setOriginalAmount}
              required
            />

            <div className="space-y-1.5">
              <label
                htmlFor="debt-due"
                className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
              >
                Tanggal Jatuh Tempo
              </label>
              <input
                id="debt-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 font-mono text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="debt-desc"
                className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
              >
                Keterangan
              </label>
              <input
                id="debt-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tenor / catatan cicilan"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
              />
            </div>

            <ApprovalCheck
              id="debt-owner-confirm"
              checked={ownerConfirmed}
              onChange={setOwnerConfirmed}
            />

            <button
              type="submit"
              disabled={!ownerConfirmed || createDebt.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {createDebt.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              <span>Simpan Kewajiban</span>
            </button>
          </form>
        </section>

        {/* Daftar Kreditur, Form Cicilan/Pelunasan, & Riwayat Pengeluaran Terintegrasi */}
        <section className="space-y-6 lg:col-span-8">
          {payingDebt ? (
            <form
              onSubmit={handlePayDebt}
              className="space-y-4 rounded-2xl border border-emerald-300 bg-white p-6 shadow-xs dark:border-emerald-500/40 dark:bg-zinc-900 dark:shadow-none"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                    Pembayaran Cicilan / Pelunasan: {payingDebt.creditor}
                  </h2>
                  <p className="mt-0.5 text-xs text-stone-600 dark:text-zinc-400">
                    Sisa pokok:{" "}
                    <span className="font-mono font-semibold tabular-nums text-stone-900 dark:text-zinc-200">
                      {formatIDR(payingDebt.outstanding_balance)}
                    </span>{" "}
                    · Terintegrasi otomatis sebagai transaksi Pengeluaran.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPayingDebt(null)}
                  className="text-xs font-medium text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Batal
                </button>
              </div>

              {activeAccounts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/70 p-4 text-xs text-stone-700 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300">
                  Belum ada akun aktif sebagai sumber dana.{" "}
                  <Link
                    to="/akun"
                    className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Tambah akun terlebih dahulu
                  </Link>
                  .
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPayAmount(
                          Math.max(
                            1,
                            Math.round(payingDebt.outstanding_balance * 0.25)
                          )
                        )
                      }
                      className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-300 hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
                    >
                      Cicilan 25%
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPayAmount(
                          Math.max(
                            1,
                            Math.round(payingDebt.outstanding_balance * 0.5)
                          )
                        )
                      }
                      className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-300 hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
                    >
                      Cicilan 50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayAmount(payingDebt.outstanding_balance)}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                    >
                      Lunasi Penuh ({formatIDR(payingDebt.outstanding_balance)})
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <MoneyInput
                      id="pay-debt-amount"
                      label="Nominal Pembayaran (IDR)"
                      value={payAmount}
                      onChange={setPayAmount}
                      hint={`Sisa setelah bayar: ${formatIDR(
                        Math.max(0, payingDebt.outstanding_balance - payAmount)
                      )}`}
                      required
                    />

                    <div className="space-y-1.5">
                      <label
                        htmlFor="pay-debt-acc"
                        className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                      >
                        Akun Sumber Dana{" "}
                        <span className="text-rose-600 dark:text-rose-400">*</span>
                      </label>
                      <select
                        id="pay-debt-acc"
                        required
                        value={paySourceAccountId}
                        onChange={(e) => setPaySourceAccountId(e.target.value)}
                        className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                      >
                        <option value="">Pilih akun...</option>
                        {activeAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.account_name} ({formatIDR(acc.current_balance)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <ApprovalCheck
                    id="pay-debt-confirm"
                    checked={payConfirmed}
                    onChange={setPayConfirmed}
                  />

                  <button
                    type="submit"
                    disabled={!payConfirmed || payDebt.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                  >
                    {payDebt.isPending ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span>
                      {payAmount >= payingDebt.outstanding_balance
                        ? "Eksekusi Pelunasan Penuh"
                        : "Eksekusi Pembayaran Cicilan"}
                    </span>
                  </button>
                </>
              )}
            </form>
          ) : null}

          {/* Daftar Kreditur */}
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                Daftar Kreditur &amp; Sisa Pokok
              </h2>
              <div
                role="tablist"
                aria-label="Filter status utang"
                className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-950"
              >
                {(
                  [
                    { id: "all", label: "Semua" },
                    { id: "active", label: "Aktif" },
                    { id: "paid", label: "Lunas" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      statusFilter === tab.id
                        ? "bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 dark:text-zinc-950"
                        : "text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="mt-4 h-40 animate-pulse rounded-xl bg-stone-100 dark:bg-zinc-950" />
            ) : filteredDebts.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-stone-300/80 bg-stone-50/70 p-8 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-500 dark:bg-zinc-900 dark:text-zinc-600">
                  <CreditCard className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-zinc-200">
                  {debts.length === 0
                    ? "Tidak ada catatan utang"
                    : "Tidak ada kewajiban pada filter ini"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
                  Jika Anda memiliki kewajiban cicilan atau pinjaman, catat di sini agar perhitungan kekayaan bersih selalu akurat.
                </p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-stone-200/70 dark:divide-zinc-800">
                {filteredDebts.map((debt) => {
                  const isPaid = debt.status === "paid";
                  const paidPortion = Math.max(
                    0,
                    debt.original_amount - debt.outstanding_balance
                  );
                  const progressPct =
                    debt.original_amount > 0
                      ? Math.min(
                          100,
                          Math.round((paidPortion / debt.original_amount) * 100)
                        )
                      : 0;

                  return (
                    <div
                      key={debt.id}
                      className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                            {debt.creditor}
                          </h3>
                          <span
                            className={`text-xs font-medium ${
                              isPaid
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            · {isPaid ? "Lunas" : "Aktif"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                          Plafon awal: {formatIDR(debt.original_amount)}
                          {debt.due_date
                            ? ` · Jatuh tempo: ${formatDateID(debt.due_date, dateFormat)}`
                            : ""}
                          {debt.description ? ` · ${debt.description}` : ""}
                        </p>
                        <div className="mt-2.5 flex items-center gap-2.5">
                          <svg
                            viewBox="0 0 100 6"
                            preserveAspectRatio="none"
                            aria-hidden="true"
                            className="h-1.5 w-32 overflow-hidden rounded-full"
                          >
                            <rect
                              x={0}
                              y={0}
                              width={100}
                              height={6}
                              rx={3}
                              className="fill-stone-200 dark:fill-zinc-800"
                            />
                            {progressPct > 0 ? (
                              <rect
                                x={0}
                                y={0}
                                width={progressPct}
                                height={6}
                                rx={3}
                                className="fill-emerald-600 transition-all dark:fill-emerald-500"
                              />
                            ) : null}
                          </svg>
                          <span className="font-mono text-[11px] tabular-nums text-stone-500 dark:text-zinc-400">
                            Terbayar {progressPct}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <div className="text-right">
                          <p className="text-[11px] text-stone-500 dark:text-zinc-500">
                            Sisa Pokok
                          </p>
                          <p
                            className={`font-mono text-sm font-semibold tabular-nums ${
                              isPaid
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {formatIDR(debt.outstanding_balance)}
                          </p>
                        </div>

                        {!isPaid ? (
                          <button
                            type="button"
                            onClick={() => startPayment(debt)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 whitespace-nowrap dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                          >
                            <span>Bayar / Lunasi</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            <span>Selesai</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Riwayat Pembayaran Utang Terintegrasi Pengeluaran */}
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                  Riwayat Pembayaran Terintegrasi Pengeluaran
                </h2>
                <p className="text-xs text-stone-600 dark:text-zinc-400">
                  Setiap cicilan atau pelunasan tercatat otomatis ke buku mutasi pengeluaran.
                </p>
              </div>
              <Link
                to="/transaksi"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                <span>Lihat Transaksi</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            {debtPaymentExpenses.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-zinc-500">
                Belum ada transaksi pembayaran cicilan atau pelunasan utang yang tercatat.
              </p>
            ) : (
              <ul className="divide-y divide-stone-200/70 dark:divide-zinc-800">
                {debtPaymentExpenses.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-stone-800 dark:text-zinc-200">
                        {tx.description || "Pembayaran Utang"}
                      </p>
                      <p className="text-stone-500 dark:text-zinc-400">
                        {formatDateID(tx.transaction_date, dateFormat)} ·{" "}
                        {tx.source_account_id
                          ? accountNameMap.get(tx.source_account_id) ?? "Akun"
                          : "Akun"}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      -{formatIDR(tx.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
```

---

## 54. `src/routes/_authenticated/owner.tsx` (596 lines)

```tsx
import {
  Bot,
  Check,
  ExternalLink,
  Globe,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { ApprovalCheck } from "../../components/ego/approval-check";
import { LiveVoicePanel } from "../../components/ego/live-voice-panel";
import { MoneyInput } from "../../components/ego/money-input";
import { ReceiptScanner } from "../../components/ego/receipt-scanner";
import { TtsButton } from "../../components/ego/tts-button";
import { parseNaturalCommand } from "../../lib/command-parser";
import { formatDateID, formatIDR } from "../../lib/finance";
import {
  useApproveCommand,
  useFinancialSearch,
  useQueueCommand,
  useRejectCommand,
  useVaultSnapshot,
} from "../../lib/queries";
import type {
  AccountBalance,
  OwnerCommand,
  ParsedCommandDraft,
  TransactionType,
} from "../../types/ego";

const SAMPLE_COMMANDS = [
  "tadi bayar kopi 25rb pakai gopay",
  "terima transfer gaji 15jt ke bca",
  "beli emas 1 gram 1.4jt dari tabungan mandiri",
];

function PendingDraftCard({
  cmd,
  accounts,
  dateFormat,
  onApprove,
  onReject,
  busy,
}: {
  cmd: OwnerCommand;
  accounts: AccountBalance[];
  dateFormat: "DD/MM/YYYY" | "YYYY-MM-DD" | "DD MMM YYYY";
  onApprove: (id: string, draft: ParsedCommandDraft) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  busy: boolean;
}) {
  const activeAccounts = accounts.filter((a) => a.is_active);
  const initialDraft: ParsedCommandDraft =
    cmd.parsed_draft ?? parseNaturalCommand(cmd.command_text, accounts);

  const [draft, setDraft] = useState<ParsedCommandDraft>(initialDraft);
  const [confirmed, setConfirmed] = useState(false);

  const typeLabel =
    draft.transaction_type === "income"
      ? "Pemasukan"
      : draft.transaction_type === "transfer"
        ? "Transfer"
        : "Pengeluaran";

  const speechPreview = `Usulan draf ${typeLabel} sebesar ${
    draft.amount ? formatIDR(draft.amount) : "nominal belum diisi"
  }, kategori ${draft.category}, keterangan ${draft.description}.`;

  return (
    <div className="space-y-4 py-5 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Usulan Draf · {formatDateID(cmd.created_at, dateFormat)} · Keyakinan{" "}
            {draft.confidence === "high"
              ? "Tinggi"
              : draft.confidence === "medium"
                ? "Sedang"
                : "Rendah"}
          </p>
          <p className="mt-1 text-sm font-medium text-stone-900 dark:text-zinc-100">
            "{cmd.command_text}"
          </p>
        </div>
        <TtsButton text={speechPreview} label="Bacakan Draf" compact />
      </div>

      {draft.warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {draft.warnings.join(" ")}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label
            htmlFor={`draft-type-${cmd.id}`}
            className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
          >
            Jenis Mutasi
          </label>
          <select
            id={`draft-type-${cmd.id}`}
            value={draft.transaction_type}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                transaction_type: e.target.value as TransactionType,
              }))
            }
            className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
          >
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>

        <MoneyInput
          id={`draft-amount-${cmd.id}`}
          label="Nominal (IDR)"
          value={draft.amount ?? 0}
          onChange={(val) =>
            setDraft((prev) => ({
              ...prev,
              amount: val > 0 ? val : null,
            }))
          }
          required
        />

        {draft.transaction_type !== "income" ? (
          <div className="space-y-1.5">
            <label
              htmlFor={`draft-src-${cmd.id}`}
              className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
            >
              Akun Sumber
            </label>
            <select
              id={`draft-src-${cmd.id}`}
              value={draft.source_account_id ?? ""}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  source_account_id: e.target.value || null,
                }))
              }
              className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
            >
              <option value="">Pilih sumber...</option>
              {activeAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name} ({formatIDR(acc.current_balance)})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {draft.transaction_type !== "expense" ? (
          <div className="space-y-1.5">
            <label
              htmlFor={`draft-dst-${cmd.id}`}
              className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
            >
              Akun Tujuan
            </label>
            <select
              id={`draft-dst-${cmd.id}`}
              value={draft.destination_account_id ?? ""}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  destination_account_id: e.target.value || null,
                }))
              }
              className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
            >
              <option value="">Pilih tujuan...</option>
              {activeAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name} ({formatIDR(acc.current_balance)})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label
            htmlFor={`draft-cat-${cmd.id}`}
            className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
          >
            Kategori
          </label>
          <input
            id={`draft-cat-${cmd.id}`}
            type="text"
            value={draft.category}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, category: e.target.value }))
            }
            className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
          />
        </div>
      </div>

      <ApprovalCheck
        id={`approve-check-${cmd.id}`}
        checked={confirmed}
        onChange={setConfirmed}
        disabled={busy}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onReject(cmd.id)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-700 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tolak</span>
        </button>

        <button
          type="button"
          onClick={() => onApprove(cmd.id, draft)}
          disabled={!confirmed || busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Setujui</span>
        </button>
      </div>
    </div>
  );
}

export function OwnerControlPage() {
  const { data: vault } = useVaultSnapshot(true);
  const queueCommand = useQueueCommand();
  const approveCommand = useApproveCommand();
  const rejectCommand = useRejectCommand();
  const searchMutation = useFinancialSearch();

  const [commandText, setCommandText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const accounts = vault?.accounts ?? [];
  const commands = vault?.owner_commands ?? [];
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";

  const liveDraftPreview = useMemo(() => {
    if (!commandText.trim()) return null;
    return parseNaturalCommand(commandText, accounts);
  }, [commandText, accounts]);

  const pendingCommands = commands.filter((c) => c.status === "pending");
  const historyCommands = commands.filter((c) => c.status !== "pending");

  async function handleQueueCommand(e: React.FormEvent) {
    e.preventDefault();
    const clean = commandText.trim();
    if (!clean) {
      toast.error("Masukkan perintah bahasa alami terlebih dahulu.");
      return;
    }

    try {
      const draft = parseNaturalCommand(clean, accounts);
      await queueCommand.mutateAsync({
        command_text: clean,
        parsed_draft: draft,
      });
      toast.success(
        "Draf masuk ke Antrean Persetujuan. Saldo belum berubah sebelum Anda menyetujui."
      );
      setCommandText("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memproses perintah."
      );
    }
  }

  async function handleApprove(id: string, draft: ParsedCommandDraft) {
    try {
      await approveCommand.mutateAsync({
        id,
        draft,
        owner_confirmed: true,
      });
      toast.success("Perintah disetujui dan transaksi resmi diposting.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyetujui draf."
      );
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectCommand.mutateAsync(id);
      toast.success("Draf perintah ditolak tanpa mengubah saldo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menolak draf.");
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const clean = searchQuery.trim();
    if (!clean) return;
    try {
      await searchMutation.mutateAsync(clean);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mencari informasi terkini."
      );
    }
  }

  return (
    <AppShell
      title="Pusat Kendali EGO AI"
      subtitle="Asisten penerjemah bahasa alami, suara langsung, dan riset pasar dengan kendali mutlak di tangan Anda."
    >
      <div className="space-y-6">
        {/* Top Row: Natural Command Parser + Live Voice */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Natural Language Input */}
          <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none lg:col-span-7">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                Input Perintah Bahasa Alami (Parser Lokal)
              </h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
              Ketik perintah keuangan dengan bahasa santai. EGO hanya menyiapkan usulan draf ke Antrean Persetujuan tanpa memotong saldo secara otomatis.
            </p>

            <form onSubmit={handleQueueCommand} className="mt-4 space-y-3">
              <label htmlFor="owner-cmd-input" className="sr-only">
                Perintah bahasa alami Owner
              </label>
              <textarea
                id="owner-cmd-input"
                rows={3}
                maxLength={500}
                value={commandText}
                onChange={(e) => setCommandText(e.target.value)}
                placeholder='Contoh: "tadi bayar kopi 25rb pakai gopay" atau "terima gaji 15jt ke bca"'
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/15 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
              />

              <div className="flex flex-wrap items-center gap-2">
                {SAMPLE_COMMANDS.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setCommandText(sample)}
                    className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-[11px] font-medium text-stone-600 transition-colors hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              {liveDraftPreview ? (
                <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3.5 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="mb-1.5 text-[11px] font-medium text-stone-500 dark:text-zinc-400">
                    Pratinjau Draf Terstruktur (JSON)
                  </p>
                  <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
                    {JSON.stringify(liveDraftPreview, null, 2)}
                  </pre>
                </div>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={queueCommand.isPending || !commandText.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                >
                  {queueCommand.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>Proses ke Antrean Persetujuan</span>
                </button>
              </div>
            </form>
          </section>

          {/* Right Column: Live Voice + Google Search Grounding */}
          <div className="space-y-6 lg:col-span-5">
            <LiveVoicePanel />

            <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <Globe className="h-4 w-4" aria-hidden="true" />
                </div>
                <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                  Riset Keuangan (Google Search)
                </h2>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
                Dapatkan data kurs, harga emas, suku bunga, atau informasi ekonomi terbaru langsung dari Google Search.
              </p>

              <form onSubmit={handleSearch} className="mt-3 flex gap-2">
                <input
                  type="text"
                  aria-label="Pertanyaan riset keuangan Google Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Contoh: Harga emas Antam 1 gram hari ini"
                  className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={searchMutation.isPending || !searchQuery.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50 whitespace-nowrap dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                >
                  {searchMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : null}
                  <span>Cari</span>
                </button>
              </form>

              {searchMutation.isError ? (
                <div className="mt-4 space-y-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <p className="leading-relaxed">
                    {searchMutation.error instanceof Error
                      ? searchMutation.error.message
                      : "Gagal mengambil ringkasan AI."}
                  </p>
                  {searchQuery.trim() ? (
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(searchQuery.trim())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      <span>Cari Langsung di Google</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              ) : searchMutation.data ? (
                <div className="mt-4 space-y-3 rounded-xl border border-stone-200 bg-stone-50/80 p-3.5 text-xs leading-relaxed text-stone-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      Ringkasan Terverifikasi Search
                    </span>
                    <TtsButton
                      text={searchMutation.data.answer}
                      label="Bacakan Jawaban"
                      compact
                    />
                  </div>
                  <p className="whitespace-pre-line text-stone-700 dark:text-zinc-300">
                    {searchMutation.data.answer}
                  </p>
                  {searchMutation.data.sources.length > 0 ? (
                    <div className="border-t border-stone-200 pt-2 dark:border-zinc-800">
                      <p className="mb-1 text-[11px] font-medium text-stone-500 dark:text-zinc-400">
                        Sumber Referensi:
                      </p>
                      <ul className="space-y-1">
                        {searchMutation.data.sources.map((src) => (
                          <li key={src.uri}>
                            <a
                              href={src.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
                            >
                              <span className="max-w-64 truncate">{src.title}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        </div>

        {/* Receipt / Nota Photo Scanner */}
        <ReceiptScanner accounts={accounts} />

        {/* Pending Approvals Queue */}
        <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                Antrean Persetujuan Owner ({pendingCommands.length})
              </h2>
              <p className="text-xs text-stone-600 dark:text-zinc-400">
                Setiap draf wajib Anda tinjau dan setujui secara eksplisit sebelum saldo akun berubah.
              </p>
            </div>
          </div>

          {pendingCommands.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300/80 bg-stone-50/70 p-8 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="text-sm font-semibold text-stone-900 dark:text-zinc-200">
                Antrean persetujuan bersih
              </p>
              <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
                Kirim perintah teks atau suara di atas kapan pun Anda ingin menyiapkan usulan transaksi baru.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-200/70 dark:divide-zinc-800">
              {pendingCommands.map((cmd) => (
                <PendingDraftCard
                  key={cmd.id}
                  cmd={cmd}
                  accounts={accounts}
                  dateFormat={dateFormat}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  busy={approveCommand.isPending || rejectCommand.isPending}
                />
              ))}
            </div>
          )}
        </section>

        {/* Historical Owner Commands Log */}
        <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
          <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
            Log Riwayat Perintah Owner
          </h2>
          {historyCommands.length === 0 ? (
            <p className="mt-3 text-xs text-stone-500 dark:text-zinc-500">
              Belum ada riwayat perintah yang disetujui atau ditolak.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-stone-200/70 dark:divide-zinc-800">
              {historyCommands.map((cmd) => (
                <li
                  key={cmd.id}
                  className="flex flex-col justify-between gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-800 dark:text-zinc-200">
                      "{cmd.command_text}"
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                      {formatDateID(cmd.created_at, dateFormat)} ·{" "}
                      {cmd.parsed_draft?.amount
                        ? formatIDR(cmd.parsed_draft.amount)
                        : "Tanpa nominal"}{" "}
                      · {cmd.parsed_draft?.category ?? "Umum"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold ${
                      cmd.status === "processed"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {cmd.status === "processed"
                      ? "Disetujui & Terposting"
                      : "Ditolak"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
```

---

## 55. `src/routes/_authenticated/rencana.tsx` (1114 lines)

```tsx
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Pause,
  PiggyBank,
  Play,
  Send,
  ShieldCheck,
  Target,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { ApprovalCheck } from "../../components/ego/approval-check";
import { MoneyInput } from "../../components/ego/money-input";
import {
  computeAverageMonthlyCashflow,
  computeEmergencyFundMonths,
  computeGoalProgress,
  computeNetWorth,
  daysUntilDue,
  estimateGoalCompletionMonths,
  formatDateID,
  formatIDR,
  getDueRecurringBills,
  recurringFrequencyLabel,
  todayISO,
} from "../../lib/finance";
import {
  useCreateRecurringBill,
  useCreateSavingsGoal,
  useDeleteRecurringBill,
  useDeleteSavingsGoal,
  useQueueRecurringBill,
  useToggleRecurringBill,
  useUpdateGoalProgress,
  useVaultSnapshot,
} from "../../lib/queries";
import type {
  GoalType,
  RecurringBill,
  RecurringFrequency,
  SavingsGoal,
} from "../../types/ego";

const RECURRING_EXPENSE_CATEGORIES = [
  "Utilitas & Tagihan",
  "Tempat Tinggal",
  "Langganan Digital",
  "Utang & Cicilan",
  "Transportasi",
  "Kesehatan",
  "Asuransi",
  "Pengeluaran Lainnya",
];

const RECURRING_INCOME_CATEGORIES = [
  "Gaji & Pendapatan",
  "Bonus & Investasi",
  "Usaha & Freelance",
  "Pemasukan Lainnya",
];

export function RencanaPage() {
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const createGoal = useCreateSavingsGoal();
  const updateGoal = useUpdateGoalProgress();
  const deleteGoal = useDeleteSavingsGoal();

  const createBill = useCreateRecurringBill();
  const toggleBill = useToggleRecurringBill();
  const queueBill = useQueueRecurringBill();
  const deleteBill = useDeleteRecurringBill();

  const accounts = vault?.accounts ?? [];
  const activeAccounts = accounts.filter((a) => a.is_active);
  const transactions = vault?.transactions ?? [];
  const assets = vault?.assets ?? [];
  const debts = vault?.debts ?? [];
  const goals = vault?.savings_goals ?? [];
  const bills = vault?.recurring_bills ?? [];
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";

  const netWorth = useMemo(
    () => computeNetWorth(accounts, assets, debts),
    [accounts, assets, debts]
  );
  const avgCashflow = useMemo(
    () => computeAverageMonthlyCashflow(transactions, 3),
    [transactions]
  );
  const emergencyMonths = useMemo(
    () =>
      computeEmergencyFundMonths(
        netWorth.totalAccountBalance,
        avgCashflow.avgExpense
      ),
    [netWorth.totalAccountBalance, avgCashflow.avgExpense]
  );
  const dueBills = useMemo(() => getDueRecurringBills(bills), [bills]);
  const dueTotal = useMemo(
    () => dueBills.reduce((s, b) => s + b.amount, 0),
    [dueBills]
  );

  const accountMap = useMemo(() => {
    const map = new Map<string, (typeof accounts)[number]>();
    for (const acc of accounts) map.set(acc.id, acc);
    return map;
  }, [accounts]);

  const [goalTitle, setGoalTitle] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("emergency_fund");
  const [goalTarget, setGoalTarget] = useState(0);
  const [goalTrackMode, setGoalTrackMode] = useState<"manual" | "account">(
    "manual"
  );
  const [goalLinkedAccountId, setGoalLinkedAccountId] = useState("");
  const [goalInitialAmount, setGoalInitialAmount] = useState(0);
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [goalNotes, setGoalNotes] = useState("");
  const [goalConfirmed, setGoalConfirmed] = useState(false);

  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [editGoalAmount, setEditGoalAmount] = useState(0);
  const [editGoalConfirmed, setEditGoalConfirmed] = useState(false);

  const [billTitle, setBillTitle] = useState("");
  const [billType, setBillType] = useState<"expense" | "income">("expense");
  const [billAmount, setBillAmount] = useState(0);
  const [billCategory, setBillCategory] = useState("Utilitas & Tagihan");
  const [billAccountId, setBillAccountId] = useState("");
  const [billFrequency, setBillFrequency] =
    useState<RecurringFrequency>("monthly");
  const [billDueDate, setBillDueDate] = useState(todayISO());
  const [billNotes, setBillNotes] = useState("");
  const [billConfirmed, setBillConfirmed] = useState(false);

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalConfirmed) return;
    if (!goalTitle.trim() || goalTarget <= 0) {
      toast.error("Nama target dan nominal sasaran wajib diisi.");
      return;
    }
    if (goalTrackMode === "account" && !goalLinkedAccountId) {
      toast.error("Pilih akun aktif yang ingin disinkronkan.");
      return;
    }

    try {
      await createGoal.mutateAsync({
        title: goalTitle.trim(),
        goal_type: goalType,
        target_amount: goalTarget,
        current_amount: goalTrackMode === "manual" ? goalInitialAmount : 0,
        linked_account_id:
          goalTrackMode === "account" ? goalLinkedAccountId : null,
        target_date: goalTargetDate || null,
        notes: goalNotes.trim() || null,
        owner_confirmed: true,
      });
      toast.success(`Target "${goalTitle.trim()}" berhasil disimpan.`);
      setGoalTitle("");
      setGoalTarget(0);
      setGoalInitialAmount(0);
      setGoalTargetDate("");
      setGoalNotes("");
      setGoalConfirmed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan target tabungan."
      );
    }
  }

  async function handleUpdateGoalAmount(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGoal || !editGoalConfirmed) return;
    try {
      await updateGoal.mutateAsync({
        id: editingGoal.id,
        current_amount: editGoalAmount,
        target_amount: editingGoal.target_amount,
        owner_confirmed: true,
      });
      toast.success(`Progres "${editingGoal.title}" diperbarui.`);
      setEditingGoal(null);
      setEditGoalConfirmed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memperbarui progres target."
      );
    }
  }

  async function handleToggleGoalStatus(goal: SavingsGoal) {
    const nextStatus = goal.status === "completed" ? "active" : "completed";
    try {
      await updateGoal.mutateAsync({ id: goal.id, status: nextStatus });
      toast.success(
        nextStatus === "completed"
          ? `Target "${goal.title}" ditandai tercapai.`
          : `Target "${goal.title}" diaktifkan kembali.`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengubah status target."
      );
    }
  }

  async function handleDeleteGoal(goal: SavingsGoal) {
    try {
      await deleteGoal.mutateAsync(goal.id);
      toast.success(`Target "${goal.title}" dihapus.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus target."
      );
    }
  }

  async function handleCreateBill(e: React.FormEvent) {
    e.preventDefault();
    if (!billConfirmed) return;
    if (!billTitle.trim() || billAmount <= 0 || !billDueDate) {
      toast.error("Nama jadwal, nominal, dan tanggal jatuh tempo wajib diisi.");
      return;
    }

    try {
      await createBill.mutateAsync({
        title: billTitle.trim(),
        transaction_type: billType,
        amount: billAmount,
        category: billCategory,
        account_id: billAccountId || null,
        frequency: billFrequency,
        next_due_date: billDueDate,
        notes: billNotes.trim() || null,
        owner_confirmed: true,
      });
      toast.success(`Jadwal rutin "${billTitle.trim()}" berhasil ditambahkan.`);
      setBillTitle("");
      setBillAmount(0);
      setBillNotes("");
      setBillConfirmed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan jadwal rutin."
      );
    }
  }

  async function handleQueueBill(bill: RecurringBill) {
    try {
      await queueBill.mutateAsync(bill);
      toast.success(
        `Draf "${bill.title}" masuk ke Antrean Persetujuan Owner. Saldo belum berubah sebelum Anda menyetujui.`
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal mengajukan tagihan rutin ke antrean."
      );
    }
  }

  async function handleToggleBill(bill: RecurringBill) {
    try {
      await toggleBill.mutateAsync({ id: bill.id, is_active: !bill.is_active });
      toast.success(
        bill.is_active
          ? `Jadwal "${bill.title}" dijeda sementara.`
          : `Jadwal "${bill.title}" diaktifkan kembali.`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengubah status jadwal."
      );
    }
  }

  async function handleDeleteBill(bill: RecurringBill) {
    try {
      await deleteBill.mutateAsync(bill.id);
      toast.success(`Jadwal "${bill.title}" dihapus.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus jadwal rutin."
      );
    }
  }

  const activeGoalsCount = goals.filter((g) => g.status === "active").length;
  const completedGoalsCount = goals.filter((g) => g.status === "completed").length;

  return (
    <AppShell
      title="Rencana & Tagihan"
      subtitle="Atur target dana darurat, sasaran tabungan, dan jadwal tagihan rutin dengan kendali persetujuan Owner."
      action={
        <Link
          to="/owner"
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 whitespace-nowrap dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
        >
          <span>Buka Antrean Persetujuan</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      }
    >
      <div className="space-y-8">
        <section className="grid gap-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-stone-600 dark:text-zinc-400">
                Ketahanan Dana Darurat
              </p>
              <ShieldCheck
                className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-stone-900 dark:text-zinc-100">
              {emergencyMonths !== null ? `${emergencyMonths} bulan` : "—"}
            </p>
            <p className="mt-1.5 text-xs text-stone-500 dark:text-zinc-400">
              Saldo likuid{" "}
              <span className="font-mono tabular-nums">
                {formatIDR(netWorth.totalAccountBalance, true)}
              </span>{" "}
              · Rata pengeluaran{" "}
              <span className="font-mono tabular-nums">
                {avgCashflow.avgExpense > 0
                  ? `${formatIDR(avgCashflow.avgExpense, true)}/bln`
                  : "belum tercatat"}
              </span>
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-stone-600 dark:text-zinc-400">
                Target Tabungan &amp; Dana Darurat
              </p>
              <Target
                className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-stone-900 dark:text-zinc-100">
              {activeGoalsCount} Aktif
            </p>
            <p className="mt-1.5 text-xs text-stone-500 dark:text-zinc-400">
              {completedGoalsCount} target selesai · Total {goals.length} rencana
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-stone-600 dark:text-zinc-400">
                Tagihan Jatuh Tempo (≤ 7 Hari)
              </p>
              <CalendarClock
                className="h-4 w-4 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
            </div>
            <p
              className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
                dueBills.length > 0
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {dueBills.length} Jadwal
            </p>
            <p className="mt-1.5 text-xs text-stone-500 dark:text-zinc-400">
              {dueBills.length > 0
                ? `Estimasi total ${formatIDR(dueTotal)}`
                : "Tidak ada tagihan mendesak dalam 7 hari ke depan"}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none lg:col-span-4">
            <div className="flex items-center gap-2">
              <PiggyBank
                className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                Buat Target Tabungan
              </h2>
            </div>

            <form onSubmit={handleCreateGoal} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="goal-title"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Nama Target{" "}
                  <span className="text-rose-600 dark:text-rose-400">*</span>
                </label>
                <input
                  id="goal-title"
                  type="text"
                  required
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="Contoh: Dana Darurat 6 Bulan"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="goal-type"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Jenis Sasaran
                </label>
                <select
                  id="goal-type"
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value as GoalType)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                >
                  <option value="emergency_fund">Dana Darurat</option>
                  <option value="savings_target">Target Tabungan</option>
                </select>
              </div>

              <MoneyInput
                id="goal-target-amount"
                label="Target Nominal (IDR)"
                value={goalTarget}
                onChange={setGoalTarget}
                required
              />

              <div className="space-y-1.5">
                <label
                  htmlFor="goal-track-mode"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Metode Pantau Dana
                </label>
                <select
                  id="goal-track-mode"
                  value={goalTrackMode}
                  onChange={(e) =>
                    setGoalTrackMode(e.target.value as "manual" | "account")
                  }
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                >
                  <option value="manual">Catat Progres Manual</option>
                  <option value="account">Sinkronkan Saldo Akun Aktif</option>
                </select>
              </div>

              {goalTrackMode === "account" ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="goal-linked-acc"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Akun Khusus Tabungan{" "}
                    <span className="text-rose-600 dark:text-rose-400">*</span>
                  </label>
                  <select
                    id="goal-linked-acc"
                    value={goalLinkedAccountId}
                    onChange={(e) => setGoalLinkedAccountId(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                  >
                    <option value="">Pilih akun aktif...</option>
                    {activeAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} ({formatIDR(acc.current_balance)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <MoneyInput
                  id="goal-initial-amount"
                  label="Dana Terkumpul Awal (IDR)"
                  value={goalInitialAmount}
                  onChange={setGoalInitialAmount}
                />
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="goal-target-date"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Target Tanggal (Opsional)
                </label>
                <input
                  id="goal-target-date"
                  type="date"
                  value={goalTargetDate}
                  onChange={(e) => setGoalTargetDate(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 font-mono text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="goal-notes"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Catatan (Opsional)
                </label>
                <input
                  id="goal-notes"
                  type="text"
                  value={goalNotes}
                  onChange={(e) => setGoalNotes(e.target.value)}
                  placeholder="Alokasi bulanan atau tujuan dana"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
                />
              </div>

              <ApprovalCheck
                id="goal-owner-confirm"
                checked={goalConfirmed}
                onChange={setGoalConfirmed}
              />

              <button
                type="submit"
                disabled={!goalConfirmed || createGoal.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                {createGoal.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                <span>Simpan Target Tabungan</span>
              </button>
            </form>
          </div>

          <div className="space-y-4 lg:col-span-8">
            {editingGoal ? (
              <form
                onSubmit={handleUpdateGoalAmount}
                className="space-y-4 rounded-2xl border border-emerald-300 bg-white p-6 shadow-xs dark:border-emerald-500/40 dark:bg-zinc-900 dark:shadow-none"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                      Perbarui Progres: {editingGoal.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-stone-600 dark:text-zinc-400">
                      Target sasaran:{" "}
                      <span className="font-mono font-semibold tabular-nums">
                        {formatIDR(editingGoal.target_amount)}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingGoal(null)}
                    className="text-xs font-medium text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    Batal
                  </button>
                </div>

                <MoneyInput
                  id="edit-goal-amount"
                  label="Total Dana Terkumpul Saat Ini (IDR)"
                  value={editGoalAmount}
                  onChange={setEditGoalAmount}
                  required
                />

                <ApprovalCheck
                  id="edit-goal-confirm"
                  checked={editGoalConfirmed}
                  onChange={setEditGoalConfirmed}
                />

                <button
                  type="submit"
                  disabled={!editGoalConfirmed || updateGoal.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                >
                  {updateGoal.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : null}
                  <span>Simpan Pembaruan Progres</span>
                </button>
              </form>
            ) : null}

            <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                    Daftar Target Tabungan &amp; Dana Darurat ({goals.length})
                  </h2>
                  <p className="text-xs text-stone-600 dark:text-zinc-400">
                    Pantau pencapaian target dana beserta estimasi durasi tercapai berdasarkan surplus kas bulanan.
                  </p>
                </div>
              </div>

              {isLoading ? (
                <div className="h-40 animate-pulse rounded-xl bg-stone-100 dark:bg-zinc-950" />
              ) : goals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300/80 bg-stone-50/70 p-8 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-500 dark:bg-zinc-900 dark:text-zinc-600">
                    <Target className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-zinc-200">
                    Belum ada target tabungan atau dana darurat
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
                    Tetapkan target dana darurat 3–6 bulan pengeluaran atau sasaran tabungan khusus di formulir sebelah kiri.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-200/70 dark:divide-zinc-800">
                  {goals.map((goal) => {
                    const linkedAcc = goal.linked_account_id
                      ? accountMap.get(goal.linked_account_id)
                      : undefined;
                    const progress = computeGoalProgress(goal, linkedAcc);
                    const estMonths = !progress.isCompleted
                      ? estimateGoalCompletionMonths(
                          progress.remainingAmount,
                          avgCashflow.avgNet
                        )
                      : 0;

                    return (
                      <div key={goal.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                                {goal.title}
                              </h3>
                              <span className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                                ·{" "}
                                {goal.goal_type === "emergency_fund"
                                  ? "Dana Darurat"
                                  : "Target Tabungan"}
                                {progress.isCompleted ? " · Tercapai" : ""}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                              {linkedAcc
                                ? `Tersinkron ke akun ${linkedAcc.account_name}`
                                : "Progres terpantau manual"}
                              {goal.target_date
                                ? ` · Target ${formatDateID(goal.target_date, dateFormat)}`
                                : ""}
                              {estMonths !== null && estMonths > 0
                                ? ` · Estimasi ±${estMonths} bulan lagi`
                                : ""}
                              {goal.notes ? ` · ${goal.notes}` : ""}
                            </p>
                          </div>

                          <div className="shrink-0 text-left sm:text-right">
                            <p className="font-mono text-sm font-semibold tabular-nums text-stone-900 dark:text-zinc-100">
                              {formatIDR(progress.savedAmount)}{" "}
                              <span className="text-xs font-normal text-stone-500 dark:text-zinc-400">
                                / {formatIDR(progress.targetAmount)}
                              </span>
                            </p>
                            <p className="font-mono text-xs tabular-nums text-emerald-700 dark:text-emerald-400">
                              {progress.percentage}% · Sisa{" "}
                              {formatIDR(progress.remainingAmount)}
                            </p>
                          </div>
                        </div>

                        <svg
                          viewBox="0 0 100 6"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                          className="h-1.5 w-full overflow-hidden rounded-full"
                        >
                          <rect
                            x={0}
                            y={0}
                            width={100}
                            height={6}
                            rx={3}
                            className="fill-stone-200 dark:fill-zinc-800"
                          />
                          {progress.percentage > 0 ? (
                            <rect
                              x={0}
                              y={0}
                              width={progress.percentage}
                              height={6}
                              rx={3}
                              className="fill-emerald-600 transition-all dark:fill-emerald-500"
                            />
                          ) : null}
                        </svg>

                        <div className="flex flex-wrap items-center gap-2">
                          {linkedAcc ? (
                            <Link
                              to="/transaksi"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                            >
                              <span>Catat Setoran ke {linkedAcc.account_name}</span>
                              <ArrowRight className="h-3 w-3" aria-hidden="true" />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingGoal(goal);
                                setEditGoalAmount(goal.current_amount);
                                setEditGoalConfirmed(false);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                            >
                              <span>Perbarui Progres</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleGoalStatus(goal)}
                            disabled={updateGoal.isPending}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {goal.status === "completed"
                                ? "Aktifkan Lagi"
                                : "Tandai Tercapai"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteGoal(goal)}
                            disabled={deleteGoal.isPending}
                            aria-label={`Hapus target ${goal.title}`}
                            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none lg:col-span-4">
            <div className="flex items-center gap-2">
              <CalendarClock
                className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                Tambah Jadwal Rutin
              </h2>
            </div>

            <form onSubmit={handleCreateBill} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="bill-title"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Nama Tagihan / Pemasukan{" "}
                  <span className="text-rose-600 dark:text-rose-400">*</span>
                </label>
                <input
                  id="bill-title"
                  type="text"
                  required
                  value={billTitle}
                  onChange={(e) => setBillTitle(e.target.value)}
                  placeholder="Contoh: Internet Biznet / Gaji Bulanan"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="bill-type"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Jenis
                  </label>
                  <select
                    id="bill-type"
                    value={billType}
                    onChange={(e) => {
                      const next = e.target.value as "income" | "expense";
                      setBillType(next);
                      setBillCategory(
                        next === "income"
                          ? RECURRING_INCOME_CATEGORIES[0]
                          : RECURRING_EXPENSE_CATEGORIES[0]
                      );
                    }}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                  >
                    <option value="expense">Pengeluaran</option>
                    <option value="income">Pemasukan</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="bill-frequency"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Frekuensi
                  </label>
                  <select
                    id="bill-frequency"
                    value={billFrequency}
                    onChange={(e) =>
                      setBillFrequency(e.target.value as RecurringFrequency)
                    }
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                  >
                    <option value="weekly">Mingguan</option>
                    <option value="monthly">Bulanan</option>
                    <option value="yearly">Tahunan</option>
                  </select>
                </div>
              </div>

              <MoneyInput
                id="bill-amount"
                label="Nominal Estimasi (IDR)"
                value={billAmount}
                onChange={setBillAmount}
                required
              />

              <div className="space-y-1.5">
                <label
                  htmlFor="bill-category"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Kategori
                </label>
                <select
                  id="bill-category"
                  value={billCategory}
                  onChange={(e) => setBillCategory(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                >
                  {(billType === "income"
                    ? RECURRING_INCOME_CATEGORIES
                    : RECURRING_EXPENSE_CATEGORIES
                  ).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="bill-account"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Akun Sumber / Tujuan
                </label>
                <select
                  id="bill-account"
                  value={billAccountId}
                  onChange={(e) => setBillAccountId(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                >
                  <option value="">Pilih nanti saat persetujuan</option>
                  {activeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name} ({formatIDR(acc.current_balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="bill-due-date"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Jatuh Tempo Berikutnya{" "}
                  <span className="text-rose-600 dark:text-rose-400">*</span>
                </label>
                <input
                  id="bill-due-date"
                  type="date"
                  required
                  value={billDueDate}
                  onChange={(e) => setBillDueDate(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 font-mono text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="bill-notes"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Catatan (Opsional)
                </label>
                <input
                  id="bill-notes"
                  type="text"
                  value={billNotes}
                  onChange={(e) => setBillNotes(e.target.value)}
                  placeholder="Nomor pelanggan atau keterangan singkat"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
                />
              </div>

              <ApprovalCheck
                id="bill-owner-confirm"
                checked={billConfirmed}
                onChange={setBillConfirmed}
              />

              <button
                type="submit"
                disabled={!billConfirmed || createBill.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                {createBill.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                <span>Simpan Jadwal Rutin</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                  Jadwal Tagihan &amp; Pemasukan Rutin ({bills.length})
                </h2>
                <p className="text-xs text-stone-600 dark:text-zinc-400">
                  Klik &ldquo;Ajukan ke Antrean Persetujuan&rdquo; saat tagihan siap dibayar. Saldo hanya berubah setelah Anda menyetujui draf di Owner Control.
                </p>
              </div>

              {isLoading ? (
                <div className="h-40 animate-pulse rounded-xl bg-stone-100 dark:bg-zinc-950" />
              ) : bills.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300/80 bg-stone-50/70 p-8 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-500 dark:bg-zinc-900 dark:text-zinc-600">
                    <CalendarClock className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-zinc-200">
                    Belum ada jadwal tagihan atau pemasukan rutin
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
                    Daftarkan listrik, internet, langganan, atau jadwal gaji agar EGO mengingatkan Anda sebelum jatuh tempo.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-200/70 dark:divide-zinc-800">
                  {bills.map((bill) => {
                    const delta = daysUntilDue(bill.next_due_date);
                    const acc = bill.account_id
                      ? accountMap.get(bill.account_id)
                      : undefined;
                    const dueLabel =
                      delta === null
                        ? ""
                        : delta < 0
                          ? `Terlambat ${Math.abs(delta)} hari`
                          : delta === 0
                            ? "Jatuh tempo hari ini"
                            : `${delta} hari lagi`;

                    const dueTone =
                      !bill.is_active
                        ? "text-stone-400 dark:text-zinc-500"
                        : delta !== null && delta < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : delta !== null && delta <= 7
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-stone-500 dark:text-zinc-400";

                    return (
                      <div
                        key={bill.id}
                        className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3
                              className={`text-sm font-semibold ${
                                bill.is_active
                                  ? "text-stone-900 dark:text-zinc-100"
                                  : "text-stone-400 line-through dark:text-zinc-500"
                              }`}
                            >
                              {bill.title}
                            </h3>
                            <span className="text-xs text-stone-500 dark:text-zinc-400">
                              · {recurringFrequencyLabel(bill.frequency)} ·{" "}
                              {bill.category}
                              {acc ? ` · ${acc.account_name}` : ""}
                            </span>
                          </div>
                          <p className={`mt-0.5 text-xs font-medium ${dueTone}`}>
                            Jatuh tempo {formatDateID(bill.next_due_date, dateFormat)}
                            {dueLabel ? ` · ${dueLabel}` : ""}
                            {!bill.is_active ? " · Dijeda" : ""}
                            {bill.notes ? ` · ${bill.notes}` : ""}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <span
                            className={`mr-1 font-mono text-sm font-semibold tabular-nums ${
                              bill.transaction_type === "income"
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {bill.transaction_type === "income" ? "+" : "-"}
                            {formatIDR(bill.amount)}
                          </span>

                          {bill.is_active ? (
                            <button
                              type="button"
                              onClick={() => handleQueueBill(bill)}
                              disabled={queueBill.isPending}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 whitespace-nowrap dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                            >
                              <Send className="h-3 w-3" aria-hidden="true" />
                              <span>Ajukan ke Antrean Persetujuan</span>
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => handleToggleBill(bill)}
                            disabled={toggleBill.isPending}
                            aria-label={
                              bill.is_active
                                ? `Jeda jadwal ${bill.title}`
                                : `Aktifkan jadwal ${bill.title}`
                            }
                            className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            {bill.is_active ? (
                              <>
                                <Pause className="h-3 w-3" aria-hidden="true" />
                                <span>Jeda</span>
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3" aria-hidden="true" />
                                <span>Aktifkan</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteBill(bill)}
                            disabled={deleteBill.isPending}
                            aria-label={`Hapus jadwal ${bill.title}`}
                            className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
```

---

## 56. `src/routes/_authenticated/pengaturan.tsx` (1059 lines)

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { MoneyInput } from "../../components/ego/money-input";
import { PWAInstallButton } from "../../components/ego/pwa-controls";
import {
  transactionsToCsv,
  triggerBrowserDownload,
  vaultSnapshotToBackupJson,
} from "../../lib/export";
import { todayISO } from "../../lib/finance";
import {
  isAutoLockEnabled,
  setAutoLockEnabled,
  setPinLocked,
} from "../../lib/pin-lock";
import { usePWAInstall } from "../../lib/pwa";
import {
  egoKeys,
  useAuthStatus,
  useChangePassword,
  useDeleteLocalOwner,
  useDisablePin,
  useHealthStatus,
  useLogoutOwner,
  useSetupPin,
  useUpdateOwnerProfile,
  useUpdatePreferences,
  useVaultSnapshot,
} from "../../lib/queries";
import { isSupabaseConfigured } from "../../lib/supabase";
import { ThemeToggleButton } from "../../lib/theme";
import type { DateFormatPref } from "../../types/ego";

export function PengaturanPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: auth } = useAuthStatus();
  const { data: vault, isFetching } = useVaultSnapshot(true);
  const { data: health } = useHealthStatus();
  const updatePrefs = useUpdatePreferences();
  const logout = useLogoutOwner();
  const changePassword = useChangePassword();
  const updateProfile = useUpdateOwnerProfile();
  const deleteOwner = useDeleteLocalOwner();
  const setupPin = useSetupPin();
  const disablePin = useDisablePin();
  const { isInstalled } = usePWAInstall();

  const [dateFormat, setDateFormat] = useState<DateFormatPref>("DD MMM YYYY");
  const [expenseLimit, setExpenseLimit] = useState(5_000_000);

  // Edit Owner profile form state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");

  // Delete Owner form state
  const [deletingOwner, setDeletingOwner] = useState(false);
  const [deleteOwnerPassword, setDeleteOwnerPassword] = useState("");
  const [deleteOwnerConfirmed, setDeleteOwnerConfirmed] = useState(false);

  // Change Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Quick 6-digit PIN form state
  const [autoLock, setAutoLock] = useState(() => isAutoLockEnabled());
  const [editingPin, setEditingPin] = useState(false);
  const [disablingPin, setDisablingPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinPassword, setPinPassword] = useState("");
  const [disablePinPassword, setDisablePinPassword] = useState("");

  useEffect(() => {
    if (vault?.preferences) {
      setDateFormat(vault.preferences.date_format);
      setExpenseLimit(vault.preferences.expense_alert_limit);
    }
  }, [vault?.preferences]);

  useEffect(() => {
    if (auth?.owner && !editingProfile) {
      setProfileName(auth.owner.full_name);
      setProfileEmail(auth.owner.email);
    }
  }, [auth?.owner, editingProfile]);

  async function handleSavePrefs(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updatePrefs.mutateAsync({
        date_format: dateFormat,
        expense_alert_limit: expenseLimit,
      });
      toast.success("Preferensi Owner berhasil disimpan.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan preferensi."
      );
    }
  }

  async function handleResync() {
    await qc.invalidateQueries({ queryKey: egoKeys.vault });
    toast.success("Data brankas berhasil disinkronkan ulang.");
  }

  async function handleLogout() {
    await logout.mutateAsync();
    toast.success("Seluruh cache sesi telah dibersihkan.");
    await navigate({ to: "/auth" });
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await updateProfile.mutateAsync({
        email: profileEmail,
        full_name: profileName,
        current_password: profilePassword,
      });
      setEditingProfile(false);
      setProfilePassword("");
      toast.success(
        isSupabaseConfigured
          ? res.emailChanged
            ? "Pembaruan email diajukan. Periksa kotak masuk email baru Anda bila diminta konfirmasi."
            : "Nama panggilan Owner berhasil diperbarui."
          : "Identitas & email Owner berhasil diperbarui."
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memperbarui identitas Owner."
      );
    }
  }

  async function handleDeleteOwner(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteOwnerConfirmed) {
      toast.error("Centang persetujuan penghapusan akun Owner terlebih dahulu.");
      return;
    }
    if (!deleteOwnerPassword) {
      toast.error("Masukkan kata sandi Owner saat ini untuk verifikasi.");
      return;
    }
    try {
      await deleteOwner.mutateAsync({
        current_password: deleteOwnerPassword,
        confirmed: deleteOwnerConfirmed,
      });
      toast.success("Akun Owner berhasil dihapus. Silakan daftarkan Owner baru.");
      await navigate({ to: "/auth" });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus akun Owner."
      );
    }
  }

  function handleExportCsv() {
    if (!vault) return;
    const csv = transactionsToCsv(vault.transactions, vault.accounts);
    triggerBrowserDownload(
      `ego-transaksi-${todayISO()}.csv`,
      csv,
      "text/csv;charset=utf-8;"
    );
    toast.success("Laporan transaksi CSV berhasil diunduh.");
  }

  function handleExportJsonBackup() {
    if (!vault) return;
    const json = vaultSnapshotToBackupJson(vault, auth?.owner?.email ?? null);
    triggerBrowserDownload(
      `ego-cadangan-brankas-${todayISO()}.json`,
      json,
      "application/json;charset=utf-8;"
    );
    toast.success("Cadangan lengkap brankas (JSON) berhasil diunduh.");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Masukkan kata sandi saat ini terlebih dahulu.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Kata sandi baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Kata sandi baru harus berbeda dari kata sandi saat ini.");
      return;
    }

    try {
      await changePassword.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast.success(
        "Kata sandi brankas diperbarui. Sesi perangkat lain telah diputus demi keamanan."
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengganti kata sandi."
      );
    }
  }

  async function handleSavePin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pinValue)) {
      toast.error("PIN cepat wajib terdiri dari tepat 6 digit angka.");
      return;
    }
    if (pinValue !== pinConfirm) {
      toast.error("Konfirmasi PIN 6 digit tidak cocok.");
      return;
    }
    if (!pinPassword) {
      toast.error("Masukkan kata sandi Owner saat ini untuk verifikasi.");
      return;
    }

    try {
      await setupPin.mutateAsync({
        current_password: pinPassword,
        pin: pinValue,
      });
      setPinValue("");
      setPinConfirm("");
      setPinPassword("");
      setEditingPin(false);
      setDisablingPin(false);
      toast.success("Kunci PIN cepat 6 digit berhasil diaktifkan.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan kunci PIN."
      );
    }
  }

  async function handleDisablePin(e: React.FormEvent) {
    e.preventDefault();
    if (!disablePinPassword) {
      toast.error("Masukkan kata sandi Owner untuk menonaktifkan PIN.");
      return;
    }
    try {
      await disablePin.mutateAsync(disablePinPassword);
      setDisablePinPassword("");
      setDisablingPin(false);
      setEditingPin(false);
      toast.success("Kunci PIN cepat berhasil dinonaktifkan.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menonaktifkan kunci PIN."
      );
    }
  }

  function handleToggleAutoLock(checked: boolean) {
    setAutoLock(checked);
    setAutoLockEnabled(checked);
    toast.success(
      checked
        ? "Kunci PIN otomatis saat aplikasi dibuka diaktifkan."
        : "Kunci PIN otomatis dinonaktifkan; Anda tetap bisa mengunci layar secara manual."
    );
  }

  const diagnostics = [
    {
      label: "Sesi Autentikasi Owner",
      status: auth?.authenticated ? "Aktif & Terverifikasi" : "Tidak Aktif",
      ok: Boolean(auth?.authenticated),
    },
    {
      label: "Koneksi Penyimpanan Data",
      status: isSupabaseConfigured
        ? "Supabase Cloud Terhubung"
        : "Brankas Server Lokal (Siap Supabase)",
      ok: isSupabaseConfigured || Boolean(health?.ok),
    },
    {
      label: "Kebijakan Keamanan & RLS",
      status: isSupabaseConfigured
        ? "RLS owner_id = auth.uid() Aktif"
        : "Single-Owner + Pembatas Login Aktif",
      ok: true,
    },
    {
      label: "Mode Aplikasi Harian (PWA)",
      status: isInstalled
        ? "Terpasang (Standalone)"
        : "Siap Dipasang di Ponsel",
      ok: true,
    },
  ];

  return (
    <AppShell
      title="Pengaturan Owner"
      subtitle="Sesuaikan tampilan, cadangkan data brankas, pasang aplikasi ponsel, dan cek kesiapan Supabase Cloud."
    >
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Identitas, Diagnostik & Supabase */}
        <section className="space-y-6 lg:col-span-6">
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                Identitas Owner Aktif
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingProfile((v) => !v);
                  setProfilePassword("");
                  if (auth?.owner) {
                    setProfileName(auth.owner.full_name);
                    setProfileEmail(auth.owner.email);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{editingProfile ? "Tutup" : "Ubah Email / Nama"}</span>
              </button>
            </div>
            <div className="mt-4 space-y-2.5 border-t border-stone-200/80 pt-4 text-sm dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-stone-500 dark:text-zinc-400">Nama</span>
                <span className="font-medium text-stone-900 dark:text-zinc-100">
                  {auth?.owner?.full_name ?? "Owner Utama"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500 dark:text-zinc-400">
                  Email Terdaftar
                </span>
                <span className="font-mono text-xs text-stone-900 dark:text-zinc-100">
                  {auth?.owner?.email ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500 dark:text-zinc-400">
                  Arsitektur Akses
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Single-Owner Mutlak
                </span>
              </div>
            </div>

            {editingProfile ? (
              <form
                onSubmit={handleUpdateProfile}
                className="mt-4 space-y-3 border-t border-stone-200/80 pt-4 dark:border-zinc-800"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="profile-name-input"
                      className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                    >
                      Nama Panggilan Owner
                    </label>
                    <input
                      id="profile-name-input"
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="profile-email-input"
                      className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                    >
                      Email Owner Baru
                    </label>
                    <input
                      id="profile-email-input"
                      type="email"
                      required
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="profile-password-input"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Kata Sandi Saat Ini (Verifikasi)
                  </label>
                  <input
                    id="profile-password-input"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    placeholder="Masukkan kata sandi brankas Anda"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={updateProfile.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
                  >
                    {updateProfile.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : null}
                    <span>Simpan Identitas Baru</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProfile(false);
                      setProfilePassword("");
                    }}
                    className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : null}
          </div>

          {/* Kunci PIN Cepat 6 Digit (PWA Harian) */}
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                    Kunci PIN Cepat (6 Digit)
                  </h2>
                  <p className="text-xs text-stone-600 dark:text-zinc-400">
                    Buka brankas harian di ponsel lebih cepat tanpa mengetik ulang kata sandi panjang.
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 text-xs font-semibold ${
                  auth?.hasPin
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-stone-500 dark:text-zinc-400"
                }`}
              >
                {auth?.hasPin ? "Aktif" : "Belum Aktif"}
              </span>
            </div>

            {auth?.hasPin && !editingPin ? (
              <div className="mt-4 space-y-4 border-t border-stone-200/80 pt-4 dark:border-zinc-800">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <div>
                    <p className="text-xs font-medium text-stone-800 dark:text-zinc-200">
                      Kunci otomatis saat aplikasi dibuka
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                      Meminta PIN 6 digit setiap kali membuka jendela atau PWA baru.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoLock}
                    onChange={(e) => handleToggleAutoLock(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 accent-emerald-600"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPinLocked(true);
                      toast.success("Layar brankas dikunci.");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Kunci Layar Sekarang</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPin(true);
                      setDisablingPin(false);
                    }}
                    className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Ubah PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisablingPin((v) => !v)}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
                  >
                    Nonaktifkan PIN
                  </button>
                </div>

                {disablingPin ? (
                  <form
                    onSubmit={handleDisablePin}
                    className="space-y-3 rounded-xl border border-rose-200/80 bg-rose-50/60 p-3.5 dark:border-rose-500/30 dark:bg-rose-950/20"
                  >
                    <div className="space-y-1">
                      <label
                        htmlFor="disable-pin-password"
                        className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                      >
                        Kata Sandi Owner Saat Ini
                      </label>
                      <input
                        id="disable-pin-password"
                        type="password"
                        value={disablePinPassword}
                        onChange={(e) => setDisablePinPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="Verifikasi kata sandi Anda"
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={disablePin.isPending}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                      >
                        {disablePin.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : null}
                        <span>Konfirmasi Nonaktifkan PIN</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDisablingPin(false);
                          setDisablePinPassword("");
                        }}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : (
              <form
                onSubmit={handleSavePin}
                className="mt-4 space-y-3.5 border-t border-stone-200/80 pt-4 dark:border-zinc-800"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="pin-input"
                      className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                    >
                      PIN 6 Digit
                    </label>
                    <input
                      id="pin-input"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="off"
                      value={pinValue}
                      onChange={(e) =>
                        setPinValue(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="••••••"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 font-mono text-sm tracking-widest text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="pin-confirm-input"
                      className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                    >
                      Konfirmasi PIN
                    </label>
                    <input
                      id="pin-confirm-input"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="off"
                      value={pinConfirm}
                      onChange={(e) =>
                        setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="••••••"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 font-mono text-sm tracking-widest text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="pin-owner-password"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Kata Sandi Owner Saat Ini
                  </label>
                  <input
                    id="pin-owner-password"
                    type="password"
                    autoComplete="current-password"
                    value={pinPassword}
                    onChange={(e) => setPinPassword(e.target.value)}
                    placeholder="Wajib diisi untuk verifikasi pemilik"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={setupPin.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
                  >
                    {setupPin.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>{auth?.hasPin ? "Simpan PIN Baru" : "Aktifkan Kunci PIN"}</span>
                  </button>
                  {editingPin ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPin(false);
                        setPinValue("");
                        setPinConfirm("");
                        setPinPassword("");
                      }}
                      className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                    >
                      Batal
                    </button>
                  ) : null}
                </div>
              </form>
            )}
          </div>

          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                Status Diagnostik &amp; Kesiapan Publikasi
              </h2>
              <button
                type="button"
                onClick={handleResync}
                disabled={isFetching}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:border-stone-300 hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span>Sinkronkan Ulang</span>
              </button>
            </div>

            <ul className="mt-4 divide-y divide-stone-200/70 dark:divide-zinc-800">
              {diagnostics.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 text-xs"
                >
                  <span className="text-stone-500 dark:text-zinc-400">
                    {item.label}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{item.status}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/80 p-3.5 text-xs text-stone-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              <div className="flex items-center gap-2 font-medium text-stone-800 dark:text-zinc-200">
                <Database
                  className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span>Panduan Aktivasi Supabase Cloud</span>
              </div>
              <p className="mt-1.5 leading-relaxed">
                {isSupabaseConfigured
                  ? "Supabase Cloud sudah terhubung aktif. Seluruh mutasi Anda dilindungi RLS owner_id = auth.uid()."
                  : "Untuk penyimpanan cloud permanen: (1) Jalankan skrip docs/ego-supabase-setup.sql di Supabase SQL Editor, lalu (2) Isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY pada panel Secrets sebelum mempublikasikan."}
              </p>
            </div>
          </div>

          {/* Instalasi Ponsel PWA */}
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                <Smartphone className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                  Aplikasi Harian di Ponsel (PWA)
                </h2>
                <p className="text-xs text-stone-600 dark:text-zinc-400">
                  {isInstalled
                    ? "Aplikasi sudah berjalan dalam mode layar penuh (standalone)."
                    : "Pasang di layar utama Android atau iPhone agar terasa seperti aplikasi native."}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <PWAInstallButton />
              {!isInstalled ? (
                <p className="mt-2.5 text-xs leading-relaxed text-stone-500 dark:text-zinc-400">
                  Di Android Chrome/Edge, gunakan tombol Pasang Aplikasi di atas atau menu browser &ldquo;Tambahkan ke Layar Utama&rdquo;. Di iPhone Safari, ketuk Bagikan lalu Tambahkan ke Layar Utama.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Preferensi, Ekspor/Backup, & Logout */}
        <section className="space-y-6 lg:col-span-6">
          <form
            onSubmit={handleSavePrefs}
            className="space-y-5 rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none"
          >
            <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
              Preferensi Tampilan &amp; Batas Pengeluaran
            </h2>

            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-stone-700 dark:text-zinc-300">
                Tampilan &amp; Tema Aplikasi
              </span>
              <div className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-stone-600 dark:text-zinc-400">
                  Pilih suasana terang yang hangat atau mode gelap yang tenang.
                </p>
                <ThemeToggleButton className="shrink-0" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="pref-date-format"
                className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
              >
                Format Tanggal
              </label>
              <select
                id="pref-date-format"
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormatPref)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
              >
                <option value="DD MMM YYYY">DD MMM YYYY (23 Nov 2026)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (23/11/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-11-23)</option>
              </select>
            </div>

            <MoneyInput
              id="pref-expense-limit"
              label="Batas Peringatan Pengeluaran Harian (IDR)"
              value={expenseLimit}
              onChange={setExpenseLimit}
              hint="Menampilkan peringatan lembut saat mencatat pengeluaran sebesar atau di atas batas ini."
            />

            <button
              type="submit"
              disabled={updatePrefs.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
            >
              {updatePrefs.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              <span>Simpan Preferensi</span>
            </button>
          </form>

          {/* Ekspor & Cadangan Brankas */}
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
              Ekspor &amp; Cadangan Data Brankas
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
              Unduh salinan pribadi laporan transaksi untuk Excel/Sheets (CSV) atau arsip lengkap seluruh brankas (JSON) kapan saja.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!vault}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span>Ekspor Transaksi (CSV)</span>
              </button>
              <button
                type="button"
                onClick={handleExportJsonBackup}
                disabled={!vault}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Cadangan Brankas Lengkap (JSON)</span>
              </button>
            </div>
          </div>

          {/* Ganti Kata Sandi Brankas */}
          <form
            onSubmit={handleChangePassword}
            className="space-y-4 rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                  Ganti Kata Sandi Brankas
                </h2>
                <p className="text-xs text-stone-600 dark:text-zinc-400">
                  Memperbarui kata sandi akan memutus seluruh sesi perangkat lain secara otomatis.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="current-vault-password"
                className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
              >
                Kata Sandi Saat Ini
              </label>
              <input
                id="current-vault-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Masukkan kata sandi aktif Anda"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor="new-vault-password"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Kata Sandi Baru (Min. 6 karakter)
                </label>
                <input
                  id="new-vault-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="confirm-new-vault-password"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Konfirmasi Kata Sandi Baru
                </label>
                <input
                  id="confirm-new-vault-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Ketik ulang kata sandi baru"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={changePassword.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
            >
              {changePassword.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>Perbarui Kata Sandi</span>
            </button>
          </form>

          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <h2 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
              Kontrol Sesi Brankas
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
              Menutup sesi akan membersihkan seluruh cache data lokal di browser dan mengunci kembali brankas pribadi Anda.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleLogout}
                disabled={logout.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Kunci Brankas &amp; Bersihkan Cache Sesi</span>
              </button>

              {!isSupabaseConfigured ? (
                <button
                  type="button"
                  onClick={() => setDeletingOwner((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xs font-semibold text-stone-700 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>Hapus Akun Owner</span>
                </button>
              ) : null}
            </div>

            {!isSupabaseConfigured && deletingOwner ? (
              <form
                onSubmit={handleDeleteOwner}
                className="mt-4 space-y-3 rounded-xl border border-rose-200/90 bg-rose-50/70 p-4 dark:border-rose-500/30 dark:bg-rose-950/20"
              >
                <p className="text-xs leading-relaxed text-rose-900 dark:text-rose-200">
                  Menghapus akun Owner akan mengosongkan seluruh data brankas lokal (akun, transaksi, aset, utang, dan rencana) dan membuka kembali pendaftaran Owner baru.
                </p>
                <label className="flex cursor-pointer items-start gap-2.5 text-xs text-stone-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={deleteOwnerConfirmed}
                    onChange={(e) => setDeleteOwnerConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-rose-300 accent-rose-600"
                  />
                  <span>
                    Saya memahami seluruh data brankas lokal akan dihapus permanen.
                  </span>
                </label>
                <div className="space-y-1">
                  <label
                    htmlFor="delete-owner-password"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Kata Sandi Owner Saat Ini
                  </label>
                  <input
                    id="delete-owner-password"
                    type="password"
                    autoComplete="current-password"
                    value={deleteOwnerPassword}
                    onChange={(e) => setDeleteOwnerPassword(e.target.value)}
                    placeholder="Verifikasi kata sandi Anda"
                    className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-rose-500 focus:outline-none dark:border-rose-500/30 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={deleteOwner.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {deleteOwner.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>Konfirmasi Hapus Akun Owner</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingOwner(false);
                      setDeleteOwnerPassword("");
                      setDeleteOwnerConfirmed(false);
                    }}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
```
