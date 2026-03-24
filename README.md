# Stavelserommet

Ein liten lokal nettapp for å øve på lydsammentrekning med to bokstavar.

## Opne appen

Opne `index.html` i nettlesaren.

Om du vil køyre via enkel lokal server, kan du til dømes bruke:

```bash
python3 -m http.server
```

og så opne adressa som blir vist i terminalen.

## Kva som er bygd inn

- dra-og-slepp av første bokstav mot vokalen
- visuell samansmelting med farge, form og animasjon
- kontinuerleg fonem-liknande lydstøtte via Web Audio
- belønning med stjerner og ein figur som blir "redda"
- progresjon gjennom enkle stavingar: `SO`, `MA`, `LE`, `NI`, `RO`
- ein meir Poio-liknande reisemodus med opplåste lydstiar, streak og delmål
- betre mobiloppleving med større knappar og tydelegare vertikal draging
- eige favicon og meir synleg statushjelp undervegs

## Ekte lydfiler

Appen støttar eigne fonem- og stavingfiler i `sounds/`.

- sjå [sounds/README.md](/Users/thomaskopperstad/Documents/Stavelser/sounds/README.md) for mappestruktur
- når rette filer finst, bruker appen dei automatisk i staden for den innebygde lydmotoren

## Neste pedagogiske steg

For endå meir naturleg uttale kan ein byte ut den innebygde Web Audio-lyden med innspelte fonemfiler frå logoped/pedagog, men appen fungerer allereie utan eksterne filer.
