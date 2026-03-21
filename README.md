# Hockey Övningskort

Kortlek för off-ice smidighetsträning. Varje kort innehåller bild, syfte och tips.
6 kort per A4-sida i liggande format – välj ut de kort du vill och skriv ut!

Appen är öppen källkod. **Foton lagras krypterat** med [git-crypt](https://github.com/AGWA/git-crypt) och är aldrig synliga för utomstående.

![Appen](./public/hockey-cards-app.png)

---

## Kom igång

### 1. Installera beroenden

**Mac**

Installera [Node.js](https://nodejs.org/) (välj LTS-versionen) om du inte redan har det.

Installera sedan git-crypt via [Homebrew](https://brew.sh/):

```bash
brew install git-crypt
```

**Windows**

Öppna PowerShell som administratör och installera WSL:

```powershell
wsl --install
```

Starta om datorn, öppna **Ubuntu** från startmenyn och kör:

```bash
sudo apt update && sudo apt install git-crypt nodejs npm -y
```

### 2. Klona repot

```bash
git clone https://github.com/willeeklund/hockey-cards.git
cd hockey-cards
```

### 3. Lås upp krypterade bilder

Du behöver nyckelfilen av den som äger repot (skickas privat).
I detta exempel har du sparat nyckeln i filen `~/ikgota-team16-git-crypt-key`.

```bash
git-crypt unlock ~/ikgota-team16-git-crypt-key
```

Det här behöver du bara göra **en gång per dator**.

### 4. Installera paket och starta

```bash
npm install
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000) i webbläsaren.

---

## Skriv ut

Klicka på **🖨️ Skriv ut** i toolbar:en.

Rekommenderade skrivarinställningar:
- Format: A4 liggande
- Marginaler: Ingen / None
- Bakgrundsgrafik: På (för att färger ska skrivas ut)

---

## Lägga till en ny övning

Det rekommenderade sättet är att använda [Claude Code](https://claude.ai/code) med det inbyggda kommandot `/skapa-kort`. Beskriv övningen på svenska så skapar Claude kortfilen åt dig – med rätt färg, emoji, syfte och tips.

```
/skapa-kort Kullerbytta – rulla framåt och res dig upp utan att använda händerna
```

Kommandot väljer automatiskt en färg som inte redan används och håller sig till max 4 tips.

Vill du skapa kortet för hand, skapa en fil i `src/content/` och följ mallen nedan. Ladda sedan upp ett foto via **📷 Ladda upp** i appen – eller lägg filen direkt i `public/exercise_images/<din-lagmapp>/`.

### Mall

```yaml
---
title: Namn på övning
emoji: 🤸
color: "#FF6B35"
syfte: Beskriv varför övningen är bra – kort och kärnfullt!
tips:
  - Första tipset
  - Andra tipset
  - Tredje tipset
  - Fjärde tipset
---
```

> **OBS:** Inget `image`-fält behövs. Appen letar automatiskt efter en bild med samma namn som filen – `namn-pa-ovning.jpg` – i din lagmapp (`IMAGES_FOLDER`).

Tipsen får vara **max 4 punkter** – annars får det inte plats när man skriver ut.

---

## Bilder och kryptering

Bilder lagras i `public/exercise_images/<lagmapp>/` och krypteras automatiskt med git-crypt när du commitar. Utan nyckeln ser utomstående bara krypterade binärfiler – aldrig de faktiska fotona.

Du behöver inte tänka på det i vardagen. Krypteringen sker automatiskt vid `git push` och dekrypteringen vid `git pull` (efter att du kört `git-crypt unlock` en gång).

---

## Använda appen för ett annat lag

Byt ut `ditt-lag` mot ert lags smeknamn (t.ex. `vasteras-u14`) i alla steg nedan.

### 1. Forka och konfigurera

1. Forka repot på GitHub
2. Klona din fork lokalt
3. Kopiera `.env.example` till `.env` och byt `IMAGES_FOLDER`:
   ```
   IMAGES_FOLDER=ditt-lag
   ```

### 2. Ta bort ikgota-team16 och lägg till din lagmapp

```bash
# Ta bort det befintliga lagets krypterade mapp
git rm -r public/exercise_images/ikgota-team16/

# Skapa din lagmapp
mkdir -p public/exercise_images/ditt-lag
```

### 3. Skapa din krypteringsnyckel

```bash
# Initiera git-crypt (körs bara en gång per repo)
git-crypt init

# Exportera nyckeln – spara den säkert, du behöver dela den med lagkamrater
git-crypt export-key ~/ditt-lag-git-crypt-key
```

> **Viktigt:** Nyckelfilen ska aldrig commitas till Git. Dela den privat med lagkamrater (t.ex. via en krypterad meddelandetjänst eller ett USB-minne).

### 4. Committa och pusha

```bash
git add public/exercise_images/ditt-lag/
git commit -m "Byt till ditt-lag"
git push
```

Dina foton krypteras automatiskt när du commitar – ingen utan nyckeln kan se dem.

### Dela nyckeln med en lagkamrat

Skicka filen `~/ditt-lag-git-crypt-key` privat till personen. De låser upp med:

```bash
git-crypt unlock ~/ditt-lag-git-crypt-key
```

---

## Bidra med övningar (utan foton)

Pull requests med nya övningskort (bara `.md`-filer i `src/content/`) är välkomna! Inkludera aldrig foton i en PR – bildmappar är lagnspecifika och ska inte delas.

---

## Projektstruktur

```
hockey-cards/
├── public/
│   └── exercise_images/
│       └── ikgota-team16/   ← Krypterade lagfoton (ej synliga utan nyckel)
├── src/
│   ├── content/             ← En .md-fil per övning
│   ├── components/
│   │   ├── ExerciseCard.jsx / .css
│   │   ├── SelectionBar.jsx / .css
│   │   └── UploadView.jsx / .css
│   ├── utils/
│   │   └── parseCard.js
│   ├── App.jsx / .css
│   └── main.jsx
├── .env                     ← Din lokala konfiguration (ej i Git)
├── .env.example             ← Mall för .env
├── .gitattributes           ← Styr vilka filer som krypteras
└── index.html
```
