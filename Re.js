// === Re.js: لوحة التحكم والتحليل المالي المتقدم ===

function initHomeDashboard() {
    renderHomeStyles();
    
    const tab1 = document.getElementById('tab1');
    tab1.innerHTML = `
        <div class="dashboard-header">
            <h3>الملخص المالي</h3>
            <span class="date-badge">${new Date().toLocaleDateString('ar-SA')}</span>
        </div>

        <div id="kpi-area" class="kpi-grid">
            <div class="kpi-card loading">جارِ التحميل...</div>
        </div>

        <h4 class="section-title">المؤشرات التحليلية</h4>
        <div id="ratios-area" class="ratios-grid">
            </div>

        <div class="actions-area">
            <h4>أدوات التحقق</h4>
            <button onclick="generateTrialBalance()" class="action-btn">
                ⚖️ عرض ميزان المراجعة
            </button>
        </div>

        <div id="trial-balance-container" style="display:none; margin-top:15px;"></div>
    `;

    calculateHomeStats();
}

// --- 1. حساب الإحصائيات والمؤشرات ---
function calculateHomeStats() {
    dbGetAllAccounts(function(accounts) {
        dbGetAllJournals(function(journals) {
            
            // تجميع الأرصدة
            const balances = {}; 
            accounts.forEach(a => balances[a.id] = 0);

            journals.forEach(j => {
                j.details.forEach(det => {
                    const val = det.debit - det.credit;
                    if (balances[det.accountId] !== undefined) {
                        balances[det.accountId] += val;
                    }
                });
            });

            // دالة مساعدة لجمع الأرصدة بناءً على بداية الكود
            // نستخدم فقط الحسابات الفرعية (Leaf Nodes) لتجنب التكرار
            const getGroupTotal = (codePrefix) => {
                let total = 0;
                accounts.forEach(acc => {
                    if (acc.code.toString().startsWith(codePrefix)) {
                        // التأكد أنه حساب فرعي (ليس له أبناء)
                        const isParent = accounts.some(child => child.parentId === acc.id);
                        if (!isParent) {
                            total += balances[acc.id];
                        }
                    }
                });
                return total;
            };

            // --- أ) الأرقام الأساسية ---
            const totalAssets = getGroupTotal('1');
            const totalLiabilities = getGroupTotal('2') * -1; // دائن
            const totalRevenue = getGroupTotal('4') * -1;     // دائن
            const totalExpenses = getGroupTotal('5');
            const netIncome = totalRevenue - totalExpenses;

            // --- ب) أرقام التحليل المالي ---
            // 1. الأصول المتداولة (تبدأ بـ 11)
            const currentAssets = getGroupTotal('11');
            // 2. الخصوم المتداولة (تبدأ بـ 21)
            const currentLiabilities = getGroupTotal('21') * -1;
            // 3. النقدية (صندوق 111 + بنك 112)
            const cashTotal = getGroupTotal('111') + getGroupTotal('112');

            // --- ج) حساب النسب ---
            // نسبة التداول (السيولة) = الأصول المتداولة / الخصوم المتداولة
            let currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities).toFixed(2) : "ممتاز";
            
            // هامش الربح = صافي الربح / الإيرادات
            let profitMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) + '%' : "0%";
            
            // رأس المال العامل = أصول متداولة - خصوم متداولة
            let workingCapital = currentAssets - currentLiabilities;


            // --- د) العرض في الشاشة ---
            
            // 1. عرض الإجماليات
            const kpiArea = document.getElementById('kpi-area');
            kpiArea.innerHTML = `
                <div class="kpi-card c-blue">
                    <span class="label">الأصول</span>
                    <span class="value">${formatMoney(totalAssets)}</span>
                </div>
                <div class="kpi-card c-red">
                    <span class="label">الالتزامات</span>
                    <span class="value">${formatMoney(totalLiabilities)}</span>
                </div>
                <div class="kpi-card c-green">
                    <span class="label">الإيرادات</span>
                    <span class="value">${formatMoney(totalRevenue)}</span>
                </div>
                <div class="kpi-card c-orange">
                    <span class="label">المصروفات</span>
                    <span class="value">${formatMoney(totalExpenses)}</span>
                </div>
            `;

            // 2. عرض المؤشرات التحليلية (الجديد)
            const ratiosArea = document.getElementById('ratios-area');
            ratiosArea.innerHTML = `
                <div class="ratio-card">
                    <span class="r-icon">💰</span>
                    <div class="r-info">
                        <span class="r-head">صافي الربح</span>
                        <span class="r-val ${netIncome >= 0 ? 'good' : 'bad'}">${formatMoney(netIncome)}</span>
                    </div>
                </div>

                <div class="ratio-card">
                    <span class="r-icon">📊</span>
                    <div class="r-info">
                        <span class="r-head">هامش الربح</span>
                        <span class="r-val">${profitMargin}</span>
                    </div>
                </div>

                <div class="ratio-card">
                    <span class="r-icon">💧</span>
                    <div class="r-info">
                        <span class="r-head">نسبة السيولة</span>
                        <span class="r-val">${currentRatio}</span>
                    </div>
                </div>

                <div class="ratio-card">
                    <span class="r-icon">💵</span>
                    <div class="r-info">
                        <span class="r-head">نقدية وبنوك</span>
                        <span class="r-val">${formatMoney(cashTotal)}</span>
                    </div>
                </div>
                
                <div class="ratio-card full">
                    <div class="r-info">
                        <span class="r-head">رأس المال العامل (Working Capital)</span>
                        <span class="r-val" style="font-size:12px;">${formatMoney(workingCapital)}</span>
                        <span class="r-sub">سيولة متاحة للتشغيل</span>
                    </div>
                </div>
            `;
        });
    });
}

