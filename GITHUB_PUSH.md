# Paano i-Push ang Project sa GitHub

Sundin ang steps sa order. Kung first time mo gamitin ang Git, i-install muna ang **Git** sa computer: https://git-scm.com/downloads

---

## Step 1: Buksan ang terminal/command prompt

- Sa **Windows**: buksan ang **Command Prompt** o **PowerShell**, o sa Cursor/VS Code pindutin **Terminal** → **New Terminal**.
- **I-cd** papunta sa folder ng project:
  ```bash
  cd A:\E-SULAT-TULA
  ```
  (Palitan kung iba ang path ng project mo.)

---

## Step 2: I-init ang Git (kung first time sa project na ito)

```bash
git init
```

Makikita mo ang: `Initialized empty Git repository...`

---

## Step 3: I-add ang lahat ng files

```bash
git add .
```

Ang `.` = lahat ng file sa current folder (maliban sa naka-list sa `.gitignore` tulad ng `node_modules` at `.env`).

---

## Step 4: I-commit

```bash
git commit -m "First commit - E-SULAT-TULA project"
```

Pwedeng palitan ang message sa loob ng quotes.

---

## Step 5: Gumawa ng repository sa GitHub

1. Pumunta sa **https://github.com** at mag-**log in** (o mag-sign up kung wala ka pang account).
2. Pindutin ang **+** (top right) → **New repository**.
3. **Repository name**: hal. `e-sulat-tula` (walang spaces).
4. **Public** ang pipiliin para free.
5. **Huwag** i-check ang "Add a README" (may laman na ang project mo).
6. Pindutin **Create repository**.

---

## Step 6: I-link ang GitHub repo sa project mo

Sa terminal, isulat (**palitan** ang `YOUR_USERNAME` at `YOUR_REPO` ng totoong username at repo name mo):

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

Halimbawa kung username mo ay `juan-dela-cruz` at repo name ay `e-sulat-tula`:

```bash
git remote add origin https://github.com/juan-dela-cruz/e-sulat-tula.git
```

---

## Step 7: I-push sa GitHub

```bash
git branch -M main
git push -u origin main
```

- **Mag-log in**: kung hihingi ng username/password, gamitin ang **GitHub username** at **Personal Access Token** (hindi ang password ng account).  
  Para gumawa ng token: GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Generate new token**; bigyan ng **repo** scope.
- Kapag successful: makikita sa GitHub ang lahat ng files mo.

---

## Kung may error na "remote origin already exists"

Kung dati nang may `origin`, pwede mo i-update:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## Para sa mga susunod na push (pag may binago ka)

Pag nag-edit ka ng files at gusto mo i-update ang GitHub:

```bash
git add .
git commit -m "Describe your changes here"
git push
```

---

## Quick checklist

| Step | Command / Action |
|------|------------------|
| 1 | `cd A:\E-SULAT-TULA` (o path ng project) |
| 2 | `git init` |
| 3 | `git add .` |
| 4 | `git commit -m "First commit"` |
| 5 | Gumawa ng **New repository** sa GitHub (walang README) |
| 6 | `git remote add origin https://github.com/USERNAME/REPO.git` |
| 7 | `git branch -M main` then `git push -u origin main` |

Pag tapos nito, naka-push na ang project mo sa GitHub at pwedeng i-connect sa Vercel (see **DEPLOY_VERCEL.md**).
