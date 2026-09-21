import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const db = getFirestore(app);

// ===============================
// FIRESTORE COLLECTION
// ===============================

const recipeCol = collection(db, "recipes");

const ingredientCol = collection(db, "ingredients");

// ===============================
// DATA
// ===============================

let recipes = [];

let ingredients = [];

// ===============================
// LOAD INGREDIENTS
// ===============================

async function loadIngredients() {
  try {
    const snapshot = await getDocs(ingredientCol);

    ingredients = [];

    snapshot.forEach((docSnap) => {
      ingredients.push({
        id: docSnap.id,

        ...docSnap.data(),
      });
    });
  } catch (error) {
    console.error("โหลดวัตถุดิบไม่ได้:", error);
  }
}

// ===============================
// LISTEN RECIPES REALTIME
// ===============================

export function listenRecipes() {
  onSnapshot(
    recipeCol,

    (snapshot) => {
      recipes = [];

      snapshot.forEach((docSnap) => {
        recipes.push({
          id: docSnap.id,

          ...docSnap.data(),
        });
      });

      renderRecipes();

      updateRecipeSummary();
    },

    (error) => {
      console.error("โหลดสูตรไม่ได้:", error);
    },
  );
}

// ===============================
// RENDER RECIPES
// ===============================

function renderRecipes() {
  const tbody = document.getElementById("recipeTableBody");

  if (!tbody) return;

  if (recipes.length === 0) {
    tbody.innerHTML = `

      <tr>

        <td
          colspan="7"
          style="text-align:center;">

          ยังไม่มีข้อมูลสูตร

        </td>

      </tr>

    `;

    return;
  }

  tbody.innerHTML = recipes
    .map((recipe) => {
      return `

        <tr>

          <td>
            ${escapeHtml(recipe.recipeCode || "-")}
          </td>

          <td>
            ${escapeHtml(recipe.recipeName || "-")}
          </td>

          <td>
            ${escapeHtml(recipe.packageSize || "-")}
          </td>

          <td>
            ${Number(recipe.productionQty || 0)}
          </td>

          <td>
            ${Number(recipe.dmCost || 0).toFixed(2)}
            บาท
          </td>

          <td>
            ${Number(recipe.dmCostPerUnit || 0).toFixed(2)}
            บาท
          </td>

          <td>

            <button
              class="small-btn"
              onclick="editRecipe('${recipe.id}')">

              แก้ไข

            </button>


            <button
              class="small-btn danger"
              onclick="removeRecipe('${recipe.id}')">

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

function updateRecipeSummary() {
  const count = document.getElementById("recipeCount");

  const count50 = document.getElementById("recipe50Count");

  const count500 = document.getElementById("recipe500Count");

  if (count) {
    count.textContent = recipes.length;
  }

  if (count50) {
    count50.textContent = recipes.filter(
      (item) => item.packageSize === "50g",
    ).length;
  }

  if (count500) {
    count500.textContent = recipes.filter(
      (item) => item.packageSize === "500g",
    ).length;
  }
}

// ===============================
// ADD BUTTON
// ===============================

document.addEventListener("click", async (event) => {
  if (event.target && event.target.id === "addRecipeBtn") {
    await loadIngredients();

    openRecipeForm();
  }
});

// ===============================
// OPEN FORM
// ===============================

function openRecipeForm(editData = null) {
  const ingredientOptions = ingredients
    .map((item) => {
      return `

          <option value="${item.id}">

            ${escapeHtml(item.name || item.code || item.id)}

          </option>

        `;
    })
    .join("");

  const modal = document.createElement("div");

  modal.className = "modal";

  modal.innerHTML = `

    <div class="modal-box recipe-modal-box">

      <div class="modal-head">

        <h3>

          ${editData ? "แก้ไขสูตร" : "เพิ่มสูตรเครื่องแกง"}

        </h3>


        <button
          id="closeRecipeModal"
          class="icon-btn">

          ×

        </button>

      </div>


      <form id="recipeForm">

        <label>

          รหัสสูตร

          <input
            id="recipeCode"
            required
            placeholder="RC001"
            value="${editData?.recipeCode || ""}">

        </label>


        <label>

          ชื่อสูตร

          <input
            id="recipeName"
            required
            placeholder="เครื่องแกงกะหรี่"
            value="${editData?.recipeName || ""}">

        </label>


        <label>

          ขนาดบรรจุ

          <select id="packageSize">

            <option
              value="50g"
              ${editData?.packageSize === "50g" ? "selected" : ""}>

              50g

            </option>


            <option
              value="500g"
              ${editData?.packageSize === "500g" ? "selected" : ""}>

              500g

            </option>

          </select>

        </label>


        <label>

          จำนวนผลิต

          <input
            id="productionQty"
            type="number"
            min="1"
            step="1"
            value="${editData?.productionQty || 100}"
            required>

        </label>


        <hr>


        <div class="recipe-title-row">

          <h3>
            วัตถุดิบในสูตร
          </h3>

          <span>
            ใส่จำนวนตามหน่วยต้นทุน
          </span>

        </div>


        <div id="recipeItems"></div>


        <button
          type="button"
          id="addIngredientRow"
          class="secondary">

          + เพิ่มวัตถุดิบ

        </button>


        <div class="cost-summary">

          <div>

            <span>
              ต้นทุน DM รวม
            </span>

            <strong id="totalDmCost">
              0.00 บาท
            </strong>

          </div>


          <div>

            <span>
              DM / หน่วย
            </span>

            <strong id="dmCostPerUnit">
              0.00 บาท
            </strong>

          </div>

        </div>


        <div class="form-actions">

          <button
            type="button"
            id="cancelRecipeBtn"
            class="secondary">

            ยกเลิก

          </button>


          <button
            type="submit"
            class="primary">

            บันทึกสูตร

          </button>

        </div>

      </form>

    </div>

  `;

  document.body.appendChild(modal);

  // CLOSE

  document
    .getElementById("closeRecipeModal")
    .addEventListener("click", () => modal.remove());

  document
    .getElementById("cancelRecipeBtn")
    .addEventListener("click", () => modal.remove());

  // ADD INGREDIENT

  document
    .getElementById("addIngredientRow")
    .addEventListener("click", () => addIngredientRow());

  // SAVE

  document
    .getElementById("recipeForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();

      await saveRecipe(editData?.id || null);
    });

  // EXISTING ITEMS

  if (editData && Array.isArray(editData.items) && editData.items.length > 0) {
    editData.items.forEach((item) => {
      addIngredientRow(item);
    });
  } else {
    addIngredientRow();
  }

  calculateDmCost();
}

// ===============================
// ADD INGREDIENT ROW
// ===============================

function addIngredientRow(data = {}) {
  const container = document.getElementById("recipeItems");

  if (!container) return;

  const row = document.createElement("div");

  row.className = "recipe-row";

  const options = ingredients
    .map((item) => {
      const selected = item.id === data.ingredientId ? "selected" : "";

      return `

          <option
            value="${item.id}"
            ${selected}>

            ${escapeHtml(item.name || item.code || item.id)}

          </option>

        `;
    })
    .join("");

  row.innerHTML = `

    <select class="ingredient-select">

      <option value="">

        -- เลือกวัตถุดิบ --

      </option>

      ${options}

    </select>


    <input
      class="ingredient-qty"
      type="number"
      min="0"
      step="0.001"
      placeholder="จำนวน"
      value="${data.qty || ""}">


    <span class="ingredient-cost">

      0.00 บาท

    </span>


    <button
      type="button"
      class="remove-row">

      ลบ

    </button>

  `;

  container.appendChild(row);

  // REMOVE

  row.querySelector(".remove-row").addEventListener("click", () => {
    row.remove();

    calculateDmCost();
  });

  // CHANGE

  row
    .querySelector(".ingredient-select")
    .addEventListener("change", calculateDmCost);

  row
    .querySelector(".ingredient-qty")
    .addEventListener("input", calculateDmCost);

  calculateDmCost();
}

// ===============================
// CALCULATE DM
// ===============================

function calculateDmCost() {
  const rows = document.querySelectorAll(".recipe-row");

  let total = 0;

  rows.forEach((row) => {
    const ingredientId = row.querySelector(".ingredient-select").value;

    const qty = Number(row.querySelector(".ingredient-qty").value);

    const ingredient = ingredients.find((item) => item.id === ingredientId);

    let cost = 0;

    if (ingredient) {
      const costPerUnit = Number(ingredient.costPerUnit || 0);

      cost = qty * costPerUnit;
    }

    const costElement = row.querySelector(".ingredient-cost");

    if (costElement) {
      costElement.textContent = `${cost.toFixed(2)} บาท`;
    }

    total += cost;
  });

  const productionQty = Number(
    document.getElementById("productionQty")?.value || 0,
  );

  const perUnit = productionQty > 0 ? total / productionQty : 0;

  const totalElement = document.getElementById("totalDmCost");

  const perUnitElement = document.getElementById("dmCostPerUnit");

  if (totalElement) {
    totalElement.textContent = `${total.toFixed(2)} บาท`;
  }

  if (perUnitElement) {
    perUnitElement.textContent = `${perUnit.toFixed(2)} บาท`;
  }

  return {
    total,

    perUnit,
  };
}

// ===============================
// SAVE RECIPE
// ===============================

async function saveRecipe(editId = null) {
  const recipeCode = document.getElementById("recipeCode").value.trim();

  const recipeName = document.getElementById("recipeName").value.trim();

  const packageSize = document.getElementById("packageSize").value;

  const productionQty = Number(document.getElementById("productionQty").value);

  if (!recipeCode) {
    alert("กรุณากรอกรหัสสูตร");

    return;
  }

  if (!recipeName) {
    alert("กรุณากรอกชื่อสูตร");

    return;
  }

  if (!productionQty || productionQty <= 0) {
    alert("กรุณาระบุจำนวนผลิต");

    return;
  }

  const rows = document.querySelectorAll(".recipe-row");

  const items = [];

  rows.forEach((row) => {
    const ingredientId = row.querySelector(".ingredient-select").value;

    const qty = Number(row.querySelector(".ingredient-qty").value);

    if (!ingredientId || qty <= 0) {
      return;
    }

    const ingredient = ingredients.find((item) => item.id === ingredientId);

    if (!ingredient) return;

    const costPerUnit = Number(ingredient.costPerUnit || 0);

    const cost = qty * costPerUnit;

    items.push({
      ingredientId,

      ingredientCode: ingredient.code || "",

      ingredientName: ingredient.name || "",

      qty,

      costPerUnit,

      costUnit: ingredient.costUnit || "",

      cost,
    });
  });

  if (items.length === 0) {
    alert("กรุณาเพิ่มวัตถุดิบอย่างน้อย 1 รายการ");

    return;
  }

  const dmCost = items.reduce((sum, item) => sum + item.cost, 0);

  const dmCostPerUnit = dmCost / productionQty;

  const recipeData = {
    recipeCode,

    recipeName,

    packageSize,

    productionQty,

    items,

    dmCost,

    dmCostPerUnit,

    updatedAt: new Date().toISOString(),
  };

  try {
    if (editId) {
      await updateDoc(
        doc(db, "recipes", editId),

        recipeData,
      );
    } else {
      recipeData.createdAt = new Date().toISOString();

      await addDoc(recipeCol, recipeData);
    }

    alert("บันทึกสูตรเรียบร้อยแล้ว");

    document.querySelector(".modal")?.remove();
  } catch (error) {
    console.error("บันทึกสูตรไม่ได้:", error);

    alert("บันทึกสูตรไม่ได้\n" + error.message);
  }
}

// ===============================
// EDIT
// ===============================

window.editRecipe = async function (id) {
  const recipe = recipes.find((item) => item.id === id);

  if (!recipe) return;

  await loadIngredients();

  openRecipeForm(recipe);
};

// ===============================
// DELETE
// ===============================

window.removeRecipe = async function (id) {
  const confirmDelete = confirm("ต้องการลบสูตรนี้หรือไม่?");

  if (!confirmDelete) return;

  try {
    await deleteDoc(doc(db, "recipes", id));
  } catch (error) {
    console.error("ลบสูตรไม่ได้:", error);

    alert("ลบสูตรไม่ได้\n" + error.message);
  }
};

// ===============================
// HTML ESCAPE
// ===============================

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")

    .replaceAll("<", "&lt;")

    .replaceAll(">", "&gt;")

    .replaceAll('"', "&quot;")

    .replaceAll("'", "&#039;");
}

// ===============================
// PRODUCTION QTY CHANGE
// ===============================

document.addEventListener("input", (event) => {
  if (event.target && event.target.id === "productionQty") {
    calculateDmCost();
  }
});

listenRecipes();
