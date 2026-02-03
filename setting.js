// === Setting.js: الإعدادات + استيراد وتصدير إكسيل ===

const AppConfig = {
    currency: "ريال سعودي",
    vatRate: 0.15,
    vatEnabled: true,
    fiscalYear: {
        start: new Date().getFullYear() + "-01-01",
        end: new Date().getFullYear() + "-12-31",
        prevStart: (new Date().getFullYear() - 1) + "-01-01",
        prevEnd: (new Date().getFullYear() - 1) + "-12-31"
    },
    policies: [
        "معايير SOCPA", "الجرد المستمر", "أساس الاستحقاق"
    ]
};

// --- دوال مساعدة للتنسيق ---
function formatMoney(amount) {
    if (!amount && amount !== 0) return "0.00";
    return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function unformatMoney(str) {
    if (typeof str === 'number') return str;
    return parseFloat(String(str).replace(/,/g, '')) || 0;
}

// --- واجهة الإعدادات ---
function renderSettingsTab() {
    const tab5 = document.getElementById('tab5');
    tab5.innerHTML = `
        <h3>الإعدادات وإدارة البيانات</h3>
        
        <div class="settings-card">
            <h4>البيانات الأساسية</h4>
            <ul class="policy-list">
                <li>العملة: ${AppConfig.currency}</li>
                <li>نهاية السنة المالية: ${AppConfig.fiscalYear.end}</li>
            </ul>
        </div>

        <div class="settings-card">
            <h4>📂 التصدير والاستيراد (Excel)</h4>
            
            <div class="excel-control-group">
                <label>1. دليل الحسابات:</label>
                <div class="btn-row">
                    <button onclick="exportAccountsToExcel()" class="excel-btn export">تصدير الدليل ⬇️</button>
                    <button onclick="document.getElementById('file-import-acc').click()" class="excel-btn import">استيراد الدليل ⬆️</button>
                    <input type="file" id="file-import-acc" accept=".xlsx, .xls" style="display:none" onchange="importAccountsFromExcel(this)">
                </div>
            </div>

            <hr style="border:0; border-top:1px dashed #eee; margin:10px 0;">

            <div class="excel-control-group">
                <label>2. القيود اليومية:</label>
                <div class="btn-row">
                    <button onclick="exportJournalsToExcel()" class="excel-btn export">تصدير القيود ⬇️</button>
                    <button onclick="document.getElementById('file-import-ju').click()" class="excel-btn import">استيراد القيود ⬆️</button>
                    <input type="file" id="file-import-ju" accept=".xlsx, .xls" style="display:none" onchange="importJournalsFromExcel(this)">
                </div>
                <p class="hint-text">* عند الاستيراد، يتم تجميع الأسطر بناءً على رقم القيد.</p>
            </div>
        </div>

        <div class="settings-card" style="background:#ffebee">
            <h4>⚠️ منطقة الخطر</h4>
            <button onclick="resetDatabase()" class="danger-btn">حذف جميع البيانات (تهيئة)</button>
        </div>
    `;

    injectSettingStyles();
}

// ==========================================
// منطق التصدير والاستيراد (Excel Logic)
// ==========================================

// --- 1. الحسابات (Accounts) ---

function exportAccountsToExcel() {
    dbGetAllAccounts(function(accounts) {
        // تجهيز البيانات بشكل مبسط للإكسيل
        const data = accounts.map(acc => ({
            "رقم المعرف (ID)": acc.id,
            "كود الحساب": acc.code,
            "اسم الحساب": acc.name,
            "رقم الأب (ParentID)": acc.parentId
        }));

        // إنشاء ملف الإكسيل
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "دليل الحسابات");
        
        // الحفظ
        XLSX.writeFile(wb, "Accounts_Backup.xlsx");
    });
}

