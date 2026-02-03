// === Db.js: قلب قاعدة البيانات (الإصدار الشامل) ===

let db;
const DB_NAME = 'MyAccountingDB';
// قمنا بتحديث الإصدار لضمان إنشاء الجداول الجديدة
const DB_VERSION = 3; 

const request = indexedDB.open(DB_NAME, DB_VERSION);

// 1. هيكلة قاعدة البيانات (تعمل عند أول تشغيل أو تحديث الإصدار)
request.onupgradeneeded = function(event) {
    db = event.target.result;
    
    // --- أولاً: تنظيف القديم (لضمان بداية نظيفة في مرحلة التصميم) ---
    if (db.objectStoreNames.contains('accounts')) db.deleteObjectStore('accounts');
    if (db.objectStoreNames.contains('journals')) db.deleteObjectStore('journals');
    if (db.objectStoreNames.contains('report_data')) db.deleteObjectStore('report_data');

    // --- ثانياً: إنشاء الجداول ---

    // أ) جدول الحسابات
    const accStore = db.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
    accStore.createIndex('parentId', 'parentId', { unique: false });
    accStore.createIndex('code', 'code', { unique: true });

    // ب) جدول القيود
    const journalStore = db.createObjectStore('journals', { keyPath: 'id', autoIncrement: true });
    journalStore.createIndex('date', 'date', { unique: false });

    // ج) جدول بيانات التقارير (الإيضاحات والمقارنات)
    // المفتاح هنا ليس رقم تلقائي، بل نص مميز (مثلاً: note_1101)
    db.createObjectStore('report_data', { keyPath: 'id' });

    // --- ثالثاً: تعبئة الدليل المحاسبي الافتراضي (سوكبا) ---
    accStore.transaction.oncomplete = function() {
        const trans = db.transaction("accounts", "readwrite").objectStore("accounts");
        
        // القائمة الكاملة للحسابات حسب طلبك
        const initialAccounts = [
            // المستوى الأول (الرئيسي)
            { id: 1, code: '1', name: 'الأصول', parentId: 0 },
            { id: 2, code: '2', name: 'الخصوم', parentId: 0 },
            { id: 3, code: '3', name: 'حقوق الملكية', parentId: 0 },
            { id: 4, code: '4', name: 'الإيرادات', parentId: 0 },
            { id: 5, code: '5', name: 'المصروفات', parentId: 0 },

            // تفريعات الأصول (1)
            { id: 6, code: '11', name: 'أصول متداولة', parentId: 1 },
            { id: 7, code: '12', name: 'أصول غير متداولة', parentId: 1 },
            
            // تفريعات الأصول المتداولة (11)
            { id: 8, code: '111', name: 'النقدية وما في حكمها', parentId: 6 },
            { id: 9, code: '112', name: 'البنوك', parentId: 6 },
            { id: 10, code: '113', name: 'المخزون', parentId: 6 },
            { id: 11, code: '114', name: 'المدينون (العملاء)', parentId: 6 },

            // تفريعات الصناديق
            { id: 12, code: '11111', name: 'الصناديق الرئيسية', parentId: 8 }, 
            { id: 13, code: '111111', name: 'حساب الصندوق (ريال)', parentId: 12 }, 

            // تفريعات البنوك
            { id: 14, code: '11211', name: 'حساب البنك التجاري', parentId: 9 },

            // تفريعات المخزون
            { id: 15, code: '11311', name: 'مخزون البضاعة', parentId: 10 }, 

            // تفريعات العملاء
            { id: 16, code: '11411', name: 'حساب العملاء الرئيسي', parentId: 11 }, 
            { id: 17, code: '114111', name: 'العميل فلان', parentId: 16 }, 

            // تفريعات الأصول غير المتداولة (12)
            { id: 18, code: '121', name: 'الممتلكات والمعدات', parentId: 7 },
            { id: 19, code: '1211', name: 'المباني', parentId: 18 },
            { id: 20, code: '12111', name: 'المبنى الرئيسي', parentId: 19 }, 

            // تفريعات حقوق الملكية (3)
            { id: 21, code: '31', name: 'رأس المال', parentId: 3 },
            { id: 22, code: '31111', name: 'رأس المال المدفوع', parentId: 21 }, 
            
            { id: 23, code: '32', name: 'الاحتياطيات والأرباح', parentId: 3 },
            { id: 24, code: '32111', name: 'الأرباح المبقاة', parentId: 23 }, 

            // تفريعات الإيرادات (4)
            { id: 25, code: '41', name: 'المبيعات', parentId: 4 }, 

            // تفريعات المصروفات (5)
            { id: 26, code: '51', name: 'تكلفة المبيعات', parentId: 5 },
            { id: 27, code: '511', name: 'تكلفة البضاعة المباعة', parentId: 26 }, 
            
            { id: 28, code: '52', name: 'مصاريف تشغيلية', parentId: 5 }, 

            // الخصوم (2)
            { id: 29, code: '21', name: 'خصوم متداولة', parentId: 2 },
            { id: 30, code: '211', name: 'الموردين', parentId: 29 }, 
            
            // الضرائب (ضريبة القيمة المضافة)
            { id: 31, code: '212', name: 'الالتزامات الضريبية', parentId: 29 },
            { id: 32, code: '2121', name: 'ضريبة القيمة المضافة', parentId: 31 },
            { id: 33, code: '21211', name: 'ضريبة مخرجات (مبيعات)', parentId: 32 }, 
            { id: 34, code: '21212', name: 'ضريبة مدخلات (مشتريات)', parentId: 32 }, 
            { id: 35, code: '21213', name: 'صافي الضريبة VAT', parentId: 32 } 
        ];

        initialAccounts.forEach(acc => trans.add(acc));
    };
};

