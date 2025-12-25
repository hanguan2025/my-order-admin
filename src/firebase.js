import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC986yvTXsQbFC2irEKn6710Nf_Z90s_Sk",
  authDomain: "order-system-f6d40.firebaseapp.com",
  projectId: "order-system-f6d40",
  storageBucket: "order-system-f6d40.firebasestorage.app",
  messagingSenderId: "827083305516",
  appId: "1:827083305516:web:a6e58f30f9c699f4dbd789",
  measurementId: "G-M3R65K3FYM"
};

// 初始化 Firebase 應用程式
const app = initializeApp(firebaseConfig);

// 【關鍵修正】這行一定要這樣寫，確保導出的是 Firestore 資料庫
export const db = getFirestore(app);