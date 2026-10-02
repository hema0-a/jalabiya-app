/* device-features.js - نسخة مبسطة */
(function(){
  if(window.__deviceFeaturesLoaded) return;
  window.__deviceFeaturesLoaded = true;
  
  console.log('📲 تحميل device-features.js...');
  
  var SOUND_KEY = 'jalaba_sounds_enabled';
  
  function soundsEnabled(){
    return localStorage.getItem(SOUND_KEY) === '1';
  }
  
  function setSoundsEnabled(v){
    localStorage.setItem(SOUND_KEY, v ? '1' : '0');
  }
  
  var audioCtx = null;
  
  function getCtx(){
    if(!audioCtx){
      try{
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }catch(e){ return null; }
    }
    return audioCtx;
  }
  
  function playTone(freq, dur, type, vol){
    var ctx = getCtx();
    if(!ctx) return;
    try{
      if(ctx.state === 'suspended') ctx.resume();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    }catch(e){}
  }
  
  function playScissors(){ 
    if(!soundsEnabled()) return; 
    playTone(2800, 0.06, 'triangle', 0.08); 
    setTimeout(function(){ playTone(2400, 0.04, 'triangle', 0.06); }, 30); 
  }
  
  function playCoin(){ 
    if(!soundsEnabled()) return; 
    playTone(1318, 0.08, 'sine', 0.12); 
    setTimeout(function(){ playTone(1760, 0.15, 'sine', 0.1); }, 60); 
  }
  
  function playApplause(){ 
    if(!soundsEnabled()) return; 
    playTone(523, 0.1, 'sine', 0.1); 
    setTimeout(function(){ playTone(659, 0.1, 'sine', 0.1); }, 80); 
    setTimeout(function(){ playTone(784, 0.1, 'sine', 0.1); }, 160); 
    setTimeout(function(){ playTone(1046, 0.2, 'sine', 0.12); }, 240); 
  }
  
  function playSuccess(){ 
    if(!soundsEnabled()) return; 
    playTone(880, 0.08, 'sine', 0.08); 
    setTimeout(function(){ playTone(1320, 0.12, 'sine', 0.08); }, 60); 
  }
  
  window.testSound = function(type){
    var was = soundsEnabled();
    if(!was) setSoundsEnabled(true);
    if(type === 'scissors') playScissors();
    else if(type === 'coin') playCoin();
    else if(type === 'applause') playApplause();
    else playSuccess();
    if(!was) setTimeout(function(){ setSoundsEnabled(false); }, 800);
  };
  
  window.toggleWorkshopSounds = function(enabled){
    setSoundsEnabled(enabled);
    if(typeof window.toast === 'function'){
      window.toast(enabled ? '🔊 الأصوات مفعّلة' : '🔇 الأصوات معطّلة');
    }
    // أعد تحميل البطاقة
    var old = document.getElementById('deviceFeaturesCard');
    if(old) old.remove();
    setTimeout(addCard, 200);
  };
  
  // ═══ ربط الأصوات ═══
  function wrapWithSound(name, soundFn){
    if(typeof window[name] !== 'function') return;
    if(window[name].__soundWrapped) return;
    var orig = window[name];
    window[name] = async function(){
      var r = await Promise.resolve(orig.apply(this, arguments));
      try{ soundFn(); }catch(e){}
      return r;
    };
    window[name].__soundWrapped = true;
  }
  
  function activateSounds(){
    wrapWithSound('saveOrder', playScissors);
    wrapWithSound('saveCustomer', playSuccess);
    wrapWithSound('savePayment', playCoin);
    wrapWithSound('markOrderDelivered', playApplause);
    console.log('🔊 تم ربط الأصوات');
  }
  
  // ═══ البطاقة ═══
  function addCard(){
    var page = document.getElementById('page-settings');
    if(!page){
      console.log('⚠️ صفحة الإعدادات غير موجودة');
      return;
    }
    
    // إذا كانت البطاقة موجودة، اخرج
    if(document.getElementById('deviceFeaturesCard')){
      console.log('ℹ️ البطاقة موجودة');
      return;
    }
    
    var soundsOn = soundsEnabled();
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'deviceFeaturesCard';
    
    var html = '<h3>📱 ميزات الجهاز</h3>';
    html += '<div style="background:var(--card-alt);padding:12px;border-radius:10px;">';
    html += '<div style="font-weight:700;margin-bottom:6px;">🔊 أصوات الورشة</div>';
    html += '<div class="meta" style="margin-bottom:10px;">أصوات خفيفة عند العمليات (اختياري).</div>';
    html += '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 0;">';
    html += '<input type="checkbox" id="soundEnabledToggle" ' + (soundsOn ? 'checked' : '');
    html += ' onchange="toggleWorkshopSounds(this.checked)" style="width:20px;height:20px;">';
    html += '<div style="flex:1;">';
    html += '<div style="font-size:13px;font-weight:700;">🔊 تفعيل الأصوات</div>';
    html += '<div class="meta" style="font-size:11px;">صوت خفيف عند كل عملية</div>';
    html += '</div></label>';
    
    if(soundsOn){
      html += '<div style="margin-top:10px;">';
      html += '<div class="meta" style="margin-bottom:6px;">🔔 اختبار الأصوات:</div>';
      html += '<div class="btn-row">';
      html += '<button class="btn sm outline" onclick="testSound(\'scissors\')">✂️ قص خيط</button>';
      html += '<button class="btn sm outline" onclick="testSound(\'coin\')">💰 عملة</button>';
      html += '<button class="btn sm outline" onclick="testSound(\'applause\')">👏 تصفيق</button>';
      html += '</div></div>';
    }
    
    html += '</div>';
    card.innerHTML = html;
    
    page.appendChild(card);
    console.log('✅ تمت إضافة بطاقة ميزات الجهاز');
  }
  
  // ═══ المراقبة المستمرة ═══
  // بدل الاعتماد على renderSettings، راقب DOM
  function watchForSettings(){
    var observer = new MutationObserver(function(){
      var page = document.getElementById('page-settings');
      if(page && page.classList.contains('active')){
        setTimeout(addCard, 300);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }
  
  // أضف عند الفتح الأول
  window.addEventListener('load', function(){
    setTimeout(function(){
      addCard();
      watchForSettings();
      activateSounds();
    }, 3000);
  });
  
  console.log('✅ device-features.js جاهز');
})();