// 2. عند نجاح الاتصال
request.onsuccess = function(event) {
    db = event.target.result;
    console.log("تم الاتصال بقاعدة البيانات (V3) بنجاح");
    
    // تشغيل ملفات النظام الأخرى إذا كانت محملة
    if (typeof startSystem === 'function') startSystem(); // Tree.js
    if (typeof initJournalFeature === 'function') initJournalFeature(); // Ju.js
    if (typeof initFinancialReports === 'function') initFinancialReports(); // Fin.js
};

request.onerror = function(event) {
    console.error("خطأ فادح في قاعدة البيانات:", event.target.errorCode);
};


// ==========================================
// قسم دوال الخدمة (API) للملفات الأخرى
// ==========================================

// --- دوال الحسابات ---
function dbGetAllAccounts(callback) {
    const tx = db.transaction(['accounts'], 'readonly');
    const store = tx.objectStore('accounts');
    store.getAll().onsuccess = (e) => callback(e.target.result);
}

function dbAddAccount(data, onSuccess, onError) {
    const tx = db.transaction(['accounts'], 'readwrite');
    const store = tx.objectStore('accounts');
    const req = store.add(data);
    req.onsuccess = onSuccess;
    req.onerror = onError;
}

// --- دوال القيود ---
function dbGetAllJournals(callback) {
    const tx = db.transaction(['journals'], 'readonly');
    const store = tx.objectStore('journals');
    store.getAll().onsuccess = (e) => callback(e.target.result);
}

function dbAddJournal(data, onSuccess, onError) {
    const tx = db.transaction(['journals'], 'readwrite');
    const store = tx.objectStore('journals');
    const req = store.add(data);
    req.onsuccess = onSuccess;
    req.onerror = onError;
}

// --- دوال التقارير (الجديدة) ---

// جلب الإيضاحات وأرقام المقارنة
function dbGetReportData(callback) {
    const tx = db.transaction(['report_data'], 'readonly');
    const store = tx.objectStore('report_data');
    store.getAll().onsuccess = function(event) {
        // تحويل المصفوفة إلى Object للبحث السريع
        const dataMap = {};
        event.target.result.forEach(item => {
            dataMap[item.id] = item.value;
        });
        callback(dataMap);
    };
}

// حفظ خلية واحدة (إيضاح أو رقم مقارنة)
function dbSaveReportCell(id, value) {
    const tx = db.transaction(['report_data'], 'readwrite');
    const store = tx.objectStore('report_data');
    // put تقوم بالإضافة إذا لم يكن موجوداً، أو التحديث إذا كان موجوداً
    store.put({ id: id, value: value });
}