function importAccountsFromExcel(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // تحويل الإكسيل إلى JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (confirm(`تم قراءة ${jsonData.length} حساب. هل تريد إضافتهم لقاعدة البيانات؟`)) {
            let count = 0;
            jsonData.forEach(row => {
                // التأكد من أسماء الأعمدة (سواء عربي أو انجليزي حسب التصدير)
                // هنا نفترض أن المستخدم يستخدم نفس القالب المصدر
                const code = row["كود الحساب"] || row["code"];
                const name = row["اسم الحساب"] || row["name"];
                const parentId = row["رقم الأب (ParentID)"] || row["parentId"] || 0;

                if (code && name) {
                    // إضافة للقاعدة
                    dbAddAccount({ code: String(code), name: String(name), parentId: parseInt(parentId) }, 
                        () => {}, // Success (silent)
                        () => console.log("تكرار أو خطأ في", code)
                    );
                    count++;
                }
            });
            alert("تمت العملية. يرجى تحديث الصفحة لرؤية التغييرات.");
            setTimeout(() => location.reload(), 1000);
        }
    };
    reader.readAsArrayBuffer(file);
    // تفريغ الحقل
    input.value = ""; 
}

// --- 2. القيود (Journals) ---

function exportJournalsToExcel() {
    dbGetAllJournals(function(journals) {
        // القيود مخزنة بشكل هرمي (قيد وبداخله تفاصيل)
        // للإكسيل، يجب "تسطيح" البيانات (Flattening)
        const flatData = [];

        journals.forEach(j => {
            j.details.forEach(det => {
                flatData.push({
                    "رقم القيد": j.id, // مهم جداً للتجميع عند الاستيراد
                    "التاريخ": j.date,
                    "البيان": j.description,
                    "كود الحساب": det.accountCode || det.accountId, // نفضل الكود
                    "مدين": det.debit,
                    "دائن": det.credit
                });
            });
        });

        const ws = XLSX.utils.json_to_sheet(flatData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "القيود اليومية");
        
        XLSX.writeFile(wb, "Journals_Backup.xlsx");
    });
}

