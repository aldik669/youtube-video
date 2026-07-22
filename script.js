/* ============================================================
   KURSOR — доступ к видео по 8-значному коду + трекинг просмотра
   ============================================================

   ⚠️ ВАЖНО ПРО БЕЗОПАСНОСТЬ:
   Проверка кода происходит ЗДЕСЬ, в браузере (на стороне клиента),
   и трекинг процента тоже считается в браузере. Это НЕ надёжная защита:
     • правило «8 цифр» видно в коде страницы;
     • видеофайл лежит по прямому пути и его можно открыть напрямую;
     • процент просмотра теоретически можно подделать в браузере.
   Такой подход годится для МЯГКОГО ограничения и ориентировочной
   аналитики «кто и сколько посмотрел», но НЕ для секретного контента
   и не для строгой отчётности. Для настоящей защиты нужен сервер.
   ============================================================ */

/* ---------- CONFIG: всё, что легко менять ---------- */
const CONFIG = {
  // Путь к видеофайлу. Подмените файл в папке video/ или укажите другой путь/URL.
  videoSrc: "video/nurmashvideo.mp4",
  videoType: "video/mp4",

  // Ключи для localStorage (запоминаем вход и код клиента).
  storageKey: "kursor_video_access",
  codeKey: "kursor_client_code",

  // URL веб-приложения Apps Script (из деплоя в apps-script/Code.gs).
  trackingUrl: "https://script.google.com/macros/s/AKfycbwEupKsFyi7WqfSB-8dYLqYG6tQHor1IL6XZ6fJXX_FwFJb_m-arwM6RKTJSvgp6Zr6/exec",
};

/* ---------- Находим элементы на странице ---------- */
const lockScreen = document.getElementById("lockScreen");
const videoScreen = document.getElementById("videoScreen");
const passwordForm = document.getElementById("passwordForm");
const passwordInput = document.getElementById("passwordInput");
const errorMsg = document.getElementById("errorMsg");
const logoutBtn = document.getElementById("logoutBtn");
const videoPlayer = document.getElementById("videoPlayer");

/* ---------- Состояние трекинга ---------- */
let clientCode = "";     // текущий код клиента (8 цифр)
let maxPercent = 0;      // максимальный досмотренный процент за сессию

/* ---------- Проверка кода: ровно 8 цифр ---------- */
function isValidCode(value) {
  return /^\d{8}$/.test(value);
}

/* ---------- Отправка прогресса в Google-таблицу ---------- */
// useBeacon = true — для момента ухода со страницы (надёжная доставка).
function sendProgress(useBeacon) {
  // Если URL ещё не вставлен — просто ничего не отправляем (сайт работает как есть).
  if (!clientCode) return;
  if (!CONFIG.trackingUrl || CONFIG.trackingUrl.indexOf("http") !== 0) return;

  const payload = JSON.stringify({
    code: clientCode,
    percent: Math.round(maxPercent),
  });

  try {
    if (useBeacon && navigator.sendBeacon) {
      // sendBeacon доставляет данные, даже если страницу закрывают
      const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
      navigator.sendBeacon(CONFIG.trackingUrl, blob);
    } else {
      // Обычная отправка. mode:no-cors — чтобы браузер не блокировал запрос
      // к Apps Script (ответ читать не нужно, это «отправил и забыл»).
      fetch(CONFIG.trackingUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: payload,
        keepalive: true,
      });
    }
  } catch (e) {
    /* сеть недоступна — не критично */
  }
}

/* ---------- Обновление максимального процента просмотра ---------- */
function updatePercent() {
  if (!videoPlayer.duration || isNaN(videoPlayer.duration)) return;
  const pct = (videoPlayer.currentTime / videoPlayer.duration) * 100;
  if (pct > maxPercent) maxPercent = pct;
}

