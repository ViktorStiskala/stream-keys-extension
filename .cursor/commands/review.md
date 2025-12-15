---
description: Review source code for bugs, consistency issues, and documentation drift
---

# Code Review

Perform a comprehensive code review of the StreamKeys extension, focusing on bugs, consistency, test quality, and documentation sync. After review, run linting and tests.

## Instructions

### Step 1: Discover and Load All Cursor Rules

Dynamically find and read ALL cursor rules in the codebase:

```bash
find . -path '**/.cursor/rules/**/*.md' -type f 2>/dev/null
```

Read each discovered rule file to understand project conventions and requirements. This ensures any new rules added in nested directories (e.g., `src/features/restore-position/.cursor/rules/`) are automatically included.

### Step 2: Determine Review Scope

Check if working on a feature branch:

```bash
git rev-parse --abbrev-ref HEAD
```

If on a branch other than `main`:
1. Get list of changed files: `git diff origin/main --name-only`
2. Get detailed changes: `git diff origin/main`
3. Focus review primarily on these changes
4. Still verify flag/pattern consistency across the full codebase

If on `main` or no branch context provided:
- Review the entire `src/` directory

### Step 3: Feature Condition Verification (CRITICAL)

**This is the most important check.** When a new feature adds conditions, checks, or boolean flags, verify they are applied consistently to ALL call sites.

#### Process:

1. **Identify new flags/conditions** in changed files:
   - New boolean parameters (e.g., `supportsDirectSeek`)
   - New guard conditions (e.g., `if (settings.customSeekEnabled)`)
   - New validation checks

2. **Search for all related code paths** that should respect these flags:
   - Use grep/search to find all usages of related functions
   - Trace through the call graph

3. **Verify each call site** includes the check:
   - If a flag controls behavior X, ALL code that does X must check the flag
   - Missing checks are CRITICAL BUGS

#### Example Bug Pattern:

```
Bug: Media keys ignore supportsDirectSeek flag for seeking

The Media Session handlers for previoustrack and nexttrack directly manipulate 
video.currentTime without checking the supportsDirectSeek flag. For services 
like Disney+ where supportsDirectSeek: false (because they use MediaSource 
Extensions with buffer-relative currentTime), these media key handlers will 
not work correctly. 

The keyboard handler and button interception both correctly check 
supportsDirectSeek before using video.currentTime, but this check was 
missing for media session actions.

Affected code paths that ALL needed the check:
1. Keyboard handler - HAD the check ✓
2. Button interception - HAD the check ✓  
3. Media Session handlers - MISSING the check ✗
```

#### Key Areas to Verify:

- `src/handlers/factory.ts` - all seek-related code paths
- `src/features/keyboard/index.ts` - keyboard handling
- Media Session handlers (`navigator.mediaSession.setActionHandler`)
- Button interception handlers
- Any new feature modules

### Step 4: Bug Pattern Detection

#### 4.1 Race Conditions

Look for:
- Async operations without proper guards (`isLoading`, `isProcessing` flags)
- Shared state mutations in event handlers without synchronization
- Timer/interval callbacks that might access stale closure values
- Missing cleanup for intervals and event listeners
- Operations that depend on DOM state that could change between checks

**Disney+ specific:** Progress bar timing issue - Disney+ updates `aria-valuenow` BEFORE `video.seeking` becomes true. Any code capturing "current" time during seeks must handle this race condition.

#### 4.2 Test Quality Issues

**Hardcoded values:** Tests should import and use exported constants, not hardcode threshold values.

```typescript
// BAD - hardcoded value that might break if constant changes
expect(result).toBe(10);

// GOOD - uses exported constant
import { SEEK_THRESHOLD } from '@/core/constants';
expect(result).toBe(SEEK_THRESHOLD);
```

**Synthetic logic:** Tests should call actual codebase functions, not reimplement calculation logic.

```typescript
// BAD - reimplements the seeking calculation in test
const expected = Math.max(0, currentTime - 10);
expect(video.currentTime).toBe(expected);

// GOOD - calls the actual seek function and verifies behavior
Keyboard.handleSeek('backward');
expect(video.currentTime).toBeLessThan(originalTime);
```

**Check for:**
- Tests that duplicate logic from source files
- Magic numbers that match constants but aren't imported
- Test helpers that reimplement rather than call production code
- Missing tests for newly added handler methods or features
- Tests that only test synthetic scenarios, not real integration

#### 4.3 Duplicate Code

Look for:
- Similar button lookup patterns across services that could be abstracted
- Repeated DOM traversal logic
- Copy-pasted event handlers with minor variations
- Duplicate error handling patterns

### Step 5: Documentation Sync Check

Compare implemented features against documentation:

**README.md:**
- Feature list matches actual implemented features
- Keyboard shortcuts table is complete and accurate
- Supported services list is current
- Installation instructions are up to date
- The README is meant mostly for end-users, so technical details shouldn't be mentioned apart from simple developer instructions

**All discovered RULE.md files:**
- Feature flags documented match actual implementation
- Config properties match type definitions
- DOM selectors match actual service implementations
- Testing patterns documented match actual test files

### Step 6: Report Findings

Organize findings into categories:

```markdown
## Code Review Summary

### Branch: [branch name or "main"]
### Files Reviewed: [count or "all src/"]
### Changes Since origin/main: [summary if applicable]

---

### Critical Bugs
[Issues that will cause runtime failures or incorrect behavior]
[Especially: missing flag checks, race conditions]

### Potential Issues  
[Code patterns that might cause problems under certain conditions]

### Test Quality
[Tests that might break or don't test real functionality]

### Documentation Drift
[Mismatches between docs and implementation - DO NOT fix automatically]

### Code Quality
[Duplicate code, missing abstractions, style issues]

---
```

### Step 7: Documentation Updates (User Confirmation Required)

If documentation drift is found:

1. **STOP and ask the user** before making any changes to:
   - `README.md`
   - Any `RULE.md` files
   - Other documentation

2. Present the specific mismatches found:
   - What the documentation says
   - What the code actually does
   - Suggested update

3. Wait for explicit user confirmation before proceeding with updates

### Step 8: Run Verification Suite

After completing the code review, run the full verification suite:

#### 8.1 Production Build (Required First)

Build the production extension to ensure tests can verify no debug code is included:

```bash
npm run build
```

This must complete successfully before running tests. The production build:
- Removes all `__DEV__` conditional blocks
- Strips debug logging
- Enables dead code elimination

#### 8.2 Linter Checks

Run all code quality checks:

```bash
npm run check
```

This runs:
- TypeScript type checking (`npm run typecheck`)
- ESLint linting (`npm run lint`)
- Prettier formatting (`npm run format:check`)

Report any failures with file locations and error messages.

#### 8.3 Full Test Suite

Run the complete test suite:

```bash
npm test
```

Report any test failures with:
- Test file and test name
- Expected vs actual values
- Relevant error messages

### Step 9: Final Summary

Provide a final summary:

```markdown
## Verification Results

### Production Build: [PASS/FAIL]
[Any build errors or warnings]

### Linter Checks: [PASS/FAIL]
- TypeScript: [PASS/FAIL]
- ESLint: [PASS/FAIL]  
- Prettier: [PASS/FAIL]
[List any issues]

### Test Suite: [PASS/FAIL]
- Tests run: [count]
- Passed: [count]
- Failed: [count]
[List any failures]

---

## Recommendations

[Prioritized list of actions, starting with critical bugs]
```

$ARGUMENTS