// --- 2. ميزان المراجعة (كما هو لم يتغير) ---
function generateTrialBalance() {
    const container = document.getElementById('trial-balance-container');
    container.style.display = 'block';
    container.innerHTML = '<p class="loading-text">جارِ إعداد الميزان...</p>';

    dbGetAllAccounts(function(accounts) {
        dbGetAllJournals(function(journals) {
            
            const accTotals = {};
            accounts.forEach(a => accTotals[a.id] = { debit: 0, credit: 0, code: a.code, name: a.name });

            journals.forEach(j => {
                j.details.forEach(det => {
                    if (accTotals[det.accountId]) {
                        accTotals[det.accountId].debit += det.debit;
                        accTotals[det.accountId].credit += det.credit;
                    }
                });
            });

            let tableHTML = `
                <div class="tb-card">
                    <div class="tb-header">
                        <h5>ميزان المراجعة بالأرصدة</h5>
                        <button onclick="document.getElementById('trial-balance-container').style.display='none'" class="close-btn">×</button>
                    </div>
                    <table class="tb-table">
                        <thead>
                            <tr>
                                <th>الحساب</th>
                                <th>مدين</th>
                                <th>دائن</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            let grandDebit = 0;
            let grandCredit = 0;
            const activeAccounts = Object.values(accTotals).filter(a => a.debit > 0 || a.credit > 0);
            activeAccounts.sort((a, b) => a.code - b.code);

            activeAccounts.forEach(acc => {
                const net = acc.debit - acc.credit;
                let finalDebit = 0;
                let finalCredit = 0;

                if (net > 0) finalDebit = net;
                else finalCredit = Math.abs(net);

                if (finalDebit === 0 && finalCredit === 0) return;

                grandDebit += finalDebit;
                grandCredit += finalCredit;

                tableHTML += `
                    <tr>
                        <td><small>${acc.code}</small><br>${acc.name}</td>
                        <td class="num">${finalDebit > 0 ? formatMoney(finalDebit) : '-'}</td>
                        <td class="num">${finalCredit > 0 ? formatMoney(finalCredit) : '-'}</td>
                    </tr>
                `;
            });

            const diff = Math.round((grandDebit - grandCredit) * 100) / 100;
            const isBalanced = diff === 0;
            const statusClass = isBalanced ? 'status-ok' : 'status-err';
            const statusText = isBalanced ? '✅ متزن تماماً' : `❌ غير متزن (فرق: ${diff})`;

            tableHTML += `
                        <tr class="tb-footer">
                            <td>الإجمالي</td>
                            <td>${formatMoney(grandDebit)}</td>
                            <td>${formatMoney(grandCredit)}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="balance-check ${statusClass}">
                    ${statusText}
                </div>
            </div>
            `;

            container.innerHTML = tableHTML;
            container.scrollIntoView({ behavior: 'smooth' });
        });
    });
}

// --- تنسيقات CSS المحدثة ---
function renderHomeStyles() {
    if (document.getElementById('home-css')) return;
    const s = document.createElement('style');
    s.id = 'home-css';
    s.innerHTML = `
        .dashboard-header { display: flex; justify-content: space-between; align-items: center; padding: 0 10px; margin-bottom: 10px; }
        .date-badge { background: #ecf0f1; padding: 3px 8px; border-radius: 12px; font-size: 9px; color: #7f8c8d; }
        
        /* عناوين الأقسام */
        .section-title { font-size: 11px; color: #7f8c8d; margin: 15px 5px 5px 5px; border-bottom: 1px dashed #ddd; padding-bottom: 3px; }

        /* الشبكة الرئيسية (الإجماليات) */
        .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
        .kpi-card { background: white; padding: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); text-align: center; }
        .kpi-card .label { display: block; font-size: 9px; color: #7f8c8d; margin-bottom: 3px; }
        .kpi-card .value { display: block; font-size: 12px; font-weight: bold; color: #2c3e50; direction: ltr; }
        
        .c-blue { border-bottom: 2px solid #3498db; }
        .c-red { border-bottom: 2px solid #e74c3c; }
        .c-green { border-bottom: 2px solid #27ae60; }
        .c-orange { border-bottom: 2px solid #f39c12; }

        /* شبكة النسب التحليلية (الجديدة) */
        .ratios-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px; }
        .ratio-card { background: white; padding: 8px; border-radius: 6px; border: 1px solid #eee; display: flex; align-items: center; gap: 8px; }
        .ratio-card.full { grid-column: span 2; background: #fdfdfd; justify-content: center; text-align: center; }
        
        .r-icon { font-size: 14px; background: #f4f4f4; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
        .r-info { display: flex; flex-direction: column; }
        .r-head { font-size: 8px; color: #999; }
        .r-val { font-size: 11px; font-weight: bold; color: #333; direction: ltr; }
        .r-sub { font-size: 8px; color: #aaa; margin-top: 2px; }
        
        .r-val.good { color: #27ae60; }
        .r-val.bad { color: #c0392b; }

        /* الإجراءات */
        .actions-area h4 { font-size: 11px; margin: 0 0 8px 0; color: #555; }
        .action-btn { width: 100%; padding: 10px; background: white; border: 1px solid #ddd; border-radius: 6px; text-align: right; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 10px; color: #333; transition: 0.2s; }
        .action-btn:active { background: #f0f0f0; }

        /* ميزان المراجعة */
        .tb-card { background: white; border-radius: 8px; padding: 10px; box-shadow: 0 -2px 10px rgba(0,0,0,0.1); border: 1px solid #eee; }
        .tb-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .tb-header h5 { margin: 0; font-size: 11px; color: #2c3e50; }
        .close-btn { background: none; border: none; font-size: 16px; color: #999; cursor: pointer; }
        
        .tb-table { width: 100%; font-size: 9px; border-collapse: collapse; }
        .tb-table th { background: #f8f9fa; padding: 6px; text-align: center; border-bottom: 2px solid #ddd; }
        .tb-table td { padding: 6px 4px; border-bottom: 1px solid #eee; }
        .tb-table td.num { text-align: left; direction: ltr; font-family: monospace; }
        
        .tb-footer { font-weight: bold; background: #f1f2f6; }
        .balance-check { margin-top: 10px; text-align: center; padding: 6px; border-radius: 4px; font-weight: bold; font-size: 10px; }
        .status-ok { background: #e8f8f5; color: #27ae60; border: 1px solid #a9dfbf; }
        .status-err { background: #fdedec; color: #c0392b; border: 1px solid #fadbd8; }
        
        .loading-text { text-align: center; font-size: 10px; color: #999; padding: 10px; }
    `;
    document.head.appendChild(s);
}
