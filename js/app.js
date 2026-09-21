import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

// ======================================================
// FIREBASE
// ======================================================

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

// Collections

const ingredientCol = collection(db, "ingredients");

const laborCol = collection(db, "labor_rates");

const overheadCol = collection(db, "overhead");

const employeeCol = collection(db, "employees");

const stockTransactionCol = collection(db, "stock_transactions");

// ======================================================
// VARIABLES
// ======================================================

let ingredients = [];

let employees = [];

let editingIngredientId = null;

// ======================================================
// HELPER
// ======================================================

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

function showStatus(message) {
  const el = $("status");

  el.textContent = message;

  el.style.display = "block";

  setTimeout(() => {
    el.style.display = "none";
  }, 2200);
}

// ======================================================
// NAVIGATION
// ======================================================

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-btn")
      .forEach((x) => x.classList.remove("active"));

    document
      .querySelectorAll(".section")
      .forEach((x) => x.classList.remove("active"));

    btn.classList.add("active");

    const section = $(btn.dataset.section);

    if (section) {
      section.classList.add("active");
    }
  });
});

// ======================================================
// GENERIC TABS (ใช้ร่วมกันทุกหน้าที่มี .tab-bar / .tab-panel
// เช่นหน้า "ค่าแรงและเงินเดือน" ที่มี 3 แท็บ)
// ======================================================

document.querySelectorAll(".tab-btn[data-tab-group]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const group = btn.dataset.tabGroup;
    const tab = btn.dataset.tab;

    document
      .querySelectorAll(`.tab-btn[data-tab-group="${group}"]`)
      .forEach((b) => b.classList.remove("active"));

    btn.classList.add("active");

    document
      .querySelectorAll(`.tab-panel[data-tab-group="${group}"]`)
      .forEach((p) => p.classList.remove("active"));

    document
      .querySelector(
        `.tab-panel[data-tab-group="${group}"][data-tab-panel="${tab}"]`,
      )
      ?.classList.add("active");
  });
});

// ======================================================
// INGREDIENTS REALTIME
// ======================================================

onSnapshot(
  ingredientCol,

  (snapshot) => {
    ingredients = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    renderIngredients();

    renderStock();

    loadStockIngredientOptions();
  },

  (error) => {
    console.error(error);

    showStatus("อ่านข้อมูลวัตถุดิบไม่ได้");
  },
);

// ======================================================
// RENDER INGREDIENTS
// ======================================================

function renderIngredients() {
  const table = $("ingredientTable");

  if (!table) return;

  const keyword = $("ingredientSearch")?.value.trim().toLowerCase() || "";

  const list = ingredients

    .filter(
      (x) =>
        String(x.name || "")
          .toLowerCase()
          .includes(keyword) ||
        String(x.code || "")
          .toLowerCase()
          .includes(keyword),
    )

    .sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));

  table.innerHTML = list
    .map(
      (item) => `

      <tr>

        <td>
          ${escapeHtml(item.code)}
        </td>

        <td>
          ${escapeHtml(item.name)}
        </td>

        <td>
          ${item.category === "PACKAGING" ? "บรรจุภัณฑ์" : "DM"}
        </td>

        <td>
          ${money(item.purchaseQty)}
          ${escapeHtml(item.purchaseUnit)}
        </td>

        <td>
          ฿${money(item.purchasePrice)}
        </td>

        <td>
          ฿${money(item.costPerUnit)}
        </td>

        <td>
          ${escapeHtml(item.costUnit || "")}
        </td>

        <td>
          ${money(item.stockQty || 0)}
        </td>

        <td class="actions">

          <button
            class="secondary"
            data-edit-ingredient="${item.id}"
          >
            แก้ไข
          </button>

          <button
            class="danger"
            data-delete-ingredient="${item.id}"
          >
            ลบ
          </button>

        </td>

      </tr>

    `,
    )
    .join("");

  $("ingredientCount").textContent = ingredients.length;

  $("rawCount").textContent = ingredients.filter(
    (x) => x.category === "DM",
  ).length;

  $("packCount").textContent = ingredients.filter(
    (x) => x.category === "PACKAGING",
  ).length;

  document.querySelectorAll("[data-edit-ingredient]").forEach((btn) => {
    btn.addEventListener("click", () =>
      openIngredientEdit(btn.dataset.editIngredient),
    );
  });

  document.querySelectorAll("[data-delete-ingredient]").forEach((btn) => {
    btn.addEventListener("click", () =>
      removeIngredient(btn.dataset.deleteIngredient),
    );
  });
}

