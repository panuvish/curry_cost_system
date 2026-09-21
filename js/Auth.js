import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { app } from "./firebase-config.js";

// ใช้ Firebase App ที่สร้างจาก firebase-config.js
const auth = getAuth(app);

/* =====================================================
   SETTINGS
===================================================== */

// false = เฉพาะบัญชีที่สร้างไว้ใน Firebase Console
// true  = ผู้ใช้สามารถสมัครสมาชิกเองได้
const ALLOW_SIGNUP = false;

/* =====================================================
   HELPERS
===================================================== */

const $ = (id) => document.getElementById(id);

let mode = "login";

/* =====================================================
   LOAD APP AFTER LOGIN
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
  const loading = $("authLoading");
  const panel = $("authPanel");
  const loadingText = $("authLoadingText");

  if (loadingText) {
    loadingText.textContent = text;
  }

  if (loading) {
    loading.classList.remove("hidden");
  }

  if (panel) {
    panel.classList.add("hidden");
  }
}

function showLogin() {
  const loading = $("authLoading");
  const panel = $("authPanel");
  const email = $("authEmail");

  if (loading) {
    loading.classList.add("hidden");
  }

  if (panel) {
    panel.classList.remove("hidden");
  }

  if (email) {
    email.focus();
  }
}

function unlockApp() {
  document.body.classList.remove("auth-locked");
}

/* =====================================================
   MESSAGE
===================================================== */

function setMessage(text, type = "error") {
  const el = $("authMessage");

  if (!el) {
    return;
  }

  if (!text) {
    el.hidden = true;
    el.textContent = "";
    return;
  }

  el.className = `auth-message ${type}`;
  el.textContent = text;
  el.hidden = false;
}

/* =====================================================
   BUTTON BUSY
===================================================== */

function setBusy(isBusy) {
  const button = $("authSubmit");

  if (!button) {
    return;
  }

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
  console.error("Firebase Auth Error:", error);

  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง ตรวจสอบแล้วลองอีกครั้ง";

    case "auth/invalid-email":
      return "รูปแบบอีเมลไม่ถูกต้อง เช่น name@example.com";

    case "auth/missing-password":
      return "กรอกรหัสผ่านก่อน";

    case "auth/too-many-requests":
      return "ลองเข้าสู่ระบบหลายครั้งเกินไป รอสักครู่แล้วลองใหม่";

    case "auth/network-request-failed":
      return "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";

    case "auth/user-disabled":
      return "บัญชีนี้ถูกปิดใช้งาน ติดต่อผู้ดูแลระบบ";

    case "auth/email-already-in-use":
      return "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน";

    case "auth/weak-password":
      return "รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 6 ตัวอักษร";

    case "auth/operation-not-allowed":
      return "ยังไม่ได้เปิด Email/Password ใน Firebase Authentication";

    case "auth/invalid-api-key":
      return "Firebase API Key ไม่ถูกต้อง";

    case "auth/app-not-authorized":
      return "เว็บไซต์นี้ยังไม่ได้รับอนุญาตจาก Firebase Authentication";

    case "auth/unauthorized-domain":
      return "โดเมนนี้ยังไม่ได้เพิ่มใน Firebase Authentication → Settings → Authorized domains";

    default:
      return `เข้าสู่ระบบไม่สำเร็จ (${error?.code || "unknown"})`;
  }
}

/* =====================================================
   LOGIN / SIGNUP MODE
===================================================== */

function applyMode() {
  const isSignup = mode === "signup";

  const title = $("authTitle");
  const hint = $("authHint");
  const password = $("authPassword");
  const forgot = $("authForgot");
  const toggle = $("authToggle");

  if (title) {
    title.textContent = isSignup ? "สมัครสมาชิก" : "เข้าสู่ระบบ";
  }

  if (hint) {
    hint.textContent = isSignup
      ? "ตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร"
      : "กรอกอีเมลและรหัสผ่านเพื่อใช้งานระบบต้นทุนเครื่องแกง";
  }

  if (password) {
    password.autocomplete = isSignup ? "new-password" : "current-password";
  }

  if (forgot) {
    forgot.hidden = isSignup;
  }

  if (toggle) {
    toggle.textContent = isSignup
      ? "มีบัญชีแล้ว? เข้าสู่ระบบ"
      : "ยังไม่มีบัญชี? สมัครสมาชิก";
  }

  setMessage("");
  setBusy(false);
}

