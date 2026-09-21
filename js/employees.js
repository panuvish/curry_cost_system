import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const employeeCol = collection(db, "employees");

let employees = [];
let editingEmployeeId = null;

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

function showEmployeeStatus(message) {
  const el = $("status");

  if (!el) return;

  el.textContent = message;
  el.style.display = "block";

  setTimeout(() => {
    el.style.display = "none";
  }, 2200);
}

/* =========================
   REALTIME EMPLOYEES
========================= */

onSnapshot(employeeCol, (snapshot) => {
  employees = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  employees.sort((a, b) =>
    String(a.code || "").localeCompare(String(b.code || ""), "th"),
  );

  renderEmployees();
  renderEmployeeSummary();
  renderOHAllocation();
});

/* =========================
   EMPLOYEE TABLE
========================= */

function renderEmployees() {
  const table = $("employeeTable");

  if (!table) return;

  const keyword = ($("employeeSearch")?.value || "").trim().toLowerCase();

  const list = employees.filter(
    (x) =>
      String(x.code || "")
        .toLowerCase()
        .includes(keyword) ||
      String(x.name || "")
        .toLowerCase()
        .includes(keyword) ||
      String(x.department || "")
        .toLowerCase()
        .includes(keyword),
  );

  if (list.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;">
          ยังไม่มีข้อมูลพนักงาน
        </td>
      </tr>
    `;
    return;
  }

  table.innerHTML = list
    .map((item) => {
      const dailyWage =
        Number(item.hourlyRate || 0) * Number(item.workHours || 0);

      return `
      <tr>
        <td>${escapeHtml(item.code)}</td>

        <td>
          ${escapeHtml(item.name)}
        </td>

        <td>
          ${escapeHtml(item.department)}
        </td>

        <td>
          ฿${money(item.hourlyRate)}
        </td>

        <td>
          ${money(item.workHours)} ชม.
        </td>

        <td>
          ฿${money(dailyWage)}
        </td>

        <td>
          <span class="employee-status">
            ${item.active === false ? "ไม่ทำงาน" : "ทำงาน"}
          </span>
        </td>

        <td class="actions">
          <button
            class="secondary"
            data-employee-edit="${item.id}">
            แก้ไข
          </button>

          <button
            class="danger"
            data-employee-delete="${item.id}">
            ลบ
          </button>
        </td>
      </tr>
    `;
    })
    .join("");

  document.querySelectorAll("[data-employee-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      openEmployeeEdit(button.dataset.employeeEdit);
    });
  });

  document.querySelectorAll("[data-employee-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteEmployee(button.dataset.employeeDelete);
    });
  });
}

/* =========================
   SUMMARY
========================= */

function renderEmployeeSummary() {
  if ($("employeeCount")) {
    $("employeeCount").textContent = employees.length;
  }

  const totalHours = employees.reduce(
    (sum, x) => sum + Number(x.workHours || 0),
    0,
  );

  const totalDailyWage = employees.reduce(
    (sum, x) => sum + Number(x.hourlyRate || 0) * Number(x.workHours || 0),
    0,
  );

  if ($("totalEmployeeHours")) {
    $("totalEmployeeHours").textContent = `${money(totalHours)} ชม.`;
  }

  if ($("totalDailyWage")) {
    $("totalDailyWage").textContent = `฿${money(totalDailyWage)}`;
  }
}

/* =========================
   SEARCH
========================= */

$("employeeSearch")?.addEventListener("input", renderEmployees);

/* =========================
   MODAL
========================= */

function resetEmployeeForm() {
  $("employeeForm")?.reset();

  if ($("employeeId")) {
    $("employeeId").value = "";
  }

  editingEmployeeId = null;

  if ($("employeeModalTitle")) {
    $("employeeModalTitle").textContent = "เพิ่มพนักงาน";
  }
}

function openEmployeeAdd() {
  resetEmployeeForm();

  $("employeeModal")?.classList.remove("hidden");
}

function openEmployeeEdit(id) {
  const employee = employees.find((x) => x.id === id);

  if (!employee) return;

  editingEmployeeId = id;

  $("employeeId").value = id;
  $("employeeModalTitle").textContent = "แก้ไขข้อมูลพนักงาน";

  $("employeeCode").value = employee.code || "";

  $("employeeName").value = employee.name || "";

  $("employeeDepartment").value = employee.department || "";

  $("employeeRate").value = employee.hourlyRate ?? "";

  $("employeeHours").value = employee.workHours ?? 8;

  $("employeeActive").checked = employee.active !== false;

  $("employeeModal").classList.remove("hidden");
}

$("addEmployeeBtn")?.addEventListener("click", openEmployeeAdd);

$("closeEmployeeModal")?.addEventListener("click", () => {
  $("employeeModal")?.classList.add("hidden");
});

$("cancelEmployeeBtn")?.addEventListener("click", () => {
  $("employeeModal")?.classList.add("hidden");
});

/* =========================
   SAVE EMPLOYEE
========================= */

$("employeeForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = {
    code: $("employeeCode").value.trim(),

    name: $("employeeName").value.trim(),

    department: $("employeeDepartment").value.trim(),

    hourlyRate: Number($("employeeRate").value),

    workHours: Number($("employeeHours").value),

    active: $("employeeActive").checked,

    updatedAt: serverTimestamp(),
  };

  try {
    if (editingEmployeeId) {
      await updateDoc(doc(db, "employees", editingEmployeeId), data);

      showEmployeeStatus("แก้ไขข้อมูลพนักงานแล้ว");
    } else {
      await addDoc(employeeCol, {
        ...data,
        createdAt: serverTimestamp(),
      });

      showEmployeeStatus("เพิ่มพนักงานแล้ว");
    }

    $("employeeModal").classList.add("hidden");

    resetEmployeeForm();
  } catch (error) {
    console.error(error);

    showEmployeeStatus("บันทึกข้อมูลพนักงานไม่สำเร็จ");
  }
});

/* =========================
   DELETE
========================= */

async function deleteEmployee(id) {
  const employee = employees.find((x) => x.id === id);

  if (!employee) return;

  const confirmDelete = confirm(`ต้องการลบ ${employee.name} หรือไม่?`);

  if (!confirmDelete) return;

  try {
    await deleteDoc(doc(db, "employees", id));

    showEmployeeStatus("ลบข้อมูลพนักงานแล้ว");
  } catch (error) {
    console.error(error);

    showEmployeeStatus("ลบข้อมูลไม่สำเร็จ");
  }
}

/* =========================
   OH ALLOCATION
   BASE = LABOR HOURS
========================= */

function renderOHAllocation() {
  const table = $("ohAllocationTable");

  if (!table) return;

  const departmentMap = {};

  employees
    .filter((x) => x.active !== false)
    .forEach((employee) => {
      const department = employee.department || "ไม่ระบุ";

      if (!departmentMap[department]) {
        departmentMap[department] = {
          people: 0,
          hours: 0,
          wages: 0,
        };
      }

      departmentMap[department].people++;

      departmentMap[department].hours += Number(employee.workHours || 0);

      departmentMap[department].wages +=
        Number(employee.hourlyRate || 0) * Number(employee.workHours || 0);
    });

  const totalHours = Object.values(departmentMap).reduce(
    (sum, x) => sum + x.hours,
    0,
  );

  const rows = Object.entries(departmentMap);

  if (rows.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;">
          ยังไม่มีข้อมูล
        </td>
      </tr>
    `;

    return;
  }

  table.innerHTML = rows
    .map(([department, data]) => {
      const percentage = totalHours > 0 ? (data.hours / totalHours) * 100 : 0;

      return `
        <tr>

          <td>
            ${escapeHtml(department)}
          </td>

          <td>
            ${data.people}
          </td>

          <td>
            ${money(data.hours)}
          </td>

          <td>
            ฿${money(data.wages)}
          </td>

          <td>
            ${percentage.toFixed(2)}%
          </td>

          <td>
            ชั่วโมงแรงงาน
          </td>

        </tr>
      `;
    })
    .join("");

  if ($("ohTotalHours")) {
    $("ohTotalHours").textContent = `${money(totalHours)} ชม.`;
  }
}

