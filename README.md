# BlogPost Platform

A simple full-stack blog website with role-based access:

- **Provider** users can log in and publish blogs.
- **Customer** users can log in and read full blogs.
- **Guests** (not logged in) can only read a preview of each blog.

## Features

- Register with role (`provider` or `customer`)
- Login/logout with session support
- Provider-only blog creation page
- Blog listing with preview for non-customers
- Blog detail page with full content restricted to customers
- File-based persistence in `data.json` (no native DB dependency)

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Why this update?

`better-sqlite3` can trigger native addon install warnings (for example around `prebuild-install`).
This project now uses a JSON data store to avoid native build/deprecation issues and keep setup simpler.
