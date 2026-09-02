# Legal (PlotOps)

Юридические документы для некоммерческого pet-проекта PlotOps. Исходники — markdown в этой папке; в приложении рендерятся на публичных маршрутах.

| Документ                                   | Markdown (RU / EN)                                                                              | URL        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------- |
| Пользовательское соглашение / Terms of Use | [`user-agreement-ru.md`](user-agreement-ru.md) · [`user-agreement-en.md`](user-agreement-en.md) | `/terms`   |
| Политика обработки ПДн / Privacy policy    | [`privacy-policy-ru.md`](privacy-policy-ru.md) · [`privacy-policy-en.md`](privacy-policy-en.md) | `/privacy` |

Язык на `/terms` и `/privacy` выбирается по текущей локали i18n (`en` → `*-en.md`, иначе `*-ru.md`).

## Где видны пользователю

- `/terms`, `/privacy` — публичные страницы (без входа)
- футер sign-in / sign-up / complete-profile
- страница `/about` (для авторизованных)

## Редактирование

1. Меняйте markdown в `docs/legal/`.
2. Пересборка/ hot reload подхватит изменения (импорт `?raw` из `src/features/legal/model/documents.ts`).

Контактный e-mail укажите на `/about` или в footer — в тексте документов ФИО не требуется.

**Disclaimer:** инженерный черновик, не legal advice.
