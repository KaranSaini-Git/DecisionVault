# DecisionVault

DecisionVault is a decision intelligence workspace for capturing, evaluating, reviewing, discussing, and preserving organizational decisions.

The platform provides a centralized workflow for creating decisions, comparing alternatives, attaching supporting evidence, routing decisions through role-based approvals, maintaining discussion history, and preserving an auditable record of how decisions move from draft to final outcome.

## Live Application

https://decision-vault-ks.vercel.app/dashboard

## Core Capabilities

- Decision management with lifecycle states: Draft, Under Review, Approved, Rejected, and Archived
- Role-based authentication with Employee, Reviewer, Manager, and Administrator roles
- Multi-stage approval workflow with Level 1 reviewer approval followed by Level 2 manager approval
- Reviewer and manager notifications for pending approval actions
- Alternative analysis with pros, cons, cost, feasibility, and risk
- Supporting document uploads with Supabase Storage-backed file persistence
- Decision discussions with comments, meeting notes, rationale, replies, and attachments
- Team creation, membership management, roles, and contribution tracking
- Knowledge repository and interactive knowledge graph based on stored decision relationships
- Workspace notifications and activity history
- Audit and compliance records
- Analytics and reporting views for management and administrative users
- Responsive workspace interface with shared navigation and role-aware views

## Application Workflow

A typical decision moves through the following lifecycle:

```text
Employee / Manager / Administrator
            |
            v
         Create
            |
      +-----+------+
      |            |
      v            v
    Draft      Under Review
                   |
                   v
          Level 1 Reviewer
              /       \
             /         \
        Rejected      Approved
            |             |
            v             v
         Rejected   Level 2 Manager
                         /    \
                        /      \
                   Rejected   Approved
                       |          |
                       v          v
                    Rejected   Approved
```

Saving a decision as Draft does not start the approval workflow. Posting a decision for review changes it to Under Review and creates the initial approval request. Reviewer approval escalates the decision to the next manager approval stage. Final manager approval changes the decision to Approved.

## Role Model

| Role | Primary responsibilities |
| --- | --- |
| Employee | Create decisions, contribute to discussions, attach evidence, and track decision progress |
| Reviewer | Perform Level 1 reviews and approve or reject submitted decisions |
| Manager | Perform Level 2 final approvals and manage team-level decision workflows |
| Administrator | Manage workspace-level users and configuration and oversee organizational activity |

## Technology Stack

### Frontend

- React 19
- Vite 8
- React Router 7
- lucide-react
- CSS-based component styling

### Backend

- Node.js
- Express 5
- JWT authentication
- bcrypt password hashing
- Multer multipart file uploads
- CORS

### Data and Storage

- PostgreSQL
- Prisma 7
- Supabase Storage for private document storage

## Repository Structure

```text
DecisionVault/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── controllers/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── services/
│   ├── uploads/
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   └── styles/
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
│
└── README.md
```

## Authentication

The application uses JWT-based authentication.

Passwords are hashed using bcrypt before being stored. Public registration creates Employee accounts only; privileged roles should be assigned through administrative or controlled database workflows.

Authentication tokens are issued by the backend after successful login and are required for protected API operations.

## Demo Credentials

The repository includes a demo seed configuration with four role-based accounts. These credentials are intended for local development, demonstrations, testing, or evaluation environments.

| Role | Name | Email | Password |
| --- | --- | --- | --- |
| Administrator | Alex Morgan | `admin@decisionvault.demo` | `Demo@123` |
| Manager | Maya Sharma | `manager@decisionvault.demo` | `Demo@123` |
| Reviewer | Rahul Verma | `reviewer@decisionvault.demo` | `Demo@123` |
| Employee | Karan Mehta | `employee@decisionvault.demo` | `Demo@123` |

Do not reuse these credentials for a production environment. Replace them with controlled accounts and rotate the credentials before publishing a production instance.

## Prerequisites

Before running DecisionVault locally, make sure the following services are available:

- Node.js and npm
- PostgreSQL database
- Supabase project with Storage enabled

The backend expects a PostgreSQL connection string and server-side Supabase credentials.

## Environment Configuration

### Backend

Create `backend/.env`:

```env
PORT=4000
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_long_random_jwt_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_server_side_supabase_secret_key
SUPABASE_BUCKET=decision-documents
```

`SUPABASE_SECRET_KEY` is a server-side secret and must never be exposed to the frontend.

