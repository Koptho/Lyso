# Lyso

Ein roleg leseapp der barnet øver på heile ord, bokstav for bokstav.
Appen er lydlaus: barnet seier og held bokstavlydane sjølv.

## Slik øver de

Dra den oransje bokstaven bort til den neste blå bokstaven.
I `lese` blir det tre drag: `l → e`, `e → s`, `s → e`.
Ved kvar mellomstasjon er det ein kort stopp. Løft fingeren og dra vidare.
Bokstavane som er lesne, blir også viste samla under sporet: `le`, `les`, `lese`.

- Kvar drarørsle går høgst til neste bokstav, slik at ingen bokstav blir hoppa over.
- Løftar barnet fingeren undervegs, blir bokstaven ståande der. Ta tak igjen og hald fram.
- Dra frå venstre mot høgre på både iPad, mobil og datamaskin.
- Lange ord beheld store bokstavar. Sporet flyttar seg automatisk vidare mellom draga.
- Ei lita stjerne kjem når siste bokstav er nådd. Heile ordet blir ståande gjennom pausen.
- Ingen tekstmarkering eller langtrykkmeny i leseområdet. Vaksne kan framleis redigere og lime inn øveord.
- Tastatur: pil venstre/høgre flyttar bokstaven. Enter, mellomrom eller End går til neste stasjon. Home går tilbake til starten av det pågåande draget.

## Vaksenmodus

Skriv eitt øveord per linje og vel **Lagre vekas øveord**. Heile ordet blir teke med.
Ord må ha minst to bokstavar, utan mellomrom, tal eller skiljeteikn.
Store bokstavar blir gjorde om til små, og duplikat blir fjerna.
Feil i ei linje blir viste før lagring; ord blir aldri kutta eller sette saman i det stille.

Vel **6, 8, 10 eller 15 sekund** mellom orda. Standard er 6 sekund.
Slå av automatisk overgang for å velje **Neste ord** sjølv etter pausen.
Tid medan appen er i bakgrunnen, tel ikkje med i lesepausen.

Ord og innstillingar blir lagra lokalt på denne eininga, i denne nettlesaren.
Tidlegare lagra Lyso-ord blir lesne frå den same lagringsnøkkelen.
Ei førehandsvising på ei anna adresse har si eiga lokale ordliste.
Standardpakken er framleis `so`, `ma`, `le`, `ni`, `ro`.

## Køyre appen

Opne `index.html`, eller start ein lokal statisk nettserver i denne mappa.
Prosjektet brukar vanleg HTML, CSS og JavaScript og har ingen avhengigheiter eller byggjesteg.

## Kontrollar

Køyr `node --test tests/reading.test.cjs`.
Testane køyrer appens hendingar med ein liten simulert DOM og virtuell tid, og dekkjer
mellomstasjonar, frigjeving før neste biletrute, fleire fingrar, avbrot, lange ord,
rotasjon, gamle tidsur, lagring, tastatur og tekstmarkering.
Dei erstattar ikkje ei praktisk utprøving i Safari på ein fysisk iPad.
