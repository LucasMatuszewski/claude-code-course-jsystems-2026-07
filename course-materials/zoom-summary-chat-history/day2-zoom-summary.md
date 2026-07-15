## Szybkie podsumowanie

Spotkanie było sesją szkoleniową skoncentrowaną na wykorzystaniu Clouda i powiązanych agentów AI do zadań deweloperskich i automatyzacyjnych. JSystems poprowadził grupę przez skonfigurowanie uwierzytelniania GitHub, konfigurowanie uprawnień agenta i zrozumienie różnic między ustawieniami globalnymi a na poziomie projektu. Uczestnicy omówili tryby pracy, w tym tryb automatyczny i ręczny oraz sposób kontrolowania zachowania agenta za pomocą ustawień i plików instrukcji. Sesja obejmowała tworzenie i udoskonalanie promptów, wykorzystanie modeli takich jak Haiku, Sonnet i Fabel oraz delegowanie zadań podagentom. JSystems zademonstrował generowanie dokumentacji projektowej, takiej jak PRD i ADR, oraz pokazał, jak wykorzystać umiejętności i narzędzia takie jak Context7 do wyszukiwania dokumentacji. Grupa zbadała również pracę z maszynami wirtualnymi, zdalne sterowanie i kwestie bezpieczeństwa podczas uruchamiania agentów lokalnie lub w chmurze. Przez cały czas uczestnicy tacy jak Piotr, Kasia, Grzegorz i Daniel zadawali pytania dotyczące uprawnień, preferencji językowych oraz praktycznego wykorzystania wygenerowanych planów i dokumentacji.
## Kolejne kroki

### JSystems

