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
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

// ===============================
// FIREBASE
// ===============================

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db = getFirestore(app);

const employeeCol = collection(db, "employees");

// ===============================
// VARIABLES
// ===============================

let employees = [];
let editingEmployeeId = null;

// ===============================
// HELPER
// ===============================

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

// ===============================
// REALTIME EMPLOYEES
// ===============================

onSnapshot(
  employeeCol,
  (snapshot) => {
    employees = snapshot.docs
      .map((d) => ({
        id: d.id,
        ...d.data(),
      }))
      .sort((a, b) =>
        String(a.code || "").localeCompare(
          String(b.code || ""),
          undefined,
          {
            numeric: true,
          },
        ),
      );

    renderEmployees();
  },
  (error) => {
    console.error("Employee snapshot error:", error);
    showEmployeeStatus("อ่านข้อมูลพนักงานไม่ได้");
  },
);

// ===============================
// RENDER
// ===============================

function renderEmployees() {
  const keyword =
    $("employeeSearch")?.value.trim().toLowerCase() || "";

  const list = employees.filter((employee) => {
    const text = `
      ${employee.code || ""}
      ${employee.name || ""}
      ${employee.department || ""}
    `.toLowerCase();

    return text.includes(keyword);
  });

  const table = $("employeeTable");

  if (!table) return;

  if (list.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center">
          ยังไม่มีข้อมูลพนักงาน
        </td>
      </tr>
    `;
  } else {
    table.innerHTML = list
      .map((employee) => {
        const rate = Number(employee.hourlyRate || 0);
        const hours = Number(employee.workHours || 0);
        const dailyWage = rate * hours;

        return `
          <tr>
            <td>${escapeHtml(employee.code)}</td>

            <td>${escapeHtml(employee.name)}</td>

            <td>${escapeHtml(employee.department)}</td>

            <td>฿${money(rate)}</td>

            <td>${hours.toFixed(2)}</td>

            <td>฿${money(dailyWage)}</td>

            <td>
              ${
                employee.active !== false
                  ? `
                    <span class="employee-status active">
                      🟢 ทำงานอยู่
                    </span>
                  `
                  : `
                    <span class="employee-status inactive">
                      🔴 ไม่ทำงาน
                    </span>
                  `
              }
            </td>

            <td class="actions">
              <button
                class="secondary"
                data-edit-employee="${employee.id}"
              >
                แก้ไข
              </button>

              <button
                class="danger"
                data-delete-employee="${employee.id}"
              >
                ลบ
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // ===============================
  // SUMMARY
  // ===============================

  const activeEmployees = employees.filter(
    (employee) => employee.active !== false,
  );

  const totalHours = activeEmployees.reduce(
    (sum, employee) =>
      sum + Number(employee.workHours || 0),
    0,
  );

  const totalDailyWage = activeEmployees.reduce(
    (sum, employee) =>
      sum +
      Number(employee.hourlyRate || 0) *
        Number(employee.workHours || 0),
    0,
  );

  if ($("employeeCount")) {
    $("employeeCount").textContent = employees.length;
  }

  if ($("totalEmployeeHours")) {
    $("totalEmployeeHours").textContent =
      `${totalHours.toFixed(2)} ชม.`;
  }

  if ($("totalDailyWage")) {
    $("totalDailyWage").textContent =
      `฿${money(totalDailyWage)}`;
  }

  // ===============================
  // BUTTON EVENTS
  // ===============================

  document
    .querySelectorAll("[data-edit-employee]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        openEmployeeEdit(button.dataset.editEmployee);
      });
    });

  document
    .querySelectorAll("[data-delete-employee]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        deleteEmployee(button.dataset.deleteEmployee);
      });
    });
}

// ===============================
// SEARCH
// ===============================

$("employeeSearch")?.addEventListener(
  "input",
  renderEmployees,
);

// ===============================
// OPEN ADD
// ===============================

$("addEmployeeBtn")?.addEventListener("click", () => {
  resetEmployeeForm();

  $("employeeModalTitle").textContent =
    "เพิ่มพนักงาน";

  $("employeeModal").classList.remove("hidden");
});

// ===============================
// OPEN EDIT
// ===============================

function openEmployeeEdit(id) {
  const employee = employees.find(
    (item) => item.id === id,
  );

  if (!employee) return;

  editingEmployeeId = id;

  $("employeeId").value = id;

  $("employeeCode").value =
    employee.code || "";

  $("employeeName").value =
    employee.name || "";

  $("employeeDepartment").value =
    employee.department || "";

  $("employeeRate").value =
    employee.hourlyRate ?? "";

  $("employeeHours").value =
    employee.workHours ?? 8;

  $("employeeActive").checked =
    employee.active !== false;

  $("employeeModalTitle").textContent =
    "แก้ไขข้อมูลพนักงาน";

  $("employeeModal").classList.remove("hidden");
}

// ===============================
// RESET FORM
// ===============================

function resetEmployeeForm() {
  editingEmployeeId = null;

  $("employeeForm")?.reset();

  if ($("employeeId")) {
    $("employeeId").value = "";
  }

  if ($("employeeHours")) {
    $("employeeHours").value = 8;
  }

  if ($("employeeActive")) {
    $("employeeActive").checked = true;
  }
}

