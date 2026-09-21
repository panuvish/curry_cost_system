import { listenRecipes } from "./recipes.js";

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ingredientCol = collection(db, "ingredients");
const laborCol = collection(db, "labor_rates");
const overheadCol = collection(db, "overhead");

let ingredients = [];
let editingId = null;

const $ = (id) => document.getElementById(id);

function showStatus(message) {
  const el = $("status");
  el.textContent = message;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 2200);
}

function money(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---------------- Navigation ----------------
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-btn")
      .forEach((x) => x.classList.remove("active"));
    document
      .querySelectorAll(".section")
      .forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.section).classList.add("active");
  });
});

// ---------------- Realtime Ingredients ----------------
onSnapshot(ingredientCol, (snapshot) => {
  ingredients = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  renderIngredients();
  renderStock();

}, (error) => {
    console.error(error);
    showStatus("อ่านข้อมูลไม่ได้ ตรวจสอบ Firebase Rules/Config");
  },
);

function renderIngredients() {
  const keyword = $("ingredientSearch").value.trim().toLowerCase();
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

  $("ingredientTable").innerHTML = list
    .map(
      (item) => `
    <tr>
      <td>${escapeHtml(item.code)}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${item.category === "PACKAGING" ? "บรรจุภัณฑ์" : "DM"}</td>
      <td>${money(item.purchaseQty)} ${escapeHtml(item.purchaseUnit)}</td>
      <td>฿${money(item.purchasePrice)}</td>
      <td>฿${money(item.costPerUnit)}</td>
      <td>${escapeHtml(item.costUnit || "")}</td>
      <td class="actions">
        <button class="secondary" data-edit="${item.id}">แก้ไข</button>
        <button class="danger" data-delete="${item.id}">ลบ</button>
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

  document
    .querySelectorAll("[data-edit]")
    .forEach((btn) =>
      btn.addEventListener("click", () => openEdit(btn.dataset.edit)),
    );
  document
    .querySelectorAll("[data-delete]")
    .forEach((btn) =>
      btn.addEventListener("click", () => removeIngredient(btn.dataset.delete)),
    );
}

$("ingredientSearch").addEventListener("input", renderIngredients);

// ---------------- Modal ----------------
function resetForm() {
  $("ingredientForm").reset();
  $("ingredientId").value = "";
  editingId = null;
  $("modalTitle").textContent = "เพิ่มวัตถุดิบ";
}

function openAdd() {
  resetForm();
  $("ingredientModal").classList.remove("hidden");
}

function openEdit(id) {
  const item = ingredients.find((x) => x.id === id);
  if (!item) return;

  editingId = id;
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

$("addIngredientBtn").addEventListener("click", openAdd);
$("closeModal").addEventListener("click", () =>
  $("ingredientModal").classList.add("hidden"),
);
$("cancelBtn").addEventListener("click", () =>
  $("ingredientModal").classList.add("hidden"),
);

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
    if (editingId) {
      await updateDoc(doc(db, "ingredients", editingId), data);
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
    resetForm();
  } catch (error) {
    console.error(error);
    showStatus("บันทึกไม่สำเร็จ");
  }
});

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

// ---------------- Seed initial data ----------------
$("seedBtn").addEventListener("click", seedData);

async function seedData() {
  if (!confirm("นำเข้าข้อมูล DM, DL และ OH ชุดเริ่มต้นหรือไม่?")) return;

  const batch = writeBatch(db);

  const ingredients = [
    ["RM001", "พริกสด", "DM", 10, "กก.", 600, 60, "กก."],
    ["RM002", "พริกแห้ง", "DM", 10, "กก.", 1600, 160, "กก."],
    ["RM003", "ขมิ้น", "DM", 10, "กก.", 750, 75, "กก."],
    ["RM004", "กระเทียม", "DM", 10, "กก.", 500, 50, "กก."],
    ["RM005", "เกลือผสมไอโอดีน", "DM", 1, "โหล", 60, 60, "โหล"],
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

  ingredients.forEach(
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

  const labor = [
    ["DL001", "ฝ่ายการเงินและบัญชี", 65],
    ["DL002", "ฝ่ายผลิต", 55],
    ["DL003", "ฝ่ายจัดซื้อ/จัดเตรียมวัตถุดิบ", 45],
    ["DL004", "ฝ่ายบรรจุภัณฑ์", 40],
  ];
  labor.forEach(([code, name, rate]) => {
    const ref = doc(laborCol);
    batch.set(ref, {
      code,
      name,
      rate,
      unit: "บาท/ชั่วโมง",
      createdAt: serverTimestamp(),
    });
  });

  const overhead = [
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
  overhead.forEach(([code, name, rate, unit]) => {
    const ref = doc(overheadCol);
    batch.set(ref, { code, name, rate, unit, createdAt: serverTimestamp() });
  });

  try {
    await batch.commit();
    showStatus("นำเข้าข้อมูลเริ่มต้นแล้ว");
  } catch (error) {
    console.error(error);
    showStatus("นำเข้าข้อมูลไม่สำเร็จ");
  }
}

// ---------------- Realtime Labor / OH ----------------
onSnapshot(laborCol, (snapshot) => {
  $("laborTable").innerHTML = snapshot.docs
    .map((d) => {
      const x = d.data();
      return `<tr><td>${escapeHtml(x.code)}</td><td>${escapeHtml(x.name)}</td><td>฿${money(x.rate)}</td></tr>`;
    })
    .join("");
});

onSnapshot(overheadCol, (snapshot) => {
  $("overheadTable").innerHTML = snapshot.docs
    .map((d) => {
      const x = d.data();
      return `<tr><td>${escapeHtml(x.code)}</td><td>${escapeHtml(x.name)}</td><td>฿${money(x.rate)}</td><td>${escapeHtml(x.unit)}</td></tr>`;
    })
    .join("");
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

listenRecipes();

// =====================================================
// STOCK MANAGEMENT
// =====================================================

const stockTransactionCol = collection(db, "stock_transactions");

let stockTransactionType = "RECEIVE";

// -------------------------
// Open Receive Modal
// -------------------------

$("receiveStockBtn").addEventListener("click", () => {
  openStockModal("RECEIVE");
});

// -------------------------
// Open Issue Modal
// -------------------------

$("issueStockBtn").addEventListener("click", () => {
  openStockModal("ISSUE");
});

// -------------------------
// Open Modal
// -------------------------

function openStockModal(type) {

  stockTransactionType = type;

  $("stockForm").reset();

  $("stockTransactionType").value = type;

  if (type === "RECEIVE") {

    $("stockModalTitle").textContent =
      "รับเข้าวัตถุดิบ";

  } else {

    $("stockModalTitle").textContent =
      "จ่ายออกวัตถุดิบ";

  }

  loadStockIngredientOptions();

  $("stockModal").classList.remove("hidden");
}

// -------------------------
// Close Modal
// -------------------------

function closeStockModal() {

  $("stockModal").classList.add("hidden");

  $("stockForm").reset();
}

$("closeStockModal").addEventListener(
  "click",
  closeStockModal
);

$("cancelStockBtn").addEventListener(
  "click",
  closeStockModal
);

// -------------------------
// Ingredient Options
// -------------------------

function loadStockIngredientOptions() {

  const select = $("stockIngredient");

  select.innerHTML = `
    <option value="">
      -- เลือกวัตถุดิบ --
    </option>
  `;

  const dmIngredients = ingredients
    .filter(item => item.category === "DM")
    .sort((a, b) =>
      String(a.code || "").localeCompare(
        String(b.code || "")
      )
    );

  dmIngredients.forEach(item => {

    const option = document.createElement("option");

    option.value = item.id;

    option.textContent =
      `${item.code} - ${item.name} (คงเหลือ ${Number(item.stockQty || 0).toLocaleString("th-TH")} ${item.costUnit || ""})`;

    select.appendChild(option);

  });
}

// -------------------------
// Submit Stock Transaction
// -------------------------

$("stockForm").addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    const ingredientId =
      $("stockIngredient").value;

    const qty =
      Number($("stockQty").value);

    const note =
      $("stockNote").value.trim();

    if (!ingredientId) {

      showStatus("กรุณาเลือกวัตถุดิบ");

      return;
    }

    if (!qty || qty <= 0) {

      showStatus("กรุณาระบุจำนวนให้ถูกต้อง");

      return;
    }

    const ingredient =
      ingredients.find(
        item => item.id === ingredientId
      );

    if (!ingredient) {

      showStatus("ไม่พบวัตถุดิบ");

      return;
    }

    const currentStock =
      Number(ingredient.stockQty || 0);

    // -------------------------
    // Check Issue Stock
    // -------------------------

    if (
      stockTransactionType === "ISSUE" &&
      qty > currentStock
    ) {

      showStatus(
        `สต็อกไม่พอ เหลือ ${currentStock} ${ingredient.costUnit || ""}`
      );

      return;
    }

    try {

      const ingredientRef =
        doc(
          db,
          "ingredients",
          ingredientId
        );

      const transactionRef =
        doc(stockTransactionCol);

      await runTransaction(
        db,
        async (transaction) => {

          const ingredientSnap =
            await transaction.get(
              ingredientRef
            );

          if (!ingredientSnap.exists()) {

            throw new Error(
              "ไม่พบวัตถุดิบ"
            );
          }

          const data =
            ingredientSnap.data();

          const oldStock =
            Number(data.stockQty || 0);

          let newStock;

          if (
            stockTransactionType === "RECEIVE"
          ) {

            newStock =
              oldStock + qty;

          } else {

            if (qty > oldStock) {

              throw new Error(
                `สต็อกไม่พอ เหลือ ${oldStock}`
              );
            }

            newStock =
              oldStock - qty;
          }

          transaction.update(
            ingredientRef,
            {
              stockQty: newStock,
              updatedAt: serverTimestamp()
            }
          );

          transaction.set(
            transactionRef,
            {
              ingredientId: ingredientId,

              ingredientCode:
                data.code || "",

              ingredientName:
                data.name || "",

              type:
                stockTransactionType,

              qty: qty,

              unit:
                data.costUnit || "",

              previousStock:
                oldStock,

              newStock:
                newStock,

              note: note,

              createdAt:
                serverTimestamp()
            }
          );

        }
      );

      closeStockModal();

      if (
        stockTransactionType === "RECEIVE"
      ) {

        showStatus(
          "รับเข้าวัตถุดิบเรียบร้อยแล้ว"
        );

      } else {

        showStatus(
          "จ่ายออกวัตถุดิบเรียบร้อยแล้ว"
        );
      }

    } catch (error) {

      console.error(error);

      showStatus(
        error.message ||
        "บันทึกการเคลื่อนไหวไม่สำเร็จ"
      );

    }

  }
);

// =====================================================
// STOCK TABLE
// =====================================================

function renderStock() {

  const keyword =
    $("stockSearch").value
      .trim()
      .toLowerCase();

  const list =
    ingredients
      .filter(item =>
        item.category === "DM"
      )
      .filter(item =>
        String(item.name || "")
          .toLowerCase()
          .includes(keyword) ||

        String(item.code || "")
          .toLowerCase()
          .includes(keyword)
      )
      .sort((a, b) =>
        String(a.code || "")
          .localeCompare(
            String(b.code || "")
          )
      );

  $("stockTableBody").innerHTML =
    list.map(item => {

      const stock =
        Number(item.stockQty || 0);

      const cost =
        Number(item.costPerUnit || 0);

      const stockValue =
        stock * cost;

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
            ฿${money(cost)}
          </td>

          <td>
            <strong>
              ${stock.toLocaleString("th-TH")}
            </strong>
            ${escapeHtml(item.costUnit || "")}
          </td>

          <td>
            ฿${money(stockValue)}
          </td>

        </tr>
      `;

    }).join("");

  $("stockItemCount").textContent =
    list.length;

  $("stockAvailableCount").textContent =
    list.filter(
      item => Number(item.stockQty || 0) > 0
    ).length;

  $("stockEmptyCount").textContent =
    list.filter(
      item => Number(item.stockQty || 0) <= 0
    ).length;
}

