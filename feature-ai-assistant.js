/* ============================================================
   ملف رقعة جديد منفصل: مساعد ذكي بالذكاء الاصطناعي
   بيتحمل آخر واحد عشان يفضل بعد كل دوال البرنامج متاحة.

   الميزة: مساعد ذكي بيفهم بيانات الورشة وبيجاوب على أسئلة
   صاحب الورشة بالعربي المصري. بيقرأ بيانات الطلبات والعملاء
   والمالية وبيحللها ويعطي ردود مفيده.

   بيشتغل عن طريق:
   - زرار عائم في كل الصفحات بيفتح نافذة الدردشة
   - إعدادات في صفحة الإعدادات لربط مفتاح OpenAI
   - كل البيانات بتتبعت للسيرفر (edge function) بشكل آمن
   ============================================================ */
(function(){
  if(window.__aiAssistantLoaded) return;
  window.__aiAssistantLoaded = true;

  /* ============================================================
     تخزين رسائل الدردشة + حالة المساعد
     ============================================================ */
  var chatHistory = [];
  var isSending = false;

  /* ============================================================
     جمع بيانات الورشة لإرسالها للمساعد
     ============================================================ */
  function collectWorkshopData(){
    return {
      workshopName: db.workshopName || 'ورشة تفصيل الجلابيب',
      customers: db.customers || [],
      orders: db.orders || [],
      expenses: db.expenses || [],
      payments: db.payments || [],
      dailyCapacity: db.dailyCapacity || 500,
      garmentTypes: db.garmentTypes || []
    };
  }

  /* ============================================================
     استدعاء الـ edge function
     ============================================================ */
  async function callAIAssistant(userMessage){
    var SUPABASE_URL = (window.__SUPABASE_URL || '');
    var SUPABASE_ANON_KEY = (window.__SUPABASE_ANON_KEY || '');
    var apiKey = (db.aiApiKey || '').trim();

    if(!SUPABASE_URL || !SUPABASE_ANON_KEY){
      throw new Error('إعدادات Supabase مش متظبطة');
    }

    if(!apiKey){
      throw new Error('مفتاح OpenAI مش متظبط. ضعه من الإعدادات → المساعد الذكي');
    }

    var apiUrl = SUPABASE_URL + '/functions/v1/ai-assistant';

    var newMessages = chatHistory.concat([{role:'user', content:userMessage}]);

    var response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        messages: newMessages,
        workshopData: collectWorkshopData(),
        apiKey: apiKey
      })
    });

    if(!response.ok){
      var errBody = {};
      try{ errBody = await response.json(); }catch(e){}
      throw new Error(errBody.error || ('فشل الاتصال ('+response.status+')'));
    }

    var data = await response.json();
    if(!data || !data.reply){
      throw new Error('رد غير صحيح من المساعد');
    }

    return data.reply;
  }

  /* ============================================================
     بناء واجهة الدردشة
     ============================================================ */
  function ensureAssistantButton(){
    if(document.getElementById('aiAssistantFab')) return;
    var btn = document.createElement('button');
    btn.id = 'aiAssistantFab';
    btn.className = 'ai-assistant-fab';
    btn.innerHTML = '🤖';
    btn.setAttribute('aria-label', 'المساعد الذكي');
    btn.addEventListener('click', function(){ openAssistantModal(); });
    document.getElementById('app').appendChild(btn);
  }

  function buildWelcomeMessage(){
    return 'أهلاً! أنا مساعدك الذكي 🤖\n'+
      'اسألني أي حاجة عن ورشتك، زي:\n'+
      '• مين أعلى عميل مديونية؟\n'+
      '• كم طلب متأخر عن موعد التسليم؟\n'+
      '• إيه إجمالي الإيرادات ده الشهر؟\n'+
      '• أي نوع جلابية الأكثر طلباً؟\n'+
      '• اقترحلي مواعيد تسليم للطلبات الجديدة';
  }

  function getSuggestionChips(){
    return [
      'مين أعلى عميل مديونية؟',
      'كم طلب متأخر؟',
      'إيه حالة الورشة النهاردة؟',
      'أكتر نوع جلابية مطلوب؟',
      'إيه إجمالي الإيرادات؟',
      'اقترحلي أعمل إيه النهاردة'
    ];
  }

  function openAssistantModal(){
    var messagesHtml = '';
    if(chatHistory.length === 0){
      messagesHtml = '<div class="ai-msg assistant">'+escapeHtml(buildWelcomeMessage()).replace(/\n/g,'<br>')+'</div>';
    } else {
      messagesHtml = chatHistory.map(function(m){
        var cls = m.role === 'user' ? 'user' : 'assistant';
        return '<div class="ai-msg '+cls+'">'+escapeHtml(m.content).replace(/\n/g,'<br>')+'</div>';
      }).join('');
    }

    var chipsHtml = getSuggestionChips().map(function(s){
      return '<button class="ai-suggestion-chip" onclick="sendAssistantMessage(\''+s.replace(/'/g,"\\'")+'\')">'+escapeHtml(s)+'</button>';
    }).join('');

    openModal(
      '<div class="modal-head"><h3>🤖 المساعد الذكي</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'+
      '<div id="aiChatMessages" class="ai-chat-messages">'+messagesHtml+'</div>'+
      '<div class="ai-suggestions">'+chipsHtml+'</div>'+
      '<div class="ai-input-wrap">'+
        '<input type="text" id="aiChatInput" placeholder="اكتب سؤالك هنا..." autocomplete="off">'+
        '<button id="aiSendBtn" class="btn accent" onclick="sendAssistantMessageFromInput()">➤</button>'+
      '</div>'
    );

    setTimeout(function(){
      scrollChatToBottom();
      var input = document.getElementById('aiChatInput');
      if(input){
        input.addEventListener('keydown', function(e){
          if(e.key === 'Enter' && !e.shiftKey){
            e.preventDefault();
            sendAssistantMessageFromInput();
          }
        });
        input.focus();
      }
    }, 100);
  }

  function scrollChatToBottom(){
    var box = document.getElementById('aiChatMessages');
    if(box) box.scrollTop = box.scrollHeight;
  }

  function appendMessage(role, content){
    var box = document.getElementById('aiChatMessages');
    if(!box) return;
    var div = document.createElement('div');
    div.className = 'ai-msg ' + (role === 'user' ? 'user' : 'assistant');
    div.innerHTML = escapeHtml(content).replace(/\n/g,'<br>');
    box.appendChild(div);
    scrollChatToBottom();
  }

  function appendTypingIndicator(){
    var box = document.getElementById('aiChatMessages');
    if(!box) return null;
    var div = document.createElement('div');
    div.className = 'ai-msg assistant ai-typing';
    div.id = 'aiTypingIndicator';
    div.innerHTML = '<span class="ai-typing-dot"></span><span class="ai-typing-dot"></span><span class="ai-typing-dot"></span>';
    box.appendChild(div);
    scrollChatToBottom();
    return div;
  }

  function removeTypingIndicator(){
    var el = document.getElementById('aiTypingIndicator');
    if(el) el.remove();
  }

  function setInputEnabled(enabled){
    var input = document.getElementById('aiChatInput');
    var btn = document.getElementById('aiSendBtn');
    if(input){
      input.disabled = !enabled;
      if(enabled) input.focus();
    }
    if(btn){
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? '1' : '0.5';
    }
  }

  /* ============================================================
     إرسال الرسائل
     ============================================================ */
  window.sendAssistantMessageFromInput = function(){
    var input = document.getElementById('aiChatInput');
    if(!input) return;
    var text = input.value.trim();
    if(!text || isSending) return;
    input.value = '';
    sendAssistantMessage(text);
  };

  window.sendAssistantMessage = async function(text){
    if(isSending) return;
    if(!text || !text.trim()) return;
    text = text.trim();

    // إظهار رسالة المستخدم
    appendMessage('user', text);
    chatHistory.push({role:'user', content:text});

    // حالة الإرسال
    isSending = true;
    setInputEnabled(false);
    appendTypingIndicator();

    try{
      var reply = await callAIAssistant(text);
      removeTypingIndicator();
      appendMessage('assistant', reply);
      chatHistory.push({role:'assistant', content:reply});
    }catch(err){
      removeTypingIndicator();
      var errMsg = '⚠️ '+escapeHtml(err.message || 'حصل خطأ غير متوقع');
      appendMessage('assistant', errMsg);
      // مش بنضيف رسالة الخطأ للتاريخ عشان نتجنب إرسالها للمساعد تاني
    }finally{
      isSending = false;
      setInputEnabled(true);
    }
  };

  /* ============================================================
     مسح المحادثة
     ============================================================ */
  window.clearAssistantChat = function(){
    chatHistory = [];
    if(document.getElementById('aiChatMessages')){
      openAssistantModal(); // إعادة فتح النافذة برسالة الترحيب
    }
  };

  /* ============================================================
     إضافة الزر العائم عند تشغيل التطبيق
     ============================================================ */
  var origBootAI = boot;
  boot = function(){
    origBootAI.apply(this, arguments);
    setTimeout(function(){
      ensureAssistantButton();
    }, 500);
  };

  /* ============================================================
     بطاقة إعدادات المساعد في صفحة الإعدادات
     ============================================================ */
  function ensureSupabaseEnv(){
    // متغيرات Supabase بتتعمل inline في index.html قبل الملف ده
    // فمش محتاجين نعمل أي حاجة هنا — بس بنسيب الدالة للتوافق
  }

  function renderAssistantSettingsCard(){
    ensureSupabaseEnv();
    var anchor = document.getElementById('aboutCard') || document.getElementById('cloudSyncCardWrap');
    if(!anchor){
      // fallback: آخر كارت في الإعدادات
      var cards = document.querySelectorAll('#page-settings > .card');
      anchor = cards[cards.length - 1];
    }
    if(!anchor) return;
    if(document.getElementById('aiAssistantSettingsCard')) return;

    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'aiAssistantSettingsCard';
    card.innerHTML =
      '<h3>🤖 المساعد الذكي</h3>'+
      '<p class="meta">مساعد ذكي بيفهم بيانات ورشتك وبيجاوب على أسئلتك بالعربي المصري. بيحلل الطلبات والعملاء والمالية ويعطيك ردود مفيده فورًا.</p>'+
      '<div class="alert-banner warn" style="margin-bottom:10px;">'+
        '<span class="ic">📌</span>'+
        '<div>'+
          '<b>إعداد مرة واحدة بس</b>'+
          'المساعد الذكي محتاج مفتاح OpenAI API عشان يشتغل. تلاقي المفتاح من platform.openai.com ← API Keys. المفتاح بيتبعت بشكل آمن لسيرفر المساعد مع كل سؤال.'+
        '</div>'+
      '</div>'+
      '<div class="field">'+
        '<label>مفتاح OpenAI API</label>'+
        '<input id="aiApiKeyInput" type="password" placeholder="sk-..." style="direction:ltr;text-align:left;font-size:12px;" value="'+(db.aiApiKey?db.aiApiKey.replace(/"/g,'&quot;'):'')+'">'+
        '<p class="meta" style="margin-top:4px;font-size:11px;">تلاقي المفتاح من: platform.openai.com ← API Keys</p>'+
      '</div>'+
      '<button class="btn" onclick="saveAIApiKey()">💾 حفظ المفتاح وتفعيل المساعد</button>'+
      '<div id="aiAssistantStatus" style="margin-top:10px;"></div>';

    anchor.insertAdjacentElement('afterend', card);
    renderAssistantStatus();
  }

  function renderAssistantStatus(){
    var box = document.getElementById('aiAssistantStatus');
    if(!box) return;
    var hasKey = !!(db.aiApiKey && db.aiApiKey.trim());
    if(hasKey){
      box.innerHTML = '<p class="meta" style="color:var(--ok);">✅ المساعد الذكي مفعّل وجاهز للاستخدام</p>'+
        '<button class="btn sm outline" style="margin-top:6px;" onclick="clearAssistantChat()">🗑️ مسح المحادثة</button>';
    } else {
      box.innerHTML = '<p class="meta" style="color:var(--warn);">⏳ المساعد الذكي لسه مش مفعّل — ضع مفتاح OpenAI فوق واضغط حفظ</p>';
    }
  }

  window.saveAIApiKey = async function(){
    var input = document.getElementById('aiApiKeyInput');
    if(!input) return;
    var key = input.value.trim();
    if(!key){
      toast('الصق مفتاح OpenAI الأول');
      return;
    }
    if(!key.startsWith('sk-')){
      toast('المفتاح لازم يبدأ بـ sk-');
      return;
    }

    // تخزين المفتاح محليًا (هيتتبعت للسيرفر عند كل استدعاء)
    db.aiApiKey = key;
    saveDB();

    // محاولة تعيين المفتاح كـ secret على Supabase
    try{
      var SUPABASE_URL = window.__SUPABASE_URL || '';
      var SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY || '';
      if(SUPABASE_URL && SUPABASE_ANON_KEY){
        // لا يمكن تعيين secrets من الـ frontend بشكل مباشر — لازم يتم يدويًا
        // لكن المساعد لسه هيشتغل لو المفتاح متخزن على السيرفر
      }
    }catch(e){}

    renderAssistantStatus();
    toast('✅ تم حفظ المفتاح. المساعد الذكي جاهز!');
  };

  /* ============================================================
     تفعيل متغيرات Supabase تلقائيًا
     ============================================================ */
  // متغيرات Supabase بتتعمل inline في index.html قبل الملف ده مباشرة
  // (window.__SUPABASE_URL و window.__SUPABASE_ANON_KEY)
  // فمش محتاجين نقراها من أي مكان تاني

  /* ============================================================
     ربط بطاقة الإعدادات بصفحة الإعدادات
     ============================================================ */
  var origRenderSettingsAI = renderSettings;
  renderSettings = function(){
    origRenderSettingsAI.apply(this, arguments);
    setTimeout(function(){
      renderAssistantSettingsCard();
    }, 50);
  };

})();
