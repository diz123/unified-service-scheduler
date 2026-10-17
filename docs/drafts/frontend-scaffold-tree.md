**Structure decisions**:
1. Single Next.js App Router package in `frontend/`: `app/page.tsx` renders both the appointment booking form and the appointment lookup section on one page (DESIGN.md Target Deliverables, ADR-0002).
2. Pure helpers live in `frontend/lib/` (time conversion via native `Intl.DateTimeFormat`, error-code mapping, API request helpers) with no React/DOM dependencies, so they can be unit-tested in isolation.
3. Unit tests for `frontend/lib/` live in `frontend/tests/unit/`, matching the root repo's `tests/unit/` convention.
4. `frontend/.gitignore` ignores Next.js generated output (`.next/`, `next-env.d.ts`), so the root `.gitignore` is not modified (ADR-0002 names only `pnpm-workspace.yaml`, the root `verify` script and the root ESLint ignore list as root changes). `node_modules/`, `coverage/`, `.env*` and `*.tsbuildinfo` are already ignored at any depth by the root `.gitignore`.
5. The frontend `typecheck` must pass on a clean clone, where `next-env.d.ts` and `.next/types` do not exist yet. If `tsc` needs Next.js-generated types, the `typecheck` script generates them first (verify the command in the Next.js docs at scaffold time).
6. Only the folders below are created now. `components/` and other sub-folders are created in Phase 4 when code needs them.

**Agreed tree**:
```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx          # booking + lookup on one page
│   └── globals.css
├── lib/                  # pure helpers: time conversion, error-code mapping, API client
├── tests/
│   └── unit/
├── .gitignore            # .next/ and next-env.d.ts
├── eslint.config.mjs
├── jest.config.js
├── next.config.ts        # rewrites /api/:path* -> http://localhost:3000/:path*
├── package.json
└── tsconfig.json
```
