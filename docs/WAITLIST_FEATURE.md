# Funkcja Listy Rezerwowej dla Szkoleń

## Opis

System automatycznie przełącza szkolenia w tryb listy rezerwowej, gdy data szkolenia minie. Jednak czasami może być potrzebne włączenie listy rezerwowej dla szkolenia, które ma aktywną (przyszłą) datę - na przykład gdy szkolenie jest już wypełnione, ale chcemy zbierać zapisy na listę oczekujących.

## Jak włączyć listę rezerwową dla aktywnego szkolenia

Aby włączyć listę rezerwową dla szkolenia z aktywną datą, dodaj flagę `force_waitlist: true` w pliku YAML szkolenia:

```yaml
id: "nazwa-szkolenia"
title: "Tytuł Szkolenia"
active: true
featured: true
force_waitlist: true  # <-- Dodaj tę linię

# Prowadzący i meta
instructor: "Imię Nazwisko"
# ... reszta konfiguracji
```

## Co się zmienia po włączeniu `force_waitlist`

Gdy `force_waitlist: true` jest ustawione:

1. **Przyciski "Zapisz się"** zostają automatycznie zmienione na **"Rezerwuj miejsce"**
2. **Kliknięcie przycisku** otwiera modal z formularzem listy rezerwowej zamiast przekierowania na stronę zakupu
3. **W sekcji z terminem** pojawia się dodatkowa informacja: **"Lista rezerwowa"** (na pomarańczowo)
4. **Daty szkolenia** są nadal wyświetlane (w przeciwieństwie do szkoleń przeszłych, gdzie pokazuje się "Nowy termin w drodze")

## Kiedy używać tej funkcji

- ✅ Szkolenie ma aktywną datę, ale wszystkie miejsca są zajęte
- ✅ Chcesz zacząć zbierać listę oczekujących przed terminem szkolenia
- ✅ Organizujesz edycję pilotażową i chcesz zbierać zainteresowanych na kolejną edycję

## Zachowanie domyślne (bez `force_waitlist`)

Jeśli `force_waitlist` nie jest ustawione lub jest `false`:

- **Szkolenia z przyszłą datą:** pokazują przycisk "Zapisz się" i przekierowują na stronę zakupu
- **Szkolenia z przeszłą datą:** automatycznie pokazują przycisk "Rezerwuj miejsce" i otwierają formularz listy rezerwowej

## Przykład użycia

```yaml
# Szkolenie z datą 2025-11-25, ale już wypełnione
id: "kubernetes-the-hard-way"
title: "Kubernetes The Hard Way"
active: true
featured: true
force_waitlist: true  # Włącz listę rezerwową mimo przyszłej daty

dates:
  - "2025-11-25"
  - "2025-11-26"
time: "9:00 – 17:00"

# ... reszta konfiguracji
```

## Technikalia

- Zmiany w `layouts/training/single.html` wprowadzają zmienną `$showWaitlist`
- JavaScript w `static/js/training.js` sprawdza atrybut `data-training-past`
- Formularz listy rezerwowej zapisuje dane przez API endpoint `/api/training-waitlist`
- Cloudflare Turnstile jest używany do ochrony przed spamem