$("stockSearch").addEventListener(
  "input",
  renderStock
);

// Update stock whenever ingredients change
const originalRenderIngredients =
  renderIngredients;

// =====================================================
// STOCK HISTORY
// =====================================================

onSnapshot(
  stockTransactionCol,
  snapshot => {

    const history =
      snapshot.docs
        .map(d => ({
          id: d.id,
          ...d.data()
        }))
        .sort((a, b) => {

          const aTime =
            a.createdAt?.seconds || 0;

          const bTime =
            b.createdAt?.seconds || 0;

          return bTime - aTime;

        });

    $("stockHistoryBody").innerHTML =
      history.map(item => {

        let dateText = "-";

        if (item.createdAt) {

          const date =
            item.createdAt.toDate();

          dateText =
            date.toLocaleString(
              "th-TH"
            );
        }

        const typeText =
          item.type === "RECEIVE"
            ? "รับเข้า"
            : "จ่ายออก";

        return `
          <tr>

            <td>
              ${dateText}
            </td>

            <td>
              <strong>
                ${typeText}
              </strong>
            </td>

            <td>
              ${escapeHtml(
                item.ingredientCode || ""
              )}
              -
              ${escapeHtml(
                item.ingredientName || ""
              )}
            </td>

            <td>
              ${Number(
                item.qty || 0
              ).toLocaleString("th-TH")}
              ${escapeHtml(
                item.unit || ""
              )}
            </td>

            <td>
              ${escapeHtml(
                item.note || "-"
              )}
            </td>

          </tr>
        `;

      }).join("");

  },
  error => {

    console.error(error);

    showStatus(
      "อ่านประวัติสต็อกไม่ได้"
    );

  }
);

// =====================================================
// NAVIGATION STOCK
// =====================================================

document
  .querySelectorAll(".nav-btn")
  .forEach(btn => {

    btn.addEventListener(
      "click",
      () => {

        if (
          btn.dataset.section === "stock"
        ) {

          renderStock();

          loadStockIngredientOptions();
        }

      }
    );

  });