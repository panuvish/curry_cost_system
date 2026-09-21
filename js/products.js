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

const recipeCol = collection(db, "recipes");

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ตัดขนาดบรรจุ/ตัวเลขท้ายชื่อออก เพื่อจัดกลุ่มสูตร "50g" กับ "500g"
// ของเครื่องแกงชนิดเดียวกันให้เป็นสินค้าใบเดียวกัน
function productKey(recipeName) {
  return String(recipeName || "ไม่ระบุชื่อ")
    .replace(/\s*\(?\d+\s*(g|kg|กรัม|กก\.?)\)?\s*$/i, "")
    .trim() || "ไม่ระบุชื่อ";
}

onSnapshot(
  recipeCol,
  (snapshot) => {
    const recipes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderProductCards(recipes);
  },
  (error) => {
    console.error(error);
  },
);

function renderProductCards(recipes) {
  const container = $("productCards");
  if (!container) return;

  if (recipes.length === 0) {
    container.innerHTML = `
      <p class="empty">ยังไม่มีสูตร — ไปที่เมนู "3. สูตรการผลิต" เพื่อเพิ่มสูตรก่อน</p>
    `;
    return;
  }

  const groups = {};

  recipes.forEach((recipe) => {
    const key = productKey(recipe.recipeName);

    if (!groups[key]) {
      groups[key] = { name: key, variants: [] };
    }

    groups[key].variants.push(recipe);
  });

  container.innerHTML = Object.values(groups)
    .sort((a, b) => a.name.localeCompare(b.name, "th"))
    .map((group) => {
      const sizeChips = group.variants
        .map(
          (v) =>
            `<span class="size-chip">${escapeHtml(v.packageSize || "-")}</span>`,
        )
        .join("");

      const avgDm =
        group.variants.reduce(
          (sum, v) => sum + Number(v.dmCostPerUnit || 0),
          0,
        ) / group.variants.length;

      return `
        <div class="product-card">
          <h3>🌶️ ${escapeHtml(group.name)}</h3>

          <div class="product-sizes">
            ${sizeChips}
          </div>

          <dl>
            <dt>จำนวนสูตรย่อย</dt>
            <dd>${group.variants.length} สูตร</dd>

            <dt>DM เฉลี่ย/หน่วย</dt>
            <dd>฿${avgDm.toFixed(2)}</dd>

            <dt>สต็อกสำเร็จรูป</dt>
            <dd>ยังไม่มี (รอระบบผลิต)</dd>
          </dl>
        </div>
      `;
    })
    .join("");
}