### Frontend

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
```

For deployment, set `VITE_API_BASE_URL` to the publicly reachable backend API URL.

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/KaranSaini-Git/DecisionVault.git
cd DecisionVault
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure the backend

Create `backend/.env` using the variables shown above.

### 4. Generate the Prisma client

```bash
npm run build
```

### 5. Apply database migrations

Use the Prisma migration workflow configured for the project to apply the existing migrations to your PostgreSQL database.

```bash
npx prisma migrate deploy
```

For local development where migrations need to be created or iterated, use the appropriate Prisma migration command instead of modifying the production database directly.

### 6. Seed the demo environment

If the seed script is present in your working copy, run it using the project's configured seed command or execute the seed script directly.

The seed creates role-based demo users, teams, decisions, approval records, notifications, audit records, alternatives, discussions, and supporting demo knowledge data.

### 7. Start the backend

Development mode:

```bash
npm run dev
```

Production-style local start:

```bash
npm start
```

The backend listens on port `4000` by default.

### 8. Install frontend dependencies

Open a second terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
```

### 9. Start the frontend

```bash
npm run dev
```

Vite will start the frontend development server and provide the local URL in the terminal.

## Production Build

### Frontend

```bash
cd frontend
npm install
npm run build
npm run preview
```

The generated production assets are written to `frontend/dist`.

### Backend

```bash
cd backend
npm install
npm run build
npm start
```

The backend exposes a health endpoint at:

```text
GET /api/health
```

A healthy server responds with:

```json
{
  "status": "ok"
}
```

## Document Storage

DecisionVault stores document metadata in PostgreSQL and stores uploaded document content in Supabase Storage.

The default bucket name is:

```text
decision-documents
```

Current decision document paths follow this structure:

```text
decision-documents/
└── decisions/
    └── <decisionId>/
        └── <generated-file-name>
```

The storage bucket is intended to remain private. The backend handles authenticated document access and retrieves private files from Supabase Storage rather than exposing server-side storage credentials to the browser.

## Approval Workflow

Approval records are represented with an approval level and status.

### Level 1

A submitted decision is assigned to a Reviewer. The Reviewer can approve or reject the request.

### Level 2

After Level 1 approval, the system assigns the decision to an eligible Manager for final approval. The Manager can approve or reject the request.

### Final State

- Approved: all required approval stages are complete
- Rejected: an approver rejects the decision
- Under Review: one or more approval stages are still outstanding
- Draft: the decision has not entered the approval workflow
- Archived: the decision has been preserved as an archived record

## API Surface

The backend is organized into feature-specific Express routers and controllers.

```text
/api/auth
/api/decisions
/api/teams
/api/notifications
/api/approvals
/api/discussions
/api/knowledge
/api/analytics
/api/reports
/api/audit
/api/users
```

The exact route definitions are maintained in `backend/src/routes/`.

## Security Considerations

The project already implements several important application-level controls:

- Password hashing with bcrypt
- JWT-authenticated protected routes
- Role-aware authorization checks
- Controlled public registration for Employee accounts
- Private Supabase Storage access through the backend
- Audit logging for important actions
- Indexed PostgreSQL models for decision, approval, notification, audit, and document lookups

Before production deployment, review and harden at least the following areas:

- Rotate all demo credentials
- Use a strong, unique `JWT_SECRET`
- Store secrets only in deployment environment variables or a dedicated secret manager
- Restrict CORS to trusted production origins instead of broad development access
- Configure rate limiting and abuse protection for authentication endpoints
- Review Supabase Storage policies and bucket permissions
- Set production upload limits and content validation appropriate to your threat model
- Enforce HTTPS for all public deployments
- Review database backups, retention, and recovery procedures

## Operational Notes

The project uses Prisma with PostgreSQL and keeps the database schema under version control through Prisma migrations.

The frontend is designed for deployment on Vercel using Vite. The backend can be deployed independently on a Node-compatible hosting platform. The application is structured so the frontend communicates with the backend through `VITE_API_BASE_URL`.

## Linting and Validation

Frontend linting:

```bash
cd frontend
npm run lint
```

Frontend production build:

```bash
npm run build
```

Backend Prisma client generation:

```bash
cd backend
npm run build
```

## Current Project Status

DecisionVault currently contains the main workspace modules required for a decision management system, including decision creation, review and approval workflows, supporting evidence, discussions, teams, knowledge, notifications, audit, analytics, and reports.

## License

Add the project's chosen license here before publishing the repository publicly. If this repository is intended to remain private, omit this section.

## Maintainer

Karan Saini

GitHub: https://github.com/KaranSaini-Git/DecisionVault
