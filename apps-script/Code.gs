/* ============================================================
   KURSOR — трекинг просмотра видео в Google-таблицу
   ------------------------------------------------------------
   Как установить:
   1. Открой свою Google-таблицу.
   2. Меню: Расширения → Apps Script.
   3. Удали весь стандартный код и вставь этот файл целиком.
   4. Сохрани (значок дискеты).
   5. Deploy → New deployment → тип "Web app":
        • Description: любое (например "kursor tracker")
        • Execute as: Me (твой аккаунт)
        • Who has access: Anyone   ← ВАЖНО, иначе сайт не сможет писать
   6. Нажми Deploy, разреши доступ своему аккаунту.
   7. Скопируй "Web app URL" (вида https://script.google.com/macros/s/.../exec)
      и вставь его в script.js → CONFIG.trackingUrl.

   Таблица (лист) должна иметь заголовки:
      A1 = Уникальный код клиент
      B1 = %просмотрел
   Колонка C (время обновления) создаётся автоматически.
   ============================================================ */

// Имя листа. Если у тебя лист называется иначе — поменяй.
// Если не найдёт по имени — возьмёт первый лист таблицы.
const SHEET_NAME = 'Лист1';

const CODE_COL = 1; // A — уникальный код клиента
const PCT_COL = 2;  // B — % просмотра
const TIME_COL = 3; // C — время последнего обновления (создаётся само)

/**
 * Приём данных от сайта (метод POST).
 * Тело запроса: JSON вида { "code": "12345678", "percent": 47 }
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // защита от одновременной записи
  try {
    const data = JSON.parse(e.postData.contents);
    const code = String(data.code || '').trim();
    let percent = Math.round(Number(data.percent) || 0);

    // Проверяем на сервере: ровно 8 цифр (и ничего кроме цифр)
    if (!/^\d{8}$/.test(code)) {
      return json({ ok: false, error: 'invalid_code' });
    }
    // Ограничиваем 0..100
    percent = Math.max(0, Math.min(100, percent));

    const sheet = getSheet();

    // Ищем, есть ли уже строка с этим кодом
    const lastRow = sheet.getLastRow();
    let rowIndex = -1;
    if (lastRow >= 2) {
      const codes = sheet.getRange(2, CODE_COL, lastRow - 1, 1).getValues();
      for (let i = 0; i < codes.length; i++) {
        if (String(codes[i][0]).trim() === code) {
          rowIndex = i + 2; // +2: пропускаем заголовок и переводим в 1-based
          break;
        }
      }
    }

    const now = new Date();

    if (rowIndex === -1) {
      // Новый клиент — добавляем строку.
      // Код пишем как ТЕКСT (формат '@'), чтобы не терялся ведущий ноль.
      const newRow = sheet.getLastRow() + 1;
      sheet.getRange(newRow, CODE_COL).setNumberFormat('@').setValue(code);
      sheet.getRange(newRow, PCT_COL).setValue(percent);
      sheet.getRange(newRow, TIME_COL).setValue(now);
    } else {
      // Уже был — храним МАКСИМАЛЬНЫЙ досмотренный процент,
      // чтобы значение не откатывалось назад при перемотке/повторном заходе.
      const prev = Number(sheet.getRange(rowIndex, PCT_COL).getValue()) || 0;
      sheet.getRange(rowIndex, PCT_COL).setValue(Math.max(prev, percent));
      sheet.getRange(rowIndex, TIME_COL).setValue(now);
    }

    return json({ ok: true, code: code, percent: percent });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Проверка, что веб-приложение живо (открой Web app URL в браузере).
 */
function doGet() {
  return json({ ok: true, msg: 'KURSOR tracker alive' });
}

/** Возвращает нужный лист (по имени или первый). */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

/** Ответ в формате JSON. */
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
