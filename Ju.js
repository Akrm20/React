// === Ju.js: إدارة القيود اليومية (تصميم احترافي + فلترة ذكية) ===

function initJournalFeature() {
    injectJournalStyles();
    renderJournalList();
}

// 1. عرض قائمة القيود (بتصميم الجدول المحاسبي المصغر)
function renderJournalList() {
    const tab3 = document.getElementById('tab3');
    tab3.innerHTML = '<h3>القيود اليومية</h3><div id="journals-list"></div>';
    
    // إعادة رسم زر الإضافة (لحل مشكلة اختفائه)
    createAddJournalButton();

    // نحتاج لجلب الحسابات أولاً لترجمة الأكواد إلى أسماء، ثم نجلب القيود
    dbGetAllAccounts(function(accounts) {
        // إنشاء خريطة سريعة للبحث عن اسم الحساب بالكود أو الآيدي
        const accMap = {};
        accounts.forEach(a => accMap[a.id] = { name: a.name, code: a.code });

        dbGetAllJournals(function(journals) {
            const listContainer = document.getElementById('journals-list');
            
            if (journals.length === 0) {
                listContainer.innerHTML = '<p style="text-align:center; color:#999; font-size:10px;">لا توجد قيود مسجلة</p>';
                return;
            }

            // عكس الترتيب ليظهر الأحدث أولاً
            journals.reverse();

            let html = '';
            journals.forEach(j => {
                // بناء أسطر تفاصيل القيد
                let rowsHtml = '';
                j.details.forEach(det => {
                    const accName = accMap[det.accountId] ? accMap[det.accountId].name : 'حساب محذوف';
                    const accCode = det.accountCode || (accMap[det.accountId] ? accMap[det.accountId].code : '');
                    
                    // إخفاء الأصفار لتنظيف العرض
                    const debitTxt = det.debit > 0 ? formatMoney(det.debit) : '';
                    const creditTxt = det.credit > 0 ? formatMoney(det.credit) : '';

                    rowsHtml += `
                        <tr>
                            <td class="acc-col">
                                <span class="code-pill">${accCode}</span> ${accName}
                            </td>
                            <td class="num-col">${debitTxt}</td>
                            <td class="num-col">${creditTxt}</td>
                        </tr>
                    `;
                });

                html += `
                    <div class="journal-card">
                        <div class="j-header">
                            <span class="j-id">#${j.id}</span>
                            <span class="j-date">${j.date}</span>
                        </div>
                        
                        <div class="j-body">
                            <table class="mini-j-table">
                                <thead>
                                    <tr>
                                        <th width="50%">الحساب</th>
                                        <th width="25%">مدين</th>
                                        <th width="25%">دائن</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td>${j.description}</td>
                                        <td class="total-cell">${formatMoney(j.totalAmount)}</td>
                                        <td class="total-cell">${formatMoney(j.totalAmount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                `;
            });
            listContainer.innerHTML = html;
        });
    });
}

// 2. زر الإضافة
function createAddJournalButton() {
    if(document.getElementById('addJuBtn')) return;
    const tab3 = document.getElementById('tab3');
    const btn = document.createElement('button');
    btn.id = 'addJuBtn';
    btn.className = 'fab-btn';
    btn.innerHTML = '+';
    btn.onclick = openJournalModal;
    tab3.appendChild(btn);
}

// 3. المودال
function createJournalModal() {
    if (document.getElementById('journalModal')) return;

    const modalHTML = `
        <div class="modal-box" style="width:95%; max-height:95vh; overflow-y:auto;">
            <div class="modal-head">
                <h4>قيد يومية جديد</h4>
                <div class="date-in">
                    <input type="date" id="jDate" class="input-field" style="margin:0;">
                </div>
            </div>
            
            <input type="text" id="jDesc" class="input-field" placeholder="بيان القيد (شرح العملية)...">

            <div id="journalHeaderLabels">
                <span>الحساب</span>
                <span style="width:20%">مدين</span>
                <span style="width:20%">دائن</span>
                <span style="width:20px"></span>
            </div>
            <div id="journalRowsContainer"></div>

            <button onclick="addNewRow()" class="btn-dashed">+ طرف جديد</button>

            <div class="totals-area">
                <div class="t-row">
                    <span>الإجمالي:</span>
                    <b id="totalDebit">0.00</b>
                    <b id="totalCredit">0.00</b>
                </div>
                <div id="diffStatus" class="status-badge">(متزن)</div>
            </div>

            <div class="modal-buttons">
                <button onclick="saveJournal()" class="btn-save">حفظ القيد</button>
                <button onclick="closeJournalModal()" class="btn-cancel">إلغاء</button>
            </div>
        </div>
    `;

    const div = document.createElement('div');
    div.id = 'journalModal';
    div.className = 'modal-overlay';
    div.innerHTML = modalHTML;
    document.body.appendChild(div);
}

