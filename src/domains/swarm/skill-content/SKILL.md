# ck-swarm — Multi-Agent Orchestration

Guides Claude Code agents on native multi-agent features: TeammateTool, delegate mode, swarm spawning, teammate mailbox.

## When to Use This Skill

- Task requires parallel execution across 3+ independent files/areas
- Sequential pipeline: research → plan → implement → test
- Complex feature needing specialized worker agents
- Need to coordinate multiple agents on shared codebase

## Role Identification

**Orchestrator** (team lead): Spawns workers, assigns tasks, merges results. Uses TeammateTool for control.

**Worker**: Receives task via Task tool, executes autonomously, reports back.

## Quick Start

1. **Plan**: Break task into independent work units with clear boundaries
2. **Spawn**: Use TeammateTool.spawnTeam or Task tool with delegate mode
3. **Monitor**: Check teammate mailbox for progress updates
4. **Merge**: Collect results, resolve conflicts, verify integration

## Key Rules

- **File Ownership**: Workers own their file boundaries — no two workers edit same file
- **No Direct Implementation**: Orchestrator never implements directly — only delegates and merges
- **Clear Scope**: Each worker gets clear scope: files to touch, acceptance criteria, constraints
- **Plan Mode Integration**: Use ExitPlanMode with launchSwarm to spawn teammates from plan mode
- **Context Size**: Limit swarm to 5-7 workers max to avoid context fragmentation

## Orchestrator Responsibilities

1. **Task Decomposition**
   - Identify independent work units
   - Define clear file ownership boundaries
   - Establish acceptance criteria per worker
   - Plan merge/integration strategy upfront

2. **Worker Coordination**
   - Spawn workers with precise instructions
   - Monitor progress via teammate mailbox
   - Approve or reject worker plans if using planning phase
   - Request shutdown if worker goes off-track

3. **Result Integration**
   - Collect outputs from all workers
   - Resolve file conflicts if boundaries were fuzzy
   - Run final validation (tests, typecheck, lint)
   - Create unified commit or report

## Worker Responsibilities

1. **Receive Task**: Read delegation prompt clearly
2. **Execute Autonomously**: Work within assigned file boundaries
3. **Report Back**: Use teammate mailbox for status updates
4. **Handle Feedback**: Respond to orchestrator's approval/rejection

## Common Patterns

**Sequential Chain** (A → B → C):
- Use when tasks have strict dependencies
- Each agent completes before next spawns
- Pass context explicitly between stages
- Max 4 agents in chain to avoid context loss

**Parallel Fan-Out** (Orchestrator → [W1, W2, W3] → Merge):
- Use when work units are independent
- Spawn all workers simultaneously
- Wait for all to complete before merging
- Ensure zero file overlap between workers

**Pipeline** (Stream through stages):
- Use for batch processing (e.g., migrate 10 files)
- Each stage processes and passes to next
- Error in one stage blocks downstream
- Suitable for homogeneous tasks

## Plan Mode + Swarm Launch

When orchestrator is in plan mode and wants to spawn workers:

```typescript
// From plan mode, launch swarm directly
ExitPlanMode({
  launchSwarm: true,
  teammates: [
    { role: "implementer", task: "Build auth API endpoints in src/auth/" },
    { role: "tester", task: "Write integration tests for auth flow" }
  ]
})
```

This exits plan mode and spawns teammates in one operation.

## Delegate Mode vs TeammateTool

**Use Task tool (delegate mode)** when:
- Simple one-off delegation
- No need for plan approval flow
- Fire-and-forget pattern

**Use TeammateTool** when:
- Managing team of 3+ workers
- Need to approve/reject worker plans
- Complex coordination with status updates
- Need to request worker shutdown

## Teammate Mailbox

**Reading Messages**:
- Check mailbox periodically for worker updates
- Look for status, errors, completion signals

**Sending Messages**:
- Notify workers of dependency completion
- Share cross-cutting insights
- Coordinate timing of merge

## Error Handling

**File Conflict**:
- Immediately stop affected workers
- Reassign file ownership
- Restart with clear boundaries

**Worker Stuck**:
- Check mailbox for last update
- Request shutdown if unresponsive
- Reassign task to new worker

**Context Loss**:
- Keep worker tasks focused (< 5 files each)
- Avoid deep nesting (max 2 levels)
- Summarize results before passing to next stage

## Anti-Patterns

- **Overlapping Ownership**: Two workers editing same file
- **No Merge Plan**: Spawning workers without integration strategy
- **Too Many Workers**: More than 7 workers causes coordination overhead
- **Deep Nesting**: Orchestrator → Worker → Sub-worker → Sub-sub-worker
- **Fire and Forget**: Spawning workers without monitoring mailbox

## Integration with ClaudeKit

This skill works seamlessly with:
- `/plan` command: Orchestrator can delegate plan execution to workers
- `/docs:init`: Workers can initialize docs for their domain
- `/test` skill: Parallel test execution across workers
- `/commit` skill: Final commit after merge

## References

- [Tool Reference](references/tools.md) — TeammateTool ops, delegate mode, mailbox
- [Patterns](references/patterns.md) — Sequential chain, parallel fan-out, pipeline
- [Examples](references/examples.md) — Real-world usage scenarios

## Success Criteria

A successful swarm operation should:
- Complete faster than sequential execution
- Have zero file conflicts during merge
- Produce passing tests and typecheck
- Result in clean, coherent implementation
