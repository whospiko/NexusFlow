# ⚡ Lightweight Bug/Issue Tracker (PERN Stack)

> **Interview-Grade Architecture Showcase**: Demonstrating relational data associations (`Projects` ➔ `Issues` ➔ `Comments`), raw PostgreSQL query aggregation (No ORM), RESTful resource nesting, and strict backend state-machine lifecycle enforcement.

---

## 🛠️ Tech Stack & Constraints

- **Database**: PostgreSQL (Raw SQL with `pg.Pool`, parameterized queries `$1, $2`, no ORM)
- **Backend**: Node.js + Express (ES Modules, JWT sessions, Nodemailer Gmail transport, multi-tenancy access control)
- **Frontend**: React 18 + Vite + React Router v6 + Tailwind CSS (Authentic Jira Software UI Design) + Lucide Icons + Native Drag & Drop Kanban + Zero Raw CSS
- **Authentication**: OAuth 2.0 (Google & GitHub) + JWT + 1-Click Fast Dev Login switcher
- **Team Collaboration**: Account-isolated workspaces (Multi-Tenancy) & Gmail-based project invitations with secure token verification

---

## 🔐 Multi-Tenancy & Project Isolation Architecture

Under account-level multi-tenancy, projects are strictly isolated per account:
1. **Ownership & Access Isolation:**
   A user can **only** view and access projects where they are the creator (`p.owner_id = $userId`) OR an invited member (`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $userId)`).
2. **Gmail-Based Team Invitations:**
   - The project owner or admin triggers an invitation via the Jira project header (`+ Invite`).
   - The system generates a cryptographic 32-byte hex token with a 7-day expiration.
   - An HTML invitation email is dispatched via Gmail SMTP (`Nodemailer`) with a direct acceptance link (`/invite/accept?token=...`).
   - In development environments without Gmail SMTP credentials, the server automatically provides a direct dev-mode preview link in terminal and API responses.
   - Upon clicking "Accept", the user is registered into `project_members`, gaining immediate access to the project board.

---

## 📐 Relational Data Model (PostgreSQL)

```
[users] (1) ───────────<owns>───────────< (N) [projects] (1) ────┬────<has many>────< (N) [issues] (1) ────┬────<has many>────< (N) [comments]
    id (PK)                                      id (PK)         │                        id (PK)         │                        id (PK)
    email (UNIQUE)                               owner_id (FK)   │                        project_id (FK) │                        issue_id (FK)
    name                                         name            │                        title           │                        author
    avatar_url                                   description     │                        description     │                        content
    provider ('google','github','local')         created_at      │                        priority        │                        created_at
    created_at                                                   │                        status          │
                                                                 │                        creator         ├────<has many>────< (N) [issue_activities]
[project_members] (Junction)                                     │                        assignee        │                        id (PK)
    project_id (PK, FK)                                          │                        created_at      │                        issue_id (FK)
    user_id (PK, FK)                                             │                                        │                        actor, action_type
    role ('owner','admin','member')                              │                                        │
    joined_at                                                    ├────<has many>────< (N) [project_invitations]
                                                                 │                        id (PK)
                                                                 │                        project_id (FK)
                                                                 │                        inviter_id (FK)
                                                                 │                        invitee_email, token (UNIQUE)
                                                                 │                        status, expires_at
                                                                 │
                                                                 └────<many to many>────< [tags] via [issue_tags]
```

### 1. Cascading Foreign Keys
```sql
ALTER TABLE issues 
  ADD CONSTRAINT fk_project 
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE comments 
  ADD CONSTRAINT fk_issue 
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE;

ALTER TABLE issue_activities 
  ADD CONSTRAINT fk_issue_activity 
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE;
```
*Deleting a project cleanly cascades down and purges all related issues and their comments at the database engine level.*

### 2. SQL JOIN & Many-to-Many Aggregation (No ORM overhead)
To avoid the notorious $N+1$ query trap common with naive ORMs, comment counts and many-to-many tags are computed in a single pass via SQL `LEFT JOIN`, `GROUP BY`, and PostgreSQL's native `json_agg`:
```sql
SELECT 
  i.id,
  i.title,
  i.priority,
  i.status,
  i.assignee,
  i.created_at,
  p.name AS project_name,
  COUNT(DISTINCT c.id)::INT AS comment_count,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color)
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'
  ) AS tags
FROM issues i
JOIN projects p ON i.project_id = p.id
LEFT JOIN comments c ON i.id = c.issue_id
LEFT JOIN issue_tags it ON i.id = it.issue_id
LEFT JOIN tags t ON it.tag_id = t.id
WHERE i.project_id = $1
GROUP BY i.id, p.name
ORDER BY i.created_at DESC;
```

---

## 🚦 Business Constraint: Workflow State Machine

An issue follows a strict software lifecycle validated on the backend:

```
  [ open ] ───────────► [ in-progress ] ───────────► [ resolved ]
      │                         │                          │
      │                         ▼                          ▼
      └──────────────────► [ closed ] ◄────────────────────┘
                                │
                                ▼
                       [ in-progress (reopened) ]
```

