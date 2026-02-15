# Step-by-Step: I-deploy ang E-SULAT-TULA sa Vercel (Free)

Ang app mo ay may **backend (Node/Express)** at **MySQL**. Para gumana sa Vercel (free), kailangan mo ng **cloud database** at tamang config. Sundin ang steps sa order.

---

## Unang bahagi: Cloud database (free)

Ang Vercel ay hindi pwedeng kumonekta sa MySQL sa computer mo. Kailangan ng database sa internet.

### Option A: PlanetScale (recommended, free tier)

1. Pumunta sa **https://planetscale.com** at mag-sign up (free).
2. **Create database**: Dashboard → **Create database** → pangalan: `esulattula_db` → region: pinakamalapit sa iyo → **Create**.
3. Sa database, pindutin **Connect** → **Connect with** → **General**.
4. Kopyahin ang **Host**, **Username**, **Password** (i-show muna), at siguraduhing naka-**Database** ang branch. Ilalagay mo ito sa Vercel mamaya.
5. Sa PlanetScale, kailangan mo pa gumawa ng tables. Pwedeng:
   - **Console** → **Query** → i-paste at i-run ang SQL mula sa local MySQL mo (export schema), o
   - Gamitin ang same table names: `users`, `tema` o `themes`, `stanzas`, `user_daily_limits` (tingnan ang server.js kung ano ang expected).

**Note:** PlanetScale gamit **MySQL-compatible** protocol. Kung may error sa connection string, subukan **Option B**.

### Option B: Railway (MySQL, free tier)

1. Pumunta sa **https://railway.app** at mag-sign up.
2. **New Project** → **Provision MySQL**.
3. Sa MySQL service, buksan **Variables** at kopyahin ang `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` (o ang equivalent connection URL).
4. Gumawa ng tables sa Railway MySQL (import schema mula sa local o gawin manually).

Kapag tapos ka na sa isang Option A o B, mayroon ka nang: **host, user, password, database name**. Itago mo para sa Step 4.

---

## Step 1: I-push ang project sa GitHub

1. Kung wala ka pang GitHub account, gumawa sa **https://github.com**.
2. Sa computer, buksan ang folder ng **E-SULAT-TULA** sa terminal/command prompt.
3. Kung wala pang Git:
   ```bash
   git init
   ```
4. May **.gitignore** na sa project; kung wala, gumawa na may `node_modules`, `.env`, `.env.local`.
5. I-add at i-commit:
   ```bash
   git add .
   git commit -m "Prepare for Vercel deploy"
   ```
6. Sa GitHub, **New repository** → pangalan: `e-sulat-tula` (o kahit ano) → **Create**.
7. I-link ang repo (palitan ang `YOUR_USERNAME` at `YOUR_REPO`):
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 2: Naka-configure na ang project

Naka-set na sa project mo ang:

- **vercel.json** – lahat ng request ay dadaan sa serverless function.
- **api/index.js** – naglo-load ng Express app para sa Vercel.
- **script/server.js** – gumagamit na ng `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` kapag naka-set (para sa Vercel); sa local, default pa rin ang localhost.
- **script.js** – kapag hindi localhost ang site (e.g. naka-Vercel), gagamit ng **same origin** para sa API, kaya isang URL lang ang kailangan.

Kung may **.env** ka sa local, huwag i-commit; sa Vercel ilalagay ang values sa **Environment Variables** (Step 4).

---

## Step 3: Mag-sign up at mag-import sa Vercel

1. Pumunta sa **https://vercel.com** at mag-sign up (gamit GitHub).
2. **Add New** → **Project**.
3. **Import** ang GitHub repo mo (e-sulat-tula).
4. **Framework Preset**: leave as **Other** (or kung walang preset, okay lang).
5. **Root Directory**: blank (root ng repo).
6. **Build Command**: puwedeng blank o `npm install` kung gusto mo i-ensure install.
7. **Output Directory**: blank.
8. Huwag pa i-deploy; punta muna sa **Step 4**.

---

## Step 4: Ilagay ang environment variables sa Vercel

1. Sa Vercel project, **Settings** → **Environment Variables**.
2. Idagdag (palitan ang values ng galing sa PlanetScale o Railway):

   | Name              | Value        | Environment |
   |-------------------|-------------|-------------|
   | `MYSQL_HOST`      | (host)      | Production, Preview |
   | `MYSQL_USER`      | (username)  | Production, Preview |
   | `MYSQL_PASSWORD`  | (password)  | Production, Preview |
   | `MYSQL_DATABASE`  | (database)  | Production, Preview |

3. **Save**.

---

## Step 5: I-deploy

1. Sa Vercel project, **Deployments** → **Redeploy** (o kung first time, **Deploy** mula sa import).
2. Hintayin hanggang **Ready**.
3. Buksan ang **Visit** (e.g. `https://your-project.vercel.app`).

---

## Step 6: API URL

Hindi mo na kailangan mag-set ng API URL. Kapag naka-deploy sa Vercel, ang frontend ay gumagamit na ng **same origin** (iisang domain), kaya lahat ng API call (login, themes, stanzas, etc.) ay papunta sa iisang Vercel URL.

---

## Mga karaniwang problema

- **502 / timeout**: Check Vercel **Functions** log. Kung MySQL connection mabagal, subukan region na malapit sa database.
- **DB connection error**: I-double-check ang env vars (host, user, password, database). Sa PlanetScale, kung naka-**branch** pa, gamitin ang connection details ng branch na yon.
- **Tables missing**: Export schema mula sa local MySQL at i-run sa cloud DB (PlanetScale Console o Railway MySQL client).

---

## Buod

1. Gumawa ng **cloud MySQL** (PlanetScale o Railway).
2. I-push ang code sa **GitHub**.
3. **Import** repo sa Vercel.
4. Ilagay ang **MYSQL_*** env vars sa Vercel.
5. **Deploy** at i-check ang URL.
6. Ang API at frontend ay same origin na sa Vercel — walang dagdag config.

Pagkatapos nito, ang site mo ay naka-host na sa Vercel (free) at gumagana na sa cloud database.
