# Skapa nytt övningskort

Skapa ett nytt övningskort för hockey-cards-appen baserat på användarens beskrivning.

## Instruktioner

1. **Läs** `README.md` för att förstå formatet och reglerna.
2. **Läs** alla befintliga kort i `src/content/` för att undvika dubbletter och välja en färg som inte redan används.
3. Skapa filen `src/content/<kebab-case-namn>.md` med följande regler:
   - `title`: Övningens namn på svenska
   - `emoji`: Välj en passande emoji för övningen
   - `color`: Välj en hex-färg som inte redan används av ett annat kort
   - Inget `image`-fält – bilden härleds automatiskt från filnamnet (`<kebab-case-namn>.jpg`)
   - `syfte`: En mening som förklarar varför övningen är bra – engagerande och motiverande för unga hockeyspelarna
   - `tips`: **Max 4 punkter** – konkreta instruktioner för hur man gör övningen

## Format

```yaml
---
title: <Namn på övning>
emoji: <emoji>
color: "<hex-färg>"
syfte: <En mening om varför övningen är bra>
tips:
  - <Tips 1>
  - <Tips 2>
  - <Tips 3>
  - <Tips 4>
---
```

## Viktigt
- Tipsen får vara **max 4 punkter** – annars får det inte plats vid utskrift
- Välj alltid en **unik färg** – kolla befintliga kort först
- Filnamnet ska vara **kebab-case på svenska**, t.ex. `hoppa-på-ett-ben.md`
- Tonen ska vara **rolig och motiverande** – målgruppen är unga hockeyspelare

$ARGUMENTS
