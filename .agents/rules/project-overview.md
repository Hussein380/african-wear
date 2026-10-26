# Mandera African Wear – Project Overview

Stock/inventory management PWA for an African fabric shop. Used by non-technical, often elderly staff, so UI must be large, clear and simple.

## Stack
- Next.js 16 (App Router, breaking changes: read `node_modules/next/dist/docs/` first), React 19, TypeScript
- MongoDB (`src/lib/mongodb.ts`), Cloudinary images (`src/lib/cloudinary.ts`), PWA (`@ducanh2912/next-pwa`), `xlsx` export
- Plain global CSS in `src/app/globals.css` (design tokens like `--color-bg-card`, `--space-md`)

## Domain model (`src/types/index.ts`)
- DesignCode (category: PrintedC | PrintedP | PrintTC) -> many Colorways (fullCode, photos, quantityAvailable, optional breakdown/sub-variants)
- ActivityLog: IN / OUT / NEW stock transactions

## Structure
- `src/middleware.ts`: cookie `maw-session` gate (PIN login at `/`, `/api/auth`)
- Pages: `/` (PIN), `/classify` (category list + dashboard), `/classify/[designCodeId]` (colorways), `/history`, `/inventory`
- API routes: activities, auth, colorways, dashboard, design-codes, inventory, search, upload
- Components: `Sidebar` (navigation, prefetch + sessionStorage cache), `Dashboard`, `InventoryTable`, modals, `SearchOverlay`

## Known issues (see `fix.md`)
- History page: buttons (print etc.) unresponsive until Dashboard visited
- Back navigation always goes to dashboard instead of previous page; back button too small for elderly users
- README is still the create-next-app boilerplate; pages use many inline styles
