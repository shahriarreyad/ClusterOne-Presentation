# Phase Exit Sign-off — N_

Copy to `infrastructure/networking/reports/N<x>-signoff.md`, fill in, and attach to the
phase's PR. **A phase is not done until this is filled and the PR is merged.**

---

## Header

| Field | Value |
|-------|-------|
| Phase | N_ — _name_ |
| Owner | Abir (CSE Tech) |
| Started | YYYY-MM-DD |
| Completed | YYYY-MM-DD |
| Branch / PR | `abir/network` → `develop`, PR #__ |
| Reviewed by | Zafor |

---

## 1. Exit gate

**Stated gate (copy verbatim from the phase file):**

> _paste it here_

**Was it met?** ☐ Yes ☐ Yes, with exceptions ☐ No

**Evidence — the actual command and its actual output:**

```text
$ <command>
<output>
```

Screenshots do not count. Paste text.

---

## 2. Deliverables

| # | Deliverable | Done | Location |
|---|-------------|------|----------|
| 1 | | ☐ | |
| 2 | | ☐ | |
| 3 | | ☐ | |

Anything not done: say why, and who/what it's waiting on.

---

## 3. What changed

| Change | File(s) | Affects |
|--------|---------|---------|
| | | |

**Contract files touched** (`reference/*`) — these need a team announcement:

- [ ] `ip-address-plan.md` — announced to: ______
- [ ] `naming-convention.md` — announced to: ______
- [ ] `port-matrix.md` — announced to: ______
- [ ] `ssh-standard.md` — announced to: ______

---

## 4. Verification run

| Check | Result | Notes |
|-------|--------|-------|
| `netcheck.sh` on all nodes | ☐ pass ☐ fail | |
| `port-check.sh` | ☐ pass ☐ fail | |
| Survives a reboot | ☐ pass ☐ fail ☐ n/a | |
| Config is in git (not just on the box) | ☐ yes ☐ no | |

---

## 5. Exceptions and accepted risks

| # | Issue | Impact | Why accepted | Owner | Revisit at |
|---|-------|--------|--------------|-------|-----------|
| 1 | | | | | |

---

## 6. Blockers created for others

| Person | What they can now do | What they still can't |
|--------|---------------------|----------------------|
| | | |

---

## 7. Risk register update

| Risk | Status | Note |
|------|--------|------|
| R_ | ☐ not seen ☐ materialised ☐ mitigated ☐ closed | |

---

## 8. Lessons

**What went better than expected:**

**What took longer than expected, and why:**

**What I'd tell the next person doing this phase:**

---

## 9. Sign-off

| | Name | Date |
|---|------|------|
| Completed by | Abir | |
| Reviewed by | Zafor | |
| Next phase may start | ☐ yes ☐ no | |
