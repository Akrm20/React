import React, { useState, useEffect, useMemo } from 'react';
import { Save, Trash2, Plus, Calculator, FileText, BookOpen, PieChart, Info } from 'lucide-react';

// --- IndexedDB Utility ---
const DB_NAME = 'IAS23_DB';
const STORE_NAME = 'projects';
const DB_VERSION = 1;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject('Database error: ' + event.target.error);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
  });
};

const saveToDB = async (data) => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Always update ID 1 for this single-project demo
    store.put({ ...data, id: 1 });
    return tx.complete;
  } catch (err) {
    console.error('Save failed', err);
  }
};

const loadFromDB = async () => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(1);
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
  } catch (err) {
    console.error('Load failed', err);
    return null;
  }
};

// --- Components ---

const Card = ({ children, title, className = "" }) => (
  <div className={`bg-white border border-gray-200 rounded shadow-sm mb-2 ${className}`}>
    {title && <div className="bg-gray-50 px-2 py-1 border-b border-gray-200 font-bold text-blue-800">{title}</div>}
    <div className="p-2">{children}</div>
  </div>
);

const NumberInput = ({ label, value, onChange, placeholder }) => (
  <div className="flex flex-col mb-1">
    <label className="text-gray-500 mb-0.5">{label}</label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:border-blue-500 w-full"
      placeholder={placeholder}
    />
  </div>
);

const DateInput = ({ label, value, onChange }) => (
  <div className="flex flex-col mb-1">
    <label className="text-gray-500 mb-0.5">{label}</label>
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:border-blue-500 w-full"
    />
  </div>
);

