# Réglages Vape

PWA (Android) qui donne la puissance conseillée selon la box et la résistance.

## Matériel géré
- Box : Geekvape Aegis Legend 3, Innokin Coolfire Z80, Voopoo Drag 5, Vaporesso Target 100
- Réservoirs : Innokin Zenith 2 (résistances Z), Aspire Nautilus 3, Voopoo UFORCE-X (PnP-X), Vaporesso iTank (GTi, réservé à la Target 100)

## Ajouter du matériel
Tout passe par `data.json` (box, réservoirs, résistances), sans toucher au code.
- Un réservoir sans champ `mods` est proposé avec toutes les box ; avec `mods`, il n'est proposé qu'avec celles listées.
- `confidence` d'une résistance : `high` (plage recoupée), `medium` (source unique, affichée avec une étoile et un avertissement), `missing` (plage inconnue).
- Les plages de puissance viennent des valeurs annoncées par le fabricant ; vérifie toujours l'inscription sur la résistance.

## Test local
`python3 -m http.server` puis ouvrir http://localhost:8000
