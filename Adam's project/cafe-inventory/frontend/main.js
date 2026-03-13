// ═══════════════════════════════════════════════════════════
// UMBRELLA CORP — INVENTORY MANAGEMENT SYSTEM
// Frontend Logic
// ═══════════════════════════════════════════════════════════

const API = "http://localhost:5000";

// DOM — Таблицы
const itemsTableBody = document.querySelector("#itemsTable tbody");
const opsTableBody = document.querySelector("#opsTable tbody");
const addBtn = document.getElementById("addBtn");

// DOM — Авторизация
const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginUsernameInput = document.getElementById("login-username");
const loginPinInput = document.getElementById("login-pin");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logout-btn");
const loginErrorMsg = document.getElementById("login-error");

// DOM — Админ
const adminBtn = document.getElementById("admin-btn");
const historySection = document.getElementById("history-section");
const accountsModal = document.getElementById("accountsModal");
const closeModalBtn = document.querySelector(".close-modal");
const usersTableBody = document.querySelector("#usersTable tbody");
const addUserBtn = document.getElementById("addUserBtn");
const userErrorMsg = document.getElementById("user-error");

// DOM — Модалка количества
const qtyModal = document.getElementById("qtyModal");
const qtyInput = document.getElementById("qtyInput");
const qtyConfirmBtn = document.getElementById("qtyConfirmBtn");
const qtyCancelBtn = document.getElementById("qtyCancelBtn");
const qtyModalIcon = document.getElementById("qtyModalIcon");
const qtyModalText = document.getElementById("qtyModalText");
const qtyModalDesc = document.getElementById("qtyModalDesc");
const qtyError = document.getElementById("qty-error");

// Состояние
let currentUser = null;
let qtyCallback = null; // колбек после подтверждения

// ═══════════════════════════════════════════════════════════
// ТЕМА
// ═══════════════════════════════════════════════════════════

document.getElementById("toggle-theme").addEventListener("click", () => {
  document.body.classList.add("theme-transition");
  document.body.classList.toggle("dark");
  setTimeout(() => document.body.classList.remove("theme-transition"), 500);
});

// ═══════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════

function handleApiResponse(res) {
  return res
    .json()
    .then((data) => ({ ok: res.ok, data }))
    .catch(() => ({ ok: false, data: { error: "Некорректный ответ сервера" } }));
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove("shake-active");
  void el.offsetWidth;
  el.classList.add("shake-active");
  setTimeout(() => el.classList.remove("shake-active"), 500);
}

/**
 * Форматирование даты в Кыргызстан (UTC+6)
 * Формат: dd.mm.yyyy hh:mm:ss
 */
function formatDateKG(dateStr) {
  if (!dateStr) return "—";
  try {
    // SQLite CURRENT_TIMESTAMP = UTC, но строка без 'Z'
    // Принудительно добавляем 'Z' чтобы JS распознал как UTC
    let raw = String(dateStr).trim();
    if (!raw.endsWith("Z") && !raw.includes("+") && !raw.includes("T")) {
      raw = raw.replace(" ", "T") + "Z";
    }
    let d = new Date(raw);
    if (isNaN(d.getTime())) {
      d = new Date(dateStr + "Z");
    }
    if (isNaN(d.getTime())) return dateStr;

    // Форматируем в таймзоне Кыргызстана (Asia/Bishkek = UTC+6)
    const opts = {
      timeZone: "Asia/Bishkek",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    };
    const parts = new Intl.DateTimeFormat("ru-RU", opts).formatToParts(d);
    const get = (type) => parts.find(p => p.type === type)?.value || "00";
    return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
  } catch (e) {
    return dateStr;
  }
}

// ═══════════════════════════════════════════════════════════
// МОДАЛКА ВВОДА КОЛИЧЕСТВА
// ═══════════════════════════════════════════════════════════

function openQtyModal(type, itemId) {
  qtyInput.value = "";
  qtyError.textContent = "";

  if (type === "inbound") {
    qtyModalIcon.className = "fa-solid fa-arrow-trend-up inbound-icon";
    qtyModalText.textContent = "Внос товара";
    qtyModalDesc.textContent = "Укажите количество поступающего товара";
    qtyConfirmBtn.style.background = "var(--success)";
  } else {
    qtyModalIcon.className = "fa-solid fa-arrow-trend-down outbound-icon";
    qtyModalText.textContent = "Списание товара";
    qtyModalDesc.textContent = "Укажите количество списываемого товара";
    qtyConfirmBtn.style.background = "var(--warning)";
  }

  qtyModal.style.display = "flex";
  setTimeout(() => qtyInput.focus(), 100);

  qtyCallback = () => {
    const qty = parseInt(qtyInput.value, 10);
    if (!qty || qty <= 0) {
      showError(qtyError, "Введите корректное количество");
      return;
    }

    const uname = currentUser ? currentUser.username : "";
    const url = `${API}/items/${itemId}/${type}`;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: qty, username: uname }),
    })
      .then(handleApiResponse)
      .then(({ ok, data }) => {
        if (ok) {
          closeQtyModal();
          fetchItems();
          fetchOps();
        } else {
          showError(qtyError, data?.error || "Ошибка операции");
        }
      })
      .catch(() => showError(qtyError, "Сервер недоступен"));
  };
}

