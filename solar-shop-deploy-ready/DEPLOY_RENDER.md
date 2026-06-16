# Деплой Solar Shop на Render

Цей проєкт складається з:
- `client/` — React + Vite фронтенд;
- `server/` — Node.js + Express API;
- SQLite база, яка в продакшені має лежати на persistent disk.

## 1. Підготовка репозиторію

1. Розпакуй цей архів.
2. Створи новий репозиторій на GitHub.
3. Завантаж в репозиторій усі файли з цієї папки, крім `node_modules`, `dist`, `.DS_Store`, `.env`, `*.sqlite`.
4. Переконайся, що в корені є файл `render.yaml`.

## 2. Деплой через Render Blueprint

1. Зайди в Render Dashboard.
2. Натисни **New** → **Blueprint**.
3. Підключи GitHub-репозиторій із цим сайтом.
4. Render прочитає `render.yaml`.
5. Коли Render попросить секретні змінні, введи:
   - `ADMIN_EMAIL` — email адміна;
   - `ADMIN_PASSWORD` — сильний пароль адміна.
6. Натисни **Apply** / **Create**.

Render виконає збірку:

```bash
cd server && npm ci && cd ../client && npm ci && npm run build && rm -rf ../server/public && mkdir -p ../server/public && cp -r dist/* ../server/public/
```

Потім запустить сервер:

```bash
cd server && npm start
```

## 3. Перевірка після деплою

1. Відкрий URL виду `https://solar-shop.onrender.com`.
2. Перевір API: `https://solar-shop.onrender.com/api/health`.
3. Увійди в адмінку з email/паролем, які задав у Render.
4. Перевір каталог, кошик, оформлення замовлення та адмін-панель.

## 4. Важливо

- Для SQLite потрібен persistent disk. У цьому архіві база налаштована через `DB_PATH=/var/data/data.sqlite`.
- Не коміть `server/data.sqlite` у GitHub, якщо там є реальні користувачі або замовлення.
- Не залишай стандартний `JWT_SECRET` — у `render.yaml` Render генерує його автоматично.
- Якщо хочеш безкоштовний хостинг без втрати даних, краще переробити базу з SQLite на PostgreSQL.
