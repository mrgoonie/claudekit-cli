# Real-World Examples — Multi-Agent Orchestration

Practical scenarios demonstrating swarm patterns in action.

## Example 1: Feature with Parallel Implementation + Testing

**Scenario**: Build authentication feature with API, UI, and tests in parallel.

**Pattern**: Parallel Fan-Out

### Phase 1: Planning

Orchestrator creates implementation plan:
- API endpoints: `src/api/auth.ts`, `src/middleware/auth-middleware.ts`
- UI components: `src/components/AuthForm.tsx`, `src/components/LoginButton.tsx`
- Tests: `tests/api/auth.test.ts`, `tests/ui/auth.test.tsx`

### Phase 2: Parallel Execution

```typescript
// Orchestrator spawns three workers
TeammateTool.spawnTeam({
  teammates: [
    {
      role: "api-implementer",
      task: `Build authentication API in src/api/auth.ts and src/middleware/auth-middleware.ts.

Requirements:
- POST /api/auth/login (email, password)
- POST /api/auth/logout
- GET /api/auth/me (requires auth)
- JWT-based authentication
- Rate limiting: 5 attempts per minute
- Follow existing API patterns in src/api/users.ts

Acceptance:
- All endpoints return proper status codes
- JWT tokens expire after 24h
- Passwords never logged or exposed`
    },
    {
      role: "ui-implementer",
      task: `Build authentication UI in src/components/.

Files to create:
- AuthForm.tsx (login form with email/password)
- LoginButton.tsx (trigger auth flow)

Requirements:
- Form validation (email format, password min 8 chars)
- Loading states during API calls
- Error display for failed login
- Success redirect after login
- Follow existing component patterns in src/components/UserProfile.tsx

Acceptance:
- Form accessible (ARIA labels)
- Works with keyboard navigation
- Mobile responsive`
    },
    {
      role: "test-implementer",
      task: `Write comprehensive tests for authentication.

Files to create:
- tests/api/auth.test.ts (API endpoint tests)
- tests/ui/auth.test.tsx (UI component tests)

Requirements:
- API tests: Cover success, invalid credentials, rate limiting
- UI tests: Cover form validation, submission, error states
- Use Vitest for API tests, React Testing Library for UI
- Follow existing test patterns in tests/api/users.test.ts

Acceptance:
- All tests pass
- Coverage > 80% for new code`
    }
  ]
})
```

### Phase 3: Monitoring

Orchestrator checks mailbox periodically:

```
[10:15] api-implementer: "Status: Implemented login and logout endpoints. Starting /me endpoint."
[10:18] ui-implementer: "Status: AuthForm component complete. Starting LoginButton."
[10:20] test-implementer: "Status: API tests written. Starting UI tests."
[10:25] api-implementer: "Completion: All endpoints implemented. Tests passing locally."
[10:27] ui-implementer: "Completion: Both components complete. Tested manually in browser."
[10:30] test-implementer: "Completion: All tests written and passing. Coverage: 85%."
```

### Phase 4: Integration

Orchestrator merges results:

1. **File Conflict Check**: No conflicts (clean file boundaries)
2. **Type Check**: `bun run typecheck` → Passes
3. **Test Suite**: `bun test` → All pass, 85% coverage
4. **Manual Verification**: Start dev server, test login flow → Works
5. **Commit**: Create unified commit with all changes

### Outcome

- **Time Saved**: 3 workers in parallel vs sequential = ~60% faster
- **Quality**: Each worker focused on their domain, higher quality
- **Zero Conflicts**: Clean file boundaries prevented merge issues

---

## Example 2: Multi-Module Refactoring

**Scenario**: Refactor codebase to split monolithic `utils.ts` into focused modules.

**Pattern**: Parallel Fan-Out (by module)

### Phase 1: Analysis

Orchestrator analyzes `src/utils.ts` (500 lines):
- String utilities: 150 lines → `src/utils/string-utils.ts`
- Date utilities: 120 lines → `src/utils/date-utils.ts`
- Validation utilities: 130 lines → `src/utils/validation-utils.ts`
- Array utilities: 100 lines → `src/utils/array-utils.ts`

### Phase 2: Parallel Extraction

```typescript
TeammateTool.spawnTeam({
  teammates: [
    {
      role: "string-extractor",
      task: `Extract string utilities from src/utils.ts to src/utils/string-utils.ts.

