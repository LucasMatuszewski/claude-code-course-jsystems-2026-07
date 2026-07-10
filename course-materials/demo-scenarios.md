# 04 — Scenariusze demo

Cel: gotowe scenariusze prowadzenia pokazów na żywo dla 3 profili uczestników + kontrolowane „porażki”, które uczą praktyki pracy z AI agentami.

> Kontekst kursu: 5 dni „AI w programowaniu”, ścieżka Codex-first, z krótkimi porównaniami do Claude/IntelliJ, oraz z tłumaczeniem „cloud max” vs „on-prem/local”.

---

## Jak używać tego pliku na szkoleniu

- Wybierz **1 scenariusz główny** na blok demo (nie próbuj robić wszystkich naraz).
- Każdy scenariusz ma:
  - **Cel biznesowy** (po co to robimy),
  - **Przebieg demo** (co pokazuję krok po kroku),
  - **Wersję cloud** i **wersję on-prem**,
  - **Najczęstsze potknięcia** i szybką reakcję trenera.
- Po każdym demo: 5–10 min refleksji (co zadziałało, co nie, co wdrożyć „od jutra”).

---

## Scenariusz A — „Junior dev, który boi się zepsuć produkcję”

### Profil
Początkujący lub junior-mid, zna podstawy Git/IDE, ale ma niski poziom pewności przy większych zmianach.

### Cel biznesowy
Pokazać, że agent może przyspieszać codzienną pracę, ale **bez utraty kontroli** (małe kroki, testy, czytelne commity).

### Przebieg demo (15–25 min)
1. Definiuję małe zadanie: np. „dodaj walidację formularza + komunikaty błędów”.
2. Tworzę krótki prompt z kryteriami akceptacji.
3. Uruchamiam agenta i proszę o plan + zmiany w małych commitach.
4. Pokazuję diff i tłumaczę, co sprawdzam przed akceptacją.
5. Uruchamiam testy/linter i poprawiam jedną rzecz ręcznie (świadoma współpraca człowiek+AI).
6. Podsumowuję: co zrobił agent dobrze, a gdzie potrzebował doprecyzowania.

### Wariant cloud (max możliwości)
- Agent z pełnym dostępem do repo i automatycznym podglądem zmian.
- Szybkie iteracje promptów + ewentualna integracja z PR flow.

### Wariant on-prem/local
- Agent lokalny lub przez firmowy endpoint modelu.
- Te same kroki, ale z naciskiem na ograniczenia kontekstu i kontrolę danych.

### Najczęstsze potknięcia + reakcja
- „Agent zrobił za dużo naraz” → wracam do mniejszego zakresu i twardszych kryteriów.
- „Kod działa, ale jest nieczytelny” → proszę o refactor pod standard zespołu.
- „Junior ufa każdej odpowiedzi” → obowiązkowy checklista: diff, testy, logika biznesowa.

---

## Scenariusz B — „Ekspert SQL/DB, który chce konkretu i bezpieczeństwa”

### Profil
Doświadczony w bazach danych, sceptyczny wobec „magii AI”, oczekuje precyzji, wydajności i audytowalności.

### Cel biznesowy
Pokazać, że AI pomaga w analizie zapytań, migracji i diagnostyce, ale decyzje architektoniczne nadal należą do człowieka.

### Przebieg demo (20–30 min)
1. Biorę problem: wolne zapytanie / nieoptymalny join / ryzyko N+1.
2. Proszę agenta o:
   - analizę przyczyn,
   - 2–3 warianty poprawy,
   - trade-offy (wydajność, koszt, złożoność).
3. Wspólnie oceniamy plan indeksów i wpływ na zapis/odczyt.
4. Tworzymy bezpieczny plan migracji (rollback + monitoring).
5. Domykamy demo krótkim „co wdrożyć jutro w waszym zespole”.

### Wariant cloud
- Szybsza iteracja i bogatsze narzędzia analityczne.
- Łatwiejsze generowanie dokumentacji technicznej zmian.

### Wariant on-prem/local
- Praca na zanonimizowanych danych / snapshotach.
- Większy nacisk na polityki dostępu, logowanie działań i kontrolę promptów.

### Najczęstsze potknięcia + reakcja
- „AI proponuje indeks bez kontekstu obciążenia” → wymagamy danych o ruchu i planów wykonania.
- „Zbyt ogólny opis migracji” → doprecyzowujemy kolejność kroków + rollback.
- „Brak bezpieczeństwa danych” → natychmiast wracamy do danych testowych i zasad DLP.

---

## Scenariusz C — „Architekt/Tech Lead: governance, CI/CD i ryzyko”

