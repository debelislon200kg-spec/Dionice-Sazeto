# Dionice sažeto Mobile

## Expo Go preview

Replitov `expo` workflow pokreće Expo development server. QR kod iz
**Preview on your phone** otvara aplikaciju u Expo Go i služi za brzi preview
uz hot reload. To nije samostalna Android aplikacija: uređaj mora imati Expo
Go, a aplikacija je vezana uz development server.

## Instalabilni Android APK

Za testiranje na fizičkom Android uređaju koristi se `preview` build profil iz
`eas.json`. Profil:

- proizvodi `.apk` datoteku, a ne samo Android App Bundle;
- koristi package name `com.dionicesazeto.mobile`;
- namijenjen je internom/testnom dijeljenju;
- ugrađuje `https://dionice-sazeto-api-server.vercel.app` kao API bazu.

Build pokreni kroz Expo/EAS build servis odabirom platforme **Android** i
profila **preview**. Nakon što build završi, preuzmi APK na uređaj i otvori
ga za instalaciju. Ako Android zatraži dopuštenje za instalaciju iz tog
izvora, omogući ga u postavkama uređaja.

API domena se ugrađuje u JavaScript bundle tijekom builda. Ako se javna API
domena promijeni, ažuriraj `EXPO_PUBLIC_DOMAIN` u `eas.json` prije sljedećeg
builda. Vrijednost može biti host bez protokola ili puna `https://` adresa.

Standalone APK i Expo Go preview nisu ista stvar: APK se instalira i radi
bez Expo Go i Replit development servera, ali ne dobiva hot reload.