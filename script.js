/* ============================================================
   KURSOR — логика защиты видео паролем
   ============================================================

   ⚠️ ВАЖНО ПРО БЕЗОПАСНОСТЬ:
   Проверка пароля происходит ЗДЕСЬ, в браузере (на стороне клиента).
   Это НЕ настоящая защита:
     • пароль виден в исходном коде страницы (этот файл открыт любому);
     • видеофайл лежит по прямому пути "video/video.mp4" и его можно
       открыть/скачать напрямую, минуя проверку пароля.
   Такой подход годится только для МЯГКОГО ограничения доступа
   (например, чтобы случайный человек не попал на страницу),
   но НЕ для по-настоящему секретного контента.
   Для реальной защиты нужен сервер: проверка пароля на бэкенде и
   отдача видео только авторизованным пользователям.
   ============================================================ */

/* ---------- CONFIG: всё, что легко менять ---------- */
const CONFIG = {
  // Пароль для доступа. Меняйте это значение, чтобы сменить пароль.
  password: "kursor2026",

  // Путь к видеофайлу. Подмените файл в папке video/ или укажите другой путь.
  videoSrc: "video/video.mp4",

  // Тип видео для тега <source>.
  videoType: "video/mp4",

  // Ключ, под которым в localStorage хранится факт успешного входа.
  storageKey: "kursor_video_access",
};

/* ---------- Находим элементы на странице ---------- */
const lockScreen = document.getElementById("lockScreen");
const videoScreen = document.getElementById("videoScreen");
const passwordForm = document.getElementById("passwordForm");
const passwordInput = document.getElementById("passwordInput");
const errorMsg = document.getElementById("errorMsg");
const logoutBtn = document.getElementById("logoutBtn");
const videoPlayer = document.getElementById("videoPlayer");

/* ---------- Показ экрана видео ---------- */
function showVideo() {
  // Плавно прячем экран пароля
  lockScreen.classList.add("is-hidden");

  // После завершения fade-анимации полностью убираем экран пароля из потока
  setTimeout(() => {
    lockScreen.hidden = true;

    // Подставляем источник видео из CONFIG (один раз, при показе)
    if (!videoPlayer.querySelector("source")) {
      const source = document.createElement("source");
      source.src = CONFIG.videoSrc;
      source.type = CONFIG.videoType;
      videoPlayer.appendChild(source);
      videoPlayer.load();
    }

    // Показываем экран видео с плавным появлением
    videoScreen.hidden = false;
    // Небольшая задержка, чтобы сработал transition opacity
    videoScreen.classList.add("is-hidden");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => videoScreen.classList.remove("is-hidden"));
    });
  }, 380);
}

/* ---------- Показ экрана пароля (выход) ---------- */
function showLock() {
  // Останавливаем видео при выходе
  videoPlayer.pause();

  videoScreen.hidden = true;
  lockScreen.hidden = false;

  // Плавно возвращаем экран пароля
  lockScreen.classList.add("is-hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => lockScreen.classList.remove("is-hidden"));
  });

  // Сбрасываем поле и ошибку
  passwordInput.value = "";
  clearError();
}

/* ---------- Ошибка неверного пароля ---------- */
function showError() {
  errorMsg.hidden = false;
  passwordInput.classList.remove("error"); // сброс, чтобы анимация повторилась
  // reflow — принудительный пересчёт, чтобы re-триггерить shake
  void passwordInput.offsetWidth;
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

  if (entered === CONFIG.password) {
    // Пароль верный — сохраняем доступ и показываем видео
    try {
      localStorage.setItem(CONFIG.storageKey, "true");
    } catch (e) {
      // localStorage может быть недоступен (приватный режим) — не критично
    }
    clearError();
    showVideo();
  } else {
    // Пароль неверный — показываем ошибку
    showError();
  }
});

/* ---------- Убираем ошибку при вводе ---------- */
passwordInput.addEventListener("input", clearError);

/* ---------- Кнопка «Выйти» ---------- */
logoutBtn.addEventListener("click", () => {
  try {
    localStorage.removeItem(CONFIG.storageKey);
  } catch (e) {
    /* игнорируем */
  }
  showLock();
});

/* ---------- Проверка при загрузке страницы ---------- */
// Если раньше вход был успешным — сразу показываем видео без повторного ввода.
(function init() {
  let hasAccess = false;
  try {
    hasAccess = localStorage.getItem(CONFIG.storageKey) === "true";
  } catch (e) {
    hasAccess = false;
  }

  if (hasAccess) {
    // Показываем видео мгновенно (без анимации перехода)
    lockScreen.hidden = true;

    const source = document.createElement("source");
    source.src = CONFIG.videoSrc;
    source.type = CONFIG.videoType;
    videoPlayer.appendChild(source);
    videoPlayer.load();

    videoScreen.hidden = false;
  }
})();
