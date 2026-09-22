import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const recipeCol = collection(db, "recipes");
const ingredientCol = collection(db, "ingredients");
const employeeCol = collection(db, "employees");
const timesheetCol = collection(db, "timesheets");
const overheadCol = collection(db, "overhead");
const stockTransactionCol = collection(db, "stock_transactions");
const moCol = collection(db, "production_orders");

const $ = (id) => document.getElementById(id);

function money(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function showMoStatus(message) {
  const el = $("status");
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
  setTimeout(() => {
    el.style.display = "none";
  }, 2600);
}

// ======================================================
// STATE (read-only mirrors)
// ======================================================

let moRecipes = [];
let moEmployees = [];
let moTimesheets = [];
let moOverhead = [];
let moOrders = [];

onSnapshot(recipeCol, (s) => {
  moRecipes = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  loadRecipeOptions();
});

onSnapshot(employeeCol, (s) => {
  moEmployees = s.docs.map((d) => ({ id: d.id, ...d.data() }));
});

onSnapshot(timesheetCol, (s) => {
  moTimesheets = s.docs.map((d) => ({ id: d.id, ...d.data() }));
});

onSnapshot(overheadCol, (s) => {
  moOverhead = s.docs.map((d) => ({ id: d.id, ...d.data() }));
});

onSnapshot(
  moCol,
  (s) => {
    moOrders = s.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    renderMoTable();
  },
  (error) => {
    console.error(error);
    showMoStatus("อ่านข้อมูลใบผลิตไม่ได้");
  },
);

if ($("moDate")) $("moDate").value = todayStr();

// ======================================================
// RECIPE SELECT
// ======================================================

function loadRecipeOptions() {
  const select = $("moRecipe");
  if (!select) return;

  const current = select.value;

  select.innerHTML =
    `<option value="">-- เลือกสูตร --</option>` +
    moRecipes
      .map(
        (r) => `
          <option value="${r.id}">
            ${escapeHtml(r.recipeCode)} - ${escapeHtml(r.recipeName)} (${escapeHtml(r.packageSize || "")}, มาตรฐาน ${Number(r.productionQty || 0)} หน่วย)
          </option>
        `,
      )
      .join("");

  if (moRecipes.some((r) => r.id === current)) {
    select.value = current;
  }
}

// ======================================================
// CREATE MO (ตัดสต็อกทันที)
// ======================================================

$("moForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const recipeId = $("moRecipe").value;
  const date = $("moDate").value;
  const planQty = Number($("moPlanQty").value);
  const actualQty = Number($("moActualQty").value);
  const note = $("moNote").value.trim();

  if (!recipeId) {
    showMoStatus("กรุณาเลือกสูตร");
    return;
  }

  if (!date) {
    showMoStatus("กรุณาเลือกวันที่ผลิต");
    return;
  }

  if (!planQty || planQty <= 0) {
    showMoStatus("กรุณากรอกแผนผลิตให้ถูกต้อง");
    return;
  }

  if (!actualQty || actualQty <= 0) {
    showMoStatus("กรุณากรอกจำนวนผลิตจริงให้ถูกต้อง");
    return;
  }

  const recipe = moRecipes.find((r) => r.id === recipeId);

  if (!recipe) {
    showMoStatus("ไม่พบสูตรที่เลือก");
    return;
  }

  if (!Array.isArray(recipe.items) || recipe.items.length === 0) {
    showMoStatus("สูตรนี้ยังไม่มีรายการวัตถุดิบ");
    return;
  }

  const scaleFactor = planQty / Number(recipe.productionQty || 1);

  const submitBtn = $("moForm").querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    // ===== DL: รวมชั่วโมงงานผลิตของ "วันที่ผลิต" นี้ × อัตราค่าแรง =====

    const dlCost = moTimesheets
      .filter((x) => x.date === date && x.workType === "production")
      .reduce((sum, x) => {
        const employee = moEmployees.find((e) => e.id === x.employeeId);
        const rate = Number(employee?.hourlyRate ?? employee?.rate ?? 0);
        return sum + Number(x.hours || 0) * rate;
      }, 0);

    // ===== OH: กระจายตามสัดส่วนชั่วโมงงานผลิตวันนี้ เทียบกับทั้งเดือน =====

    const month = date.slice(0, 7);

    const monthProductionHours = moTimesheets
      .filter(
        (x) => String(x.date || "").startsWith(month) && x.workType === "production",
      )
      .reduce((sum, x) => sum + Number(x.hours || 0), 0);

    const dayProductionHours = moTimesheets
      .filter((x) => x.date === date && x.workType === "production")
      .reduce((sum, x) => sum + Number(x.hours || 0), 0);

    const monthlyOH = moOverhead.reduce((sum, x) => sum + Number(x.rate || 0), 0);

    const ohCost =
      monthProductionHours > 0
        ? monthlyOH * (dayProductionHours / monthProductionHours)
        : 0;

    // ===== ตัดสต็อกวัตถุดิบตามสูตร (สเกลตาม planQty) แบบ atomic =====

    const moRef = doc(moCol);
    const moCode = `MO-${String(moOrders.length + 1).padStart(4, "0")}`;

    const { dmCost, usedItems } = await runTransaction(db, async (transaction) => {
      const reads = [];

      for (const item of recipe.items) {
        const ref = doc(db, "ingredients", item.ingredientId);
        const snap = await transaction.get(ref);

        if (!snap.exists()) {
          throw new Error(`ไม่พบวัตถุดิบ: ${item.ingredientName || item.ingredientId}`);
        }

        reads.push({ ref, data: snap.data(), item });
      }

      let dmTotal = 0;
      const used = [];

      for (const { ref, data, item } of reads) {
        const scaledQty = Number(item.qty || 0) * scaleFactor;
        const currentStock = Number(data.stockQty || 0);

        if (scaledQty > currentStock) {
          throw new Error(
            `สต็อกไม่พอ: ${data.name || item.ingredientName} (มี ${currentStock} ${data.costUnit || ""}, ต้องใช้ ${scaledQty.toFixed(3)})`,
          );
        }

        const costPerUnit = Number(data.costPerUnit || 0);
        const cost = scaledQty * costPerUnit;

        dmTotal += cost;

        transaction.update(ref, {
          stockQty: currentStock - scaledQty,
          updatedAt: serverTimestamp(),
        });

        const historyRef = doc(stockTransactionCol);

        transaction.set(historyRef, {
          ingredientId: item.ingredientId,
          ingredientCode: data.code || item.ingredientCode || "",
          ingredientName: data.name || item.ingredientName || "",
          type: "OUT",
          qty: scaledQty,
          previousStock: currentStock,
          newStock: currentStock - scaledQty,
          note: `เบิกผลิต ${moCode}`,
          createdAt: serverTimestamp(),
        });

        used.push({
          ingredientName: data.name || item.ingredientName || "",
          qty: scaledQty,
          costUnit: data.costUnit || "",
          cost,
        });
      }

      const totalCost = dmTotal + dlCost + ohCost;

      transaction.set(moRef, {
        moCode,
        recipeId,
        recipeCode: recipe.recipeCode || "",
        recipeName: recipe.recipeName || "",
        packageSize: recipe.packageSize || "",
        date,
        planQty,
        actualQty,
        dmCost: dmTotal,
        dlCost,
        ohCost,
        totalCost,
        unitCost: totalCost / actualQty,
        note,
        usedItems: used,
        createdAt: serverTimestamp(),
      });

      return { dmCost: dmTotal, usedItems: used };
    });

    showMoStatus(`สร้าง ${moCode} สำเร็จ ตัดสต็อกแล้ว`);

    $("moForm").reset();
    $("moDate").value = todayStr();
  } catch (error) {
    console.error(error);
    showMoStatus(error.message || "สร้างใบผลิตไม่สำเร็จ");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

// ======================================================
// RENDER MO TABLE
// ======================================================

function renderMoTable() {
  const table = $("moTableBody");
  if (!table) return;

  if (moOrders.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="8" class="empty">ยังไม่มีใบผลิต</td>
      </tr>
    `;
  } else {
    table.innerHTML = moOrders
      .map(
        (mo) => `
          <tr>
            <td>${escapeHtml(mo.moCode)}</td>
            <td>${escapeHtml(mo.date)}</td>
            <td>${escapeHtml(mo.recipeName)} (${escapeHtml(mo.packageSize || "")})</td>
            <td>${Number(mo.planQty || 0)} / ${Number(mo.actualQty || 0)}</td>
            <td>฿${money(mo.dmCost)} / ฿${money(mo.dlCost)} / ฿${money(mo.ohCost)}</td>
            <td>฿${money(mo.totalCost)}</td>
            <td>฿${money(mo.unitCost)}</td>
            <td class="actions">
              <button class="danger" data-delete-mo="${mo.id}">ลบ</button>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  document.querySelectorAll("[data-delete-mo]").forEach((btn) => {
    btn.addEventListener("click", () => deleteMo(btn.dataset.deleteMo));
  });

  const totalActualQty = moOrders.reduce((s, mo) => s + Number(mo.actualQty || 0), 0);
  const totalCost = moOrders.reduce((s, mo) => s + Number(mo.totalCost || 0), 0);

  if ($("moTotalQty")) $("moTotalQty").textContent = `${totalActualQty} หน่วย`;
  if ($("moTotalCost")) $("moTotalCost").textContent = `฿${money(totalCost)}`;
  if ($("moCount")) $("moCount").textContent = moOrders.length;
}

async function deleteMo(id) {
  if (
    !confirm(
      "ลบใบผลิตนี้? (หมายเหตุ: การลบจะไม่คืนสต็อกวัตถุดิบที่เบิกไปแล้วโดยอัตโนมัติ ต้องรับเข้าคืนเองที่เมนู 5 ถ้าต้องการ)",
    )
  )
    return;

  try {
    await deleteDoc(doc(db, "production_orders", id));
    showMoStatus("ลบใบผลิตแล้ว");
  } catch (error) {
    console.error(error);
    showMoStatus("ลบใบผลิตไม่สำเร็จ");
  }
}