/* ---------- Навешиваем трекинг на плеер ---------- */
function attachTracking() {
  // Считаем прогресс по ходу воспроизведения
  videoPlayer.addEventListener("timeupdate", updatePercent);

  // Пауза — фиксируем, сколько досмотрел
  videoPlayer.addEventListener("pause", () => {
    updatePercent();
    sendProgress(false);
  });

  // Видео закончилось — 100%
  videoPlayer.addEventListener("ended", () => {
    maxPercent = 100;
    sendProgress(false);
  });

  // Переключил вкладку / свернул — отправляем текущий прогресс
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      updatePercent();
      sendProgress(true);
    }
  });

  // Закрытие/уход со страницы — надёжная отправка через sendBeacon
  window.addEventListener("pagehide", () => {
    updatePercent();
    sendProgress(true);
  });
  window.addEventListener("beforeunload", () => {
    updatePercent();
    sendProgress(true);
  });

  // Подстраховка: раз в 15 секунд во время игры отправляем прогресс
  setInterval(() => {
    if (!videoPlayer.paused && !videoPlayer.ended && clientCode) {
      updatePercent();
      sendProgress(false);
    }
  }, 15000);
}

/* ---------- Подставляем источник видео (один раз) ---------- */
function ensureVideoSource() {
  if (!videoPlayer.querySelector("source")) {
    const source = document.createElement("source");
    source.src = CONFIG.videoSrc;
    source.type = CONFIG.videoType;
    videoPlayer.appendChild(source);
    videoPlayer.load();
  }
}

/* ---------- Показ экрана видео ---------- */
function showVideo() {
  lockScreen.classList.add("is-hidden");

  setTimeout(() => {
    lockScreen.hidden = true;
    ensureVideoSource();

    videoScreen.hidden = false;
    videoScreen.classList.add("is-hidden");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => videoScreen.classList.remove("is-hidden"));
    });
  }, 380);
}

/* ---------- Показ экрана ввода (выход) ---------- */
function showLock() {
  videoPlayer.pause();

  videoScreen.hidden = true;
  lockScreen.hidden = false;

  lockScreen.classList.add("is-hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => lockScreen.classList.remove("is-hidden"));
  });

  passwordInput.value = "";
  clearError();
}

/* ---------- Ошибка неверного кода ---------- */
function showError() {
  errorMsg.hidden = false;
  passwordInput.classList.remove("error");
  void passwordInput.offsetWidth; // reflow, чтобы shake-анимация повторилась
  passwordInput.classList.add("error");
}

function clearError() {
  errorMsg.hidden = true;
  passwordInput.classList.remove("error");
}

/* ---------- Обработка отправки формы ---------- */
passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const entered = passwordInput.value.trim();

  if (isValidCode(entered)) {
    // Код валиден (8 цифр) — запоминаем клиента и открываем видео
    clientCode = entered;
    maxPercent = 0;

    try {
      localStorage.setItem(CONFIG.storageKey, "true");
      localStorage.setItem(CONFIG.codeKey, clientCode);
    } catch (e) {
      /* приватный режим — не критично */
    }

    // Сразу отмечаем в таблице, что клиент открыл видео (0%)
    sendProgress(false);

    clearError();
    showVideo();
  } else {
    // Не 8 цифр — показываем ошибку
    showError();
  }
});

/* ---------- Убираем ошибку при вводе ---------- */
passwordInput.addEventListener("input", clearError);

/* ---------- Кнопка «Выйти» ---------- */
logoutBtn.addEventListener("click", () => {
  // Перед выходом фиксируем финальный прогресс
  updatePercent();
  sendProgress(true);

  try {
    localStorage.removeItem(CONFIG.storageKey);
    localStorage.removeItem(CONFIG.codeKey);
  } catch (e) {
    /* игнорируем */
  }

  clientCode = "";
  maxPercent = 0;
  showLock();
});

/* ---------- Инициализация при загрузке ---------- */
attachTracking();

(function init() {
  let hasAccess = false;
  let savedCode = "";
  try {
    hasAccess = localStorage.getItem(CONFIG.storageKey) === "true";
    savedCode = localStorage.getItem(CONFIG.codeKey) || "";
  } catch (e) {
    hasAccess = false;
  }

  // Восстанавливаем доступ только если сохранён валидный код
  if (hasAccess && isValidCode(savedCode)) {
    clientCode = savedCode;
    maxPercent = 0;

    lockScreen.hidden = true;
    ensureVideoSource();
    videoScreen.hidden = false;
  }
})();
