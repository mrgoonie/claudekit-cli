# ClaudeKit Dashboard UI

## 🎯 Core Mission

**The Dashboard is ClaudeKit's visual home.** Where the CLI is fast and focused, the Dashboard is rich and educational. It's where users:

1. **Discover** — See all available kits, compare features, understand the ecosystem
2. **Install** — One-click guided installation with real-time progress
3. **Manage** — Configure projects, monitor health, customize their setup
4. **Learn** — Understand what's possible through exploration, not documentation walls

### User Journeys We Serve

| User | Journey | Dashboard Role |
|------|---------|----------------|
| **Newcomer** | "What is ClaudeKit?" | Onboarding → Kit comparison → Guided install |
| **Evaluator** | "Engineer or Marketing?" | Side-by-side features → Try before commit |
| **Adopter** | "Set up my project" | Install wizard → Config editor → Success |
| **Power user** | "Manage my stack" | Project switcher → Health dashboard → Quick actions |

### Design Principles

- **Progressive disclosure** — Simple surface, depth on demand
- **Visual confidence** — Users should see their setup is healthy at a glance
- **Bilingual first** — EN/VI parity is non-negotiable (our users are global)
- **CLI parity** — Anything the CLI does, the Dashboard can trigger

---

## i18n Requirements (MANDATORY)

**Every user-facing string MUST have both English and Vietnamese translations.**

### Adding New Strings

1. Add to `src/i18n/translations.ts`:
```typescript
export const translations = {
  en: {
    // ... existing
    myNewKey: "English text here",
  },
  vi: {
    // ... existing
    myNewKey: "Vietnamese text here",
  },
} as const;
```

2. Use in components:
```tsx
import { useI18n } from "../i18n";

const MyComponent = () => {
  const { t } = useI18n();
  return <span>{t("myNewKey")}</span>;
};
```

3. For class components (like ErrorBoundary):
```tsx
import { I18nContext } from "../i18n";

<I18nContext.Consumer>
  {(i18n) => <span>{i18n?.t("myNewKey") ?? "Fallback"}</span>}
</I18nContext.Consumer>
```

### Rules

- NO hardcoded English strings in JSX
- TypeScript enforces matching keys in EN/VI
- Use descriptive camelCase keys (e.g., `addProjectTitle`, not `title1`)
- Group keys by component in translations.ts

### Translation Guidelines

| English | Vietnamese Pattern |
|---------|-------------------|
| "Loading..." | "Đang tải..." |
| "Error" | "Lỗi" |
| "Save Changes" | "Lưu thay đổi" |
| "Cancel" | "Hủy" |
| "Add {thing}" | "Thêm {thing}" |
| "Edit {thing}" | "Chỉnh sửa {thing}" |
| "Delete" | "Xóa" |
| "Confirm" | "Xác nhận" |

### Desktop Mode (Tauri v2)

The dashboard runs in both web mode (`ck config ui` at :3456) and desktop mode (Tauri webview). Use `isTauri()` from `hooks/use-tauri.ts` to gate desktop-only features. Tauri commands are called via `@tauri-apps/api/core` `invoke()`.

### Quick Commands

```bash
bun run ui:dev      # Dev server with hot reload (standalone Vite)
bun run ui:build    # Production build (outputs to dist/ui/)
bun run tauri:dev   # Desktop dev (Tauri + dashboard:dev)
bun run tauri:build # Desktop production build
```

### Quality Gate (UI)

The pre-push hook runs `bun run validate` (typecheck + lint + build + test). For UI files, this is **not sufficient** — the root `tsc --noEmit` misses errors that the UI's stricter `tsc -b` catches. The pre-push hook now also runs `bun run ui:build` to close this gap.

**If you need to verify manually** (e.g., before committing, or to debug CI failures):

```bash
bun run ui:build    # runs tsc -b && vite build — the authoritative UI gate
```

**Why two TypeScript checks?** Root `tsc --noEmit` checks the CLI codebase. The UI has its own `tsconfig.json` targeting ES2021 with `noUnusedLocals: true`. Only `tsc -b` (run by `ui:build`) enforces these stricter rules.

**Common CI failure patterns:**
- `TS6133` unused variables/imports — `tsc --noEmit` doesn't catch these, `tsc -b` does
- `TS2550` missing lib methods (e.g., `Array.at()`) — UI targets ES2021, use bracket indexing instead
- Unused destructured props in component signatures — remove or prefix with `_`

**Common UI lint issues:**
- Long JSX attribute lines must be wrapped (biome formatter)
- Use semantic HTML over `role` attributes (a11y/useSemanticElements)
- React hooks must list all deps (useExhaustiveDependencies)
- Don't redeclare imported types locally (noRedeclare)
- Use `showText` (width-based) not `!isCollapsed` (prop-based) for responsive text visibility

---

## Skill Naming Convention (IMPORTANT)

Some skills have `ck-` prefix in their folder names but are invoked without the prefix:

| Folder Name | Invocation Command | URL Param |
|-------------|-------------------|-----------|
| `ck-plan` | `/ck:plan` | `?name=plan` or `?name=ck-plan` |
| `ck-debug` | `/ck:debug` | `?name=debug` or `?name=ck-debug` |
| `ck-predict` | `/ck:predict` | `?name=predict` or `?name=ck-predict` |
| `ck-scenario` | `/ck:scenario` | `?name=scenario` |
| `ck-security` | `/ck:security` | `?name=security` |
| `ck-loop` | `/ck:loop` | `?name=loop` |
| `ck-autoresearch` | - | `?name=autoresearch` |
| `cook` | `/ck:cook` | `?name=cook` |
| `fix` | `/ck:fix` | `?name=fix` |
| `scout` | `/ck:scout` | `?name=scout` |

**Handling in code:**

1. **Workflows page** (`hooks/use-workflows-enhanced.ts`):
   - `buildSkillCommandMap()` creates aliases for both `ck-{name}` and `{name}` forms
   - Workflows can reference skills by short name (e.g., `skill: "plan"`)

2. **Skills browser** (`pages/SkillsBrowserPage.tsx`):
   - URL param matching checks both exact match and `ck-{name}` prefixed match
   - `/skills?name=plan` will correctly find `ck-plan` skill

3. **Skill chip navigation** (`components/workflows/workflow-skill-chip.tsx`):
   - Extracts skill name from command (e.g., `/ck:plan` → `plan`)
   - Navigates to `/skills?name={skillName}`
   - Skills browser handles the prefix resolution

**When adding new skills:**
- If the skill folder has `ck-` prefix, no special handling needed — the alias system covers it
- The skill's `triggers[0]` in SKILL.md determines the canonical invocation command