/* =====================================================
   SIGNUP TOGGLE
===================================================== */

const authToggle = $("authToggle");

if (authToggle) {
  if (ALLOW_SIGNUP) {
    authToggle.hidden = false;

    authToggle.addEventListener("click", () => {
      mode = mode === "signup" ? "login" : "signup";

      applyMode();
    });
  } else {
    authToggle.hidden = true;
  }
}

/* =====================================================
   LOGIN / SIGNUP SUBMIT
===================================================== */

const authForm = $("authForm");

if (authForm) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("authEmail")?.value.trim();
    const password = $("authPassword")?.value;

    if (!email) {
      setMessage("กรอกอีเมลก่อน");
      return;
    }

    if (!password) {
      setMessage("กรอกรหัสผ่านก่อน");
      return;
    }

    setMessage("");
    setBusy(true);

    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      if ($("authPassword")) {
        $("authPassword").value = "";
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  });
}

/* =====================================================
   FORGOT PASSWORD
===================================================== */

const authForgot = $("authForgot");

if (authForgot) {
  authForgot.addEventListener("click", async () => {
    const email = $("authEmail")?.value.trim();

    if (!email) {
      setMessage("กรอกอีเมลก่อน แล้วกด “ลืมรหัสผ่าน” อีกครั้ง");

      $("authEmail")?.focus();

      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);

      setMessage(
        `ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${email} แล้ว ตรวจสอบกล่องจดหมายและจดหมายขยะ`,
        "info",
      );
    } catch (error) {
      setMessage(errorMessage(error));
    }
  });
}

/* =====================================================
   SHOW / HIDE PASSWORD
===================================================== */

const authShowPassword = $("authShowPassword");

if (authShowPassword) {
  authShowPassword.addEventListener("click", () => {
    const input = $("authPassword");

    if (!input) {
      return;
    }

    const willShow = input.type === "password";

    input.type = willShow ? "text" : "password";

    authShowPassword.textContent = willShow ? "ซ่อน" : "แสดง";

    authShowPassword.setAttribute(
      "aria-label",
      willShow ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน",
    );
  });
}

/* =====================================================
   LOGOUT
===================================================== */

const logoutBtn = $("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);

      alert("ออกจากระบบไม่สำเร็จ ลองอีกครั้ง");
    }
  });
}

/* =====================================================
   AUTH STATE
===================================================== */

showLoading("กำลังตรวจสอบการเข้าสู่ระบบ…");

onAuthStateChanged(auth, async (user) => {
  console.log(
    "Firebase Auth State:",
    user ? `Logged in: ${user.email}` : "Not logged in",
  );

  // ===================================================
  // USER LOGIN
  // ===================================================

  if (user) {
    showLoading("กำลังโหลดข้อมูล…");

    try {
      await startApp();
    } catch (error) {
      console.error("โหลดระบบไม่สำเร็จ:", error);

      showLogin();

      setMessage("โหลดระบบไม่สำเร็จ ลองรีเฟรชหน้าเว็บอีกครั้ง");

      return;
    }

    // แสดง Email ผู้ใช้
    const userEmail = $("userEmail");

    if (userEmail) {
      userEmail.textContent = user.email || "";

      userEmail.title = user.email || "";
    }

    // ปลดล็อกระบบ
    unlockApp();

    return;
  }

  // ===================================================
  // USER LOGOUT
  // ===================================================

  if (appPromise) {
    location.reload();
    return;
  }

  showLogin();
});