// ===============================
// CLOSE MODAL
// ===============================

$("closeEmployeeModal")?.addEventListener(
  "click",
  () => {
    $("employeeModal").classList.add("hidden");
  },
);

$("cancelEmployeeBtn")?.addEventListener(
  "click",
  () => {
    $("employeeModal").classList.add("hidden");
  },
);

// ===============================
// SAVE EMPLOYEE
// ===============================

$("employeeForm")?.addEventListener(
  "submit",
  async (event) => {
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
        await updateDoc(
          doc(
            db,
            "employees",
            editingEmployeeId,
          ),
          data,
        );

        showEmployeeStatus(
          "แก้ไขข้อมูลพนักงานแล้ว",
        );
      } else {
        await addDoc(employeeCol, {
          ...data,
          createdAt: serverTimestamp(),
        });

        showEmployeeStatus(
          "เพิ่มพนักงานแล้ว",
        );
      }

      $("employeeModal").classList.add(
        "hidden",
      );

      resetEmployeeForm();
    } catch (error) {
      console.error(error);

      showEmployeeStatus(
        "บันทึกข้อมูลพนักงานไม่สำเร็จ",
      );
    }
  },
);

// ===============================
// DELETE EMPLOYEE
// ===============================

async function deleteEmployee(id) {
  const employee = employees.find(
    (item) => item.id === id,
  );

  if (!employee) return;

  const confirmDelete = confirm(
    `ต้องการลบ ${employee.name} ใช่หรือไม่?`,
  );

  if (!confirmDelete) return;

  try {
    await deleteDoc(
      doc(db, "employees", id),
    );

    showEmployeeStatus(
      "ลบข้อมูลพนักงานแล้ว",
    );
  } catch (error) {
    console.error(error);

    showEmployeeStatus(
      "ลบข้อมูลไม่สำเร็จ",
    );
  }
}

// ===============================
// SEED EMPLOYEES
// ===============================

$("seedEmployeeBtn")?.addEventListener(
  "click",
  seedEmployees,
);

async function seedEmployees() {
  const confirmSeed = confirm(
    "ต้องการรีเซ็ตข้อมูลพนักงานเป็น 7 คนหรือไม่?",
  );

  if (!confirmSeed) return;

  try {
    // ===============================
    // ข้อมูลพนักงาน 7 คน
    // ===============================

    const employeeData = [
      {
        code: "EMP001",
        name: "นางสายใจ เรืองกูล",
        department: "ฝ่ายการเงินและบัญชี",
        hourlyRate: 65,
        workHours: 8,
        active: true,
      },

      {
        code: "EMP002",
        name: "นางหยวน สุวรรณชาตรี",
        department: "ฝ่ายผลิต",
        hourlyRate: 55,
        workHours: 8,
        active: true,
      },

      {
        code: "EMP003",
        name: "นางผ่อนศรี อมรรัตน์",
        department: "ฝ่ายผลิต",
        hourlyRate: 55,
        workHours: 8,
        active: true,
      },

      {
        code: "EMP004",
        name: "นางสาวสุภาภรณ์ แสงจันทร์",
        department: "ฝ่ายผลิต",
        hourlyRate: 55,
        workHours: 8,
        active: true,
      },

      {
        code: "EMP005",
        name: "นางสาวพัชรี คงทอง",
        department: "ฝ่ายจัดซื้อและเตรียมวัตถุดิบ",
        hourlyRate: 45,
        workHours: 8,
        active: true,
      },

      {
        code: "EMP006",
        name: "นางสาวอรทัย ชูช่วย",
        department: "ฝ่ายบรรจุภัณฑ์",
        hourlyRate: 40,
        workHours: 8,
        active: true,
      },

      {
        code: "EMP007",
        name: "นางสาวจริงใจ แก้วมณี",
        department: "ฝ่ายบรรจุภัณฑ์",
        hourlyRate: 40,
        workHours: 8,
        active: true,
      },
    ];

    // ===============================
    // STEP 1
    // ลบข้อมูลเดิม
    // ===============================

    if (employees.length > 0) {
      const deleteBatch = writeBatch(db);

      employees.forEach((employee) => {
        deleteBatch.delete(
          doc(db, "employees", employee.id),
        );
      });

      await deleteBatch.commit();
    }

    // ===============================
    // STEP 2
    // เพิ่มข้อมูลใหม่ 7 คน
    // ===============================

    const insertBatch = writeBatch(db);

    employeeData.forEach((employee) => {
      const ref = doc(
        db,
        "employees",
        employee.code,
      );

      insertBatch.set(ref, {
        ...employee,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      });
    });

    await insertBatch.commit();

    // ===============================
    // SUCCESS
    // ===============================

    showEmployeeStatus(
      "รีเซ็ตข้อมูลพนักงานเป็น 7 คนแล้ว",
    );

    console.log(
      "Seed employees completed: 7 employees",
    );

  } catch (error) {
    console.error(
      "Seed employee error:",
      error,
    );

    showEmployeeStatus(
      "รีเซ็ตข้อมูลพนักงานไม่สำเร็จ",
    );
  }
}