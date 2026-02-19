const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./db");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get("/items", (req, res) => {
  db.all("SELECT * FROM items", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const itemsWithCalc = rows.map((item) => ({
      ...item,
      total_cost: item.current_quantity * item.price,
      percentage: (item.current_quantity / item.max_quantity) * 100,
    }));
    res.json(itemsWithCalc);
  });
});

app.post("/items", (req, res) => {
  const { name, category, unit, price, max_quantity, current_quantity } =
    req.body;
  db.run(
    "INSERT INTO items (name, category, unit, price, max_quantity, current_quantity) VALUES (?, ?, ?, ?, ?, ?)",
    [name, category, unit, price, max_quantity, current_quantity],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.run(
        "INSERT INTO operations (item_id, type, quantity) VALUES (?, ?, ?)",
        [this.lastID, "add", current_quantity],
      );
      res.json({ id: this.lastID });
    },
  );
});

app.put("/items/:id", (req, res) => {
  const { name, category, unit, price, max_quantity, current_quantity } =
    req.body;
  const id = req.params.id;
  db.run(
    "UPDATE items SET name=?, category=?, unit=?, price=?, max_quantity=?, current_quantity=? WHERE id=?",
    [name, category, unit, price, max_quantity, current_quantity, id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.run(
        "INSERT INTO operations (item_id, type, quantity) VALUES (?, ?, ?)",
        [id, "edit", current_quantity],
      );
      res.json({ success: true });
    },
  );
});

// Удаление товара
app.delete("/items/:id", (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM items WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Элемент не найден" });

    db.run("DELETE FROM items WHERE id=?", [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.run(
        "INSERT INTO operations (item_id, type, quantity) VALUES (?, ?, ?)",
        [id, "delete", 0],
      );
      res.json({ success: true });
    });
  });
});

// Удаление одной записи из истории операций
app.delete("/operations/:id", (req, res) => {
  const id = req.params.id;

  db.get("SELECT * FROM operations WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Операция не найдена" });

    db.run("DELETE FROM operations WHERE id = ?", [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});
// очистить записи операций
app.delete("/operations", (req, res) => {
  db.run("DELETE FROM operations", [], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Приход
app.post("/items/:id/inbound", (req, res) => {
  const { quantity } = req.body;
  const id = req.params.id;

  if (!quantity || quantity <= 0) {
    return res
      .status(400)
      .json({ error: "Некорректное количество для прихода" });
  }

  db.run(
    "UPDATE items SET current_quantity = current_quantity + ? WHERE id=?",
    [quantity, id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.run(
        "INSERT INTO operations (item_id, type, quantity) VALUES (?, ?, ?)",
        [id, "inbound", quantity],
      );
      res.json({ success: true });
    },
  );
});

// Списание
app.post("/items/:id/outbound", (req, res) => {
  const { quantity } = req.body;
  const id = req.params.id;

  if (!quantity || quantity <= 0) {
    return res
      .status(400)
      .json({ error: "Некорректное количество для списания" });
  }

  db.get(
    "SELECT current_quantity FROM items WHERE id = ?",
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Элемент не найден" });

      if (row.current_quantity < quantity) {
        return res.status(400).json({ error: "Недостаточно товара на складе" });
      }

      db.run(
        "UPDATE items SET current_quantity = current_quantity - ? WHERE id=?",
        [quantity, id],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          db.run(
            "INSERT INTO operations (item_id, type, quantity) VALUES (?, ?, ?)",
            [id, "outbound", quantity],
          );
          res.json({ success: true });
        },
      );
    },
  );
});

app.get("/operations", (req, res) => {
  db.all("SELECT * FROM operations ORDER BY date DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get("/analytics", (req, res) => {
  db.all("SELECT * FROM items", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const totalWarehouse = rows.reduce(
      (sum, item) => sum + item.current_quantity * item.price,
      0,
    );
    const totalProducts = rows
      .filter((i) => i.category === "product")
      .reduce((sum, i) => sum + i.current_quantity * i.price, 0);
    const totalConsumables = rows
      .filter((i) => i.category === "consumable")
      .reduce((sum, i) => sum + i.current_quantity * i.price, 0);
    const lowStock = rows
      .filter((i) => i.current_quantity / i.max_quantity < 0.2)
      .map((i) => i.name);
    res.json({ totalWarehouse, totalProducts, totalConsumables, lowStock });
  });
});

app.listen(5000, () => console.log("Server running on port 5000"));