function closeQtyModal() {
  qtyModal.style.display = "none";
  qtyCallback = null;
  qtyError.textContent = "";
}

// ═══════════════════════════════════════════════════════════
// АНАЛИТИКА
// ═══════════════════════════════════════════════════════════

const CUR = " сом"; // валюта
let lastItems = []; // кэш для детализации

function formatNumber(num) {
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pluralize(n, forms) {
  // forms: ['позиция', 'позиции', 'позиций']
  const abs = Math.abs(n) % 100;
  const lastDigit = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (lastDigit > 1 && lastDigit < 5) return forms[1];
  if (lastDigit === 1) return forms[0];
  return forms[2];
}

function updateAnalytics(items) {
  lastItems = items; // сохраняем для openDetail

  const products = items.filter(i => i.category === "product");
  const consumables = items.filter(i => i.category === "consumable");

  const totalCost = items.reduce((s, i) => s + i.current_quantity * i.price, 0);
  const productsCost = products.reduce((s, i) => s + i.current_quantity * i.price, 0);
  const consumablesCost = consumables.reduce((s, i) => s + i.current_quantity * i.price, 0);
  const totalUnits = items.reduce((s, i) => s + i.current_quantity, 0);

  const lowStock = items.filter(i => i.max_quantity > 0 && (i.current_quantity / i.max_quantity) < 0.2);

  // === Карточка «Общая стоимость» ===
  document.getElementById("stat-total").textContent = formatNumber(totalCost) + CUR;

  // Детализация: сортируем по стоимости, показываем топ-4
  const sorted = [...items].sort((a, b) => (b.current_quantity * b.price) - (a.current_quantity * a.price));
  const topItems = sorted.slice(0, 4);
  const detailHTML = topItems.map(i => {
    const cost = formatNumber(i.current_quantity * i.price);
    return `<span class="stat-detail-row"><span class="stat-detail-name">${i.name}</span><span class="stat-detail-cost">${cost}${CUR}</span></span>`;
  }).join("");
  const remaining = items.length - 4;
  const moreText = remaining > 0 ? `<span class="stat-detail-more"><i class="fa-solid fa-ellipsis" style="margin-right:3px;"></i>ещё ${remaining} ${pluralize(remaining, ['позиция','позиции','позиций'])}</span>` : "";
  const totalInfo = `<span class="stat-detail-total"><i class="fa-solid fa-cubes-stacked" style="margin-right:3px;"></i>${totalUnits} ${pluralize(totalUnits, ['единица','единицы','единиц'])} · ${items.length} ${pluralize(items.length, ['наименование','наименования','наименований'])}</span>`;
  document.getElementById("stat-total-detail").innerHTML = (items.length > 0 ? detailHTML + moreText + totalInfo : '<span style="color:var(--muted);"><i class="fa-solid fa-inbox" style="margin-right:4px;"></i>Нет товаров</span>');

  // === Карточка «Продукты» ===
  document.getElementById("stat-products").textContent = formatNumber(productsCost) + CUR;
  const prodUnits = products.reduce((s, i) => s + i.current_quantity, 0);
  document.getElementById("stat-products-count").textContent = `${products.length} ${pluralize(products.length, ['позиция','позиции','позиций'])} · ${prodUnits} ед.`;

  // === Карточка «Расходники» ===
  document.getElementById("stat-consumables").textContent = formatNumber(consumablesCost) + CUR;
  const consUnits = consumables.reduce((s, i) => s + i.current_quantity, 0);
  document.getElementById("stat-consumables-count").textContent = `${consumables.length} ${pluralize(consumables.length, ['позиция','позиции','позиций'])} · ${consUnits} ед.`;

  // === Карточка «Заканчиваются» ===
  document.getElementById("stat-low").textContent = lowStock.length;
  if (lowStock.length > 0) {
    // Сортируем по процентам заполненности
    const sortedLow = [...lowStock].sort((a, b) => (a.current_quantity / a.max_quantity) - (b.current_quantity / b.max_quantity));
    const lowHTML = sortedLow.slice(0, 3).map(i => {
      const pct = Math.round((i.current_quantity / i.max_quantity) * 100);
      const icon = pct === 0 ? 'fa-solid fa-circle-xmark' : 'fa-solid fa-circle-exclamation';
      const color = pct === 0 ? 'color:var(--danger);' : 'color:var(--warning);';
      return `<span class="stat-low-row"><i class="${icon}" style="margin-right:4px;${color}"></i> ${i.name} <span class="stat-low-pct" style="${color}">${pct}%</span></span>`;
    }).join("");
    const moreL = lowStock.length > 3 ? `<span class="stat-detail-more"><i class="fa-solid fa-ellipsis" style="margin-right:3px;"></i>ещё ${lowStock.length - 3}</span>` : "";
    document.getElementById("stat-low-list").innerHTML = lowHTML + moreL;
  } else {
    document.getElementById("stat-low-list").innerHTML = '<span style="color:var(--success);"><i class="fa-solid fa-circle-check" style="margin-right:4px;"></i>Всё в норме</span>';
  }
}

// ═══════════════════════════════════════════════════════════
// ДЕТАЛИЗАЦИЯ (модальное окно)
// ═══════════════════════════════════════════════════════════

const detailModal = document.getElementById("detailModal");

function openDetail(type) {
  const items = lastItems;
  if (!items.length && type !== "lowstock") return;

  const icon = document.getElementById("detailModalIcon");
  const text = document.getElementById("detailModalText");
  const summary = document.getElementById("detailSummary");
  const thead = document.getElementById("detailTableHead");
  const tbody = document.getElementById("detailTableBody");

  summary.innerHTML = "";
  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (type === "total") {
    icon.className = "fa-solid fa-coins";
    text.textContent = "Стоимость склада — Полная детализация";

    const totalCost = items.reduce((s, i) => s + i.current_quantity * i.price, 0);
    const products = items.filter(i => i.category === "product");
    const consumables = items.filter(i => i.category === "consumable");
    const prCost = products.reduce((s, i) => s + i.current_quantity * i.price, 0);
    const conCost = consumables.reduce((s, i) => s + i.current_quantity * i.price, 0);
    const totalQty = items.reduce((s, i) => s + i.current_quantity, 0);

    summary.innerHTML = `
      <div class="detail-summary-card" style="animation-delay:0s"><div class="ds-label">Общая стоимость</div><div class="ds-value">${totalCost.toFixed(2)}${CUR}</div></div>
      <div class="detail-summary-card" style="animation-delay:0.05s"><div class="ds-label">Продукты</div><div class="ds-value">${prCost.toFixed(2)}${CUR}</div><div class="ds-sub">${products.length} позиций</div></div>
      <div class="detail-summary-card" style="animation-delay:0.1s"><div class="ds-label">Расходники</div><div class="ds-value">${conCost.toFixed(2)}${CUR}</div><div class="ds-sub">${consumables.length} позиций</div></div>
      <div class="detail-summary-card" style="animation-delay:0.15s"><div class="ds-label">Единиц товара</div><div class="ds-value">${totalQty}</div><div class="ds-sub">${items.length} наименований</div></div>
    `;

    thead.innerHTML = `<tr><th>#</th><th>Название</th><th>Категория</th><th>Цена</th><th>Кол-во</th><th>Формула</th><th>Итого</th></tr>`;
    items.forEach((it, i) => {
      const cost = (it.current_quantity * it.price).toFixed(2);
      const catIcon = it.category === "product" ? '<i class="fa-solid fa-utensils" style="color:var(--muted);margin-right:4px;"></i>' : '<i class="fa-solid fa-box" style="color:var(--muted);margin-right:4px;"></i>';
      const catName = it.category === "product" ? "Продукт" : "Расходник";
      const tr = document.createElement("tr");
      tr.style.animationDelay = `${i * 0.03}s`;
      tr.innerHTML = `
        <td data-label="#">${i + 1}</td>
        <td data-label="Название"><strong>${it.name}</strong></td>
        <td data-label="Категория">${catIcon}${catName}</td>
        <td data-label="Цена">${it.price}${CUR}</td>
        <td data-label="Кол-во">${it.current_quantity} ${it.unit}</td>
        <td data-label="Формула" style="font-family:'Share Tech Mono',monospace;color:var(--muted);">${it.current_quantity} × ${it.price}</td>
        <td data-label="Итого"><strong>${cost}${CUR}</strong></td>
      `;
      tbody.appendChild(tr);
    });
    // Строка итого
    const totalRow = document.createElement("tr");
    totalRow.style.background = "var(--bg-secondary)";
    totalRow.innerHTML = `<td colspan="6" style="text-align:right;font-weight:700;">ИТОГО:</td><td style="font-weight:700;font-size:16px;">${totalCost.toFixed(2)}${CUR}</td>`;
    tbody.appendChild(totalRow);

  } else if (type === "products" || type === "consumables") {
    const isProduct = type === "products";
    const filtered = items.filter(i => i.category === (isProduct ? "product" : "consumable"));

    icon.className = isProduct ? "fa-solid fa-utensils" : "fa-solid fa-box";
    text.textContent = isProduct ? "Продукты — Детализация" : "Расходники — Детализация";

    const catCost = filtered.reduce((s, i) => s + i.current_quantity * i.price, 0);
    const catQty = filtered.reduce((s, i) => s + i.current_quantity, 0);
    const avgPrice = filtered.length > 0 ? (catCost / filtered.length).toFixed(2) : "0";
    const maxItem = filtered.length > 0 ? filtered.reduce((a, b) => (a.current_quantity * a.price) > (b.current_quantity * b.price) ? a : b) : null;

    summary.innerHTML = `
      <div class="detail-summary-card" style="animation-delay:0s"><div class="ds-label">Стоимость</div><div class="ds-value">${catCost.toFixed(2)}${CUR}</div></div>
      <div class="detail-summary-card" style="animation-delay:0.05s"><div class="ds-label">Количество</div><div class="ds-value">${filtered.length}</div><div class="ds-sub">${catQty} единиц</div></div>
      <div class="detail-summary-card" style="animation-delay:0.1s"><div class="ds-label">Ср. стоимость</div><div class="ds-value">${avgPrice}${CUR}</div><div class="ds-sub">на позицию</div></div>
      <div class="detail-summary-card" style="animation-delay:0.15s"><div class="ds-label">Самый дорогой</div><div class="ds-value">${maxItem ? maxItem.name : "—"}</div><div class="ds-sub">${maxItem ? (maxItem.current_quantity * maxItem.price).toFixed(2) + CUR : ""}</div></div>
    `;

    thead.innerHTML = `<tr><th>#</th><th>Название</th><th>Ед.</th><th>Цена</th><th>Макс</th><th>Текущее</th><th>Заполненность</th><th>Стоимость</th></tr>`;
    filtered.forEach((it, i) => {
      const cost = (it.current_quantity * it.price).toFixed(2);
      const pct = it.max_quantity > 0 ? Math.min(100, Math.round((it.current_quantity / it.max_quantity) * 100)) : 0;
      let barColor = "var(--success)";
      if (pct < 20) barColor = "var(--danger)";
      else if (pct < 50) barColor = "var(--warning)";

      const tr = document.createElement("tr");
      tr.style.animationDelay = `${i * 0.03}s`;
      tr.innerHTML = `
        <td data-label="#">${i + 1}</td>
        <td data-label="Название"><strong>${it.name}</strong></td>
        <td data-label="Ед.">${it.unit}</td>
        <td data-label="Цена">${it.price}${CUR}</td>
        <td data-label="Макс">${it.max_quantity}</td>
        <td data-label="Текущее">${it.current_quantity}</td>
        <td data-label="Заполненность">
          <div class="detail-progress"><div class="detail-progress-fill" style="width:${pct}%;background:${barColor};"></div></div>
          <span style="font-size:11px;color:var(--muted);font-family:'Share Tech Mono',monospace;">${pct}%</span>
        </td>
        <td data-label="Стоимость"><strong>${cost}${CUR}</strong></td>
      `;
      tbody.appendChild(tr);
    });

    const totalRow = document.createElement("tr");
    totalRow.style.background = "var(--bg-secondary)";
    totalRow.innerHTML = `<td colspan="7" style="text-align:right;font-weight:700;">ИТОГО:</td><td style="font-weight:700;font-size:16px;">${catCost.toFixed(2)}${CUR}</td>`;
    tbody.appendChild(totalRow);

  } else if (type === "lowstock") {
    icon.className = "fa-solid fa-triangle-exclamation";
    icon.style.color = "var(--warning)";
    text.textContent = "Заканчивающиеся товары";

    const lowStock = items.filter(i => i.max_quantity > 0 && (i.current_quantity / i.max_quantity) < 0.2);
    const critical = lowStock.filter(i => i.current_quantity === 0);
    const warning = lowStock.filter(i => i.current_quantity > 0);

    summary.innerHTML = `
      <div class="detail-summary-card" style="animation-delay:0s;border-color:var(--danger);"><div class="ds-label">Критично (0 шт)</div><div class="ds-value" style="color:var(--danger);">${critical.length}</div></div>
      <div class="detail-summary-card" style="animation-delay:0.05s;border-color:var(--warning);"><div class="ds-label">Мало (&lt;20%)</div><div class="ds-value" style="color:var(--warning);">${warning.length}</div></div>
      <div class="detail-summary-card" style="animation-delay:0.1s"><div class="ds-label">Всего товаров</div><div class="ds-value">${items.length}</div></div>
      <div class="detail-summary-card" style="animation-delay:0.15s"><div class="ds-label">В норме</div><div class="ds-value" style="color:var(--success);">${items.length - lowStock.length}</div></div>
    `;

    if (lowStock.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--success);font-size:16px;"><i class="fa-solid fa-check-circle" style="margin-right:8px;"></i>Все товары в достаточном количестве</td></tr>`;
      thead.innerHTML = "";
    } else {
      thead.innerHTML = `<tr><th>#</th><th>Название</th><th>Категория</th><th>Текущее</th><th>Максимум</th><th>Заполненность</th><th>Статус</th></tr>`;
      lowStock.sort((a, b) => (a.current_quantity / a.max_quantity) - (b.current_quantity / b.max_quantity));
      lowStock.forEach((it, i) => {
        const pct = Math.round((it.current_quantity / it.max_quantity) * 100);
        const barColor = pct === 0 ? "var(--danger)" : "var(--warning)";
        const statusText = pct === 0 ? '<span style="color:var(--danger);font-weight:700;"><i class="fa-solid fa-xmark-circle" style="margin-right:3px;"></i>ПУСТО</span>' : `<span style="color:var(--warning);"><i class="fa-solid fa-exclamation-triangle" style="margin-right:3px;"></i>Мало</span>`;
        const catIcon = it.category === "product" ? '<i class="fa-solid fa-utensils" style="color:var(--muted);margin-right:4px;"></i>' : '<i class="fa-solid fa-box" style="color:var(--muted);margin-right:4px;"></i>';

        const tr = document.createElement("tr");
        tr.style.animationDelay = `${i * 0.04}s`;
        tr.innerHTML = `
          <td data-label="#">${i + 1}</td>
          <td data-label="Название"><strong>${it.name}</strong></td>
          <td data-label="Категория">${catIcon}${it.category === "product" ? "Продукт" : "Расходник"}</td>
          <td data-label="Текущее" style="font-weight:700;color:${pct === 0 ? 'var(--danger)' : 'var(--warning)'};">${it.current_quantity}</td>
          <td data-label="Максимум">${it.max_quantity}</td>
          <td data-label="Заполненность">
            <div class="detail-progress"><div class="detail-progress-fill" style="width:${pct}%;background:${barColor};"></div></div>
            <span style="font-size:11px;color:var(--muted);font-family:'Share Tech Mono',monospace;">${pct}%</span>
          </td>
          <td data-label="Статус">${statusText}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Сбрасываем цвет иконки при закрытии
    setTimeout(() => { icon.style.color = ""; }, 0);
  }

  detailModal.style.display = "flex";
}

function closeDetailModal() {
  detailModal.style.display = "none";
}

// ═══════════════════════════════════════════════════════════
// ЗАГРУЗКА ДАННЫХ
// ═══════════════════════════════════════════════════════════

function fetchItems() {
  fetch(API + "/items")
    .then((r) => r.json())
    .then((list) => {
      // Обновляем аналитику
      updateAnalytics(list);

      itemsTableBody.innerHTML = "";
      list.forEach((it, index) => {
        const tr = document.createElement("tr");
        tr.style.animationDelay = `${index * 0.04}s`;
        const pct = Math.min(100, Math.round((it.current_quantity / it.max_quantity) * 100));

        let barColor = "var(--success)";
        if (pct < 20) barColor = "var(--danger)";
        else if (pct < 50) barColor = "var(--warning)";

        // FA иконки вместо emoji
        const catIcon = it.category === "product"
          ? '<i class="fa-solid fa-utensils" style="color:var(--muted);margin-right:4px;"></i>'
          : '<i class="fa-solid fa-box" style="color:var(--muted);margin-right:4px;"></i>';
        const catName = it.category === "product" ? "Продукт" : "Расходник";

        tr.innerHTML = `
          <td data-label="Название"><strong>${it.name}</strong></td>
          <td data-label="Категория">${catIcon}${catName}</td>
          <td data-label="Ед.">${it.unit}</td>
          <td data-label="Цена">${it.price}</td>
          <td data-label="Макс">${it.max_quantity}</td>
          <td data-label="Кол-во">${it.current_quantity}</td>
          <td data-label="Прогресс">
            <div style="width:120px;background:var(--bg-secondary, #eee);border-radius:5px;overflow:hidden;height:10px;position:relative;">
              <div style="width:${pct}%;background:${barColor};height:100%;border-radius:5px;transition:width 0.8s ease;"></div>
            </div>
            <span style="font-size:11px;color:var(--muted);margin-left:6px;font-family:'Share Tech Mono',monospace;">${pct}%</span>
          </td>
          <td data-label="Действия">
            <button onclick="inboundItem(${it.id})" class="btn-action"><i class="fa-solid fa-arrow-trend-up"></i> Внос</button>
            <button onclick="outboundItem(${it.id})" class="btn-action"><i class="fa-solid fa-arrow-trend-down"></i> Списание</button>
            <button onclick="deleteItem(${it.id})" class="btn small btn-danger btn-delete"><i class="fa-solid fa-trash-can"></i> Удалить</button>
          </td>
        `;
        itemsTableBody.appendChild(tr);
      });
    })
    .catch((err) => console.error("Ошибка загрузки товаров:", err));
}

function fetchOps() {
  fetch(API + "/operations")
    .then((r) => r.json())
    .then((list) => {
      opsTableBody.innerHTML = "";
      list.forEach((o, index) => {
        const tr = document.createElement("tr");
        tr.style.animationDelay = `${index * 0.03}s`;

        // FA иконки для типов операций
        const typeMap = {
          add: { icon: 'fa-solid fa-circle-plus', label: 'Добавление', color: 'var(--success)' },
          edit: { icon: 'fa-solid fa-pen-to-square', label: 'Редакт.', color: 'var(--accent)' },
          delete: { icon: 'fa-solid fa-trash-can', label: 'Удаление', color: 'var(--danger)' },
          inbound: { icon: 'fa-solid fa-arrow-right-to-bracket', label: 'Внос', color: 'var(--success)' },
          outbound: { icon: 'fa-solid fa-arrow-right-from-bracket', label: 'Списание', color: 'var(--warning)' }
        };
        const t = typeMap[o.type] || { icon: 'fa-solid fa-circle-info', label: o.type, color: 'var(--muted)' };

        const userDisplay = o.username
          ? `<i class="fa-solid fa-user-tag" style="color:var(--accent);margin-right:4px;"></i> ${o.username}`
          : `<span style="color:var(--muted);font-style:italic;">—</span>`;

        tr.innerHTML = `
          <td data-label="ID">${o.id}</td>
          <td data-label="Товар ID">${o.item_id}</td>
          <td data-label="Тип"><i class="${t.icon}" style="color:${t.color};margin-right:5px;"></i> ${t.label}</td>
          <td data-label="Кол-во">${o.quantity ?? "—"}</td>
          <td data-label="Пользователь">${userDisplay}</td>
          <td data-label="Дата" style="font-family:'Share Tech Mono',monospace;font-size:13px;">${formatDateKG(o.date)}</td>
          <td data-label="Действия"><button onclick="deleteOperation(${o.id})" class="btn small btn-danger btn-delete"><i class="fa-solid fa-trash-can"></i> Удалить</button></td>
        `;
        opsTableBody.appendChild(tr);
      });
    })
    .catch((err) => console.error("Ошибка загрузки операций:", err));
}

// ═══════════════════════════════════════════════════════════
// ТОВАРЫ — CRUD
// ═══════════════════════════════════════════════════════════

function addItem() {
  const name = document.getElementById("name").value;
  const category = document.getElementById("category").value;
  const unit = document.getElementById("unit").value;
  const price = parseFloat(document.getElementById("price").value) || 0;
  const max_quantity = parseInt(document.getElementById("max").value) || 0;
  const current_quantity = parseInt(document.getElementById("current").value) || 0;

  if (!name.trim()) {
    alert("Введите название товара");
    return;
  }

  const username = currentUser ? currentUser.username : "";

  fetch(API + "/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, category, unit, price, max_quantity, current_quantity, username }),
  }).then(() => {
    fetchItems();
    fetchOps();
  });
}

function inboundItem(id) {
  openQtyModal("inbound", id);
}

function outboundItem(id) {
  openQtyModal("outbound", id);
}

function deleteItem(id) {
  if (!confirm("Удалить этот товар и связанные данные?")) return;

  const username = currentUser ? currentUser.username : "";
  fetch(`${API}/items/${id}?username=${encodeURIComponent(username)}`, { method: "DELETE" })
    .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
    .then(({ ok }) => {
      if (ok) { fetchItems(); fetchOps(); }
    })
    .catch((err) => console.error("Сетевая ошибка:", err));
}

function deleteOperation(id) {
  if (!confirm("Удалить выбранную операцию из истории?")) return;

  fetch(`${API}/operations/${id}`, { method: "DELETE" })
    .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
    .then(({ ok }) => {
      if (ok) fetchOps();
    })
    .catch((err) => console.error("Сетевая ошибка:", err));
}

function clearOperations() {
  if (!confirm("Очистить всю историю операций?")) return;
  fetch(`${API}/operations`, { method: "DELETE" })
    .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
    .then(({ ok }) => {
      if (ok) fetchOps();
    })
    .catch((err) => console.error("Сетевая ошибка:", err));
}

// ═══════════════════════════════════════════════════════════
// АВТОРИЗАЦИЯ
// ═══════════════════════════════════════════════════════════

function fetchUsersForLogin() {
  fetch(API + "/users")
    .then((r) => r.json())
    .then((users) => {
      const datalist = document.getElementById("users-list");
      if (datalist) {
        datalist.innerHTML = "";
        users.forEach((u) => {
          const opt = document.createElement("option");
          opt.value = u.username;
          datalist.appendChild(opt);
        });
      }
    })
    .catch((err) => console.error("Ошибка загрузки пользователей:", err));
}

function setLoginLoading(loading) {
  if (loading) {
    loginBtn.disabled = true;
    loginBtn.classList.add("loading");
    loginBtn.innerHTML = `<span class="login-spinner"></span> Вход...`;
    loginUsernameInput.disabled = true;
    loginPinInput.disabled = true;
  } else {
    loginBtn.disabled = false;
    loginBtn.classList.remove("loading");
    loginBtn.innerHTML = `<i class="fa-solid fa-unlock-keyhole"></i> Войти`;
    loginUsernameInput.disabled = false;
    loginPinInput.disabled = false;
  }
}

function handleLogin() {
  const username = loginUsernameInput.value.trim();
  const pin = loginPinInput.value;

  if (!username) {
    showError(loginErrorMsg, "Введите имя пользователя");
    loginUsernameInput.focus();
    return;
  }

  if (username.toLowerCase() !== "admin" && !pin) {
    showError(loginErrorMsg, "Введите PIN код");
    loginPinInput.focus();
    return;
  }

  setLoginLoading(true);

  fetch(API + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, pin }),
  })
    .then(handleApiResponse)
    .then(({ ok, data }) => {
      setLoginLoading(false);

      if (ok) {
        currentUser = data;
        loginErrorMsg.textContent = "";
        loginPinInput.value = "";

        loginView.style.animation = "fadeIn 0.3s ease reverse forwards";
        setTimeout(() => {
          loginView.style.display = "none";
          loginView.style.animation = "";

          appView.style.display = "block";
          appView.style.animation = "fadeIn 0.5s ease-out both";

          logoutBtn.style.display = "inline-flex";
          logoutBtn.style.animation = "slideDown 0.3s ease-out both";

          if (currentUser.role === "admin") {
            adminBtn.style.display = "inline-flex";
            adminBtn.style.animation = "slideDown 0.3s ease-out 0.1s both";
            historySection.style.display = "block";
          } else {
            adminBtn.style.display = "none";
            historySection.style.display = "none";
          }

          fetchItems();
          if (currentUser.role === "admin") fetchOps();
        }, 300);
      } else {
        showError(loginErrorMsg, data.error || "Ошибка авторизации");
      }
    })
    .catch((err) => {
      setLoginLoading(false);
      console.error(err);
      showError(loginErrorMsg, "Сервер недоступен. Проверьте подключение.");
    });
}

function handleLogout() {
  appView.style.animation = "fadeIn 0.3s ease reverse forwards";

  setTimeout(() => {
    currentUser = null;
    appView.style.display = "none";
    appView.style.animation = "";

    loginView.style.display = "flex";
    loginView.style.animation = "scaleIn 0.5s ease-out both";

    logoutBtn.style.display = "none";
    adminBtn.style.display = "none";

    itemsTableBody.innerHTML = "";
    opsTableBody.innerHTML = "";

    loginUsernameInput.value = "";
    loginPinInput.value = "";
    loginPinInput.style.display = "block";
  }, 300);
}

// ═══════════════════════════════════════════════════════════
// УПРАВЛЕНИЕ АККАУНТАМИ (Admin)
// ═══════════════════════════════════════════════════════════

function loadAdminUsers() {
  fetch(API + "/users")
    .then((r) => r.json())
    .then((users) => {
      usersTableBody.innerHTML = "";
      users.forEach((u, index) => {
        const tr = document.createElement("tr");
        tr.style.animationDelay = `${index * 0.05}s`;

        const deleteBtnHTML = u.role === "admin"
          ? `<span style="color:var(--muted);font-size:11px;font-family:'Share Tech Mono',monospace;">Защищён</span>`
          : `<button onclick="deleteUser(${u.id})" class="btn small btn-danger" style="margin-left:5px;"><i class="fa-solid fa-xmark"></i> Удал.</button>`;

        const editBtnHTML = `<button onclick="editUser(${u.id}, '${u.username}', '${u.pin || ""}', '${u.role}')" class="btn small btn-secondary"><i class="fa-solid fa-pen"></i> Ред.</button>`;

        // FA иконки вместо emoji
        const roleIcon = u.role === "admin"
          ? '<i class="fa-solid fa-shield-halved" style="color:var(--accent);margin-right:4px;"></i>'
          : '<i class="fa-solid fa-user" style="color:var(--muted);margin-right:4px;"></i>';

        tr.innerHTML = `
          <td data-label="ID">${u.id}</td>
          <td data-label="Имя">${roleIcon} ${u.username}</td>
          <td data-label="Роль">${u.role}</td>
          <td data-label="Действия">
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${editBtnHTML}
              ${deleteBtnHTML}
            </div>
          </td>
        `;
        usersTableBody.appendChild(tr);
      });
    });
}

window.editUser = function (id, username, pin, role) {
  document.getElementById("edit-user-id").value = id;
  document.getElementById("new-username").value = username;
  document.getElementById("new-pin").value = role === "admin" ? "" : pin || "";
  document.getElementById("new-role").value = role;

  if (role === "admin") {
    document.getElementById("new-pin").disabled = true;
    document.getElementById("new-pin").placeholder = "Пароль не нужен";
  } else {
    document.getElementById("new-pin").disabled = false;
    document.getElementById("new-pin").placeholder = "PIN код";
  }

  document.getElementById("cancelEditBtn").style.display = "inline-flex";
  document.getElementById("addUserBtn").innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Сохранить`;
};

function resetUserForm() {
  document.getElementById("edit-user-id").value = "";
  document.getElementById("new-username").value = "";
  document.getElementById("new-pin").value = "";
  document.getElementById("new-pin").disabled = false;
  document.getElementById("new-pin").placeholder = "PIN код";
  document.getElementById("new-role").value = "user";
  document.getElementById("cancelEditBtn").style.display = "none";
  document.getElementById("addUserBtn").innerHTML = `<i class="fa-solid fa-user-plus"></i> Создать`;
}

function handleCreateUser() {
  const id = document.getElementById("edit-user-id").value;
  const username = document.getElementById("new-username").value.trim();
  const pin = document.getElementById("new-pin").value.trim();
  const role = document.getElementById("new-role").value;

  if (!username || (role !== "admin" && !pin)) {
    showError(userErrorMsg, "Заполните имя и PIN (для пользователя)");
    return;
  }

  const method = id ? "PUT" : "POST";
  const url = id ? `${API}/users/${id}` : `${API}/users`;

  fetch(url, {
    method: method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, pin, role }),
  })
    .then(handleApiResponse)
    .then(({ ok, data }) => {
      if (ok) {
        userErrorMsg.style.color = "var(--success)";
        userErrorMsg.textContent = id ? "Пользователь обновлён" : "Пользователь создан";
        setTimeout(() => {
          userErrorMsg.textContent = "";
          userErrorMsg.style.color = "var(--danger)";
        }, 2500);

        resetUserForm();
        loadAdminUsers();
        fetchUsersForLogin();
      } else {
        userErrorMsg.style.color = "var(--danger)";
        showError(userErrorMsg, data.error || "Ошибка сохранения");
      }
    });
}

window.deleteUser = function (id) {
  if (!confirm("Удалить пользователя?")) return;
  fetch(API + "/users/" + id, { method: "DELETE" })
    .then(handleApiResponse)
    .then(({ ok, data }) => {
      if (ok) {
        loadAdminUsers();
        fetchUsersForLogin();
      } else {
        alert("Ошибка: " + (data.error || "Невозможно удалить"));
      }
    });
};

// ═══════════════════════════════════════════════════════════
// ИНИЦИАЛИЗАЦИЯ
// ═══════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  fetchUsersForLogin();

  // Авторизация
  loginBtn.addEventListener("click", handleLogin);
  logoutBtn.addEventListener("click", handleLogout);

  // Enter на полях логина
  loginUsernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (loginUsernameInput.value.trim().toLowerCase() === "admin") {
        handleLogin();
      } else {
        loginPinInput.focus();
      }
    }
  });

  loginPinInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLogin();
    }
  });

  // Скрытие PIN для админа
  loginUsernameInput.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase();
    if (val === "admin") {
      loginPinInput.style.display = "none";
      loginPinInput.value = "";
    } else {
      loginPinInput.style.display = "block";
    }
  });

  // Модальное окно учёток
  adminBtn.addEventListener("click", () => {
    accountsModal.style.display = "flex";
    loadAdminUsers();
  });

  closeModalBtn.addEventListener("click", () => {
    accountsModal.style.display = "none";
  });

  // Закрытие модалки детализации аналитики
  const closeDetailBtn = document.querySelector(".close-detail-modal");
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener("click", closeDetailModal);
  }

  window.addEventListener("click", (e) => {
    if (e.target === accountsModal) accountsModal.style.display = "none";
    if (e.target === qtyModal) closeQtyModal();
    if (e.target === detailModal) closeDetailModal();
  });

  // Модалка количества — кнопки
  qtyConfirmBtn.addEventListener("click", () => {
    if (qtyCallback) qtyCallback();
  });

  qtyCancelBtn.addEventListener("click", closeQtyModal);

  document.querySelector(".close-qty-modal").addEventListener("click", closeQtyModal);

  // Enter в модалке количества
  qtyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (qtyCallback) qtyCallback();
    }
    if (e.key === "Escape") closeQtyModal();
  });

  // Escape закрывает любую модалку
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (qtyModal.style.display === "flex") closeQtyModal();
      if (accountsModal.style.display === "flex") accountsModal.style.display = "none";
      if (detailModal.style.display === "flex") closeDetailModal();
    }
  });

  addUserBtn.addEventListener("click", handleCreateUser);

  // Добавление товара
  addBtn.addEventListener("click", (e) => {
    e.preventDefault();
    addItem();
    document.getElementById("name").value = "";
    document.getElementById("unit").value = "";
    document.getElementById("price").value = "";
    document.getElementById("max").value = "";
    document.getElementById("current").value = "";
  });

  // Enter в форме добавления
  document.getElementById("addForm").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addBtn.click();
    }
  });

  const cancelEditBtn = document.getElementById("cancelEditBtn");
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", resetUserForm);
  }
});
