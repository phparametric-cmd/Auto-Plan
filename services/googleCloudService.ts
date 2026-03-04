
import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Вставьте ваши данные из Firebase Console -> Project Settings
const firebaseConfig = {
  apiKey: "ВАШ_API_KEY",
  authDomain: "ВАШ_PROJECT.firebaseapp.com",
  projectId: "ВАШ_PROJECT_ID",
  storageBucket: "ВАШ_PROJECT.appspot.com",
  messagingSenderId: "ID",
  appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

/**
 * Загружает файл в Google Cloud Storage и возвращает публичную ссылку.
 */
export const uploadProjectToCloud = async (fileBlob: Blob, fileName: string): Promise<string> => {
  try {
    const storageRef = ref(storage, `projects/${fileName}`);
    const snapshot = await uploadBytes(storageRef, fileBlob);
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log("[GoogleCloud] Файл загружен:", downloadURL);
    return downloadURL;
  } catch (error) {
    console.error("[GoogleCloud] Ошибка загрузки:", error);
    throw error;
  }
};
