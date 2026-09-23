# Merchander – Golden Legacy General Merchandise

Web-based ordering platform for Golden Legacy General Merchandise (Caloocan City).
This branch implements **Sprint 1** of the product backlog: user access and the product catalog.

## Sprint 1 scope

| Story | Feature | Where |
|---|---|---|
| C01 | Welcome page with business name, logo, overview, contact details, address, operating hours, and links to Login/Registration | `#/` |
| C02 | Product catalog grouped by category with image, description, price per case and half-case, and stock status (In Stock / Low Stock / Out of Stock). Ordering is disabled until the visitor logs in; out-of-stock items can't be ordered | `#/catalog`, `#/product/:id` |
| C01 | Create an account: required-field and format validation, password rules, duplicate email/mobile rejected, OTP verification before activation | `#/register` |
| C02 | Log in with email or mobile number, or Google. Generic error message on bad credentials, temporary lock after 5 failed attempts, inactive-account message, role-based dashboard (Customer, Employee, Delivery Personnel, Business Owner) | `#/login`, `#/dashboard` |
| C03 | Password recovery: one-time code sent to the registered email or mobile, 5-minute expiry, 60-second resend wait, new password only after verification | `#/forgot` |
| C04 | My Account: view, edit, and save profile and delivery address; changing email or mobile needs an OTP sent to the new contact; change password; light/dark theme saved to the account and kept across sessions | `#/account` |

Later sprints (cart, orders, payments, inventory, deliveries, reports, and so on) show up on each dashboard as "Coming soon".

## Running it

It's a static site with no build step. Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000   # then open http://localhost:8000
```

For GitHub Pages, publish from the repository root.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Business Owner | owner@goldenlegacy.test | Owner@2026 |
| Employee | staff@goldenlegacy.test | Staff@2026 |
| Delivery Personnel | driver@goldenlegacy.test | Driver@2026 |
| Customer | juan@store.test | Customer@2026 |
| Customer (inactive) | inactive@store.test | Customer@2026 |

The Owner and Juan accounts are linked to Google sign-in. Use **Reset demo data** in the footer to start over.

## Prototype notes

- **No backend yet.** Accounts, sessions, and codes are stored in the browser's `localStorage` by `js/store.js`. Passwords are salted and SHA-256 hashed. Every service function returns plain objects, so this layer can be replaced with calls to a PHP/MySQL API without changing the views in `js/app.js`.
- **The SMS/email gateway is simulated.** One-time codes appear in an on-screen "demo gateway" message box.
- **Google sign-in is simulated.** It opens an account chooser instead of real Google OAuth. Only accounts that are linked in Merchander can sign in.
- **The business details are placeholders.** Update the address, phone numbers, email, operating hours, product list, and prices in `js/config.js`.

## Files

```
index.html        page shell
css/styles.css    styles (light and dark themes, responsive)
js/config.js      business details, security settings, categories, products, demo accounts
js/store.js       data and auth services (register, login, OTP, recovery, profile, theme, catalog)
js/app.js         hash router and views
legacy/           earlier Customer/Admin/Staff dashboard mock-up
```
