<!-- Auto-generated guidance for AI coding agents working on this repo -->
# Copilot instructions — cafe-inventory/backend

Purpose: short, actionable notes for AI agents to be immediately productive editing the backend.

Big picture
- This folder implements a small Express-based HTTP API backed by a local SQLite file (`inventory.db`). See [server.js](server.js) and [db.js](db.js).
- Responsibilities:
  - `server.js`: HTTP routes, input validation, API behavior and business logic (inventory operations, analytics).
  - `db.js`: single-file SQLite schema; tables `items` and `operations` are created on startup.

How to run (discoverable from files)
- Install deps: `npm install` in the `backend` folder.
- Run server: `node server.js` (the project has no `start` script in `package.json`). The server listens on port 5000.
- DB: `db.js` opens `./inventory.db` relative to the backend folder; schema is created automatically on first run.

API surface and important behaviors (use these examples when changing handlers)
- `GET /items` — returns all `items` with computed `total_cost` and `percentage` fields.
- `POST /items` — inserts into `items`, then inserts an `operations` row using `this.lastID` (note: uses a regular function to access `this`).
- `PUT /items/:id` — updates item fields and records an `operations` entry of type `edit`.
- `DELETE /items/:id` — deletes item after verifying existence and logs a `delete` operation.
- `POST /items/:id/inbound` and `/outbound` — adjust `current_quantity` and log `inbound`/`outbound` operations; `outbound` checks stock before decrement.
- `GET /operations` — returns operations ordered by `date DESC`.
- `GET /analytics` — computes totals by `category` and a `lowStock` list using `max_quantity` and `current_quantity`.

Data conventions and patterns
- `items.category` uses string values: typically `product` or `consumable` (see `analytics` filter).
- `operations.type` is one of: `add`, `edit`, `delete`, `inbound`, `outbound`.
- SQL parameterization uses `?` placeholders; preserve parameter order when editing queries.
- `db.js` uses `sqlite3` with `serialize()`; multiple sequential `db.run()` calls rely on that ordering.

Common pitfalls and gotchas
- There is no migration system: changing the `db.js` schema will NOT migrate existing `inventory.db` files. Consider manual migration when altering columns.
- `POST /items` relies on `function (err) { ... }` to access `this.lastID`. Converting that callback to an arrow function will break `this.lastID` access.
- Input validation is minimal and localized in route handlers; adding stricter validation should preserve current error responses (JSON with `error` key).
- Some comments and error messages are in Russian — be mindful when editing messages returned to clients.

Editing guidance for agents
- When adding/changing endpoints, update both the route handler in `server.js` and any SQL in `db.js` if schema changes are needed.
- If you modify the DB schema, add a short comment in `db.js` explaining migration implications and update this file.
- Keep changes small and test locally with `node server.js` and simple `curl` or Postman requests; verify `inventory.db` contents using `sqlite3` CLI if needed.

Developer commands (quick reference)
```bash
cd backend
npm install
node server.js
# Then exercise endpoints e.g.:
curl http://localhost:5000/items
```

If anything here is unclear or you'd like more detail (tests, CI, or a start script), ask and I'll iterate.
