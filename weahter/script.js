let currentFetchedCity = "Ternopil";
let favorites = JSON.parse(localStorage.getItem("favCities")) || [];

// Глобальні змінні для карти Leaflet
let map;
let marker;

// Ініціалізація карти на весь світ
function initMap() {
  const startLat = 20;
  const startLon = 0;

  map = L.map('map', {
    minZoom: 2,  // Обмежуємо, щоб користувач не віддалив карту далі, ніж на весь світ
    maxZoom: 18  // Максимальне наближення вуличок
  }).setView([startLat, startLon], 2);

  // Підключаємо безкоштовні тайли від OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Створюємо базовий маркер
  marker = L.marker([startLat, startLon]).addTo(map);
}

// 1. Словник статусів погоди (WMO коди)
function getWeatherStatus(code) {
  const codes = {
    0: { text: "Ясно", icon: "☀️" },
    1: { text: "Переважно ясно", icon: "🌤️" },
    2: { text: "Мінлива хмарність", icon: "⛅" },
    3: { text: "Похмуро", icon: "☁️" },
    45: { text: "Туман", icon: "🌫️" },
    48: { text: "Паморозь", icon: "🌫️" },
    51: { text: "Легка мряка", icon: "🌧️" },
    53: { text: "Помірна мряка", icon: "🌧️" },
    55: { text: "Густа мряка", icon: "🌧️" },
    61: { text: "Невеликий дощ", icon: "🌧️" },
    63: { text: "Помірний дощ", icon: "🌧️" },
    65: { text: "Сильний дощ", icon: "🌧️" },
    71: { text: "Невеликий сніг", icon: "❄️" },
    73: { text: "Помірний сніг", icon: "❄️" },
    75: { text: "Сильний сніг", icon: "❄️" },
    80: { text: "Короткочасний дощ", icon: "🌦️" },
    95: { text: "Гроза", icon: "⛈️" }
  };
  return codes[code] || { text: "Змінна погода", icon: "⛅" };
}

// 2. Отримання скороченої назви дня тижня за датою
function getDayName(dateString) {
  const days = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const date = new Date(dateString);
  return days[date.getDay()];
}

// 3. Головна функція запиту погоди, локації та роботи з картою
async function getWeather(city = "Ternopil") {
  try {
    // Геокодинг: отримуємо координати за назвою міста
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=uk`
    );
    const geoData = await geo.json();

    if (!geoData.results || geoData.results.length === 0) {
      alert(`Місто "${city}" не знайдено. Спробуйте ще раз.`);
      return;
    }

    const lat = geoData.results[0].latitude;
    const lon = geoData.results[0].longitude;
    const cityName = geoData.results[0].name;
    const country = geoData.results[0].country || "";

    currentFetchedCity = cityName;

    // Плавний переліт карти з космосу до знайденого міста (зум 11)
    if (map && marker) {
      map.flyTo([lat, lon], 11, { animate: true, duration: 1.8 }); 
      marker.setLatLng([lat, lon]); 
      marker.bindPopup(`<b>${cityName}</b><br>Погода оновлена!`).openPopup();
    }

    // Запит метеоданих
    const weather = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max&timezone=auto`
    );
    const data = await weather.json();

    // Оновлення текстових блоків та емодзі на сторінці
    const currentData = data.current;
    const currentWeatherInfo = getWeatherStatus(currentData.weather_code);

    document.getElementById("city").innerHTML = country ? `${cityName}, ${country}` : cityName;
    document.getElementById("temp").innerHTML = `${Math.round(currentData.temperature_2m)}°C`;
    document.getElementById("status").innerHTML = currentWeatherInfo.text;
    
    const sunIconBlock = document.querySelector(".main-weather .sun");
    if (sunIconBlock) sunIconBlock.innerHTML = currentWeatherInfo.icon;

    document.getElementById("wind").innerHTML = Math.round(currentData.wind_speed_10m);
    document.getElementById("humidity").innerHTML = currentData.relative_humidity_2m;
    document.getElementById("pressure").innerHTML = Math.round(currentData.pressure_msl);

    document.getElementById("humidity2").innerHTML = `${currentData.relative_humidity_2m}%`;
    document.getElementById("wind2").innerHTML = `${Math.round(currentData.wind_speed_10m)} км/год`;
    document.getElementById("pressure2").innerHTML = `${Math.round(currentData.pressure_msl)} гПа`;

    // Оновлюємо стан зірочки (активна/пасивна)
    updateFavBtnIcon();

    // Динамічна зміна CSS-градієнтів картки залежно від погоди
    const weatherBox = document.getElementById("main-section");
    if (weatherBox) {
      weatherBox.classList.remove("bg-clear", "bg-clouds-light", "bg-clouds-heavy", "bg-rain", "bg-thunder", "bg-snow");
      const code = currentData.weather_code;

      if (code === 0) weatherBox.classList.add("bg-clear");
      else if (code === 1 || code === 2) weatherBox.classList.add("bg-clouds-light");
      else if (code === 3 || code === 45 || code === 48) weatherBox.classList.add("bg-clouds-heavy");
      else if ([51, 53, 55, 61, 63, 65, 80].includes(code)) weatherBox.classList.add("bg-rain");
      else if (code === 95) weatherBox.classList.add("bg-thunder");
      else if ([71, 73, 75].includes(code)) weatherBox.classList.add("bg-snow");
    }

    // Оновлення карток прогнозу на тиждень
    const dailyData = data.daily;
    const cards = document.querySelectorAll(".week .card");

    cards.forEach((card, index) => {
      if (dailyData && dailyData.time[index] !== undefined) {
        const dayName = getDayName(dailyData.time[index]);
        const dayWeather = getWeatherStatus(dailyData.weather_code[index]);
        const maxTemp = Math.round(dailyData.temperature_2m_max[index]);

        card.querySelector("h3").innerText = dayName;
        card.querySelector(".icon").innerText = dayWeather.icon;
        card.querySelector(".degree").innerText = `${maxTemp > 0 ? '+' : ''}${maxTemp}°`;
        
        if (index === 0) card.classList.add("active");
        else card.classList.remove("active");
      }
    });

  } catch (error) {
    alert("Сталася помилка при завантаженні даних.");
    console.error(error);
  }
}

