# Tool Reference — Multi-Agent Coordination

Complete reference for TeammateTool, Task delegation, teammate mailbox, and ExitPlanMode swarm launch.

## TeammateTool

Native Claude Code tool for managing teams of worker agents.

### spawnTeam

Create a team of workers with assigned roles and tasks.

**When to Use**:
- Need to manage 3+ workers simultaneously
- Want plan approval/rejection flow
- Complex coordination with status tracking

**Parameters**:
```typescript
{
  teammates: [
    {
      role: string,        // e.g., "implementer", "tester", "researcher"
      task: string,        // Clear instructions with file boundaries
      agentType?: string,  // Optional: specific agent type
    }
  ]
}
```

**Example**:
```typescript
TeammateTool.spawnTeam({
  teammates: [
    {
      role: "api-implementer",
      task: "Build REST endpoints in src/api/. Files: auth.ts, users.ts. Use Express patterns from existing code."
    },
    {
      role: "test-writer",
      task: "Write integration tests in tests/api/. Cover auth and user endpoints. Use Vitest."
    },
    {
      role: "docs-updater",
      task: "Update API docs in docs/api.md with new endpoints. Include request/response schemas."
    }
  ]
})
```

**Best Practices**:
- Assign non-overlapping file sets to each worker
- Include acceptance criteria in task description
- Reference existing patterns workers should follow
- Keep tasks focused (3-5 files per worker max)

### approvePlan

Approve a worker's implementation plan, allowing them to proceed.

**When to Use**:
- Worker submitted plan for review
- Plan looks correct and follows architecture
- File boundaries are respected

**Parameters**:
```typescript
{
  teammateId: string,  // ID from mailbox message
  feedback?: string    // Optional: guidance or clarifications
}
```

**Example**:
```typescript
TeammateTool.approvePlan({
  teammateId: "worker-auth-api",
  feedback: "Looks good. Remember to add rate limiting middleware."
})
```

### rejectPlan

Reject a worker's plan and provide redirection.

**When to Use**:
- Plan violates file boundaries
- Approach doesn't match architecture
- Worker misunderstood requirements

**Parameters**:
```typescript
{
  teammateId: string,
  reason: string,       // Clear explanation of why rejected
  guidance: string      // Specific corrections needed
}
```

**Example**:
```typescript
TeammateTool.rejectPlan({
  teammateId: "worker-auth-api",
  reason: "Plan modifies files owned by test-writer worker (tests/api/auth.test.ts).",
  guidance: "Only modify src/api/auth.ts and src/api/users.ts. Do not touch test files."
})
```

### requestShutdown

Gracefully terminate a worker.

**When to Use**:
- Worker is stuck or unresponsive
- Worker went off-track despite rejection
- Requirements changed, task no longer needed

**Parameters**:
```typescript
{
  teammateId: string,
  reason: string  // Explanation for shutdown
}
```

**Example**:
```typescript
TeammateTool.requestShutdown({
  teammateId: "worker-old-approach",
  reason: "Requirements changed. We're using external auth service instead."
})
```

## Task Tool (Delegate Mode)

Alternative to TeammateTool for simpler delegations.

### When to Use Task vs TeammateTool

**Use Task** when:
- One-off delegation to single worker
- No need for plan approval flow
- Fire-and-forget pattern
- Quick research or simple implementation

**Use TeammateTool** when:
- Managing 3+ workers
- Need plan approval/rejection
- Complex coordination required
- Status tracking important

### Delegate Mode Parameters

```typescript
Task({
  prompt: string,              // Detailed instructions
  subagentType?: string,       // "planner", "implementer", "tester", etc.
  run_in_background?: boolean  // Default: false
})
```

### Examples

**Simple delegation**:
```typescript
Task({
  prompt: "Research best practices for rate limiting in Express. Create report in research/rate-limiting.md."
})
```

**Typed delegation**:
```typescript
Task({
  subagentType: "implementer",
  prompt: "Implement pagination helper in src/utils/pagination.ts. Use cursor-based approach."
})
```

**Background worker**:
```typescript
Task({
  prompt: "Run performance benchmarks on API endpoints. Save results to benchmarks/api-perf.json.",
  run_in_background: true
})
```

## Teammate Mailbox

Message system for worker-orchestrator communication.

### Reading Messages

Mailbox contains messages from all active teammates.

**Message Structure**:
```typescript
{
  from: string,        // Teammate ID
  type: string,        // "status" | "plan" | "completion" | "error"
  content: string,     // Message body
  timestamp: string
}
```

**Checking Mailbox**:
```typescript
// Mailbox is automatically available to orchestrator
// Check periodically for updates from workers
```

### Message Types

**Status Update**:
- Worker reports progress
- "Completed 3/5 files"
- "Blocked on dependency X"

**Plan Submission**:
- Worker submits implementation plan for approval
- Requires approvePlan or rejectPlan response

**Completion**:
- Worker finished assigned task
- Ready for result collection

**Error**:
- Worker encountered blocker
- Needs orchestrator intervention

### Sending Messages

Workers can send messages to orchestrator or other teammates.

**Example**:
```typescript
// From worker to orchestrator
TeammateMailbox.send({
  to: "orchestrator",
  type: "status",
  content: "Completed auth endpoints. Starting user endpoints."
})
```

## ExitPlanMode with launchSwarm

Launch swarm directly from plan mode without returning to orchestrator.

### When to Use

- Orchestrator is in plan mode
- Plan involves multiple parallel workers
- Want to spawn workers immediately after planning

### Syntax

```typescript
ExitPlanMode({
  launchSwarm: true,
  teammates: [
    {
      role: string,
      task: string,
      agentType?: string
    }
  ]
})
```

### Example

```typescript
// Orchestrator in plan mode finishes planning
ExitPlanMode({
  launchSwarm: true,
  teammates: [
    {
      role: "backend-implementer",
      task: "Build API in src/api/. Files: router.ts, handlers.ts, middleware.ts.",
      agentType: "implementer"
    },
    {
      role: "frontend-implementer",
      task: "Build UI in src/components/. Files: AuthForm.tsx, UserProfile.tsx.",
      agentType: "implementer"
    },
    {
      role: "integration-tester",
      task: "Write E2E tests in tests/e2e/. Cover full auth flow.",
      agentType: "tester"
    }
  ]
})
```

This exits plan mode and immediately spawns all three workers.

## Coordination Patterns

### Sequential Approval Flow

1. Orchestrator spawns worker with TeammateTool.spawnTeam
2. Worker creates plan, sends to mailbox
3. Orchestrator receives plan message
4. Orchestrator approves with TeammateTool.approvePlan
5. Worker executes implementation
6. Worker sends completion message
7. Orchestrator collects results

### Parallel Execution Flow

1. Orchestrator spawns 3-5 workers simultaneously
2. Each worker works independently (no file conflicts)
3. Workers send status updates periodically
4. Orchestrator monitors mailbox
5. All workers send completion
6. Orchestrator merges results

### Error Recovery Flow

1. Worker sends error message
2. Orchestrator reads from mailbox
3. Orchestrator decides: redirect or shutdown
4. If redirect: rejectPlan with guidance
5. If shutdown: requestShutdown and spawn new worker

## Tool Comparison

| Feature | TeammateTool | Task (Delegate) |
|---------|--------------|-----------------|
| Plan approval | Yes | No |
| Multiple workers | Yes | One at a time |
| Status tracking | Via mailbox | Manual check |
| Shutdown control | Yes | No |
| Complexity | Higher | Lower |
| Use case | Complex coordination | Simple delegation |
