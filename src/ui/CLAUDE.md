# ClaudeKit Dashboard UI

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
