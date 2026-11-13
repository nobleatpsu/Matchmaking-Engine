# Authentication & roles

## Sign-in modes (`AUTH_MODE`)

### `dev` (default; local development only)
- **Live workspace:** the account menu lists the live users and you pick one. If there are no users, a setup screen creates the first administrator.
- The server **refuses to start** with `NODE_ENV=production` in this mode unless `ALLOW_DEV_AUTH=1`. Use that only for a private test box.

### `header` (production)
The app sits behind a reverse proxy that handles university sign-in (Penn State WebAccess / Azure AD via **oauth2-proxy**, **Azure AD Application Proxy**, a **Shibboleth SP**, …). The proxy forwards the signed-in user's email in a header.

| Variable | Default | Meaning |
|---|---|---|
| `AUTH_HEADER` | `x-remote-user` | Header carrying the user's email |
| `AUTH_PROXY_SECRET` | — | If set, the proxy must also send `x-proxy-secret: <value>`. **Strongly recommended**: it stops anyone who can reach the app directly from forging the header |
| `ADMIN_EMAILS` | — | Comma-separated. These people become admins on first sign-in |
| `AUTO_PROVISION_ROLE` | — (deny) | Role for unknown but authenticated users: `viewer` or `staff`. Leave empty to require an admin to add people |

Optional: `x-remote-name` sets the display name for auto-provisioned users.

A user who is authenticated but has no active account sees *"You don't have access yet"*. Deactivating someone in Admin → Users takes effect on their next request.

Example nginx + oauth2-proxy setup: [deployment.md](deployment.md#behind-university-sso).

### Demo workspace
Always uses fictional personas picked from the account menu. In `header` mode, the caller still has to get through SSO to reach the server.

### API keys (scripts)
`Authorization: Bearer psrp_<workspace>_…`. Keys are created in Admin → API keys or with `npm run apikey`. Only a SHA-256 hash is stored, each key is scoped to one workspace, and keys act as **staff** (or **viewer**). Use one key per script so you can revoke them individually. `last_used_at` shows activity.

## Roles

| | viewer | staff | reviewer | admin |
|---|:-:|:-:|:-:|:-:|
| Read everything in the workspace | ✓ | ✓ | ✓ | ✓ |
| Leave feedback, read own notifications | ✓ | ✓ | ✓ | ✓ |
| Run matches | ✓ | ✓ | ✓ | ✓ |
| Save searches, shortlist, notes, tasks | | ✓ | ✓ | ✓ |
| Create / edit opportunities, companies, faculty, research records | | ✓ | ✓ | ✓ |
| Send to review, draft and record introductions | | ✓ | ✓ | ✓ |
| Import CSV, use the ingestion API | | ✓ | ✓ | ✓ |
| **Approve / reject / request changes on reviews** | | | ✓ | ✓ |
| Merge duplicate companies | | | ✓ | ✓ |
| Users, departments, data sources, API keys, sync, audit log, exports | | | | ✓ |

Defined in `shared/roles.ts` (`WRITE_ROLE`, `DELETE_ROLE`). The server checks every write against them. The UI hides or disables what you can't do.

Nothing is hard-deleted except searches, shortlists, tasks, research records (staff), companies (reviewer, for merges) and faculty (admin). Reviews, opportunities and activity history are never deleted.

## Audit

Every write is appended to the workspace's `audit` table with the actor (user id, `apikey:<name>`, `cli:…` or `system`), a kind (`tx`, `ingest`, `sign-in`, `bootstrap`, …) and a summary. Admins can read it in Admin → Audit log or via `GET /api/w/{ws}/audit`.
