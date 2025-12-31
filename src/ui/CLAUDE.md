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

### Quick Commands

```bash
bun run ui:dev      # Dev server with hot reload
bun run ui:build    # Production build
```
