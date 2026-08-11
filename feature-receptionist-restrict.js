/* ============================================================
   feature-receptionist-restrict.js
   🧑‍💼 تضييق "وضع الاستقبال" (receptionist) ليكون مقتصر فعليًا على:
   - إضافة عميل جديد (زرار ➕ الموجود في صفحة العملاء)
   - إضافة طلب جديد (زرار "➕ طلب جديد" الموجود على كارت كل عميل)
   - حسابات/سجل العميل (زرار "📜 السجل")

   يعني الصفحة الوحيدة المسموحة لوضع الاستقبال هي "العملاء" بس.
   باقي الصفحات بتتقفل تلقائيًا (بتترجّع لصفحة العملاء).

   [تحديث] 3 إصلاحات على نسخة الإطلاق الأولى بعد بلاغات فعلية:

   1) قاعدة CSS القديمة (.btn.danger{display:none}) كانت بتخفي
      كمان زرار "تأكيد" في أي نافذة appConfirm (لأنه افتراضيًا بياخد
      class="danger" إلا لو اتحدد غير كده صراحةً) — يعني أي نافذة
      تأكيد عادية (زي "عندك تعديلات لم تُحفظ") كانت بتظهر بزرار واحد
      بس وتقفل المستخدم من غير مخرج. الحل: زرار appConfirmOk نفسه
      بيفضل ظاهر دايمًا لوضع الاستقبال (مهما كانت الرسالة)، والحماية
      الحقيقية من الحذف بقت على مستوى الدالة نفسها (نقطة 2) مش على
      مستوى إخفاء الزرار، عشان تفضل شغالة حتى لو الزرار ظهر باي شكل.

   2) زرار "🗑️ حذف" لما بيتنقل جوه قائمة "⋮ المزيد" (تنظيم الكروت
      في patches.js) بيفقد class="danger" بتاعه، فقاعدة الإخفاء
      القديمة بتبطّل تلقائيًا وتسيبه قابل للضغط. الحل الحقيقي: حماية
      على مستوى الدالة نفسها (deleteCustomer/deleteOrder) بترفض
      التنفيذ لوضع الاستقبال أيًا كان شكل الزرار اللي استدعاها.

   3) زرار "📜 السجل" (حسابات العميل) كان بيتنقل هو كمان جوه قائمة
      "⋮ المزيد" المطوية زي أي زرار ثانوي عادي، فكان محتاج ضغطتين
      بدل ضغطة عشان توصله — بما إنه من أهم 3 حاجات مسموحة لوضع
      الاستقبال، بنرجّعه زرار أساسي ظاهر على طول جنب "تعديل"/"طلب
      جديد" بدل ما يفضل مدفون.

   ملف مستقل، بيلف (wrap) showPage / deleteCustomer / deleteOrder /
   renderCustomers، وبيحقن CSS خاص بيه، مش بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  const ALLOWED_PAGE = 'customers';

  function hookShowPage(){
    if(typeof window.showPage !== 'function') return;
    const orig = window.showPage;
    window.showPage = function(name){
      if(window.userRole==='receptionist' && name!==ALLOWED_PAGE){
        name = ALLOWED_PAGE;
      }
      return orig.call(this, name);
    };
  }

  // حماية حقيقية على مستوى الدالة نفسها — بتشتغل بغض النظر عن شكل
  // أو مكان الزرار اللي استدعاها (زي حالة فقدان class="danger")
  function guardDelete(fnName){
    if(typeof window[fnName] !== 'function') return;
    const orig = window[fnName];
    window[fnName] = function(){
      if(window.userRole==='receptionist'){
        toast('🔒 الحذف مش متاح في وضع الاستقبال');
        return;
      }
      return orig.apply(this, arguments);
    };
  }

  // بترجّع زرار "📜 السجل" (لو كان اتنقل جوه قائمة "المزيد") لصف
  // الأزرار الأساسي الظاهر على طول، بدل ما يحتاج ضغطتين
  function promoteHistoryButton(){
    if(window.userRole!=='receptionist') return;
    const list = document.getElementById('customersList');
    if(!list) return;
    list.querySelectorAll('.card').forEach(card=>{
      const row = card.querySelector('.btn-row');
      if(!row) return;
      const buttons = Array.from(row.querySelectorAll('button'));
      const moreMenu = row.querySelector('.card-more-menu');
      let historyBtn = buttons.find(b=>b.textContent.trim()==='📜 السجل');
      if(!historyBtn && moreMenu){
        historyBtn = Array.from(moreMenu.querySelectorAll('button')).find(b=>b.textContent.trim()==='📜 السجل');
      }
      if(!historyBtn) return;
      historyBtn.className = 'btn sm outline';
      historyBtn.removeAttribute('style');
      const moreBtn = buttons.find(b=>b.textContent.trim()==='⋮ المزيد');
      row.insertBefore(historyBtn, moreBtn || null);
    });
  }

  function hookRenderCustomers(){
    if(typeof window.renderCustomers !== 'function') return;
    const orig = window.renderCustomers;
    window.renderCustomers = function(){
      const r = orig.apply(this, arguments);
      promoteHistoryButton();
      return r;
    };
  }

  function injectStyles(){
    if(document.getElementById('receptionistRestrictStyles')) return;
    const style = document.createElement('style');
    style.id = 'receptionistRestrictStyles';
    style.textContent = `
      /* بنخفي كل أزرار التنقل ما عدا "العملاء" */
      html.role-receptionist .navbtn:not([data-page="${ALLOWED_PAGE}"]){
        display:none !important;
      }
      /* زرار تأكيد أي نافذة appConfirm لازم يفضل ظاهر دايمًا، وإلا
         المستخدم بيتقفل جوه النافذة من غير مخرج (شوف ملحوظة 1 فوق) */
      html.role-receptionist #appConfirmOk{
        display:inline-flex !important;
      }
    `;
    document.head.appendChild(style);
  }

  function boot(){
    injectStyles();
    hookShowPage();
    guardDelete('deleteCustomer');
    guardDelete('deleteOrder');
    hookRenderCustomers();
    promoteHistoryButton();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
