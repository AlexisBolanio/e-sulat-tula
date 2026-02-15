# Poetic Threads – Database Setup

## Schema Overview

| Table | Purpose |
|-------|---------|
| **users** | Accounts, roles (user/admin) |
| **themes** | Poem topics/titles, created by users |
| **stanzas** | Poem content; status: pending/approved/rejected |
| **user_daily_limits** | Daily limits and back-to-back rules |

## Apply schema

### Fresh install
```bash
mysql -u root -p esulattula_db < database/poetic_threads_schema.sql
```

### Existing database
```bash
mysql -u root -p esulattula_db < database/migration_existing_db.sql
```
If you use `tema` instead of `themes`, edit the migration and change `REFERENCES themes(id)` to `REFERENCES tema(id)` in the `stanzas` table.

## Business rules (handled by the server)

- **3 stanzas per day** – Each user limited to 3 stanzas per day.
- **No back-to-back** – Same user cannot submit two stanzas in a row for the same theme.
- **20 stanzas per page** – Pagination in `GET /stanzas`.
- **Moderation** – New stanzas are `pending`; only `approved` stanzas are shown publicly.
- **Daily reset** – `stanzas_written_today` is reset automatically when the day changes.
