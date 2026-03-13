
import React, { useState, useRef, useEffect } from 'react';
import { HouseState, HouseType, Language } from '../types';
import { getTranslation } from '../services/i18n';

interface WelcomeScreenProps {
  onStart: (initialConfig: Partial<HouseState>) => void;
  existingData?: Partial<HouseState>;
  onLangChange: (lang: Language) => void;
}

const LOGO_URL = "https://raw.githubusercontent.com/phparametric-cmd/ph/3a1686781dd89eb77cf6f7ca10c15c739ae48eff/Ph.jpeg";

const STYLES: { type: HouseType; label: string; description: string; image: string; colors: any }[] = [
  { 
    type: 'Modern Minimalism', 
    label: 'MINIMALISM', 
    description: 'Чистые линии, панорамное остекление и максимум свободного пространства.',
    image: 'https://raw.githubusercontent.com/phparametric-cmd/ph/0cc86e105a5cb0cd8fdc0071139b1e5ad51cd924/%D1%81%D0%BE%D0%B2%D1%80%D0%B5%D0%BC%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9%20%D0%BC%D0%B8%D0%BD%D0%B8%D0%BC%D0%B0%D0%BB%D0%B8%D0%B7%D0%BC%20.jpeg',
    colors: { wall: "#ffffff", roof: "#0f172a", roofType: "flat", door: "#1e1e1e" }
  },
  { 
    type: 'Modern Classics', 
    label: 'CLASSICS', 
    description: 'Симметрия, изысканные фасадные элементы и вневременная элегантность.',
    image: 'https://raw.githubusercontent.com/phparametric-cmd/ph/760dc73689ca781952b348fbb0f8e4d02027b9e7/Classical%20.jpeg',
    colors: { wall: "#f8fafc", roof: "#334155", roofType: "hipped", door: "#1e1b4b" }
  },
  { 
    type: 'Wright Style', 
    label: 'WRIGHT', 
    description: 'Органическая архитектура с выраженными горизонтальными линиями и широкими свесами.',
    image: 'https://raw.githubusercontent.com/phparametric-cmd/ph/760dc73689ca781952b348fbb0f8e4d02027b9e7/%D0%A0%D0%B0%D0%B9%D1%82%20.jpeg',
    colors: { wall: "#a8a29e", roof: "#451a03", roofType: "hipped", door: "#1e1e1e" }
  },
  { 
    type: 'Industrial', 
    label: 'INDUSTRIAL', 
    description: 'Грубые фактуры, открытые конструктивные элементы и лофт-эстетика.',
    image: 'https://raw.githubusercontent.com/phparametric-cmd/ph/0cc86e105a5cb0cd8fdc0071139b1e5ad51cd924/%D0%A1%D0%BE%D0%B2%D1%80%D0%B5%D0%BC%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9%20%D0%B4%D0%BE%D0%BC.jpeg',
    colors: { wall: "#94a3b8", roof: "#1e1e1e", roofType: "flat", door: "#000" }
  }
];

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, existingData, onLangChange }) => {
  const currentLang = existingData?.lang || 'ru';
  const t = getTranslation(currentLang);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'preset' | 'custom'>('preset');
  const [selectedType, setSelectedType] = useState<HouseType>(existingData?.type || 'Modern Minimalism');
  const [userName, setUserName] = useState(existingData?.userName || '');
  const [userPhone, setUserPhone] = useState(existingData?.userPhone || '');
  const [userEmail, setUserEmail] = useState(existingData?.userEmail || '');
  const [isMapMode, setIsMapMode] = useState(existingData?.isMapMode ?? true);
  
  const [customStyleImage, setCustomStyleImage] = useState<string | undefined>(existingData?.customStyleImage);
  const [customStyleDesc, setCustomStyleDesc] = useState(existingData?.styleDescription || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    let digits = val.replace(/\D/g, '');
    setUserPhone(digits ? '+' + digits : '');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCustomStyleImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const [authUrl, setAuthUrl] = useState<string>('');

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('ph_user_info');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user.name) setUserName(user.name);
        if (user.email) setUserEmail(user.email);
        localStorage.removeItem('ph_user_info');
      }
    } catch (e) {}

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.user) {
        const user = event.data.user;
        if (user.name) setUserName(user.name);
        if (user.email) setUserEmail(user.email);
      }
    };
    window.addEventListener('message', handleMessage);

    const redirectUri = `${window.location.origin}/auth/callback`;
    fetch(`/api/auth/url?redirectUri=${encodeURIComponent(redirectUri)}`)
      .then(res => res.json())
      .then(data => {
        if (data.url) setAuthUrl(data.url);
      })
      .catch(err => console.error('Failed to prefetch auth URL:', err));

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGoogleLogin = () => {
    if (!authUrl) {
      alert('URL для авторизации еще загружается. Пожалуйста, подождите секунду и попробуйте снова.');
      return;
    }

    try {
      // Открываем окно синхронно с уже готовым URL
      const authWindow = window.open(authUrl, '_blank', 'width=600,height=700');
      
      if (!authWindow) {
        // Если окно заблокировано, перенаправляем текущее окно
        window.location.href = authUrl;
      }
    } catch (error: any) {
      console.error('OAuth error:', error);
      alert(`Ошибка при попытке авторизации: ${error.message || error}`);
    }
  };

  const isFormValid = userName.length > 1 && (userEmail || userPhone.length > 7) && (activeTab === 'preset' || (customStyleDesc.length > 5));

  const handleStart = () => {
    if (!isFormValid) {
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    const styleData = activeTab === 'custom' 
      ? {
          type: 'Custom' as HouseType,
          styleDescription: customStyleDesc,
          customStyleImage: customStyleImage,
          styleImageUrl: customStyleImage,
          wallColor: "#e2e8f0",
          roofColor: "#334155",
          roofType: "flat" as const,
          doorColor: "#1e293b"
        }
      : {
          type: selectedType,
          styleDescription: STYLES.find(s => s.type === selectedType)?.description || "",
          styleImageUrl: STYLES.find(s => s.type === selectedType)?.image,
          wallColor: STYLES.find(s => s.type === selectedType)?.colors.wall,
          roofColor: STYLES.find(s => s.type === selectedType)?.colors.roof,
          roofType: STYLES.find(s => s.type === selectedType)?.colors.roofType,
          doorColor: STYLES.find(s => s.type === selectedType)?.colors.door,
        };

    onStart({
      userName,
      userPhone,
      userEmail,
      isMapMode,
      gateSideIndex: 2,
      ...styleData
    });
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-[300] bg-white flex flex-col font-sans overflow-y-auto scrollbar-hide pb-24 lg:pb-0">
      <nav className="w-full px-4 lg:px-12 py-3 flex justify-between items-center bg-white border-b border-slate-50 relative z-10 shrink-0">
        <div className="flex items-center gap-2">
           <img src={LOGO_URL} className="w-6 h-6 rounded shadow-sm object-cover" alt="PH Logo" />
           <span className="font-black text-[9px] uppercase tracking-widest text-slate-900 leading-none">PH HOME</span>
        </div>
        <div className="flex gap-2">
           {(['ru', 'en', 'kk'] as Language[]).map(l => (
             <button 
               key={l}
               onClick={() => onLangChange(l)}
               className={`px-2 py-1 rounded text-[10px] font-black transition-all ${currentLang === l ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
             >
               {l === 'kk' ? 'KZ' : l.toUpperCase()}
             </button>
           ))}
        </div>
      </nav>

      <main className="flex-1 max-w-[1720px] mx-auto w-full px-4 lg:px-12 py-6 grid grid-cols-1 lg:grid-cols-[1fr_2.5fr] gap-8 items-start relative z-10">
        <div className="space-y-6 flex flex-col items-center lg:items-start text-center lg:text-left lg:sticky lg:top-6">
           <div className="space-y-2">
              <h1 className="text-3xl lg:text-5xl font-black text-slate-900 leading-tight tracking-tighter">
                {t.welcome.split(' ').slice(0,-1).join(' ')} <span className="text-[#ff5f1f]">{t.welcome.split(' ').pop()}</span>
              </h1>
              <p className="text-slate-400 text-[10px] lg:text-[13px] font-medium max-w-[280px] mx-auto lg:mx-0">{t.subWelcome}</p>
           </div>

           <div className="space-y-3 w-full max-w-[320px]">
              <div className="space-y-2 relative z-20">
                 {!userEmail && (
                   <>
                     <button 
                       onClick={handleGoogleLogin}
                       className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
                     >
                       <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                       <span className="text-[12px] font-bold text-slate-700">Войти через Google</span>
                     </button>
                     <div className="flex items-center gap-2 py-1">
                       <div className="h-px bg-slate-200 flex-1"></div>
                       <span className="text-[10px] text-slate-400 font-bold uppercase">Или введите данные</span>
                       <div className="h-px bg-slate-200 flex-1"></div>
                     </div>
                   </>
                 )}
                 <input type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder={t.namePlaceholder} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5 text-[16px] focus:border-[#ff5f1f] outline-none font-bold shadow-sm select-text" />
                 <input type="tel" value={userPhone} onChange={handlePhoneChange} placeholder={userEmail ? "Телефон (необязательно)" : t.phonePlaceholder} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5 text-[16px] focus:border-[#ff5f1f] outline-none font-bold shadow-sm select-text" />
                 {userEmail && (
                   <div className="text-[10px] text-slate-500 font-medium text-center">
                     Email: {userEmail}
                   </div>
                 )}
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Режим выбора участка</p>
                 <div className="flex bg-white p-1 rounded-lg gap-1 border border-slate-100">
                    <button onClick={() => setIsMapMode(true)} className={`flex-1 py-2 rounded-md text-[10px] font-black transition-all ${isMapMode ? 'bg-[#ff5f1f] text-white shadow-sm' : 'text-slate-400'}`}><i className="fas fa-map-marker-alt mr-1"></i>НА КАРТЕ</button>
                    <button onClick={() => setIsMapMode(false)} className={`flex-1 py-2 rounded-md text-[10px] font-black transition-all ${!isMapMode ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400'}`}>ОБЫЧНЫЙ</button>
                 </div>
              </div>

              <button 
                onClick={handleStart} 
                className={`w-full py-5 lg:py-4 rounded-xl font-black uppercase tracking-widest text-[12px] lg:text-[10px] transition-all shadow-xl active:scale-95 ${!isFormValid ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white hover:bg-[#ff5f1f]'}`}
              >
                {existingData?.userName ? t.continueEditing : t.createProject}
              </button>
           </div>
        </div>

          <div className="flex flex-col gap-6 overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="flex gap-8">
                <button onClick={() => setActiveTab('preset')} className={`text-[10px] lg:text-[12px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'preset' ? 'text-slate-900' : 'text-slate-300 hover:text-slate-500'}`}>
                  {t.readyStyles} {activeTab === 'preset' && <div className="absolute -bottom-[13px] left-0 right-0 h-1 bg-[#ff5f1f] rounded-t-full" />}
                </button>
                <button onClick={() => setActiveTab('custom')} className={`text-[10px] lg:text-[12px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'custom' ? 'text-slate-900' : 'text-slate-300 hover:text-slate-500'}`}>
                  {t.customRef} {activeTab === 'custom' && <div className="absolute -bottom-[13px] left-0 right-0 h-1 bg-[#ff5f1f] rounded-t-full" />}
                </button>
              </div>
              <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100 animate-pulse">
                <i className="fas fa-lightbulb text-[#ff5f1f] text-[10px]"></i>
                <span className="text-[9px] font-black text-[#ff5f1f] uppercase tracking-wider">Выбери архитектурный стиль своего будущего дома</span>
              </div>
            </div>

          <div className="flex-1 py-2">
            {activeTab === 'preset' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {STYLES.map((style) => {
                  const isSelected = selectedType === style.type;
                  return (
                    <button 
                      key={style.type} 
                      onClick={() => setSelectedType(style.type)} 
                      className={`group relative aspect-[16/9] lg:aspect-[4/3] rounded-[32px] lg:rounded-[48px] overflow-hidden border-[6px] transition-all duration-500 ${isSelected ? 'border-[#ff5f1f] scale-[1.03] shadow-[0_20px_50px_rgba(255,95,31,0.3)] z-20' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-[1.01] grayscale-[0.3] hover:grayscale-0'}`}
                    >
                      <img src={style.image} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt={style.label} />
                      <div className={`absolute inset-0 transition-opacity duration-500 ${isSelected ? 'bg-gradient-to-t from-black/80 via-transparent' : 'bg-black/40 group-hover:bg-black/20'}`} />
                      {isSelected && (
                        <div className="absolute top-6 right-6 w-10 h-10 bg-[#ff5f1f] rounded-full flex items-center justify-center text-white shadow-lg animate-in zoom-in duration-300">
                          <i className="fas fa-check text-lg"></i>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 p-8 lg:p-12 text-left">
                        <h3 className={`text-white text-[24px] lg:text-[36px] font-black tracking-tighter uppercase mb-2 leading-none transition-transform duration-500 ${isSelected ? 'translate-y-0' : 'translate-y-4 group-hover:translate-y-0'}`}>{style.label}</h3>
                        <p className={`text-slate-200 text-[10px] lg:text-[14px] font-bold leading-relaxed max-w-[90%] transition-all duration-500 ${isSelected ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 group-hover:opacity-100 group-hover:translate-y-0'}`}>
                          {style.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8">
                <label 
                  className={`group relative aspect-video lg:aspect-[4/5] bg-slate-50 border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center cursor-pointer transition-all pointer-events-auto z-30 ${customStyleImage ? 'border-[#ff5f1f]' : 'border-slate-200 hover:border-[#ff5f1f] hover:bg-slate-100'}`}
                >
                  {customStyleImage ? (
                    <img src={customStyleImage} className="w-full h-full object-cover rounded-[36px] pointer-events-none" />
                  ) : (
                    <div className="text-center pointer-events-none">
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl mx-auto mb-6 group-hover:scale-110 transition-transform">
                        <i className="fas fa-plus text-[#ff5f1f] text-2xl"></i>
                      </div>
                      <span className="text-[12px] font-black uppercase block tracking-[0.2em] text-slate-400 group-hover:text-[#ff5f1f]">Загрузить референс</span>
                    </div>
                  )}
                  <input type="file" onChange={handleFileChange} accept="image/*" className="hidden" />
                </label>
                <div className="flex flex-col gap-4">
                   <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 flex-1 shadow-inner">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Пожелания по стилю</h4>
                      <textarea 
                        value={customStyleDesc} 
                        onChange={e => setCustomStyleDesc(e.target.value)} 
                        placeholder={t.extraInfo} 
                        className="w-full h-full bg-transparent text-[18px] font-bold text-slate-900 resize-none outline-none placeholder:text-slate-300" 
                      />
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

    </div>
  );
};

export default WelcomeScreen;