/* =========================
   INITIAL DATA
========================= */

export async function seedEmployees() {
  const existing = await new Promise((resolve) => {
    let done = false;

    const unsubscribe = onSnapshot(employeeCol, (snapshot) => {
      if (!done) {
        done = true;

        unsubscribe();

        resolve(snapshot.docs.length);
      }
    });
  });

  if (existing > 0) {
    showEmployeeStatus("มีข้อมูลพนักงานอยู่แล้ว");

    return;
  }

  const employeeData = [
    {
      code: "01",
      name: "นางสายใจ เรืองกูล",
      department: "แผนกการเงินและบัญชี",
      hourlyRate: 65,
      workHours: 8,
      active: true,
    },

    {
      code: "02",
      name: "นางหยวน สุวรรณชาตรี",
      department: "แผนกผลิต",
      hourlyRate: 55,
      workHours: 8,
      active: true,
    },

    {
      code: "03",
      name: "นางผ่อนศรี อมรรัตน์",
      department: "แผนกผลิต",
      hourlyRate: 55,
      workHours: 8,
      active: true,
    },

    {
      code: "04",
      name: "นางสาวสุภาภรณ์ แสงจันทร์",
      department: "แผนกผลิต",
      hourlyRate: 55,
      workHours: 8,
      active: true,
    },

    {
      code: "05",
      name: "นางสาวพัชรี คงทอง",
      department: "ฝ่ายจัดซื้อและเตรียมวัตถุดิบ",
      hourlyRate: 45,
      workHours: 8,
      active: true,
    },

    {
      code: "06",
      name: "นางสาวอรทัย ชูช่วย",
      department: "ฝ่ายบรรจุภัณฑ์",
      hourlyRate: 40,
      workHours: 8,
      active: true,
    },

    {
      code: "07",
      name: "นางสาวจริงใจ แก้วมณี",
      department: "ฝ่ายบรรจุภัณฑ์",
      hourlyRate: 40,
      workHours: 8,
      active: true,
    },
  ];

  try {
    for (const employee of employeeData) {
      await addDoc(employeeCol, {
        ...employee,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    showEmployeeStatus("นำเข้าข้อมูลพนักงานแล้ว");
  } catch (error) {
    console.error(error);

    showEmployeeStatus("นำเข้าข้อมูลพนักงานไม่สำเร็จ");
  }
}

$("seedEmployeeBtn")?.addEventListener("click", seedEmployees);
