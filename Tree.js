// === Tree.js: مسؤول عن عرض الشجرة وإدارة واجهة الدليل ===

// هذه الدالة يتم استدعاؤها تلقائياً من Db.js عندما تكون القاعدة جاهزة
function startSystem() {
    loadAndRenderAccounts(); 
    initAddAccountFeature();
}

// --- 1. دوال العرض ---

function loadAndRenderAccounts() {
    // نطلب البيانات من دالة Db.js المساعدة
    dbGetAllAccounts(function(accounts) {
        const treeHTML = buildAccountTree(accounts, 0); 
        document.getElementById('chart-container').innerHTML = treeHTML;
    });
}

function buildAccountTree(accounts, parentId = 0) {
    const children = accounts.filter(acc => acc.parentId === parentId);
    if (children.length === 0) return '';

    let html = '';
    children.forEach(acc => {
        const subMenu = buildAccountTree(accounts, acc.id);
        html += `
            <div class="tree-node">
                <div class="account-item">
                    <span>${acc.name}</span>
                    <span class="account-code">${acc.code}</span>
                </div>
                ${subMenu}
            </div>
        `;
    });
    return html;
}

// --- 2. بناء واجهة الإضافة (ديناميكياً) ---

function initAddAccountFeature() {
    // حقن الـ CSS
    if (!document.getElementById('dynamic-styles')) {
        const style = document.createElement('style');
        style.id = 'dynamic-styles';
        style.innerHTML = `
            .fab-btn { position: fixed; bottom: 60px; left: 20px; width: 50px; height: 50px; background: #e74c3c; color: white; border-radius: 50%; border: none; font-size: 24px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); cursor: pointer; z-index: 1000; }
            .modal-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2000; align-items: center; justify-content: center; }
            .modal-box { background: white; padding: 15px; width: 80%; border-radius: 8px; }
            .input-field { width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
            .modal-buttons { display: flex; justify-content: space-between; margin-top: 10px; }
            .btn-save { background: #27ae60; color: white; border: none; padding: 8px 15px; border-radius: 4px; }
            .btn-cancel { background: #95a5a6; color: white; border: none; padding: 8px 15px; border-radius: 4px; }
        `;
        document.head.appendChild(style);
    }

    // زر الإضافة
    const tab2 = document.getElementById('tab2');
    if (tab2 && !document.getElementById('addAccBtn')) {
        const btn = document.createElement('button');
        btn.id = 'addAccBtn';
        btn.className = 'fab-btn';
        btn.innerHTML = '+';
        btn.onclick = openAddAccountModal;
        tab2.appendChild(btn);
    }

    // المودال (Pop-up)
    if (!document.getElementById('addAccountModal')) {
        const modalDiv = document.createElement('div');
        modalDiv.id = 'addAccountModal';
        modalDiv.className = 'modal-overlay';
        modalDiv.innerHTML = `
            <div class="modal-box">
                <h4>إضافة حساب جديد</h4>
                <input type="text" id="newAccountName" class="input-field" placeholder="اسم الحساب">
                <input type="number" id="newAccountCode" class="input-field" placeholder="رقم الحساب">
                <select id="parentAccountSelect" class="input-field"></select>
                <div class="modal-buttons">
                    <button id="btnSaveAcc" class="btn-save">حفظ</button>
                    <button id="btnCancelAcc" class="btn-cancel">إلغاء</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);
        document.getElementById('btnSaveAcc').onclick = saveNewAccount;
        document.getElementById('btnCancelAcc').onclick = closeModal;
    }
}

// --- 3. منطق التفاعل (Logic) ---

function openAddAccountModal() {
    const modal = document.getElementById('addAccountModal');
    const select = document.getElementById('parentAccountSelect');
    select.innerHTML = '<option value="0">--- رئيسي ---</option>';

    // نستخدم الدالة المساعدة لجلب البيانات للقائمة
    dbGetAllAccounts(function(accounts) {
        accounts.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc.id;
            option.textContent = `${acc.code} - ${acc.name}`;
            select.appendChild(option);
        });
        modal.style.display = 'flex';
    });
}

function closeModal() {
    document.getElementById('addAccountModal').style.display = 'none';
}

function saveNewAccount() {
    const name = document.getElementById('newAccountName').value;
    const code = document.getElementById('newAccountCode').value;
    const parentId = parseInt(document.getElementById('parentAccountSelect').value);

    if (!name || !code) return alert("أدخل البيانات");

    // نستخدم الدالة المساعدة للحفظ
    dbAddAccount(
        { name, code, parentId },
        function() { // عند النجاح
            alert("تم الحفظ");
            closeModal();
            document.getElementById('newAccountName').value = '';
            document.getElementById('newAccountCode').value = '';
            loadAndRenderAccounts(); 
        },
        function() { // عند الفشل
            alert("خطأ في الحفظ");
        }
    );
}