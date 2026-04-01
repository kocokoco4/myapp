import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

// [設定エリア] Firebase設定はここに集約
// [ZooLab連携ポイント] 将来: 他ZooLabアプリと同じFirebaseプロジェクトまたはマルチテナント構成
const firebaseConfig = {
  apiKey: "AIzaSyB8JGR-7CQkwXknvw4_cT2XSrRengnsPXc",
  authDomain: "kyokucho-179fa.firebaseapp.com",
  projectId: "kyokucho-179fa",
  storageBucket: "kyokucho-179fa.firebasestorage.app",
  messagingSenderId: "274513268515",
  appId: "1:274513268515:web:c5cdd6a28bcc581e44c696",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)
export const functions = getFunctions(app, 'asia-northeast1')
