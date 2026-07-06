---
name: nodejs-best-practices
description: Use this skill whenever working on a Node.js backend/API — building new, reviewing, debugging, or extending one (Express, Fastify, NestJS, Hono). ALWAYS use it first when the backend already exists, especially when it serves a React Native / mobile app, to understand current architecture, routes, auth, and request/response contracts before making any change. Also covers framework selection, project structure, error handling, validation, async patterns, and security review. Trigger on mentions of "backend", "API", "server", "endpoint", "Node.js", "Express", "Fastify", "NestJS", or "how does my app talk to the backend" — even if the user doesn't say "best practices" explicitly.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Node.js Backend Skill

> Principles and decision-making for Node.js development.
> **Learn to THINK, not memorize code patterns — and never touch an existing backend blind.**

---

## ⚠️ How to Use This Skill

This skill teaches **decision-making principles**, not fixed code to copy.

- If a backend **already exists**, ALWAYS run Phase 0 (below) before proposing or making changes.
- ASK the user for preferences when unclear.
- Choose framework/pattern based on CONTEXT, not habit.
- Don't default to the same solution every time.

---

## Phase 0. Understand the Existing Backend First (Do This Before Anything Else)

If the user already has a working backend, your first job is to build an accurate mental model of what it does today — not to redesign it. Skipping this step is the most common way to break something that was already working.

### 0.1 Map the backend itself