Functions to extract:
- slugify()
- truncate()
- capitalize()
- camelCase()
- kebabCase()

Requirements:
- Preserve all JSDoc comments
- Update imports in files that use these functions
- Add exports to src/utils/index.ts`
    },
    {
      role: "date-extractor",
      task: `Extract date utilities from src/utils.ts to src/utils/date-utils.ts.

Functions to extract:
- formatDate()
- parseDate()
- addDays()
- isValidDate()

Requirements:
- Preserve all JSDoc comments
- Update imports in files that use these functions
- Add exports to src/utils/index.ts`
    },
    {
      role: "validation-extractor",
      task: `Extract validation utilities from src/utils.ts to src/utils/validation-utils.ts.

Functions to extract:
- isEmail()
- isUrl()
- isPhoneNumber()
- validateSchema()

Requirements:
- Preserve all JSDoc comments
- Update imports in files that use these functions
- Add exports to src/utils/index.ts`
    },
    {
      role: "array-extractor",
      task: `Extract array utilities from src/utils.ts to src/utils/array-utils.ts.

Functions to extract:
- unique()
- groupBy()
- sortBy()
- chunk()

Requirements:
- Preserve all JSDoc comments
- Update imports in files that use these functions
- Add exports to src/utils/index.ts`
    }
  ]
})
```

### Phase 3: Merge + Cleanup

After all workers complete:

1. **Verify Extraction**: Check that all functions extracted
2. **Remove Original**: Delete `src/utils.ts` (now empty)
3. **Test Imports**: `bun run typecheck` → All imports resolve
4. **Run Tests**: `bun test` → All pass (no behavior changed)
5. **Commit**: Refactor complete

### Outcome

- **Maintainability**: 4 focused files instead of 1 monolithic file
- **Parallel Speed**: 4 workers completed in same time as 1 would take for first module
- **Zero Breakage**: All imports updated correctly, tests pass

---

## Example 3: Research → Plan → Implement Pipeline

**Scenario**: Implement new feature requiring research on best practices.

**Pattern**: Sequential Chain

### Stage 1: Research

```typescript
Task({
  subagentType: "researcher",
  prompt: `Research GraphQL pagination best practices.

Focus areas:
- Cursor-based vs offset-based pagination
- Relay Connection specification
- Performance considerations
- Error handling patterns

Output: Write findings to research/graphql-pagination.md with pros/cons of each approach.`
})
```

Researcher completes, writes comprehensive report.

### Stage 2: Planning

```typescript
// Orchestrator reads research, spawns planner
Task({
  subagentType: "planner",
  prompt: `Read research/graphql-pagination.md. Create implementation plan for adding pagination to our GraphQL API.

Context:
- Current API in src/graphql/resolvers/
- Using Apollo Server
- Postgres database with Prisma ORM

Output: Write detailed plan to plans/graphql-pagination-plan.md with:
- Chosen approach (cursor vs offset) and reasoning
- Schema changes needed
- Resolver modifications
- Database query updates
- Testing strategy`
})
```

Planner completes, chooses cursor-based approach, writes detailed plan.

### Stage 3: Implementation

```typescript
// Orchestrator reads plan, spawns implementer
Task({
  subagentType: "implementer",
  prompt: `Follow the plan in plans/graphql-pagination-plan.md to implement GraphQL pagination.

Files to modify:
- src/graphql/schema.graphql (add Connection types)
- src/graphql/resolvers/posts.ts (add pagination logic)
- src/database/queries.ts (cursor-based queries)

Requirements:
- Follow Relay Connection spec
- Default page size: 20
- Max page size: 100
- Return hasNextPage, hasPreviousPage, cursors

Do NOT write tests (next stage).`
})
```

Implementer completes, all files modified.

### Stage 4: Testing

```typescript
// Orchestrator spawns tester
Task({
  subagentType: "tester",
  prompt: `Write comprehensive tests for GraphQL pagination implementation.

Files to create:
- tests/graphql/pagination.test.ts

Test cases:
- First page retrieval
- Forward pagination (using after cursor)
- Backward pagination (using before cursor)
- Edge cases: empty results, single item, max page size
- Error cases: invalid cursor, excessive page size

Use Apollo Server testing utilities. All tests must pass.`
})
```

Tester completes, all tests pass.

### Stage 5: Final Integration

