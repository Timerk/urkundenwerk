# Deploy the hosted demo

Run the following steps from the repository root on the reviewed `master`
commit. Replace each angle-bracket placeholder with your own value. Use the
public demo only with fictional data. Anyone signing in as the same demo
account shares its session privileges and can see its firm's drafts.

## 1. Create the Supabase project

Create a dedicated project in **Central EU (Frankfurt)** (`eu-central-1`)
with these options on the creation form:

| Option                                       | Setting            | Why                                                                                                        |
| -------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Connect GitHub                               | Off                | Migrations deploy through the approval-gated `deploy-db.yml` workflow, not the Supabase GitHub integration |
| Enable Data API                              | On                 | The app uses supabase-js                                                                                   |
| Grant API access to new tables automatically | Off                | Migrations revoke default privileges and grant every table explicitly                                      |
| Enable RLS on new tables automatically       | On                 | Defence in depth; migrations enable RLS anyway                                                             |
| Postgres type                                | Postgres (default) |                                                                                                            |

Save the database password in your password manager. In the project
dashboard, copy the project ref and the project URL from **Connect** or
**Project Settings**. Under **API Keys**, copy the publishable key.
Keep the Data API's exposed schemas at their defaults. The `private`
schema holds the quota counters and is for database functions only.
[Supabase regions](https://supabase.com/docs/guides/platform/regions)
and [API keys](https://supabase.com/docs/guides/api/api-keys).

## 2. Configure Supabase Auth

1. Under **Authentication → URL Configuration**, set **Site URL** to
   `https://<DEMO_HOST>` and add `https://<DEMO_HOST>` as an exact redirect
   URL. The app uses password sign-in and has no custom Auth callback.
   Keep localhost, wildcard domains, and PR preview URLs out of this list.
2. Under **Authentication → Sign In / Providers**, keep Email enabled.
   Disable public sign-ups and anonymous sign-ins. Enable **Confirm email**
   and **Secure email change**. Enable **Require current password when
   changing password** so a shared session alone cannot change the
   credential. Leave other providers and MFA enrollment disabled for this
   dedicated demo project.
3. Set the minimum password length to at least 12 and require upper- and
   lowercase letters, digits, and a symbol. Use two unique, random
   passwords of at least 24 characters, one for the operator and one
   shared by the four visitor accounts. The app's password form supports
   up to 72 characters. Use ASCII to stay within bcrypt's byte limit.

[Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls)
and [password security](https://supabase.com/docs/guides/auth/password-security).

## 3. Set up GitHub Actions and apply the migrations

1. In GitHub **Settings → Environments**, create `production`. Limit
   deployment branches to `master` and add a required reviewer. If
   preventing self-review, designate another reviewer who can approve runs.
2. Add these **environment secrets**.

   | Name                    | Where to get it                                           |
   | ----------------------- | --------------------------------------------------------- |
   | `SUPABASE_ACCESS_TOKEN` | Scoped Supabase access token for this project (see below) |
   | `SUPABASE_PROJECT_REF`  | The ref of the Frankfurt demo project                     |
   | `SUPABASE_DB_PASSWORD`  | The database password saved in step 1                     |

   Create the access token under **Account → Access Tokens** as a scoped
   token limited to this project, with these permissions: **Project
   Settings: Read-write**, **Database: Read-write**, **Connection Pooling:
   Read**, **API Keys: Read**, **API Key Secrets: Read**, **Auth Config:
   Read-write**, and **Production Branches: Read**. Give it an expiry (for
   example 30 days) and put a reminder in your calendar: the migration
   deploy and the manual reset workflow fail once it expires. The nightly
   reset runs in the database and does not use the token. Replace the GitHub secret before
   the old token expires or is revoked.

3. Open **Actions → Deploy database migrations → Run workflow** and choose
   `master`. Have the reviewer approve the deployment and wait for the run
   to succeed. Subsequent pushes to `master` that change migrations also
   queue a deploy. Confirm migrations succeed before deploying web code
   that uses them.

   The equivalent CLI commands for an authorized operator are below.
   Supply `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` in the shell
   from your password manager. Supabase reads them from the environment.

   ```sh
   pnpm install --frozen-lockfile
   pnpm exec supabase link --project-ref '<SUPABASE_PROJECT_REF>'
   pnpm exec supabase db push --remote --yes
   ```

   Use `db push` without `--include-seed`. The default seed is for the local
   Supabase stack.

[GitHub environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
and [Supabase CLI commands](https://supabase.com/docs/reference/cli/supabase-db-remote).

## 4. Provision the demo users and restore the demo firms

Deploy the migrations first (step 3). They install `pg_cron` and schedule
the nightly reset.

1. In **Authentication → Users → Add user → Create new user**, create the
   following fictional accounts with **Auto Confirm User** enabled. Use
   the password chosen in step 2 for the appropriate account. The
   addresses use the reserved `.test` domain, so no inbox is required.
   On an existing demo, add only the accounts that are missing.

   | Email                     | Role                              | Credential                 |
   | ------------------------- | --------------------------------- | -------------------------- |
   | `anna.admin@demo.test`    | Operator admin in Nord and Süd    | Separate operator password |
   | `sara.admin@demo.test`    | Visitor admin of the West sandbox | Shared demo password       |
   | `erik.editor@demo.test`   | Editor in Nord and West           | Shared demo password       |
   | `victor.viewer@demo.test` | Viewer in Nord and West           | Shared demo password       |
   | `mia.multi@demo.test`     | Editor in Nord, viewer in Süd     | Shared demo password       |

   Give Sara's account exactly the value of `DEMO_LOGIN_PASSWORD` from
   step 5. The hosted login uses it for all four visitor accounts.

2. With the access token from step 3 in your shell, run the hosted seed
   and an immediate reset. Each command targets the specified project ref.
   You can also execute each file separately in that project's SQL Editor.
   The seed is idempotent. Run it again after adding a missing account,
   for example to add Sara and the West sandbox to an existing demo.
   It stops with an error if any of the five accounts is missing or
   unconfirmed.

   ```sh
   pnpm exec supabase db query --remote='<SUPABASE_PROJECT_REF>' --file supabase/demo/seed.sql --yes
   pnpm exec supabase db query --remote='<SUPABASE_PROJECT_REF>' --file supabase/demo/reset.sql --yes
   ```

   The seed marks the four visitor accounts as demo accounts, which cannot
   create firms. It creates Demo-Kanzlei Nord, Süd, and West and their
   memberships, and sets the display names. The migrations protect all five
   accounts from deletion.

3. The database resets the demo at 02:17 UTC every night with the pg_cron
   job `reset-hosted-demo`. The job runs `private.reset_hosted_demo()` and
   needs no approval or access token. In a database without the seeded
   demo firms, it changes nothing. In Nord, Süd, and West, the reset:

   - restores the sample drafts and deletes other drafts;
   - restores the firm names and the five demo display names;
   - restores West's memberships and roles and deletes its invitations.

   It preserves Auth users, quota counters, Nord and Süd memberships, and
   other firms. It prunes audit events older than 90 days. It removes
   invitation records 90 days after expiry. For other deployments, set
   `private.app_settings.audit_retention` and schedule
   `select private.prune_audit_events();` as a database operator. See
   [ADR-0014](adr/0014-audit-log.md) and
   [ADR-0016](adr/0016-database-demo-reset.md).

   Check the most recent runs in the SQL Editor:

   ```sql
   select status, return_message, start_time
   from cron.job_run_details
   where jobid = (select jobid from cron.job where jobname = 'reset-hosted-demo')
   order by start_time desc limit 5;
   ```

   **Actions → Reset hosted demo now** runs the same reset on demand from
   `master`. Like the migration deploy, it waits for approval on
   `production` and uses the access token from step 3.

## 5. Configure and deploy the Vercel project

Connect the Git repository to **one** Vercel project for the Next.js app.
Set **Production Branch** to `master`, **Root Directory** to `apps/web`, and
enable **Include source files outside of the Root Directory in the Build
Step** so Vercel can access the workspace. Set **Node.js Version** to
`24.x`, leave **Output Directory** at the Next.js default, and enable
**Fluid Compute** for the 300-second function limit. The committed
`apps/web/vercel.json` sets the Functions region to `fra1` and runs these
commands from `apps/web`.

```sh
npx --yes pnpm@12.23.0 install --frozen-lockfile
npx --yes pnpm@12.23.0 exec next build
```

Set these variables for the **Production** environment. The hosted app
uses the same Supabase project for all visitors.

| Variable                               | Value and source                                                                                                                           | Visibility    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<SUPABASE_PROJECT_REF>.supabase.co` from step 1                                                                                   | Public        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `<SUPABASE_PUBLISHABLE_KEY>` from step 1                                                                                                   | Public        |
| `NEXT_PUBLIC_SIGNUP_ENABLED`           | `false`, matching the Supabase Auth setting                                                                                                | Public        |
| `DEMO_LOGIN_PASSWORD`                  | `<SHARED_DEMO_PASSWORD>` from step 2                                                                                                       | Server secret |
| `AI_PROVIDER`                          | `openai` to enable paid AI, or `disabled`                                                                                                  | Server only   |
| `OPENAI_API_KEY`                       | `<OPENAI_PROJECT_API_KEY>` from a dedicated OpenAI project. Required for `openai`.                                                         | Server secret |
| `AI_MODEL_EXTRACT`                     | Optional. The OpenAI default is `gpt-6.1-terra`.                                                                                           | Server only   |
| `AI_MODEL_EXPLAIN`                     | Optional. The OpenAI default is `gpt-6-luna`.                                                                                              | Server only   |
| `AI_TIMEOUT_MS`                        | Optional. Explanation timeout per attempt, default `20000` ms.                                                                             | Server only   |
| `AI_EXTRACT_TIMEOUT_MS`                | Optional. Extraction timeout per attempt, default `120000` ms. Keep the default on the demo so two attempts fit within the function limit. | Server only   |

Set `IMPRESSUM_NAME`, `IMPRESSUM_ADDRESS`, and `IMPRESSUM_EMAIL` in the
server-only Production environment. These values are publicly displayed
by `/impressum` and must stay out of Git. Supply the complete address,
using actual line breaks where needed. The legal notice shows a
configuration message until all three valid values are present. Configure
them before publishing a deployment.

Admins copy invitation links and send them separately. Hosted demo
sign-up is disabled. The invitee needs an existing Supabase Auth account
with the matching confirmed email address. The signed-out invite page
takes the invitee to sign-in and back to the invitation.

Leave `ANTHROPIC_API_KEY` unset for OpenAI. Leave Vercel's automatic
system environment variables enabled for `VERCEL` and
`VERCEL_GIT_COMMIT_SHA`.

The migration sets the daily paid AI budget to zero. To enable paid calls,
run this statement in the project's SQL Editor as the operator. The example
allows 200 attempts per UTC day across both features and all users.

```sql
update private.app_settings set ai_daily_request_limit = 200;
```

If you override the extraction model, add its trusted identifier to
`private.app_settings.audit_import_models` before using it.

Set it to zero to pause paid calls. Changes apply to new reservations
without a web redeploy. The signed-in user's RPC checks both quotas before
each paid attempt, including retries. A full global budget leaves the
user's quota unchanged. Already reserved provider attempts keep their
slots. The cap counts requests. Actual provider usage also depends on
token volume and the models selected. The scripted fake works with a zero budget.

Apply new database migrations through the approval-gated `deploy-db.yml`
workflow before deploying an app that depends on them.

Git-triggered deployments are disabled. After the database workflow
succeeds, use **Deployments → ⋯ → Create Deployment** with the `master`
Git reference and verify the deployment targets **Production**. Skip
deployments for changes limited to docs, MCP, or the evaluation corpus.
Under **Deployment Protection**, select **Standard Protection** with
Vercel Authentication. Share the production domain so generated deployment
URLs with older settings stay private.
Keep the Preview environment free of demo credentials. If PR previews
are needed later, use a separate Supabase project and `AI_PROVIDER=fake`.

Keep Supabase admin keys out of Vercel and browser variables. The web
app uses the publishable key and the signed-in user's session. Keep
`apps/mcp` local. It is a stdio server without a Vercel project, route, or
web dependency.

[Vercel monorepos](https://vercel.com/docs/monorepos),
[manual Git deployments](https://vercel.com/docs/deployments),
[Deployment Protection](https://vercel.com/docs/deployment-protection),
and [Functions limits](https://vercel.com/docs/functions/limitations).

## 6. Verify production

1. Run the health request. Expect HTTP 200 and
   `{"status":"ok","db":"ok","version":"<GIT_COMMIT_SHA>"}`. The route calls
   Supabase anonymously using the publishable key. It returns HTTP 503 with
   `"db":"error"` if the check fails or exceeds five seconds, or
   `"db":"unconfigured"` if the Supabase URL or publishable key is missing or
   invalid. The version is `null` where Vercel does not supply a commit SHA.

   ```sh
   curl --fail-with-body -i 'https://<DEMO_HOST>/api/health'
   curl --fail-with-body -I 'https://<DEMO_HOST>/login'
   ```

2. In a private browser window, confirm that the landing and login pages
   have no sign-up link and that `/signup` returns 404. On the login page,
   pick Erik. Open **Nordmuster Logistik GmbH**, then download and open the
   PDF and DOCX. The script CSP on the login page includes a per-response
   nonce. Check the browser console for policy violations.
3. From Erik's dashboard, import a fictional PDF or DOCX, such as
   `packages/extraction/eval/dev/11-musterprotokoll/document.pdf`. Verify
   the review screen shows source citations and save a test draft. Open
   **Checks** on a draft with a finding and request an explanation.
   Verify the configured model and prompt version appear.
4. Sign out and try Victor. Confirm that editing and importing are
   unavailable. Try Mia to verify the firm switcher and the viewer role in
   Süd. Try Sara: open **Members** and **Audit log** for Demo-Kanzlei West
   and confirm that Nord and Süd are absent from the firm switcher. To confirm the budget behavior, set the database limit to zero
   and leave AI configured. Verify that import shows the daily limit
   message and that an uncached explanation displays it with the rule summary. Repeat
   after switching between German and English. Restore the chosen limit
   with the same SQL.
5. Run the reset workflow manually, or wait for the nightly job and check
   `cron.job_run_details` (step 4). Verify that the scratch draft is gone,
   the sample drafts in Nord, Süd, and West are back, and West again has
   Sara as admin, Erik as editor, Victor as viewer, and no invitations.

## 7. Keep the demo available

Supabase can pause Free plan projects after a week of low database
activity. The [keep-alive workflow](../.github/workflows/keep-alive.yml)
calls `/api/health` roughly every two days to generate database activity
and detect outages. It uses the `DEMO_URL` GitHub repository variable and
defaults to `https://urkundenwerk.vercel.app`. After approving the database
migration and deploying the updated web app, run **Keep hosted demo
awake** manually from the Actions tab to verify it passes.
[Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)

Enable email notifications for failed Actions runs to receive outage
alerts for the schedule you own. GitHub disables scheduled workflows
after 60 days without activity in public repositories. Point a free
external uptime monitor such as UptimeRobot at
`https://urkundenwerk.vercel.app/api/health` so checks continue independently
of GitHub. If GitHub disables the workflow, select it in the Actions tab
and click **Enable workflow**.
[GitHub workflow notifications](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs),
[enabling workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows),
[UptimeRobot](https://uptimerobot.com/)

If the project is paused, open the Supabase Dashboard, select the
organization and paused project, then click **Resume project** and
confirm. Once the project is running, repeat the health smoke test and
dispatch the keep-alive workflow.
[Supabase restore instructions](https://supabase.com/docs/guides/platform/free-project-pausing#restoring-a-paused-project)

## 8. Rotate credentials

1. For the OpenAI key or the Supabase publishable key, issue a replacement, update the
   Production variable in Vercel, deploy, and repeat the relevant smoke
   checks. Revoke the old key after verification. Replace the GitHub
   environment secret before revoking a Supabase access token. If you
   change the project database password, update `SUPABASE_DB_PASSWORD`.
2. Rotate the web demo password by updating all four shared accounts
   through the Supabase Auth admin API using their user IDs, then update
   `DEMO_LOGIN_PASSWORD` and redeploy. Preserve the user IDs so firm
   memberships continue to work. Rotate the operator's password
   separately. The hosted seed and reset never store passwords.

   Use `supabase.auth.admin.updateUserById` from a trusted server-side
   environment with a Supabase secret key. To update all four from the
   repo root, load a Supabase admin key into your shell as
   `SUPABASE_ADMIN_API_KEY` and the new password as `DEMO_LOGIN_PASSWORD`.
   These shell values are for the rotation command. Then
   substitute the project ref and four IDs copied from **Auth → Users**.

   ```sh
   NEXT_PUBLIC_SUPABASE_URL='https://<SUPABASE_PROJECT_REF>.supabase.co' \
   pnpm --filter @urkundenwerk/web exec node --input-type=module - \
     '<EDITOR_USER_ID>' '<VIEWER_USER_ID>' '<MULTI_USER_ID>' '<SANDBOX_ADMIN_USER_ID>' <<'JS'
   import { createClient } from "@supabase/supabase-js";
   const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ADMIN_API_KEY, DEMO_LOGIN_PASSWORD } = process.env;
   if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_ADMIN_API_KEY || !DEMO_LOGIN_PASSWORD) {
     throw new Error("Missing rotation environment variables");
   }
   const client = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ADMIN_API_KEY, {
     auth: { persistSession: false, autoRefreshToken: false },
   });
   for (const id of process.argv.slice(2)) {
     const { error } = await client.auth.admin.updateUserById(id, {
       password: DEMO_LOGIN_PASSWORD,
     });
     if (error) throw new Error(`Password rotation failed for user ${id}`);
   }
   JS
   ```

   If a rotation stops partway through, finish updating the four accounts
   with the same new password before redeploying. Check the current Auth
   sessions separately if you are responding to a suspected compromise.
   [Supabase Auth admin update](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).