// 4. المنطق (Logic)
let accountOptionsHtml = '';

function openJournalModal() {
    // 1. خطوة الأمان: التأكد من أن النافذة (Modal) قد تم إنشاؤها قبل التعامل مع عناصرها
    createJournalModal();

    // 2. الآن يمكننا الوصول للعناصر بأمان
    const dateInput = document.getElementById('jDate');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    const descInput = document.getElementById('jDesc');
    if (descInput) {
        descInput.value = '';
    }

    const container = document.getElementById('journalRowsContainer');
    if (container) {
        container.innerHTML = '';
    }
    
    // 3. جلب الحسابات وتجهيز القائمة المنسدلة (الحسابات الفرعية فقط)
    dbGetAllAccounts(function(accounts) {
        // أ) تحديد الحسابات الرئيسية (الآباء) لاستبعادها
        const parentIds = new Set();
        accounts.forEach(acc => {
            if (acc.parentId !== 0) parentIds.add(acc.parentId);
        });

        // ب) تصفية الحسابات: نأخذ فقط من ليس لديه أبناء (Leaf Nodes)
        const leafAccounts = accounts.filter(acc => !parentIds.has(acc.id));

        // ج) بناء خيارات القائمة
        let options = '<option value="">اختر الحساب...</option>';
        leafAccounts.forEach(acc => {
            options += `<option value="${acc.id}" data-code="${acc.code}">${acc.code} - ${acc.name}</option>`;
        });
        
        // حفظ الخيارات في متغير عام لاستخدامه عند إضافة أسطر جديدة
        accountOptionsHtml = options;
        
        // د) إضافة سطرين افتراضيين
        addNewRow();
        addNewRow();
        
        // هـ) تحديث المجاميع وإظهار النافذة
        updateTotals();
        document.getElementById('journalModal').style.display = 'flex';
    });
}


function closeJournalModal() {
    document.getElementById('journalModal').style.display = 'none';
}

function addNewRow() {
    const container = document.getElementById('journalRowsContainer');
    const div = document.createElement('div');
    div.className = 'j-row';
    div.innerHTML = `
        <select class="input-field acc-select">${accountOptionsHtml}</select>
        <div class="nums-flex">
            <input type="number" class="input-field debit-in" placeholder="0" step="0.01" oninput="updateTotals()" onfocus="this.select()">
            <input type="number" class="input-field credit-in" placeholder="0" step="0.01" oninput="updateTotals()" onfocus="this.select()">
        </div>
        <button onclick="this.parentElement.remove(); updateTotals()" class="del-row">×</button>
    `;
    container.appendChild(div);
}

function updateTotals() {
    let tDebit = 0;
    let tCredit = 0;

    document.querySelectorAll('.debit-in').forEach(i => tDebit += Number(i.value));
    document.querySelectorAll('.credit-in').forEach(i => tCredit += Number(i.value));

    document.getElementById('totalDebit').innerText = formatMoney(tDebit);
    document.getElementById('totalCredit').innerText = formatMoney(tCredit);

    const diff = Math.round((tDebit - tCredit) * 100) / 100;
    const status = document.getElementById('diffStatus');
    
    if (diff === 0 && tDebit > 0) {
        status.innerText = "✅ متزن";
        status.className = "status-badge success";
    } else {
        status.innerText = `❌ الفرق: ${formatMoney(diff)}`;
        status.className = "status-badge error";
    }
}

