# Portsimex Services — public website

The public marketing site for Portsimex Services Ltd (www.portsimex.com): Home, Services, About and Contact.
It is a separate Next.js app from the ERP in the repository root and is deployed as its own Vercel project.

## Develop

```bash
cd marketing
npm install
npm run dev        # http://localhost:3000
```

## Edit content

Almost all text lives in `src/lib/content.ts` — company details, services, offices, emails, phone numbers,
mission, vision and values. Photos are in `src/assets/images/`; the logo, ring mark and network map are SVGs in `public/`.

## Deploy (first time)

From the `marketing` folder:

```bash
cd marketing
npx vercel          # answer: new project, name e.g. "portsimex-website", directory "./"
npx vercel --prod
```

Then add the `portsimex.com` / `www.portsimex.com` domain to that project in the Vercel dashboard.
After the first time, `npx vercel --prod` from `marketing/` redeploys.
