# PromptFlow Server

PromptFlow Server is the backend API for a prompt-sharing platform with authentication, role-based access control, premium access, moderation, reports, bookmarks, reviews, payments, and admin analytics.

## Project Overview

The API supports:

- User authentication with Better Auth
- Prompt creation and moderation
- Premium-only prompt access
- Bookmarks and reviews
- One-time Stripe payment flow for premium access
- Report and moderation workflows
- Admin analytics and recent activity endpoints

## Tech Stack

- Node.js
- Express
- MongoDB Atlas
- Better Auth
- Stripe

## Environment Variables

Create a `.env` file based on `.env.example` and set:

```env
PORT=5000
MONGODB_URI=your_connection_string
BETTER_AUTH_SECRET=your_random_secret
BETTER_AUTH_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000
STRIPE_SECRET_KEY=your_stripe_secret_key
```

## Installation

```bash
npm install
```

Create the environment file:

```bash
copy .env.example .env
```

## Run Commands

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

## Authentication

Authentication is handled by Better Auth and mounted under `/api/auth`.

- Email/password authentication is enabled
- Session-based auth is used for protected routes
- Roles supported: `user`, `creator`, `admin`
- Default user fields:
  - `role: "user"`
  - `subscription: "free"`
  - `premiumUntil: null`

## Premium Payment Flow

Premium access is activated through a one-time Stripe payment flow.

1. Create a payment intent with `POST /api/payments/create-payment-intent`
2. Confirm payment with `POST /api/payments/confirm-payment`
3. Save payment record in the `payment` collection
4. Update the user to:
   - `subscription: "premium"`
   - `premiumUntil: current date + 30 days`

Free users cannot access locked premium prompt content, and premium-only restrictions apply to protected prompt actions.

## Admin Features

Admin-only features include:

- User management
- Prompt moderation
- Report moderation
- Revenue analytics
- Dashboard stats
- Recent activity feeds

## API Modules

- Auth
- Users
- Prompts
- Bookmarks
- Reviews
- Payments
- Reports
- Admin

## API Summary

### Auth

- `ALL /api/auth/*`

### Prompts

- `POST /api/prompts`
- `GET /api/prompts`
- `GET /api/prompts/:id`
- `PATCH /api/prompts/:id`
- `DELETE /api/prompts/:id`
- `PATCH /api/prompts/:id/copy`
- `GET /api/prompts/pending/all`
- `GET /api/prompts/admin/all`
- `PATCH /api/prompts/:id/approve`
- `PATCH /api/prompts/:id/reject`
- `PATCH /api/prompts/:id/feature`
- `PATCH /api/prompts/:id/unfeature`

### Bookmarks

- `POST /api/bookmarks/:promptId`
- `GET /api/bookmarks`
- `DELETE /api/bookmarks/:promptId`

### Reviews

- `POST /api/reviews/:promptId`
- `GET /api/reviews/:promptId`
- `DELETE /api/reviews/:promptId`

### Payments

- `POST /api/payments/create-payment-intent`
- `POST /api/payments/confirm-payment`
- `GET /api/payments/my-payments`
- `GET /api/payments`

### Reports

- `POST /api/reports/:promptId`
- `GET /api/reports`
- `PATCH /api/reports/:id/remove-prompt`
- `PATCH /api/reports/:id/warn-creator`
- `PATCH /api/reports/:id/dismiss`

### Admin

- `GET /api/admin/stats`
- `GET /api/admin/revenue`
- `GET /api/admin/recent-activity`

## Health Check

- `GET /api/health`

Response:

```json
{
  "success": true,
  "status": "ok",
  "service": "PromptFlow API"
}
```

## Error Handling

The API includes:

- Global 404 handler
- Global JSON error handler
- Consistent `success: false` error responses

## Notes

- This backend is API-only and does not include the frontend
- Stripe card data is not stored
- MongoDB collections are used directly with the existing project structure
