# Réglages Vape

PWA (Android) qui donne la puissance conseillée selon la box et la résistance.

Matériel actuellement géré : Geekvape Aegis Legend + Innokin Zenith 2 (résistances Z 0,3 à 1,6 Ω).

## Ajouter du matériel
Tout passe par `data.json` (boxes, réservoirs, résistances), sans toucher au code.
Les plages de puissance viennent des valeurs annoncées par le fabricant ; une résistance sans plage connue est marquée « à confirmer ».

## Test local
`python3 -m http.server` puis ouvrir http://localhost:8000