// 4. Пошуковий рядок (обробка клавіші Enter)
const input = document.getElementById("cityInput");
if (input) {
  input.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      const trimmedValue = input.value.trim();
      if (trimmedValue !== "") {
        getWeather(trimmedValue);
        input.value = "";
        input.blur();
      }
    }
  });
}

// 5. Логіка збереження та відмальовування обраних міст (Favorites)
function renderFavorites() {
  const container = document.getElementById("favoritesTags");
  if (!container) return;
  container.innerHTML = "";
  favorites.forEach(city => {
    const tag = document.createElement("span");
    tag.className = "fav-tag";
    tag.innerText = city;
    tag.addEventListener("click", () => getWeather(city));
    container.appendChild(tag);
  });
}

function updateFavBtnIcon() {
  const favBtn = document.getElementById("favBtn");
  if (!favBtn) return;
  if (favorites.includes(currentFetchedCity)) {
    favBtn.innerText = "⭐";
    favBtn.style.color = "#ffb703";
  } else {
    favBtn.innerText = "☆";
    const weatherBox = document.getElementById("main-section");
    // Якщо фон сніжно-білий, робимо порожню зірочку темною, на інших фонах — білою
    favBtn.style.color = weatherBox?.classList.contains("bg-snow") ? "#1e293b" : "white";
  }
}

document.getElementById("favBtn")?.addEventListener("click", () => {
  if (favorites.includes(currentFetchedCity)) {
    favorites = favorites.filter(item => item !== currentFetchedCity);
  } else {
    if (favorites.length >= 4) favorites.shift(); // Зберігаємо не більше 4 тегів
    favorites.push(currentFetchedCity);
  }
  localStorage.setItem("favCities", JSON.stringify(favorites));
  renderFavorites();
  updateFavBtnIcon();
});

// 6. Навігаційне меню (Плавний скрол)
document.getElementById("nav-main")?.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("main-header").scrollIntoView({ behavior: "smooth" });
});
document.getElementById("nav-forecast")?.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("forecast-section").scrollIntoView({ behavior: "smooth" });
});
document.getElementById("nav-about")?.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("about-section").scrollIntoView({ behavior: "smooth" });
});
document.getElementById("nav-maps")?.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("maps-section").scrollIntoView({ behavior: "smooth" });
});

// 7. Перемикач нічного/денного режиму (Dark Mode)
const themeToggle = document.getElementById("themeToggle");
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark-theme");
  if (themeToggle) themeToggle.innerHTML = "☀️";
}

themeToggle?.addEventListener("click", () => {
  document.body.classList.toggle("dark-theme");
  if (document.body.classList.contains("dark-theme")) {
    themeToggle.innerHTML = "☀️";
    localStorage.setItem("theme", "dark");
  } else {
    themeToggle.innerHTML = "🌙";
    localStorage.setItem("theme", "light");
  }
  updateFavBtnIcon(); // Перевіряємо колір зірочки під нову тему
});

// --- СТАРТ ДОДАТКУ ---
initMap();         // Монтуємо карту світу
renderFavorites();  // Виводимо збережені міста, якщо вони є в пам'яті
getWeather();      // Завантажуємо стартову погоду