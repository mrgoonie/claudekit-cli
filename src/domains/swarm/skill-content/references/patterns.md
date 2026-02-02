# Orchestration Patterns — Multi-Agent Coordination

Three proven patterns for coordinating multiple agents effectively.

## Pattern 1: Sequential Chain

**Definition**: Agents execute in strict order, each using output from previous agent.

```
Agent A → Agent B → Agent C → Result
```

### When to Use

- Tasks have strict dependencies (can't parallelize)
- Each stage needs output from previous stage
- Example: Research → Plan → Implement → Test

### How to Implement

**Option 1: Orchestrator Spawns Sequentially**
```typescript
// Step 1: Spawn researcher
Task({
  subagentType: "researcher",
  prompt: "Research auth libraries. Report to research/auth-options.md"
})

// Step 2: Wait for completion, then spawn planner
Task({
  subagentType: "planner",
  prompt: "Read research/auth-options.md. Create implementation plan in plans/auth-plan.md"
})

// Step 3: Wait for completion, then spawn implementer
Task({
  subagentType: "implementer",
  prompt: "Follow plans/auth-plan.md. Implement in src/auth/"
})

// Step 4: Wait for completion, then spawn tester
Task({
  subagentType: "tester",
  prompt: "Test implementation in src/auth/. Write tests in tests/auth/"
})
```

**Option 2: ExitPlanMode with Sequential Dependencies**
```typescript
// From plan mode, specify order via task descriptions
ExitPlanMode({
  launchSwarm: true,
  teammates: [
    {
      role: "researcher",
      task: "Research first. Output to research/. Signal completion."
    },
    {
      role: "implementer",
      task: "Wait for researcher completion. Read research/. Implement in src/."
    }
  ]
})
```

### Context Passing

**Via Files**:
- Agent A writes to `output/report.md`
- Agent B reads from `output/report.md`
- Clear, persistent handoff

**Via Mailbox**:
- Agent A sends completion message with summary
- Agent B receives message, proceeds
- Faster but less durable

### Best Practices

- **Limit Chain Length**: Max 4 agents to avoid context fragmentation
- **Clear Handoff Points**: Each agent knows exactly what previous agent produced
- **Validate Between Stages**: Orchestrator checks output before spawning next agent
- **Document Flow**: Write chain order in comments or plan file

### Pitfalls

**Context Loss**: After 4+ agents, early context gets compressed or lost.
- **Solution**: Have each agent write summary to file for later agents

**Blocking**: If Agent B is stuck, Agent C can't start.
- **Solution**: Set timeouts, allow orchestrator to intervene

**Over-Specialization**: Too many tiny agents (e.g., 10 agents for 10 steps).
- **Solution**: Combine related steps into one agent's work

**No Validation**: Agent B assumes Agent A succeeded.
- **Solution**: Orchestrator validates output before spawning next

## Pattern 2: Parallel Fan-Out

**Definition**: Orchestrator spawns multiple workers simultaneously, waits for all, then merges.

```
         ┌─→ Worker 1 ─┐
         │             │
Orch ────┼─→ Worker 2 ─┼──→ Merge
         │             │
         └─→ Worker 3 ─┘
```

### When to Use

- Independent work units (different files/domains)
- No dependencies between workers
- Want to maximize parallelism
- Example: Implement API + UI + Tests simultaneously

### How to Implement

**Using TeammateTool**:
```typescript
TeammateTool.spawnTeam({
  teammates: [
    {
      role: "api-worker",
      task: "Build API in src/api/. Files: auth.ts, users.ts, posts.ts."
    },
    {
      role: "ui-worker",
      task: "Build UI in src/components/. Files: AuthForm.tsx, UserProfile.tsx."
    },
    {
      role: "test-worker",
      task: "Write tests in tests/. Files: api.test.ts, ui.test.ts."
    }
  ]
})

// Wait for all completion messages in mailbox
// Then merge results
```

**Using Task (Delegate)**:
```typescript
// Spawn all at once
Task({ prompt: "API task..." })
Task({ prompt: "UI task..." })
Task({ prompt: "Test task..." })

// Monitor all for completion
```

### File Ownership Strategy

**Strict Boundaries**:
- Worker 1: `src/api/**`
- Worker 2: `src/components/**`
- Worker 3: `tests/**`
- Zero overlap = zero conflicts

**Shared Files (Avoid if Possible)**:
If unavoidable, one worker owns shared file, others coordinate via mailbox.

### Merge Strategy

**Orchestrator Actions**:
1. Wait for all completion messages
2. Read all modified files
3. Check for unexpected conflicts
4. Run typecheck across all changes
5. Run full test suite
6. Create unified commit

**Conflict Resolution**:
- If conflict found: determine which worker violated boundary
- Request shutdown of violating worker
- Reassign conflicting work with clearer boundaries

### Best Practices

- **Define Boundaries Upfront**: Before spawning, write down file ownership in plan
- **Limit Worker Count**: 3-7 workers optimal. More = coordination overhead
- **Independent Validation**: Each worker runs their own tests before reporting completion
- **Status Updates**: Workers send periodic status (e.g., "50% done") so orchestrator knows progress

### Pitfalls

**Fuzzy Boundaries**: Two workers both think they should edit `shared-utils.ts`.
- **Solution**: Assign shared files explicitly to one owner, others request changes via mailbox

**Premature Merge**: Orchestrator merges before all workers complete.
- **Solution**: Track completion count, only merge when all reported done

**No Integration Tests**: All workers pass unit tests but integration fails.
- **Solution**: Orchestrator runs integration tests during merge phase

**Silent Failures**: Worker hits error but doesn't report.
- **Solution**: Set timeouts, check mailbox regularly for error messages

## Pattern 3: Pipeline (Stream Processing)

**Definition**: Stream of similar items flows through stages, each stage transforms and passes to next.

```
Items: [A, B, C, D, E]

Stage 1 → Stage 2 → Stage 3 → Output
(parse)   (transform) (write)
```

### When to Use

- Batch processing many similar items
- Each item undergoes same transformation stages
- Example: Migrate 10 files, refactor 20 components

### How to Implement

**Sequential Pipeline**:
```typescript
// Stage 1: Parser worker processes all items
Task({
  prompt: "Parse all files in old-format/. Write parsed JSON to intermediate/parsed/"
})

// Stage 2: Transformer worker processes parsed items
Task({
  prompt: "Read intermediate/parsed/. Transform to new format. Write to intermediate/transformed/"
})

// Stage 3: Writer worker writes final output
Task({
  prompt: "Read intermediate/transformed/. Write final files to new-format/"
})
```

**Parallel Pipeline** (Advanced):
```typescript
// Spawn stage workers that continuously process
TeammateTool.spawnTeam({
  teammates: [
    { role: "parser", task: "Watch old-format/. Parse each file. Write to intermediate/parsed/." },
    { role: "transformer", task: "Watch intermediate/parsed/. Transform each. Write to intermediate/transformed/." },
    { role: "writer", task: "Watch intermediate/transformed/. Write final output." }
  ]
})

// All stages run concurrently, processing items as they arrive
```

### Best Practices

- **Atomic Operations**: Each stage completes item fully before next stage picks it up
- **Idempotent Stages**: Safe to re-run if failure occurs
- **Progress Tracking**: Each stage reports items processed (e.g., "Parsed 7/10 files")
- **Error Isolation**: Error in one item doesn't block other items

### Pitfalls

**Blocking Errors**: Stage 1 fails on item 3, blocks items 4-10.
- **Solution**: Stage continues with remaining items, logs failures for later retry

**No Progress Visibility**: Orchestrator doesn't know if pipeline is moving.
- **Solution**: Each stage sends status updates to mailbox

**Memory Buildup**: Intermediate files accumulate without cleanup.
- **Solution**: Final stage cleans up intermediate directories

**Inconsistent State**: Pipeline stops mid-execution, some items processed, some not.
- **Solution**: Each stage tracks processed items, supports resume from checkpoint

## Pattern Selection Guide

| Scenario | Pattern | Why |
|----------|---------|-----|
| Research → Design → Implement | Sequential Chain | Strict dependencies |
| Build API + UI + Tests | Parallel Fan-Out | Independent work areas |
| Migrate 50 files | Pipeline | Homogeneous batch processing |
| Build feature with subtasks | Parallel Fan-Out | Maximize parallelism |
| Multi-step refactoring | Sequential Chain | Each step needs previous results |
| Data processing ETL | Pipeline | Stream transformation |

## Combining Patterns

**Chain + Fan-Out**:
```
Research (chain) → Plan (chain) → [API + UI + Tests] (fan-out) → Integration (chain)
```

**Fan-Out + Pipeline**:
```
Orch → [Pipeline-1, Pipeline-2, Pipeline-3] → Merge
```

Each worker runs its own pipeline on a subset of items.

## Anti-Patterns

**Over-Coordination**: Every worker asks orchestrator for approval on every small decision.
- **Solution**: Give workers autonomy within clear boundaries

**Under-Coordination**: Workers collide on files, create conflicts.
- **Solution**: Define file ownership explicitly

**Too Many Workers**: 10+ workers for a small task.
- **Solution**: Combine related work into fewer workers

**Deep Nesting**: Orchestrator → Worker → Sub-worker → Sub-sub-worker.
- **Solution**: Max 2 levels of nesting

**No Merge Plan**: Spawn workers without knowing how to integrate results.
- **Solution**: Plan merge strategy before spawning workers
