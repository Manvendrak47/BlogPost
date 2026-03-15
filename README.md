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
- SQLite-based persistence

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

> If npm package installation is restricted in your environment, allow access to npm registry or install dependencies from an approved internal mirror.
