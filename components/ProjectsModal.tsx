import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { HouseState } from '../types';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Project {
  id: string;
  uid: string;
  name: string;
  createdAt: any;
  updatedAt: any;
  houseData: string;
}

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHouse: HouseState;
  onLoadProject: (house: HouseState) => void;
}

const ProjectsModal: React.FC<ProjectsModalProps> = ({ isOpen, onClose, currentHouse, onLoadProject }) => {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [throwError, setThrowError] = useState<Error | null>(null);

  // Email Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  if (throwError) {
    throw throwError;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchProjects(currentUser.uid);
      } else {
        setProjects([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchProjects = async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'projects'), where('uid', '==', uid));
      const querySnapshot = await getDocs(q);
      const projs: Project[] = [];
      querySnapshot.forEach((doc) => {
        projs.push({ id: doc.id, ...doc.data() } as Project);
      });
      // Sort by updatedAt descending
      projs.sort((a, b) => b.updatedAt?.toMillis() - a.updatedAt?.toMillis());
      setProjects(projs);
    } catch (err: any) {
      if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
        try {
          handleFirestoreError(err, OperationType.LIST, 'projects');
        } catch (e) {
          setThrowError(e as Error);
        }
      } else {
        console.error("Error fetching projects:", err);
        setError("Не удалось загрузить проекты");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setAuthError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Login error:", err);
      setAuthError("Ошибка входа через Google. Убедитесь, что домен добавлен в авторизованные (см. инструкцию).");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
    } catch (err: any) {
      console.error("Email auth error:", err);
      if (err.code === 'auth/email-already-in-use') setAuthError('Этот email уже зарегистрирован');
      else if (err.code === 'auth/invalid-credential') setAuthError('Неверный email или пароль');
      else if (err.code === 'auth/weak-password') setAuthError('Пароль слишком простой (минимум 6 символов)');
      else if (err.code === 'auth/invalid-email') setAuthError('Некорректный формат email');
      else setAuthError('Ошибка авторизации: ' + err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleSaveProject = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      // Find if we already saved this project
      const existingProj = projects.find(p => p.name === currentHouse.name);
      
      const projectData = {
        uid: user.uid,
        name: currentHouse.name,
        houseData: JSON.stringify(currentHouse),
        updatedAt: new Date(),
        createdAt: existingProj ? existingProj.createdAt : new Date()
      };

      let docId = existingProj ? existingProj.id : currentHouse.name;
      
      await setDoc(doc(db, 'projects', docId), projectData);
      await fetchProjects(user.uid);
    } catch (err: any) {
      if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
        try {
          handleFirestoreError(err, OperationType.WRITE, 'projects');
        } catch (e) {
          setThrowError(e as Error);
        }
      } else {
        console.error("Error saving project:", err);
        setError("Не удалось сохранить проект");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Удалить этот проект?")) return;
    try {
      await deleteDoc(doc(db, 'projects', id));
      setProjects(projects.filter(p => p.id !== id));
    } catch (err: any) {
      if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
        try {
          handleFirestoreError(err, OperationType.DELETE, `projects/${id}`);
        } catch (e) {
          setThrowError(e as Error);
        }
      } else {
        console.error("Error deleting project:", err);
      }
    }
  };

  const handleLoad = (project: Project) => {
    try {
      const houseData: HouseState = JSON.parse(project.houseData);
      onLoadProject(houseData);
      onClose();
    } catch (err) {
      console.error("Error parsing project data:", err);
      setError("Ошибка при загрузке проекта");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold">Мои проекты</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {!user ? (
            <div className="text-center py-6">
              <i className="fas fa-lock text-4xl text-slate-300 mb-4"></i>
              <h3 className="text-xl font-bold mb-2">Войдите, чтобы сохранять проекты</h3>
              <p className="text-slate-500 mb-6">Ваши проекты будут надежно сохранены и доступны с любого устройства.</p>
              
              <form onSubmit={handleEmailAuth} className="flex flex-col gap-3 max-w-sm mx-auto w-full text-left">
                {authError && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100 text-center">{authError}</div>}
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                  <input 
                    type="email" 
                    placeholder="your@email.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                    required 
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Пароль</label>
                  <input 
                    type="password" 
                    placeholder="Минимум 6 символов" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="w-full border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                    required 
                    minLength={6} 
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={isAuthLoading}
                  className="bg-slate-800 hover:bg-slate-900 text-white p-3 rounded-xl font-bold mt-2 transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                >
                  {isAuthLoading && <i className="fas fa-spinner fa-spin"></i>}
                  {isRegistering ? 'Зарегистрироваться' : 'Войти по Email'}
                </button>
                
                <button 
                  type="button" 
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setAuthError(null);
                  }} 
                  className="text-sm text-blue-600 hover:underline text-center mt-1"
                >
                  {isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                </button>
                
                <div className="relative flex py-4 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase">ИЛИ</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>
                
                <button 
                  type="button"
                  onClick={handleGoogleLogin}
                  className="bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-3"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                  Войти через Google
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                      {user.email?.[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-bold">{user.displayName || 'Пользователь'}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </div>
                </div>
                <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-red-500 transition-colors font-bold">
                  Выйти
                </button>
              </div>

              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Текущий проект: {currentHouse.name}</h3>
                <button 
                  onClick={handleSaveProject}
                  disabled={saving}
                  className="bg-[#ff5f1f] hover:bg-[#e04d14] text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
                  {saving ? 'Сохранение...' : 'Сохранить текущий'}
                </button>
              </div>

              {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

              <div>
                <h3 className="text-lg font-bold mb-4 border-b pb-2">Сохраненные проекты ({projects.length})</h3>
                {loading ? (
                  <div className="text-center py-10 text-slate-400">
                    <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
                    <p>Загрузка проектов...</p>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                    <i className="fas fa-folder-open text-3xl mb-2"></i>
                    <p>У вас пока нет сохраненных проектов</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projects.map(proj => (
                      <div key={proj.id} className="flex items-center justify-between p-4 border rounded-xl hover:border-blue-300 hover:shadow-sm transition-all bg-white">
                        <div>
                          <div className="font-bold text-lg">{proj.name}</div>
                          <div className="text-xs text-slate-500">
                            Обновлен: {proj.updatedAt?.toDate().toLocaleString() || 'Неизвестно'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleLoad(proj)}
                            className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-bold transition-colors text-sm"
                          >
                            Загрузить
                          </button>
                          <button 
                            onClick={() => handleDelete(proj.id)}
                            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectsModal;
