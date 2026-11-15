# Coding in Color read API

The read API supplies aggregate class, cohort and program progress to the Coding in Color organization dashboard. All routes are read-only, require an active bearer key and return JSON with `Cache-Control: no-store`. Responses contain aggregate values only; they never contain student names, IDs or student-level rows.

Create and revoke keys as an admin at `/admin/api-keys`. A new key is shown once. Store it in the consuming service's secret manager; never put it in source control or a browser app. The database stores only its SHA-256 hash.

## Authentication and dates

Send the key in the `Authorization` header:

```http
Authorization: Bearer <key>
```

All three endpoints accept optional `from` and `to` query parameters in `YYYY-MM-DD` format. Dates are inclusive and interpreted in UTC. They filter activity submissions by `submitted_at` and test results by `taken_at`. If a date range is supplied, a learning-gain pair is included only when both test results fall within the selected range. Invalid dates or a `from` date after `to` return `400`.

Missing, unknown or revoked keys return `401`:

```json
{ "error": "A valid bearer key is required." }
```

## `GET /api/v1/cohorts`

Returns one aggregate row per cohort. `students_with_both_tests` is the number of distinct students with at least one pre/post pair. Averages use available paired student-module tests; `completion_pct` is completed assigned modules divided by assigned module slots.

```json
{
  "cohorts": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "name": "AI Academy – Maryvale – Fall 2026",
      "program": "AI Academy",
      "school": "Maryvale",
      "term": "Fall 2026",
      "students": 10,
      "completion_pct": 20,
      "avg_pre": 67.5,
      "avg_post": 85,
      "avg_gain": 17.5,
      "students_with_both_tests": 2
    }
  ]
}
```

## `GET /api/v1/classes/{id}/summary`

Returns aggregate progress for each module assigned to the class. `stuck_count` counts students whose current module is this module and who have had no activity for three or more days.

```json
{
  "class_id": "00000000-0000-4000-8000-000000000002",
  "modules": [
    {
      "module_id": "00000000-0000-4000-8000-000000000003",
      "title": "Intro to Loops in Python",
      "completion_pct": 20,
      "avg_pre": 67.5,
      "avg_post": 85,
      "avg_gain": 17.5,
      "stuck_count": 3
    }
  ]
}
```

An invalid class UUID returns `400`; a valid UUID for a class that does not exist returns `404`.

## `GET /api/v1/programs`

Returns one aggregate row for each supported program: AI Academy, K12, Summer Camp and Day of Compute. `students` totals are disjoint across these programs and sum to the number of enrolled students.

```json
{
  "programs": [
    {
      "program": "AI Academy",
      "cohorts": 1,
      "classes": 1,
      "students": 10,
      "completion_pct": 20,
      "avg_pre": 67.5,
      "avg_post": 85,
      "avg_gain": 17.5,
      "students_with_both_tests": 2
    },
    {
      "program": "K12",
      "cohorts": 0,
      "classes": 0,
      "students": 0,
      "completion_pct": 0,
      "avg_pre": null,
      "avg_post": null,
      "avg_gain": null,
      "students_with_both_tests": 0
    }
  ]
}
```

## Curl examples

Keep `CIC_API_KEY` in a local shell environment or secret manager. Do not paste a real key into a script or commit it.

```sh
curl --fail-with-body \
  -H "Authorization: Bearer $CIC_API_KEY" \
  "http://localhost:3000/api/v1/cohorts"

curl --fail-with-body \
  -H "Authorization: Bearer $CIC_API_KEY" \
  "http://localhost:3000/api/v1/classes/00000000-0000-4000-8000-000000000002/summary?from=2026-11-01&to=2026-11-15"

curl --fail-with-body \
  -H "Authorization: Bearer $CIC_API_KEY" \
  "http://localhost:3000/api/v1/programs"
```

If the key is revoked, these calls return `401`. The routes use the server-only Supabase service-role client after checking the stored key hash. Reports use the `learning_gain` and `class_module_summary` views where no date filter is set, and the shared progress rules for completion and stuck counts.
