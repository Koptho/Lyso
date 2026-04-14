# Lyso

Ein enkel nettapp for å øve på å trekkje saman to små bokstavar til ei stavelse.

Appen er laga med svært lite tekst i sjølve elevvisinga. Eleven dreg den første bokstaven bort til den andre bokstaven, og får ei enkel stjernebelønning når stavinga er fullført.

## Opne appen

Opne `index.html` i nettlesaren.

Om du vil køyre via ein enkel lokal server, kan du til dømes bruke:

```bash
python3 -m http.server
```

og så opne adressa som blir vist i terminalen.

## Kva som er bygd inn no

- rein elevvising med svært lite tekst
- tittel `Lyso` og enkel figur i toppen
- dra-og-slepp av første bokstav mot andre bokstav
- berre små bokstavar i appen
- lydlaus utgåve utan lydstøtte
- stjerner rundt mottakarboksen når stavinga er fullført
- automatisk overgang til neste oppgåve etter kort pause
- støtte for touch-skjermar med glattare dragging på iPad og iPhone
- sperre mot tekstmarkering i draområdet på touch-skjermar
- vaksenmodus der du kan leggje inn eigne stavingar

## Vaksenmodus

Opne `Vaksenmodus` i appen og skriv éi stavelse per linje.

- døme: `ma`, `so`, `li`, `no`
- appen brukar berre dei to første bokstavane i kvar linje
- bokstavane blir gjorde om til små bokstavar
- innhaldet blir lagra lokalt i nettlesaren på denne eininga
- trykk `Tilbakestill standard` for å gå tilbake til startpakka

## Standardstavingar

Standardpakken i appen er:

- `so`
- `ma`
- `le`
- `ni`
- `ro`

## Teknisk

Prosjektet er ein liten statisk nettapp utan byggjesteg.

- [index.html](/Users/thomaskopperstad/Documents/Stavelser/index.html)
- [styles.css](/Users/thomaskopperstad/Documents/Stavelser/styles.css)
- [app.js](/Users/thomaskopperstad/Documents/Stavelser/app.js)
- [favicon.svg](/Users/thomaskopperstad/Documents/Stavelser/favicon.svg)
