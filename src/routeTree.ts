import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { RootComponent } from "./routes/__root";
import { AuthenticatedLayout } from "./routes/_authenticated/route";
import { AkunPage } from "./routes/_authenticated/akun";
import { AnalitikPage } from "./routes/_authenticated/analitik";
import { AnggaranPage } from "./routes/_authenticated/anggaran";
import { AsetPage } from "./routes/_authenticated/aset";
import { DashboardPage } from "./routes/_authenticated/index";
import { LaporanPage } from "./routes/_authenticated/laporan";
import { OwnerControlPage } from "./routes/_authenticated/owner";
import { PengaturanPage } from "./routes/_authenticated/pengaturan";
import { PengingatPage } from "./routes/_authenticated/pengingat";
import { RencanaPage } from "./routes/_authenticated/rencana";
import { SimulasiPage } from "./routes/_authenticated/simulasi";
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
  akun?: string;
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
    const akun =
      typeof search.akun === "string" && search.akun.trim()
        ? search.akun.trim()
        : undefined;
    return { kategori, jenis, akun };
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

export interface RencanaSearch {
  tab?: "target" | "simulator" | "tagihan";
}

const rencanaRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/rencana",
  validateSearch: (search: Record<string, unknown>): RencanaSearch => ({
    tab:
      search.tab === "tagihan" ||
      search.tab === "simulator" ||
      search.tab === "target"
        ? search.tab
        : undefined,
  }),
  component: RencanaPage,
});

const pengingatRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/pengingat",
  component: PengingatPage,
});

const anggaranRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/anggaran",
  component: AnggaranPage,
});

const laporanRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/laporan",
  component: LaporanPage,
});

const analitikRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/analitik",
  component: AnalitikPage,
});

const simulasiRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/simulasi",
  component: SimulasiPage,
});

export interface OwnerSearch {
  tab?: "ai" | "control";
}

const ownerRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/owner",
  validateSearch: (search: Record<string, unknown>): OwnerSearch => ({
    tab: search.tab === "ai" || search.tab === "control" ? search.tab : undefined,
  }),
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
    pengingatRoute,
    anggaranRoute,
    laporanRoute,
    analitikRoute,
    simulasiRoute,
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
