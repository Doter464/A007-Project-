document.getElementById("toggle-theme").addEventListener("click", () => {
  document.body.classList.toggle("dark");
});
// Базовый фронтенд без Redux/React
const API = "http://localhost:5000";
const itemsTableBody = document.querySelector("#itemsTable tbody");
const opsTableBody = document.querySelector("#opsTable tbody");
const addBtn = document.getElementById("addBtn");

function fetchItems() {
  fetch(API + "/items")
    .then((r) => r.json())
    .then((list) => {
      itemsTableBody.innerHTML = "";
      list.forEach((it) => {
        const tr = document.createElement("tr");
        const pct = Math.min(
          100,
          Math.round((it.current_quantity / it.max_quantity) * 100),
        );
        tr.innerHTML = `
                    <td>${it.name}</td>
                    <td>${it.category}</td>
                    <td>${it.unit}</td>
                    <td>${it.price}</td>
                    <td>${it.max_quantity}</td>
                    <td>${it.current_quantity}</td>
                    <td><div style="width:120px;background:#eee"><div style="width:${pct}%;background:green;height:8px"></div></div></td>
                    <td>
                        <button onclick="inboundItem(${it.id})">Внос</button>
                        <button onclick="outboundItem(${it.id})">Списание</button>
                        <button onclick="deleteItem(${it.id})" class="btn small btn-danger">Удалить</button>
                    </td>
                    `;

        itemsTableBody.appendChild(tr);
      });
    });
}

function fetchOps() {
  fetch(API + "/operations")
    .then((r) => r.json())
    .then((list) => {
      opsTableBody.innerHTML = "";
      list.forEach((o) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${o.id}</td>
            <td>${o.item_id}</td>
            <td>${o.type}</td>
            <td>${o.quantity ?? ""}</td>
            <td>${o.date}</td>
            <td><button onclick="deleteOperation(${o.id})" class="btn small btn-danger">Удалить</button></td>
            `;
        opsTableBody.appendChild(tr);
      });
    });
}
function handleApiResponse(res) {
  return res
    .json()
    .then((data) => ({
      ok: res.ok,
      data,
    }))
    .catch(() => ({
      ok: false,
      data: { error: "Некорректный ответ сервера" },
    }));
}

function addItem() {
  const name = document.getElementById("name").value;
  const category = document.getElementById("category").value;
  const unit = document.getElementById("unit").value;
  const price = parseFloat(document.getElementById("price").value) || 0;
  const max_quantity = parseInt(document.getElementById("max").value) || 0;
  const current_quantity =
    parseInt(document.getElementById("current").value) || 0;

  fetch(API + "/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      category,
      unit,
      price,
      max_quantity,
      current_quantity,
    }),
  }).then(() => {
    fetchItems();
    fetchOps();
  });
}

// Приход (inbound)
function inboundItem(id) {
  const qty = parseInt(prompt("Количество прихода:"), 10) || 0;
  fetch(`http://localhost:5000/items/${id}/inbound`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity: qty }),
  })
    .then(handleApiResponse)
    .then(({ ok, data }) => {
      if (ok) {
        fetchItems();
        fetchOps();
      } else {
        console.error("Ошибка прихода:", data?.error);
      }
    })
    .catch((err) => {
      console.error("Сетевая ошибка при прихоте:", err);
    });
}

// Списание (outbound)
function outboundItem(id) {
  const qty = parseInt(prompt("Количество списания:"), 10) || 0;
  fetch(`http://localhost:5000/items/${id}/outbound`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity: qty }),
  })
    .then(handleApiResponse)
    .then(({ ok, data }) => {
      if (ok) {
        fetchItems();
        fetchOps();
      } else {
        console.error("Ошибка списания:", data?.error);
      }
    })
    .catch((err) => {
      console.error("Сетевая ошибка при списании:", err);
    });
}
// Удаление товара
function deleteItem(id) {
  if (!confirm("Удалить этот товар и связанные данные?")) return;

  fetch(`http://localhost:5000/items/${id}`, {
    method: "DELETE",
  })
    .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (ok) {
        fetchItems();
        fetchOps();
        // можно обновить аналитику, если нужно
      } else {
        console.error("Ошибка удаления:", data?.error);
      }
    })
    .catch((err) => console.error("Сетевая ошибка при удалении:", err));
}
// Удаление операции
function deleteOperation(id) {
  if (!confirm("Удалить выбранную операцию из истории?")) return;

  fetch(`http://localhost:5000/operations/${id}`, {
    method: "DELETE",
  })
    .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (ok) {
        fetchOps(); // обновить историю
      } else {
        console.error("Ошибка удаления операции:", data?.error);
      }
    })
    .catch((err) =>
      console.error("Сетевая ошибка при удалении операции:", err),
    );
}
// Очистка всех операций
function clearOperations() {
  if (!confirm("Очистить всю историю операций?")) return;
  fetch("http://localhost:5000/operations", { method: "DELETE" })
    .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (ok) {
        fetchOps();
      } else {
        console.error("Ошибка очистки истории:", data?.error);
      }
    })
    .catch((err) => console.error("Сетевая ошибка при очистке истории:", err));
}

document.addEventListener("DOMContentLoaded", () => {
  fetchItems();
  fetchOps();

  addBtn.addEventListener("click", (e) => {
    e.preventDefault();
    addItem();
    // очистим форму вручную
    document.getElementById("name").value = "";
    document.getElementById("unit").value = "";
    document.getElementById("price").value = "";
    document.getElementById("max").value = "";
    document.getElementById("current").value = "";
  });
});