export default function IAS23App() {
  // State
  const [activeTab, setActiveTab] = useState('inputs');
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [project, setProject] = useState({
    name: 'مشروع المصنع الجديد',
    yearStart: '2023-01-01',
    yearEnd: '2023-12-31',
    specificLoan: { amount: 2000000, rate: 9, investmentIncome: 30000 },
    generalLoans: [
      { id: 1, amount: 5000000, rate: 12 },
      { id: 2, amount: 3000000, rate: 10 }
    ],
    expenditures: [
      { id: 1, date: '2023-01-01', amount: 1500000 },
      { id: 2, date: '2023-07-01', amount: 2500000 },
      { id: 3, date: '2023-11-01', amount: 1000000 }
    ]
  });

  // Load Data on Mount
  useEffect(() => {
    loadFromDB().then((data) => {
      if (data) setProject(data);
      setLoading(false);
    });
  }, []);

  // Save Data on Change
  useEffect(() => {
    if (!loading) {
      saveToDB(project);
    }
  }, [project, loading]);

  // --- Calculations ---
  const calculations = useMemo(() => {
    const { specificLoan, generalLoans, expenditures, yearStart, yearEnd } = project;
    
    // 1. Specific Loan Costs
    const specificInterest = specificLoan.amount * (specificLoan.rate / 100);
    const netSpecificCost = Math.max(0, specificInterest - specificLoan.investmentIncome);

    // 2. Capitalization Rate (Weighted Average for General Borrowings)
    const totalGeneralLoanAmount = generalLoans.reduce((sum, loan) => sum + loan.amount, 0);
    const totalGeneralInterest = generalLoans.reduce((sum, loan) => sum + (loan.amount * (loan.rate / 100)), 0);
    const capRate = totalGeneralLoanAmount > 0 ? (totalGeneralInterest / totalGeneralLoanAmount) : 0;

    // 3. WAAE (Weighted Average Accumulated Expenditure)
    const start = new Date(yearStart);
    const end = new Date(yearEnd);
    const totalDurationDays = (end - start) / (1000 * 60 * 60 * 24) + 1; // Approx 365

    const waaeDetails = expenditures.map(exp => {
      const expDate = new Date(exp.date);
      // Calculate months remaining approx
      // Simplified: using fraction of year based on months for demo accuracy matching the example
      // In real app, calculate days accurately. 
      // Example logic: Jan 1 to Dec 31 = 12/12. Jul 1 to Dec 31 = 6/12.
      let monthsRemaining = 0;
      if (expDate >= start && expDate <= end) {
         monthsRemaining = 12 - expDate.getMonth(); // Simplified for Jan-Dec fiscal year
         // Adjust for start date not being Jan 1 if needed, but assuming full year for simplicity of this specific example
      }
      
      const weight = monthsRemaining / 12;
      const weightedAmount = exp.amount * weight;
      return { ...exp, monthsRemaining, weightedAmount };
    });

    const totalWAAE = waaeDetails.reduce((sum, item) => sum + item.weightedAmount, 0);

    // 4. Allocation
    // How much of WAAE is covered by Specific Loan?
    // Note: We subtract the PRINCIPAL of specific loan from WAAE
    const waaeCoveredBySpecific = Math.min(totalWAAE, specificLoan.amount);
    const waaeFundedByGeneral = Math.max(0, totalWAAE - specificLoan.amount);

    // 5. Capitalizable General Interest
    const generalCapitalized = waaeFundedByGeneral * capRate;

    // Ceiling Check: Cannot capitalize more general interest than incurred
    const actualGeneralInterest = totalGeneralInterest;
    const finalGeneralCapitalized = Math.min(generalCapitalized, actualGeneralInterest);

    // 6. Total Capitalized & Expensed
    const totalCapitalized = netSpecificCost + finalGeneralCapitalized;
    const totalActualInterest = specificInterest + actualGeneralInterest;
    // Expensed = Total Actual - Capitalized - (Investment Income is usually offset against cost, but for P&L presentation:
    // Interest Expense (P&L) = (Total Incurred - Capitalized). 
    // Investment Income is separate line or netted depending on policy. Here we net it for calculation.
    const expensePmL = (totalActualInterest - specificLoan.investmentIncome) - totalCapitalized;

    return {
      specificInterest,
      netSpecificCost,
      totalGeneralLoanAmount,
      totalGeneralInterest,
      capRate,
      waaeDetails,
      totalWAAE,
      waaeFundedByGeneral,
      generalCapitalized,
      finalGeneralCapitalized,
      totalCapitalized,
      totalActualInterest,
      expensePmL
    };
  }, [project]);

  // --- Handlers ---
  const addGeneralLoan = () => {
    setProject(prev => ({
      ...prev,
      generalLoans: [...prev.generalLoans, { id: Date.now(), amount: 0, rate: 0 }]
    }));
  };

  const removeGeneralLoan = (id) => {
    setProject(prev => ({
      ...prev,
      generalLoans: prev.generalLoans.filter(l => l.id !== id)
    }));
  };

  const updateGeneralLoan = (id, field, val) => {
    setProject(prev => ({
      ...prev,
      generalLoans: prev.generalLoans.map(l => l.id === id ? { ...l, [field]: val } : l)
    }));
  };

  const addExpenditure = () => {
    setProject(prev => ({
      ...prev,
      expenditures: [...prev.expenditures, { id: Date.now(), date: project.yearStart, amount: 0 }]
    }));
  };

  const removeExpenditure = (id) => {
    setProject(prev => ({
      ...prev,
      expenditures: prev.expenditures.filter(e => e.id !== id)
    }));
  };

  const updateExpenditure = (id, field, val) => {
    setProject(prev => ({
      ...prev,
      expenditures: prev.expenditures.map(e => e.id === id ? { ...e, [field]: val } : e)
    }));
  };

  const formatNumber = (num) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);

  if (loading) return <div className="flex items-center justify-center h-screen text-xs">جاري تحميل البيانات...</div>;

  return (
    <div className="bg-gray-100 min-h-screen font-sans text-[10px] md:text-xs text-right" dir="rtl">
      {/* Header */}
      <header className="bg-blue-900 text-white p-2 flex justify-between items-center shadow-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Calculator size={14} />
          <h1 className="font-bold">حاسبة IAS 23</h1>
        </div>
        <div className="text-[9px] opacity-80">يتم الحفظ تلقائياً (IndexedDB)</div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b flex overflow-x-auto sticky top-[34px] z-10 shadow-sm">
        <button 
          onClick={() => setActiveTab('inputs')}
          className={`flex-1 py-2 px-1 text-center border-b-2 flex flex-col items-center gap-1 ${activeTab === 'inputs' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500'}`}
        >
          <BookOpen size={14} />
          <span>المدخلات</span>
        </button>
        <button 
          onClick={() => setActiveTab('entries')}
          className={`flex-1 py-2 px-1 text-center border-b-2 flex flex-col items-center gap-1 ${activeTab === 'entries' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500'}`}
        >
          <FileText size={14} />
          <span>القيود</span>
        </button>
        <button 
          onClick={() => setActiveTab('statements')}
          className={`flex-1 py-2 px-1 text-center border-b-2 flex flex-col items-center gap-1 ${activeTab === 'statements' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500'}`}
        >
          <PieChart size={14} />
          <span>القوائم</span>
        </button>
        <button 
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-2 px-1 text-center border-b-2 flex flex-col items-center gap-1 ${activeTab === 'notes' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500'}`}
        >
          <Info size={14} />
          <span>الإيضاحات</span>
        </button>
      </div>

      {/* Content */}
      <main className="p-2 max-w-md mx-auto pb-10">
        
        {/* INPUTS TAB */}
        {activeTab === 'inputs' && (
          <div className="space-y-2 animate-fade-in">
            <Card title="بيانات المشروع">
              <input 
                value={project.name} 
                onChange={(e) => setProject({...project, name: e.target.value})} 
                className="w-full border-b mb-2 p-1 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <DateInput label="بداية الفترة" value={project.yearStart} onChange={(v) => setProject({...project, yearStart: v})} />
                <DateInput label="نهاية الفترة" value={project.yearEnd} onChange={(v) => setProject({...project, yearEnd: v})} />
              </div>
            </Card>

            <Card title="1. الاقتراض المخصص (Specific)">
              <div className="grid grid-cols-3 gap-2">
                <NumberInput label="أصل القرض" value={project.specificLoan.amount} onChange={(v) => setProject(p => ({...p, specificLoan: {...p.specificLoan, amount: v}}))} />
                <NumberInput label="الفائدة %" value={project.specificLoan.rate} onChange={(v) => setProject(p => ({...p, specificLoan: {...p.specificLoan, rate: v}}))} />
                <NumberInput label="دخل الاستثمار" value={project.specificLoan.investmentIncome} onChange={(v) => setProject(p => ({...p, specificLoan: {...p.specificLoan, investmentIncome: v}}))} />
              </div>
              <div className="mt-1 text-blue-700 bg-blue-50 p-1 rounded text-[9px]">
                 صافي التكلفة للرسملة: {formatNumber(calculations.netSpecificCost)}
              </div>
            </Card>

            <Card title="2. الاقتراض العام (General)">
              {project.generalLoans.map((loan, idx) => (
                <div key={loan.id} className="flex gap-2 mb-1 items-end border-b pb-1 last:border-0">
                  <div className="w-8 flex items-center justify-center text-gray-400">#{idx + 1}</div>
                  <div className="flex-1"><NumberInput label="المبلغ" value={loan.amount} onChange={(v) => updateGeneralLoan(loan.id, 'amount', v)} /></div>
                  <div className="w-16"><NumberInput label="فائدة %" value={loan.rate} onChange={(v) => updateGeneralLoan(loan.id, 'rate', v)} /></div>
                  <button onClick={() => removeGeneralLoan(loan.id)} className="text-red-500 p-1 mb-1"><Trash2 size={12} /></button>
                </div>
              ))}
              <button onClick={addGeneralLoan} className="mt-1 w-full bg-gray-100 text-gray-600 py-1 rounded border border-dashed flex items-center justify-center gap-1 hover:bg-gray-200">
                <Plus size={10} /> إضافة قرض عام
              </button>
              <div className="mt-2 text-blue-700 bg-blue-50 p-1 rounded text-[9px] flex justify-between">
                <span>إجمالي القروض: {formatNumber(calculations.totalGeneralLoanAmount)}</span>
                <span>معدل الرسملة: {(calculations.capRate * 100).toFixed(2)}%</span>
              </div>
            </Card>

            <Card title="3. الإنفاق على الأصل (Expenditures)">
              <div className="bg-yellow-50 p-1 mb-2 text-[9px] text-yellow-800 border border-yellow-200 rounded">
                أدخل تواريخ الدفع لحساب المتوسط المرجح بدقة.
              </div>
              {project.expenditures.map((exp, idx) => (
                <div key={exp.id} className="flex gap-2 mb-1 items-end border-b pb-1 last:border-0">
                  <div className="flex-1"><DateInput label="التاريخ" value={exp.date} onChange={(v) => updateExpenditure(exp.id, 'date', v)} /></div>
                  <div className="flex-1"><NumberInput label="المبلغ المدفوع" value={exp.amount} onChange={(v) => updateExpenditure(exp.id, 'amount', v)} /></div>
                  <button onClick={() => removeExpenditure(exp.id)} className="text-red-500 p-1 mb-1"><Trash2 size={12} /></button>
                </div>
              ))}
              <button onClick={addExpenditure} className="mt-1 w-full bg-gray-100 text-gray-600 py-1 rounded border border-dashed flex items-center justify-center gap-1 hover:bg-gray-200">
                <Plus size={10} /> إضافة دفعة
              </button>
            </Card>
          </div>
        )}

        {/* ENTRIES TAB */}
        {activeTab === 'entries' && (
          <div className="animate-fade-in space-y-3">
            <Card title="ملخص الحسابات للقيود">
               <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
                 <div className="text-gray-500">المتوسط المرجح للإنفاق:</div>
                 <div className="font-mono">{formatNumber(calculations.totalWAAE)}</div>
                 <div className="text-gray-500">تمويل القرض المخصص:</div>
                 <div className="font-mono text-green-600">({formatNumber(Math.min(calculations.totalWAAE, project.specificLoan.amount))})</div>
                 <div className="text-gray-500">الزيادة (تمول من العام):</div>
                 <div className="font-mono">{formatNumber(calculations.waaeFundedByGeneral)}</div>
                 <div className="text-gray-500">معدل الرسملة:</div>
                 <div className="font-mono">{(calculations.capRate * 100).toFixed(2)}%</div>
               </div>
            </Card>

            <div className="bg-white border rounded shadow-sm overflow-hidden">
              <div className="bg-gray-800 text-white px-2 py-1 font-bold">دفتر اليومية العامة</div>
              
              {/* Entry 1: Actual Interest Incurred */}
              <div className="border-b p-2">
                <div className="text-gray-500 italic mb-1">1. إثبات استحقاق فوائد القروض (المدفوعة فعلياً)</div>
                <div className="grid grid-cols-12 gap-1 text-[9px] font-mono bg-gray-50 p-1 rounded border">
                  <div className="col-span-2 text-center border-l">مدين</div>
                  <div className="col-span-2 text-center border-l">دائن</div>
                  <div className="col-span-8 px-1">البيان</div>
                  
                  <div className="col-span-2 text-right">{formatNumber(calculations.totalActualInterest)}</div>
                  <div className="col-span-2"></div>
                  <div className="col-span-8">من حـ/ مصاريف التمويل (الفوائد)</div>

                  <div className="col-span-2"></div>
                  <div className="col-span-2 text-right">{formatNumber(calculations.totalActualInterest)}</div>
                  <div className="col-span-8">إلى حـ/ النقدية / البنك</div>
                </div>
              </div>

              {/* Entry 2: Investment Income */}
              {project.specificLoan.investmentIncome > 0 && (
                <div className="border-b p-2">
                  <div className="text-gray-500 italic mb-1">2. إثبات دخل الاستثمار المؤقت</div>
                  <div className="grid grid-cols-12 gap-1 text-[9px] font-mono bg-gray-50 p-1 rounded border">
                    <div className="col-span-2 text-right">{formatNumber(project.specificLoan.investmentIncome)}</div>
                    <div className="col-span-2"></div>
                    <div className="col-span-8">من حـ/ النقدية / البنك</div>

                    <div className="col-span-2"></div>
                    <div className="col-span-2 text-right">{formatNumber(project.specificLoan.investmentIncome)}</div>
                    <div className="col-span-8">إلى حـ/ مصاريف التمويل (تخفيض للتكلفة)</div>
                  </div>
                </div>
              )}

              {/* Entry 3: Capitalization */}
              <div className="p-2">
                <div className="text-gray-500 italic mb-1">3. رسملة الفوائد على الأصل المؤهل (إقفال المصروف في الأصل)</div>
                <div className="grid grid-cols-12 gap-1 text-[9px] font-mono bg-yellow-50 p-1 rounded border border-yellow-200">
                  <div className="col-span-2 text-right font-bold">{formatNumber(calculations.totalCapitalized)}</div>
                  <div className="col-span-2"></div>
                  <div className="col-span-8 font-bold text-blue-800">من حـ/ مشاريع تحت التنفيذ ({project.name})</div>

                  <div className="col-span-2"></div>
                  <div className="col-span-2 text-right font-bold">{formatNumber(calculations.totalCapitalized)}</div>
                  <div className="col-span-8">إلى حـ/ مصاريف التمويل (رسملة)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STATEMENTS TAB */}
        {activeTab === 'statements' && (
          <div className="animate-fade-in space-y-4">
            
            {/* Balance Sheet */}
            <div className="border rounded bg-white shadow-sm">
              <div className="bg-blue-800 text-white px-2 py-1 flex justify-between">
                <span>قائمة المركز المالي (مقتطعة)</span>
                <span>31 ديسمبر</span>
              </div>
              <div className="p-2">
                <div className="flex justify-between border-b py-1 font-bold text-gray-700">
                  <span>الأصول غير المتداولة</span>
                </div>
                <div className="flex justify-between py-1 px-2 bg-blue-50">
                  <span>مشاريع تحت التنفيذ ({project.name})</span>
                  <span className="font-mono font-bold">{formatNumber(project.expenditures.reduce((a,b)=>a+b.amount,0) + calculations.totalCapitalized)}</span>
                </div>
                <div className="text-[8px] text-gray-400 mt-1 pr-2">
                  * يتضمن تكاليف الإنشاء ({formatNumber(project.expenditures.reduce((a,b)=>a+b.amount,0))}) + الفوائد المرسملة ({formatNumber(calculations.totalCapitalized)})
                </div>
              </div>
            </div>

            {/* Income Statement */}
            <div className="border rounded bg-white shadow-sm">
              <div className="bg-green-700 text-white px-2 py-1 flex justify-between">
                <span>قائمة الدخل (الأرباح والخسائر)</span>
                <span>عن السنة المنتهية</span>
              </div>
              <div className="p-2">
                <div className="flex justify-between border-b py-1 font-bold text-gray-700">
                  <span>المصاريف والأعباء الأخرى</span>
                </div>
                <div className="flex justify-between py-1 px-2 bg-red-50 text-red-900">
                  <span>تكاليف التمويل (الصافي)</span>
                  <span className="font-mono font-bold">({formatNumber(calculations.expensePmL)})</span>
                </div>
                <div className="text-[8px] text-gray-400 mt-1 pr-2">
                  * تمثل الفوائد التي لم يتم رسملتها وتحميلها على الفترة.
                </div>
              </div>
            </div>

          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && (
          <div className="animate-fade-in">
            <Card title="الإيضاحات المتممة للقوائم المالية">
              <div className="text-[10px] leading-relaxed text-justify px-1">
                <p className="mb-2">
                  <strong>السياسة المحاسبية:</strong> تتم رسملة تكاليف الاقتراض التي تعزى مباشرة إلى إنشاء الأصول المؤهلة كجزء من تكلفة تلك الأصول. يتم تحميل تكاليف الاقتراض الأخرى كمصروف في الفترة التي يتم تكبدها فيها.
                </p>
                <div className="bg-gray-50 border p-2 rounded mb-2">
                  <h3 className="font-bold border-b mb-1 pb-1">خلال الفترة المالية المنتهية في {project.yearEnd}:</h3>
                  <div className="flex justify-between py-1 border-b border-dashed border-gray-300">
                    <span>إجمالي تكاليف الاقتراض المتكبدة:</span>
                    <span className="font-mono">{formatNumber(calculations.totalActualInterest)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-dashed border-gray-300">
                    <span>يطرح: دخل الاستثمار المؤقت:</span>
                    <span className="font-mono">({formatNumber(project.specificLoan.investmentIncome)})</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-dashed border-gray-300 bg-yellow-50 font-bold">
                    <span>مبلغ تكاليف الاقتراض المرسملة:</span>
                    <span className="font-mono">{formatNumber(calculations.totalCapitalized)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-dashed border-gray-300">
                    <span>المبلغ المحمل على قائمة الدخل:</span>
                    <span className="font-mono">{formatNumber(calculations.expensePmL)}</span>
                  </div>
                  <div className="flex justify-between py-1 mt-1">
                    <span>معدل الرسملة المستخدم:</span>
                    <span className="font-mono">{(calculations.capRate * 100).toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

      </main>
    </div>
  );
}