// Search

$("ingredientSearch")?.addEventListener("input", renderIngredients);

// ======================================================
// INGREDIENT MODAL
// ======================================================

function resetIngredientForm() {
  $("ingredientForm").reset();

  $("ingredientId").value = "";

  editingIngredientId = null;

  $("modalTitle").textContent = "เพิ่มวัตถุดิบ";
}

function openIngredientAdd() {
  resetIngredientForm();

  $("ingredientModal").classList.remove("hidden");
}

function openIngredientEdit(id) {
  const item = ingredients.find((x) => x.id === id);

  if (!item) return;

  editingIngredientId = id;

  $("ingredientId").value = id;

  $("modalTitle").textContent = "แก้ไขวัตถุดิบ";

  $("code").value = item.code || "";

  $("name").value = item.name || "";

  $("category").value = item.category || "DM";

  $("purchaseQty").value = item.purchaseQty ?? "";

  $("purchaseUnit").value = item.purchaseUnit || "";

  $("purchasePrice").value = item.purchasePrice ?? "";

  $("costPerUnit").value = item.costPerUnit ?? "";

  $("costUnit").value = item.costUnit || "";

  $("ingredientModal").classList.remove("hidden");
}

$("addIngredientBtn").addEventListener("click", openIngredientAdd);

$("closeModal").addEventListener("click", () =>
  $("ingredientModal").classList.add("hidden"),
);

$("cancelBtn").addEventListener("click", () =>
  $("ingredientModal").classList.add("hidden"),
);

// ======================================================
// SAVE INGREDIENT
// ======================================================

$("ingredientForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    code: $("code").value.trim(),

    name: $("name").value.trim(),

    category: $("category").value,

    purchaseQty: Number($("purchaseQty").value),

    purchaseUnit: $("purchaseUnit").value.trim(),

    purchasePrice: Number($("purchasePrice").value),

    costPerUnit: Number($("costPerUnit").value),

    costUnit: $("costUnit").value.trim(),

    updatedAt: serverTimestamp(),
  };

  try {
    if (editingIngredientId) {
      await updateDoc(doc(db, "ingredients", editingIngredientId), data);

      showStatus("แก้ไขข้อมูลแล้ว");
    } else {
      await addDoc(ingredientCol, {
        ...data,

        stockQty: 0,

        createdAt: serverTimestamp(),
      });

      showStatus("เพิ่มข้อมูลแล้ว");
    }

    $("ingredientModal").classList.add("hidden");

    resetIngredientForm();
  } catch (error) {
    console.error(error);

    showStatus("บันทึกไม่สำเร็จ");
  }
});

// ======================================================
// DELETE INGREDIENT
// ======================================================

async function removeIngredient(id) {
  if (!confirm("ต้องการลบรายการนี้ใช่หรือไม่?")) return;

  try {
    await deleteDoc(doc(db, "ingredients", id));

    showStatus("ลบข้อมูลแล้ว");
  } catch (error) {
    console.error(error);

    showStatus("ลบไม่สำเร็จ");
  }
}

// ======================================================
// SEED DATA
// ======================================================

$("seedBtn").addEventListener("click", seedData);

