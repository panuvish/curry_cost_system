import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCZFe5ObVWHoxofllt4-APkU0BdPB2X-FM",
  authDomain: "currycost.firebaseapp.com",
  databaseURL: "https://currycost-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "currycost",
  storageBucket: "currycost.firebasestorage.app",
  messagingSenderId: "680855211587",
  appId: "1:680855211587:web:a253e4d228ed4ad39c8ef6",
  measurementId: "G-ZWJN65KJG3"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);