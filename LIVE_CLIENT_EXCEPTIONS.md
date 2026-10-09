# Live Client Exception — iCal Scheduler

This client intentionally uses a different iCal scheduler/authentication implementation from the current master template.

The live client's existing iCal implementation has been tested and confirmed working, including:

- Automatic scheduled execution
- HTTP 200 responses
- Airbnb calendar synchronization
- Vrbo calendar synchronization
- `last_error = null`
- Manual Admin Sync All functionality

## Important

Do **not** automatically replace, overwrite, or refactor this client's iCal scheduler/authentication implementation to match the master template.

The current implementation should be treated as a **legacy production exception** and left unchanged unless there is a specific operational reason to migrate it.

All new client deployments should use the current master-template iCal implementation.

If this live client is ever migrated to the master architecture, the migration must be performed deliberately and verified end-to-end before removing the existing working implementation.