function importJournalsFromExcel(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // التحدي: الإكسيل صفوف متفرقة، ونحن نريد تجميعها كقيود
        // الحل: التجميع بواسطة "رقم القيد"
        const groupedJournals = {};

        jsonData.forEach(row => {
            const jId = row["رقم القيد"] || "Temp_" + Math.random(); // لو مفيش رقم نعتبره قيد جديد مؤقت
            const date = row["التاريخ"];
            const desc = row["البيان"];
            const accCode = row["كود الحساب"];
            const debit = parseFloat(row["مدين"]) || 0;
            const credit = parseFloat(row["دائن"]) || 0;

            if (!groupedJournals[jId]) {
                groupedJournals[jId] = {
                    date: date,
                    description: desc,
                    details: []
                };
            }
            
            // نحتاج معرفة ID الحساب بناء على الكود
            // هذه خطوة متقدمة، للتبسيط سنحاول البحث عن الحساب لاحقاً أو حفظ الكود فقط
            // سنحفظ الكود والعملية تتم لاحقاً عند العرض، أو يجب أن نبحث في القاعدة الآن
            // للسرعة: سنخزن الكود، ويجب على النظام أن يكون ذكياً في التعامل معه
            // ملاحظة: dbAddJournal تتوقع accountId. 
            // *تحسين*: سنقوم بجلب كل الحسابات أولاً لمطابقة الأكواد
        });

        // لجعل الاستيراد دقيقاً، نجلب الحسابات ونطابق الأكواد
        dbGetAllAccounts(function(allAccounts) {
            const codeMap = {};
            allAccounts.forEach(a => codeMap[a.code] = a.id);

            let importCount = 0;
            const journalKeys = Object.keys(groupedJournals);

            // مصفوفة لتنفيذ العمليات التسلسلية
            const processJournal = (index) => {
                if (index >= journalKeys.length) {
                    alert(`تم استيراد ${importCount} قيد بنجاح.`);
                    location.reload();
                    return;
                }

                const key = journalKeys[index];
                const jData = groupedJournals[key];
                
                // تحويل تفاصيل القيد واستبدال الكود بالـ ID
                let totalDeb = 0;
                const processedDetails = jData.details = [];
                
                // نحن بحاجة لإعادة التكرار على الصفوف الأصلية للتأكد من التفاصيل
                // الطريقة الأفضل: التجميع كان يجب أن يشمل التفاصيل
                // دعنا نعيد التجميع بشكل أصح:
            };
            
            // --- إعادة التجميع مع المطابقة ---
            const finalJournals = [];
            const tempMap = {}; // Map<JournalID, JournalObject>

            jsonData.forEach(row => {
                const jId = row["رقم القيد"];
                const accCode = String(row["كود الحساب"]);
                const accId = codeMap[accCode]; // البحث عن الآيدي

                if (!accId) {
                    console.warn(`تجاهل سطر: كود الحساب غير موجود ${accCode}`);
                    return;
                }

                if (!tempMap[jId]) {
                    tempMap[jId] = {
                        date: row["التاريخ"],
                        description: row["البيان"],
                        totalAmount: 0,
                        details: []
                    };
                    finalJournals.push(tempMap[jId]);
                }

                const debit = parseFloat(row["مدين"]) || 0;
                const credit = parseFloat(row["دائن"]) || 0;

                tempMap[jId].details.push({
                    accountId: String(accId),
                    accountCode: accCode,
                    debit: debit,
                    credit: credit
                });

                tempMap[jId].totalAmount += debit;
            });

            // الحفظ في القاعدة
            if (finalJournals.length > 0 && confirm(`تم تجهيز ${finalJournals.length} قيد. هل تريد الاستيراد؟`)) {
                finalJournals.forEach(j => {
                    dbAddJournal(j, () => {}, () => {});
                });
                alert("تم بدء الاستيراد في الخلفية.");
                setTimeout(() => location.reload(), 1500);
            } else {
                alert("لم يتم العثور على بيانات صالحة أو تم إلغاء العملية.");
            }
        });
    };
    reader.readAsArrayBuffer(file);
    input.value = "";
}

// --- وظائف إضافية ---
function resetDatabase() {
    if (confirm("تحذير: هذا سيحذف كل البيانات نهائياً! هل أنت متأكد؟")) {
        const req = indexedDB.deleteDatabase('MyAccountingDB');
        req.onsuccess = () => {
            alert("تم الحذف. سيتم إعادة تحميل الصفحة لإنشاء قاعدة جديدة فارغة.");
            location.reload();
        };
    }
}

function injectSettingStyles() {
    if (document.getElementById('setting-css')) return;
    const s = document.createElement('style');
    s.id = 'setting-css';
    s.innerHTML = `
        .settings-card { background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .policy-list { padding-right: 20px; color: #555; font-size: 10px; }
        .policy-list li { margin-bottom: 5px; }
        
        /* أزرار الإكسيل */
        .excel-control-group { margin-bottom: 10px; }
        .excel-control-group label { display: block; font-weight: bold; margin-bottom: 5px; color: #2c3e50; font-size: 11px; }
        .btn-row { display: flex; gap: 10px; }
        .excel-btn { flex: 1; padding: 10px; border: none; border-radius: 5px; cursor: pointer; font-size: 10px; color: white; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .excel-btn.export { background-color: #27ae60; } /* أخضر */
        .excel-btn.import { background-color: #2980b9; } /* أزرق */
        
        .hint-text { font-size: 9px; color: #7f8c8d; margin-top: 5px; }
        .danger-btn { width: 100%; background: #c0392b; color: white; border: none; padding: 10px; border-radius: 4px; margin-top: 10px; cursor: pointer; }
    `;
    document.head.appendChild(s);
}
