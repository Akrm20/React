// === Fin.js ===

function initFinancialReports() {
    renderReportStyles();
    const tab4 = document.getElementById('tab4');
    tab4.innerHTML = `
        <h3>التقارير المالية</h3>
        <div class="report-controls">
            <button onclick="generateIncomeStatement()" class="rep-btn">قائمة الدخل</button>
            <button onclick="generateBalanceSheet()" class="rep-btn">قائمة المركز المالي</button>
        </div>
        <div id="report-display-area"></div>
        <div id="save-indicator" style="display:none; position:fixed; bottom:10px; left:10px; background:#2ecc71; color:white; padding:5px 10px; border-radius:4px; font-size:10px;">تم الحفظ</div>
    `;
}

// --- المحرك ---
function calculateBalances(callback) {
    dbGetAllAccounts(function(accounts) {
        dbGetAllJournals(function(journals) {
            // جلب البيانات اليدوية المحفوظة أيضاً
            dbGetReportData(function(savedReportData) {
                
                const balances = {};
                accounts.forEach(acc => balances[acc.id] = 0);

                journals.forEach(j => {
                    j.details.forEach(det => {
                        const val = det.debit - det.credit;
                        if (balances[det.accountId] !== undefined) {
                            balances[det.accountId] += val;
                        }
                    });
                });

                const getTotal = (accId) => {
                    let total = balances[accId] || 0;
                    const children = accounts.filter(a => a.parentId === accId);
                    children.forEach(child => {
                        total += getTotal(child.id);
                    });
                    return total;
                };

                // نمرر البيانات المحفوظة (savedReportData) للكولباك
                callback(accounts, balances, getTotal, savedReportData);
            });
        });
    });
}

