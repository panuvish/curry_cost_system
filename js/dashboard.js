import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getFirestore,
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const ingredientCol = collection(db, "ingredients");
const employeeCol = collection(db, "employees");
const timesheetCol = collection(db, "timesheets");
const overheadCol = collection(db, "overhead");
const stockTransactionCol = collection(db, "stock_transactions");

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

let dashIngredients = [];
let dashEmployees = [];
let dashTimesheets = [];
let dashOverhead = [];
let dashStockTx = [];

function currentMonthStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// ======================================================
// LISTENERS (read-only — no forms, safe to duplicate)
// ======================================================

onSnapshot(ingredientCol, (snapshot) => {
  dashIngredients = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderDashboardCards();
});

onSnapshot(employeeCol, (snapshot) => {
  dashEmployees = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderDashboardCards();
});

onSnapshot(timesheetCol, (snapshot) => {
  dashTimesheets = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderDashboardCards();
  renderRecentActivity();
});

onSnapshot(overheadCol, (snapshot) => {
  dashOverhead = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderDashboardCards();
});

onSnapshot(stockTransactionCol, (snapshot) => {
  dashStockTx = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderRecentActivity();
});

// ======================================================
// SUMMARY CARDS
// ======================================================

function renderDashboardCards() {
  const rawStockValue = dashIngredients
    .filter((x) => x.category === "DM")
    .reduce(
      (sum, x) => sum + Number(x.stockQty || 0) * Number(x.costPerUnit || 0),
      0,
    );

  if ($("dashRawStockValue"))
    $("dashRawStockValue").textContent = `฿${money(rawStockValue)}`;

  if ($("dashEmployeeCount"))
    $("dashEmployeeCount").textContent = `${dashEmployees.length} คน`;

  const month = currentMonthStr();

  const dlThisMonth = dashTimesheets
    .filter(
      (x) =>
        String(x.date || "").startsWith(month) && x.workType === "production",
    )
    .reduce((sum, x) => {
      const employee = dashEmployees.find((e) => e.id === x.employeeId);
      const rate = Number(employee?.hourlyRate ?? employee?.rate ?? 0);
      return sum + Number(x.hours || 0) * rate;
    }, 0);

  if ($("dashDLThisMonth"))
    $("dashDLThisMonth").textContent = `฿${money(dlThisMonth)}`;

  const ohTotal = dashOverhead.reduce((sum, x) => sum + Number(x.rate || 0), 0);

  if ($("dashOHThisMonth"))
    $("dashOHThisMonth").textContent = `฿${money(ohTotal)}`;
}

// ======================================================
// RECENT ACTIVITY (รวมสต็อก + บันทึกเวลา ล่าสุด 8 รายการ)
// ======================================================

function renderRecentActivity() {
  const table = $("dashRecentTableBody");
  if (!table) return;

  const stockItems = dashStockTx.map((x) => ({
    seconds: x.createdAt?.seconds || 0,
    label: x.type === "IN" ? "🟢 รับเข้าวัตถุดิบ" : "🔴 เบิกวัตถุดิบ",
    who: x.ingredientName || "-",
    qty: `${Number(x.qty || 0)} หน่วย`,
  }));

  const tsItems = dashTimesheets.map((x) => ({
    seconds: x.createdAt?.seconds || 0,
    label: x.workType === "production" ? "🏭 บันทึกเวลา (ผลิต)" : "🕒 บันทึกเวลา (งานอื่น)",
    who: `${x.employeeCode || ""} ${x.employeeName || ""}`.trim() || "-",
    qty: `${Number(x.hours || 0)} ชม.`,
  }));

  const merged = [...stockItems, ...tsItems]
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 8);

  if (merged.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="4" class="empty">ยังไม่มีข้อมูล</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = merged
    .map((item) => {
      const time = item.seconds
        ? new Date(item.seconds * 1000).toLocaleString("th-TH")
        : "-";

      return `
        <tr>
          <td>${time}</td>
          <td>${item.label}</td>
          <td>${escapeHtml(item.who)}</td>
          <td>${escapeHtml(item.qty)}</td>
        </tr>
      `;
    })
    .join("");
}