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
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

// ======================================================
// FIREBASE
// ======================================================

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db = getFirestore(app);

const employeeCol = collection(db, "employees");
const timesheetCol = collection(db, "timesheets");
const payrollCol = collection(db, "payroll_payments");

// ======================================================
// STATE
// ======================================================

let tsEmployees = []; // {id, code, name, department, hourlyRate, active}
let timesheets = []; // {id, employeeId, date, hours, workType, note}
let payrollPayments = []; // {id(=month_employeeId), month, employeeId, paid, paidAt}

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

function currentMonthStr() {
  return todayStr().slice(0, 7); // YYYY-MM
}

function showTsStatus(message) {
  const el = $("status");
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
  setTimeout(() => {
    el.style.display = "none";
  }, 2200);
}

// ======================================================
// LOAD EMPLOYEES (read-only, for names/rates/departments)
// ======================================================

onSnapshot(
  employeeCol,
  (snapshot) => {
    tsEmployees = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    loadTimesheetEmployeeOptions();
    renderTimesheetTable();
    renderPayrollTable();
  },
  (error) => {
    console.error(error);
  },
);

function loadTimesheetEmployeeOptions() {
  const select = $("tsEmployee");
  if (!select) return;

  const current = select.value;

  const active = tsEmployees.filter((x) => x.active !== false);

  select.innerHTML =
    `<option value="">-- เลือกพนักงาน --</option>` +
    active
      .map(
        (x) => `
          <option value="${x.id}">
            ${escapeHtml(x.code)} - ${escapeHtml(x.name)} (${escapeHtml(x.department || "")})
          </option>
        `,
      )
      .join("");

  if (active.some((x) => x.id === current)) {
    select.value = current;
  }
}

// ======================================================
// LOAD TIMESHEETS (realtime)
// ======================================================

onSnapshot(
  timesheetCol,
  (snapshot) => {
    timesheets = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    renderTimesheetTable();
    renderPayrollTable();
  },
  (error) => {
    console.error(error);
    showTsStatus("อ่านข้อมูลบันทึกเวลาไม่ได้");
  },
);

// ======================================================
// LOAD PAYROLL PAYMENT STATUS (realtime)
// ======================================================

onSnapshot(
  payrollCol,
  (snapshot) => {
    payrollPayments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderPayrollTable();
    renderPayHistoryTable();
  },
  (error) => {
    console.error(error);
  },
);

// ======================================================
// PAY HISTORY TAB (เฉพาะรายการที่ "จ่ายแล้ว")
// ======================================================

$("payHistorySearch")?.addEventListener("input", renderPayHistoryTable);

function renderPayHistoryTable() {
  const table = $("payHistoryTableBody");
  if (!table) return;

  const keyword = $("payHistorySearch")?.value.trim().toLowerCase() || "";

  const paid = payrollPayments
    .filter((p) => p.paid === true)
    .filter((p) => {
      const text = `${p.month || ""} ${p.employeeCode || ""} ${p.employeeName || ""}`.toLowerCase();
      return text.includes(keyword);
    })
    .sort((a, b) => String(b.month || "").localeCompare(String(a.month || "")));

  if (paid.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="4" class="empty">ยังไม่มีประวัติการจ่าย</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = paid
    .map((p) => {
      const paidDate = p.paidAt?.seconds
        ? new Date(p.paidAt.seconds * 1000).toLocaleString("th-TH")
        : "-";

      return `
        <tr>
          <td>${escapeHtml(p.month)}</td>
          <td>${escapeHtml(p.employeeCode)} - ${escapeHtml(p.employeeName)}</td>
          <td>฿${money(p.amount)}</td>
          <td>${paidDate}</td>
        </tr>
      `;
    })
    .join("");
}

// ======================================================
// INIT DEFAULT DATE / MONTH INPUTS
// ======================================================

if ($("tsDate")) $("tsDate").value = todayStr();
if ($("tsMonthFilter")) $("tsMonthFilter").value = currentMonthStr();
if ($("payrollMonth")) $("payrollMonth").value = currentMonthStr();

// ======================================================
// ADD TIMESHEET ENTRY
// ======================================================

$("timesheetForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const employeeId = $("tsEmployee").value;
  const date = $("tsDate").value;
  const hours = Number($("tsHours").value);
  const workType = $("tsWorkType").value; // "production" | "other"
  const note = $("tsNote").value.trim();

  if (!employeeId) {
    showTsStatus("กรุณาเลือกพนักงาน");
    return;
  }

  if (!date) {
    showTsStatus("กรุณาเลือกวันที่");
    return;
  }

  if (!hours || hours <= 0 || hours > 24) {
    showTsStatus("กรุณากรอกชั่วโมงให้ถูกต้อง (0-24)");
    return;
  }

  const employee = tsEmployees.find((x) => x.id === employeeId);

  try {
    await addDoc(timesheetCol, {
      employeeId,
      employeeCode: employee?.code || "",
      employeeName: employee?.name || "",
      department: employee?.department || "",
      date,
      hours,
      workType,
      note,
      createdAt: serverTimestamp(),
    });

    showTsStatus("บันทึกเวลาทำงานแล้ว");

    $("tsHours").value = "";
    $("tsNote").value = "";
  } catch (error) {
    console.error(error);
    showTsStatus("บันทึกเวลาทำงานไม่สำเร็จ");
  }
});

