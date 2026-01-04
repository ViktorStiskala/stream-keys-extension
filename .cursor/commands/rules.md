---
description: Audit Cursor rules for accuracy and completeness
---

# Cursor Rules Audit

Check all Cursor rules in the codebase to verify they are up-to-date with the current implementation and identify any adjustments needed.

## Instructions

### Step 1: Discover All Cursor Rules

Find all rule files in the codebase:

```bash
find . -path '**/.cursor/rules/**/*.md' -type f 2>/dev/null
```

Read each discovered rule file.

### Step 2: Categorize Rules

Group discovered rules by type:
- **General rules**: `.cursor/rules/*/RULE.md` (project-wide patterns)
- **Service-specific rules**: `src/services/.cursor/rules/*/RULE.md` (per-service docs)
- **Feature-specific rules**: `src/features/*/.cursor/rules/*/RULE.md` (per-feature docs)

### Step 3: For Each Rule, Verify Against Implementation

For each rule file:

1. **Identify referenced files** - Extract file paths, selectors, function names mentioned
2. **Read the actual implementation** - Load the referenced source files
3. **Compare documentation vs code**:
   - Do documented selectors/patterns match the code?
   - Are documented function signatures accurate?
   - Are feature flags/config options correctly described?
   - Are DOM structures still valid?
   - Do code examples compile and reflect current APIs?

### Step 4: Check for Missing Documentation

Identify code patterns that should be documented but aren't:
- New handler configurations not in service rules
- New features without corresponding rules
- Changed APIs with outdated documentation

### Step 5: Report Findings

Present findings in this format:

```markdown
## Rules Audit Summary

### Rules Reviewed: [count]

---

### Up-to-Date Rules
[List rules that accurately reflect implementation]

### Rules Needing Updates
[For each outdated rule:]
- **File**: [path]
- **Issue**: [what's wrong]
- **Current code**: [snippet]
- **Documentation says**: [snippet]
- **Suggested fix**: [what to change]

### Missing Documentation
[Code patterns/features that should have rules but don't]

---

## Recommendations
[Prioritized list of documentation updates]
```

### Step 6: User Confirmation for Updates

If updates are needed:
1. Present the specific changes required
2. Wait for explicit user confirmation before modifying any RULE.md files
