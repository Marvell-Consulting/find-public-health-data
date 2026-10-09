# Route budgets

`pnpm check:perf` requests a set of read-only routes across the four apps on the seeded stack and
checks, for each, how much work one request costs and how long requests take. CI runs it in the
`Route budgets` job on every pull request, beside e2e and against the same production images.

The routes are in [`src/routes.ts`](src/routes.ts): the common pages of both web apps and the
heaviest API queries behind them, such as GP-practice ranges and multi-area data for the largest
indicator in the seed. Internal routes are requested as the fake admin user.

## What is measured

For one request to each route, after warm-up requests:

| Metric       | Source                                                          |
| ------------ | --------------------------------------------------------------- |
| `statements` | SQL statements the APIs executed (`pg_stat_statements.calls`)   |
| `buffers`    | 8 kB pages those statements touched, cached or read from disk   |
| `rows`       | Rows those statements returned or affected                      |
| `bytes`      | Decoded response body size                                      |

Only statements run by the `public_api` and `internal_api` roles count, so the script's own
queries never do. These are counts, not timings, so they do not move with runner load. To keep them
the same from run to run, the CI database (`compose.perf.yaml`) preloads `pg_stat_statements`,
turns off parallel query and autovacuum, and the script runs `VACUUM ANALYZE` before measuring.

Each route's numbers are compared with [`baseline.json`](baseline.json). A route fails when a
metric exceeds its allowance:

| Metric       | Allowance                     |
| ------------ | ----------------------------- |
| `statements` | the baseline, exactly         |
| `buffers`    | 1.2 × the baseline, plus 20   |
| `rows`       | 1.2 × the baseline, plus 20   |
| `bytes`      | 1.1 × the baseline, plus 1 kB |

One extra statement per request fails outright, because that is how an N+1 query shows itself.
The other allowances absorb small legitimate changes while catching a missing index, an unbounded
result set or a page that has grown much heavier. The tolerances are `TOLERANCES` in
[`src/budget.ts`](src/budget.ts). A route missing from the baseline, or a baseline entry no longer
measured, also fails. A metric well under its baseline passes with a note that the baseline could
be tightened.

## Time limits

Each route is then requested 15 times in sequence. The median fails the route if it exceeds the
route's `limitMs`: 250 ms for an API route, 500 ms for a page, and 1 s for the comparison page
and the CSV downloads. When they were set, CI's medians were 1–30 ms for the APIs and 8–139 ms
for the pages. The limits are 5–10 times that on purpose, because hosted runners vary a lot from
run to run: they catch a route that has become clearly slow, not a small slowdown. The counts
above are what catch the small ones. Median and p95 for every route are in the job summary.

## Accepting a change

When a change is meant to cost more, the failing run's summary gives the command to adopt its
numbers:

```sh
pnpm perf:accept <run-id>
```

It downloads the run's `perf-baseline` artifact with the GitHub CLI and updates `baseline.json`
from it, taking only what the run failed on: routes over their allowance on any metric, routes new
to the run, and routes it no longer measures, which are removed. Every other route keeps its
committed numbers, so small drift on passing routes is never adopted and the baseline does not
creep upwards. The command lists the routes it updated, added and removed. Commit the result, and
the diff shows the reviewer exactly which routes cost more.

To take every route's numbers from the run instead, add `--all`:

```sh
pnpm perf:accept <run-id> --all
```

Use it to tighten the baseline after an improvement, which the summary lists under "Could be
tightened", or after a change to the seed data moves every route. It also takes any routes over
budget in that run.

The routes are chosen by comparing the run with your `baseline.json`, so it must be the one CI
checked against. Bring the branch up to date with `main` before the run you accept, and accept it
from the commit it measured: the command refuses when `HEAD` is a different commit. Every run that
measures all the routes uploads the artifact, within budget or not. A run that stops on a route
error writes none, as it has no complete set of numbers to adopt. The artifact holds counts only: a
route meant to be slower needs its `limitMs` raised in [`src/routes.ts`](src/routes.ts).

## Running it locally

The numbers depend on the production build and the database settings above, so the baseline should
come from CI. To run the check locally anyway, build the images (`docker buildx bake -f
docker/docker-bake.hcl --load`), start the stack with the same three compose files as the CI job,
seed it, then run `pnpm check:perf` with the database connection in the environment
(`POSTGRES_PASSWORD`, and `DB_HOST`, `DB_PORT`, `POSTGRES_DB`, `POSTGRES_USER` if they differ from
the defaults). The compose database is the development one, so this replaces your local data.
