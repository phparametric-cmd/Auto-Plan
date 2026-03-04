
import React from 'react';
import { HouseState } from '../types';

const LOGO_URL = "https://raw.githubusercontent.com/phparametric-cmd/ph/3a1686781dd89eb77cf6f7ca10c15c739ae48eff/Ph.jpeg";

interface EstimateViewProps {
  house: HouseState;
  estimateHtml: string;
}

const CONTACT_INFO = {
  phone: "+7 707 220 72 61",
  email: "ph.parametric@gmail.com"
};

const EstimateView: React.FC<EstimateViewProps> = ({ house, estimateHtml }) => {
  return (
    <div id="estimate-doc-root" className="flex flex-col gap-12 text-slate-900 p-16 font-sans bg-white pb-24" style={{ width: '850px' }}>
      <div className="flex justify-between items-start border-b border-slate-200 pb-10 mt-8">
        <div className="flex flex-col gap-6">
          <img src={LOGO_URL} className="w-16 h-16 rounded-2xl object-cover grayscale" alt="PH Logo" />
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.3em]">{CONTACT_INFO.phone}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">{CONTACT_INFO.email}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-4 text-right">
          <h1 className="text-4xl font-light uppercase tracking-[0.4em] leading-tight text-slate-900">Предварительный<br/><span className="font-black">расчет стоимости строительства</span></h1>
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.5em]">ПРОЕКТ № {house.name}</p>
        </div>
      </div>

      <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
        <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic text-center">
          Цены являются предварительными и указаны для общего понимания бюджета проекта. Стоимость может корректироваться и обсуждаться в зависимости от выбранных решений и объёма работ. Расчёты по забору, фасадам и благоустройству территории включены в смету и уточняются отдельно.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-16">
        <div className="col-span-6 space-y-12">
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4">ЗАКАЗЧИК</p>
            <p className="text-2xl font-light text-slate-900 leading-tight">{house.userName || '---'}</p>
            <p className="text-sm font-medium text-slate-400 mt-2">{house.userPhone || '---'}</p>
            <p className="text-sm font-medium text-slate-400">{house.userEmail || '---'}</p>
          </div>

          <div className="space-y-6">
            <h3 className="text-[9px] font-black uppercase text-slate-300 tracking-[0.3em]">Параметры объекта</h3>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-slate-50 py-3 text-[13px] font-medium">
                <span className="text-slate-400">Общая площадь дома</span>
                <span className="text-slate-900 font-bold">{Math.round(house.houseWidth * house.houseLength * house.floors)} м²</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 py-3 text-[13px] font-medium">
                <span className="text-slate-400">Площадь участка</span>
                <span className="text-slate-900 font-bold">{(house.plotWidth * house.plotLength / 100).toFixed(1)} сот.</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 py-3 text-[13px] font-bold text-[#ff5f1f]">
                <span>Уровень отделки</span>
                <span>Черновая + Фасад 100%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-6 space-y-6">
          <h3 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">ВИЗУАЛИЗАЦИЯ СТИЛЯ</h3>
          <div className="rounded-[48px] overflow-hidden border border-slate-100 shadow-xl aspect-[4/3] flex items-center justify-center bg-slate-50 grayscale-[0.3] hover:grayscale-0 transition-all duration-700">
            {house.styleImageUrl ? (
              <img src={house.styleImageUrl} className="w-full h-full object-cover" />
            ) : (
              <p className="text-[10px] font-black text-slate-300 uppercase">Нет изображения</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 prose prose-slate max-w-none">
        <div dangerouslySetInnerHTML={{ __html: estimateHtml }} className="estimate-table-container" />
      </div>

      <div className="mt-auto pt-10 border-t border-slate-100 flex justify-between items-end text-[9px] text-slate-400 font-bold uppercase tracking-widest">
        <span>PH HOME Parametric System • {new Date().toLocaleDateString()}</span>
        <span>Расчет сформирован автоматически</span>
      </div>
      
      <style>{`
        .estimate-table-container table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
        }
        .estimate-table-container thead {
          display: none;
        }
        .estimate-table-container th {
          display: none;
        }
        .estimate-table-container td {
          padding: 12px;
          font-size: 13px;
          border-bottom: 1px solid #f1f5f9;
        }
        .estimate-table-container tr:last-child td {
          font-weight: 900;
          font-size: 16px;
          background-color: #f8fafc;
          border-top: 2px solid #0f172a;
        }
      `}</style>
    </div>
  );
};

export default EstimateView;