### Profil
Osoba odpowiedzialna za standardy, bezpieczeństwo, jakość i proces dostarczania.

### Cel biznesowy
Pokazać jak wdrożyć agentic workflow tak, żeby zespół był szybszy, ale nadal zgodny z wymaganiami organizacji.

### Przebieg demo (20–30 min)
1. Definiuję politykę: co agent może robić sam, co wymaga akceptacji.
2. Pokazuję przykładowy pipeline:
   - generacja zmiany,
   - testy/lint,
   - security checks,
   - bramki akceptacji.
3. Przechodzę przez przykład „change request” od opisu do PR.
4. Omawiam metryki: czas realizacji, liczba poprawek, jakość.
5. Zamknięcie: minimalny „starter policy pack” do wdrożenia po szkoleniu.

### Wariant cloud
- Integracje z repo/PR i szybkie feedback loops.
- Łatwe uruchamianie agentów pod konkretne taski.

### Wariant on-prem/local
- Modele przez endpointy firmowe, logowanie i retencja zgodna z polityką.
- Integracja z Jenkins/GitHub Enterprise/Argo (na poziomie wzorca, bez głębokiego infra-dive).

### Najczęstsze potknięcia + reakcja
- „Brak granic odpowiedzialności agenta” → wprowadzamy policy matrix (dozwolone/zabronione).
- „Za dużo automatyzacji od razu” → start od 1–2 bezpiecznych use-case’ów.
- „Brak metryk sukcesu” → definiujemy KPI przed rolloutem.

---

## Failure scenarios (kontrolowane porażki, które uczą)

Każdy z tych scenariuszy uruchamiaj celowo 1 raz, żeby grupa zobaczyła realny problem i dobrą reakcję.

### F1 — Halucynacja API/feature
- **Objaw:** agent używa nieistniejącej metody lub parametru.
- **Szybka reakcja:** stop, weryfikacja w docs, poprawka promptu o wersję i źródło.
- **Lekcja:** „AI to akcelerator, nie źródło prawdy”.

### F2 — Zbyt szeroki zakres zmian
- **Objaw:** jedna komenda zmienia pół projektu.
- **Szybka reakcja:** cofnięcie, rozbicie tasku na mniejsze kroki, twarde granice katalogów/plików.
- **Lekcja:** kontrola zakresu > tempo.

### F3 — Testy przechodzą, ale wymaganie biznesowe niespełnione
- **Objaw:** „green build”, a funkcja nie robi tego, co trzeba.
- **Szybka reakcja:** dopisanie testu scenariuszowego i kryteriów akceptacji językiem biznesowym.
- **Lekcja:** testy techniczne nie zastąpią zrozumienia celu.

### F4 — Prompt zbyt ogólny (chaotyczna odpowiedź)
- **Objaw:** agent daje „ładny, ale bezużyteczny” wynik.
- **Szybka reakcja:** narzucenie struktury odpowiedzi (kroki, format, kryteria sukcesu).
- **Lekcja:** jakość promptu = jakość wyniku.

### F5 — Ryzyko danych wrażliwych
- **Objaw:** do promptu trafiają dane, które nie powinny opuścić organizacji.
- **Szybka reakcja:** przerwanie, anonimizacja, użycie danych syntetycznych.
- **Lekcja:** bezpieczeństwo danych jest ważniejsze niż tempo demo.

---

## Szybkie mapowanie: który scenariusz do którego dnia

- **Day 1:** A (Junior) + F4
- **Day 2:** A/B (zależnie od grupy) + F2
- **Day 3:** B + F1
- **Day 4:** C + F5
- **Day 5:** C + F3 (podsumowanie governance + jakość)

---

## Mini-checklista trenera przed każdym demo

- Czy cel biznesowy jest jasny jednym zdaniem?
- Czy zakres jest mały i mierzalny?
- Czy mam przygotowany fallback, gdy agent się pomyli?
- Czy wiem, co pokażę jako „cloud max”, a co jako „on-prem odpowiednik”?
- Czy mam pytanie do grupy na refleksję po demo?

---

## Powiązane pliki

- Program i baseline:
  - `materials/references/jsystems-program-ai-od-pomyslu-do-mvp.md`
  - `materials/references/silky-source-map.md`
- Skrypty dni:
  - `materials/scripts/day-1-script.md`
  - `materials/scripts/day-2-script.md`
  - `materials/scripts/day-3-script.md`
  - `materials/scripts/day-4-script.md`
  - `materials/scripts/day-5-script.md`
- Ćwiczenia i prompty:
  - `exercises/03-exercises.md`
  - `prompts/02-module-prompts.md`
