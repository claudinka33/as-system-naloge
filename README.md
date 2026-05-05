# AS system — Interni sistem za upravljanje nalog

Spletna aplikacija za upravljanje nalog med zaposlenimi v podjetju AS system d.o.o.

## Funkcije

- 🔐 **Prijava preko e-maila** — vsak zaposleni se prijavi s svojim @as-system.si naslovom
- 📋 **Naloge med zaposlenimi** — direktor (in vsi drugi) lahko dodelijo nalogo komurkoli
- ⭐ **"Moje naloge"** — vsak zaposleni takoj vidi, kaj mora narediti
- 📤 **"Sem dodelil"** — pregled vseh nalog, ki ste jih dali drugim
- 📎 **Priponke** — PDF, Word, Excel, slike (max 2MB)
- 💬 **Komentarji** znotraj nalog za komunikacijo
- ⏰ **Roki in prioritete** (visoka/srednja/nizka)
- 🔴 **Opozorilo o zamudah** v glavi aplikacije
- 🔍 **Filtri** po osebi, oddelku, statusu

## Zaposleni v sistemu

Vsi zaposleni AS system d.o.o. (13 oseb):
- Aleš Seidl — Direktor
- Alen Drofenik — Nabava
- Tjaša Mihevc — Komerciala-Prodaja
- Matija Marguč — Komerciala
- Sara Jagodič — Računovodstvo
- Cvetka Seidl — Kadrovska
- Claudia Seidl — Marketing
- Milena Jančič — Montaža
- Gregor Koritnik — Tehnolog
- Boris Černelč — Proizvodnja
- Mitja Babič — Kakovost
- Žan Seidl — Komercialist
- Feliks Žekar — Skladišče

## Prijava

- **E-mail:** vaš @as-system.si naslov
- **Geslo:** `ASsystem2026` (skupno geslo za vse, lahko se spremeni)

## Lokalni zagon (za razvoj)

```bash
npm install
npm run dev
```

Aplikacija se odpre na http://localhost:5173

## Deploy na Vercel preko GitHub

### 1. Naredi Private GitHub repozitorij
- Pojdi na https://github.com/new
- Ime: `as-system-naloge`
- **POMEMBNO: označi kot Private** (interno orodje!)
- NE dodajaj README, .gitignore, license

### 2. Push na GitHub
```bash
git init
git add .
git commit -m "Initial commit - AS system tasks"
git branch -M main
git remote add origin https://github.com/[TVOJ-USERNAME]/as-system-naloge.git
git push -u origin main
```

### 3. Deploy na Vercel
1. Pojdi na https://vercel.com/new
2. Import GitHub repozitorij
3. Vercel avtomatsko prepozna Vite + React
4. Klikni "Deploy"
5. V 1-2 minutah dobiš URL: `https://as-system-naloge.vercel.app`

## Naslednji koraki (po predstavitvi direktorju)

### V1.1 — Prava baza (Supabase)
- Vsi uporabniki delijo iste podatke (zdaj jih ima vsak v svojem brskalniku)
- Avtomatske varnostne kopije
- Možnost lastne domene (npr. `naloge.as-system.si`)

### V1.2 — E-mail obvestila preko GoHighLevel
- Ko zaposleni dobi novo nalogo → e-mail obvestilo
- Ko se rok bliža → opomnik
- Integracija z GoHighLevel API

### V1.3 — Dodatne funkcije
- Mesečna poročila po zaposlenih
- Pregled produktivnosti
- Mobilna PWA aplikacija

## Sprememba gesla

V datoteki `src/App.jsx`, vrstica 4:
```javascript
const APP_PASSWORD = 'ASsystem2026'; // spremeni po želji
```

## Sprememba seznama zaposlenih

V datoteki `src/App.jsx`, vrstice 7-20 — dodaj/odstrani zaposlene:
```javascript
const EMPLOYEES = [
  { email: 'novi@as-system.si', name: 'Novi Zaposleni', department: 'Nabava' },
  // ...
];
```

---

**Razvito za AS system d.o.o. — maj 2026**