function saveJournal() {
    const date = document.getElementById('jDate').value;
    const desc = document.getElementById('jDesc').value;
    
    if (!date || !desc) return alert("يرجى إدخال التاريخ والبيان");
    
    const rows = [];
    const container = document.getElementById('journalRowsContainer').children;
    
    let tDeb = 0;
    let tCred = 0;

    for (let row of container) {
        const select = row.querySelector('.acc-select');
        const accId = select.value;
        const accCode = select.options[select.selectedIndex]?.getAttribute('data-code');
        const deb = Number(row.querySelector('.debit-in').value);
        const cred = Number(row.querySelector('.credit-in').value);

        if (!accId) continue;
        if (deb === 0 && cred === 0) continue;
        if (deb > 0 && cred > 0) return alert("لا يمكن أن يكون الحساب مديناً ودائناً في نفس الوقت");

        tDeb += deb;
        tCred += cred;
        rows.push({ accountId: accId, accountCode: accCode, debit: deb, credit: cred });
    }

    if (rows.length < 2) return alert("يجب وجود طرفين على الأقل");
    if (Math.abs(tDeb - tCred) > 0.01) return alert("القيد غير متزن");

    const jData = {
        date: date,
        description: desc,
        totalAmount: tDeb,
        details: rows
    };

    dbAddJournal(jData, function() {
        alert("تم الحفظ");
        closeJournalModal();
        renderJournalList();
    }, function() {
        alert("فشل الحفظ");
    });
}

// 5. التنسيقات الاحترافية الجديدة
function injectJournalStyles() {
    if (document.getElementById('journal-styles')) return;
    const s = document.createElement('style');
    s.id = 'journal-styles';
    s.innerHTML = `
        /* بطاقة القيد */
        .journal-card { background: white; margin-bottom: 12px; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #e0e0e0; }
        
        .j-header { background: #f8f9fa; padding: 6px 10px; display: flex; justify-content: space-between; border-bottom: 1px solid #eee; font-size: 10px; color: #555; }
        .j-id { font-weight: bold; color: #2c3e50; }
        
        .j-body { padding: 0; }
        
        /* الجدول المصغر داخل البطاقة */
        .mini-j-table { width: 100%; border-collapse: collapse; font-size: 9px; }
        .mini-j-table th { background: #fff; border-bottom: 1px solid #eee; color: #aaa; font-weight: normal; padding: 4px; text-align: center; }
        .mini-j-table td { padding: 4px 8px; border-bottom: 1px solid #fcfcfc; vertical-align: middle; }
        .mini-j-table tr:last-child td { border-bottom: none; }
        
        .acc-col { text-align: right; color: #333; }
        .code-pill { background: #eee; padding: 1px 4px; border-radius: 3px; font-size: 8px; color: #777; margin-left: 3px; }
        .num-col { text-align: left; direction: ltr; font-family: 'Consolas', monospace; color: #2c3e50; }
        
        .mini-j-table tfoot { background: #fafafa; border-top: 1px solid #eee; }
        .mini-j-table tfoot td { padding: 6px 8px; font-weight: bold; color: #555; }
        .total-cell { text-align: left; direction: ltr; color: #2980b9; }

        /* نافذة الإدخال */
        .modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .date-in input { border: 1px solid #ddd; padding: 5px; border-radius: 4px; font-size: 11px; }
        
        #journalHeaderLabels { display: flex; padding: 0 5px; margin-bottom: 5px; font-size: 9px; color: #888; }
        
        .j-row { display: flex; gap: 5px; margin-bottom: 8px; align-items: flex-start; position: relative; border-bottom: 1px dashed #f0f0f0; padding-bottom: 5px; }
        .j-row select { flex: 2; font-size: 10px; padding: 6px; }
        .nums-flex { flex: 2; display: flex; gap: 5px; }
        .nums-flex input { width: 100%; padding: 6px; font-size: 10px; text-align: center; direction: ltr; }
        
        .del-row { background: #ffebeb; color: #c0392b; border: none; width: 20px; height: 20px; border-radius: 50%; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-top: 5px; }

        .btn-dashed { width: 100%; border: 1px dashed #ccc; background: none; color: #555; padding: 8px; border-radius: 4px; margin: 10px 0; cursor: pointer; font-size: 10px; }
        .btn-dashed:hover { background: #f9f9f9; border-color: #aaa; }

        .totals-area { background: #2c3e50; color: white; padding: 10px; border-radius: 5px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
        .t-row { display: flex; gap: 10px; font-size: 11px; align-items: center; }
        .t-row b { font-family: monospace; font-size: 12px; }
        
        .status-badge { padding: 3px 8px; border-radius: 10px; font-size: 9px; font-weight: bold; background: #fff; color: #333; }
        .status-badge.success { color: #27ae60; }
        .status-badge.error { color: #c0392b; }
    `;
    document.head.appendChild(s);
}