// --- قائمة الدخل ---
function generateIncomeStatement() {
    const area = document.getElementById('report-display-area');
    area.innerHTML = '<p class="loading-text">جارِ المعالجة...</p>';

    calculateBalances((accounts, rawBalances, getTotal, repData) => {
        let html = `
            <div class="fin-sheet">
                <div class="sheet-header">
                    <h4>قائمة الدخل</h4>
                    <span>عن الفترة المنتهية في ${AppConfig.fiscalYear.end}</span>
                </div>
                <table class="fin-table">
                    <thead>
                        <tr>
                            <th width="40%">البيان</th>
                            <th width="15%">إيضاح</th>
                            <th width="22%">${new Date().getFullYear()}</th>
                            <th width="22%">مقارنة (${new Date().getFullYear()-1})</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        const revenueNode = accounts.find(a => a.code === '4');
        const revenueTotal = revenueNode ? getTotal(revenueNode.id) * -1 : 0;
        
        // نمرر repData لدالة الرسم
        html += renderSectionRow("الإيرادات", revenueTotal, true, 0, 'inc_rev', repData);

        accounts.filter(a => a.parentId === revenueNode?.id).forEach(acc => {
            const val = getTotal(acc.id) * -1;
            if (val !== 0) html += renderSectionRow(acc.name, val, false, 1, acc.id, repData);
        });

        const costNode = accounts.find(a => a.code === '51');
        const costTotal = costNode ? getTotal(costNode.id) : 0;
        
        html += renderSectionRow("تكلفة المبيعات", costTotal * -1, false, 0, 'inc_cost', repData);

        const grossProfit = revenueTotal - costTotal;
        html += renderTotalRow("مجمل الربح", grossProfit, false, 'inc_gross', repData);

        const expNode = accounts.find(a => a.code === '52');
        const expTotal = expNode ? getTotal(expNode.id) : 0;
        html += renderSectionRow("المصاريف التشغيلية", expTotal * -1, false, 0, 'inc_exp', repData);

        accounts.filter(a => a.parentId === expNode?.id).forEach(acc => {
             const val = getTotal(acc.id);
             if (val !== 0) html += renderSectionRow(acc.name, val * -1, false, 1, acc.id, repData);
        });

        const netIncome = grossProfit - expTotal;
        window.currentNetIncome = netIncome;

        html += renderTotalRow("صافي الربح", netIncome, true, 'inc_net', repData);
        
        html += `</tbody></table></div>`;
        area.innerHTML = html;
    });
}

// --- الميزانية ---
function generateBalanceSheet() {
    const area = document.getElementById('report-display-area');
    area.innerHTML = '<p class="loading-text">جارِ المعالجة...</p>';

    calculateBalances((accounts, rawBalances, getTotal, repData) => {
        let html = `
            <div class="fin-sheet">
                <div class="sheet-header">
                    <h4>قائمة المركز المالي</h4>
                    <span>كما في ${AppConfig.fiscalYear.end}</span>
                </div>
                <table class="fin-table">
                    <thead>
                        <tr>
                            <th width="40%">البيان</th>
                            <th width="15%">إيضاح</th>
                            <th width="22%">${new Date().getFullYear()}</th>
                            <th width="22%">مقارنة (${new Date().getFullYear()-1})</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        html += `<tr class="section-head"><td colspan="4">الأصول</td></tr>`;
        
        const currAssets = accounts.find(a => a.code === '11');
        const currAssetsTotal = currAssets ? getTotal(currAssets.id) : 0;
        
        accounts.filter(a => a.parentId === currAssets?.id).forEach(acc => {
            const val = getTotal(acc.id);
            html += renderSectionRow(acc.name, val, false, 1, acc.id, repData);
        });
        html += renderTotalRow("إجمالي الأصول المتداولة", currAssetsTotal, false, 'bs_cur_ass_tot', repData);

        const nonCurrAssets = accounts.find(a => a.code === '12');
        const nonCurrAssetsTotal = nonCurrAssets ? getTotal(nonCurrAssets.id) : 0;
        
        accounts.filter(a => a.parentId === nonCurrAssets?.id).forEach(acc => {
            const val = getTotal(acc.id);
            html += renderSectionRow(acc.name, val, false, 1, acc.id, repData);
        });
        html += renderTotalRow("إجمالي الأصول غير المتداولة", nonCurrAssetsTotal, false, 'bs_non_ass_tot', repData);

        const totalAssets = currAssetsTotal + nonCurrAssetsTotal;
        html += renderTotalRow("إجمالي الأصول", totalAssets, true, 'bs_ass_tot', repData);

        html += `<tr class="gap-row"><td colspan="4"></td></tr>`;
        html += `<tr class="section-head"><td colspan="4">الخصوم وحقوق الملكية</td></tr>`;

        const liabNode = accounts.find(a => a.code === '2');
        const liabTotal = liabNode ? getTotal(liabNode.id) * -1 : 0;
        
        accounts.filter(a => a.parentId === liabNode?.id).forEach(acc => {
             accounts.filter(sub => sub.parentId === acc.id).forEach(subSub => {
                const v = getTotal(subSub.id) * -1;
                if (v !== 0) html += renderSectionRow(subSub.name, v, false, 1, subSub.id, repData);
             });
        });
        html += renderTotalRow("إجمالي الخصوم", liabTotal, false, 'bs_liab_tot', repData);

        const equityNode = accounts.find(a => a.code === '3');
        let equityTotal = equityNode ? getTotal(equityNode.id) * -1 : 0;
        const capitalAcc = accounts.find(a => a.code.startsWith('31'));
        if (capitalAcc) {
            html += renderSectionRow(capitalAcc.name, getTotal(capitalAcc.id) * -1, false, 1, capitalAcc.id, repData);
        }

        const revT = (accounts.find(a => a.code === '4') ? getTotal(accounts.find(a => a.code === '4').id) : 0) * -1;
        const expT = (accounts.find(a => a.code === '5') ? getTotal(accounts.find(a => a.code === '5').id) : 0);
        const currentPeriodIncome = revT - expT;

        html += renderSectionRow("أرباح الفترة الحالية", currentPeriodIncome, false, 1, 'equity_inc', repData);

        const totalEquity = equityTotal + currentPeriodIncome;
        html += renderTotalRow("إجمالي حقوق الملكية", totalEquity, false, 'bs_eq_tot', repData);

        const totalLiabEquity = liabTotal + totalEquity;
        const isBalanced = Math.abs(totalAssets - totalLiabEquity) < 1;

        html += renderTotalRow("إجمالي الخصوم وحقوق الملكية", totalLiabEquity, true, 'bs_fin_tot', repData);
        
        if (!isBalanced) {
            html += `<tr><td colspan="4" style="color:red; text-align:center;">⚠️ الميزانية غير متزنة (${formatMoney(totalAssets - totalLiabEquity)})</td></tr>`;
        }

        html += `</tbody></table></div>`;
        area.innerHTML = html;
    });
}

// --- دوال الرسم المعدلة (لتدعم الإدخال) ---

