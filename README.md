# Berühmte Probleme — visuell erklärt

Sieben Mathematikprobleme als interaktive Webseite: **Collatz**, **Goldbach**,
**Primzahlzwillinge**, **Primzahlsatz**, **Ziegenproblem**, **Geburtstagsparadoxon** und
**Buffons Nadelproblem**.

Jedes Kapitel folgt demselben Aufbau: Definition mit Formelblock, ein Labor zum
Selbstrechnen, zwei große Canvas-Diagramme, Forschungsstand als Timeline, eine
Datentabelle und Quellen. Alles wird im Browser berechnet — keine nachgeschlagenen
Tabellen, keine Chart-Bibliothek, keine externen Schriften oder Requests.

## Starten

```bash
python3 -m http.server 8080
```

Dann <http://localhost:8080/> öffnen. Die Seite braucht keinen Build-Schritt und läuft
auch über eine LAN-IP (`--bind 0.0.0.0`).

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Menü, sieben Kapitel (`<article class="chapter">`), Quellen |
| `styles.css` | Design-Tokens, Layout, Komponenten |
| `app.js` | Collatz-Diagramme (Trajektorie, Streudiagramm, Fluss) |
| `chapters.js` | Hash-Router + Diagramme der übrigen sechs Kapitel |

Navigation über den URL-Hash: `/#collatz`, `/#goldbach`, … `/#buffon`.

## Was berechnet wird

- Collatz-Folgen, Stoppzeiten und Rekorde (Sieb bzw. Memo, bis 10⁹)
- Goldbach-Zerlegungen und der „Komet“ (bis 30 000)
- Primzahlen per Sieb bis 10⁶: π(x), Zwillinge, Ulam-Spirale
- Ziegenproblem: Spiel plus 10 000 simulierte Runden
- Geburtstagsparadoxon: exakte Formel plus Simulation
- Buffons Nadeln: Zufallsexperiment plus Konvergenz der π-Schätzung

Behauptungen der Form „geprüft bis …“ sind mit Quelle versehen; wo nur gerechnet wurde,
steht das dabei.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