// ======================================================
// DELETE TIMESHEET ENTRY
// ======================================================

async function deleteTimesheetEntry(id) {
  if (!confirm("ต้องการลบรายการบันทึกเวลานี้ใช่หรือไม่?")) return;

  try {
    await deleteDoc(doc(db, "timesheets", id));
    showTsStatus("ลบรายการแล้ว");
  } catch (error) {
    console.error(error);
    showTsStatus("ลบรายการไม่สำเร็จ");
  }
}

// ======================================================
// MONTH FILTER FOR TIMESHEET TABLE
// ======================================================

$("tsMonthFilter")?.addEventListener("input", renderTimesheetTable);

// ======================================================
// RENDER TIMESHEET TABLE + MONTH SUMMARY
// ======================================================

function renderTimesheetTable() {
  const table = $("timesheetTableBody");
  if (!table) return;

  const month = $("tsMonthFilter")?.value || currentMonthStr();

  const monthEntries = timesheets.filter((x) =>
    String(x.date || "").startsWith(month),
  );

  if (monthEntries.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="6" class="empty">ยังไม่มีบันทึกเวลาในเดือนนี้</td>
      </tr>
    `;
  } else {
    table.innerHTML = monthEntries
      .map((x) => {
        const rate = getEmployeeRate(x.employeeId);
        const amount = Number(x.hours || 0) * rate;

        return `
          <tr>
            <td>${escapeHtml(x.date)}</td>
            <td>${escapeHtml(x.employeeCode)} - ${escapeHtml(x.employeeName)}</td>
            <td>${
              x.workType === "production"
                ? '<span class="badge badge-production">ผลิต (DL)</span>'
                : '<span class="badge badge-other">งานอื่น (ทางอ้อม)</span>'
            }</td>
            <td>${Number(x.hours || 0).toFixed(2)} ชม.</td>
            <td>฿${money(amount)}</td>
            <td class="actions">
              <button class="danger" data-delete-timesheet="${x.id}">ลบ</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  document.querySelectorAll("[data-delete-timesheet]").forEach((btn) => {
    btn.addEventListener("click", () =>
      deleteTimesheetEntry(btn.dataset.deleteTimesheet),
    );
  });

  // ===== Month summary: direct (production) vs indirect (other) =====

  let productionHours = 0;
  let productionAmount = 0;
  let otherHours = 0;
  let otherAmount = 0;

  monthEntries.forEach((x) => {
    const rate = getEmployeeRate(x.employeeId);
    const amount = Number(x.hours || 0) * rate;

    if (x.workType === "production") {
      productionHours += Number(x.hours || 0);
      productionAmount += amount;
    } else {
      otherHours += Number(x.hours || 0);
      otherAmount += amount;
    }
  });

  if ($("tsProductionHours"))
    $("tsProductionHours").textContent = `${productionHours.toFixed(2)} ชม.`;

  if ($("tsProductionAmount"))
    $("tsProductionAmount").textContent = `฿${money(productionAmount)}`;

  if ($("tsOtherHours"))
    $("tsOtherHours").textContent = `${otherHours.toFixed(2)} ชม.`;

  if ($("tsOtherAmount"))
    $("tsOtherAmount").textContent = `฿${money(otherAmount)}`;
}

function getEmployeeRate(employeeId) {
  const employee = tsEmployees.find((x) => x.id === employeeId);
  return Number(employee?.hourlyRate ?? employee?.rate ?? 0);
}

// ======================================================
// PAYROLL MONTH FILTER
// ======================================================

$("payrollMonth")?.addEventListener("input", renderPayrollTable);

// ======================================================
// RENDER PAYROLL TABLE (grouped by employee for the month)
// ======================================================

function renderPayrollTable() {
  const table = $("payrollTableBody");
  if (!table) return;

  const month = $("payrollMonth")?.value || currentMonthStr();

  const monthEntries = timesheets.filter((x) =>
    String(x.date || "").startsWith(month),
  );

  // Group by employee

  const groups = {};

  monthEntries.forEach((x) => {
    if (!groups[x.employeeId]) {
      groups[x.employeeId] = {
        employeeId: x.employeeId,
        code: x.employeeCode,
        name: x.employeeName,
        department: x.department,
        productionHours: 0,
        otherHours: 0,
      };
    }

    if (x.workType === "production") {
      groups[x.employeeId].productionHours += Number(x.hours || 0);
    } else {
      groups[x.employeeId].otherHours += Number(x.hours || 0);
    }
  });

  const rows = Object.values(groups).sort((a, b) =>
    String(a.code || "").localeCompare(String(b.code || ""), undefined, {
      numeric: true,
    }),
  );

  if (rows.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="7" class="empty">ยังไม่มีบันทึกเวลาในเดือนนี้</td>
      </tr>
    `;
  } else {
    table.innerHTML = rows
      .map((row) => {
        const rate = getEmployeeRate(row.employeeId);
        const totalHours = row.productionHours + row.otherHours;
        const amount = totalHours * rate;

        const paymentId = `${month}_${row.employeeId}`;
        const payment = payrollPayments.find((p) => p.id === paymentId);
        const isPaid = payment?.paid === true;

        return `
          <tr>
            <td>${escapeHtml(row.code)} - ${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.department || "-")}</td>
            <td>${row.productionHours.toFixed(2)} ชม.</td>
            <td>${row.otherHours.toFixed(2)} ชม.</td>
            <td>${totalHours.toFixed(2)} ชม.</td>
            <td>฿${money(amount)}</td>
            <td class="actions">
              <span class="badge ${isPaid ? "badge-paid" : "badge-unpaid"}">
                ${isPaid ? "✅ จ่ายแล้ว" : "⏳ ยังไม่จ่าย"}
              </span>
              <button
                class="secondary"
                data-toggle-paid="${row.employeeId}"
                data-amount="${amount}"
              >
                ${isPaid ? "ยกเลิกจ่ายแล้ว" : "ทำเครื่องหมายว่าจ่ายแล้ว"}
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  document.querySelectorAll("[data-toggle-paid]").forEach((btn) => {
    btn.addEventListener("click", () =>
      togglePaid(
        btn.dataset.togglePaid,
        month,
        Number(btn.dataset.amount || 0),
      ),
    );
  });

  // ===== Payroll month totals =====

  const totalAmount = rows.reduce((sum, row) => {
    const rate = getEmployeeRate(row.employeeId);
    return sum + (row.productionHours + row.otherHours) * rate;
  }, 0);

  const paidAmount = rows.reduce((sum, row) => {
    const paymentId = `${month}_${row.employeeId}`;
    const payment = payrollPayments.find((p) => p.id === paymentId);

    if (payment?.paid !== true) return sum;

    const rate = getEmployeeRate(row.employeeId);
    return sum + (row.productionHours + row.otherHours) * rate;
  }, 0);

  if ($("payrollTotalAmount"))
    $("payrollTotalAmount").textContent = `฿${money(totalAmount)}`;

  if ($("payrollPaidAmount"))
    $("payrollPaidAmount").textContent = `฿${money(paidAmount)}`;

  if ($("payrollPendingAmount"))
    $("payrollPendingAmount").textContent = `฿${money(totalAmount - paidAmount)}`;
}

async function togglePaid(employeeId, month, amount) {
  const paymentId = `${month}_${employeeId}`;
  const existing = payrollPayments.find((p) => p.id === paymentId);
  const nextPaid = !(existing?.paid === true);

  const employee = tsEmployees.find((x) => x.id === employeeId);

  try {
    await setDoc(
      doc(db, "payroll_payments", paymentId),
      {
        month,
        employeeId,
        employeeCode: employee?.code || "",
        employeeName: employee?.name || "",
        amount,
        paid: nextPaid,
        paidAt: nextPaid ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    showTsStatus(nextPaid ? "บันทึกว่าจ่ายแล้ว" : "ยกเลิกสถานะจ่ายแล้ว");
  } catch (error) {
    console.error(error);
    showTsStatus("บันทึกสถานะจ่ายเงินไม่สำเร็จ");
  }
}