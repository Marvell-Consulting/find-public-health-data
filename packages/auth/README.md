# @fphd/auth

The session model shared by the web apps, the API apps and `@fphd/web-server`: which audience a
session is for, the fake users local sign-in offers, and the JWT cookie that carries a session
from a web app to its API.

Built package.

| Entry               | Purpose                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `.`                 | `AppAudience`, `sessionCookieName`, the fake user list and the helpers that pick roles for an audience, `normalizeReturnTo` |
| `./jwt-session`     | `createJwtSessionService` issues and verifies the session JWT; `createJwtSessionVerifier` narrows it to the verify-only shape the APIs need |
| `./cookies`         | `readCookie`, the one cookie parser both sides use                                          |
| `./session-errors`  | `InvalidJwtSessionError`, thrown by verification and mapped to a cleared cookie by callers  |

Sessions are stateless: nothing is stored server-side, so a session ends when its cookie expires
or is cleared.
