# MMP-006 — Build and run the local demo stack

- **Status:** Blocked
- **Priority / size:** P0 / S
- **Outcome:** A clean checkout can bring up PostgreSQL, API, and web together in clearly labeled demo mode.

## Dependencies and unblock condition

Docker Desktop Linux engine must be running. The current environment reports that its Docker named pipe is unavailable.

Docker Desktop was launched, but the backend did not expose a working engine. Starting the `com.docker.service` Windows service was denied by the current session's permissions. The application images and Compose stack remain unverified.

## Acceptance criteria

- [ ] `docker compose build` succeeds for API and web images.
- [ ] `docker compose up` starts the database, API, and web services healthy.
- [ ] Dashboard is reachable at `http://localhost:8080` and shows demo mode.
- [ ] A checkout can be created and demo-confirmed from the browser.

## Next action

Have a Windows session with permission to start the Docker Desktop service bring up the Linux engine, then run the acceptance steps and record any runtime fixes here.
