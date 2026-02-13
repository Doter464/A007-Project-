from typing import Any, Dict, List, Optional
from .db import get_conn

def _item_row_to_dict(r) -> Dict[str, Any]:
    max_qty = int(r["max_qty"])
    cur_qty = int(r["current_qty"])
    fill = 0.0 if max_qty <= 0 else round((cur_qty / max_qty) * 100, 2)
    return {
        "id": r["id"],
        "name": r["name"],
        "category": r["category"],
        "max_qty": max_qty,
        "current_qty": cur_qty,
        "fill_percent": fill,
        "created_at": r["created_at"],
    }

def list_items() -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM items ORDER BY id DESC").fetchall()
        return [_item_row_to_dict(r) for r in rows]

def get_item(item_id: int) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        r = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
        return _item_row_to_dict(r) if r else None

def create_item(name: str, category: str, max_qty: int, current_qty: int) -> Dict[str, Any]:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO items(name, category, max_qty, current_qty) VALUES(?,?,?,?)",
            (name.strip(), category, int(max_qty), int(current_qty)),
        )
        item_id = cur.lastrowid
        r = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
        return _item_row_to_dict(r)

def update_item(item_id: int, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    fields = []
    vals = []
    allowed = {"name", "category", "max_qty", "current_qty"}
    for k, v in payload.items():
        if k not in allowed:
            continue
        fields.append(f"{k} = ?")
        if k in {"max_qty", "current_qty"}:
            vals.append(int(v))
        elif k == "name":
            vals.append(str(v).strip())
        else:
            vals.append(str(v))
    if not fields:
        return get_item(item_id)

    with get_conn() as conn:
        conn.execute(f"UPDATE items SET {', '.join(fields)} WHERE id = ?", (*vals, item_id))
        r = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
        return _item_row_to_dict(r) if r else None

def delete_item(item_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
        return cur.rowcount > 0

def add_operation(item_id: int, op_type: str, qty: int) -> Optional[Dict[str, Any]]:
    qty = int(qty)
    if qty <= 0:
        raise ValueError("qty must be > 0")

    with get_conn() as conn:
        item = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
        if not item:
            return None

        cur_qty = int(item["current_qty"])
        max_qty = int(item["max_qty"])

        if op_type == "in":
            new_qty = cur_qty + qty
            if max_qty > 0 and new_qty > max_qty:
                new_qty = max_qty
        elif op_type == "out":
            new_qty = cur_qty - qty
            if new_qty < 0:
                new_qty = 0
        else:
            raise ValueError("op_type must be 'in' or 'out'")

        conn.execute(
            "INSERT INTO operations(item_id, op_type, qty) VALUES(?,?,?)",
            (item_id, op_type, qty),
        )
        conn.execute("UPDATE items SET current_qty = ? WHERE id = ?", (new_qty, item_id))

        r = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
        return _item_row_to_dict(r)

def list_operations(item_id: Optional[int] = None, limit: int = 200) -> List[Dict[str, Any]]:
    limit = max(1, min(int(limit), 1000))
    with get_conn() as conn:
        if item_id is None:
            rows = conn.execute(
                """
                SELECT o.*, i.name AS item_name
                FROM operations o
                JOIN items i ON i.id = o.item_id
                ORDER BY o.id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT o.*, i.name AS item_name
                FROM operations o
                JOIN items i ON i.id = o.item_id
                WHERE o.item_id = ?
                ORDER BY o.id DESC
                LIMIT ?
                """,
                (int(item_id), limit),
            ).fetchall()

    return [
        {
            "id": r["id"],
            "item_id": r["item_id"],
            "item_name": r["item_name"],
            "op_type": r["op_type"],
            "qty": int(r["qty"]),
            "created_at": r["created_at"],
        }
        for r in rows
    ]
