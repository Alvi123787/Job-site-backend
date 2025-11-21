Backend API (Express + MongoDB)

Setup
- Create `.env` in `backend/` with `MONGODB_URI` and optional `PORT`.
- Install deps: `npm install` in `backend/`.
- Run dev: `npm run dev` or start: `npm start`.

Environment
- `MONGODB_URI` example: `mongodb+srv://user:pass@cluster.mongodb.net/jobsite`.
- Email (Nodemailer):
  - `ADMIN_EMAIL` or `EMAIL_USER` – sender email (e.g. your Gmail)
  - `ADMIN_PASS` or `EMAIL_PASS` – app password or SMTP password
  - Optional: `FRONTEND_BASE` – base URL for links (default `http://localhost:5174`)
    - Job details: `${FRONTEND_BASE}/jobs/:id`
    - Blog details: `${FRONTEND_BASE}/blog/:id`
  - Structured Data (Schema.org):
    - `SITE_NAME` – site or organization display name
    - `SITE_URL` – canonical site URL (e.g., `https://example.com`)
    - `SITE_LOGO` – absolute URL to logo image
    - These are used to populate `hiringOrganization` and canonical `url` in JobPosting JSON-LD.

Routes
- `GET /` – health check.
- `POST /api/contact` – existing contact form.
- `GET /api/jobs` – list all jobs.
- `POST /api/jobs` – create job.
- `GET /api/jobs/:id` – get a job.
- `PUT /api/jobs/:id` – update a job.
- `DELETE /api/jobs/:id` – delete a job.
- `POST /api/subscribe` – subscribe to newsletters (alias of `/api/subscriptions`).
  - Request JSON: `{ email, country?, type? }`, where `type` is `'job'` or `'blog'` (`'job'` default)
  - Response JSON: `{ success: true, message, subscriber }`
- `POST /api/subscriptions` – subscribe (plural path).
- `POST /api/subscriptions/unsubscribe` – unsubscribe.

Job payload (JSON)
```
{
  "title": "Full Stack Developer",
  "company": "Company Inc",
  "companyLogo": "data:image/png;base64,...",
  "category": "Software Development",
  "jobType": "Full-Time",
  "workMode": "On-site",
  "featured": false,
  "country": "United States",
  "city": "New York",
  "state": "NY",
  "address": "123 Corporate Ave",
  "remote": false,
  "shortDescription": "Short blurb",
  "longDescription": "Full description...",
  "skills": ["React", "Node.js"],
  "experience": "3–5 years",
  "education": "Bachelor’s",
  "employmentLevel": "Mid",
  "salaryMin": 60000,
  "salaryMax": 90000,
  "currency": "USD",
  "salaryPer": "Year",
  "benefits": "Healthcare, 401k",
  "deadline": "2025-12-31",
  "postingDate": "2025-11-06",
  "apply": "https://company.com/apply",
  "website": "https://company.com",
  "tags": ["Full Stack", "JavaScript"]
}
```

Examples
- Create a job:
```
curl -X POST http://localhost:5000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"title":"Full Stack Developer","company":"Company Inc","category":"Software Development","jobType":"Full-Time","workMode":"On-site","country":"United States","city":"New York","state":"NY","shortDescription":"Short","longDescription":"Long","experience":"3–5 years","employmentLevel":"Mid","apply":"jobs@company.com"}'
```
- List jobs: `curl http://localhost:5000/api/jobs`
- Get job: `curl http://localhost:5000/api/jobs/<id>`
- Update job: `curl -X PUT http://localhost:5000/api/jobs/<id> -H "Content-Type: application/json" -d '{"featured":true}'`
- Delete job: `curl -X DELETE http://localhost:5000/api/jobs/<id>`

Schema.org JSON-LD (Jobs)
- Backend automatically generates `schemaJsonLd` for each job on create/update.
- Frontend `JobDetail` injects the JSON-LD into `<head>` via a script tag.
- Admin UI: keep sending the regular job payload; no extra fields required.

Validation & Tests
- After creating a job, open the job detail page normally and view page source; ensure a `<script type="application/ld+json">` exists with JobPosting JSON-LD.
- Validate a job URL using Google Rich Results Test: `https://search.google.com/test/rich-results`.
- Local quick check:
  - Run `npm run test:schema` in `backend/` to validate `buildJobJsonLd` output structure.

Logging & Fallback
- If JSON-LD generation fails, creation continues and `schemaJsonLd` is set to `null`. Errors are logged with `console.warn`.
- Currency uses ISO 4217 (e.g. `USD`, `PKR`). If missing, defaults to `PKR`.

Deployment Notes
- Ensure job pages are crawlable (no `robots.txt` blocks) and included in your sitemap if available.
- Set `SITE_NAME`, `SITE_URL`, `SITE_LOGO` in production `.env` for correct schema metadata.
Examples
- Subscribe to Job Alerts:
```
curl -X POST http://localhost:5000/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","type":"job"}'
```
- Subscribe to Blog Alerts:
```
curl -X POST http://localhost:5000/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","type":"blog"}'
```