// 1. رسم صف عادي (حساب)
// uniqueId: هو رقم الحساب أو كود مميز للصف
// repData: البيانات المحفوظة
function renderSectionRow(name, amount, isBold = false, indentLevel = 0, uniqueId, repData) {
    const style = isBold ? 'font-weight:bold;' : '';
    const indent = indentLevel * 10;
    
    // مفاتيح الحفظ
    const noteKey = `note_${uniqueId}`;
    const prevKey = `prev_${uniqueId}`;

    // القيم المحفوظة
    const noteVal = repData && repData[noteKey] ? repData[noteKey] : '';
    const prevVal = repData && repData[prevKey] ? repData[prevKey] : '';

    return `
        <tr style="${style}">
            <td style="padding-right:${indent}px">${name}</td>
            
            <td class="input-cell">
                <input type="text" 
                       id="${noteKey}" 
                       value="${noteVal}" 
                       placeholder="..."
                       onblur="autoSaveCell(this)"
                       class="sheet-input note-input">
            </td>
            
            <td class="num-col">${amount === 0 ? '-' : formatMoney(amount)}</td>
            
            <td class="input-cell">
                <input type="text" 
                       id="${prevKey}" 
                       value="${prevVal}" 
                       placeholder="0.00"
                       onblur="autoSaveCell(this)"
                       class="sheet-input prev-input">
            </td> 
        </tr>
    `;
}

// 2. رسم صف الإجمالي
function renderTotalRow(name, amount, isGrandTotal = false, uniqueId, repData) {
    const bg = isGrandTotal ? '#ecf0f1' : '#f9f9f9';
    const weight = isGrandTotal ? 'bold' : 'normal';
    
    // حتى صفوف الإجمالي سنسمح بتعديل سنة المقارنة فيها يدوياً
    const prevKey = `prev_${uniqueId}`;
    const prevVal = repData && repData[prevKey] ? repData[prevKey] : '';

    return `
        <tr style="background:${bg}; font-weight:${weight}; border-top:1px solid #ccc;">
            <td>${name}</td>
            <td></td>
            <td class="num-col">${formatMoney(amount)}</td>
            
            <td class="input-cell">
                <input type="text" 
                       id="${prevKey}" 
                       value="${prevVal}" 
                       placeholder="0.00"
                       onblur="autoSaveCell(this)"
                       style="font-weight:bold"
                       class="sheet-input prev-input">
            </td>
        </tr>
    `;
}

// --- دالة الحفظ التلقائي ---
function autoSaveCell(inputElement) {
    const id = inputElement.id;
    const value = inputElement.value;
    
    // حفظ في قاعدة البيانات
    dbSaveReportCell(id, value);

    // إظهار مؤشر حفظ بسيط
    const indicator = document.getElementById('save-indicator');
    indicator.style.display = 'block';
    setTimeout(() => {
        indicator.style.display = 'none';
    }, 1500);
}

function renderReportStyles() {
    if (document.getElementById('rep-css')) return;
    const s = document.createElement('style');
    s.id = 'rep-css';
    s.innerHTML = `
        .report-controls { display: flex; gap: 10px; margin-bottom: 15px; justify-content: center; }
        .rep-btn { background: #2c3e50; color: white; border: none; padding: 8px 15px; border-radius: 4px; font-size: 10px; cursor: pointer; }
        
        .fin-sheet { background: white; padding: 10px; border: 1px solid #ccc; font-family: 'Courier New', Tahoma; }
        .sheet-header { text-align: center; margin-bottom: 15px; border-bottom: 2px double #000; padding-bottom: 10px; }
        .fin-table { width: 100%; border-collapse: collapse; font-size: 9px; }
        .fin-table th { border: 1px solid #eee; padding: 5px; background: #f4f4f4; }
        .fin-table td { border: 1px solid #f9f9f9; padding: 2px; vertical-align: middle; }
        
        .num-col { text-align: left; direction: ltr; padding: 4px !important; }
        
        /* تنسيق حقول الإدخال داخل الجدول لتكون مخفية */
        .input-cell { padding: 0 !important; }
        .sheet-input {
            width: 100%;
            border: none;
            background: transparent;
            font-family: inherit;
            font-size: 9px;
            padding: 4px;
            box-sizing: border-box;
            outline: none;
            text-align: center;
        }
        .prev-input { direction: ltr; text-align: left; color: #555; }
        .note-input { text-align: right; color: #7f8c8d; }
        
        /* عند التركيز يظهر بوردر خفيف */
        .sheet-input:focus { background: #fffbe6; border-bottom: 1px solid #f1c40f; }
        .sheet-input:hover { background: #fdfdfd; }
        
        .section-head { font-weight: bold; background: #eee; }
        .loading-text { text-align: center; padding: 20px; }
    `;
    document.head.appendChild(s);
}