### Allowed Transitions Matrix:
| From State | Allowed Target States | Disallowed / Forbidden Leaps |
|---|---|---|
| `open` | `in-progress`, `closed` | `resolved` (must be actively worked on first) |
| `in-progress` | `resolved`, `open`, `closed` | — |
| `resolved` | `closed`, `in-progress` (rework/failed QA) | **`open`** ❌ *(Resolved issues cannot jump straight to open)* |
| `closed` | `in-progress` (reopened) | `open`, `resolved` |

*When an illegal transition is attempted (e.g. `resolved ➔ open`), the API intercepts the request and responds with **HTTP 422 Unprocessable Entity**:*
```json
{
  "success": false,
  "code": "INVALID_STATE_TRANSITION",
  "message": "Invalid state transition! An issue in 'resolved' state cannot jump directly to 'open'. Valid target states are: [closed, in-progress]."
}
```

---

## 📁 Project Structure

```
demo1/
├── Backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                 # PostgreSQL pg.Pool connection manager
│   │   ├── constants/
│   │   │   └── stateMachine.js       # Finite state machine transition definitions
│   │   ├── controllers/
│   │   │   ├── projectController.js  # Project CRUD & stats aggregation
│   │   │   ├── issueController.js    # Issue CRUD, filtering & status transition
│   │   │   └── commentController.js  # Comment CRUD under issues
│   │   ├── db/
│   │   │   ├── schema.sql            # Table definitions, constraints, indexes
│   │   │   ├── seed.sql              # Realistic seed demo data
│   │   │   └── init.js               # CLI runner to apply schema + seed
│   │   ├── middleware/
│   │   │   └── errorHandler.js       # Centralized error handler & DB error codes
│   │   ├── routes/
│   │   │   ├── projectRoutes.js      # /api/projects & nested /:projectId/issues
│   │   │   ├── issueRoutes.js        # /api/issues & nested /:issueId/comments
│   │   │   └── commentRoutes.js      # /api/comments
│   │   └── server.js                 # Express bootstrap & middleware configuration
│   ├── .env.example
│   └── package.json
│
└── Frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── StatusBadge.jsx
    │   │   ├── PriorityBadge.jsx
    │   │   ├── StateTransitionControl.jsx # Interactive state machine & rejection test
    │   │   ├── CreateIssueModal.jsx       # Controlled issue form
    │   │   └── CreateProjectModal.jsx     # Controlled project form
    │   ├── pages/
    │   │   ├── ProjectsPage.jsx           # Project workspaces & aggregated counters
    │   │   ├── ProjectDetailPage.jsx      # Issues list, status/priority filters & search
    │   │   └── IssueDetailPage.jsx        # Issue view, comments thread & state transition
    │   ├── services/
    │   │   └── api.js                     # Unified fetch client with proxy
    │   ├── App.jsx                        # React Router DOM configuration
    │   ├── index.css                      # Modern dark theme design system
    │   └── main.jsx
    ├── index.html
    ├── vite.config.js                     # Vite dev server + proxy to port 5000
    └── package.json
```

---

## 🚀 Getting Started

### 1. Database Configuration
Edit [Backend/.env](file:///e:/A-Project/demo1/Backend/.env):
```env
PORT=5050
DATABASE_URL=postgres://piko:ruppcsd2025@localhost:5432/bug_tracker
NODE_ENV=development
```
*(You can also use a free cloud Postgres instance from Neon, Supabase, or Render).*

### 2. Initialize Database Tables & Seed Data
Inside `Backend`:
```powershell
cd Backend
npm run db:init
```

### 3. Start Backend Server (Port 5050)
```powershell
cd Backend
npm run dev
```

### 4. Start Frontend Client (Port 3000)
```powershell
cd Frontend
npm run dev
```
Open **http://localhost:3000** in your browser.

---

## 🎯 Key Interview Talking Points

1. **Why Pure SQL instead of an ORM?**
   - Precise control over SQL execution plan (`EXPLAIN ANALYZE`).
   - Clean aggregations (`COUNT(c.id)`, conditional counts `COUNT(CASE WHEN ...)`) without relying on bulky subqueries or in-memory array filtering.
   - Elimination of the $N+1$ query problem while maintaining minimal memory footprint.

2. **Backend State Machine vs Client-side Guards:**
   - Client-side buttons guide standard user journeys, but the **backend is the single source of truth**.
   - Direct API calls or race conditions attempting illegal state jumps (e.g. jumping straight from `resolved` to `open`) are blocked at the controller layer and returned as `422 Unprocessable Entity`.

3. **RESTful Resource Nesting:**
   - Hierarchy reflects real domain relationships:
     - `GET /api/projects/:projectId/issues`
     - `POST /api/projects/:projectId/issues`
     - `POST /api/issues/:issueId/comments`
   - Top-level endpoints (`GET /api/issues/:id`, `DELETE /api/comments/:id`) exist for direct resource manipulation when full parent context is redundant.