Walk the codebase (don't guess from folder names) and answer:

- **Entry point & framework**: Which framework is actually in use (Express/Fastify/NestJS/Hono/etc.)? Check `package.json` dependencies, not just file structure.
- **Routes/controllers**: What endpoints exist? Method + path + purpose for each.
- **Layers present**: Is there a service/repository split, or is logic all in route handlers?
- **Data layer**: What database/ORM? Where do queries live?
- **Auth**: What auth mechanism (JWT, session, OAuth, API key)? Where is it enforced — middleware, per-route, or inconsistently?
- **Error handling**: Is there centralized error middleware, or ad-hoc try/catch with inconsistent response shapes?
- **Config/secrets**: How is environment config loaded? `.env`, config service, hardcoded?
- **Existing conventions**: Naming, response envelope shape (`{ data, error }` vs raw JSON vs something else), versioning scheme if any.

Use `Grep`/`Glob` to find all route definitions and middleware registration points rather than reading files one by one at random.

### 0.2 Map the interface with the React Native app

This is the part most likely to get missed, and breaking it silently breaks the app. For each endpoint the mobile app actually calls:

- **Find the call sites in the RN app** (if the RN codebase is available): search for the base URL / API client (`fetch`, `axios`, `React Query`, `RTK Query`, custom hooks) to see exactly which endpoints, methods, and payloads are used in practice — not just what the backend theoretically exposes.
- **Request contract**: What shape/fields does the app send (body, query params, headers — especially auth headers)?
- **Response contract**: What shape does the app expect back? Check how the RN code destructures the response — that tells you the real contract, which may differ from what the backend docs/comments claim.
- **Error contract**: How does the app detect and handle failures — status code checks, an `error` field, thrown exceptions from the client library? Any change to error shape breaks this silently.
- **Auth flow end-to-end**: Where does the app store/attach the token, and where does the backend read it? Mismatches here are a common silent-failure source.
- **Realtime/streaming**: If the app uses WebSockets, SSE, or polling, note that separately — it has different failure modes than request/response.
- **Versioning/back-compat risk**: If the app is deployed to app stores, backend changes can't always ship in lockstep with app updates (review takes time). Flag when a proposed backend change would break an app version still in the wild.

### 0.3 Summarize before acting

Before proposing changes, state back a short summary: "Here's what your backend currently does and how the app talks to it: ..." and confirm it's accurate. Then scope the actual request against that reality — e.g., "you asked for X; here's what that touches and what stays untouched."

**Never assume a greenfield decision tree (Phase 1 below) applies to an existing backend.** Phase 1 is for new projects or genuinely new services within an existing system, not for re-litigating a framework/architecture choice that's already shipped and working.

---

## 1. Framework Selection (New Projects Only)

### Decision Tree

```
What are you building?
│
├── Edge/Serverless (Cloudflare, Vercel)
│   └── Hono (zero-dependency, fast cold starts)
│
├── High Performance API
│   └── Fastify (generally faster than Express under load)
│
├── Enterprise/Team familiarity
│   └── NestJS (structured, DI, decorators)
│
├── Legacy/Stable/Maximum ecosystem
│   └── Express (mature, most middleware)
│
└── Full-stack with frontend
    └── Next.js API Routes or tRPC
```

### Comparison Principles

| Factor | Hono | Fastify | Express |
|--------|------|---------|---------|
| **Best for** | Edge, serverless | Performance-sensitive APIs | Legacy, learning, huge ecosystem |
| **Cold start** | Fastest | Fast | Moderate |
| **Ecosystem** | Growing | Good | Largest |
| **TypeScript** | Native | Excellent | Good |
| **Learning curve** | Low | Medium | Low |

Treat any specific performance numbers as directional, not guarantees — always benchmark your actual workload if performance is the deciding factor.

### Selection Questions to Ask:
1. What's the deployment target?
2. Is cold start time critical?
3. Does the team have existing experience?
4. Is there legacy code to maintain or integrate with?
5. **If a backend already exists**: is this a new service, or should it live inside the current one? (Usually the latter, for a mobile app with one backend.)

---

## 2. Runtime Considerations

### Native TypeScript

```
Modern Node.js: --experimental-strip-types (check current LTS support)
├── Run .ts files directly
├── No build step needed for simple projects
└── Consider for: scripts, simple APIs
```

### Module System Decision

```
ESM (import/export)
├── Modern standard
├── Better tree-shaking
├── Async module loading
└── Use for: new projects

CommonJS (require)
├── Legacy compatibility
├── Broadest npm package support
└── Use for: existing codebases, some edge cases
```

### Runtime Selection

| Runtime | Best For |
|---------|----------|
| **Node.js** | General purpose, largest ecosystem |
| **Bun** | Performance, built-in bundler |
| **Deno** | Security-first, built-in TypeScript |

If a backend already exists, stay on its current runtime unless the user explicitly asks about migrating — a runtime switch is a major, high-risk decision, not a default.

---

## 3. Architecture Principles

### Layered Structure Concept

```
Request Flow:
│
├── Controller/Route Layer
│   ├── Handles HTTP specifics
│   ├── Input validation at boundary
│   └── Calls service layer
│
├── Service Layer
│   ├── Business logic
│   ├── Framework-agnostic
│   └── Calls repository layer
│
└── Repository Layer
    ├── Data access only
    ├── Database queries
    └── ORM interactions
```

### Why This Matters:
- **Testability**: Mock layers independently
- **Flexibility**: Swap database without touching business logic
- **Clarity**: Each layer has single responsibility

### When to Simplify (or When Not to Impose This on an Existing Project):
- Small scripts → single file OK
- Prototypes → less structure acceptable
- Existing backend with a different (working) structure → match its conventions, don't impose this pattern uninvited
- Always ask: "Will this grow, and does the user want this restructured?"

---

## 4. Error Handling Principles

### Centralized Error Handling

```
Pattern:
├── Create custom error classes
├── Throw from any layer
├── Catch at top level (middleware)
└── Format consistent response
```

### Error Response Philosophy

```
Client (including the RN app) gets:
├── Appropriate HTTP status
├── Error code for programmatic handling
├── User-friendly message
└── NO internal details (security!)

Logs get:
├── Full stack trace
├── Request context
├── User ID (if applicable)
└── Timestamp
```

If a backend already exists, check what error shape the RN app currently parses (Phase 0.2) before changing it — a "cleaner" error format is a breaking change if the app expects the old one.

### Status Code Selection

| Situation | Status | When |
|-----------|--------|------|
| Bad input | 400 | Client sent invalid data |
| No auth | 401 | Missing or invalid credentials |
| No permission | 403 | Valid auth, but not allowed |
| Not found | 404 | Resource doesn't exist |
| Conflict | 409 | Duplicate or state conflict |
| Validation | 422 | Schema valid but business rules fail |
| Server error | 500 | Our fault, log everything |

---

## 5. Async Patterns Principles

### When to Use Each

| Pattern | Use When |
|---------|----------|
| `async/await` | Sequential async operations |
| `Promise.all` | Parallel independent operations |
| `Promise.allSettled` | Parallel where some can fail |
| `Promise.race` | Timeout or first response wins |

### Event Loop Awareness

```
I/O-bound (async helps):
├── Database queries
├── HTTP requests
├── File system
└── Network operations

CPU-bound (async doesn't help):
├── Crypto operations
├── Image processing
├── Complex calculations
└── → Use worker threads or offload
```

### Avoiding Event Loop Blocking

- Avoid sync methods in production (`fs.readFileSync`, etc.)
- Offload CPU-intensive work
- Use streaming for large payloads (especially relevant for mobile clients on variable network conditions)

---

## 6. Validation Principles

### Validate at Boundaries

```
Where to validate:
├── API entry point (request body/params from the RN app)
├── Before database operations
├── External data (API responses, file uploads)
└── Environment variables (startup)
```

### Validation Library Selection

| Library | Best For |
|---------|----------|
| **Zod** | TypeScript first, inference |
| **Valibot** | Smaller bundle (tree-shakeable) |
| **ArkType** | Performance critical |
| **Yup** | Existing React/React Native form usage (e.g., paired with Formik) |

### Validation Philosophy

- Fail fast: validate early
- Be specific: clear error messages the app can actually surface to users
- Don't trust: even "internal" data, and especially anything coming from a mobile client (can be an old app version, tampered request, etc.)

---

## 7. Security Principles

### Security Checklist (Not Code)

- [ ] **Input validation**: All inputs validated
- [ ] **Parameterized queries**: No string concatenation for SQL
- [ ] **Password hashing**: bcrypt or argon2
- [ ] **JWT verification**: Always verify signature and expiry
- [ ] **Rate limiting**: Protect from abuse
- [ ] **Security headers**: Helmet.js or equivalent
- [ ] **HTTPS**: Everywhere in production
- [ ] **CORS**: Configured correctly (note: CORS is a browser concept — for a React Native app it's usually irrelevant to the app itself, but still matters if the backend also serves a web client or dashboard)
- [ ] **Secrets**: Environment variables only, never bundled into the mobile app
- [ ] **Dependencies**: Regularly audited

### Security Mindset

```
Trust nothing:
├── Query params → validate
├── Request body → validate
├── Headers → verify
├── Cookies/tokens → validate
├── File uploads → scan
└── External APIs → validate response
```

Mobile-specific note: anything shipped inside the RN app bundle (API keys, endpoints) is extractable by a determined user. Sensitive secrets belong on the backend, not the client.

---

## 8. Testing Principles

### Test Strategy Selection

| Type | Purpose | Tools |
|------|---------|-------|
| **Unit** | Business logic | node:test, Vitest |
| **Integration** | API endpoints | Supertest |
| **E2E** | Full flows | Playwright, or a scripted flow that mimics real RN app calls |

### What to Test (Priorities)

1. **Critical paths**: Auth, payments, core business
2. **Edge cases**: Empty inputs, boundaries
3. **Error handling**: What happens when things fail — and does the app actually get a shape it can parse?
4. **Not worth testing**: Framework code, trivial getters

### Built-in Test Runner

```
node --test src/**/*.test.ts
├── No external dependency
├── Good coverage reporting
└── Watch mode available
```

---

## 9. Anti-Patterns to Avoid

### ❌ DON'T:
- Redesign an existing, working backend's architecture without being asked
- Change response/error shapes without checking what the RN app expects
- Use sync methods in production code
- Put business logic in controllers
- Skip input validation
- Hardcode secrets (including inside the mobile app bundle)
- Trust external/client data without validation
- Block the event loop with CPU work

### ✅ DO:
- Map the existing backend and its contract with the app before changing anything
- Choose framework/architecture based on context (and only for new work)
- Ask the user for preferences when unclear
- Use layered architecture for growing projects — matching existing conventions if they exist
- Validate all inputs
- Use environment variables for secrets
- Profile before optimizing

---

## 10. Decision Checklist

Before implementing anything on an existing backend:

- [ ] **Have I mapped what the backend currently does?** (Phase 0.1)
- [ ] **Have I mapped how the RN app actually calls it — requests, responses, errors, auth?** (Phase 0.2)
- [ ] **Have I confirmed my understanding with the user before proposing changes?**
- [ ] **Does my proposed change break any existing contract the app relies on?**
- [ ] **Asked the user about stack/architecture preference for anything new?**
- [ ] **Considered deployment target and app-store release lag for breaking changes?**
- [ ] **Planned error handling that matches what the app already expects?**
- [ ] **Identified validation points?**
- [ ] **Considered security requirements, including mobile-specific ones?**

---

> **Remember**: Node.js backend work is about decision-making grounded in the actual system in front of you — not memorized patterns, and not a fresh redesign nobody asked for. Understand first, then act.
