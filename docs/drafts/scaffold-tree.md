**Structure decisions**:
1. Module-first layout: each business module lives in `src/modules/<module>/` and contains its own four layers (`domain/`, `application/`, `infrastructure/`, `presentation/`). The MVP has one module, `scheduling` (appointments, allocation, and the dealership, bay, technician, and vehicle data it reads). A new module is a new folder under `src/modules/`.
2. NestJS wiring: each module has its own `<module>.module.ts` as that module's composition root (`useFactory` providers); `src/app.module.ts` only imports modules. No layer depends on another layer's wiring.
3. Shared infrastructure lives in `src/shared/infrastructure/database/`: the Prisma service and the generated Prisma client. Prisma schema and migrations live in `prisma/` at the repo root. Prisma types never leave `infrastructure/` folders; module repositories map them to domain types.
4. Tests live in a separate `tests/` folder mirroring modules: `tests/unit/` (no database) and `tests/integration/` (real PostgreSQL, run by `pnpm test:integration`).
5. Only the folders below are created now. Other sub-folders are created in Phase 4 when code needs them.

**Agreed tree**:
```
src/
├── modules/
│   └── scheduling/
│       ├── domain/
│       ├── application/
│       │   ├── commands/
│       │   └── ports/
│       ├── infrastructure/
│       │   └── database/      # repositories, transaction adapter
│       ├── presentation/
│       │   └── dtos/
│       └── scheduling.module.ts
├── shared/
│   └── infrastructure/
│       └── database/
│           └── generated/     # Prisma client output (gitignored)
├── app.module.ts
└── main.ts
prisma/
├── schema.prisma
└── migrations/
tests/
├── unit/
│   └── scheduling/
└── integration/
    └── scheduling/
```
