import type { AdminAccount } from "../types/admin.types";

export const SEED_ADMINS: readonly AdminAccount[] = [
  {
    id: "adm_01",
    name: "محمد عبد الكريم",
    email: "admin@oscar-platform.com",
    role: "ADMIN",
    status: "active",
    lastActiveAt: "2026-10-01 14:30",
    createdAt: "2026-01-01 00:00",
  },
  {
    id: "adm_02",
    name: "علي السعدي",
    email: "ali.alsaadi@oscar-platform.com",
    role: "ADMIN",
    status: "active",
    lastActiveAt: "2026-10-01 11:15",
    createdAt: "2026-03-10 10:00",
  },
  {
    id: "adm_03",
    name: "زيد البياتي",
    email: "zaid.bayati@oscar-platform.com",
    role: "ADMIN",
    status: "inactive",
    lastActiveAt: "2026-09-20 16:45",
    createdAt: "2026-04-15 09:30",
  },
];
