# Security policy

## Reporting a vulnerability

Please **don't open a public issue**. Instead, report it privately through
GitHub: go to the repository's **Security** tab and choose **Report a
vulnerability**. Only the maintainer can see the report.

Include what you found, how to reproduce it, and what someone could do with it.
You'll get a reply within a week. Once it is fixed you'll be credited in the
advisory, unless you'd rather not be.

## Scope

The site is static: it has no accounts, no server code and stores nothing
about visitors. Things we especially want to hear about:

- a way to make the site show false hazard information (for example through
  the daily data copy or a crafted link),
- script injection through data copied from official sources,
- anything in the GitHub Actions workflows that could let a pull request or
  fork push to `main` or read secrets.

## Supported versions

Only the current `main` branch (what is deployed) is supported.