Orchestrator:
1. Runs full test suite → All pass
2. Runs typecheck → No errors
3. Manual verification → Pagination works in GraphQL playground
4. Creates commit with all changes

### Outcome

- **Quality**: Research informed good architectural decision
- **Documentation**: Research and plan documents serve as future reference
- **Separation**: Each agent focused on their expertise
- **Validation**: Testing stage caught edge case in cursor encoding

---

## Example 4: Plan Mode + Swarm Launch

**Scenario**: User requests complex feature. Orchestrator plans, then immediately spawns workers.

### User Request

"Implement social sharing feature: share posts to Twitter, Facebook, LinkedIn."

### Orchestrator Response

```typescript
// Orchestrator enters plan mode, analyzes requirements
// Creates high-level plan
// Exits plan mode with swarm launch

ExitPlanMode({
  launchSwarm: true,
  teammates: [
    {
      role: "oauth-implementer",
      task: `Implement OAuth flows for Twitter, Facebook, LinkedIn.

Files to create:
- src/auth/twitter-oauth.ts
- src/auth/facebook-oauth.ts
- src/auth/linkedin-oauth.ts
- src/auth/social-oauth-manager.ts

Requirements:
- OAuth 2.0 flows
- Token storage (encrypted)
- Token refresh logic
- Error handling for API failures`
    },
    {
      role: "sharing-implementer",
      task: `Implement post sharing API endpoints.

Files to create:
- src/api/share.ts (POST /api/posts/:id/share)
- src/services/social-share-service.ts

Requirements:
- Accept platform: twitter | facebook | linkedin
- Format post content per platform (character limits, hashtags)
- Call respective OAuth APIs
- Return share URLs
- Handle rate limiting`
    },
    {
      role: "ui-implementer",
      task: `Build sharing UI components.

Files to create:
- src/components/ShareButton.tsx
- src/components/ShareModal.tsx

Requirements:
- Modal shows platform options
- OAuth connect flow for unconnected platforms
- Loading states during share
- Success/error messages
- Responsive design`
    },
    {
      role: "test-implementer",
      task: `Write tests for social sharing feature.

Files to create:
- tests/auth/social-oauth.test.ts
- tests/api/share.test.ts
- tests/ui/share.test.tsx

Requirements:
- Mock OAuth APIs
- Test success and error cases
- Test rate limiting
- UI interaction tests`
    }
  ]
})
```

All four workers spawn immediately and work in parallel.

### Outcome

- **Efficiency**: No orchestrator round-trip between plan and execution
- **Parallelism**: All workers start simultaneously
- **Clear Scope**: Each worker has precise boundaries from planning phase

---

## Key Takeaways

1. **Parallel Fan-Out**: Best for independent domains (API/UI/Tests)
2. **Sequential Chain**: Best when each stage needs previous output
3. **File Ownership**: Critical for avoiding conflicts in parallel work
4. **Plan Mode + Swarm**: Efficient for complex features needing immediate execution
5. **Status Updates**: Keep orchestrator informed of progress
6. **Integration Phase**: Always validate merged results (typecheck, tests, manual)

## Anti-Pattern Examples

**Bad: Overlapping File Ownership**
```typescript
// DON'T: Both workers editing same file
teammates: [
  { role: "worker-1", task: "Modify src/utils.ts..." },
  { role: "worker-2", task: "Also modify src/utils.ts..." }  // CONFLICT!
]
```

**Good: Distinct File Ownership**
```typescript
// DO: Non-overlapping files
teammates: [
  { role: "worker-1", task: "Modify src/string-utils.ts..." },
  { role: "worker-2", task: "Modify src/date-utils.ts..." }  // No conflict
]
```

**Bad: Too Many Workers**
```typescript
// DON'T: 12 workers for small task
teammates: [ /* 12 workers */ ]  // Coordination overhead too high
```

**Good: Right-Sized Team**
```typescript
// DO: 3-5 workers for appropriate task size
teammates: [ /* 4 workers */ ]  // Manageable coordination
```

**Bad: No Merge Plan**
```typescript
// DON'T: Spawn workers without knowing how to integrate
teammates: [...]
// ... then realize you don't know how to merge results
```

**Good: Plan Merge Upfront**
```typescript
// DO: Know merge strategy before spawning
// Plan: Workers create separate modules, orchestrator updates index.ts to export all
teammates: [...]
```