async function seedData() {
  if (!confirm("นำเข้าข้อมูล DM, DL และ OH ชุดเริ่มต้นหรือไม่?")) return;

  const batch = writeBatch(db);

  const ingredientData = [
    ["RM001", "พริกสด", "DM", 10, "กก.", 600, 60, "กก."],

    ["RM002", "พริกแห้ง", "DM", 10, "กก.", 1600, 160, "กก."],

    ["RM003", "ขมิ้น", "DM", 10, "กก.", 750, 75, "กก."],

    ["RM004", "กระเทียม", "DM", 10, "กก.", 500, 50, "กก."],

    ["RM005", "เกลือผสมไอโอดีน", "DM", 1, "กก.", 60, 60, "กก."],

    ["RM006", "พริกไทยดำ", "DM", 0.5, "กก.", 179, 358, "กก."],

    ["RM007", "ตะไคร้", "DM", 10, "กก.", 650, 65, "กก."],

    ["RM008", "หอมแดง", "DM", 10, "กก.", 600, 60, "กก."],

    ["RM009", "ข่า", "DM", 10, "กก.", 890, 89, "กก."],

    ["RM010", "ใบมะกรูด", "DM", 2, "กก.", 160, 80, "กก."],

    ["PK001", "ซอง 50 กรัม ชั้นใน", "PACKAGING", 100, "ใบ", 35, 0.35, "ใบ"],

    ["PK002", "ซอง 50 กรัม ชั้นนอก", "PACKAGING", 100, "ใบ", 55, 0.55, "ใบ"],

    ["PK003", "ซอง 500 กรัม ชั้นใน", "PACKAGING", 100, "ใบ", 70, 0.7, "ใบ"],

    ["PK004", "ซอง 500 กรัม ชั้นนอก", "PACKAGING", 100, "ใบ", 150, 1.5, "ใบ"],

    ["PK005", "ค่าสกรีน", "PACKAGING", 1, "ซอง", 2, 2, "ซอง"],
  ];

  ingredientData.forEach(
    ([
      code,
      name,
      category,
      purchaseQty,
      purchaseUnit,
      purchasePrice,
      costPerUnit,
      costUnit,
    ]) => {
      const ref = doc(ingredientCol);

      batch.set(ref, {
        code,
        name,
        category,
        purchaseQty,
        purchaseUnit,
        purchasePrice,
        costPerUnit,
        costUnit,

        stockQty: 0,

        createdAt: serverTimestamp(),

        updatedAt: serverTimestamp(),
      });
    },
  );

  const laborData = [
    ["DL001", "ฝ่ายการเงินและบัญชี", 65],

    ["DL002", "ฝ่ายผลิต", 55],

    ["DL003", "ฝ่ายจัดซื้อ/จัดเตรียมวัตถุดิบ", 45],

    ["DL004", "ฝ่ายบรรจุภัณฑ์", 40],
  ];

  laborData.forEach(([code, name, rate]) => {
    const ref = doc(laborCol);

    batch.set(ref, {
      code,
      name,
      rate,
      unit: "บาท/ชั่วโมง",

      createdAt: serverTimestamp(),
    });
  });

  const overheadData = [
    ["OH001", "ค่าเช่า", 3500, "บาท/เดือน"],

    ["OH002", "ค่าเสื่อมราคาสะสม-เครื่องบด", 750, "บาท/เดือน"],

    ["OH003", "ค่าเสื่อมราคาสะสม-เครื่องซีล", 133.33, "บาท/เดือน"],

    ["OH004", "ค่าเสื่อมราคาสะสม-เครื่องผสม", 283.33, "บาท/เดือน"],

    ["OH005", "ค่าสกรีน", 2, "บาท/ซอง"],

    ["OH006", "ค่าน้ำ", 200, "บาท/เดือน"],

    ["OH007", "ค่าไฟ", 3000, "บาท/เดือน"],

    ["OH008", "ค่าแก๊ส", 480, "บาท/ถัง"],

    ["OH009", "ค่าซ่อมบำรุงเครื่องซีล", 500, "บาท/ครั้ง"],

    ["OH010", "ค่าใช้จ่ายเบ็ดเตล็ด", 190, "บาท/เดือน"],
  ];

  overheadData.forEach(([code, name, rate, unit]) => {
    const ref = doc(overheadCol);

    batch.set(ref, {
      code,
      name,
      rate,
      unit,

      createdAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();

    showStatus("นำเข้าข้อมูลเริ่มต้นแล้ว");
  } catch (error) {
    console.error(error);

    showStatus("นำเข้าข้อมูลไม่สำเร็จ");
  }
}

// ======================================================
// LABOR REALTIME
// ======================================================

onSnapshot(
  laborCol,

  (snapshot) => {
    $("laborTable").innerHTML = snapshot.docs
      .map((d) => {
        const x = d.data();

        return `

            <tr>

              <td>
                ${escapeHtml(x.code)}
              </td>

              <td>
                ${escapeHtml(x.name)}
              </td>

              <td>
                ฿${money(x.rate)}
              </td>

            </tr>

          `;
      })
      .join("");
  },
);

// ======================================================
// OH REALTIME
// ======================================================

let overheadData = [];

onSnapshot(
  overheadCol,

  (snapshot) => {
    overheadData = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    $("overheadTable").innerHTML = overheadData
      .map(
        (x) => `

          <tr>

            <td>
              ${escapeHtml(x.code)}
            </td>

            <td>
              ${escapeHtml(x.name)}
            </td>

            <td>
              ฿${money(x.rate)}
            </td>

            <td>
              ${escapeHtml(x.unit)}
            </td>

          </tr>

        `,
      )
      .join("");

    renderOHAllocation();
  },
);

// ======================================================
// STOCK
// ======================================================

function renderStock() {
  const table = $("stockTableBody");

  if (!table) return;

  const keyword = $("stockSearch")?.value.trim().toLowerCase() || "";

  const list = ingredients

    .filter((x) => x.category === "DM")

    .filter(
      (x) =>
        String(x.name || "")
          .toLowerCase()
          .includes(keyword) ||
        String(x.code || "")
          .toLowerCase()
          .includes(keyword),
    );

  table.innerHTML = list
    .map((item) => {
      const stock = Number(item.stockQty || 0);

      const value = stock * Number(item.costPerUnit || 0);

      return `

        <tr>

          <td>
            ${escapeHtml(item.code)}
          </td>

          <td>
            ${escapeHtml(item.name)}
          </td>

          <td>
            ${escapeHtml(item.costUnit || "")}
          </td>

          <td>
            ฿${money(item.costPerUnit)}
          </td>

          <td>
            ${money(stock)}
          </td>

          <td>
            ฿${money(value)}
          </td>

        </tr>

      `;
    })
    .join("");

  const dm = ingredients.filter((x) => x.category === "DM");

  $("stockItemCount").textContent = dm.length;

  $("stockAvailableCount").textContent = dm.filter(
    (x) => Number(x.stockQty || 0) > 0,
  ).length;

  $("stockEmptyCount").textContent = dm.filter(
    (x) => Number(x.stockQty || 0) <= 0,
  ).length;
}

$("stockSearch")?.addEventListener("input", renderStock);

// ======================================================
// STOCK SELECT
// ======================================================

function loadStockIngredientOptions() {
  const select = $("stockIngredient");

  if (!select) return;

  const currentValue = select.value;

  const dm = ingredients.filter((x) => x.category === "DM");

  select.innerHTML = `

    <option value="">
      -- เลือกวัตถุดิบ --
    </option>

    ${dm
      .map(
        (item) => `

          <option value="${item.id}">

            ${escapeHtml(item.code)}
            -
            ${escapeHtml(item.name)}

          </option>

        `,
      )
      .join("")}

  `;

  if (dm.some((x) => x.id === currentValue)) {
    select.value = currentValue;
  }
}

// ======================================================
// STOCK MODAL
// ======================================================

function openStockModal(type) {
  $("stockForm").reset();

  $("stockTransactionType").value = type;

  if (type === "IN") {
    $("stockModalTitle").textContent = "รับเข้าวัตถุดิบ";
  } else {
    $("stockModalTitle").textContent = "จ่ายออกวัตถุดิบ";
  }

  loadStockIngredientOptions();

  $("stockModal").classList.remove("hidden");
}

$("receiveStockBtn").addEventListener("click", () => openStockModal("IN"));

$("issueStockBtn").addEventListener("click", () => openStockModal("OUT"));

$("closeStockModal").addEventListener("click", () =>
  $("stockModal").classList.add("hidden"),
);

$("cancelStockBtn").addEventListener("click", () =>
  $("stockModal").classList.add("hidden"),
);

// ======================================================
// STOCK TRANSACTION
// ======================================================

$("stockForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const type = $("stockTransactionType").value;

  const ingredientId = $("stockIngredient").value;

  const qty = Number($("stockQty").value);

  const note = $("stockNote").value.trim();

  if (!ingredientId) {
    showStatus("กรุณาเลือกวัตถุดิบ");

    return;
  }

  if (qty <= 0) {
    showStatus("จำนวนต้องมากกว่า 0");

    return;
  }

  try {
    const ingredientRef = doc(db, "ingredients", ingredientId);

    await runTransaction(db, async (transaction) => {
      const ingredientSnap = await transaction.get(ingredientRef);

      if (!ingredientSnap.exists()) {
        throw new Error("ไม่พบวัตถุดิบ");
      }

      const data = ingredientSnap.data();

      const currentStock = Number(data.stockQty || 0);

      let newStock;

      if (type === "IN") {
        newStock = currentStock + qty;
      } else {
        if (qty > currentStock) {
          throw new Error("สต็อกไม่เพียงพอ");
        }

        newStock = currentStock - qty;
      }

      transaction.update(ingredientRef, {
        stockQty: newStock,

        updatedAt: serverTimestamp(),
      });

      const historyRef = doc(stockTransactionCol);

      transaction.set(historyRef, {
        ingredientId,

        ingredientCode: data.code || "",

        ingredientName: data.name || "",

        type,

        qty,

        previousStock: currentStock,

        newStock,

        note,

        createdAt: serverTimestamp(),
      });
    });

    $("stockModal").classList.add("hidden");

    showStatus(type === "IN" ? "รับเข้าสต็อกแล้ว" : "จ่ายออกจากสต็อกแล้ว");
  } catch (error) {
    console.error(error);

    showStatus(
      error.message === "สต็อกไม่เพียงพอ"
        ? "สต็อกไม่เพียงพอ"
        : "บันทึกสต็อกไม่สำเร็จ",
    );
  }
});

// ======================================================
// STOCK HISTORY
// ======================================================

onSnapshot(
  stockTransactionCol,

  (snapshot) => {
    const rows = snapshot.docs
      .map((d) => ({
        id: d.id,
        ...d.data(),
      }))

      .sort(
        (a, b) =>
          Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0),
      );

    $("stockHistoryBody").innerHTML = rows
      .map((x) => {
        const date = x.createdAt?.seconds
          ? new Date(x.createdAt.seconds * 1000).toLocaleString("th-TH")
          : "-";

        const typeText = x.type === "IN" ? "รับเข้า" : "จ่ายออก";

        return `

          <tr>

            <td>
              ${date}
            </td>

            <td>
              ${x.type === "IN" ? "🟢 รับเข้า" : "🔴 จ่ายออก"}
            </td>

            <td>
              ${escapeHtml(x.ingredientName)}
            </td>

            <td>
              ${money(x.qty)}
            </td>

            <td>
              ${escapeHtml(x.note || "-")}
            </td>

          </tr>

        `;
      })
      .join("");
  },
);

// ======================================================
// EMPLOYEES (read-only mirror — employees.js owns the
// employee table/modal/CRUD/seed. This listener only keeps
// `employees` in sync here so OH allocation can use it.)
// ======================================================

onSnapshot(
  employeeCol,

  (snapshot) => {
    employees = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    renderOHAllocation();
  },
);

// ======================================================
// OH ALLOCATION
// ======================================================

function renderOHAllocation() {
  const table = $("ohAllocationTable");

  if (!table) return;

  const activeEmployees = employees.filter(
    (x) => x.active !== false
  );

  // ชั่วโมงแรงงานรวม
  const totalHours = activeEmployees.reduce(
    (sum, x) =>
      sum + Number(x.workHours ?? x.hours ?? 0),
    0
  );

  // ค่าแรงรวม
  const totalLabor = activeEmployees.reduce(
    (sum, x) =>
      sum +
      Number(x.hourlyRate ?? x.rate ?? 0) *
        Number(x.workHours ?? x.hours ?? 0),
    0
  );

  // OH รวม
  const totalOH = overheadData.reduce(
    (sum, x) => sum + Number(x.rate || 0),
    0
  );

  // แสดงยอดรวมด้านบน
  $("ohTotalHours").textContent =
    `${money(totalHours)} ชม.`;

  $("ohTotalLabor").textContent =
    `฿${money(totalLabor)}`;

  $("ohTotalCost").textContent =
    `฿${money(totalOH)}`;

  // ถ้าไม่มีพนักงาน
  if (activeEmployees.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="6" class="empty">
          ยังไม่มีข้อมูลพนักงาน
        </td>
      </tr>
    `;

    return;
  }

  // ====================================================
  // รวมข้อมูลตามฝ่าย
  // ====================================================

  const groups = {};

  activeEmployees.forEach((employee) => {
    const department =
      employee.department || "ไม่ระบุ";

    if (!groups[department]) {
      groups[department] = {
        people: 0,
        hours: 0,
        wage: 0,
      };
    }

    const workHours = Number(
      employee.workHours ?? employee.hours ?? 0
    );

    const hourlyRate = Number(
      employee.hourlyRate ?? employee.rate ?? 0
    );

    groups[department].people += 1;

    groups[department].hours += workHours;

    groups[department].wage +=
      hourlyRate * workHours;
  });

  // ====================================================
  // แสดงตาราง
  // ====================================================

  table.innerHTML = Object.entries(groups)
    .map(([department, data]) => {
      const ratio =
        totalHours > 0
          ? data.hours / totalHours
          : 0;

      const allocatedOH =
        totalOH * ratio;

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
            ฿${money(data.wage)}
          </td>

          <td>
            ${(ratio * 100).toFixed(2)}%
          </td>

          <td>
            ฿${money(allocatedOH)}
          </td>

        </tr>
      `;
    })
    .join("");
}

// ======================================================
// END
// ======================================================

console.log("Curry Cost System loaded successfully.");