- Zaktualizuj materiały szkoleniowe, aby odzwierciedlały prawidłowe nazwy modeli i usuń przestarzałe odniesienia do MCP.[](https://tasks.zoom.us?meetingId=b47LmN2qR4KwPnDzGdXQSg%3D%3D&stepId=afc5506e-7f93-11f1-9d2a-dac80cfc741e)
- Dostarcz listę kontrolną i opisy wyjaśniające różnice w pracy z modelami, które zostaną podane jutro.[](https://tasks.zoom.us?meetingId=b47LmN2qR4KwPnDzGdXQSg%3D%3D&stepId=afc55ae0-7f93-11f1-a72f-dac80cfc741e)
- Napraw problem z niestandardowym poleceniem, które nie pojawia się u Grzegorza i zbadaj przyczynę.[](https://tasks.zoom.us?meetingId=b47LmN2qR4KwPnDzGdXQSg%3D%3D&stepId=afc55fe3-7f93-11f1-8798-dac80cfc741e)
- Popraw i usuń globalny plik ustawień, który został omyłkowo dodany do repozytorium.[](https://tasks.zoom.us?meetingId=b47LmN2qR4KwPnDzGdXQSg%3D%3D&stepId=afc56448-7f93-11f1-8013-dac80cfc741e)
- Ulepsz instrukcje dla agenta, aby upewnić się, że wykonuje on zadania poprzez tworzenie poprawek zgodnie z przeznaczeniem.[](https://tasks.zoom.us?meetingId=b47LmN2qR4KwPnDzGdXQSg%3D%3D&stepId=afc5688e-7f93-11f1-857c-dac80cfc741e)

### Piotr

- Edytuj uprawnienia tokena GitHub, aby uwzględnić dostęp do sekretów i zmiennych zgodnie z omówieniem.[](https://tasks.zoom.us?meetingId=b47LmN2qR4KwPnDzGdXQSg%3D%3D&stepId=afc56c93-7f93-11f1-9b42-dac80cfc741e)

### Współpraca

- Wszyscy uczestnicy: Przetestuj zdolność agenta do realizacji planu i kontynuuj sesję jutro.[](https://tasks.zoom.us?meetingId=b47LmN2qR4KwPnDzGdXQSg%3D%3D&stepId=afc57086-7f93-11f1-a279-dac80cfc741e)
- Wszyscy uczestnicy: Rozważ stworzenie planu generalnego dla większych projektów w celu zarządzania zależnościami i kolejnością wdrażania.[](https://tasks.zoom.us?meetingId=b47LmN2qR4KwPnDzGdXQSg%3D%3D&stepId=afc5742a-7f93-11f1-8f1c-dac80cfc741e)

## Podsumowanie

### Sesja szkoleniowa GitHub CLI

Drugiego dnia szkolenia firma JSystems przeprowadziła sesję szkoleniową na temat uwierzytelniania GitHub CLI i generowania tokenów. Zespół omówił, jak prawidłowo skonfigurować tokeny GitHub z odpowiednimi uprawnieniami, w tym dostępem do akcji, zmiennych, przestrzeni kodowych, tajemnic i przepływów pracy. Piotr napotkał pewne problemy z konfiguracją tokenów w terminalu Clouda, a grupa pracowała nad krokami rozwiązywania problemów, w tym weryfikacją poprawnego formatu tokenów i uprawnień. Sesja skupiła się na praktycznym wdrożeniu narzędzi GitHub CLI i obiegów pracy agentów w ramach szkolenia.
### Aktualizacje konfiguracji i uprawnień Claude'a

Zespół omówił aktualizacje repozytorium konfiguracji i szkoleń Claude’a, a JSystems wyjaśnił, że zmiany muszą być pobierane z repozytorium upstream/remote i aktualizowane w plikach konfiguracyjnych Claude na poziomie użytkownika. Kasia zadała pytania dotyczące interakcji ustawień projektu z ustawieniami na poziomie użytkownika, zauważając, że czasami doświadcza problemów, gdy agent próbuje wymusić aktualizacje zablokowane przez ustawienia projektu. Dyskusja dotyczyła najlepszych praktyk zarządzania uprawnieniami dostępu Claude’a i obsługi wrażliwych danych, a JSystems wyjaśnił, że chociaż agent może być skonfigurowany z zasadami i ograniczeniami, są to raczej żądania niż twarde blokady, a dane produkcyjne powinny być zanonimizowane podczas udostępniania agentowi.
### Dyskusja na temat konfiguracji technicznej JSystems

JSystems omówił ustawienia techniczne i kwestie konfiguracji, wyjaśniając, że niektóre globalne ustawienia powinny być przechowywane na poziomie projektu, a nie w katalogach użytkowników. Zespół omówił różne konfiguracje agentów dla Cloud i innych narzędzi, zauważając, że podagenty są niekompatybilne między różnymi narzędziami. Firma JSystems zademonstrowała różne tryby pracy, w tym interaktywne, bezgłowe i CLI wersje aplikacji, wyjaśniając zalety CLI dla kontynuacji sesji i pracy zdalnej.
### Claude Porównanie wersji aplikacji

Zespół omówił różnice między różnymi aplikacjami Claude'a, w tym CLI, wersjami desktopowymi i webowymi. JSystems wyjaśnił, że aplikacja desktopowa jest bardziej rozwinięta, ponieważ korzysta z niej zespół Antropika, podczas gdy wersja CLI jest używana przez pracowników Code Open. Piotr zapytał o pracę z plikami lokalnymi i integrację z chmurą, a JSystems wyjaśnił, że chociaż pliki są domyślnie przechowywane w chmurze, użytkownicy mogą pracować z plikami lokalnymi i synchronizować się z usługami takimi jak OneDrive czy Google Drive. Dyskusja dotyczyła również funkcji zdalnego sterowania i możliwości trybu automatycznego, chociaż JSystems zauważył pewne problemy techniczne z funkcjonalnością sesji zdalnej.
### Środowiska Linux dla pracy agentów

JSystems omówił zalety i wady używania różnych środowisk Linux, w tym WSL i maszyn wirtualnych, do pracy agentów. Podkreślili, że chociaż środowiska sandboksowe zapewniają dodatkowe bezpieczeństwo, mogą również ograniczać i potencjalnie zakłócać zadania agentów. JSystems podkreślił, że WSL nie zapewnia domyślnej izolacji bezpieczeństwa i zasugerował, że bardziej odpowiednie może być podejście maszyny wirtualnej, chociaż nadal wymaga starannej konfiguracji, aby zapewnić agentowi tylko niezbędny dostęp.
### Zdalny dostęp i rozwiązania agentów

Spotkanie koncentrowało się na omówieniu bezpiecznych sposobów pracy z agentami i środowiskami wirtualnymi. JSystems wyjaśnił różne opcje konfiguracji zdalnego dostępu, w tym korzystanie z usług chmurowych, takich jak Hetzner i Microsoft Windows 365, a także rozwiązań VPN, takich jak Tailscale i Cloudflare Tunnel. Dyskusja obejmowała również autonomiczne agenty, takie jak OpenClaw i Hermes, oraz szczegółowo opisała wykorzystanie niestandardowych poleceń w Claude’u, w tym rozwiązywanie problemów z nieprawidłowym wyświetlaniem poleceń Git. Zespół zajął się wyzwaniami technicznymi związanymi z dostępem do terminala i wykonywaniem poleceń, a JSystems dostarczył wskazówek dotyczących używania komendy /doctor w celu diagnozowania i rozwiązywania problemów z niestandardowymi poleceniami.
### Konfiguracja Gita dla agentów AI

JSystems zademonstrował konfigurację Gita i techniki monitowania do pracy z agentami AI, zwłaszcza Claude’em. Dyskusja dotyczyła prawidłowego konfigurowania i używania poleceń Gita, a JSystems wyjaśnił, że początkowe problemy Grzegorza były prawdopodobnie spowodowane wejściem do katalogu katalogowego przed uruchomieniem polecenia clone. JSystems omówił również najlepsze praktyki pracy z agentami AI, w tym dostarczanie kontekstu, zwięzłe wyświetlanie monitów i dodawanie danych osobowych, aby pomóc agentowi zrozumieć preferencje i uniknąć halucynacji. Sesja zawierała wskazówki dotyczące tworzenia i zarządzania plikami konfiguracyjnymi, a JSystems zalecał zapisywanie planów w repozytorium zamiast wewnątrz samego agenta.
### Wdrożenie dokumentacji aplikacji w chmurze

JSystems omówił implementację instrukcji i dokumentacji w aplikacji desktopowej Clouda, podkreślając zarówno zalety, jak i potencjalne wady. Podkreślił znaczenie utrzymywania dokumentacji specyficznej dla projektu w sposób ogólny i skoncentrowany, unikając niepotrzebnych szczegółów, które mogłyby utrudnić wydajność. JSystems rozwiał również obawy dotyczące aktualizacji i zarządzania plikami instrukcji, zauważając, że zbyt szczegółowe informacje mogą prowadzić do problemów podczas zmiany bibliotek lub środowisk. Dyskusja dotyczyła poziomu, na którym należy wdrażać instrukcje oraz sposobu skutecznego delegowania zadań między agentami a Kodeksem.
### Wdrażanie agentów na rzecz rozwoju

Zespół omówił agenty implementacyjne do tworzenia aplikacji, a JSystems wyjaśnił korzyści płynące z używania agentów do zadań takich jak recenzja kodu i testowanie pomimo wyższych kosztów tokenów. Piotr zadał pytania dotyczące preferencji językowych plików konfiguracyjnych, na które JSystems odpowiedział, że angielski lepiej sprawdza się w przypadku agentów na podstawie dowodów badawczych. Spotkanie miało krótką przerwę ze względu na ograniczenia czasowe, ponieważ uczestnicy mieli różną ilość czasu pozostałego do limitów odnowienia, a JSystems wspomniał o planach omówienia szczegółów wdrożenia backendowej aplikacji multimodalnej czatu podczas następnej sesji.
### Dyskusja na temat wdrożenia narzędzia PRD

Zespół omówił wykorzystanie narzędzia do generowania dokumentu wymagań produktowych (PRD) dla MVP „Hardware Service Decision Copilot”. JSystems wyjaśnił, jak korzystać z narzędzia, w tym instrukcje dotyczące monitowania i zarządzania procesem tworzenia dokumentu. Grupa zbadała funkcje takie jak przesyłanie obrazów, integracja baz danych i zapisy decyzji architektonicznych (ADR), a Piotr zapytał o możliwości edycji i zarządzanie sesjami. JSystems podkreślił znaczenie ADR jako wiążącej dokumentacji projektowej, która pomaga kierować zarówno programistami ludzkimi, jak i sztucznej inteligencji w tworzeniu aplikacji.
### Claude Model Identyfikacja Dyskusja

Grzegorz i JSystems omówili kwestie techniczne związane z pracą z modelami w Claude, ze szczególnym uwzględnieniem identyfikacji modeli i ich wersjonowania. JSystems zidentyfikował błąd w nazwie modelu i zapewnił prawidłowy format dla identyfikatorów modeli, podkreślając znaczenie umieszczenia numeru modelu na końcu. Badano również użycie poleceń do przeglądania zmian i zapewnienia prawidłowej konfiguracji, przy czym JSystems sugeruje poproszenie agenta o przeglądanie i odnotowywanie szczegółowych zmian. Dyskusja zakończyła się planami wykorzystania tego samego modelu w przyszłych pracach oraz uznaniem potrzeby wyjaśnienia instrukcji tworzenia komedii.
### Aktualizacje dokumentacji i procesu podejmowania zobowiązań

Zespół omówił kwestie związane z tworzeniem commitów i zmian w dokumentacji, a JSystems poinstruował, że commity powinny być wykonywane po zmianach, a aktualizacje dokumentacji mogą być zatwierdzane bezpośrednio. JSystems zademonstrował narzędzie do wyszukiwania dokumentacji, które może być używane przez agentów do znajdowania informacji na temat różnych bibliotek i frameworków, wyjaśniając, w jaki sposób może to pomóc usprawnić proces badawczy poprzez zapewnienie konkretnych narzędzi wyszukiwania nazw bibliotek i wyszukiwań frameworków. Dyskusja dotyczyła również wyzwań związanych z pracą zdalną oraz znaczenia przestrzegania prawidłowych instrukcji i historii sesji przy wprowadzaniu zmian.
### Narzędzia dokumentacyjne Delphi i Context7

Zespół omówił dokumentację i narzędzia do pracy z Delphi oraz Context7. Grzegorz wyjaśnił, że dla Delphi dostępna jest obszerna dokumentacja, w tym książki i zasoby internetowe. JSystems i Grzegorz omówili przejście z MCP (Model Context Protocol) na narzędzia CLI, przy czym JSystems wyjaśnił, że narzędzia CLI takie jak Github CLI są dobrze znane i nie wymagają dodatkowych instrukcji, podczas gdy MCP wymaga więcej konfiguracji. Zespół pracował nad instalacją narzędzi Context7 CLI i omówił tworzenie plików ADR (Architectural Decision Records) w celu udokumentowania procesu i zapewnienia wskazówek dla przyszłych agentów.
### Otwarta konfiguracja routera i umiejętności

Zespół omówił tworzenie i konfigurowanie modeli Open Router, w tym uprawnień i kluczy API w settings.json. Zbadano wykorzystanie skills.sh do instalowania i zarządzania narzędziami i umiejętnościami dla agentów, a JSystems pokazał, jak zainstalować określone umiejętności, takie jak SQLite Database Expert. Dyskusja dotyczyła najlepszych praktyk wdrażania umiejętności zarówno na poziomie projektu, jak i globalnym, a Kasia zadawała wyjaśniające pytania dotyczące procesu instalacji i struktury plików.
### Dyskusja na temat wdrożenia PRD i ADR

Zespół omówił współpracę z agentami oraz wdrożenie dokumentów PRD i ADR do tworzenia aplikacji. JSystems wyjaśnił, że chociaż dokumenty te są przydatne do zapewnienia kontekstu i przeglądu architektury, nie muszą być tworzone dla całej aplikacji na raz, zwłaszcza w przypadku mniejszych projektów. Grupa zgodziła się kontynuować dyskusję następnego dnia, a JSystems planuje dostarczyć listę kontrolną i dodatkowe wskazówki dotyczące pracy z agentami i wdrażania systemów projektowych. Kilku uczestników, w tym Michał i Grzegorz, zasygnalizowało, że ze względu na ograniczenia czasowe będą kontynuować sesję następnego dnia.
