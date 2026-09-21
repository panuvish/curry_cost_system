import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";

/* =====================================================
   SETTINGS
   ALLOW_SIGNUP = false  -> เข้าได้เฉพาะบัญชีที่สร้างไว้ใน Firebase Console
   ALLOW_SIGNUP = true   -> ใครมีลิงก์ก็สมัครเองได้ (ดูคำเตือนเรื่อง Rules)
===================================================== */

const ALLOW_SIGNUP = false;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);

let mode = "login"; // "login" | "signup"

/* =====================================================
   LOAD APP AFTER LOGIN
   app.js / employees.js เริ่มฟังข้อมูล Firestore ทันทีที่ถูกโหลด
   จึงโหลดหลังล็อกอินเท่านั้น ไม่งั้น Rules ที่ต้องล็อกอินจะปฏิเสธ
===================================================== */

let appPromise = null;

function startApp() {
  if (!appPromise) {
    appPromise = (async () => {
      await import("./app.js");
      await import("./employees.js");
      await import("./Timesheet.js");
      await import("./recipes.js");
      await import("./products.js");
      await import("./dashboard.js");
    })();
  }

  return appPromise;
}

/* =====================================================
   SCREEN STATES
===================================================== */

function showLoading(text) {
  $("authLoadingText").textContent = text;
  $("authLoading").classList.remove("hidden");
  $("authPanel").classList.add("hidden");
}

function showLogin() {
  $("authLoading").classList.add("hidden");
  $("authPanel").classList.remove("hidden");
  $("authEmail").focus();
}

function unlockApp() {
  document.body.classList.remove("auth-locked");
}

function setMessage(text, type = "error") {
  const el = $("authMessage");

  if (!text) {
    el.hidden = true;
    el.textContent = "";
    return;
  }

  el.className = `auth-message ${type}`;
  el.textContent = text;
  el.hidden = false;
}

function setBusy(isBusy) {
  const button = $("authSubmit");

  button.disabled = isBusy;

  if (isBusy) {
    button.textContent =
      mode === "signup" ? "กำลังสร้างบัญชี…" : "กำลังเข้าสู่ระบบ…";
  } else {
    button.textContent = mode === "signup" ? "สร้างบัญชี" : "เข้าสู่ระบบ";
  }
}

/* =====================================================
   ERROR MESSAGES
===================================================== */

function errorMessage(error) {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง ตรวจสอบแล้วลองอีกครั้ง หรือกด “ลืมรหัสผ่าน”";

    case "auth/invalid-email":
      return "รูปแบบอีเมลไม่ถูกต้อง เช่น name@example.com";

    case "auth/missing-password":
      return "กรอกรหัสผ่านก่อน";

    case "auth/too-many-requests":
      return "ลองเข้าสู่ระบบหลายครั้งเกินไป รอสักครู่แล้วลองใหม่ หรือกด “ลืมรหัสผ่าน” เพื่อตั้งรหัสใหม่";

    case "auth/network-request-failed":
      return "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ตรวจสอบสัญญาณแล้วลองอีกครั้ง";

    case "auth/user-disabled":
      return "บัญชีนี้ถูกปิดใช้งาน ติดต่อผู้ดูแลระบบ";

    case "auth/email-already-in-use":
      return "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน";

    case "auth/weak-password":
      return "รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 6 ตัวอักษร";

    case "auth/operation-not-allowed":
      return "ยังไม่ได้เปิดการล็อกอินด้วยอีเมล ไปที่ Firebase Console → Authentication → Sign-in method แล้วเปิด Email/Password";

    default:
      return `เข้าสู่ระบบไม่สำเร็จ (${error?.code || "unknown"})`;
  }
}

/* =====================================================
   LOGIN / SIGNUP MODE
===================================================== */

function applyMode() {
  const isSignup = mode === "signup";

  $("authTitle").textContent = isSignup ? "สมัครสมาชิก" : "เข้าสู่ระบบ";

  $("authHint").textContent = isSignup
    ? "ตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร"
    : "กรอกอีเมลและรหัสผ่านเพื่อใช้งานระบบต้นทุนเครื่องแกง";

  $("authPassword").autocomplete = isSignup
    ? "new-password"
    : "current-password";

  $("authForgot").hidden = isSignup;

  $("authToggle").textContent = isSignup
    ? "มีบัญชีแล้ว? เข้าสู่ระบบ"
    : "ยังไม่มีบัญชี? สมัครสมาชิก";

  setMessage("");
  setBusy(false);
}

if (ALLOW_SIGNUP) {
  $("authToggle").hidden = false;

  $("authToggle").addEventListener("click", () => {
    mode = mode === "signup" ? "login" : "signup";
    applyMode();
  });
}

/* =====================================================
   SUBMIT
===================================================== */

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  setMessage("");
  setBusy(true);

  try {
    if (mode === "signup") {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }

    // onAuthStateChanged จะพาเข้าหน้าระบบต่อเอง
    $("authPassword").value = "";
  } catch (error) {
    console.error(error);
    setMessage(errorMessage(error));
  } finally {
    setBusy(false);
  }
});

/* =====================================================
   FORGOT PASSWORD
===================================================== */

$("authForgot").addEventListener("click", async () => {
  const email = $("authEmail").value.trim();

  if (!email) {
    setMessage("กรอกอีเมลก่อน แล้วกด “ลืมรหัสผ่าน” อีกครั้ง");
    $("authEmail").focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);

    setMessage(
      `ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${email} แล้ว ตรวจสอบกล่องจดหมายและจดหมายขยะ`,
      "info",
    );
  } catch (error) {
    console.error(error);
    setMessage(errorMessage(error));
  }
});

/* =====================================================
   SHOW / HIDE PASSWORD
===================================================== */

$("authShowPassword").addEventListener("click", () => {
  const input = $("authPassword");
  const willShow = input.type === "password";

  input.type = willShow ? "text" : "password";

  $("authShowPassword").textContent = willShow ? "ซ่อน" : "แสดง";

  $("authShowPassword").setAttribute(
    "aria-label",
    willShow ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน",
  );
});

/* =====================================================
   LOGOUT
===================================================== */

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
    alert("ออกจากระบบไม่สำเร็จ ลองอีกครั้ง");
  }
});

/* =====================================================
   AUTH STATE
===================================================== */

showLoading("กำลังตรวจสอบการเข้าสู่ระบบ…");

onAuthStateChanged(auth, async (user) => {
  if (user) {
    showLoading("กำลังโหลดข้อมูล…");

    try {
      await startApp();
    } catch (error) {
      console.error(error);

      showLogin();
      setMessage("โหลดระบบไม่สำเร็จ ลองรีเฟรชหน้าเว็บอีกครั้ง");

      return;
    }

    $("userEmail").textContent = user.email || "";
    $("userEmail").title = user.email || "";

    unlockApp();

    return;
  }

  // ออกจากระบบ (รวมถึงออกจากแท็บอื่น) หลังเข้าระบบแล้ว
  // รีโหลดเพื่อหยุดการฟังข้อมูลและล้างข้อมูลที่ค้างบนหน้าจอ
  if (appPromise) {
    location.reload();
    return;
  }

  showLogin();
});