/* ============================================================
   feature-delivery-signature.js
   🖊️ توقيع رقمي عند التسليم — إثبات استلام داخلي (مش توقيع
   إلكتروني قانوني معتمد)، يتحفظ كصورة مربوطة بالطلب.

   إزاي بيشتغل:
   - أول ما طلب يتحوّل لـ"تم التسليم" (من نموذج التعديل أو من
     الكانبان)، تفتح تلقائي شاشة صغيرة فيها مربع رسم بالإصبع.
   - العميل يوقع، تدوس "تأكيد" فيتحفظ التوقيع مع الطلب، أو
     "تخطي" لو مش متاح توقيع دلوقتي.
   - على كارت أي طلب مُسلَّم: زرار "🖊️ عرض التوقيع" لو موجود،
     أو "🖊️ توقيع العميل" لتسجيله لاحقًا لو اتخطى وقتها.
   ملف مستقل، بيلف saveOrder / markOrderDelivered / renderOrders
   الموجودين، مش بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  /* ---------- شاشة الرسم ---------- */
  window.openSignatureModal = function(orderId){
    const o = (db.orders||[]).find(x=>x.id===orderId);
    if(!o) return;
    const html = `
      <h3>🖊️ توقيع العميل عند الاستلام</h3>
      <div class="meta">اطلب من العميل يوقع بإصبعه في المربع تحت، كإثبات استلام داخلي</div>
      <div style="border:2px dashed var(--border);border-radius:12px;overflow:hidden;margin-top:8px;">
        <canvas id="sigCanvas" style="width:100%;height:160px;background:#fff;display:block;touch-action:none;"></canvas>
      </div>
      <div class="btn-row" style="margin-top:8px;">
        <button class="btn sm outline" onclick="clearSignatureCanvas()">🧹 مسح</button>
        <button class="btn sm secondary" onclick="skipSignature()">تخطي</button>
        <button class="btn accent" onclick="confirmSignature('${orderId}')">✅ تأكيد التوقيع</button>
      </div>
      <div class="meta" style="margin-top:6px;">ملحوظة: ده إثبات تسليم داخلي بس، مش توقيع إلكتروني قانوني معتمد</div>
    `;
    openModal(html);
    setTimeout(initSignatureCanvas, 60);
  };

  function initSignatureCanvas(){
    const canvas = document.getElementById('sigCanvas');
    if(!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width));
    canvas.height = Math.max(1, Math.round(rect.height));
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    window.__sigHasContent = false;

    let drawing = false;
    let last = null;

    function pos(ev){
      const r = canvas.getBoundingClientRect();
      const t = ev.touches && ev.touches[0];
      const clientX = t ? t.clientX : ev.clientX;
      const clientY = t ? t.clientY : ev.clientY;
      return {x: clientX-r.left, y: clientY-r.top};
    }
    function start(ev){ drawing=true; last=pos(ev); window.__sigHasContent=true; ev.preventDefault(); }
    function move(ev){
      if(!drawing) return;
      const p = pos(ev);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      ev.preventDefault();
    }
    function end(){ drawing=false; }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, {passive:false});
    canvas.addEventListener('touchmove', move, {passive:false});
    canvas.addEventListener('touchend', end);
  }

  window.clearSignatureCanvas = function(){
    const canvas = document.getElementById('sigCanvas');
    if(!canvas) return;
    canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
    window.__sigHasContent = false;
  };

  window.skipSignature = function(){
    closeModal();
  };

  window.confirmSignature = function(orderId){
    const canvas = document.getElementById('sigCanvas');
    if(!canvas) return;
    if(!window.__sigHasContent){
      toast('لسه محدش وقّع — اطلب من العميل يوقع، أو دوس "تخطي"');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const o = db.orders.find(x=>x.id===orderId);
    if(o){
      o.deliverySignature = dataUrl;
      o.deliverySignedAt = todayStr();
      saveDB();
    }
    closeModal();
    toast('✅ اتسجل التوقيع مع الطلب');
    if(typeof renderOrders==='function') renderOrders();
  };

  /* ---------- عرض/حذف توقيع محفوظ ---------- */
  window.viewSignatureModal = function(orderId){
    const o = (db.orders||[]).find(x=>x.id===orderId);
    if(!o || !o.deliverySignature) return;
    const html = `
      <h3>🖊️ توقيع العميل</h3>
      <div class="meta">اتسجل بتاريخ ${fmtDate(o.deliverySignedAt)}</div>
      <img src="${o.deliverySignature}" style="width:100%;border:1px solid var(--border);border-radius:10px;background:#fff;margin-top:8px;">
      <button class="btn sm danger" style="margin-top:8px;" onclick="deleteSignature('${o.id}')">🗑️ حذف التوقيع</button>
    `;
    openModal(html);
  };

  window.deleteSignature = async function(orderId){
    if(!await appConfirm('حذف التوقيع المسجّل مع الطلب ده؟')) return;
    const o = db.orders.find(x=>x.id===orderId);
    if(o){ delete o.deliverySignature; delete o.deliverySignedAt; saveDB(); }
    closeModal();
    toast('اتحذف التوقيع');
    if(typeof renderOrders==='function') renderOrders();
  };

  /* ---------- تشغيل الشاشة تلقائي عند التسليم ---------- */
  if(typeof markOrderDelivered === 'function'){
    const origMarkDelivered = markOrderDelivered;
    window.markOrderDelivered = function(orderId){
      const o = (db.orders||[]).find(x=>x.id===orderId);
      const wasDelivered = o && o.status==='تم التسليم';
      const r = origMarkDelivered.apply(this, arguments);
      if(o && !wasDelivered && o.status==='تم التسليم'){
        setTimeout(function(){ openSignatureModal(orderId); }, 350);
      }
      return r;
    };
  }

  if(typeof saveOrder === 'function'){
    const origSaveOrder = saveOrder;
    window.saveOrder = function(id){
      let wasDelivered = false, existing = null;
      if(id){
        existing = (db.orders||[]).find(x=>x.id===id);
        wasDelivered = existing && existing.status==='تم التسليم';
      }
      const r = origSaveOrder.apply(this, arguments);
      if(id && existing && !wasDelivered && existing.status==='تم التسليم'){
        setTimeout(function(){ openSignatureModal(id); }, 350);
      }
      return r;
    };
  }

  /* ---------- زرار عرض/تسجيل التوقيع على كارت الطلب ---------- */
  if(typeof renderOrders === 'function'){
    const origRenderOrders = renderOrders;
    window.renderOrders = function(){
      const r = origRenderOrders.apply(this, arguments);
      document.querySelectorAll('#ordersList .card').forEach(function(card){
        if(card.querySelector('.sig-btn-added')) return;
        const btn = card.querySelector('button[onclick^="openOrderModal("]');
        if(!btn) return;
        const m = btn.getAttribute('onclick').match(/openOrderModal\('([^']+)'\)/);
        if(!m) return;
        const o = db.orders.find(x=>x.id===m[1]);
        if(!o) return;
        const btnRow = card.querySelector('.btn-row');
        if(!btnRow) return;
        const sigBtn = document.createElement('button');
        sigBtn.className = 'btn sm outline sig-btn-added';
        if(o.deliverySignature){
          sigBtn.textContent = '🖊️ عرض التوقيع';
          sigBtn.onclick = function(){ viewSignatureModal(o.id); };
        } else if(o.status==='تم التسليم'){
          sigBtn.textContent = '🖊️ توقيع العميل';
          sigBtn.onclick = function(){ openSignatureModal(o.id); };
        } else {
          return;
        }
        btnRow.appendChild(sigBtn);
      });
      return r;
    };
  }
})();
