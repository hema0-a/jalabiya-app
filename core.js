
/* ============================================================
   ورشة تفصيل الجلابيب - إدارة كاملة بـ localStorage
   ============================================================ */

const STORAGE_KEY = 'jalaba_db_v1';
let db = null;

function defaultDB(){
  return {
    password:'0000',
    customers:[],
    orders:[],
    payments:[],
    expenses:[],
    dailyCapacity:500,
    garmentTypes:[],
    vipThreshold:3,
    idleLockMinutes:3,
    debtThreshold:2000,
    lastBackupDate:null,
    dayOffWeekday:0,
    workshopName:'ورشة تفصيل الجلابيب',
    ownerName:'',
    ownerPhone:'',
    workshopAddress:'',
    workshopLogo:null,
    theme:{primary:'#1F6D57', primaryDark:'#123C2F', accent:'#B8863B', bg:'#F6F1E6'},
    invoiceCustom:{},
    btnRadius:12,
    fontSettings:{family:'default', size:'1'},
    skeletonLoading:false,
    homeWidgets:['alerts','stats','weekly','today','commitment','upcoming','late'].map(id=>({id, visible:true})),
    wideMode:false,
    customCSS:'',
    customJS:'',
    darkMode:false,
    workStartHour:9,
    workEndHour:18,
    queueManualOrder:[],
    trash:[],
    nextInvoiceNumber:1001,
    taxDefaultPercent:0,
    holidays:[],
    activityLog:[],
    updatedAt: 0,
    cloudSync: {enabled:false, syncId:null, firebaseConfig:null},
    pushNotify: {vapidKey:null, daysBefore:1, deviceTokens:[], notifiedOrderIds:[]}
  };
}

/* فتح رابط خارجي (واتساب، إلخ) — بعض تطبيقات WebView (زي WebIntoApp)
   تمنع النوافذ المنبثقة الجديدة، فبيفشل window.open() بصمت.
   هنا بنجرب window.open ولو فشل أو رجع null بنستخدم location.href
   بدل منه عشان يتم تمرير الرابط لتطبيق واتساب/المتصفح مباشرة. */
function openExternalLink(url){
  let win = null;
  try{ win = window.open(url, '_blank'); }catch(e){ win = null; }
  if(!win){
    try{ location.href = url; }catch(e){ /* تجاهل */ }
  }
}

/* بيفتح شات عميل معين بالتحديد في تطبيق واتساب نفسه (مش رابط wa.me بس).
   رابط wa.me أحيانًا بيتفتح كصفحة ويب عادية جوه الـ WebView (فبيوديك لصفحة
   واتساب العامة وتضطر تدور على العميل)، لكن سكيم "whatsapp://" هو رابط
   التطبيق المباشر، وده اللي بتطبيقات تغليف الـ WebView (زي WebIntoApp)
   بتلقفه وتحوّله لفتح تطبيق واتساب نفسه على نفس الشات بالظبط.
   لو السكيم مش مدعوم لأي سبب، بعد لحظة بسيطة (لو الصفحة لسه ظاهرة يعني
   محصلش تنقّل لتطبيق تاني) بنرجع لرابط wa.me العادي كخطة بديلة. */
function openWhatsAppChat(phone, text){
  const encoded = text ? encodeURIComponent(text) : '';
  const textParam = text ? `&text=${encoded}` : '';
  const textParamOnly = text ? `?text=${encoded}` : '';
  const waScheme = phone ? `whatsapp://send?phone=${phone}${textParam}` : `whatsapp://send${textParamOnly}`;
  const waWeb = phone ? `https://wa.me/${phone}${text?`?text=${encoded}`:''}` : `https://wa.me/${textParamOnly}`;
  let fallbackDone = false;
  const tryFallback = ()=>{
    if(fallbackDone) return;
    fallbackDone = true;
    if(!document.hidden) openExternalLink(waWeb);
  };
  document.addEventListener('visibilitychange', function onVis(){
    if(document.hidden){ fallbackDone = true; document.removeEventListener('visibilitychange', onVis); }
  });
  setTimeout(tryFallback, 1200);
  openExternalLink(waScheme);
}

/* حفظ/مشاركة ملف (نسخة احتياطية، CSV، HTML...) — بعض تطبيقات WebView
   (زي WebIntoApp) لا تدعم تنزيل ملفات blob: بصمت من غير أي رسالة خطأ.
   هنا بنجرب أولاً مشاركة الملف عبر واجهة المشاركة الأصلية بالجهاز
   (بتفتح خيارات حفظ في الملفات/إرسال واتساب...إلخ)، ولو مش مدعومة
   بنرجع للطريقة العادية (رابط تنزيل)، ولو فشلت كمان بنطلع رسالة واضحة. */
async function saveOrShareFile(blob, filename){
  try{
    const file = new File([blob], filename, {type: blob.type});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title: filename});
      return true;
    }
  }catch(e){ /* نكمل للطريقة العادية */ }
  try{
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 60000);
    return true;
  }catch(e){
    toast('تعذر حفظ الملف. جرّب فتح التطبيق من متصفح Chrome بدل نافذة المعاينة');
    return false;
  }
}

function loadDB(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      db = JSON.parse(raw);
      if(!db.password) db.password = '0000';
      if(!db.customers) db.customers=[];
      if(!db.orders) db.orders=[];
      if(!db.payments) db.payments=[];
      if(!db.expenses) db.expenses=[];
      if(!db.dailyCapacity) db.dailyCapacity=500;
      if(!db.garmentTypes) db.garmentTypes=[];
      if(!db.vipThreshold) db.vipThreshold=3;
      if(!db.idleLockMinutes) db.idleLockMinutes=3;
      if(!db.debtThreshold) db.debtThreshold=2000;
      if(db.lastBackupDate===undefined) db.lastBackupDate=null;
      if(db.dayOffWeekday===undefined || db.dayOffWeekday===null) db.dayOffWeekday=0;
      if(!db.workshopName) db.workshopName='ورشة تفصيل الجلابيب';
      if(db.ownerName===undefined) db.ownerName='';
      if(db.ownerPhone===undefined) db.ownerPhone='';
      if(db.workshopAddress===undefined) db.workshopAddress='';
      if(db.workshopLogo===undefined) db.workshopLogo=null;
      if(!db.theme) db.theme={primary:'#1F6D57', primaryDark:'#123C2F', accent:'#B8863B', bg:'#F6F1E6'};
      if(!db.invoiceCustom) db.invoiceCustom={};
      if(!db.btnRadius) db.btnRadius=12;
      if(db.customCSS===undefined) db.customCSS='';
      if(db.customJS===undefined) db.customJS='';
      if(db.darkMode===undefined) db.darkMode=false;
      if(!db.workStartHour) db.workStartHour=9;
      if(!db.workEndHour) db.workEndHour=18;
      if(!db.queueManualOrder) db.queueManualOrder=[];
      if(!db.trash) db.trash=[];
      if(!db.nextInvoiceNumber) db.nextInvoiceNumber=1001;
      if(db.taxDefaultPercent===undefined || db.taxDefaultPercent===null) db.taxDefaultPercent=0;
      if(!db.holidays) db.holidays=[];
      if(!db.activityLog) db.activityLog=[];
      if(db.updatedAt===undefined) db.updatedAt=0;
      if(!db.cloudSync) db.cloudSync={enabled:false, syncId:null, firebaseConfig:null};
      if(!db.pushNotify) db.pushNotify={vapidKey:null, daysBefore:1, deviceTokens:[], notifiedOrderIds:[]};
      if(!Array.isArray(db.pushNotify.deviceTokens)) db.pushNotify.deviceTokens=[];
      if(!Array.isArray(db.pushNotify.notifiedOrderIds)) db.pushNotify.notifiedOrderIds=[];
      if(!db.pushNotify.daysBefore) db.pushNotify.daysBefore=1;
      purgeOldTrash();
    } else {
      db = defaultDB();
      saveDB();
    }
  }catch(e){
    db = defaultDB();
    saveDB();
  }
}

function saveDB(){
  try{
    db.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }catch(e){
    console.warn('تعذر حفظ البيانات محليًا (وضع التصفح الخاص أو متصفح مقيّد):', e);
  }
  // البيانات دايمًا بتتحفظ محليًا فورًا (شغل كامل بدون إنترنت)، والمزامنة السحابية
  // (لو مفعّلة) بتحصل لما يبقى فيه اتصال — لحد ما تنجح، التغيير فضل "معلّق"
  if(db.cloudSync && db.cloudSync.enabled) cloudPendingChanges = true;
  scheduleCloudPush();
  if(typeof window.refreshConnectivityBadge==='function') window.refreshConnectivityBadge();
}

/* ============================================================
   المزامنة السحابية بين الأجهزة (Firebase Firestore)
   ============================================================
   الفكرة: نسخة db بالكامل بتتخزن في مستند واحد على Firestore
   باسم (رمز المزامنة). أي جهاز عارف نفس الرمز ونفس إعدادات
   مشروع Firebase بيقدر يقرأ ويكتب على نفس المستند، فبيبقى
   شغال زي مساحة تخزين مشتركة بين الموبايل والويندوز.
   لما فيه تعارض (تعديل في نفس الوقت من جهازين وهما أوفلاين)،
   بناخد بأحدث تعديل (updatedAt الأكبر) — "آخر تعديل بيكسب".
   ============================================================ */
let cloudApp = null;
let cloudDb = null;
let cloudUnsub = null;
let cloudPushTimer = null;
let cloudApplyingRemote = false; // true أثناء ما بنطبق تحديث جاي من السحابة، عشان منعملش لوب (نستقبل ونرجع نبعت)
let cloudStatus = 'off'; // off | connecting | online | error
let cloudPendingChanges = false; // true من وقت آخر تعديل لحد ما ينجح الرفع للسحابة
// true بس بعد ما نستلم أول رد فعلي من السحابة (onSnapshot) لجلسة الاتصال الحالية —
// سواء "فيه مستند وده اللي جواه" أو "المستند مش موجود لسه". قبل كده ممنوع منعًا باتًا
// أي رفع (push) للسحابة، حتى لو saveDB اتنادت، عشان منكررش كارثة إن بيانات محلية
// فاضية أو قديمة تكسب سباق ضد التحميل الحقيقي وتكتب فوق بيانات المستخدم الحقيقية.
let cloudInitialSyncDone = false;
let cloudPushWaitRetries = 0; // عداد أمان لمنع لوب لا نهائي لو الاتصال بالسحابة فشل باستمرار

function cloudStatusChanged(){
  const el = document.getElementById('cloudSyncStatusBadge');
  if(el) renderCloudSyncStatusBadge();
}

// يبعت نسخة db الحالية للسحابة بعد فترة هدوء قصيرة من آخر تعديل (عشان منبعتش مع كل ضغطة زرار)
function scheduleCloudPush(){
  if(!db || !db.cloudSync || !db.cloudSync.enabled || !cloudDb || cloudApplyingRemote) return;
  clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(pushToCloud, 900);
}

async function pushToCloud(){
  if(!cloudDb || !db.cloudSync || !db.cloudSync.syncId) return;
  if(!cloudInitialSyncDone){
    // لسه ما استلمناش تأكيد حقيقي من السحابة عن الحالة الحالية للمستند
    // (سواء فيه بيانات، أو المستند مش موجود لسه). الرفع في اللحظة دي خطر —
    // ممكن يكتب بيانات محلية فاضية/قديمة فوق بيانات حقيقية على السحابة.
    // بدل ما نرفع بعمى، بنأجل ونحاول تاني بعد شوية لحد ما يوصل أول snapshot حقيقي.
    if(cloudPushWaitRetries > 20){
      // اتأخرنا أكتر من كفاية (فيه مشكلة اتصال مستمرة) — بنوقف المحاولة دلوقتي
      // بدل ما نلف لوب لا نهائي؛ أي تعديل جديد (saveDB) هيعيد المحاولة تلقائي
      cloudStatusChanged();
      return;
    }
    cloudPushWaitRetries++;
    clearTimeout(cloudPushTimer);
    cloudPushTimer = setTimeout(pushToCloud, 400);
    return;
  }
  cloudPushWaitRetries = 0;
  if(!navigator.onLine){
    // محدش نت دلوقتي — نسيب التغيير معلّق، هيتبعت تلقائي أول ما الاتصال يرجع (حدث 'online')
    cloudStatusChanged();
    return;
  }
  try{
    // Firestore بيرفض قيم undefined كقيمة لحقل (زي qty/unitPrice القديمة اللي بنمسحها عند التعديل)،
    // فبنعمل نسخة "نضيفة" عن طريق JSON round-trip اللي بيشيل أي مفتاح قيمته undefined تلقائيًا
    const safeData = JSON.parse(JSON.stringify(db));
    await cloudDb.collection('workshops').doc(db.cloudSync.syncId).set(safeData);
    cloudStatus='online';
    cloudPendingChanges = false;
  }catch(e){
    console.warn('فشل رفع البيانات للسحابة:', e);
    cloudStatus='error';
  }
  cloudStatusChanged();
}

// يبني رابطة Firebase من إعدادات المشروع المحفوظة، ويشترك في تحديثات المستند لحظيًا
function initCloudSync(){
  if(!db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.firebaseConfig || !db.cloudSync.syncId){
    cloudStatus='off';
    cloudStatusChanged();
    return;
  }
  // كل محاولة اتصال (بما فيها إعادة الاتصال) لازم تستنى تأكيد جديد من السحابة
  // قبل ما تسمح بأي رفع — منع الكارثة مش مقصور بس على أول ربط
  cloudInitialSyncDone = false;
  cloudPushWaitRetries = 0;
  try{
    cloudStatus='connecting';
    cloudStatusChanged();
    cloudApp = firebase.apps && firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(db.cloudSync.firebaseConfig);
    cloudDb = firebase.firestore();
    try{ cloudDb.enablePersistence({synchronizeTabs:true}).catch(()=>{}); }catch(e){ /* تجاهل لو مش مدعومة */ }
    if(cloudUnsub) cloudUnsub();
    cloudUnsub = cloudDb.collection('workshops').doc(db.cloudSync.syncId).onSnapshot(
      snap=>{
        cloudStatus='online';
        if(!snap.exists){ cloudInitialSyncDone = true; cloudStatusChanged(); return; }
        const remote = snap.data();
        if(!remote || typeof remote.updatedAt!=='number'){ cloudInitialSyncDone = true; cloudStatusChanged(); return; }
        if(remote.updatedAt > (Number(db.updatedAt)||0)){
          cloudApplyingRemote = true;
          const myCloudSettings = db.cloudSync; // نحافظ على إعدادات الاتصال بتاعت الجهاز ده بالذات
          db = remote;
          db.cloudSync = myCloudSettings;
          fillMissingDefaults();
          try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }catch(e){}
          renderAll();
          try{ applyWorkshopBranding(); applyTheme(); applyFontSettings(); applyWideMode(); applyDarkMode(); applyCustomCSS(); applyHomeWidgetsLayout(); }catch(e){}
          cloudApplyingRemote = false;
        }
        // دلوقتي مؤكد إن db المحلية (سواء فضلت زي ما هي أو اتحدثت من فوق) متزامنة
        // فعليًا مع آخر حالة معروفة من السحابة — آمن نسمح بالرفع بعد كده
        cloudInitialSyncDone = true;
        cloudStatusChanged();
      },
      err=>{
        console.warn('خطأ في المزامنة السحابية:', err);
        cloudStatus='error';
        cloudStatusChanged();
      }
    );
  }catch(e){
    console.warn('تعذر تفعيل المزامنة السحابية:', e);
    cloudStatus='error';
    cloudStatusChanged();
  }
}

// يعيد ملء أي حقل ناقص في db (لو جاي من مستند سحابي أقدم من نسخة التطبيق الحالية) بنفس منطق loadDB
function fillMissingDefaults(){
  const d = defaultDB();
  Object.keys(d).forEach(k=>{
    if(db[k]===undefined) db[k] = d[k];
  });
  if(!db.theme) db.theme = d.theme;
  if(!db.pushNotify) db.pushNotify = d.pushNotify;
  if(!Array.isArray(db.pushNotify.deviceTokens)) db.pushNotify.deviceTokens=[];
  if(!Array.isArray(db.pushNotify.notifiedOrderIds)) db.pushNotify.notifiedOrderIds=[];
}

function randomSyncId(){
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s='';
  for(let i=0;i<28;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

// الجهاز الأول: ينشئ مساحة مزامنة جديدة على مشروع Firebase الخاص بصاحب الورشة
async function createCloudSyncSpace(){
  const raw = document.getElementById('firebaseConfigInput').value.trim();
  if(!raw){ toast('الصق إعدادات مشروع Firebase أولاً'); return; }
  let cfg;
  try{ cfg = JSON.parse(raw); }catch(e){ toast('صيغة إعدادات Firebase غير صحيحة — تأكد إنها JSON صحيح'); return; }
  if(!cfg.projectId || !cfg.apiKey){ toast('الإعدادات ناقصة — تأكد إنك نسخت كل الكود من Firebase'); return; }
  const syncId = randomSyncId();
  db.cloudSync = {enabled:true, syncId, firebaseConfig:cfg};
  saveDB();
  initCloudSync();
  setTimeout(pushToCloud, 500);
  renderSettings();
  toast('تم إنشاء مساحة المزامنة ✅ انسخ الرمز وحطه في الجهاز التاني');
}

// الجهاز الثاني: يتصل بمساحة مزامنة موجودة بالفعل عن طريق رمز الربط
async function connectCloudSyncSpace(){
  const code = document.getElementById('pairingCodeInput').value.trim();
  if(!code){ toast('الصق رمز الربط من الجهاز الأول'); return; }
  let parsed;
  try{ parsed = JSON.parse(atob(code)); }catch(e){ toast('رمز الربط غير صحيح'); return; }
  if(!parsed.syncId || !parsed.firebaseConfig){ toast('رمز الربط غير مكتمل'); return; }
  if(!await appConfirm('سيتم استبدال كل البيانات الحالية على هذا الجهاز ببيانات مساحة المزامنة. هل أنت متأكد؟')) return;
  db.cloudSync = {enabled:true, syncId:parsed.syncId, firebaseConfig:parsed.firebaseConfig};
  saveDB();
  // نصفّر الوقت المحلي عمداً (بعد saveDB اللي بيحدّثه) عشان نضمن إن أي نسخة موجودة
  // على السحابة، حتى لو أقدم، تتحمل بدل بيانات الجهاز ده — إحنا وافقنا على الاستبدال فوق
  db.updatedAt = 0;
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }catch(e){}
  initCloudSync();
  renderSettings();
  toast('جاري الاتصال وتحميل البيانات...');
}

function copyPairingCode(){
  if(!db.cloudSync || !db.cloudSync.syncId) return;
  const code = btoa(JSON.stringify({syncId:db.cloudSync.syncId, firebaseConfig:db.cloudSync.firebaseConfig}));
  const ta = document.createElement('textarea');
  ta.value = code;
  ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta);
  ta.select();
  try{ document.execCommand('copy'); toast('تم نسخ رمز الربط ✅ الصقه في الجهاز التاني'); }
  catch(e){ toast('تعذر النسخ التلقائي — انسخ الرمز يدويًا من المربع'); }
  ta.remove();
}

async function disconnectCloudSync(){
  if(!await appConfirm('هل تريد فصل المزامنة السحابية؟ بياناتك المحلية هتفضل موجودة، بس مش هتتحدث لحظيًا مع الجهاز التاني بعد كده.')) return;
  if(cloudUnsub){ cloudUnsub(); cloudUnsub=null; }
  db.cloudSync.enabled = false;
  cloudPendingChanges = false;
  saveDB();
  cloudStatus='off';
  renderSettings();
  toast('تم فصل المزامنة');
}

function renderCloudSyncStatusBadge(){
  const el = document.getElementById('cloudSyncStatusBadge');
  if(!el) return;
  const map = {
    off: ['⚪','غير مفعّلة','var(--muted)'],
    connecting: ['🟡','جاري الاتصال...','var(--warn, #B8863B)'],
    online: ['🟢','متصلة ومتزامنة','var(--ok)'],
    pending: ['🟡','في انتظار المزامنة — هيتزامن تلقائي أول ما الاتصال يرجع','var(--warn, #B8863B)'],
    error: ['🔴','خطأ في الاتصال — تحقق من الإنترنت والإعدادات','var(--danger)']
  };
  let status = cloudStatus;
  if(db && db.cloudSync && db.cloudSync.enabled && (!navigator.onLine || cloudPendingChanges)) status = 'pending';
  const [ic,label,color] = map[status]||map.off;
  el.innerHTML = `<span style="color:${color};font-weight:700;">${ic} ${label}</span>`;
}

// يبني كارت المزامنة السحابية بالكامل حسب حالة الاتصال الحالية (مش متصل / متصل)
function renderCloudSyncCard(){
  const box = document.getElementById('cloudSyncCardWrap');
  if(!box) return;
  const cs = db.cloudSync || {enabled:false, syncId:null, firebaseConfig:null};

  if(cs.enabled && cs.syncId){
    const pairingCode = btoa(JSON.stringify({syncId:cs.syncId, firebaseConfig:cs.firebaseConfig}));
    box.innerHTML = `
      <h3>☁️ المزامنة السحابية بين الأجهزة</h3>
      <p class="meta">الحالة: <span id="cloudSyncStatusBadge"></span></p>
      <p class="meta">📴 لو النت قطع، التطبيق يفضل شغال عادي وأي تعديل بيتحفظ عندك — وهيتزامن تلقائي أول ما الاتصال يرجع.</p>
      <p class="meta">لربط جهاز جديد (تاني موبايل أو جهاز ويندوز)، انسخ رمز الربط ده والصقه في نفس الصفحة على الجهاز التاني.</p>
      <div class="field"><label>رمز الربط</label><textarea id="pairingCodeOutput" rows="3" readonly style="font-size:11px;direction:ltr;text-align:left;">${pairingCode}</textarea></div>
      <div class="btn-row">
        <button class="btn secondary" onclick="copyPairingCode()">📋 نسخ رمز الربط</button>
        <button class="btn outline" onclick="pushToCloud()">🔄 مزامنة الآن</button>
      </div>
      <p class="meta" style="margin-top:10px;color:var(--danger);">⚠️ رمز الربط زي كلمة سر لبياناتك — متبعتوش إلا للجهاز اللي إنت شخصيًا هتربطه.</p>
      <button class="btn sm danger" style="margin-top:10px;" onclick="disconnectCloudSync()">🔌 فصل المزامنة عن هذا الجهاز</button>
    `;
    renderCloudSyncStatusBadge();
  } else {
    box.innerHTML = `
      <h3>☁️ المزامنة السحابية بين الأجهزة</h3>
      <p class="meta">تخلي بيانات الموبايل والويندوز (أو أي جهاز تاني) تتحدث تلقائيًا مع بعض لحظيًا عن طريق مشروع Firebase مجاني خاص بيك.</p>
      <p class="meta">📴 التطبيق شغال بالكامل حتى من غير إنترنت — أي تعديل بيتحفظ فورًا على جهازك، ولما الاتصال يرجع بيتزامن تلقائي مع باقي الأجهزة من غير ما تعمل حاجة.</p>
      <div class="field-row2" style="margin-top:10px;">
        <button class="btn secondary" onclick="toggleCloudSetupMode('create')">🆕 هذا أول جهاز (إنشاء مساحة مزامنة)</button>
        <button class="btn outline" onclick="toggleCloudSetupMode('connect')">🔗 عندي رمز ربط من جهاز تاني</button>
      </div>
      <div id="cloudSetupCreateBox" style="display:none;margin-top:12px;">
        <p class="meta">1) افتح <b>console.firebase.google.com</b> واعمل مشروع مجاني جديد.<br>
        2) فعّل <b>Firestore Database</b> من القايمة الجانبية (Start in production mode).<br>
        3) من إعدادات المشروع (⚙️ Project settings) → طوّل لتحت لحد "Your apps" → أضف تطبيق ويب (</>) → هيديك كود فيه Config، انسخه والصقه هنا بالكامل.</p>
        <div class="field"><label>إعدادات مشروع Firebase (Config)</label><textarea id="firebaseConfigInput" rows="5" placeholder='{"apiKey": "...", "projectId": "...", ...}' style="font-size:12px;direction:ltr;text-align:left;"></textarea></div>
        <button class="btn" onclick="createCloudSyncSpace()">✅ إنشاء مساحة المزامنة</button>
      </div>
      <div id="cloudSetupConnectBox" style="display:none;margin-top:12px;">
        <p class="meta">الصق رمز الربط اللي نسخته من الجهاز الأول (من نفس الصفحة دي عنده).</p>
        <div class="field"><label>رمز الربط</label><textarea id="pairingCodeInput" rows="3" placeholder="الصق الرمز هنا..." style="font-size:11px;direction:ltr;text-align:left;"></textarea></div>
        <button class="btn" onclick="connectCloudSyncSpace()">🔗 اتصال وتحميل البيانات</button>
      </div>
    `;
  }
}

function toggleCloudSetupMode(mode){
  const createBox = document.getElementById('cloudSetupCreateBox');
  const connectBox = document.getElementById('cloudSetupConnectBox');
  if(createBox) createBox.style.display = mode==='create' ? 'block':'none';
  if(connectBox) connectBox.style.display = mode==='connect' ? 'block':'none';
}

/* ============================================================
   الإشعارات الحقيقية (Firebase Cloud Messaging - Web Push)
   ============================================================
   بتستخدم نفس مشروع Firebase بتاع المزامنة السحابية. كل جهاز بيسجّل
   "توكن" خاص بيه بيتخزن جوه db.pushNotify.deviceTokens (وبالتالي
   بيتبعت للسحابة زي أي بيانات تانية). Cloud Function منفصلة (مرفقة
   في ملفات المشروع) هي اللي بتراجع الطلبات يوميًا وتبعت الإشعار
   الفعلي عن طريق FCM حتى لو التطبيق مقفول تمامًا.
   ============================================================ */
let messagingInstance = null;

function getPushSwUrl(){
  const cfg = db.cloudSync && db.cloudSync.firebaseConfig;
  if(!cfg) return null;
  const params = new URLSearchParams({
    apiKey: cfg.apiKey||'', authDomain: cfg.authDomain||'', projectId: cfg.projectId||'',
    storageBucket: cfg.storageBucket||'', messagingSenderId: cfg.messagingSenderId||'', appId: cfg.appId||''
  });
  return 'firebase-messaging-sw.js?'+params.toString();
}

async function enablePushNotifications(){
  try{
    if(!db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.firebaseConfig){
      toast('فعّل المزامنة السحابية الأول من الكارت اللي فوق');
      return;
    }
    const vapidInput = document.getElementById('vapidKeyInput');
    const vapidKey = vapidInput ? vapidInput.value.trim() : (db.pushNotify.vapidKey||'');
    if(!vapidKey){ toast('الصق مفتاح Web Push (VAPID) الأول — تلاقيه في Firebase Console'); return; }
    if(!('serviceWorker' in navigator) || typeof Notification==='undefined'){
      toast('المتصفح ده مش بيدعم الإشعارات الحقيقية');
      return;
    }
    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){ toast('لازم توافق على إذن الإشعارات من المتصفح عشان تشتغل'); return; }

    const swUrl = getPushSwUrl();
    const reg = await navigator.serviceWorker.register(swUrl);
    if(!cloudApp){
      cloudApp = (firebase.apps && firebase.apps.length) ? firebase.apps[0] : firebase.initializeApp(db.cloudSync.firebaseConfig);
    }
    messagingInstance = firebase.messaging();
    const token = await messagingInstance.getToken({vapidKey, serviceWorkerRegistration: reg});
    if(!token){ toast('تعذر الحصول على رمز الإشعارات — تأكد من مفتاح VAPID'); return; }

    db.pushNotify.vapidKey = vapidKey;
    if(!db.pushNotify.deviceTokens.includes(token)) db.pushNotify.deviceTokens.push(token);
    saveDB();
    renderPushNotifyCard();
    toast('✅ تفعّلت الإشعارات الحقيقية على هذا الجهاز');

    messagingInstance.onMessage(function(payload){
      const title = (payload.notification && payload.notification.title) || 'تنبيه';
      const body = (payload.notification && payload.notification.body) || '';
      toast('🔔 '+title+(body?(' — '+body):''));
    });
  }catch(e){
    console.warn('فشل تفعيل الإشعارات:', e);
    toast('حصل خطأ أثناء تفعيل الإشعارات: '+(e && e.message ? e.message : ''));
  }
}

function disablePushNotifications(){
  db.pushNotify.deviceTokens = [];
  saveDB();
  renderPushNotifyCard();
  toast('تم إيقاف الإشعارات على هذا الجهاز');
}

function saveDaysBeforeSetting(){
  const el = document.getElementById('daysBeforeInput');
  if(!el) return;
  const v = Math.max(0, Math.min(14, Number(el.value)||1));
  db.pushNotify.daysBefore = v;
  saveDB();
  toast('✅ اتحفظ');
}

function renderPushNotifyCard(){
  const box = document.getElementById('pushNotifyCardWrap');
  if(!box) return;
  const cs = db.cloudSync || {};
  const pn = db.pushNotify || {vapidKey:null, daysBefore:1, deviceTokens:[]};

  if(!cs.enabled || !cs.syncId){
    box.innerHTML = `
      <h3>🔔 إشعارات حقيقية لمواعيد التسليم</h3>
      <p class="meta">فعّل المزامنة السحابية فوق الأول — الإشعارات الحقيقية بتشتغل من خلال نفس مشروع Firebase.</p>
    `;
    return;
  }

  const enabledHere = typeof Notification!=='undefined' && Notification.permission==='granted'
    && pn.deviceTokens && pn.deviceTokens.length>0;

  box.innerHTML = `
    <h3>🔔 إشعارات حقيقية لمواعيد التسليم</h3>
    <p class="meta">توصلك إشعارات على الموبايل حتى لو التطبيق مقفول تمامًا، قبل موعد تسليم أي طلب بعدد الأيام اللي تحددها. محتاجة إعداد لمرة واحدة على Firebase (راجع ملف الشرح المرفق مع المشروع).</p>
    ${enabledHere ? `
      <p class="meta" style="color:var(--ok);font-weight:700;">✅ الإشعارات مفعّلة على هذا الجهاز</p>
      <div class="field"><label>نبّهني قبل التسليم بعدد الأيام</label>
        <div class="field-row2">
          <input id="daysBeforeInput" type="number" min="0" max="14" value="${pn.daysBefore||1}">
          <button class="btn sm secondary" onclick="saveDaysBeforeSetting()">💾 حفظ</button>
        </div>
      </div>
      <button class="btn sm danger" onclick="disablePushNotifications()">🔕 إيقاف الإشعارات على هذا الجهاز</button>
    ` : `
      <div class="field"><label>مفتاح Web Push (VAPID key)</label>
        <input id="vapidKeyInput" type="text" placeholder="من Firebase Console → Cloud Messaging → Web Push certificates" style="font-size:12px;direction:ltr;text-align:left;" value="${pn.vapidKey?pn.vapidKey.replace(/"/g,'&quot;'):''}">
      </div>
      <button class="btn" onclick="enablePushNotifications()">🔔 تفعيل الإشعارات على هذا الجهاز</button>
    `}
  `;
}

function uid(){
  return Date.now().toString(36)+Math.random().toString(36).slice(2,7);
}

function todayStr(){
  return new Date().toISOString().slice(0,10);
}

const WEEKDAY_NAMES_AR = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

// هل التاريخ المُعطى (Date أو 'YYYY-MM-DD') يقع في يوم الإجازة الأسبوعي المحدد في الإعدادات، أو في يوم عيد/إجازة مُضاف يدوياً؟
function isDayOff(dateLike){
  if(!dateLike) return false;
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
  if(isNaN(d.getTime())) return false;
  const dateStr = d.toISOString().slice(0,10);
  if((db.holidays||[]).some(h=>h.date===dateStr)) return true;
  return d.getDay() === Number(db.dayOffWeekday ?? 0);
}

function dayOffName(){
  return WEEKDAY_NAMES_AR[Number(db.dayOffWeekday ?? 0)];
}

// بيرجع سبب الإجازة كنص مناسب لعرضه للمستخدم: اسم العيد المحدد لو التاريخ يصادف عيد،
// وإلا اسم يوم الإجازة الأسبوعي لو التاريخ يصادفه، وإلا نص فاضي لو مش يوم إجازة أصلاً
function dayOffLabel(dateLike){
  if(!dateLike) return '';
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
  if(isNaN(d.getTime())) return '';
  const dateStr = d.toISOString().slice(0,10);
  const holiday = (db.holidays||[]).find(h=>h.date===dateStr);
  if(holiday) return holiday.name;
  if(d.getDay() === Number(db.dayOffWeekday ?? 0)) return dayOffName();
  return '';
}

// بيضيف عدد "أيام شغل" فعلية بداية من الآن، متجاهلاً يوم الإجازة الأسبوعية تماماً
// (يوم الإجازة لا يُحتسب كيوم شغل، والتاريخ الناتج لا يقع أبداً في يوم الإجازة)
function addWorkDaysFromNow(workDays){
  let d = new Date();
  let count = 0;
  while(count < workDays){
    d = new Date(d.getTime() + 86400000);
    if(!isDayOff(d)) count++;
  }
  return d;
}

function fmtDate(d){
  if(!d) return '-';
  const parts = d.split('-');
  if(parts.length!==3) return d;
  return parts[2]+'/'+parts[1]+'/'+parts[0];
}

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(()=>t.classList.remove('show'), 1800);
}

/* ============================================================
   شاشة القفل
   ============================================================ */
let pin = '';
window.userRole = null;       // 'owner' | 'manager' | 'receptionist' — بيتحدد بعد نجاح فتح القفل
window.financeUnlocked = false; // هل اتفتح رقم صفحة المالية المنفصل في الجلسة الحالية

function initLock(){
  window.userRole = null;
  window.financeUnlocked = false;
  try{ loadDB(); }catch(e){ console.warn('loadDB failed, using defaults', e); db = defaultDB(); }
  try{ initCloudSync(); }catch(e){ console.warn('cloud sync init failed', e); }
  try{ applyWorkshopBranding(); }catch(e){ console.warn(e); }
  try{ applyTheme(); }catch(e){ console.warn(e); }
  try{ applyFontSettings(); }catch(e){ console.warn(e); }
  try{ applyWideMode(); }catch(e){ console.warn(e); }
  try{ applyDarkMode(); }catch(e){ console.warn(e); }
  try{ applyCustomCSS(); }catch(e){ console.warn(e); }
  const handleKeyTap = (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    if(e.type==='touchend') e.preventDefault(); // يمنع تكرار الضغطة (touch + click) في بعض تطبيقات الـ WebView
    const k = btn.getAttribute('data-k');
    if(k==='clear'){ pin=''; updatePinDots(); return; }
    if(k==='back'){ pin = pin.slice(0,-1); updatePinDots(); return; }
    if(pin.length<4){
      pin += k;
      updatePinDots();
      if(pin.length===4){
        setTimeout(checkPin, 120);
      }
    }
  };
  document.getElementById('keypad').addEventListener('click', handleKeyTap);
  document.getElementById('keypad').addEventListener('touchend', handleKeyTap, {passive:false});
}

function updatePinDots(){
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((d,i)=>{
    d.classList.toggle('filled', i<pin.length);
    d.classList.remove('shake-err');
  });
  document.getElementById('lockError').textContent='';
}

function checkPin(){
  const realPass = (db && db.password) ? db.password : '0000';
  const managerPass = db && db.managerPassword;
  const receptionPass = db && db.receptionPassword;
  let matchedRole = null;
  if(pin === realPass) matchedRole = 'owner';
  else if(managerPass && pin === managerPass) matchedRole = 'manager';
  else if(receptionPass && pin === receptionPass) matchedRole = 'receptionist';
  if(matchedRole){
    window.userRole = matchedRole;
    window.financeUnlocked = false; // كل دخول جديد للتطبيق بيتطلب رقم المالية من تاني لو مفعّل
    document.getElementById('lockScreen').style.display='none';
    document.getElementById('app').style.display='block';
    pin='';
    applyRoleUI();
    boot();
    resetIdleTimer();
  } else {
    document.getElementById('lockError').textContent='الرقم السري غير صحيح، حاول مرة أخرى';
    document.querySelectorAll('.pin-dot').forEach(d=>d.classList.add('shake-err'));
    document.getElementById('keypad').parentElement.classList.add('lock-shake');
    setTimeout(()=>{
      pin='';
      updatePinDots();
      document.getElementById('lockScreen').classList.remove('lock-shake');
    }, 420);
  }
}

/* ---- تطبيق شكل الواجهة حسب مستوى الصلاحية (مالك/مدير/استقبال) ---- */
function applyRoleUI(){
  const html = document.documentElement;
  html.classList.toggle('role-receptionist', window.userRole==='receptionist');
  html.classList.toggle('role-manager', window.userRole==='manager');
  updateFinanceLockUI();
}

/* ---- قفل مستقل لصفحة المالية (رقم سري تاني غير رقم قفل التطبيق) ---- */
function updateFinanceLockUI(){
  const locked = !!(db && db.financePassword) && !window.financeUnlocked;
  document.documentElement.classList.toggle('finance-locked', locked);
}

let financeGatePin = '';
function openFinanceGate(){
  financeGatePin = '';
  openModal(`
    <div class="modal-head"><h3>💰 صفحة المالية محمية</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:4px 2px 14px;font-size:14px;line-height:1.7;">الصفحة دي محمية برقم سري منفصل عن رقم قفل التطبيق. اكتب الرقم عشان تكمل.</div>
    <div class="field"><label>رقم سري المالية</label>
      <input type="tel" maxlength="4" id="financeGateInput" inputmode="numeric" autocomplete="off" class="pin-input" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)">
    </div>
    <div id="financeGateError" style="color:var(--danger);font-size:12.5px;min-height:16px;"></div>
    <div class="btn-row">
      <button class="btn outline" id="financeGateCancel">إلغاء</button>
      <button class="btn" id="financeGateOk">دخول</button>
    </div>
  `);
  const input = document.getElementById('financeGateInput');
  const tryEnter = ()=>{
    const val = (input.value||'').trim();
    if(db && val === db.financePassword){
      window.financeUnlocked = true;
      updateFinanceLockUI();
      closeModal();
      showPage('finance');
    } else {
      const err = document.getElementById('financeGateError');
      if(err) err.textContent = 'الرقم السري غير صحيح، حاول تاني';
      input.value='';
    }
  };
  document.getElementById('financeGateOk').onclick = tryEnter;
  document.getElementById('financeGateCancel').onclick = ()=>closeModal();
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') tryEnter(); });
  setTimeout(()=>{ if(input) input.focus(); }, 50);
}

function lockNow(){
  document.getElementById('app').style.display='none';
  document.getElementById('lockScreen').style.display='flex';
  pin='';
  updatePinDots();
  clearTimeout(idleTimer);
  window.userRole = null;
  window.financeUnlocked = false;
  document.documentElement.classList.remove('role-receptionist','role-manager','finance-locked');
}

/* ---- القفل التلقائي بعد فترة خمول ---- */
let idleTimer = null;
function resetIdleTimer(){
  if(document.getElementById('app').style.display!=='block') return;
  clearTimeout(idleTimer);
  const minutes = Number(db.idleLockMinutes)||3;
  idleTimer = setTimeout(()=>{ lockNow(); }, minutes*60000);
}
['click','touchstart','keydown','mousemove','scroll'].forEach(evt=>{
  document.addEventListener(evt, ()=>{ if(db) resetIdleTimer(); }, {passive:true});
});

/* ============================================================
   التنقل بين الصفحات
   ============================================================ */
let currentPage='home';
let calendarMonth = null; // 'YYYY-MM', يتم تعيينه أول مرة يفتح فيها صفحة المواعيد
let calendarSelectedDay = null; // 'YYYY-MM-DD' أو null لعرض كل المواعيد
let currentOrderFilter='all';

const pageTitles = {
  home:'🏠 الرئيسية', customers:'👥 العملاء', orders:'📋 الطلبات',
  deliveries:'📅 مواعيد التسليم', finance:'💰 المالية', expenses:'🧵 المصروفات', settings:'⚙️ الإعدادات'
};
const fabPages = {home:false, customers:true, orders:true, deliveries:false, finance:false, expenses:true, settings:false};

function showPage(name){
  if(window.userRole==='receptionist' && (name==='finance' || name==='expenses' || name==='settings')){
    toast('🔒 الصفحة دي مش متاحة في وضع الاستقبال');
    name = 'home';
  } else if(window.userRole==='manager' && name==='settings'){
    toast('🔒 صفحة الإعدادات متاحة للمالك بس');
    name = 'home';
  } else if(name==='finance' && db && db.financePassword && !window.financeUnlocked){
    openFinanceGate();
    return;
  }
  currentPage = name;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active', b.getAttribute('data-page')===name));
  document.getElementById('pageTitle').textContent = pageTitles[name];
  document.getElementById('fabAdd').style.display = fabPages[name] ? 'flex':'none';
  if(db && db.skeletonLoading){
    showSkeleton();
    renderAll();
    clearTimeout(window._skelTm);
    window._skelTm = setTimeout(hideSkeleton, 280);
  } else {
    renderAll();
  }
  syncNavState();
}

function openSideNav(){
  document.getElementById('sideNav').classList.add('open');
  document.getElementById('sideNavOverlay').classList.add('active');
  syncNavState();
}
function closeSideNav(){
  document.getElementById('sideNav').classList.remove('open');
  document.getElementById('sideNavOverlay').classList.remove('active');
  syncNavState();
}

function fabAction(){
  if(currentPage==='customers') openCustomerModal();
  else if(currentPage==='orders') openOrderModal();
  else if(currentPage==='expenses') openExpenseModal();
}

function boot(){
  applyWorkshopBranding();
  document.getElementById('topDate').textContent = new Date().toLocaleDateString('ar-EG',{weekday:'long', year:'numeric', month:'long', day:'numeric'});
  applyHomeWidgetsLayout();
  showPage('home');
  runCustomJS();
}

function renderAll(){
  if(currentPage==='home') renderHome();
  if(currentPage==='customers') renderCustomers();
  if(currentPage==='orders') renderOrders();
  if(currentPage==='deliveries') renderDeliveries();
  if(currentPage==='finance') renderFinance();
  if(currentPage==='expenses') renderExpenses();
  if(currentPage==='settings') renderSettings();
}

/* ============================================================
   حسابات مساعدة
   ============================================================ */
function orderSubtotal(o){
  if(Array.isArray(o.items) && o.items.length){
    const itemsSum = o.items.reduce((s,it)=>s+(Number(it.unitPrice)||0)*(Number(it.qty)||1),0);
    return itemsSum + (Number(o.extra)||0);
  }
  return (Number(o.fee)||0) + (Number(o.extra)||0);
}
// قيمة الخصم بالجنيه (يدعم خصم نسبة % أو مبلغ ثابت، ولا يتعدى قيمة الإجمالي الفرعي)
function orderDiscountAmount(o){
  const sub = orderSubtotal(o);
  if(!o.discountType || o.discountType==='none') return 0;
  if(o.discountType==='percent') return Math.min(sub, sub*(Number(o.discountValue)||0)/100);
  if(o.discountType==='amount') return Math.min(sub, Math.max(0, Number(o.discountValue)||0));
  return 0;
}
// قيمة الضريبة/الرسوم الإضافية بالجنيه، محسوبة على الإجمالي بعد الخصم
function orderTaxAmount(o){
  const afterDiscount = orderSubtotal(o) - orderDiscountAmount(o);
  return afterDiscount * (Number(o.taxPercent)||0)/100;
}
function orderTotal(o){
  const sub = orderSubtotal(o);
  const discount = orderDiscountAmount(o);
  const tax = orderTaxAmount(o);
  return Math.max(0, sub - discount + tax);
}
function orderRemaining(o){ return orderTotal(o) - (Number(o.paid)||0); }

/* ============================================================
   سجل النشاط — يسجل كل عملية مهمة مع التاريخ والوقت
   (مفيد لو أكتر من شخص بيستخدم نفس الجهاز)
   ============================================================ */
function logActivity(text){
  if(!db.activityLog) db.activityLog=[];
  db.activityLog.push({id:uid(), text, ts:Date.now()});
  if(db.activityLog.length>200) db.activityLog = db.activityLog.slice(-200);
}

function fmtActivityTime(ts){
  const d = new Date(ts);
  return d.toLocaleDateString('ar-EG')+' '+d.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
}

/* ============================================================
   تراجع عن آخر إجراء — متاح خلال نفس الجلسة الحالية
   (مش بيتحفظ لو قفلت التطبيق، عشان بيحمل دالة استرجاع في الذاكرة)
   ============================================================ */
let lastUndo = null; // {label, restoreFn}

function setUndo(label, restoreFn){
  lastUndo = {label, restoreFn};
  renderUndoBar();
}

function performUndo(){
  if(!lastUndo){ toast('لا يوجد إجراء حديث للتراجع عنه'); return; }
  const {label, restoreFn} = lastUndo;
  lastUndo = null;
  restoreFn();
  renderUndoBar();
  toast('تم التراجع عن: '+label+' ↩️');
}

function renderUndoBar(){
  const box = document.getElementById('undoBarWrap');
  if(!box) return;
  box.innerHTML = lastUndo
    ? `<button class="btn sm outline" style="width:100%;margin-bottom:14px;" onclick="performUndo()">↩️ تراجع عن: ${escapeHtml(lastUndo.label)}</button>`
    : '';
}

/* ============================================================
   تتبع الوقت الفعلي المستغرق في كل طلب (بدء/إنهاء)
   ============================================================ */
function formatMinutesLabel(mins){
  mins = Math.max(0, Math.round(Number(mins)||0));
  if(mins<60) return mins+' د';
  const h = Math.floor(mins/60);
  const m = mins%60;
  return h+'س'+(m>0?' '+m+'د':'');
}

// لو فيه توقيت شغّال على الطلب، بيقفله ويجمع دقائقه على الإجمالي (تُستخدم عند تسليم الطلب تلقائياً)
function finalizeWorkTimeIfRunning(o){
  if(o && o.workStartedAt){
    const elapsedMin = Math.max(0, Math.round((Date.now()-o.workStartedAt)/60000));
    o.actualMinutes = (Number(o.actualMinutes)||0) + elapsedMin;
    o.workStartedAt = null;
  }
}

function startOrderWork(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  if(!o || o.workStartedAt) return;
  o.workStartedAt = Date.now();
  o.updatedAt = Date.now();
  saveDB();
  renderOrders();
  toast('⏱️ بدأ تسجيل وقت الشغل');
}

function stopOrderWork(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  if(!o || !o.workStartedAt) return;
  const elapsedMin = Math.max(0, Math.round((Date.now()-o.workStartedAt)/60000));
  finalizeWorkTimeIfRunning(o);
  o.updatedAt = Date.now();
  saveDB();
  renderOrders();
  toast(`⏹️ تم تسجيل ${formatMinutesLabel(elapsedMin)} — الإجمالي ${formatMinutesLabel(o.actualMinutes)}`);
}
function orderTypeLabel(o){
  if(Array.isArray(o.items) && o.items.length){
    return o.items.map(it=> ((it.qty||1)>1 ? (it.qty+' × ') : '') + it.type).join('، ');
  }
  return (o.qty && o.qty>1) ? (o.qty+' × '+o.type) : o.type;
}
function itemsBreakdownLines(o){
  if(Array.isArray(o.items) && o.items.length){
    return o.items.map(it=>`- ${((it.qty||1)>1?(it.qty+' × '):'')}${it.type}: ${((it.qty||1)*(Number(it.unitPrice)||0)).toLocaleString('ar-EG')} ج.م`);
  }
  return [`- ${orderTypeLabel(o)}: ${(Number(o.fee)||0).toLocaleString('ar-EG')} ج.م`];
}
function isOverdue(o){ return o.status!=='تم التسليم' && o.dateDelivery && o.dateDelivery < todayStr(); }
function customerById(id){ return db.customers.find(c=>c.id===id); }

function statusBadge(o){
  const urgentTag = (o.urgent && o.status!=='تم التسليم') ? '<span class="badge" style="background:var(--danger-light);color:var(--danger);" title="طلب مستعجل">🔥 مستعجل</span> ' : '';
  if(isOverdue(o)) return urgentTag+'<span class="badge late">متأخر</span>';
  if(o.status==='قيد العمل') return urgentTag+'<span class="badge progress">قيد العمل</span>';
  if(o.status==='جاهز للتسليم') return urgentTag+'<span class="badge ready">جاهز للتسليم</span>';
  return '<span class="badge done">تم التسليم</span>';
}

/* ============================================================
   الصفحة الرئيسية
   ============================================================ */
function debtorCustomers(){
  const threshold = Number(db.debtThreshold)||2000;
  const map = {};
  db.orders.forEach(o=>{
    const rem = orderRemaining(o);
    if(rem>0){ map[o.customerId] = (map[o.customerId]||0) + rem; }
  });
  return Object.keys(map).filter(cid=>map[cid]>=threshold).map(cid=>({customer:customerById(cid), amount:map[cid]})).filter(x=>x.customer).sort((a,b)=>b.amount-a.amount);
}

function renderHomeAlerts(){
  const box = document.getElementById('homeAlerts');
  let html = '';

  const lateCount = db.orders.filter(isOverdue).length;
  if(lateCount>0){
    html += `<div class="alert-banner danger"><span class="ic">⏰</span><div><b>${lateCount} طلب متأخر عن موعد التسليم</b>تحقق من قسم "المواعيد" لمتابعتها وإبلاغ العملاء.</div></div>`;
  }

  const nearCount = db.orders.filter(o=>{
    if(o.status==='تم التسليم' || !o.dateDelivery) return false;
    const diff = Math.round((new Date(o.dateDelivery)-new Date(todayStr()))/86400000);
    return diff>=0 && diff<=1;
  }).length;
  if(nearCount>0){
    html += `<div class="alert-banner warn"><span class="ic">📦</span><div><b>${nearCount} طلب موعد تسليمه اليوم أو غداً</b>راجع قسم "المواعيد" للتجهيز.</div></div>`;
  }

  // تحذير استباقي: طلبات معادها بكرة ولسه "قيد العمل" (مش جاهزة للتسليم)
  const notReadyTomorrow = db.orders.filter(o=>{
    if(o.status!=='قيد العمل' || !o.dateDelivery) return false;
    const diff = Math.round((new Date(o.dateDelivery)-new Date(todayStr()))/86400000);
    return diff===1;
  }).length;
  if(notReadyTomorrow>0){
    html += `<div class="alert-banner danger"><span class="ic">🚨</span><div><b>${notReadyTomorrow} طلب معاده بكرة ولسه "قيد العمل" مش جاهز</b>باقي يوم واحد بس، يُفضّل تسرّع فيه دلوقتي قبل ما يتأخر.</div></div>`;
  }

  const noDepositOrders = db.orders.filter(o=>o.status==='قيد العمل' && (Number(o.paid)||0)===0).length;
  if(noDepositOrders>0){
    html += `<div class="alert-banner warn"><span class="ic">🪙</span><div><b>${noDepositOrders} طلب "قيد العمل" من غير أي دفعة مقدمة</b>يُفضّل تحصيل عربون قبل الاستمرار في التنفيذ.</div></div>`;
  }

  const debtors = debtorCustomers();
  if(debtors.length>0){
    const names = debtors.slice(0,3).map(d=>d.customer.name).join('، ');
    html += `<div class="alert-banner danger"><span class="ic">💸</span><div><b>${debtors.length} عميل تجاوز حد المديونية (${Number(db.debtThreshold).toLocaleString('ar-EG')} ج.م)</b>${escapeHtml(names)}${debtors.length>3?' وآخرون...':''}</div></div>`;
  }

  if(db.lastBackupDate){
    const days = Math.round((new Date(todayStr())-new Date(db.lastBackupDate))/86400000);
    if(days>=7){
      html += `<div class="alert-banner warn"><span class="ic">💾</span><div><b>لم يتم عمل نسخة احتياطية منذ ${days} يوم</b>يُفضّل تصدير نسخة احتياطية من صفحة الإعدادات بانتظام.</div></div>`;
    }
  } else if(db.customers.length>0 || db.orders.length>0){
    html += `<div class="alert-banner warn"><span class="ic">💾</span><div><b>لا توجد نسخة احتياطية محفوظة بعد</b>يُفضّل تصدير نسخة احتياطية من صفحة الإعدادات للحفاظ على بياناتك.</div></div>`;
  }

  const tomorrow = new Date(Date.now()+86400000);
  if(isDayOff(tomorrow)){
    const dueTomorrowOrOnOff = db.orders.filter(o=>{
      if(o.status==='تم التسليم' || !o.dateDelivery) return false;
      return o.dateDelivery===tomorrow.toISOString().slice(0,10);
    }).length;
    let msg = `بكرة (${dayOffLabel(tomorrow)}) إجازة — استغل شغل النهاردة عشان ميتأخرش شغلك.`;
    if(dueTomorrowOrOnOff>0){
      msg += ` وعندك ${dueTomorrowOrOnOff} طلب معاده بيصادف يوم الإجازة، يُفضّل تجهيزه أو التنسيق مع العميل قبلها.`;
    }
    html += `<div class="alert-banner warn"><span class="ic">🌿</span><div><b>غداً إجازة</b>${msg}</div></div>`;
  }

  box.innerHTML = html;
}

// عدد القطع الفعلي في الطلب (مش عدد الطلبات) — بيجمع qty كل صنف في الطلب
function orderPieceCount(o){
  const items = (Array.isArray(o.items) && o.items.length) ? o.items : [{qty:o.qty||1}];
  return items.reduce((s,it)=>s+(Number(it.qty)||1), 0);
}

// يطبّق الترتيب اليدوي (لو موجود) فوق الترتيب التلقائي، وأي عنصر جديد مش متسجل بيتضاف في الآخر
function applyManualQueueOrder(naturalQueue){
  const manual = Array.isArray(db.queueManualOrder) ? db.queueManualOrder : [];
  if(!manual.length) return naturalQueue;
  const byId = {};
  naturalQueue.forEach(o=>{ byId[o.id]=o; });
  const ordered = [];
  manual.forEach(id=>{ if(byId[id]){ ordered.push(byId[id]); delete byId[id]; } });
  naturalQueue.forEach(o=>{ if(byId[o.id]) ordered.push(o); });
  return ordered;
}

// يحسب دور الشغل النهاردة (نفس المنطق يُستخدم في العرض وفي إعادة الترتيب وتسجيل الإنجاز)
function computeTodayQueue(){
  const today = todayStr();
  const active = db.orders.filter(o=>o.status!=='تم التسليم');

  const mustFinish = active.filter(o=> o.dateDelivery && (o.dateDelivery<=today))
    .sort((a,b)=>(a.dateDelivery||'').localeCompare(b.dateDelivery||''));

  const startToday = active.filter(o=>{
    if(!o.dateDelivery || o.dateDelivery<=today) return false;
    const diff = Math.round((new Date(o.dateDelivery)-new Date(today))/86400000);
    return diff>=1 && diff<=2;
  }).sort((a,b)=>(a.dateDelivery||'').localeCompare(b.dateDelivery||''));

  const mustFinishIds = new Set(mustFinish.map(o=>o.id));
  const queue = applyManualQueueOrder(mustFinish.concat(startToday));
  const waitingCount = active.length - queue.length;
  return {active, mustFinish, mustFinishIds, startToday, queue, waitingCount};
}

// تحويل كسر اليوم (0 إلى 1) لوقت متوقع بصيغة عربية HH:MM ص/م بناءً على ساعات العمل المحددة
function formatEstimatedTime(fraction){
  const startH = Number(db.workStartHour ?? 9);
  const endH = Number(db.workEndHour ?? 18);
  const span = Math.max(1, endH-startH);
  const hoursFloat = startH + Math.min(1,fraction)*span;
  let h = Math.floor(hoursFloat);
  let m = Math.round((hoursFloat-h)*60);
  if(m===60){ h+=1; m=0; }
  h = ((h%24)+24)%24;
  const period = h<12 ? 'ص' : 'م';
  let h12 = h%12; if(h12===0) h12=12;
  return `${h12}:${String(m).padStart(2,'0')} ${period}`;
}

// تسجيل الطلب كمُنجز مباشرة من قايمة الدور
function markOrderDelivered(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  if(!o) return;
  const before = {status:o.status, deliveredDate:o.deliveredDate, workStartedAt:o.workStartedAt, actualMinutes:o.actualMinutes};
  const beforeQueue = (db.queueManualOrder||[]).slice();
  finalizeWorkTimeIfRunning(o);
  o.status = 'تم التسليم';
  if(!o.deliveredDate) o.deliveredDate = todayStr();
  o.updatedAt = Date.now();
  db.queueManualOrder = (db.queueManualOrder||[]).filter(id=>id!==orderId);
  logActivity(`✅ تسليم طلب ${customerById(o.customerId)?customerById(o.customerId).name:''}`);
  setUndo('تسجيل الطلب كمُنجز', ()=>{
    o.status = before.status;
    o.deliveredDate = before.deliveredDate;
    o.workStartedAt = before.workStartedAt;
    o.actualMinutes = before.actualMinutes;
    db.queueManualOrder = beforeQueue;
    saveDB();
    renderHome();
    renderOrders();
  });
  saveDB();
  renderHome();
  toast('تم تسجيل الطلب كمُنجز ✅');
}

// تحريك عنصر في دور الشغل لأعلى (-1) أو لأسفل (+1) يدوياً
function moveQueueItem(orderId, direction){
  const {queue} = computeTodayQueue();
  const idx = queue.findIndex(o=>o.id===orderId);
  const newIdx = idx+direction;
  if(idx<0 || newIdx<0 || newIdx>=queue.length) return;
  const tmp = queue[idx];
  queue[idx] = queue[newIdx];
  queue[newIdx] = tmp;
  db.queueManualOrder = queue.map(o=>o.id);
  saveDB();
  renderTodayPlan();
}

// خطة اليوم: دور مرقّم واضح (مين الأول) + عدد القطع الحقيقي + تنبيه لو الشغل فوق طاقتك
function renderTodayPlan(){
  const box = document.getElementById('todayPlan');
  if(!box) return;

  if(isDayOff(new Date())){
    box.innerHTML = `<div class="alert-banner warn" style="margin-bottom:0;"><span class="ic">🌿</span><div><b>النهاردة ${dayOffLabel(new Date())} — يوم إجازة</b>مفيش شغل مجدول، خد راحتك وارجع لخطة الشغل بكرة.</div></div>`;
    return;
  }

  const {mustFinish, mustFinishIds, queue, waitingCount} = computeTodayQueue();

  // عدد القطع الحقيقي (مش عدد الطلبات) للي لازم يخلص النهاردة، ولكل الدور
  const piecesMustFinish = mustFinish.reduce((s,o)=>s+orderPieceCount(o), 0);
  const piecesQueue = queue.reduce((s,o)=>s+orderPieceCount(o), 0);

  // مقارنة حجم شغل "لازم يخلص النهاردة" بالطاقة اليومية المحددة في الإعدادات
  const capacity = Number(db.dailyCapacity)||500;
  const valueMustFinish = mustFinish.reduce((s,o)=>s+orderTotal(o), 0);
  const overCapacity = valueMustFinish > capacity;

  let html = '';

  // ملخص سريع أعلى الخطة: عدد القطع وعدد الطلبات في الدور
  html += `<div class="grid-cards" style="margin-bottom:10px;">
    <div class="stat-card ${mustFinish.length?'danger':''}"><div class="stat-ic">🧵</div><div><div class="num">${piecesMustFinish}</div><div class="lbl">قطعة لازم تخلص النهاردة</div></div></div>
    <div class="stat-card"><div class="stat-ic">📦</div><div><div class="num">${piecesQueue}</div><div class="lbl">إجمالي القطع في الدور</div></div></div>
  </div>`;

  if(overCapacity){
    html += `<div class="alert-banner danger" style="margin-bottom:10px;"><span class="ic">⚠️</span><div><b>حجم شغل النهاردة (${valueMustFinish.toLocaleString('ar-EG')} ج.م) فوق طاقتك اليومية (${capacity.toLocaleString('ar-EG')} ج.م)</b>فكّر تستعين بحد يساعدك، أو تتواصل مع أصحاب الطلبات الأقل أولوية لتأجيل بسيط.</div></div>`;
  }

  // تقدير وقت الانتهاء التقريبي لكل عنصر بناءً على القيمة التراكمية مقابل الطاقة اليومية وساعات العمل
  let cumValue = 0;
  const estimates = queue.map(o=>{
    cumValue += orderTotal(o);
    return formatEstimatedTime(cumValue/capacity);
  });

  function queueLine(o, position, urgent, estTime, isFirst, isLast){
    const c = customerById(o.customerId);
    const accent = urgent ? 'var(--danger)' : 'var(--warn)';
    const tint = urgent ? 'var(--danger-light)' : 'var(--warn-light)';
    const pieces = orderPieceCount(o);
    return `<div class="card" style="margin-bottom:8px;border-right:5px solid ${accent};background:linear-gradient(90deg, ${tint} 0%, var(--card) 14%);">
      <div class="row">
        <h3 class="name-row"><span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${accent};color:#fff;font-size:12.5px;font-weight:900;margin-left:6px;flex-shrink:0;">${position}</span>${avatarChip(c?c.name:'؟')}${c?escapeHtml(c.name):'عميل محذوف'} - ${escapeHtml(orderTypeLabel(o))}</h3>
        ${statusBadge(o)}
      </div>
      <div class="meta">📅 التسليم: ${fmtDate(o.dateDelivery)} — 🧵 ${pieces} قطعة — 🕐 المتوقع الانتهاء حوالي ${estTime}</div>
      <div class="btn-row" style="margin-top:8px;">
        <button class="btn sm accent" onclick="markOrderDelivered('${o.id}')">✅ تم الإنجاز</button>
        <button class="btn sm outline" ${isFirst?'disabled style="opacity:0.4;"':''} onclick="moveQueueItem('${o.id}', -1)">🔼</button>
        <button class="btn sm outline" ${isLast?'disabled style="opacity:0.4;"':''} onclick="moveQueueItem('${o.id}', 1)">🔽</button>
      </div>
    </div>`;
  }

  if(queue.length){
    html += `<div class="section-title" style="margin:0 0 8px;font-size:14px;">🔢 دور الشغل النهاردة (ابدأ برقم 1)</div>`;
    html += `<p class="meta" style="margin:0 0 8px;">تقدر تغيّر ترتيب أي طلب يدوياً بالسهمين 🔼🔽 لو عندك سبب تقدّمه، وتسجّله "تم الإنجاز" مباشرة من هنا.</p>`;
    html += queue.map((o,i)=>queueLine(o, i+1, mustFinishIds.has(o.id), estimates[i], i===0, i===queue.length-1)).join('');
  } else {
    html += `<div class="empty-msg" style="padding:14px 10px;">مفيش طلبات مستعجلة النهاردة 🎉</div>`;
  }

  if(waitingCount>0){
    html += `<div class="meta" style="text-align:center;margin-top:6px;">🟢 ${waitingCount} طلب لسه بدري عليه، مستني دوره</div>`;
  }

  box.innerHTML = html;
}

// نظرة سريعة على توزيع القطع المطلوبة على أيام الأسبوع الجاي (مش بس النهاردة)
function renderWeeklyOverview(){
  const box = document.getElementById('weeklyOverview');
  if(!box) return;
  const active = db.orders.filter(o=>o.status!=='تم التسليم');
  let html = '<div class="card"><div style="display:flex;overflow-x:auto;gap:8px;padding-bottom:2px;">';
  for(let i=0;i<7;i++){
    const d = new Date(Date.now()+i*86400000);
    const dStr = d.toISOString().slice(0,10);
    const dayOff = isDayOff(d);
    const pieces = active.filter(o=>o.dateDelivery===dStr).reduce((s,o)=>s+orderPieceCount(o), 0);
    const label = i===0 ? 'النهاردة' : WEEKDAY_NAMES_AR[d.getDay()];
    html += `<div style="flex:0 0 auto;min-width:76px;text-align:center;padding:9px 6px;border-radius:12px;background:${dayOff?'var(--border)':(pieces>0?'var(--warn-light)':'var(--card-alt)')};">
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">${label}</div>
      ${dayOff
        ? '<div style="font-size:17px;">🌿</div>'
        : `<div style="font-size:17px;font-weight:900;color:${pieces>0?'var(--warn)':'var(--muted)'};">${pieces}</div><div style="font-size:10px;color:var(--muted);">قطعة</div>`
      }
    </div>`;
  }
  html += '</div></div>';
  box.innerHTML = html;
}

// سجل بسيط: هل اتنفذت الطلبات اللي كان معادها في آخر 7 أيام ولا اتأجلت؟
function renderCommitmentLog(){
  const box = document.getElementById('commitmentLog');
  if(!box) return;
  let rows = '';
  let anyDue = false;
  for(let i=1;i<=7;i++){
    const d = new Date(Date.now()-i*86400000);
    const dStr = d.toISOString().slice(0,10);
    const due = db.orders.filter(o=>o.dateDelivery===dStr);
    if(!due.length) continue;
    anyDue = true;
    const completed = due.filter(o=>o.status==='تم التسليم').length;
    const missed = due.length-completed;
    const label = `${WEEKDAY_NAMES_AR[d.getDay()]} ${fmtDate(dStr)}`;
    rows += `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:13px;">${label}</span>
      <span style="font-size:13px;">${missed>0 ? `<b style="color:var(--danger);">${missed} اتأجل</b> من ${due.length}` : `<b style="color:var(--ok);">كله خلص ✅</b> (${due.length})`}</span>
    </div>`;
  }
  box.innerHTML = anyDue ? `<div class="card">${rows}</div>` : `<div class="empty-msg">لا توجد بيانات كافية بعد لعرض سجل الالتزام</div>`;
}

/* ============================================================
   ملخص نهاية الأسبوع: نظرة سريعة على أداء آخر 7 أيام
   ============================================================ */
function showWeeklySummary(){
  const sevenDaysAgo = new Date(Date.now()-6*86400000).toISOString().slice(0,10);
  const today = todayStr();

  const deliveredThisWeek = db.orders.filter(o=>o.status==='تم التسليم' && o.deliveredDate && o.deliveredDate>=sevenDaysAgo && o.deliveredDate<=today);
  const newOrdersThisWeek = db.orders.filter(o=>o.dateReceived && o.dateReceived>=sevenDaysAgo && o.dateReceived<=today);
  const collected = db.payments.filter(p=>p.date>=sevenDaysAgo && p.date<=today).reduce((s,p)=>s+Number(p.amount||0),0);
  const stillActive = db.orders.filter(o=>o.status!=='تم التسليم').length;
  const lateNow = db.orders.filter(isOverdue).length;
  const piecesDelivered = deliveredThisWeek.reduce((s,o)=>s+orderPieceCount(o),0);

  const msg =
`📋 ملخص أسبوع الورشة
${db.workshopName||'ورشة تفصيل الجلابيب'}
من ${sevenDaysAgo} إلى ${today}

✅ طلبات اتسلّمت: ${deliveredThisWeek.length} طلب (${piecesDelivered} قطعة)
🧵 طلبات جديدة دخلت: ${newOrdersThisWeek.length}
💰 المحصّل: ${collected.toLocaleString('ar-EG')} ج.م
⏳ لسه شغالين على: ${stillActive} طلب
${lateNow>0?`⚠️ متأخر حالياً: ${lateNow} طلب\n`:''}`;

  const html = `
    <div class="modal-head"><h3>📋 ملخص الأسبوع</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="card" style="white-space:pre-wrap;font-size:14px;line-height:1.9;">${escapeHtml(msg)}</div>
    <div class="btn-row" style="margin-top:12px;">
      <button class="btn" onclick='shareWeeklySummary(${JSON.stringify(msg)})'>📤 مشاركة عبر واتساب</button>
    </div>
  `;
  openModal(html);
}

function shareWeeklySummary(msg){
  if(navigator.share){
    navigator.share({title:'ملخص أسبوع الورشة', text:msg}).catch(()=>{});
    return;
  }
  openExternalLink(`https://wa.me/?text=${encodeURIComponent(msg)}`);
}

function renderGlobalSearch(){
  const q = document.getElementById('globalSearch').value.trim().toLowerCase();
  const wrap = document.getElementById('homeQuickActionsWrap');
  const resultsBox = document.getElementById('globalSearchResults');
  if(!q){
    resultsBox.innerHTML = '';
    wrap.style.display = '';
    return;
  }
  wrap.style.display = 'none';

  const matchedCustomers = db.customers.filter(c=>
    c.name.toLowerCase().includes(q) || (c.phone||'').includes(q)
  ).slice(0,8);

  const matchedOrders = db.orders.filter(o=>{
    const label = orderTypeLabel(o).toLowerCase();
    const c = customerById(o.customerId);
    return label.includes(q) || (c && c.name.toLowerCase().includes(q));
  }).slice(0,8);

  let html = '';

  if(matchedCustomers.length){
    html += `<div class="section-title" style="margin-top:6px;">👥 عملاء (${matchedCustomers.length})</div>`;
    html += matchedCustomers.map(c=>`
      <div class="card" onclick="showPage('customers');document.getElementById('custSearch').value='${escapeHtml(c.name).replace(/'/g,"\\'")}';renderCustomers();" style="cursor:pointer;">
        <h3 class="name-row">${avatarChip(c.name)}${escapeHtml(c.name)}</h3>
        <div class="meta">📞 ${escapeHtml(c.phone||'-')}</div>
      </div>
    `).join('');
  }

  if(matchedOrders.length){
    html += `<div class="section-title">📋 طلبات (${matchedOrders.length})</div>`;
    html += matchedOrders.map(o=>{
      const c = customerById(o.customerId);
      return `
      <div class="card" onclick="openOrderModal('${o.id}')" style="cursor:pointer;">
        <div class="row"><h3 class="name-row">${avatarChip(c?c.name:'؟')}${c?escapeHtml(c.name):'عميل محذوف'}</h3>${statusBadge(o)}</div>
        <div class="meta">👗 ${escapeHtml(orderTypeLabel(o))}</div>
      </div>`;
    }).join('');
  }

  if(!matchedCustomers.length && !matchedOrders.length){
    html = `<div class="empty-msg">لا توجد نتائج مطابقة لـ "${escapeHtml(document.getElementById('globalSearch').value.trim())}"</div>`;
  }

  resultsBox.innerHTML = html;
}

// يبني رسم بياني صغير (SVG) من مصفوفة أرقام — بيستخدم في بطاقات الإحصائيات
// لإظهار اتجاه آخر 7 أيام بنظرة واحدة من غير ما ياخد مساحة كبيرة
function sparklineSvg(values){
  if(!values || values.length<2) return '';
  const w=58, h=22, pad=2;
  const max = Math.max.apply(null, values);
  const min = Math.min.apply(null, values);
  const range = (max-min)||1;
  const step = (w-pad*2)/(values.length-1);
  const pts = values.map((v,i)=>{
    const x = pad + i*step;
    const y = h - pad - ((v-min)/range)*(h-pad*2);
    return x.toFixed(1)+','+y.toFixed(1);
  }).join(' ');
  const trendClass = values[values.length-1] > values[0] ? 'trend-up' : (values[values.length-1] < values[0] ? 'trend-down' : 'trend-flat');
  return `<svg class="spark ${trendClass}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M${pts}"/></svg>`;
}

function renderHome(){
  renderUndoBar();
  renderHomeAlerts();
  renderWeeklyOverview();
  renderTodayPlan();
  renderCommitmentLog();
  const totalOrders = db.orders.length;
  const inProgress = db.orders.filter(o=>o.status!=='تم التسليم').length;
  const today = todayStr();
  const revenueToday = db.payments.filter(p=>p.date===today).reduce((s,p)=>s+Number(p.amount||0),0);
  const totalRemaining = db.orders.reduce((s,o)=>s+orderRemaining(o),0);

  // بيانات آخر 7 أيام (طلبات مستلمة / إيراد يومي) عشان الرسم البياني الصغير في البطاقات
  const last7Days = [];
  for(let i=6;i>=0;i--){
    const d = new Date();
    d.setDate(d.getDate()-i);
    last7Days.push(d.toISOString().slice(0,10));
  }
  const ordersTrend = last7Days.map(d=> db.orders.filter(o=>o.dateReceived===d).length);
  const revenueTrend = last7Days.map(d=> db.payments.filter(p=>p.date===d).reduce((s,p)=>s+Number(p.amount||0),0));

  document.getElementById('homeStats').innerHTML = `
    <div class="stat-card"><div class="stat-ic">📋</div><div><div class="num">${totalOrders}</div><div class="lbl">عدد الطلبات</div></div>${sparklineSvg(ordersTrend)}</div>
    <div class="stat-card warn"><div class="stat-ic">🧵</div><div><div class="num">${inProgress}</div><div class="lbl">قيد العمل</div></div></div>
    <div class="stat-card"><div class="stat-ic">💰</div><div><div class="num">${revenueToday.toLocaleString('ar-EG')}</div><div class="lbl">إيراد اليوم (ج.م)</div></div>${sparklineSvg(revenueTrend)}</div>
    <div class="stat-card danger"><div class="stat-ic">⏳</div><div><div class="num">${totalRemaining.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي المتبقي (ج.م)</div></div></div>
  `;

  const upcoming = db.orders.filter(o=>o.status!=='تم التسليم').sort((a,b)=>(a.dateDelivery||'').localeCompare(b.dateDelivery||'')).slice(0,5);
  document.getElementById('homeUpcoming').innerHTML = upcoming.length ? upcoming.map(o=>{
    const c = customerById(o.customerId);
    return `<div class="card">
      <div class="row">
        <h3 class="name-row">${avatarChip(c?c.name:'؟')}${c?escapeHtml(c.name):'عميل محذوف'} - ${escapeHtml(orderTypeLabel(o))}</h3>
        ${statusBadge(o)}
      </div>
      <div class="meta">📅 التسليم: ${fmtDate(o.dateDelivery)}</div>
      <div class="meta">💰 المتبقي: ${orderRemaining(o).toLocaleString('ar-EG')} ج.م</div>
    </div>`;
  }).join('') : `<div class="empty-msg">لا توجد طلبات قيد العمل حالياً 🎉</div>`;

  const late = db.orders.filter(isOverdue).sort((a,b)=>(a.dateDelivery||'').localeCompare(b.dateDelivery||''));
  document.getElementById('homeLate').innerHTML = late.length ? late.map(o=>{
    const c = customerById(o.customerId);
    return `<div class="card" style="border-right-color:var(--danger)">
      <div class="row">
        <h3 class="name-row">${avatarChip(c?c.name:'؟')}${c?escapeHtml(c.name):'عميل محذوف'} - ${escapeHtml(orderTypeLabel(o))}</h3>
        <span class="tag-late-text">متأخر ⏰</span>
      </div>
      <div class="meta">كان يجب التسليم في: ${fmtDate(o.dateDelivery)}</div>
    </div>`;
  }).join('') : `<div class="empty-msg">لا توجد طلبات متأخرة 👍</div>`;
}

function escapeHtml(s){
  if(s===undefined||s===null) return '';
  return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// دائرة صغيرة بحرف اسم العميل، بتضاف قبل الاسم في قوائم العملاء والطلبات والمواعيد
function avatarChip(name, variant){
  const letter = (name||'؟').trim().charAt(0) || '؟';
  return `<span class="avatar${variant?' '+variant:''}">${escapeHtml(letter)}</span>`;
}

// فتح نافذة طباعة بشكل آمن — لو المتصفح منع النوافذ المنبثقة (بيحصل داخل بعض بيئات المعاينة)
// بيتم عمل تنزيل للملف بدل الكراش، والمستخدم يقدر يفتحه ويطبعه بنفسه.
// رأس صغير ببيانات الورشة يُستخدم أعلى كل ورقة مطبوعة (إيصال / بطاقة مقاسات / ملصق)
function printBrandHeaderHtml(){
  const name = db.workshopName||'ورشة تفصيل الجلابيب';
  const lines = [escapeHtml(name)];
  if(db.ownerName) lines.push(escapeHtml(db.ownerName));
  if(db.ownerPhone) lines.push('📞 '+escapeHtml(db.ownerPhone));
  if(db.workshopAddress) lines.push('📍 '+escapeHtml(db.workshopAddress));
  const logoHtml = db.workshopLogo?`<img src="${db.workshopLogo}" style="width:54px;height:54px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 8px;border:2px solid #1F6D57;">`:'';
  return `<div style="text-align:center;margin-bottom:10px;">
    ${logoHtml}
    <div style="font-size:17px;font-weight:900;color:#1F6D57;">${lines[0]}</div>
    ${lines.slice(1).map(l=>`<div style="font-size:12px;color:#666;">${l}</div>`).join('')}
  </div><hr style="border:none;border-top:1px dashed #ccc;margin-bottom:10px;">`;
}

function openPrintWindow(html, filename){
  let win = null;
  try{ win = window.open('', '_blank'); }catch(e){ win = null; }
  if(win && win.document){
    try{
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(()=>{ try{ win.print(); }catch(e){} }, 300);
      return;
    }catch(e){ /* نكمل للحل البديل */ }
  }
  // الحل البديل: نزّل الصفحة كملف HTML يقدر يفتحه ويطبعه من المتصفح
  try{
    const blob = new Blob([html], {type:'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (filename||'طباعة')+'.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 60000);
    toast('النوافذ المنبثقة ممنوعة هنا، تم حفظ الملف بدلاً من ذلك — افتحه واطبعه من متصفحك');
  }catch(e){
    toast('تعذر فتح الطباعة. جرّب فتح التطبيق في متصفح مثل Chrome بدل نافذة المعاينة');
  }
}

/* ============================================================
   العملاء
   ============================================================ */
let vipOnlyFilter = false;
function toggleVipOnly(){
  vipOnlyFilter = !vipOnlyFilter;
  const btn = document.getElementById('vipFilterBtn');
  if(vipOnlyFilter){ btn.style.background='var(--accent)'; btn.style.color='#fff'; btn.style.borderColor='var(--accent)'; }
  else { btn.style.background=''; btn.style.color=''; btn.style.borderColor=''; }
  renderCustomers();
}

function renderCustomers(){
  const q = (document.getElementById('custSearch').value||'').trim();
  let list = db.customers.filter(c=> !q || c.name.includes(q) || (c.phone||'').includes(q) || (c.family||'').includes(q));
  const vipThreshold = Number(db.vipThreshold)||3;
  list = list.map(c=>({c, ordersCount: db.orders.filter(o=>o.customerId===c.id).length}))
    .sort((a,b)=>{
      const aVip = a.ordersCount>=vipThreshold, bVip = b.ordersCount>=vipThreshold;
      if(aVip!==bVip) return aVip? -1:1;
      return b.ordersCount-a.ordersCount;
    });
  if(vipOnlyFilter) list = list.filter(({ordersCount})=>ordersCount>=vipThreshold);
  const html = list.map(({c, ordersCount})=>{
    const isVip = ordersCount >= vipThreshold;
    return `<div class="card">
      <div class="row">
        <h3 class="name-row">${avatarChip(c.name, isVip?'accent':'')}${escapeHtml(c.name)} ${isVip?'<span class="badge" style="background:#fff3d6;color:#9a6b00;">⭐ VIP</span>':''}</h3>
        <span class="meta">${ordersCount} طلب</span>
      </div>
      <div class="meta">📞 ${escapeHtml(c.phone||'-')}</div>
      ${c.family?`<div class="meta" style="cursor:pointer;" onclick="document.getElementById('custSearch').value='${escapeHtml(c.family).replace(/'/g,"\\'")}'; renderCustomers();">👪 عائلة ${escapeHtml(c.family)} <span style="text-decoration:underline;">(عرض الكل)</span></div>`:''}
      <div class="meas-row">
        <span class="meas-chip m-length">📏 <span class="meas-lbl">الطول</span> ${c.length||'-'}</span>
        <span class="meas-chip m-sleeve">📏 <span class="meas-lbl">طول الكم</span> ${c.sleeve||'-'}</span>
        <span class="meas-chip m-chest">📏 <span class="meas-lbl">الصدر</span> ${c.chest||'-'}</span>
        <span class="meas-chip m-waist">📏 <span class="meas-lbl">الخزنة</span> ${c.waist||'-'}</span>
        <span class="meas-chip m-shoulder">📏 <span class="meas-lbl">وسع الكم</span> ${c.shoulder||'-'}</span>
      </div>
      ${c.notes?`<div class="meta">📝 ${escapeHtml(c.notes)}</div>`:''}
      ${c.updatedAt?`<div class="meta" style="opacity:.65;font-size:12px;">🕒 آخر تعديل: ${fmtActivityTime(c.updatedAt)}</div>`:''}
      <div class="btn-row">
        <button class="btn sm secondary" onclick="openCustomerModal('${c.id}')">✏️ تعديل</button>
        <button class="btn sm outline" onclick="openOrderModal(null,'${c.id}')">➕ طلب جديد</button>
        <button class="btn sm outline" onclick="printMeasurementCard('${c.id}')">🖨️ بطاقة المقاسات</button>
        <button class="btn sm accent" onclick="shareMeasurementCard('${c.id}')">📲 مشاركة واتساب</button>
        <button class="btn sm outline" onclick="openCustomerHistory('${c.id}')">📜 السجل</button>
        <button class="btn sm danger" onclick="deleteCustomer('${c.id}')">🗑️ حذف</button>
      </div>
    </div>`;
  }).join('');
  document.getElementById('customersList').innerHTML = html || (vipOnlyFilter ? `<div class="empty-msg">لا يوجد عملاء VIP حاليًا</div>` : `<div class="empty-msg">لا يوجد عملاء بعد. اضغط ➕ لإضافة عميل جديد</div>`);
}

function openCustomerHistory(id){
  const c = customerById(id);
  if(!c) return;
  const orders = db.orders.filter(o=>o.customerId===id).sort((a,b)=>(b.dateReceived||'').localeCompare(a.dateReceived||''));
  const totalSpent = orders.reduce((s,o)=>s+(Number(o.paid)||0),0);
  const totalRemaining = orders.reduce((s,o)=>s+orderRemaining(o),0);
  const delivered = orders.filter(o=>o.status==='تم التسليم' && o.deliveredDate);
  let avgDelay = null;
  if(delivered.length){
    const totalDelayDays = delivered.reduce((s,o)=>{
      const d = Math.round((new Date(o.deliveredDate)-new Date(o.dateDelivery))/86400000);
      return s + (d>0? d:0);
    },0);
    avgDelay = Math.round(totalDelayDays/delivered.length);
  }
  const ordersHtml = orders.length ? orders.map(o=>`
    <div class="card" style="margin-bottom:8px;">
      <div class="row"><h3>${escapeHtml(orderTypeLabel(o))}</h3>${statusBadge(o)}</div>
      <div class="meta">📅 استلام: ${fmtDate(o.dateReceived)} | تسليم: ${fmtDate(o.dateDelivery)}</div>
      <div class="meta">💰 الإجمالي: ${orderTotal(o).toLocaleString('ar-EG')} | المتبقي: ${orderRemaining(o).toLocaleString('ar-EG')} ج.م</div>
    </div>
  `).join('') : `<div class="empty-msg">لا توجد طلبات سابقة لهذا العميل</div>`;
  const html = `
    <div class="modal-head"><h3>📜 سجل ${escapeHtml(c.name)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="grid-cards" style="grid-template-columns:1fr 1fr;">
      <div class="stat-card"><div class="stat-ic">📋</div><div><div class="num">${orders.length}</div><div class="lbl">إجمالي الطلبات</div></div></div>
      <div class="stat-card"><div class="stat-ic">💵</div><div><div class="num">${totalSpent.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي المدفوع (ج.م)</div></div></div>
      <div class="stat-card ${totalRemaining>0?'danger':''}"><div class="stat-ic">⏳</div><div><div class="num">${totalRemaining.toLocaleString('ar-EG')}</div><div class="lbl">المتبقي الحالي (ج.م)</div></div></div>
      <div class="stat-card ${avgDelay>0?'warn':''}"><div class="stat-ic">⏱️</div><div><div class="num">${avgDelay===null?'-':avgDelay}</div><div class="lbl">متوسط أيام التأخير</div></div></div>
    </div>
    <div class="section-title">🧵 طلبات العميل</div>
    ${ordersHtml}
  `;
  openModal(html);
}

function openCustomerModal(id){
  const c = id ? customerById(id) : null;
  const familyNames = Array.from(new Set(db.customers.map(cc=>cc.family).filter(Boolean)));
  const html = `
    <div class="modal-head"><h3>${c?'✏️ تعديل عميل':'➕ عميل جديد'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="field"><label>اسم العميل</label><input id="f_name" value="${c?escapeHtml(c.name):''}" placeholder="مثال: أحمد محمد"></div>
    <div class="field"><label>رقم الهاتف</label><input id="f_phone" value="${c?escapeHtml(c.phone||''):''}" placeholder="01xxxxxxxxx" inputmode="tel" maxlength="11" dir="ltr"></div>
    <div class="field"><label>👪 اسم العائلة (اختياري)</label><input id="f_family" list="familyList" value="${c?escapeHtml(c.family||''):''}" placeholder="مثال: عائلة الحاج محمد">
      <datalist id="familyList">${familyNames.map(f=>`<option value="${escapeHtml(f)}">`).join('')}</datalist>
    </div>
    <div class="field-row2">
      <div class="field m-length"><label>📏 الطول (سم)</label><input id="f_length" type="number" value="${c?c.length||'':''}"></div>
      <div class="field m-sleeve"><label>📏 طول الكم (سم)</label><input id="f_sleeve" type="number" value="${c?c.sleeve||'':''}"></div>
    </div>
    <div class="field-row2">
      <div class="field m-chest"><label>📏 الصدر (سم)</label><input id="f_chest" type="number" value="${c?c.chest||'':''}"></div>
      <div class="field m-waist"><label>📏 الخزنة (سم)</label><input id="f_waist" type="number" value="${c?c.waist||'':''}"></div>
    </div>
    <div class="field m-shoulder"><label>📏 وسع الكم (سم)</label><input id="f_shoulder" type="number" value="${c?c.shoulder||'':''}"></div>
    <div class="field"><label>ملاحظات (اختياري)</label><textarea id="f_notes" rows="2" placeholder="مثال: بيحب الجيب من الشمال...">${c?escapeHtml(c.notes||''):''}</textarea></div>
    <button class="btn" onclick="saveCustomer(${c?`'${c.id}'`:'null'})">💾 حفظ</button>
  `;
  openModal(html);
}

// بيتحقق إن رقم الهاتف رقم موبايل مصري صحيح (01 + كود شبكة 0/1/2/5 + 8 أرقام = 11 رقم)
// بيسمح بمسافات أو شرطات جوه الرقم وبيتجاهلها وقت التحقق
function isValidEgyptPhone(phone){
  const digits = phone.replace(/[\s\-]/g,'');
  return /^01[0125]\d{8}$/.test(digits);
}

async function saveCustomer(id){
  const name = document.getElementById('f_name').value.trim();
  if(!name){ toast('من فضلك أدخل اسم العميل'); return; }
  const phoneRaw = document.getElementById('f_phone').value.trim();
  if(phoneRaw && !isValidEgyptPhone(phoneRaw)){
    toast('رقم الهاتف غير صحيح، لازم يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015');
    document.getElementById('f_phone').focus();
    return;
  }
  const cleanPhone = phoneRaw.replace(/[\s\-]/g,'');
  if(cleanPhone){
    const dup = db.customers.find(c=>c.id!==id && c.phone===cleanPhone);
    if(dup){
      const ok = await appConfirm(`رقم الهاتف ده مسجل بالفعل للعميل "${dup.name}". هل تريد المتابعة؟`, {okText:'متابعة', danger:false});
      if(!ok) return;
    }
  }
  const data = {
    name,
    phone: cleanPhone,
    family: document.getElementById('f_family').value.trim(),
    chest: document.getElementById('f_chest').value,
    waist: document.getElementById('f_waist').value,
    length: document.getElementById('f_length').value,
    sleeve: document.getElementById('f_sleeve').value,
    shoulder: document.getElementById('f_shoulder').value,
    notes: document.getElementById('f_notes').value.trim(),
    updatedAt: Date.now(),
  };
  if(id){
    const c = customerById(id);
    const before = {...c};
    Object.assign(c, data);
    logActivity(`✏️ تعديل بيانات العميل ${name}`);
    setUndo('تعديل بيانات العميل', ()=>{
      Object.assign(c, before);
      saveDB();
      renderCustomers();
    });
  } else {
    data.id = uid();
    db.customers.push(data);
    logActivity(`➕ عميل جديد: ${name}`);
    setUndo('إضافة عميل جديد', ()=>{
      db.customers = db.customers.filter(x=>x.id!==data.id);
      saveDB();
      renderCustomers();
    });
  }
  saveDB();
  closeModal();
  renderCustomers();
  toast('تم الحفظ بنجاح ✅');
}

async function deleteCustomer(id){
  if(!await appConfirm('هل تريد حذف هذا العميل؟ سيتم الاحتفاظ بطلباته السابقة، ويمكنك استرجاعه خلال 7 أيام من سلة المحذوفات.')) return;
  const c = customerById(id);
  if(!c) return;
  db.customers = db.customers.filter(x=>x.id!==id);
  db.trash.push({id:uid(), type:'customer', deletedAt:todayStr(), data:c});
  logActivity(`🗑️ حذف عميل: ${c.name}`);
  saveDB();
  renderCustomers();
  toast('تم نقل العميل لسلة المحذوفات');
}

function printMeasurementCard(id){
  const c = customerById(id);
  if(!c) return;
  const html = `
    <html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>بطاقة مقاسات - ${escapeHtml(c.name)}</title>
    <style>
      body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;}
      h1{font-size:20px;border-bottom:2px solid #1F6D57;padding-bottom:8px;}
      table{width:100%;border-collapse:collapse;margin-top:14px;}
      td{padding:10px 6px;border-bottom:1px solid #ddd;font-size:15px;}
      td.lbl{color:#666;width:45%;}
      td.val{font-weight:bold;}
      tr.meas td.lbl{border-right:4px solid var(--rc,#1F6D57);padding-right:10px;}
      .notes{margin-top:16px;padding:10px;background:#f5f3ef;border-radius:8px;font-size:14px;}
    </style></head><body>
      ${printBrandHeaderHtml()}
      <h1>🧵 بطاقة مقاسات - ${escapeHtml(c.name)}</h1>
      <table>
        <tr><td class="lbl">اسم العميل</td><td class="val">${escapeHtml(c.name)}</td></tr>
        <tr><td class="lbl">رقم الهاتف</td><td class="val">${escapeHtml(c.phone||'-')}</td></tr>
        <tr class="meas" style="--rc:#1F6D57"><td class="lbl">الطول</td><td class="val">${c.length||'-'} سم</td></tr>
        <tr class="meas" style="--rc:#8F6626"><td class="lbl">طول الكم</td><td class="val">${c.sleeve||'-'} سم</td></tr>
        <tr class="meas" style="--rc:#2F5673"><td class="lbl">الصدر</td><td class="val">${c.chest||'-'} سم</td></tr>
        <tr class="meas" style="--rc:#93691C"><td class="lbl">الخزنة</td><td class="val">${c.waist||'-'} سم</td></tr>
        <tr class="meas" style="--rc:#A23B2C"><td class="lbl">وسع الكم</td><td class="val">${c.shoulder||'-'} سم</td></tr>
      </table>
      ${c.notes?`<div class="notes">📝 ملاحظات: ${escapeHtml(c.notes)}</div>`:''}
    </body></html>
  `;
  openPrintWindow(html, 'بطاقة_مقاسات_'+c.name);
}

function shareMeasurementCard(id){
  const c = customerById(id);
  if(!c) return;
  const msg =
`📏 بطاقة مقاسات - ${c.name}
${db.workshopName||'ورشة تفصيل الجلابيب'}

الطول: ${c.length||'-'} سم
طول الكم: ${c.sleeve||'-'} سم
الصدر: ${c.chest||'-'} سم
الخزنة: ${c.waist||'-'} سم
وسع الكم: ${c.shoulder||'-'} سم
${c.notes?'\nملاحظات: '+c.notes:''}`;

  if(navigator.share){
    navigator.share({title:'بطاقة مقاسات '+c.name, text:msg}).catch(()=>{});
    return;
  }
  let phone = (c.phone||'').replace(/[^0-9]/g,'');
  if(phone){
    if(phone.startsWith('0')) phone = '2'+phone; // مصر
    openWhatsAppChat(phone, msg);
  } else {
    openExternalLink(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  }
}

/* ============================================================
   الطلبات
   ============================================================ */
function setOrderFilter(f){
  currentOrderFilter = f;
  document.querySelectorAll('[id^="filt-"]').forEach(b=>b.classList.remove('active'));
  const btn = document.getElementById('filt-'+f);
  if(btn){ btn.style.background='var(--primary)'; btn.style.color='#fff'; }
  document.querySelectorAll('[id^="filt-"]').forEach(b=>{
    if(b.id!=='filt-'+f){ b.style.background=''; b.style.color=''; }
  });
  renderOrders();
}

function renderOrders(){
  const q = (document.getElementById('orderSearch').value||'').trim();
  const dateFrom = document.getElementById('orderDateFrom').value;
  const dateTo = document.getElementById('orderDateTo').value;
  let list = db.orders.slice().sort((a,b)=>(b.dateReceived||'').localeCompare(a.dateReceived||''));
  if(currentOrderFilter!=='all'){
    list = list.filter(o=>o.status===currentOrderFilter);
  }
  if(q){
    list = list.filter(o=>{
      const c = customerById(o.customerId);
      return (c && c.name.includes(q)) || orderTypeLabel(o).includes(q);
    });
  }
  if(dateFrom) list = list.filter(o=> o.dateReceived && o.dateReceived>=dateFrom);
  if(dateTo) list = list.filter(o=> o.dateReceived && o.dateReceived<=dateTo);

  const summaryBox = document.getElementById('orderDateFilterSummary');
  if(dateFrom || dateTo){
    const totalInRange = list.reduce((s,o)=>s+orderTotal(o),0);
    summaryBox.textContent = `${list.length} طلب في الفترة المحددة — بإجمالي ${totalInRange.toLocaleString('ar-EG')} ج.م`;
  } else {
    summaryBox.textContent = '';
  }

  const html = list.map(o=>{
    const c = customerById(o.customerId);
    return `<div class="card" data-status="${escapeHtml(o.status||'')}">
      <div class="row">
        <h3 class="name-row">${avatarChip(c?c.name:'؟')}${c?escapeHtml(c.name):'عميل محذوف'}</h3>
        ${statusBadge(o)}
      </div>
      <div class="meta">👗 النوع: ${escapeHtml(orderTypeLabel(o))}</div>
      <div class="meta">📅 الاستلام: ${fmtDate(o.dateReceived)} | التسليم: ${fmtDate(o.dateDelivery)}</div>
      <div class="meta">💰 الإجمالي: ${orderTotal(o).toLocaleString('ar-EG')} ج.م | المدفوع: ${(Number(o.paid)||0).toLocaleString('ar-EG')} | المتبقي: <b style="color:${orderRemaining(o)>0?'var(--danger)':'var(--ok)'}">${orderRemaining(o).toLocaleString('ar-EG')}</b></div>
      <div class="meta">⏱️ وقت الشغل الفعلي: ${o.workStartedAt ? `<b style="color:var(--accent);">جاري التسجيل الآن...</b>` : (o.actualMinutes?formatMinutesLabel(o.actualMinutes):'لم يبدأ بعد')}</div>
      ${o.updatedAt?`<div class="meta" style="opacity:.65;font-size:12px;">🕒 آخر تعديل: ${fmtActivityTime(o.updatedAt)}</div>`:''}
      <div class="btn-row">
        <button class="btn sm secondary" onclick="openOrderModal('${o.id}')">✏️ تعديل</button>
        <button class="btn sm outline" onclick="openPaymentModal('${o.id}')">💵 تسجيل دفعة</button>
        ${o.status!=='تم التسليم' ? (o.workStartedAt
          ? `<button class="btn sm accent" onclick="stopOrderWork('${o.id}')">⏹️ إنهاء الشغل</button>`
          : `<button class="btn sm outline" onclick="startOrderWork('${o.id}')">▶️ بدء الشغل</button>`) : ''}
        <button class="btn sm accent" onclick="sendWhatsApp('${o.id}')">📲 فاتورة واتساب</button>
        <button class="btn sm outline" onclick="printReceipt('${o.id}')">🖨️ إيصال</button>
        <button class="btn sm danger" onclick="deleteOrder('${o.id}')">🗑️ حذف</button>
      </div>
    </div>`;
  }).join('');
  document.getElementById('ordersList').innerHTML = html || `<div class="empty-msg">لا توجد طلبات مطابقة. اضغط ➕ لإضافة طلب جديد</div>`;
}

function customerOptions(selectedId){
  if(db.customers.length===0) return '<option value="">لا يوجد عملاء - أضف عميل أولاً</option>';
  return db.customers.map(c=>`<option value="${c.id}" ${c.id===selectedId?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
}

function garmentTypeOptionsHtml(matchedId){
  return itemTypeOptionsHtml(matchedId);
}

let currentEditingOrderId = null;
let dateManuallyEdited = false;

function itemTypeOptionsHtml(matchedId){
  let opts = '<option value="">اختر النوع...</option>';
  db.garmentTypes.slice().sort((a,b)=>a.name.localeCompare(b.name,'ar')).forEach(g=>{
    opts += `<option value="${g.id}" data-price="${g.price}" ${g.id===matchedId?'selected':''}>${escapeHtml(g.name)} — ${Number(g.price).toLocaleString('ar-EG')} ج.م</option>`;
  });
  opts += `<option value="__custom__" ${matchedId==='__custom__'?'selected':''}>نوع آخر (كتابة يدوي)</option>`;
  return opts;
}

function itemRowHtml(item){
  item = item || {};
  const qty = item.qty || 1;
  const unitPrice = item.unitPrice!==undefined ? item.unitPrice : '';
  let matchedId = '';
  if(item.type){
    const found = db.garmentTypes.find(g=>g.name===item.type);
    matchedId = found ? found.id : '__custom__';
  }
  return `
    <div class="card item-row" style="margin-bottom:8px;padding:12px;">
      <div class="field"><label>النوع</label>
        <select class="it-type" onchange="onItemTypeChange(this)">${itemTypeOptionsHtml(matchedId)}</select>
      </div>
      <div class="field it-customWrap" style="display:${matchedId==='__custom__'?'block':'none'};margin-bottom:12px;">
        <label>اكتب النوع يدوياً</label><input class="it-custom" value="${matchedId==='__custom__'?escapeHtml(item.type||''):''}">
      </div>
      <div class="field-row2">
        <div class="field"><label>عدد القطع</label><input class="it-qty" type="number" min="1" step="1" value="${qty}" oninput="onItemQtyPriceInput()"></div>
        <div class="field"><label>سعر القطعة (ج.م)</label><input class="it-price" type="number" value="${unitPrice}" oninput="onItemQtyPriceInput()"></div>
      </div>
      <button type="button" class="btn sm danger" onclick="removeItemRow(this)">🗑️ حذف هذا الصنف</button>
    </div>
  `;
}

function addItemRow(item){
  document.getElementById('itemsContainer').insertAdjacentHTML('beforeend', itemRowHtml(item));
}

function removeItemRow(btn){
  const rows = document.querySelectorAll('#itemsContainer .item-row');
  if(rows.length<=1){ toast('لازم يفضل صنف واحد على الأقل'); return; }
  btn.closest('.item-row').remove();
  recalcItemsTotal();
}

function onItemTypeChange(sel){
  const row = sel.closest('.item-row');
  const wrap = row.querySelector('.it-customWrap');
  if(sel.value==='__custom__'){
    wrap.style.display='block';
  } else {
    wrap.style.display='none';
    const opt = sel.options[sel.selectedIndex];
    const price = opt ? opt.getAttribute('data-price') : null;
    if(price!==null){ row.querySelector('.it-price').value = price; }
  }
  recalcItemsTotal();
}

function onItemQtyPriceInput(){
  recalcItemsTotal();
}

// تبديل تسمية حقل قيمة الخصم حسب نوعه (نسبة % أو مبلغ ثابت)
function onDiscountTypeChange(){
  const type = document.getElementById('f_discountType').value;
  const lbl = document.getElementById('f_discountValueLabel');
  if(lbl) lbl.textContent = type==='percent' ? 'قيمة الخصم (%)' : 'قيمة الخصم (ج.م)';
  recalcItemsTotal();
}

// إعادة حساب إجمالي أجرة كل الأصناف داخل الطلب، مع الخصم والضريبة والإجمالي النهائي
function recalcItemsTotal(){
  let sum = 0;
  document.querySelectorAll('#itemsContainer .item-row').forEach(row=>{
    const qty = Math.max(1, Number(row.querySelector('.it-qty').value)||1);
    const price = Number(row.querySelector('.it-price').value)||0;
    sum += qty*price;
  });
  const feeField = document.getElementById('f_feeTotal');
  if(feeField) feeField.textContent = sum.toLocaleString('ar-EG')+' ج.م';

  const extraEl = document.getElementById('f_extra');
  const extra = extraEl ? (Number(extraEl.value)||0) : 0;
  const subtotal = sum + extra;

  const discTypeEl = document.getElementById('f_discountType');
  const discValEl = document.getElementById('f_discountValue');
  const taxPctEl = document.getElementById('f_taxPercent');
  if(discTypeEl && discValEl && taxPctEl){
    const discType = discTypeEl.value;
    const discVal = Math.max(0, Number(discValEl.value)||0);
    let discountAmount = 0;
    if(discType==='percent') discountAmount = Math.min(subtotal, subtotal*discVal/100);
    else if(discType==='amount') discountAmount = Math.min(subtotal, discVal);
    const afterDiscount = subtotal - discountAmount;
    const taxPct = Math.max(0, Number(taxPctEl.value)||0);
    const taxAmount = afterDiscount * taxPct/100;
    const final = Math.max(0, afterDiscount + taxAmount);

    const set = (id, val)=>{ const el=document.getElementById(id); if(el) el.textContent = Math.round(val).toLocaleString('ar-EG')+' ج.م'; };
    set('sumSubtotal', subtotal);
    set('sumDiscount', discountAmount);
    set('sumTax', taxAmount);
    set('sumFinal', final);
  }

  autoSuggestDate(false);
  return sum;
}

function openOrderModal(id, presetCustomerId){
  const o = id ? db.orders.find(x=>x.id===id) : null;
  currentEditingOrderId = o ? o.id : null;
  dateManuallyEdited = !!o; // في التعديل لا نعيد الاقتراح تلقائياً فوق موعد محفوظ

  // بناء قائمة الأصناف: من مصفوفة items الجديدة، أو من الحقول القديمة (توافقاً مع الطلبات السابقة)
  let items = [];
  if(o){
    if(Array.isArray(o.items) && o.items.length){
      items = o.items;
    } else {
      items = [{type:o.type||'', qty:o.qty||1, unitPrice:(o.unitPrice!==undefined?o.unitPrice:o.fee)||0}];
    }
  }

  const html = `
    <div class="modal-head"><h3>${o?'✏️ تعديل طلب':'➕ طلب جديد'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="field"><label>العميل</label><select id="f_customer" onchange="renderOrderCustomerMeasurements()">${customerOptions(o?o.customerId:presetCustomerId)}</select></div>
    <div id="orderCustomerMeasurements" style="margin:-6px 0 12px;"></div>
    <div class="section-title" style="margin:6px 0 8px;font-size:14.5px;">👗 أصناف الطلب</div>
    <div id="itemsContainer">${items.map(it=>itemRowHtml(it)).join('') || itemRowHtml()}</div>
    <button type="button" class="btn sm secondary" style="margin-bottom:14px;" onclick="addItemRow()">➕ إضافة صنف آخر</button>
    <div class="field-row2">
      <div class="field"><label>تاريخ الاستلام</label><input id="f_dateReceived" type="date" value="${o?o.dateReceived:todayStr()}"></div>
      <div class="field"><label>تاريخ التسليم</label><input id="f_dateDelivery" type="date" value="${o?o.dateDelivery:''}" onchange="dateManuallyEdited=true;checkDeliveryDateWarning();"></div>
      <div id="f_dateDeliveryWarn" class="meta" style="color:var(--danger);margin-top:-8px;"></div>
    </div>
    <div class="btn-row" style="margin-top:-4px;margin-bottom:10px;">
      <button type="button" class="btn sm outline" onclick="autoSuggestDate(true)">📅 اقتراح موعد تلقائي</button>
    </div>
    <div class="field-row2">
      <div class="field"><label>مصاريف إضافية (ج.م)</label><input id="f_extra" type="number" value="${o?o.extra||0:0}" oninput="recalcItemsTotal()"></div>
      <div class="field"><label>إجمالي أجرة الأصناف</label><div style="padding:11px 0;font-weight:900;color:var(--heading);font-size:16px;" id="f_feeTotal">0 ج.م</div></div>
    </div>
    <div class="section-title" style="margin:6px 0 8px;font-size:14.5px;">💵 خصم وضريبة (اختياري)</div>
    <div class="field-row2">
      <div class="field"><label>نوع الخصم</label>
        <select id="f_discountType" onchange="onDiscountTypeChange()">
          <option value="none" ${(!o||!o.discountType||o.discountType==='none')?'selected':''}>بدون خصم</option>
          <option value="percent" ${o&&o.discountType==='percent'?'selected':''}>نسبة %</option>
          <option value="amount" ${o&&o.discountType==='amount'?'selected':''}>مبلغ ثابت (ج.م)</option>
        </select>
      </div>
      <div class="field"><label id="f_discountValueLabel">قيمة الخصم</label><input id="f_discountValue" type="number" min="0" value="${o&&o.discountValue?o.discountValue:0}" oninput="recalcItemsTotal()"></div>
    </div>
    <div class="field"><label>نسبة ضريبة/رسوم إضافية على هذا الطلب (%)</label><input id="f_taxPercent" type="number" min="0" step="0.1" value="${o?(o.taxPercent!==undefined?o.taxPercent:0):(db.taxDefaultPercent||0)}" oninput="recalcItemsTotal()"></div>
    <div class="card" id="orderTotalsBox" style="margin:4px 0 14px;padding:12px;background:var(--card-alt);">
      <div class="row"><span class="meta">الإجمالي الفرعي</span><b id="sumSubtotal">0 ج.م</b></div>
      <div class="row"><span class="meta">الخصم</span><b id="sumDiscount" style="color:var(--danger);">0 ج.م</b></div>
      <div class="row"><span class="meta">الضريبة/الرسوم</span><b id="sumTax">0 ج.م</b></div>
      <div class="row" style="border-top:1px dashed var(--stitch);margin-top:6px;padding-top:6px;"><span style="font-weight:700;">الإجمالي النهائي</span><b style="color:var(--heading);font-size:16px;" id="sumFinal">0 ج.م</b></div>
    </div>
    <div class="field"><label>تكلفة الخامة/القماش (ج.م) <span class="meta">— اختياري، لحساب صافي الربح</span></label><input id="f_materialCost" type="number" value="${o?o.materialCost||0:0}"></div>
    <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input id="f_urgent" type="checkbox" style="width:18px;height:18px;" ${o&&o.urgent?'checked':''}> 🔥 طلب مستعجل</label></div>
    <div class="field"><label>المدفوع مقدماً (ج.م)</label><input id="f_paid" type="number" value="${o?o.paid||0:0}" ${o?'disabled':''}></div>
    ${o?'<p class="meta">لتسجيل دفعة جديدة استخدم زر "تسجيل دفعة" من قائمة الطلبات.</p>':''}
    <div class="field"><label>الحالة</label>
      <select id="f_status">
        <option value="قيد العمل" ${o&&o.status==='قيد العمل'?'selected':''}>قيد العمل</option>
        <option value="جاهز للتسليم" ${o&&o.status==='جاهز للتسليم'?'selected':''}>جاهز للتسليم</option>
        <option value="تم التسليم" ${o&&o.status==='تم التسليم'?'selected':''}>تم التسليم</option>
      </select>
    </div>
    <button class="btn" onclick="saveOrder(${o?`'${o.id}'`:'null'})">💾 حفظ</button>
  `;
  openModal(html);
  onDiscountTypeChange();
  checkDeliveryDateWarning();
  renderOrderCustomerMeasurements();
}

// يعرض مقاسات العميل المختار كمرجع سريع أثناء إنشاء/تعديل الطلب، بدون الحاجة للرجوع لملفه
function renderOrderCustomerMeasurements(){
  const box = document.getElementById('orderCustomerMeasurements');
  if(!box) return;
  const sel = document.getElementById('f_customer');
  const cid = sel ? sel.value : '';
  const c = cid ? customerById(cid) : null;
  if(!c){ box.innerHTML=''; return; }
  const hasAny = c.length||c.sleeve||c.chest||c.waist||c.shoulder;
  if(!hasAny){
    box.innerHTML = `<div class="meta">📏 لا توجد مقاسات محفوظة لهذا العميل — <a href="javascript:void(0)" onclick="closeModal();openCustomerModal('${c.id}');" style="color:var(--primary);font-weight:600;">أضفها من ملفه</a></div>`;
    return;
  }
  box.innerHTML = `<div class="meas-chips-row" style="display:flex;flex-wrap:wrap;gap:6px;">
    <span class="meas-chip m-length">📏 <span class="meas-lbl">الطول</span> ${c.length||'-'}</span>
    <span class="meas-chip m-sleeve">📏 <span class="meas-lbl">طول الكم</span> ${c.sleeve||'-'}</span>
    <span class="meas-chip m-chest">📏 <span class="meas-lbl">الصدر</span> ${c.chest||'-'}</span>
    <span class="meas-chip m-waist">📏 <span class="meas-lbl">الخزنة</span> ${c.waist||'-'}</span>
    <span class="meas-chip m-shoulder">📏 <span class="meas-lbl">وسع الكم</span> ${c.shoulder||'-'}</span>
  </div>`;
}

// حساب قيمة الشغل المتبقي (غير المسلَّم) بالجنيه، باستثناء الطلب الجاري تعديله
function calcPendingWorkValue(excludeId){
  return db.orders
    .filter(o=>o.status!=='تم التسليم' && o.id!==excludeId)
    .reduce((s,o)=>s+orderTotal(o),0);
}

// متوسط أيام التأخير الفعلي عن الموعد المتوقع، بناءً على آخر الطلبات المسلَّمة فعلياً
function avgDelayDays(){
  const completed = db.orders.filter(o=>o.deliveredDate && o.dateDelivery).slice(-30);
  if(completed.length===0) return 0;
  const totalDelay = completed.reduce((s,o)=>{
    const diff = Math.round((new Date(o.deliveredDate)-new Date(o.dateDelivery))/86400000);
    return s+diff;
  },0);
  return totalDelay/completed.length;
}

// force=true يعني ضغط المستخدم على زر الاقتراح صراحةً (يتجاوز قفل التعديل اليدوي)
function autoSuggestDate(force){
  if(dateManuallyEdited && !force) return;
  let itemsSum = 0;
  document.querySelectorAll('#itemsContainer .item-row').forEach(row=>{
    const qty = Math.max(1, Number(row.querySelector('.it-qty').value)||1);
    const price = Number(row.querySelector('.it-price').value)||0;
    itemsSum += qty*price;
  });
  const extra = Number(document.getElementById('f_extra').value)||0;
  const capacity = Number(db.dailyCapacity)||500;
  const pending = calcPendingWorkValue(currentEditingOrderId) + itemsSum + extra;
  const daysNeeded = Math.max(1, Math.ceil(pending/capacity));
  const avgDelay = avgDelayDays();
  const safetyDays = avgDelay>0.5 ? 2+Math.ceil(avgDelay) : 2;
  const totalDays = daysNeeded + safetyDays;
  const suggested = addWorkDaysFromNow(totalDays);
  const suggestedStr = suggested.toISOString().slice(0,10);
  document.getElementById('f_dateDelivery').value = suggestedStr;
  dateManuallyEdited = !force ? dateManuallyEdited : false;
  checkDeliveryDateWarning();
  if(force) toast('تم اقتراح موعد تسليم مناسب 📅');
}

// يظهر تنبيه فوري تحت حقل تاريخ التسليم لو الموعد المختار يصادف عيد أو يوم الإجازة الأسبوعية
function checkDeliveryDateWarning(){
  const field = document.getElementById('f_dateDelivery');
  const warnBox = document.getElementById('f_dateDeliveryWarn');
  if(!field || !warnBox) return;
  const val = field.value;
  if(val && isDayOff(val)){
    warnBox.textContent = `⚠️ الموعد ده يصادف ${dayOffLabel(val)} (يوم إجازة)`;
  } else {
    warnBox.textContent = '';
  }
}

function saveOrder(id){
  const customerId = document.getElementById('f_customer').value;

  const items = [];
  let hasInvalidPrice = false;
  document.querySelectorAll('#itemsContainer .item-row').forEach(row=>{
    const typeSel = row.querySelector('.it-type');
    let type = '';
    if(typeSel.value==='__custom__'){
      type = row.querySelector('.it-custom').value.trim();
    } else {
      const g = db.garmentTypes.find(x=>x.id===typeSel.value);
      type = g ? g.name : '';
    }
    const qtyRaw = Number(row.querySelector('.it-qty').value);
    const qty = Math.max(1, qtyRaw||1);
    const priceRaw = Number(row.querySelector('.it-price').value);
    if(priceRaw<0){ hasInvalidPrice = true; }
    const unitPrice = Math.max(0, priceRaw||0);
    if(type){ items.push({type, qty, unitPrice}); }
  });

  const dateReceived = document.getElementById('f_dateReceived').value;
  const dateDelivery = document.getElementById('f_dateDelivery').value;
  const extra = Number(document.getElementById('f_extra').value)||0;
  const materialCost = Number(document.getElementById('f_materialCost').value)||0;
  const urgent = document.getElementById('f_urgent').checked;
  const status = document.getElementById('f_status').value;
  const fee = items.reduce((s,it)=>s+it.qty*it.unitPrice,0);
  const discountType = document.getElementById('f_discountType').value;
  const discountValue = Math.max(0, Number(document.getElementById('f_discountValue').value)||0);
  const taxPercent = Math.max(0, Number(document.getElementById('f_taxPercent').value)||0);

  if(!customerId){ toast('اختر عميل أولاً'); return; }
  if(items.length===0){ toast('أضف صنف واحد على الأقل واختر نوعه'); return; }
  if(hasInvalidPrice){ toast('السعر لا يمكن أن يكون رقماً سالباً'); return; }
  if(extra<0){ toast('المصاريف الإضافية لا يمكن أن تكون رقماً سالباً'); return; }
  if(materialCost<0){ toast('تكلفة الخامة لا يمكن أن تكون رقماً سالباً'); return; }
  if(discountType==='percent' && discountValue>100){ toast('نسبة الخصم لا يمكن أن تتعدى 100%'); return; }
  if(!dateDelivery){ toast('أدخل تاريخ التسليم'); return; }
  if(dateReceived && dateDelivery && dateDelivery<dateReceived){
    toast('تاريخ التسليم لا يمكن أن يكون قبل تاريخ الاستلام');
    return;
  }

  // نحتفظ بحقول type/qty/unitPrice على مستوى الطلب (من أول صنف) لأغراض التوافق مع نسخ سابقة من التطبيق
  const legacyType = items.map(it=>(it.qty>1?it.qty+' × ':'')+it.type).join('، ');

  if(id){
    const o = db.orders.find(x=>x.id===id);
    const before = JSON.parse(JSON.stringify(o));
    const wasDelivered = o.status==='تم التسليم';
    Object.assign(o, {customerId, items, type:legacyType, qty:undefined, unitPrice:undefined, dateReceived, dateDelivery, fee, extra, materialCost, urgent, status, discountType, discountValue, taxPercent, updatedAt:Date.now()});
    if(status==='تم التسليم' && !wasDelivered && !o.deliveredDate){
      o.deliveredDate = todayStr();
      finalizeWorkTimeIfRunning(o);
    }
    if(status!=='تم التسليم'){
      o.deliveredDate = null;
    }
    logActivity(`✏️ تعديل طلب ${customerById(customerId)?customerById(customerId).name:''}`);
    setUndo('تعديل الطلب', ()=>{
      const idx = db.orders.findIndex(x=>x.id===id);
      if(idx>-1) db.orders[idx] = before;
      saveDB();
      renderOrders();
      renderHome();
    });
  } else {
    const paid = Number(document.getElementById('f_paid').value)||0;
    if(paid<0){ toast('المبلغ المدفوع لا يمكن أن يكون رقماً سالباً'); return; }
    const newOrder = {id:uid(), customerId, items, type:legacyType, dateReceived, dateDelivery, fee, extra, materialCost, urgent, paid, status, discountType, discountValue, taxPercent, deliveredDate: status==='تم التسليم'?todayStr():null, invoiceNumber: db.nextInvoiceNumber||1001, updatedAt:Date.now()};
    db.nextInvoiceNumber = (db.nextInvoiceNumber||1001) + 1;
    if(paid>orderTotal(newOrder)){ toast('المبلغ المدفوع أكبر من إجمالي الطلب، تأكد من الرقم'); db.nextInvoiceNumber--; return; }
    db.orders.push(newOrder);
    let paymentRecord = null;
    if(paid>0){
      paymentRecord = {id:uid(), orderId:newOrder.id, amount:paid, date:dateReceived||todayStr()};
      db.payments.push(paymentRecord);
    }
    logActivity(`➕ طلب جديد لـ ${customerById(customerId)?customerById(customerId).name:''} بقيمة ${Math.round(orderTotal(newOrder)).toLocaleString('ar-EG')} ج.م`);
    setUndo('إضافة الطلب الجديد', ()=>{
      db.orders = db.orders.filter(x=>x.id!==newOrder.id);
      if(paymentRecord) db.payments = db.payments.filter(p=>p.id!==paymentRecord.id);
      saveDB();
      renderOrders();
      renderHome();
    });
  }
  saveDB();
  closeModal();
  renderOrders();
  toast('تم حفظ الطلب ✅');
}

async function deleteOrder(id){
  if(!await appConfirm('هل تريد حذف هذا الطلب؟ يمكنك استرجاعه خلال 7 أيام من سلة المحذوفات.')) return;
  const o = db.orders.find(x=>x.id===id);
  if(!o) return;
  const relatedPayments = db.payments.filter(p=>p.orderId===id);
  db.orders = db.orders.filter(x=>x.id!==id);
  db.payments = db.payments.filter(p=>p.orderId!==id);
  db.trash.push({id:uid(), type:'order', deletedAt:todayStr(), data:o, payments:relatedPayments});
  logActivity(`🗑️ حذف طلب ${customerById(o.customerId)?customerById(o.customerId).name:''}`);
  saveDB();
  renderOrders();
  toast('تم نقل الطلب لسلة المحذوفات');
}

/* ============================================================
   حاسبة تسعير سريعة — قبل تسجيل الطلب رسمياً
   ============================================================ */
let _pcLastResult = null;

function openPricingCalculatorModal(){
  _pcLastResult = null;
  const html = `
    <div class="modal-head"><h3>🧮 حاسبة تسعير سريعة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="meta">اختار نوع القطعة وعدد القطع، وهيديك سعر مقترح بناءً على متوسط أسعارك في الطلبات السابقة لنفس النوع — من غير ما تسجل طلب رسمي.</p>
    <div class="field"><label>نوع القطعة</label><select id="pc_type" onchange="onPcTypeChange()">${itemTypeOptionsHtml('')}</select></div>
    <div class="field it-customWrap" id="pc_customWrap" style="display:none;">
      <label>اكتب النوع يدوياً</label><input id="pc_custom" oninput="calcQuickPrice()">
    </div>
    <div class="field"><label>عدد القطع</label><input id="pc_qty" type="number" min="1" value="1" oninput="calcQuickPrice()"></div>
    <div id="pc_result"></div>
  `;
  openModal(html);
  calcQuickPrice();
}

function onPcTypeChange(){
  const sel = document.getElementById('pc_type');
  document.getElementById('pc_customWrap').style.display = sel.value==='__custom__' ? 'block' : 'none';
  calcQuickPrice();
}

function calcQuickPrice(){
  const sel = document.getElementById('pc_type');
  let typeName = '';
  if(sel.value==='__custom__'){
    typeName = document.getElementById('pc_custom').value.trim();
  } else {
    const g = db.garmentTypes.find(x=>x.id===sel.value);
    typeName = g ? g.name : '';
  }
  const qty = Math.max(1, Number(document.getElementById('pc_qty').value)||1);
  const box = document.getElementById('pc_result');
  _pcLastResult = null;
  if(!typeName){ box.innerHTML = '<div class="empty-msg">اختر أو اكتب نوع القطعة</div>'; return; }

  // اجمع كل أسعار القطع من الطلبات السابقة لنفس النوع
  const prices = [];
  db.orders.forEach(o=>{
    const items = Array.isArray(o.items)&&o.items.length ? o.items : [{type:o.type, unitPrice:(o.unitPrice!==undefined?o.unitPrice:o.fee)||0}];
    items.forEach(it=>{ if(it.type===typeName && Number(it.unitPrice)>0) prices.push(Number(it.unitPrice)); });
  });

  if(!prices.length){
    const g = db.garmentTypes.find(x=>x.name===typeName);
    if(g && g.price){
      const total = g.price*qty;
      box.innerHTML = `
        <div class="card" style="padding:12px;background:var(--card-alt);">
          <p class="meta" style="margin-top:0;">لا يوجد تاريخ طلبات سابقة لهذا النوع، فالسعر مقترح من السعر الأساسي المسجل له في الإعدادات.</p>
          <div class="row"><span class="meta">السعر الأساسي للقطعة</span><b>${Number(g.price).toLocaleString('ar-EG')} ج.م</b></div>
          <div class="row" style="border-top:1px dashed var(--stitch);margin-top:6px;padding-top:6px;"><span style="font-weight:700;">إجمالي مقترح لـ ${qty} قطعة</span><b style="color:var(--heading);font-size:16px;">${total.toLocaleString('ar-EG')} ج.م</b></div>
          <button class="btn sm secondary" style="margin-top:10px;width:100%;" onclick="useQuickPriceInNewOrder()">➕ إنشاء طلب بهذا السعر</button>
        </div>`;
      _pcLastResult = {typeName, qty, unitPrice: Math.round(g.price)};
    } else {
      box.innerHTML = '<div class="empty-msg">لا يوجد تاريخ أسعار سابق لهذا النوع بعد — أضف سعره الأساسي من الإعدادات أو اكتب سعر يدوي في الطلب.</div>';
    }
    return;
  }

  const avg = prices.reduce((a,b)=>a+b,0)/prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const total = Math.round(avg)*qty;
  box.innerHTML = `
    <div class="card" style="padding:12px;background:var(--card-alt);">
      <div class="row"><span class="meta">متوسط سعر القطعة (آخر ${prices.length} ${prices.length===1?'طلب':'طلبات'})</span><b>${Math.round(avg).toLocaleString('ar-EG')} ج.م</b></div>
      <div class="row"><span class="meta">أقل سعر سُجل</span><b>${min.toLocaleString('ar-EG')} ج.م</b></div>
      <div class="row"><span class="meta">أعلى سعر سُجل</span><b>${max.toLocaleString('ar-EG')} ج.م</b></div>
      <div class="row" style="border-top:1px dashed var(--stitch);margin-top:6px;padding-top:6px;"><span style="font-weight:700;">إجمالي مقترح لـ ${qty} قطعة</span><b style="color:var(--heading);font-size:16px;">${total.toLocaleString('ar-EG')} ج.م</b></div>
      <button class="btn sm secondary" style="margin-top:10px;width:100%;" onclick="useQuickPriceInNewOrder()">➕ إنشاء طلب بهذا السعر</button>
    </div>`;
  _pcLastResult = {typeName, qty, unitPrice: Math.round(avg)};
}

// يفتح فورم "طلب جديد" ويملأ أول صنف بالنوع والعدد والسعر المقترح من الحاسبة
function useQuickPriceInNewOrder(){
  if(!_pcLastResult) return;
  const r = _pcLastResult;
  openOrderModal(null);
  setTimeout(()=>{
    const row = document.querySelector('#itemsContainer .item-row');
    if(!row) return;
    const sel = row.querySelector('.it-type');
    const g = db.garmentTypes.find(x=>x.name===r.typeName);
    if(g){
      sel.value = g.id;
    } else {
      sel.value = '__custom__';
    }
    onItemTypeChange(sel);
    if(!g){ row.querySelector('.it-custom').value = r.typeName; }
    row.querySelector('.it-qty').value = r.qty;
    row.querySelector('.it-price').value = r.unitPrice;
    recalcItemsTotal();
  }, 90);
}

/* ---- تسجيل دفعة ---- */
function openPaymentModal(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  const remaining = orderRemaining(o);
  const html = `
    <div class="modal-head"><h3>💵 تسجيل دفعة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="meta">المتبقي الحالي: <b>${remaining.toLocaleString('ar-EG')} ج.م</b></p>
    <div class="field"><label>المبلغ المدفوع الآن (ج.م)</label><input id="f_payAmount" type="number" placeholder="0"></div>
    <div class="field"><label>التاريخ</label><input id="f_payDate" type="date" value="${todayStr()}"></div>
    <button class="btn" onclick="savePayment('${orderId}')">💾 حفظ الدفعة</button>
  `;
  openModal(html);
}

async function savePayment(orderId){
  const amount = Number(document.getElementById('f_payAmount').value)||0;
  const date = document.getElementById('f_payDate').value || todayStr();
  if(amount<=0){ toast('أدخل مبلغاً صحيحاً'); return; }
  const o = db.orders.find(x=>x.id===orderId);
  const remaining = orderRemaining(o);
  if(amount>remaining){
    const ok = await appConfirm(`💰 تنبيه مبلغ الدفعة\nالمتبقي على الطلب: ${remaining.toLocaleString('ar-EG')} ج.م\nالمبلغ المُدخل: ${amount.toLocaleString('ar-EG')} ج.م\n\nالمبلغ أكبر من المتبقي على الطلب. هل أنت متأكد من المبلغ؟`, {okText:'نعم، تسجيل', danger:false});
    if(!ok) return;
  }
  const beforePaid = Number(o.paid)||0;
  o.paid = beforePaid + amount;
  o.updatedAt = Date.now();
  const paymentRecord = {id:uid(), orderId, amount, date};
  db.payments.push(paymentRecord);
  logActivity(`💵 دفعة ${amount.toLocaleString('ar-EG')} ج.م من ${customerById(o.customerId)?customerById(o.customerId).name:''}`);
  setUndo('تسجيل الدفعة', ()=>{
    o.paid = beforePaid;
    db.payments = db.payments.filter(p=>p.id!==paymentRecord.id);
    saveDB();
    renderOrders();
    renderHome();
  });
  saveDB();
  closeModal();
  renderOrders();
  toast('تم تسجيل الدفعة ✅');
}

/* ---- فاتورة واتساب ----
   واتساب (زي أي تطبيق تاني) مابيسمحش لموقع يبعت ملف/صورة لمحادثة شخص معين
   تلقائيًا من غير تدخل المستخدم — ده قيد أمان من واتساب نفسه ضد السبام،
   مش قصور في الكود. كمان أي محاولة تلقائية (زي navigator.share بيتفتح
   لوحده) بتفتح قائمة اختيار جهات اتصال عامة، ولو المستخدم مركّزش ممكن
   الصورة تروح لشات غلط (زي "مراسلة نفسك") بدل شات العميل. عشان كده أفضل
   وأضمن طريقة هي: نعرض الإيصال كصورة حقيقية على الشاشة (مش نحاول نبعتها
   تلقائي)، والمستخدم بنفسه يضغط مطوّلاً عليها ويختار "مشاركة" فتفتح له
   واتساب وهو شايف الصورة قدامه فمش هيغلط في اختيار الشات؛ ده إجراء المتصفح
   الأصلي وشغال 100% على أي جهاز مهما كانت قيود الـ WebView. وبالتوازي بنديله
   زرار يفتح شات العميل بالتحديد فورًا مع نص الفاتورة، وزرار نسخ/مشاركة
   سريع كخيارات إضافية. */
let _waReceiptCtx = null;

async function sendWhatsApp(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  if(!o.invoiceNumber){ o.invoiceNumber = db.nextInvoiceNumber||1001; db.nextInvoiceNumber=(db.nextInvoiceNumber||1001)+1; saveDB(); }
  const c = customerById(o.customerId);
  if(!c || !c.phone){ toast('لا يوجد رقم هاتف مسجل لهذا العميل'); return; }
  let phone = c.phone.replace(/[^0-9]/g,'');
  if(phone.startsWith('0')) phone = '2'+phone; // مصر

  let dataUrl = null, blob = null;
  try{
    const canvas = await drawReceiptCanvas(orderId);
    dataUrl = canvas.toDataURL('image/png');
    blob = await new Promise(res=>canvas.toBlob(res, 'image/png'));
  }catch(e){
    console.warn('sendWhatsApp: فشل تجهيز صورة الإيصال', e);
  }
  const filename = 'فاتورة_'+(c.name||'طلب')+'.png';
  _waReceiptCtx = {phone, dataUrl, blob, filename, customerName: c.name};

  // محاولة تلقائية لحفظ الصورة في المعرض فور الضغط على الزر. ملحوظة مهمة:
  // أندرويد WebView (اللي بيلف عليه التطبيق ده كتطبيق مش متصفح) بيمنع تنزيل
  // ملفات blob: بصمت من غير أي رسالة خطأ — يعني المحاولة ممكن "تنجح" من غير
  // ما تحفظ حاجة فعليًا على الجهاز. ده قيد من أندرويد نفسه على تطبيقات الـ
  // WebView (زي WebIntoApp) مش قصور في الكود، ومفيش طريقة نضمن بيها إنها
  // تنجح 100% غير لو التطبيق الملفوف بيه فيه صلاحية/دعم تنزيل ملفات مفعّلة
  // من إعدادات لوحة تحكم WebIntoApp نفسها. عشان كده سايبين نافذة المودال
  // تحت فيها الصورة ظاهرة بشكل مباشر + طريقة الحفظ اليدوي (الضغط المطوّل)
  // كخطة مضمونة الشغل لو المحاولة التلقائية دي متأثرتش فعليًا.
  if(blob){
    try{
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 60000);
    }catch(e){
      console.warn('sendWhatsApp: فشلت محاولة التنزيل التلقائي', e);
    }
  }

  openModal(`
    <h3 style="margin-top:0;">🧾 فاتورة واتساب — ${escapeHtml(c.name)}</h3>
    ${dataUrl?`
      <img src="${dataUrl}" style="width:100%;border:1px solid #ddd;border-radius:8px;margin:6px 0 10px;display:block;" />
      <div style="font-size:13px;color:#666;margin-bottom:12px;line-height:1.6;">
        📥 حاولنا نحفظ الصورة تلقائي في المعرض. لو لقيتها موجودة، اضغط 📎 في شات العميل واختارها وابعتها.<br>
        📌 لو مش لاقيها: اضغط <b>مطوّلاً على الصورة فوق</b> واختار <b>"تنزيل الصورة" / "حفظ الصورة"</b> (مش نسخ) — طريقة مضمونة الشغل 100%.
      </div>
    `:`<div class="hint" style="margin-bottom:12px;">تعذر تجهيز صورة الإيصال</div>`}
    <div style="display:flex;flex-direction:column;gap:8px;">
      <button class="btn accent" onclick="waOpenCustomerChat()">💬 افتح شات ${escapeHtml(c.name)}</button>
      ${blob?`<button class="btn outline" onclick="waShareImage()">📤 مشاركة سريعة ⚠️ (تأكد تختار شات ${escapeHtml(c.name)})</button>`:''}
      <button class="btn secondary" onclick="closeModal()">إغلاق</button>
    </div>
  `);

  // نفتح شات العميل في نفس اللحظة، من غير نص جاهز — الصورة بس
  openWhatsAppChat(phone);
}

function waOpenCustomerChat(){
  if(!_waReceiptCtx) return;
  openWhatsAppChat(_waReceiptCtx.phone);
}

async function waShareImage(){
  if(!_waReceiptCtx || !_waReceiptCtx.blob) return;
  try{
    const file = new File([_waReceiptCtx.blob], _waReceiptCtx.filename, {type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title:_waReceiptCtx.filename});
      return;
    }
  }catch(e){
    if(e && e.name==='AbortError') return;
    console.warn('waShareImage: فشلت المشاركة', e);
  }
  toast('المشاركة مش مدعومة هنا — اضغط مطولاً على الصورة فوق واختار حفظ الصورة');
}

function sendReminder(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  const c = customerById(o.customerId);
  if(!c || !c.phone){ toast('لا يوجد رقم هاتف مسجل لهذا العميل'); return; }
  let phone = c.phone.replace(/[^0-9]/g,'');
  if(phone.startsWith('0')) phone = '2'+phone;
  const msg =
`تذكير من ${db.workshopName||'ورشة تفصيل الجلابيب'} 🧵
حضرتك، جلابيتك (${orderTypeLabel(o)}) هتكون جاهزة يوم ${fmtDate(o.dateDelivery)} إن شاء الله.
المتبقي: ${orderRemaining(o).toLocaleString('ar-EG')} ج.م
في انتظار حضرتك 🙏`;
  openWhatsAppChat(phone, msg);
}

/* أنماط CSS لورقة الإيصال — مستخدمة في نافذة الطباعة وفي نسخة الصورة اللي بتتبعت في واتساب.
   تصميم بطاقة احترافية: شريط علوي ملون + شريط عنوان بلون داكن مع شارة رقم الفاتورة +
   جدول أصناف مقسّم بألوان متبادلة + صندوق إجمالي مميز + خاتمة شكر. الألوان بتتاخد من
   ثيم التطبيق (db.theme) عن طريق متغيرات CSS --pc/--pd عشان الفاتورة تفضل متناسقة مع
   هوية الورشة لو اتغيرت الألوان من الإعدادات. */
/* النصوص والألوان الافتراضية لكل سطر في إيصال الفاتورة — أي سطر مش موجود في
   db.invoiceCustom بيرجع لقيمته الافتراضية هنا، عشان الفاتورة تفضل شغالة حتى
   لو المستخدم عدّل جزء بسيط بس. */
const DEFAULT_INVOICE_CUSTOM = {
  labels: {
    title: '🧾 إيصال تفصيل جلابة',
    badgePrefix: 'رقم',
    clientLabel: 'العميل',
    phoneLabel: 'الهاتف',
    receivedLabel: 'تاريخ الاستلام',
    deliveryLabel: 'تاريخ التسليم المتوقع',
    colType: 'الصنف',
    colQty: 'العدد',
    colUnitPrice: 'سعر القطعة',
    colTotal: 'الإجمالي',
    extraLabel: 'مصاريف إضافية',
    discountLabel: 'الخصم',
    taxLabel: 'الضريبة/الرسوم',
    totalLabel: 'الإجمالي',
    paidLabel: 'المدفوع',
    remainingLabel: 'المتبقي',
    footerText: 'شكرًا لثقتكم بنا 🌿'
  },
  colors: {
    subText: '#777777',
    titleText: '#ffffff',
    labelText: '#888888',
    valueText: '#222222',
    itemsHeadBg: '',
    itemsHeadText: '#ffffff',
    rowAltBg: '#faf9f6',
    totalsBg: '#f8f6f1',
    footerText: '#999999'
  }
};

// بيدمج تخصيصات المستخدم (db.invoiceCustom) فوق القيم الافتراضية — أي سطر المستخدم
// مسّاش (لسه فاضي) بيفضل ياخد القيمة الافتراضية بدل ما يبوّظ شكل الفاتورة
function getInvoiceCustom(){
  const uc = (db && db.invoiceCustom) || {};
  return {
    labels: {...DEFAULT_INVOICE_CUSTOM.labels, ...(uc.labels||{})},
    colors: {...DEFAULT_INVOICE_CUSTOM.colors, ...(uc.colors||{})}
  };
}

const RECEIPT_STYLE = `
  .inv-card{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;
    box-shadow:0 3px 20px rgba(0,0,0,.09);border:1px solid #ececec;}
  .inv-topbar{height:6px;background:var(--pc,#1F6D57);}
  .inv-header{text-align:center;padding:20px 20px 14px;}
  .inv-logo{width:58px;height:58px;border-radius:50%;object-fit:cover;margin:0 auto 8px;display:block;border:2px solid var(--pc,#1F6D57);}
  .inv-brand{font-size:19px;font-weight:900;color:var(--pc,#1F6D57);}
  .inv-sub{font-size:12.5px;color:var(--subc,#777);margin-top:3px;}
  .inv-titlebar{display:flex;align-items:center;justify-content:space-between;background:var(--pd,#123C2F);color:var(--ttlc,#fff);padding:12px 20px;}
  .inv-titlebar h1{font-size:16.5px;margin:0;border:none;padding:0;color:var(--ttlc,#fff);font-weight:900;}
  .inv-badge{background:rgba(255,255,255,.16);color:var(--ttlc,#fff);padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;}
  .inv-body{padding:18px 20px 6px;}
  table{width:100%;border-collapse:collapse;}
  td{padding:9px 4px;border-bottom:1px solid #f0f0f0;font-size:14px;}
  td.lbl{color:var(--lblc,#888);width:45%;}
  td.val{font-weight:700;color:var(--valc,#222);}
  .items-table{margin-top:8px;border:1px solid #ececec;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;}
  .items-table th{text-align:right;font-size:11.5px;color:var(--ihtext,#fff);background:var(--ihbg,var(--pc,#1F6D57));padding:9px 8px;font-weight:700;border:none;}
  .items-table td{font-size:13px;padding:8px;border-bottom:1px solid #f2f2f2;}
  .items-table tr:last-child td{border-bottom:none;}
  .items-table tr:nth-child(even) td{background:var(--rowalt,#faf9f6);}
  .totals-box{margin-top:14px;background:var(--totbg,#f8f6f1);border-radius:10px;padding:2px 12px;}
  .total-row td{font-size:16.5px;color:var(--pc,#1F6D57);border-top:2px solid var(--pc,#1F6D57);border-bottom:none;padding-top:12px;}
  .remaining-ok{color:#1F6D57!important;}
  .remaining-due{color:#B03A2E!important;}
  .inv-footer{text-align:center;padding:14px 20px 18px;font-size:12px;color:var(--ftc,#999);border-top:1px dashed #e2e2e2;margin-top:8px;}
`;

/* بيبني جسم ورقة الإيصال (نفس التصميم الاحترافي) من غير <html>/<head> عشان
   يتقدر يتحط جوه نافذة طباعة أو جوه عنصر مخفي بيتحول لصورة PNG لواتساب. */
function buildReceiptBodyHtml(orderId, opts){
  opts = opts || {};
  const o = opts.order || db.orders.find(x=>x.id===orderId);
  if(!o) return '';
  if(!opts.preview && !o.invoiceNumber){ o.invoiceNumber = db.nextInvoiceNumber||1001; db.nextInvoiceNumber=(db.nextInvoiceNumber||1001)+1; saveDB(); }
  const c = customerById(o.customerId);
  const discount = orderDiscountAmount(o);
  const tax = orderTaxAmount(o);
  const total = orderTotal(o);
  const remaining = orderRemaining(o);
  const theme = db.theme||{};
  const primary = theme.primary||'#1F6D57';
  const primaryDark = theme.primaryDark||'#123C2F';
  const name = db.workshopName||'ورشة تفصيل الجلابيب';
  const contactLines = [];
  if(db.ownerName) contactLines.push(escapeHtml(db.ownerName));
  if(db.ownerPhone) contactLines.push('📞 '+escapeHtml(db.ownerPhone));
  if(db.workshopAddress) contactLines.push('📍 '+escapeHtml(db.workshopAddress));
  const ic = getInvoiceCustom();
  const L = ic.labels, K = ic.colors;
  const cardVars = [
    `--pc:${primary}`, `--pd:${primaryDark}`,
    `--subc:${K.subText}`, `--ttlc:${K.titleText}`,
    `--lblc:${K.labelText}`, `--valc:${K.valueText}`,
    `--ihbg:${K.itemsHeadBg||primary}`, `--ihtext:${K.itemsHeadText}`,
    `--rowalt:${K.rowAltBg}`, `--totbg:${K.totalsBg}`, `--ftc:${K.footerText}`
  ].join(';');
  return `
    <div class="inv-card" style="${cardVars};">
      <div class="inv-topbar"></div>
      <div class="inv-header">
        ${db.workshopLogo?`<img src="${db.workshopLogo}" class="inv-logo">`:''}
        <div class="inv-brand">${escapeHtml(name)}</div>
        ${contactLines.map(l=>`<div class="inv-sub">${l}</div>`).join('')}
      </div>
      <div class="inv-titlebar">
        <h1>${escapeHtml(L.title)}</h1>
        <span class="inv-badge">${escapeHtml(L.badgePrefix)} ${o.invoiceNumber || (opts.preview?'معاينة':'-')}</span>
      </div>
      <div class="inv-body">
        <table>
          <tr><td class="lbl">${escapeHtml(L.clientLabel)}</td><td class="val">${escapeHtml(c?c.name:'-')}</td></tr>
          <tr><td class="lbl">${escapeHtml(L.phoneLabel)}</td><td class="val">${escapeHtml(c?c.phone||'-':'-')}</td></tr>
          <tr><td class="lbl">${escapeHtml(L.receivedLabel)}</td><td class="val">${fmtDate(o.dateReceived)}</td></tr>
          <tr><td class="lbl">${escapeHtml(L.deliveryLabel)}</td><td class="val">${fmtDate(o.dateDelivery)}</td></tr>
        </table>
        <table class="items-table">
          <tr><th>${escapeHtml(L.colType)}</th><th>${escapeHtml(L.colQty)}</th><th>${escapeHtml(L.colUnitPrice)}</th><th>${escapeHtml(L.colTotal)}</th></tr>
          ${(Array.isArray(o.items)&&o.items.length?o.items:[{type:o.type,qty:o.qty||1,unitPrice:o.unitPrice||o.fee||0}]).map(it=>`
            <tr>
              <td>${escapeHtml(it.type)}</td>
              <td>${it.qty||1}</td>
              <td>${(Number(it.unitPrice)||0).toLocaleString('ar-EG')} ج.م</td>
              <td>${((it.qty||1)*(Number(it.unitPrice)||0)).toLocaleString('ar-EG')} ج.م</td>
            </tr>
          `).join('')}
        </table>
        <div class="totals-box">
          <table>
            <tr><td class="lbl">${escapeHtml(L.extraLabel)}</td><td class="val">${o.extra||0} ج.م</td></tr>
            ${discount>0?`<tr><td class="lbl">${escapeHtml(L.discountLabel)}</td><td class="val">-${Math.round(discount).toLocaleString('ar-EG')} ج.م</td></tr>`:''}
            ${tax>0?`<tr><td class="lbl">${escapeHtml(L.taxLabel)}</td><td class="val">+${Math.round(tax).toLocaleString('ar-EG')} ج.م</td></tr>`:''}
            <tr class="total-row"><td class="lbl">${escapeHtml(L.totalLabel)}</td><td class="val">${Math.round(total).toLocaleString('ar-EG')} ج.م</td></tr>
            <tr><td class="lbl">${escapeHtml(L.paidLabel)}</td><td class="val">${o.paid||0} ج.م</td></tr>
            <tr><td class="lbl">${escapeHtml(L.remainingLabel)}</td><td class="val ${remaining>0?'remaining-due':'remaining-ok'}">${Math.round(remaining).toLocaleString('ar-EG')} ج.م</td></tr>
          </table>
        </div>
      </div>
      <div class="inv-footer">${escapeHtml(L.footerText)}</div>
    </div>
  `;
}

function printReceipt(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  const c = customerById(o.customerId);
  const html = `
    <html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>إيصال - ${escapeHtml(c?c.name:'')}</title>
    <style>
      body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;background:#f3f1ec;}
      ${RECEIPT_STYLE}
      @media print{
        body{background:#fff;padding:0;}
        .inv-card{box-shadow:none;border:1px solid #ddd;}
      }
    </style></head><body>
      ${buildReceiptBodyHtml(orderId)}
    </body></html>
  `;
  openPrintWindow(html, 'إيصال_'+(c?c.name:'طلب'));
}

// بيرجّع أحدث طلب حقيقي في السجل لاستخدامه في معاينة تصميم الفاتورة، ولو مفيش طلبات
// خالص بيبني طلب وهمي مؤقت (مش بيتحفظ في قاعدة البيانات) بس عشان تتشاف المعاينة
function sampleOrderForPreview(){
  if(Array.isArray(db.orders) && db.orders.length) return db.orders[db.orders.length-1];
  return {
    id:'__preview__',
    customerId:null,
    items:[{type:'جلابة قطن', qty:1, unitPrice:225}],
    extra:0, paid:0, discountType:'none', taxPercent:0,
    dateReceived:new Date().toISOString().slice(0,10),
    dateDelivery:new Date().toISOString().slice(0,10)
  };
}

// بيبني (أول مرة بس) بطاقة "شكل الفاتورة" داخل صفحة الإعدادات، وبعد كده بيحدّث محتواها
// في كل مرة تتفتح فيها الإعدادات — عشان صاحب الورشة يشوف شكل الإيصال فورًا بنفس الألوان
// والشعار المسجلين، من غير ما يحتاج يطبع أو يبعت واتساب للتجربة
function renderInvoicePreviewCard(){
  const anchorInput = document.getElementById('workshopNameInput');
  if(!anchorInput) return;
  let card = document.getElementById('invoicePreviewCard');
  if(!card){
    card = document.createElement('div');
    card.id = 'invoicePreviewCard';
    card.className = 'card';
    card.innerHTML = `
      <h3 style="margin-top:0;">🧾 شكل الفاتورة</h3>
      <p class="meta" style="margin-top:-6px;">معاينة حية لشكل إيصال الفاتورة بنفس اسم الورشة وشعارها وألوانها — أي تعديل تحفظه بالأعلى هيتحدث هنا فورًا.</p>
      <div id="invoicePreviewBox" style="background:#f3f1ec;border-radius:12px;padding:16px 8px;overflow:auto;"></div>
      <div class="row" style="margin-top:10px;">
        <button class="btn" onclick="printInvoicePreviewSample()">🖨️ تجربة طباعة</button>
      </div>
    `;
    // نحطها بعد أقرب "card" لحقل اسم الورشة مباشرة — بدل الاعتماد على تخمين هوية حاوية صفحة الإعدادات
    const anchorCard = anchorInput.closest('.card') || anchorInput.closest('section') || anchorInput.parentElement;
    if(anchorCard && anchorCard.parentNode){
      anchorCard.parentNode.insertBefore(card, anchorCard.nextSibling);
    } else {
      anchorInput.parentElement.appendChild(card);
    }
  }
  const box = document.getElementById('invoicePreviewBox');
  if(box) box.innerHTML = `<style>${RECEIPT_STYLE}</style>` + buildReceiptBodyHtml(null, {order: sampleOrderForPreview(), preview:true});
}

// يطبع نفس الطلب المعروض في معاينة الإعدادات، للتأكد إن ورقة الطباعة الفعلية مطابقة للمعاينة
function printInvoicePreviewSample(){
  const o = sampleOrderForPreview();
  const c = customerById(o.customerId);
  const html = `
    <html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>معاينة إيصال</title>
    <style>
      body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;background:#f3f1ec;}
      ${RECEIPT_STYLE}
      @media print{
        body{background:#fff;padding:0;}
        .inv-card{box-shadow:none;border:1px solid #ddd;}
      }
    </style></head><body>
      ${buildReceiptBodyHtml(null, {order:o, preview:true})}
    </body></html>
  `;
  openPrintWindow(html, 'معاينة_إيصال_'+(c?c.name:'تجربة'));
}

// يحمّل صورة (زي شعار الورشة) كـ Promise عشان نقدر نرسمها على Canvas بعد ما تخلص تحميل فعليًا
function loadImageAsync(src){
  return new Promise((resolve)=>{
    if(!src){ resolve(null); return; }
    const img = new Image();
    img.onload = ()=>resolve(img);
    img.onerror = ()=>resolve(null);
    img.src = src;
  });
}

// يرسم مسار مستطيل بزوايا دائرية — مستخدم لرسم البطاقة والشارات والصندوقات على الـ Canvas
function roundRectPath(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

/* بيرسم إيصال الفاتورة بنفس التصميم الاحترافي (بطاقة بزوايا دائرية، شريط علوي وعنوان
   ملوّنين، شارة رقم فاتورة، جدول أصناف مقسّم بألوان متبادلة، صندوق إجمالي مميز، خاتمة شكر)
   مباشرة على Canvas — من غير أي مكتبة خارجية أو اتصال إنترنت، عشان يشتغل 100% جوه أي
   WebView/تطبيق. بيرجّع الـ canvas الجاهز. دالة async عشان تقدر تنتظر تحميل شعار الورشة. */
async function drawReceiptCanvas(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  if(!o.invoiceNumber){ o.invoiceNumber = db.nextInvoiceNumber||1001; db.nextInvoiceNumber=(db.nextInvoiceNumber||1001)+1; saveDB(); }
  const c = customerById(o.customerId);
  const discount = orderDiscountAmount(o);
  const tax = orderTaxAmount(o);
  const total = orderTotal(o);
  const remaining = orderRemaining(o);
  const items = (Array.isArray(o.items)&&o.items.length?o.items:[{type:o.type,qty:o.qty||1,unitPrice:o.unitPrice||o.fee||0}]);

  const theme = db.theme||{};
  const primary = theme.primary || '#1F6D57';
  const primaryDark = theme.primaryDark || '#123C2F';
  const ic = getInvoiceCustom();
  const L = ic.labels, K = ic.colors;
  const itemsHeadBg = K.itemsHeadBg || primary;

  const brandLines = [db.workshopName||'ورشة تفصيل الجلابيب'];
  if(db.ownerName) brandLines.push(db.ownerName);
  if(db.ownerPhone) brandLines.push('📞 '+db.ownerPhone);
  if(db.workshopAddress) brandLines.push('📍 '+db.workshopAddress);

  const infoRows = [
    [L.clientLabel, c?c.name:'-'],
    [L.phoneLabel, c?(c.phone||'-'):'-'],
    [L.receivedLabel, fmtDate(o.dateReceived)],
    [L.deliveryLabel, fmtDate(o.dateDelivery)]
  ];
  const totalsRows = [[L.extraLabel, (o.extra||0)+' ج.م', false, false]];
  if(discount>0) totalsRows.push([L.discountLabel, '-'+Math.round(discount).toLocaleString('ar-EG')+' ج.م', false, false]);
  if(tax>0) totalsRows.push([L.taxLabel, '+'+Math.round(tax).toLocaleString('ar-EG')+' ج.م', false, false]);
  totalsRows.push([L.totalLabel, Math.round(total).toLocaleString('ar-EG')+' ج.م', true, false]);
  totalsRows.push([L.paidLabel, (o.paid||0)+' ج.م', false, false]);
  totalsRows.push([L.remainingLabel, Math.round(remaining).toLocaleString('ar-EG')+' ج.م', false, remaining>0]);

  const logoImg = db.workshopLogo ? await loadImageAsync(db.workshopLogo) : null;

  const FONT = 'Tahoma, Arial, sans-serif';
  const OM = 14;   // هامش صفحة رفيع حوالين البطاقة (يظهر خلفها كإطار خفيف)
  const CW = 580;  // عرض البطاقة
  const PAD = 24;  // حشو داخلي
  const ROW_H = 36;

  const logoSize = logoImg ? 60 : 0;
  const headerH = 62 + (logoImg?logoSize+10:0) + (brandLines.length-1)*18;
  const titleBarH = 46;
  const infoH = infoRows.length*ROW_H;
  const itemHeadH = 32, itemRowH = 34;
  const itemsH = itemHeadH + items.length*itemRowH;
  const totalsPadV = 10;
  const totalsH = totalsPadV*2 + totalsRows.length*ROW_H;
  const GAP = 16;
  const footerH = 40;

  const CH = headerH + titleBarH + PAD + infoH + GAP + itemsH + GAP + totalsH + GAP + footerH + PAD;
  const W = CW + OM*2;
  const H = CH + OM*2;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W*scale; canvas.height = H*scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';

  // خلفية الصفحة خلف البطاقة
  ctx.fillStyle = '#f3f1ec';
  ctx.fillRect(0,0,W,H);

  // ظل خفيف تحت البطاقة
  ctx.save();
  roundRectPath(ctx, OM+2, OM+3, CW, CH, 18);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fill();
  ctx.restore();

  // البطاقة البيضاء (كل المحتوى بيترسم جوه القص ده عشان الزوايا تفضل دائرية)
  ctx.save();
  roundRectPath(ctx, OM, OM, CW, CH, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();

  const X0 = OM, X1 = OM+CW;
  let y = OM;

  // الشريط العلوي الملون
  ctx.fillStyle = primary;
  ctx.fillRect(X0, y, CW, 6);
  y += 6 + 16;

  // شعار الورشة (لو موجود) واسمها وبيانات التواصل
  if(logoImg){
    const cx = OM+CW/2, cy = y+logoSize/2;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, logoSize/2, 0, Math.PI*2); ctx.closePath(); ctx.clip();
    ctx.drawImage(logoImg, cx-logoSize/2, cy-logoSize/2, logoSize, logoSize);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, logoSize/2, 0, Math.PI*2);
    ctx.lineWidth = 2; ctx.strokeStyle = primary; ctx.stroke();
    ctx.restore();
    y += logoSize + 10;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = primary;
  ctx.font = '900 19px '+FONT;
  ctx.fillText(brandLines[0], OM+CW/2, y+10);
  y += 26;
  ctx.font = '13px '+FONT;
  ctx.fillStyle = K.subText;
  for(let i=1;i<brandLines.length;i++){
    ctx.fillText(brandLines[i], OM+CW/2, y+8);
    y += 18;
  }
  y += 14;

  // شريط العنوان الملوّن + شارة رقم الفاتورة
  ctx.fillStyle = primaryDark;
  ctx.fillRect(X0, y, CW, titleBarH);
  ctx.textAlign = 'right';
  ctx.fillStyle = K.titleText;
  ctx.font = '900 17px '+FONT;
  ctx.fillText(L.title, X1-PAD, y+titleBarH/2);
  const badgeText = L.badgePrefix+' '+(o.invoiceNumber||'-');
  ctx.font = '12px '+FONT;
  const badgeW = ctx.measureText(badgeText).width + 20;
  const badgeH = 24;
  const badgeX = X0+PAD, badgeY = y+(titleBarH-badgeH)/2;
  ctx.save();
  roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.fillStyle = K.titleText;
  ctx.fillText(badgeText, badgeX+badgeW/2, badgeY+badgeH/2);
  y += titleBarH + PAD;

  const solidLine = (yy, color, width)=>{
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(X0+PAD,yy); ctx.lineTo(X1-PAD,yy); ctx.stroke();
    ctx.restore();
  };
  const dashedLine = (yy)=>{
    ctx.save();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(X0+PAD,yy); ctx.lineTo(X1-PAD,yy); ctx.stroke();
    ctx.restore();
  };
  const labelValueRow = (yy, label, value, big, danger)=>{
    ctx.textAlign = 'right';
    ctx.fillStyle = big ? primary : K.labelText;
    ctx.font = (big?'bold 17px ':'14px ')+FONT;
    ctx.fillText(label, X1-PAD, yy+ROW_H/2);
    ctx.textAlign = 'left';
    ctx.fillStyle = big ? primary : (danger ? '#B03A2E' : K.valueText);
    ctx.font = (big?'bold 17px ':'bold 14px ')+FONT;
    ctx.fillText(String(value), X0+PAD, yy+ROW_H/2);
    if(!big) solidLine(yy+ROW_H, '#f0f0f0', 1);
  };

  // صفوف بيانات العميل
  infoRows.forEach(([lbl,val])=>{ labelValueRow(y, lbl, val, false, false); y += ROW_H; });
  y += GAP;

  // جدول الأصناف (نفس تقسيم الأعمدة القديم، بس بمرجعية X0/X1 الجديدة)
  const totalColLeft = X0+PAD+90;
  const priceColRight = totalColLeft+120;
  const qtyColRight = priceColRight+64;
  const nameColRight = X1-PAD;

  ctx.fillStyle = itemsHeadBg;
  ctx.fillRect(X0+PAD, y, CW-2*PAD, itemHeadH);
  ctx.font = '12px '+FONT;
  ctx.fillStyle = K.itemsHeadText;
  ctx.textAlign='right'; ctx.fillText(L.colType, nameColRight, y+itemHeadH/2);
  ctx.textAlign='center'; ctx.fillText(L.colQty, qtyColRight-32, y+itemHeadH/2);
  ctx.textAlign='center'; ctx.fillText(L.colUnitPrice, priceColRight-60, y+itemHeadH/2);
  ctx.textAlign='left'; ctx.fillText(L.colTotal, totalColLeft-90, y+itemHeadH/2);
  y += itemHeadH;
  const itemsTopY = y;
  items.forEach((it,idx)=>{
    const qty = it.qty||1;
    const price = Number(it.unitPrice)||0;
    if(idx%2===1){
      ctx.fillStyle = K.rowAltBg;
      ctx.fillRect(X0+PAD, y, CW-2*PAD, itemRowH);
    }
    ctx.font = '13px '+FONT;
    ctx.fillStyle = '#222';
    ctx.textAlign='right'; ctx.fillText(String(it.type||''), nameColRight, y+itemRowH/2);
    ctx.textAlign='center'; ctx.fillText(String(qty), qtyColRight-32, y+itemRowH/2);
    ctx.textAlign='center'; ctx.fillText(price.toLocaleString('ar-EG')+' ج.م', priceColRight-60, y+itemRowH/2);
    ctx.textAlign='left'; ctx.fillText((qty*price).toLocaleString('ar-EG')+' ج.م', totalColLeft-90, y+itemRowH/2);
    y += itemRowH;
    if(idx<items.length-1) solidLine(y, '#f2f2f2', 1);
  });
  ctx.save();
  ctx.strokeStyle = '#ececec'; ctx.lineWidth = 1;
  ctx.strokeRect(X0+PAD+0.5, itemsTopY-itemHeadH+0.5, CW-2*PAD-1, itemsH-1);
  ctx.restore();
  y += GAP;

  // صندوق المصاريف والإجمالي (خلفية مميزة)
  ctx.save();
  roundRectPath(ctx, X0+PAD, y, CW-2*PAD, totalsH, 10);
  ctx.fillStyle = K.totalsBg;
  ctx.fill();
  ctx.restore();
  y += totalsPadV;
  totalsRows.forEach(([lbl,val,big,danger])=>{ labelValueRow(y, lbl, val, big, danger); y += ROW_H; });
  y += totalsPadV;
  y += GAP;

  // خط متقطع وخاتمة شكر
  dashedLine(y);
  y += 22;
  ctx.textAlign = 'center';
  ctx.fillStyle = K.footerText;
  ctx.font = '13px '+FONT;
  ctx.fillText(L.footerText, OM+CW/2, y);

  ctx.restore(); // فك القص عن حدود البطاقة

  // إطار رفيع حوالين البطاقة
  ctx.save();
  roundRectPath(ctx, OM, OM, CW, CH, 18);
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  return canvas;
}

function printOrderLabel(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  const c = customerById(o.customerId);
  const shortId = o.id.slice(-5).toUpperCase();
  const html = `
    <html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>ملصق - ${escapeHtml(c?c.name:'')}</title>
    <style>
      @page{ size:80mm 50mm; margin:4mm; }
      body{font-family:Tahoma,Arial,sans-serif;color:#111;margin:0;padding:10px;}
      .label{border:2px dashed #1F6D57;border-radius:10px;padding:10px 12px;}
      .label h1{font-size:16px;margin:0 0 6px;color:#1F6D57;}
      .label .row{display:flex;justify-content:space-between;font-size:12.5px;margin:3px 0;}
      .label .row b{font-weight:700;}
      .label .code{margin-top:6px;text-align:center;font-size:18px;font-weight:900;letter-spacing:2px;border-top:1px dashed #ccc;padding-top:6px;}
    </style></head><body>
      <div class="label">
        <div style="font-size:10.5px;color:#888;margin-bottom:2px;">${escapeHtml(db.workshopName||'ورشة تفصيل الجلابيب')}</div>
        <h1>🧵 ${escapeHtml(c?c.name:'عميل')}</h1>
        <div class="row"><span>النوع</span><b>${escapeHtml(orderTypeLabel(o))}</b></div>
        <div class="row"><span>الاستلام</span><b>${fmtDate(o.dateReceived)}</b></div>
        <div class="row"><span>التسليم</span><b>${fmtDate(o.dateDelivery)}</b></div>
        <div class="code">#${shortId}</div>
      </div>
    </body></html>
  `;
  openPrintWindow(html, 'ملصق_'+(c?c.name:'طلب'));
}

/* ============================================================
   المواعيد
   ============================================================ */
function renderDeliveriesCalendar(){
  const box = document.getElementById('deliveriesCalendar');
  if(!box) return;
  if(!calendarMonth) calendarMonth = todayStr().slice(0,7);

  const [y,m] = calendarMonth.split('-').map(Number);
  const firstOfMonth = new Date(y, m-1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0=الأحد
  const today = todayStr();
  const monthLabel = firstOfMonth.toLocaleDateString('ar-EG', {month:'long', year:'numeric'});

  // عدد الطلبات (غير المُسلَّمة) في كل يوم من الشهر
  const countsByDay = {};
  db.orders.forEach(o=>{
    if(o.status==='تم التسليم' || !o.dateDelivery) return;
    if(o.dateDelivery.slice(0,7)!==calendarMonth) return;
    countsByDay[o.dateDelivery] = (countsByDay[o.dateDelivery]||0)+1;
  });

  let cells = '';
  for(let i=0;i<startWeekday;i++){ cells += `<div></div>`; }
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const count = countsByDay[dateStr]||0;
    const isToday = dateStr===today;
    const isSelected = dateStr===calendarSelectedDay;
    const off = isDayOff(dateStr);
    const isHoliday = (db.holidays||[]).some(h=>h.date===dateStr);
    cells += `<div onclick="selectCalendarDay('${dateStr}')" style="
        cursor:pointer;text-align:center;padding:6px 2px;border-radius:10px;position:relative;
        background:${isSelected?'var(--primary)':(isToday?'var(--primary-light)':'transparent')};
        color:${isSelected?'#fff':(off?'var(--danger)':'var(--text)')};
        font-weight:${isToday||isSelected?'800':'500'};font-size:13px;">
        ${isHoliday?'<span style="position:absolute;top:0;left:2px;font-size:9px;">🎉</span>':''}
        ${d}
        ${count>0?`<div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:6px;height:6px;border-radius:50%;background:${isSelected?'#fff':'var(--accent)'};"></div>`:''}
      </div>`;
  }

  box.innerHTML = `
    <div class="card">
      <div class="row" style="margin-bottom:10px;">
        <button class="btn sm outline" onclick="changeCalendarMonth(-1)">◀</button>
        <h3 style="font-size:15px;">📅 ${monthLabel}</h3>
        <button class="btn sm outline" onclick="changeCalendarMonth(1)">▶</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;">
        ${WEEKDAY_NAMES_AR.map(n=>`<div style="text-align:center;font-size:11px;color:var(--muted);font-weight:700;">${n[0]}</div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">${cells}</div>
      ${calendarSelectedDay?`<button class="btn sm outline" style="margin-top:10px;" onclick="selectCalendarDay(null)">✕ إلغاء التصفية (${fmtDate(calendarSelectedDay)})</button>`:''}
    </div>
  `;
}

function changeCalendarMonth(delta){
  const [y,m] = calendarMonth.split('-').map(Number);
  const d = new Date(y, m-1+delta, 1);
  calendarMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  renderDeliveriesCalendar();
}

function selectCalendarDay(dateStr){
  calendarSelectedDay = (calendarSelectedDay===dateStr) ? null : dateStr;
  renderDeliveriesCalendar();
  renderDeliveriesList();
}

function renderDeliveries(){
  renderDeliveriesCalendar();
  renderDeliveriesList();
}

function renderDeliveriesList(){
  let list = db.orders.filter(o=>o.status!=='تم التسليم').slice().sort((a,b)=>(a.dateDelivery||'').localeCompare(b.dateDelivery||''));
  if(calendarSelectedDay){ list = list.filter(o=>o.dateDelivery===calendarSelectedDay); }
  const today = todayStr();
  const html = list.map(o=>{
    const c = customerById(o.customerId);
    const diffDays = Math.round((new Date(o.dateDelivery) - new Date(today))/86400000);
    let daysTxt = '';
    if(diffDays<0) daysTxt = `<span class="tag-late-text">متأخر ${Math.abs(diffDays)} يوم</span>`;
    else if(diffDays===0) daysTxt = `<span style="color:var(--warn);font-weight:700;">التسليم اليوم</span>`;
    else daysTxt = `<span style="color:var(--primary);font-weight:700;">باقي ${diffDays} يوم</span>`;
    const onDayOff = isDayOff(o.dateDelivery);
    return `<div class="card">
      <div class="row">
        <h3 class="name-row">${avatarChip(c?c.name:'؟')}${c?escapeHtml(c.name):'عميل محذوف'}</h3>
        ${statusBadge(o)}
      </div>
      <div class="meta">👗 ${escapeHtml(orderTypeLabel(o))}</div>
      <div class="meta">📅 تاريخ التسليم: ${fmtDate(o.dateDelivery)} — ${daysTxt}</div>
      ${onDayOff?`<div class="meta" style="color:var(--danger);">⚠️ الموعد ده يصادف ${dayOffLabel(o.dateDelivery)} (يوم إجازة) — يُفضّل التنسيق مع العميل</div>`:''}
      <div class="btn-row">
        <button class="btn sm accent" onclick="sendReminder('${o.id}')">🔔 تذكير واتساب</button>
      </div>
    </div>`;
  }).join('');
  document.getElementById('deliveriesList').innerHTML = html || `<div class="empty-msg">${calendarSelectedDay?'لا توجد مواعيد تسليم في هذا اليوم':'لا توجد مواعيد تسليم قادمة'}</div>`;
}

/* ============================================================
   المالية
   ============================================================ */
function renderFinance(){
  const today = todayStr();
  const sevenDaysAgo = new Date(Date.now()-6*86400000).toISOString().slice(0,10);
  const yearMonth = today.slice(0,7);
  const year = today.slice(0,4);

  const revenueToday = db.payments.filter(p=>p.date===today).reduce((s,p)=>s+Number(p.amount||0),0);
  const revenue7 = db.payments.filter(p=>p.date>=sevenDaysAgo).reduce((s,p)=>s+Number(p.amount||0),0);
  const totalFees = db.orders.reduce((s,o)=>s+orderTotal(o),0);
  const totalCollected = db.payments.reduce((s,p)=>s+Number(p.amount||0),0);
  const totalRemaining = totalFees-totalCollected;

  const collectedMonth = db.payments.filter(p=>p.date.slice(0,7)===yearMonth).reduce((s,p)=>s+Number(p.amount||0),0);
  const expensesMonth = db.expenses.filter(e=>e.date.slice(0,7)===yearMonth).reduce((s,e)=>s+Number(e.amount||0),0);
  const netMonth = collectedMonth-expensesMonth;

  const collectedYear = db.payments.filter(p=>p.date.slice(0,4)===year).reduce((s,p)=>s+Number(p.amount||0),0);
  const expensesYear = db.expenses.filter(e=>e.date.slice(0,4)===year).reduce((s,e)=>s+Number(e.amount||0),0);
  const netYear = collectedYear-expensesYear;

  const totalMaterialCost = db.orders.reduce((s,o)=>s+(Number(o.materialCost)||0),0);
  const trueNetProfit = totalFees - totalMaterialCost - db.expenses.reduce((s,e)=>s+Number(e.amount||0),0);

  document.getElementById('financeStats').innerHTML = `
    <div class="stat-card"><div class="stat-ic">💰</div><div><div class="num">${revenueToday.toLocaleString('ar-EG')}</div><div class="lbl">إيراد اليوم</div></div></div>
    <div class="stat-card"><div class="stat-ic">📈</div><div><div class="num">${revenue7.toLocaleString('ar-EG')}</div><div class="lbl">إيراد آخر 7 أيام</div></div></div>
    <div class="stat-card"><div class="stat-ic">🧵</div><div><div class="num">${totalFees.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي أجور التفصيل</div></div></div>
    <div class="stat-card"><div class="stat-ic">✅</div><div><div class="num">${totalCollected.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي المحصّل</div></div></div>
    <div class="stat-card danger"><div class="stat-ic">⏳</div><div><div class="num">${totalRemaining.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي المتبقي</div></div></div>
    <div class="stat-card ${netMonth<0?'danger':''}"><div class="stat-ic">📆</div><div><div class="num">${netMonth.toLocaleString('ar-EG')}</div><div class="lbl">صافي الشهر (بعد المصروفات)</div></div></div>
    <div class="stat-card ${netYear<0?'danger':''}"><div class="stat-ic">🗓️</div><div><div class="num">${netYear.toLocaleString('ar-EG')}</div><div class="lbl">صافي السنة (بعد المصروفات)</div></div></div>
    <div class="stat-card"><div class="stat-ic">🧶</div><div><div class="num">${totalMaterialCost.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي تكلفة الخامة</div></div></div>
    <div class="stat-card ${trueNetProfit<0?'danger':''}"><div class="stat-ic">💎</div><div><div class="num">${trueNetProfit.toLocaleString('ar-EG')}</div><div class="lbl">صافي الربح الحقيقي (أجور - خامة - مصروفات)</div></div></div>
  `;

  renderAdvancedAnalytics();
  renderWorkshopInsights();
  renderDebtsList();

  const lastPays = db.payments.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  document.getElementById('lastPayments').innerHTML = lastPays.length ? lastPays.map(p=>{
    const o = db.orders.find(x=>x.id===p.orderId);
    const c = o ? customerById(o.customerId) : null;
    return `<div class="card">
      <div class="row">
        <h3>${c?escapeHtml(c.name):'عميل'}</h3>
        <b style="color:var(--primary)">${Number(p.amount).toLocaleString('ar-EG')} ج.م</b>
      </div>
      <div class="meta">📅 ${fmtDate(p.date)}${o?' — '+escapeHtml(orderTypeLabel(o)):''}</div>
    </div>`;
  }).join('') : `<div class="empty-msg">لا توجد دفعات مسجلة بعد</div>`;

  renderRevenueChart();
  populateMonthSelect();
  renderMonthlyReport();
}

/* ============================================================
   شاشة المديونيات: كل عميل عليه متبقي، مرتب من الأكبر للأصغر
   ============================================================ */
function renderDebtsList(){
  const box = document.getElementById('debtsList');
  if(!box) return;
  const byCustomer = {};
  db.orders.forEach(o=>{
    const remaining = orderRemaining(o);
    if(remaining<=0) return;
    if(!byCustomer[o.customerId]) byCustomer[o.customerId] = {remaining:0, orders:0};
    byCustomer[o.customerId].remaining += remaining;
    byCustomer[o.customerId].orders += 1;
  });
  const rows = Object.entries(byCustomer)
    .map(([cid,v])=>({c:customerById(cid), ...v}))
    .filter(r=>r.c)
    .sort((a,b)=>b.remaining-a.remaining);

  const totalDebt = rows.reduce((s,r)=>s+r.remaining,0);
  const totalTxt = document.getElementById('totalDebtsTxt');
  if(totalTxt) totalTxt.textContent = rows.length ? '('+totalDebt.toLocaleString('ar-EG')+' ج.م)' : '';

  box.innerHTML = rows.length ? rows.map(r=>`
    <div class="card">
      <div class="row">
        <h3 class="name-row">${avatarChip(r.c.name)}${escapeHtml(r.c.name)}</h3>
        <b style="color:var(--danger);font-size:16px;">${r.remaining.toLocaleString('ar-EG')} ج.م</b>
      </div>
      <div class="meta">${r.orders} طلب غير مسدد بالكامل${r.c.phone?' — 📞 '+escapeHtml(r.c.phone):''}</div>
      <div class="btn-row">
        ${r.c.phone?`<button class="btn sm outline" onclick="sendDebtReminder('${r.c.id}')">💬 تذكير واتساب</button>`:''}
        <button class="btn sm outline" onclick="openCustomerHistory('${r.c.id}')">📜 عرض السجل</button>
      </div>
    </div>
  `).join('') : `<div class="empty-msg">لا توجد مديونيات حالياً 🎉</div>`;
}

function sendDebtReminder(customerId){
  const c = customerById(customerId);
  if(!c || !c.phone){ toast('لا يوجد رقم هاتف مسجل لهذا العميل'); return; }
  const unpaidOrders = db.orders.filter(o=>o.customerId===customerId && orderRemaining(o)>0);
  const totalRemaining = unpaidOrders.reduce((s,o)=>s+orderRemaining(o),0);
  let phone = c.phone.replace(/[^0-9]/g,'');
  if(phone.startsWith('0')) phone = '2'+phone;
  const msg =
`تذكير من ${db.workshopName||'ورشة تفصيل الجلابيب'} 🧵
حضرتك، إجمالي المتبقي على حسابك: ${totalRemaining.toLocaleString('ar-EG')} ج.م
عدد الطلبات غير المسددة بالكامل: ${unpaidOrders.length}
في انتظار حضرتك 🙏`;
  openWhatsAppChat(phone, msg);
}

/* ============================================================
   تحليلات متقدمة: توقعات، قيمة العملاء، كفاءة التشغيل، خريطة حرارية
   ============================================================ */
function renderAdvancedAnalytics(){
  const box = document.getElementById('advancedAnalytics');
  if(!box) return;

  const now = new Date();
  const todayS = todayStr();
  const capacity = Number(db.dailyCapacity)||500;
  const weekCapacity = capacity*7;

  // 1) توقع إيراد الشهر القادم — متوسط تحصيل آخر 3 شهور فيهم دخل فعلي
  const last3 = [];
  for(let i=1;i<=3;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = d.toISOString().slice(0,7);
    last3.push(db.payments.filter(p=>p.date.slice(0,7)===key).reduce((s,p)=>s+Number(p.amount||0),0));
  }
  const validMonths = last3.filter(v=>v>0);
  const forecast = validMonths.length ? Math.round(validMonths.reduce((a,b)=>a+b,0)/validMonths.length) : 0;

  // 2) تنبيه تكدس الأسبوع القادم
  const in7 = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  const nextWeekOrders = db.orders.filter(o=>o.status!=='تم التسليم' && o.dateDelivery && o.dateDelivery>todayS && o.dateDelivery<=in7);
  const nextWeekValue = nextWeekOrders.reduce((s,o)=>s+orderTotal(o),0);
  const congested = nextWeekValue > weekCapacity;

  // 3) متوسط قيمة الطلب (AOV) الشهر الحالي مقابل السابق
  const thisMonthKey = todayS.slice(0,7);
  const prevMonthKey = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7);
  const thisMonthOrders = db.orders.filter(o=>(o.dateReceived||'').slice(0,7)===thisMonthKey);
  const prevMonthOrders = db.orders.filter(o=>(o.dateReceived||'').slice(0,7)===prevMonthKey);
  const aovThis = thisMonthOrders.length ? Math.round(thisMonthOrders.reduce((s,o)=>s+orderTotal(o),0)/thisMonthOrders.length) : 0;
  const aovPrev = prevMonthOrders.length ? Math.round(prevMonthOrders.reduce((s,o)=>s+orderTotal(o),0)/prevMonthOrders.length) : 0;
  const aovDiff = aovPrev>0 ? Math.round(((aovThis-aovPrev)/aovPrev)*100) : null;

  // 4) أفضل 10 عملاء بإجمالي المدفوع فعلياً (من سجل الدفعات)
  const paidByCustomer = {};
  db.payments.forEach(p=>{
    const o = db.orders.find(x=>x.id===p.orderId);
    if(!o) return;
    paidByCustomer[o.customerId] = (paidByCustomer[o.customerId]||0) + Number(p.amount||0);
  });
  const topCustomers = Object.entries(paidByCustomer)
    .map(([cid,total])=>({c:customerById(cid), total}))
    .filter(x=>x.c)
    .sort((a,b)=>b.total-a.total)
    .slice(0,10);

  // 5) نسبة العملاء المتكررين (عملهم أكتر من طلب واحد)
  const ordersPerCustomer = {};
  db.orders.forEach(o=>{ ordersPerCustomer[o.customerId] = (ordersPerCustomer[o.customerId]||0)+1; });
  const customersWithOrders = Object.keys(ordersPerCustomer).length;
  const repeatCustomers = Object.values(ordersPerCustomer).filter(n=>n>1).length;
  const retentionPct = customersWithOrders ? Math.round((repeatCustomers/customersWithOrders)*100) : 0;

  // 6) نسبة استخدام الطاقة — قيمة الطلبات المُستلمة آخر 7 أيام مقابل الطاقة الأسبوعية
  const sevenDaysAgo = new Date(Date.now()-6*86400000).toISOString().slice(0,10);
  const receivedLast7Value = db.orders.filter(o=>o.dateReceived && o.dateReceived>=sevenDaysAgo && o.dateReceived<=todayS).reduce((s,o)=>s+orderTotal(o),0);
  const utilizationPct = weekCapacity ? Math.round((receivedLast7Value/weekCapacity)*100) : 0;

  // 7) تكلفة التأخير — قيمة الطلبات المتأخرة حالياً
  const delayCost = db.orders.filter(isOverdue).reduce((s,o)=>s+orderTotal(o),0);

  // 8) تأثير الطلبات المستعجلة
  const activeOrders = db.orders.filter(o=>o.status!=='تم التسليم');
  const urgentActive = activeOrders.filter(o=>o.urgent);
  const urgentPct = activeOrders.length ? Math.round((urgentActive.length/activeOrders.length)*100) : 0;
  const urgentLateCount = urgentActive.filter(isOverdue).length;

  // 9) خريطة حرارية شهرية لمواعيد التسليم
  const heatMonthKey = todayS.slice(0,7);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const countsByDay = {};
  db.orders.forEach(o=>{
    if(o.dateDelivery && o.dateDelivery.slice(0,7)===heatMonthKey){
      countsByDay[o.dateDelivery] = (countsByDay[o.dateDelivery]||0)+1;
    }
  });
  const dayCountValues = Object.values(countsByDay);
  const maxDayCount = dayCountValues.length ? Math.max(...dayCountValues) : 0;
  let heatCells = '';
  for(let day=1; day<=daysInMonth; day++){
    const dStr = heatMonthKey+'-'+String(day).padStart(2,'0');
    const cnt = countsByDay[dStr]||0;
    const intensity = maxDayCount ? cnt/maxDayCount : 0;
    const bg = cnt===0 ? 'var(--border)' : `rgba(31,109,87,${(0.15+intensity*0.75).toFixed(2)})`;
    heatCells += `<div title="${fmtDate(dStr)}: ${cnt} تسليم" style="background:${bg};border-radius:4px;height:24px;display:flex;align-items:center;justify-content:center;font-size:9px;color:${intensity>0.5?'#fff':'var(--muted)'};">${day}</div>`;
  }

  box.innerHTML = `
    <div class="card">
      <h3>🔮 توقع إيراد الشهر القادم</h3>
      <div class="num" style="font-size:22px;color:var(--primary);">${forecast.toLocaleString('ar-EG')} ج.م</div>
      <p class="meta">بناءً على متوسط تحصيل ${validMonths.length||0} من آخر 3 شهور.</p>
    </div>
    ${congested?`<div class="alert-banner danger"><span class="ic">⚠️</span><div><b>تكدس متوقع الأسبوع القادم</b>قيمة الطلبات المستحقة (${nextWeekValue.toLocaleString('ar-EG')} ج.م) فوق طاقتك الأسبوعية (${weekCapacity.toLocaleString('ar-EG')} ج.م) — خطط بدري.</div></div>`:''}
    <div class="grid-cards">
      <div class="stat-card"><div class="stat-ic">🧾</div><div><div class="num">${aovThis.toLocaleString('ar-EG')}</div><div class="lbl">متوسط قيمة الطلب${aovDiff!==null?` (${aovDiff>=0?'+':''}${aovDiff}% عن الشهر اللي فات)`:''}</div></div></div>
      <div class="stat-card ${retentionPct<30?'warn':''}"><div class="stat-ic">🔁</div><div><div class="num">${retentionPct}%</div><div class="lbl">عملاء متكررون</div></div></div>
      <div class="stat-card ${utilizationPct>100?'danger':''}"><div class="stat-ic">⚙️</div><div><div class="num">${utilizationPct}%</div><div class="lbl">استخدام الطاقة (آخر 7 أيام)</div></div></div>
      <div class="stat-card ${delayCost>0?'danger':''}"><div class="stat-ic">⏳</div><div><div class="num">${delayCost.toLocaleString('ar-EG')}</div><div class="lbl">قيمة الطلبات المتأخرة (ج.م)</div></div></div>
      <div class="stat-card ${urgentPct>30?'warn':''}"><div class="stat-ic">🔥</div><div><div class="num">${urgentPct}%</div><div class="lbl">نسبة الطلبات المستعجلة${urgentLateCount>0?` (${urgentLateCount} متأخر منها)`:''}</div></div></div>
    </div>
    ${topCustomers.length?`
    <div class="card">
      <h3>🏆 أفضل 10 عملاء (إجمالي المدفوع)</h3>
      ${topCustomers.map((x,i)=>`
        <div class="row" style="padding:6px 0;${i<topCustomers.length-1?'border-bottom:1px dashed var(--border);':''}">
          <span class="name-row">${avatarChip(x.c.name)} ${escapeHtml(x.c.name)}</span>
          <b style="color:var(--primary);">${x.total.toLocaleString('ar-EG')} ج.م</b>
        </div>
      `).join('')}
    </div>`:''}
    <div class="card">
      <h3>🗓️ خريطة مواعيد التسليم — ${new Date(heatMonthKey+'-01').toLocaleDateString('ar-EG',{month:'long',year:'numeric'})}</h3>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:8px;">${heatCells}</div>
    </div>
    <div class="btn-row">
      <button class="btn secondary" onclick="shareAnalyticsSummary()">📤 مشاركة ملخص التحليلات عبر واتساب</button>
    </div>
  `;
}

// مشاركة ملخص التحليلات كنص عبر واتساب (نفس أسلوب مشاركة ملخص الأسبوع)
function shareAnalyticsSummary(){
  const now = new Date();
  const last3 = [];
  for(let i=1;i<=3;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = d.toISOString().slice(0,7);
    last3.push(db.payments.filter(p=>p.date.slice(0,7)===key).reduce((s,p)=>s+Number(p.amount||0),0));
  }
  const validMonths = last3.filter(v=>v>0);
  const forecast = validMonths.length ? Math.round(validMonths.reduce((a,b)=>a+b,0)/validMonths.length) : 0;
  const delayCost = db.orders.filter(isOverdue).reduce((s,o)=>s+orderTotal(o),0);
  const activeOrders = db.orders.filter(o=>o.status!=='تم التسليم');
  const urgentPct = activeOrders.length ? Math.round((activeOrders.filter(o=>o.urgent).length/activeOrders.length)*100) : 0;
  const capacity = Number(db.dailyCapacity)||500;
  const sevenDaysAgo = new Date(Date.now()-6*86400000).toISOString().slice(0,10);
  const todayS = todayStr();
  const receivedLast7Value = db.orders.filter(o=>o.dateReceived && o.dateReceived>=sevenDaysAgo && o.dateReceived<=todayS).reduce((s,o)=>s+orderTotal(o),0);
  const utilizationPct = capacity*7 ? Math.round((receivedLast7Value/(capacity*7))*100) : 0;

  const msg =
`🔮 ملخص تحليلات ${db.workshopName||'الورشة'}
📅 ${todayS}

💰 توقع إيراد الشهر القادم: ${forecast.toLocaleString('ar-EG')} ج.م
⚙️ استخدام الطاقة (آخر 7 أيام): ${utilizationPct}%
⏳ قيمة الطلبات المتأخرة: ${delayCost.toLocaleString('ar-EG')} ج.م
🔥 نسبة الطلبات المستعجلة: ${urgentPct}%
📋 عدد الطلبات النشطة: ${activeOrders.length}`;

  if(navigator.share){
    navigator.share({title:'ملخص التحليلات', text:msg}).catch(()=>{});
    return;
  }
  openExternalLink(`https://wa.me/?text=${encodeURIComponent(msg)}`);
}

/* ============================================================
   رؤى الورشة: أكتر نوع تفصيل مطلوب + متوسط وقت تنفيذ الطلب
   ============================================================ */
function renderWorkshopInsights(){
  const box = document.getElementById('workshopInsights');
  if(!box) return;

  // أكتر نوع تفصيل مطلوب (بالعدّ الفعلي للقطع في كل الطلبات)
  const typeCounts = {};
  db.orders.forEach(o=>{
    const items = (Array.isArray(o.items)&&o.items.length) ? o.items : [{type:o.type, qty:o.qty||1}];
    items.forEach(it=>{
      if(!it.type) return;
      typeCounts[it.type] = (typeCounts[it.type]||0) + (Number(it.qty)||1);
    });
  });
  const sortedTypes = Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxCount = sortedTypes.length ? sortedTypes[0][1] : 0;

  const topTypesHtml = sortedTypes.length ? `
    <div class="card">
      <h3>👗 الأنواع الأكثر طلباً</h3>
      ${sortedTypes.map(([name,count])=>`
        <div style="margin:10px 0;">
          <div class="row" style="margin-bottom:4px;">
            <span style="font-size:13.5px;">${escapeHtml(name)}</span>
            <b style="font-size:13px;color:var(--muted);">${count} قطعة</b>
          </div>
          <div style="background:var(--border);border-radius:20px;height:8px;overflow:hidden;">
            <div style="background:var(--primary);height:100%;width:${maxCount? Math.round(count/maxCount*100):0}%;border-radius:20px;"></div>
          </div>
        </div>
      `).join('')}
    </div>
  ` : `<div class="empty-msg">لا توجد بيانات كافية بعد</div>`;

  // متوسط وقت تنفيذ الطلب: من تاريخ الاستلام لتاريخ التسليم الفعلي (للطلبات المُسلَّمة فقط)
  const delivered = db.orders.filter(o=>o.status==='تم التسليم' && o.deliveredDate && o.dateReceived);
  let avgTurnaroundHtml = `<div class="empty-msg">لا توجد طلبات مُسلَّمة كفاية لحساب المتوسط</div>`;
  if(delivered.length){
    const totalDays = delivered.reduce((s,o)=>{
      const d = Math.round((new Date(o.deliveredDate)-new Date(o.dateReceived))/86400000);
      return s + (d>0?d:0);
    },0);
    const avgDays = Math.round(totalDays/delivered.length);

    // نفس الحساب لكن مقسّم حسب نوع القطعة (أول نوع في الطلب) عشان يبان لو نوع معين بياخد وقت أطول
    const byType = {};
    delivered.forEach(o=>{
      const items = (Array.isArray(o.items)&&o.items.length) ? o.items : [{type:o.type}];
      const typeName = items[0]?.type || 'غير محدد';
      const d = Math.round((new Date(o.deliveredDate)-new Date(o.dateReceived))/86400000);
      if(d<0) return;
      if(!byType[typeName]) byType[typeName] = {sum:0,count:0};
      byType[typeName].sum += d;
      byType[typeName].count += 1;
    });
    const byTypeRows = Object.entries(byType)
      .map(([name,v])=>({name, avg:Math.round(v.sum/v.count), count:v.count}))
      .sort((a,b)=>b.avg-a.avg)
      .slice(0,4);

    avgTurnaroundHtml = `
      <div class="card">
        <h3>⏱️ متوسط وقت تنفيذ الطلب</h3>
        <div class="row"><span style="font-size:13.5px;color:var(--muted);">من ${delivered.length} طلب مُسلَّم</span>
          <b style="font-family:var(--font-display);font-size:19px;color:var(--heading);">${avgDays} يوم</b>
        </div>
        ${byTypeRows.length?`<hr class="sep">${byTypeRows.map(r=>`
          <div class="row" style="margin-bottom:4px;">
            <span style="font-size:13px;">${escapeHtml(r.name)}</span>
            <span style="font-size:13px;color:var(--muted);">${r.avg} يوم (${r.count} طلب)</span>
          </div>
        `).join('')}`:''}
      </div>
    `;
  }

  box.innerHTML = topTypesHtml + avgTurnaroundHtml;
}

/* ---- رسم بياني بسيط للإيرادات الشهرية (Canvas بدون مكتبات) ---- */
function renderRevenueChart(){
  const canvas = document.getElementById('revenueChart');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const now = new Date();
  const months = [];
  for(let i=5;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push({key:d.toISOString().slice(0,7), label:d.toLocaleDateString('ar-EG',{month:'short'})});
  }
  const values = months.map(m=>db.payments.filter(p=>p.date.slice(0,7)===m.key).reduce((s,p)=>s+Number(p.amount||0),0));
  const maxVal = Math.max(...values, 1);

  const padL=40, padB=26, padT=14, padR=10;
  const chartW = W-padL-padR, chartH = H-padT-padB;
  const barGap = 14;
  const barW = (chartW - barGap*(months.length-1)) / months.length;

  ctx.strokeStyle = '#e4d9bf';
  ctx.beginPath();
  ctx.moveTo(padL, padT); ctx.lineTo(padL, H-padB); ctx.lineTo(W-padR, H-padB);
  ctx.stroke();

  ctx.font = '11px "IBM Plex Sans Arabic", Tahoma, Arial, sans-serif';
  ctx.fillStyle = '#847c6c';
  ctx.textAlign = 'center';

  months.forEach((m,i)=>{
    const x = padL + i*(barW+barGap);
    const h = (values[i]/maxVal) * (chartH-16);
    const y = H-padB-h;
    ctx.fillStyle = '#1F6D57';
    ctx.beginPath();
    if(ctx.roundRect){ ctx.roundRect(x, y, barW, h, [5,5,0,0]); ctx.fill(); }
    else { ctx.fillRect(x,y,barW,h); }
    ctx.fillStyle = '#123C2F';
    ctx.fillText(values[i].toLocaleString('ar-EG'), x+barW/2, y-5);
    ctx.fillStyle = '#847c6c';
    ctx.fillText(m.label, x+barW/2, H-padB+14);
  });
}

/* ---- التقرير الشهري ---- */
function populateMonthSelect(){
  const sel = document.getElementById('reportMonthSelect');
  const prev = sel.value;
  let opts = '';
  const now = new Date();
  for(let i=0;i<12;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const val = d.toISOString().slice(0,7);
    const label = d.toLocaleDateString('ar-EG',{month:'long', year:'numeric'});
    opts += `<option value="${val}">${label}</option>`;
  }
  sel.innerHTML = opts;
  sel.value = prev || now.toISOString().slice(0,7);
}

function renderMonthlyReport(){
  const sel = document.getElementById('reportMonthSelect');
  if(!sel) return;
  const month = sel.value || todayStr().slice(0,7);
  const ordersReceived = db.orders.filter(o=>(o.dateReceived||'').slice(0,7)===month).length;
  const ordersDelivered = db.orders.filter(o=>o.deliveredDate && o.deliveredDate.slice(0,7)===month).length;
  const collected = db.payments.filter(p=>p.date.slice(0,7)===month).reduce((s,p)=>s+Number(p.amount||0),0);
  const expenses = db.expenses.filter(e=>e.date.slice(0,7)===month).reduce((s,e)=>s+Number(e.amount||0),0);
  const net = collected-expenses;
  document.getElementById('monthlyReportBody').innerHTML = `
    <div class="meta">📥 طلبات استُلمت هذا الشهر: <b>${ordersReceived}</b></div>
    <div class="meta">📤 طلبات تم تسليمها هذا الشهر: <b>${ordersDelivered}</b></div>
    <div class="meta">💰 المحصَّل: <b>${collected.toLocaleString('ar-EG')} ج.م</b></div>
    <div class="meta">🧵 المصروفات: <b style="color:var(--danger)">${expenses.toLocaleString('ar-EG')} ج.م</b></div>
    <hr class="sep">
    <div class="row"><h3>الصافي</h3><b style="color:${net<0?'var(--danger)':'var(--ok)'};font-size:17px;">${net.toLocaleString('ar-EG')} ج.م</b></div>
  `;
}

function printMonthlyReport(){
  const sel = document.getElementById('reportMonthSelect');
  const month = sel.value || todayStr().slice(0,7);
  const label = new Date(month+'-01').toLocaleDateString('ar-EG',{month:'long', year:'numeric'});
  const ordersReceived = db.orders.filter(o=>(o.dateReceived||'').slice(0,7)===month).length;
  const ordersDelivered = db.orders.filter(o=>o.deliveredDate && o.deliveredDate.slice(0,7)===month).length;
  const collected = db.payments.filter(p=>p.date.slice(0,7)===month).reduce((s,p)=>s+Number(p.amount||0),0);
  const expensesList = db.expenses.filter(e=>e.date.slice(0,7)===month);
  const expenses = expensesList.reduce((s,e)=>s+Number(e.amount||0),0);
  const net = collected-expenses;
  const html = `
    <html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير ${label}</title>
    <style>
      body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;}
      h1{font-size:20px;border-bottom:2px solid #1F6D57;padding-bottom:8px;}
      table{width:100%;border-collapse:collapse;margin-top:14px;}
      td{padding:10px 6px;border-bottom:1px solid #ddd;font-size:15px;}
      td.lbl{color:#666;width:55%;}
      td.val{font-weight:bold;}
      .total-row td{font-size:17px;color:#1F6D57;}
      h2{font-size:15px;margin-top:22px;}
    </style></head><body>
      <h1>📊 التقرير الشهري — ${label}</h1>
      <table>
        <tr><td class="lbl">طلبات استُلمت</td><td class="val">${ordersReceived}</td></tr>
        <tr><td class="lbl">طلبات تم تسليمها</td><td class="val">${ordersDelivered}</td></tr>
        <tr><td class="lbl">إجمالي المحصَّل</td><td class="val">${collected.toLocaleString('ar-EG')} ج.م</td></tr>
        <tr><td class="lbl">إجمالي المصروفات</td><td class="val">${expenses.toLocaleString('ar-EG')} ج.م</td></tr>
        <tr class="total-row"><td class="lbl">الصافي</td><td class="val">${net.toLocaleString('ar-EG')} ج.م</td></tr>
      </table>
      ${expensesList.length?`<h2>🧵 تفاصيل المصروفات</h2><table>${expensesList.map(e=>`<tr><td class="lbl">${escapeHtml(e.desc)} (${fmtDate(e.date)})</td><td class="val">${Number(e.amount).toLocaleString('ar-EG')} ج.م</td></tr>`).join('')}</table>`:''}
    </body></html>
  `;
  openPrintWindow(html, 'تقرير_'+label);
}

/* ============================================================
   المصروفات
   ============================================================ */
function renderExpenses(){
  const total = db.expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  document.getElementById('totalExpensesTxt').textContent = total.toLocaleString('ar-EG')+' ج.م';
  const list = db.expenses.slice().sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('expensesList').innerHTML = list.length ? list.map(e=>`
    <div class="card">
      <div class="row">
        <h3>${escapeHtml(e.desc)}</h3>
        <b style="color:var(--danger)">${Number(e.amount).toLocaleString('ar-EG')} ج.م</b>
      </div>
      <div class="meta">📅 ${fmtDate(e.date)}</div>
      <div class="btn-row">
        <button class="btn sm danger" onclick="deleteExpense('${e.id}')">🗑️ حذف</button>
      </div>
    </div>
  `).join('') : `<div class="empty-msg">لا توجد مصروفات مسجلة</div>`;
}

function openExpenseModal(){
  const html = `
    <div class="modal-head"><h3>➕ مصروف جديد</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="field"><label>وصف المصروف</label><input id="f_expDesc" placeholder="مثال: خيوط، أزرار، سوست..."></div>
    <div class="field"><label>المبلغ (ج.م)</label><input id="f_expAmount" type="number" placeholder="0"></div>
    <div class="field"><label>التاريخ</label><input id="f_expDate" type="date" value="${todayStr()}"></div>
    <button class="btn" onclick="saveExpense()">💾 حفظ</button>
  `;
  openModal(html);
}

function saveExpense(){
  const desc = document.getElementById('f_expDesc').value.trim();
  const amount = Number(document.getElementById('f_expAmount').value)||0;
  const date = document.getElementById('f_expDate').value || todayStr();
  if(!desc){ toast('أدخل وصف المصروف'); return; }
  if(amount<=0){ toast('أدخل مبلغاً صحيحاً'); return; }
  const record = {id:uid(), desc, amount, date};
  db.expenses.push(record);
  logActivity(`🧵 مصروف جديد: ${desc} (${amount.toLocaleString('ar-EG')} ج.م)`);
  setUndo('إضافة المصروف', ()=>{
    db.expenses = db.expenses.filter(e=>e.id!==record.id);
    saveDB();
    renderExpenses();
  });
  saveDB();
  closeModal();
  renderExpenses();
  toast('تم إضافة المصروف ✅');
}

async function deleteExpense(id){
  if(!await appConfirm('حذف هذا المصروف؟')) return;
  const removed = db.expenses.find(e=>e.id===id);
  if(!removed) return;
  db.expenses = db.expenses.filter(e=>e.id!==id);
  logActivity(`🗑️ حذف مصروف: ${removed.desc}`);
  setUndo('حذف المصروف', ()=>{
    db.expenses.push(removed);
    saveDB();
    renderExpenses();
  });
  saveDB();
  renderExpenses();
  toast('تم الحذف');
}

/* ============================================================
   الإعدادات: الطاقة اليومية + أنواع التفصيل
   ============================================================ */
function renderSettings(){
  document.getElementById('workshopNameInput').value = db.workshopName||'';
  document.getElementById('ownerNameInput').value = db.ownerName||'';
  document.getElementById('ownerPhoneInput').value = db.ownerPhone||'';
  document.getElementById('workshopAddressInput').value = db.workshopAddress||'';
  fillThemeInputs();
  fillInvoiceCustomInputs();
  fillFontInputs();
  fillSkeletonInput();
  fillWideModeInput();
  renderHomeWidgetsSettings();
  document.getElementById('customCSSInput').value = db.customCSS||'';
  document.getElementById('customJSInput').value = db.customJS||'';
  document.getElementById('dailyCapacityInput').value = db.dailyCapacity;
  document.getElementById('workStartHourInput').value = db.workStartHour;
  document.getElementById('workEndHourInput').value = db.workEndHour;
  document.getElementById('vipThresholdInput').value = db.vipThreshold;
  document.getElementById('idleLockInput').value = db.idleLockMinutes;
  document.getElementById('debtThresholdInput').value = db.debtThreshold;
  document.getElementById('dayOffInput').value = String(db.dayOffWeekday ?? 0);
  document.getElementById('nextInvoiceInput').value = db.nextInvoiceNumber||1001;
  document.getElementById('taxDefaultInput').value = db.taxDefaultPercent||0;
  document.getElementById('lastBackupTxt').textContent = db.lastBackupDate ? ('📅 آخر نسخة احتياطية: '+fmtDate(db.lastBackupDate)) : '⚠️ لم يتم عمل نسخة احتياطية بعد';
  renderTrash();
  renderGarmentTypes();
  renderHolidaysList();
  renderActivityLog();
  renderCloudSyncCard();
  renderPushNotifyCard();
  renderInvoicePreviewCard();
}

function renderActivityLog(){
  const box = document.getElementById('activityLogList');
  const countTxt = document.getElementById('activityCountTxt');
  if(!box) return;
  const items = (db.activityLog||[]).slice().reverse().slice(0,50);
  if(countTxt) countTxt.textContent = (db.activityLog||[]).length ? `(${db.activityLog.length})` : '';
  box.innerHTML = items.length ? items.map(a=>`
    <div class="meta" style="padding:6px 0;border-bottom:1px dashed var(--stitch);">
      <span style="color:var(--muted);">${fmtActivityTime(a.ts)}</span> — ${escapeHtml(a.text)}
    </div>`).join('') : `<div class="empty-msg">لا يوجد نشاط مسجل بعد</div>`;
}

async function clearActivityLog(){
  if(!await appConfirm('هل تريد مسح سجل النشاط بالكامل؟')) return;
  db.activityLog = [];
  saveDB();
  renderActivityLog();
  toast('تم مسح السجل');
}

function saveWorkshopInfo(){
  const name = document.getElementById('workshopNameInput').value.trim();
  if(!name){ toast('أدخل اسم الورشة'); return; }
  db.workshopName = name;
  db.ownerName = document.getElementById('ownerNameInput').value.trim();
  db.ownerPhone = document.getElementById('ownerPhoneInput').value.trim();
  db.workshopAddress = document.getElementById('workshopAddressInput').value.trim();
  saveDB();
  applyWorkshopBranding();
  renderInvoicePreviewCard();
  toast('تم حفظ بيانات الورشة ✅');
}

// يحدّث اسم الورشة في كل الأماكن التي تظهر فيها داخل الواجهة
const BRAND_EMBLEM_DEFAULT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>';

function applyWorkshopBranding(){
  const name = (db && db.workshopName) ? db.workshopName : 'ورشة تفصيل الجلابيب';
  document.title = name;
  const lockTitle = document.getElementById('lockTitle');
  if(lockTitle) lockTitle.textContent = name;
  const sidenavTitle = document.getElementById('sidenavTitle');
  if(sidenavTitle) sidenavTitle.textContent = name;

  const logo = db && db.workshopLogo;
  document.querySelectorAll('.brand-emblem').forEach(function(el){
    el.innerHTML = logo ? `<img src="${logo}" alt="شعار الورشة">` : BRAND_EMBLEM_DEFAULT_SVG;
  });
}

// يقرأ ملف الصورة اللي المستخدم اختاره ويخزنه كـ base64 داخل قاعدة البيانات (بيتزامن مع باقي البيانات لو المزامنة السحابية مفعّلة)
function onLogoFileChosen(input){
  const file = input.files && input.files[0];
  if(!file) return;
  if(!file.type.startsWith('image/')){ toast('اختار ملف صورة صالح'); input.value=''; return; }
  if(file.size > 900*1024){
    toast('⚠️ الصورة كبيرة أوي — اختار صورة أصغر من 900 كيلوبايت');
    input.value='';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e){
    db.workshopLogo = e.target.result;
    saveDB();
    applyWorkshopBranding();
    renderSettings();
    toast('✅ اتحفظ شعار الورشة');
  };
  reader.onerror = function(){ toast('تعذر قراءة الصورة'); };
  reader.readAsDataURL(file);
}

function removeWorkshopLogo(){
  db.workshopLogo = null;
  saveDB();
  applyWorkshopBranding();
  renderSettings();
  toast('تم حذف الشعار — رجع الأيقونة الافتراضية');
}

/* ============================================================
   تخصيص المظهر: الألوان + شكل الأزرار + كود مخصص
   ============================================================ */
const DEFAULT_THEME = {primary:'#1F6D57', primaryDark:'#123C2F', accent:'#B8863B', bg:'#F6F1E6'};
const DEFAULT_BTN_RADIUS = 12;

function applyTheme(){
  const t = (db && db.theme) ? db.theme : DEFAULT_THEME;
  const root = document.documentElement.style;
  root.setProperty('--primary', t.primary||DEFAULT_THEME.primary);
  root.setProperty('--primary-dark', t.primaryDark||DEFAULT_THEME.primaryDark);
  root.setProperty('--accent', t.accent||DEFAULT_THEME.accent);
  root.setProperty('--bg', t.bg||DEFAULT_THEME.bg);
  root.setProperty('--btn-radius', (Number(db&&db.btnRadius)||DEFAULT_BTN_RADIUS)+'px');
}

function saveTheme(){
  db.theme = {
    primary: document.getElementById('colorPrimary').value,
    primaryDark: document.getElementById('colorPrimaryDark').value,
    accent: document.getElementById('colorAccent').value,
    bg: document.getElementById('colorBg').value
  };
  saveDB();
  applyTheme();
  renderInvoicePreviewCard();
  toast('تم حفظ الألوان ✅');
}

function resetTheme(){
  db.theme = {...DEFAULT_THEME};
  saveDB();
  applyTheme();
  fillThemeInputs();
  renderInvoicePreviewCard();
  toast('تم استعادة الألوان الافتراضية ✅');
}

// ===== أشكال ألوان جاهزة =====
const THEME_PRESETS = {
  classic: {primary:'#1F6D57', primaryDark:'#123C2F', accent:'#B8863B', bg:'#F6F1E6'},
  modern:  {primary:'#2563A6', primaryDark:'#123C5F', accent:'#3FB6A8', bg:'#EEF3F8'},
  warm:    {primary:'#A2453A', primaryDark:'#5C201A', accent:'#D4A24C', bg:'#FBF1E7'},
  mono:    {primary:'#3A3A3A', primaryDark:'#1A1A1A', accent:'#8A8A8A', bg:'#F2F2F0'}
};

function applyThemePreset(name){
  const preset = THEME_PRESETS[name];
  if(!preset) return;
  db.theme = {...preset};
  saveDB();
  applyTheme();
  fillThemeInputs();
  renderInvoicePreviewCard();
  toast('تم تطبيق الشكل الجديد ✅');
}

/* ============================================================
   تخصيص نصوص وألوان كل سطر في الفاتورة
   ============================================================ */
// أزواج [id عنصر الإدخال، اسم الحقل] — نفس القائمة بتتستخدم في التعبئة والحفظ عشان لو
// أضفنا سطر جديد نضيفه هنا مرة واحدة بس
const INVOICE_TEXT_FIELDS = [
  ['invText_title','title'], ['invText_badgePrefix','badgePrefix'],
  ['invText_clientLabel','clientLabel'], ['invText_phoneLabel','phoneLabel'],
  ['invText_receivedLabel','receivedLabel'], ['invText_deliveryLabel','deliveryLabel'],
  ['invText_colType','colType'], ['invText_colQty','colQty'],
  ['invText_colUnitPrice','colUnitPrice'], ['invText_colTotal','colTotal'],
  ['invText_extraLabel','extraLabel'], ['invText_discountLabel','discountLabel'],
  ['invText_taxLabel','taxLabel'], ['invText_totalLabel','totalLabel'],
  ['invText_paidLabel','paidLabel'], ['invText_remainingLabel','remainingLabel'],
  ['invText_footerText','footerText']
];
const INVOICE_COLOR_FIELDS = [
  ['invColor_subText','subText'], ['invColor_titleText','titleText'],
  ['invColor_labelText','labelText'], ['invColor_valueText','valueText'],
  ['invColor_itemsHeadBg','itemsHeadBg'], ['invColor_itemsHeadText','itemsHeadText'],
  ['invColor_rowAltBg','rowAltBg'], ['invColor_totalsBg','totalsBg'],
  ['invColor_footerText','footerText']
];

function fillInvoiceCustomInputs(){
  const ic = getInvoiceCustom();
  INVOICE_TEXT_FIELDS.forEach(([id,key])=>{
    const el = document.getElementById(id);
    if(el) el.value = ic.labels[key]||'';
  });
  INVOICE_COLOR_FIELDS.forEach(([id,key])=>{
    const el = document.getElementById(id);
    // لون "خلفية عناوين جدول الأصناف" ممكن يكون فاضي (يعني ياخد اللون الأساسي تلقائيًا)
    if(el) el.value = ic.colors[key] || (key==='itemsHeadBg' ? (db.theme&&db.theme.primary||'#1F6D57') : '#000000');
  });
}

function saveInvoiceCustom(){
  const labels = {};
  INVOICE_TEXT_FIELDS.forEach(([id,key])=>{
    const el = document.getElementById(id);
    const v = el ? el.value.trim() : '';
    if(v) labels[key] = v;
  });
  const colors = {};
  INVOICE_COLOR_FIELDS.forEach(([id,key])=>{
    const el = document.getElementById(id);
    if(el && el.value) colors[key] = el.value;
  });
  db.invoiceCustom = {labels, colors};
  saveDB();
  renderInvoicePreviewCard();
  toast('تم حفظ نصوص وألوان الفاتورة ✅');
}

function resetInvoiceCustom(){
  db.invoiceCustom = {};
  saveDB();
  fillInvoiceCustomInputs();
  renderInvoicePreviewCard();
  toast('تم استعادة نصوص وألوان الفاتورة الافتراضية ✅');
}

function saveButtonRadius(){
  db.btnRadius = Number(document.getElementById('btnRadiusInput').value)||DEFAULT_BTN_RADIUS;
  saveDB();
  applyTheme();
  toast('تم حفظ شكل الأزرار ✅');
}

/* ============================================================
   وضع الشاشة الكبيرة (تابلت)
   ============================================================ */
function applyWideMode(){
  document.documentElement.classList.toggle('wide-mode', !!(db && db.wideMode));
}
function toggleWideMode(on){
  db.wideMode = !!on;
  saveDB();
  applyWideMode();
}
function fillWideModeInput(){
  const el = document.getElementById('wideModeToggleInput');
  if(el) el.checked = !!(db && db.wideMode);
}

/* ============================================================
   تخصيص الشاشة الرئيسية (ترتيب/إخفاء الودجت)
   ============================================================ */
const HOME_WIDGETS_DEFAULT = ['alerts','stats','weekly','today','commitment','upcoming','late'];
const HOME_WIDGET_LABELS = {
  alerts:'🔔 التنبيهات', stats:'📊 الإحصائيات', weekly:'📅 نظرة الأسبوع', today:'🌅 خطة النهاردة',
  commitment:'📈 الالتزام بالخطة', upcoming:'📅 أقرب مواعيد التسليم', late:'⏰ طلبات متأخرة'
};

// يرجّع ترتيب الودجت المحفوظ، وبينشئ واحد افتراضي أول مرة أو لو فيه ودجت جديدة اتضافت في تحديث لاحق
function getHomeWidgetsOrder(){
  if(!Array.isArray(db.homeWidgets) || !db.homeWidgets.length){
    db.homeWidgets = HOME_WIDGETS_DEFAULT.map(id=>({id, visible:true}));
  }
  HOME_WIDGETS_DEFAULT.forEach(id=>{
    if(!db.homeWidgets.some(w=>w.id===id)) db.homeWidgets.push({id, visible:true});
  });
  return db.homeWidgets;
}

// يطبّق الترتيب والإظهار/الإخفاء فعلياً على عناصر الشاشة الرئيسية
function applyHomeWidgetsLayout(){
  const order = getHomeWidgetsOrder();
  const container = document.getElementById('homeWidgetsContainer');
  if(!container) return;
  order.forEach(w=>{
    const el = document.getElementById('widget-'+w.id);
    if(!el) return;
    el.style.display = (w.visible===false) ? 'none' : '';
    container.appendChild(el);
  });
}

function moveHomeWidget(id, dir){
  const order = getHomeWidgetsOrder();
  const idx = order.findIndex(w=>w.id===id);
  const newIdx = idx+dir;
  if(idx<0 || newIdx<0 || newIdx>=order.length) return;
  const tmp = order[idx];
  order[idx] = order[newIdx];
  order[newIdx] = tmp;
  saveDB();
  applyHomeWidgetsLayout();
  renderHomeWidgetsSettings();
}

function toggleHomeWidget(id, visible){
  const order = getHomeWidgetsOrder();
  const w = order.find(w=>w.id===id);
  if(w) w.visible = !!visible;
  saveDB();
  applyHomeWidgetsLayout();
}

function resetHomeWidgets(){
  db.homeWidgets = HOME_WIDGETS_DEFAULT.map(id=>({id, visible:true}));
  saveDB();
  applyHomeWidgetsLayout();
  renderHomeWidgetsSettings();
  toast('تم استعادة ترتيب الشاشة الرئيسية الافتراضي ✅');
}

function renderHomeWidgetsSettings(){
  const box = document.getElementById('homeWidgetsSettingsList');
  if(!box) return;
  const order = getHomeWidgetsOrder();
  box.innerHTML = order.map((w,i)=>`
    <div class="row" style="padding:8px 0;border-bottom:1px solid var(--border);">
      <span>${HOME_WIDGET_LABELS[w.id]||w.id}</span>
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="btn sm outline" style="padding:6px 10px;" ${i===0?'disabled':''} onclick="moveHomeWidget('${w.id}',-1)">⬆️</button>
        <button class="btn sm outline" style="padding:6px 10px;" ${i===order.length-1?'disabled':''} onclick="moveHomeWidget('${w.id}',1)">⬇️</button>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="checkbox" style="width:18px;height:18px;" ${w.visible!==false?'checked':''} onchange="toggleHomeWidget('${w.id}', this.checked)">
        </label>
      </div>
    </div>
  `).join('');
}

/* ============================================================
   تخصيص الخط
   ============================================================ */
const FONT_FAMILIES = {
  default:  '"IBM Plex Sans Arabic","Tajawal","Segoe UI",Tahoma,Arial,sans-serif',
  tajawal:  '"Tajawal","IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif',
  cairo:    '"Cairo","IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif',
  almarai:  '"Almarai","IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif',
  notokufi: '"Noto Kufi Arabic","IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif'
};
const DEFAULT_FONT = {family:'default', size:'1'};

function applyFontSettings(){
  const f = (db && db.fontSettings) ? db.fontSettings : DEFAULT_FONT;
  const fam = FONT_FAMILIES[f.family] || FONT_FAMILIES.default;
  document.documentElement.style.setProperty('--font-body', fam);
  const scale = Number(f.size) || 1;
  document.documentElement.style.setProperty('--font-scale', String(scale));
  // "zoom" بيكبّر/يصغّر كل حاجة (نص، مسافات، أيقونات) بشكل متناسق - مدعوم في متصفحات كروميوم وتطبيقات الـ WebView
  const appEl = document.getElementById('app');
  const lockEl = document.getElementById('lockScreen');
  if(appEl) appEl.style.zoom = String(scale);
  if(lockEl) lockEl.style.zoom = String(scale);
}

function fillFontInputs(){
  const f = (db && db.fontSettings) ? db.fontSettings : DEFAULT_FONT;
  const elF = document.getElementById('fontFamilyInput');
  const elS = document.getElementById('fontSizeInput');
  if(elF) elF.value = f.family || DEFAULT_FONT.family;
  if(elS) elS.value = String(f.size || DEFAULT_FONT.size);
}

function saveFontSettings(){
  db.fontSettings = {
    family: document.getElementById('fontFamilyInput').value,
    size: document.getElementById('fontSizeInput').value
  };
  saveDB();
  applyFontSettings();
  toast('تم حفظ إعدادات الخط ✅');
}

function resetFontSettings(){
  db.fontSettings = {...DEFAULT_FONT};
  saveDB();
  applyFontSettings();
  fillFontInputs();
  toast('تم استعادة الخط الافتراضي ✅');
}

/* ============================================================
   تأثير التحميل الهيكلي (Skeleton Loading)
   ============================================================ */
function showSkeleton(){
  const el = document.getElementById('skeletonOverlay');
  if(el) el.classList.add('show');
}
function hideSkeleton(){
  const el = document.getElementById('skeletonOverlay');
  if(el) el.classList.remove('show');
}
function toggleSkeletonLoading(on){
  db.skeletonLoading = !!on;
  saveDB();
  toast(on ? 'تم تفعيل تأثير التحميل ✅' : 'تم إيقاف تأثير التحميل');
}
function fillSkeletonInput(){
  const el = document.getElementById('skeletonToggleInput');
  if(el) el.checked = !!(db && db.skeletonLoading);
}

/* ===== الوضع الليلي ===== */
function applyDarkMode(){
  const on = !!(db && db.darkMode);
  document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
  const btn = document.getElementById('themeToggleBtn');
  if(btn) btn.textContent = on ? '☀️' : '🌙';
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if(metaTheme) metaTheme.setAttribute('content', on ? '#171916' : '#1F6D57');
}

function toggleDarkMode(){
  db.darkMode = !db.darkMode;
  saveDB();
  applyDarkMode();
}

function fillThemeInputs(){
  const t = (db && db.theme) ? db.theme : DEFAULT_THEME;
  const elP=document.getElementById('colorPrimary'), elPD=document.getElementById('colorPrimaryDark'),
        elA=document.getElementById('colorAccent'), elBg=document.getElementById('colorBg'),
        elR=document.getElementById('btnRadiusInput');
  if(elP) elP.value = t.primary||DEFAULT_THEME.primary;
  if(elPD) elPD.value = t.primaryDark||DEFAULT_THEME.primaryDark;
  if(elA) elA.value = t.accent||DEFAULT_THEME.accent;
  if(elBg) elBg.value = t.bg||DEFAULT_THEME.bg;
  if(elR) elR.value = String(Number(db&&db.btnRadius)||DEFAULT_BTN_RADIUS);
}

// تطبيق CSS المخصص عبر وسم <style> منفصل، آمن ولا يحتاج تحذير
function applyCustomCSS(){
  let styleTag = document.getElementById('userCustomCSS');
  if(!styleTag){
    styleTag = document.createElement('style');
    styleTag.id = 'userCustomCSS';
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = (db && db.customCSS) ? db.customCSS : '';
}

// تشغيل الـ JavaScript المخصص بأمان قدر الإمكان (محاط بـ try/catch حتى لا يعطل التطبيق كله لو فيه خطأ)
function runCustomJS(){
  if(!db || !db.customJS || !db.customJS.trim()) return;
  try{
    new Function(db.customJS)();
  }catch(e){
    toast('⚠️ خطأ في الكود المخصص: '+e.message);
  }
}

function saveCustomCode(){
  db.customCSS = document.getElementById('customCSSInput').value;
  db.customJS = document.getElementById('customJSInput').value;
  saveDB();
  applyCustomCSS();
  runCustomJS();
  toast('تم تطبيق وحفظ الكود المخصص ✅');
}

async function resetCustomCode(){
  if(!await appConfirm('هل تريد مسح كل الكود المخصص (CSS وJavaScript) والعودة للوضع الافتراضي؟')) return;
  db.customCSS = '';
  db.customJS = '';
  saveDB();
  applyCustomCSS();
  document.getElementById('customCSSInput').value = '';
  document.getElementById('customJSInput').value = '';
  toast('تم استعادة الوضع الافتراضي ✅');
}

// تنزيل نسخة كاملة من كود التطبيق (HTML) بكل التخصيصات الحالية، لفتحها أو تعديلها خارج التطبيق
async function downloadFullAppCode(){
  try{
    const fullHtml = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    const blob = new Blob([fullHtml], {type:'text/html'});
    const ok = await saveOrShareFile(blob, (db.workshopName||'تطبيق_الورشة')+'.html');
    if(ok) toast('تم حفظ نسخة كود التطبيق ✅');
  }catch(e){
    toast('حدث خطأ أثناء التنزيل');
  }
}

function saveDayOff(){
  const val = Number(document.getElementById('dayOffInput').value);
  db.dayOffWeekday = val;
  saveDB();
  toast('تم حفظ يوم الإجازة ✅');
  if(currentPage==='home') renderHome();
}

/* ============================================================
   مواعيد الأعياد والإجازات (تواريخ محددة، بخلاف يوم الإجازة الأسبوعي)
   ============================================================ */
function addHoliday(){
  const date = document.getElementById('holidayDateInput').value;
  const name = document.getElementById('holidayNameInput').value.trim();
  if(!date){ toast('اختر تاريخ العيد أو الإجازة'); return; }
  if(!name){ toast('أدخل اسم المناسبة'); return; }
  if(!db.holidays) db.holidays=[];
  if(db.holidays.some(h=>h.date===date)){ toast('فيه إجازة متسجلة بالفعل في نفس التاريخ'); return; }
  db.holidays.push({id:uid(), date, name});
  saveDB();
  document.getElementById('holidayDateInput').value='';
  document.getElementById('holidayNameInput').value='';
  renderHolidaysList();
  if(currentPage==='home') renderHome();
  toast('تمت الإضافة ✅');
}

async function deleteHoliday(id){
  if(!await appConfirm('حذف هذه الإجازة؟')) return;
  db.holidays = (db.holidays||[]).filter(h=>h.id!==id);
  saveDB();
  renderHolidaysList();
  if(currentPage==='home') renderHome();
  toast('تم الحذف');
}

function renderHolidaysList(){
  const box = document.getElementById('holidaysList');
  if(!box) return;
  const list = (db.holidays||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(!list.length){ box.innerHTML = '<div class="empty-msg">لا يوجد أعياد أو إجازات مضافة بعد</div>'; return; }
  const today = todayStr();
  box.innerHTML = list.map(h=>`
    <div class="row" style="padding:8px 0;border-bottom:1px dashed var(--stitch);">
      <span style="${h.date<today?'color:var(--muted);':''}">📅 ${fmtDate(h.date)} — ${escapeHtml(h.name)}</span>
      <button class="btn sm danger" onclick="deleteHoliday('${h.id}')">🗑️</button>
    </div>
  `).join('');
}

function saveDebtThreshold(){
  const val = Number(document.getElementById('debtThresholdInput').value);
  if(!val || val<=0){ toast('أدخل رقماً صحيحاً أكبر من صفر'); return; }
  db.debtThreshold = val;
  saveDB();
  toast('تم الحفظ ✅');
}

// إعادة حساب مواعيد التسليم لكل الطلبات النشطة (غير المسلَّمة) من جديد
// بنفس منطق اقتراح الموعد عند إنشاء الطلب، لكن بناءً على الطاقة الاستيعابية
// الحالية (بعد التعديل) — مرتبة حسب أسبقية الاستلام (الأقدم يتحسب أولاً)
function recalculateAllDeliveryDates(){
  const capacity = Number(db.dailyCapacity)||500;
  const avgDelay = avgDelayDays();
  const safetyDays = avgDelay>0.5 ? 2+Math.ceil(avgDelay) : 2;

  const active = db.orders
    .filter(o=>o.status!=='تم التسليم')
    .sort((a,b)=>(a.dateReceived||'').localeCompare(b.dateReceived||'') || String(a.id).localeCompare(String(b.id)));

  let cumValue = 0;
  active.forEach(o=>{
    cumValue += orderTotal(o);
    const daysNeeded = Math.max(1, Math.ceil(cumValue/capacity));
    const totalDays = daysNeeded + safetyDays;
    o.dateDelivery = addWorkDaysFromNow(totalDays).toISOString().slice(0,10);
  });

  saveDB();
  renderAll();
}

async function saveDailyCapacity(){
  const val = Number(document.getElementById('dailyCapacityInput').value);
  if(!val || val<=0){ toast('أدخل رقماً صحيحاً أكبر من صفر'); return; }
  const startH = Number(document.getElementById('workStartHourInput').value);
  const endH = Number(document.getElementById('workEndHourInput').value);
  if(!Number.isFinite(startH) || !Number.isFinite(endH) || endH<=startH){
    toast('تأكد إن ساعة النهاية بعد ساعة البداية'); return;
  }
  const capacityChanged = Number(db.dailyCapacity)!==val;
  db.dailyCapacity = val;
  db.workStartHour = startH;
  db.workEndHour = endH;
  saveDB();
  if(currentPage==='home') renderTodayPlan();
  toast('تم حفظ الطاقة اليومية ✅');

  if(capacityChanged){
    const hasActiveOrders = db.orders.some(o=>o.status!=='تم التسليم');
    if(hasActiveOrders && await appConfirm('تم تغيير الطاقة الاستيعابية اليومية. هل تريد إعادة حساب مواعيد التسليم لكل الطلبات الحالية (غير المسلَّمة) بناءً على القيمة الجديدة؟', {okText:'إعادة الحساب', danger:false})){
      recalculateAllDeliveryDates();
      toast('تم تحديث مواعيد التسليم لكل الطلبات ✅');
    }
  }
}

function saveInvoiceTaxSettings(){
  const nextInv = Number(document.getElementById('nextInvoiceInput').value);
  const taxDef = Number(document.getElementById('taxDefaultInput').value);
  if(!nextInv || nextInv<=0){ toast('أدخل رقم فاتورة صحيح أكبر من صفر'); return; }
  if(!Number.isFinite(taxDef) || taxDef<0){ toast('نسبة الضريبة لا يمكن أن تكون رقماً سالباً'); return; }
  db.nextInvoiceNumber = Math.round(nextInv);
  db.taxDefaultPercent = taxDef;
  saveDB();
  toast('تم الحفظ ✅');
}

function saveVipThreshold(){
  const val = Number(document.getElementById('vipThresholdInput').value);
  if(!val || val<=0){ toast('أدخل رقماً صحيحاً أكبر من صفر'); return; }
  db.vipThreshold = val;
  saveDB();
  toast('تم الحفظ ✅');
}

function saveIdleLock(){
  const val = Number(document.getElementById('idleLockInput').value);
  if(!val || val<=0){ toast('أدخل رقماً صحيحاً أكبر من صفر'); return; }
  db.idleLockMinutes = val;
  saveDB();
  resetIdleTimer();
  toast('تم الحفظ ✅');
}

function renderGarmentTypes(){
  const list = db.garmentTypes.slice().sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  document.getElementById('garmentTypesList').innerHTML = list.length ? list.map(g=>`
    <div class="card" style="margin-bottom:8px;">
      <div class="row">
        <h3>${escapeHtml(g.name)}</h3>
        <b style="color:var(--primary)">${Number(g.price).toLocaleString('ar-EG')} ج.م</b>
      </div>
      <div class="btn-row">
        <button class="btn sm secondary" onclick="openGarmentTypeModal('${g.id}')">✏️ تعديل</button>
        <button class="btn sm danger" onclick="deleteGarmentType('${g.id}')">🗑️ حذف</button>
      </div>
    </div>
  `).join('') : `<div class="empty-msg">لا توجد أنواع مضافة بعد</div>`;
}

function openGarmentTypeModal(id){
  const g = id ? db.garmentTypes.find(x=>x.id===id) : null;
  const html = `
    <div class="modal-head"><h3>${g?'✏️ تعديل نوع':'➕ نوع تفصيل جديد'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="field"><label>اسم نوع التفصيل</label><input id="f_gtName" value="${g?escapeHtml(g.name):''}" placeholder="مثال: جلابية رجالي كلاسيك"></div>
    <div class="field"><label>السعر الأساسي (ج.م)</label><input id="f_gtPrice" type="number" value="${g?g.price:''}" placeholder="0"></div>
    <button class="btn" onclick="saveGarmentType(${g?`'${g.id}'`:'null'})">💾 حفظ</button>
  `;
  openModal(html);
}

function saveGarmentType(id){
  const name = document.getElementById('f_gtName').value.trim();
  const price = Number(document.getElementById('f_gtPrice').value)||0;
  if(!name){ toast('أدخل اسم النوع'); return; }
  if(price<=0){ toast('أدخل سعراً صحيحاً'); return; }
  const duplicate = db.garmentTypes.find(g=>g.id!==id && g.name.trim()===name);
  if(duplicate){ toast('يوجد نوع بنفس الاسم بالفعل'); return; }
  if(id){
    const g = db.garmentTypes.find(x=>x.id===id);
    Object.assign(g, {name, price});
  } else {
    db.garmentTypes.push({id:uid(), name, price});
  }
  saveDB();
  closeModal();
  renderGarmentTypes();
  toast('تم الحفظ ✅');
}

async function deleteGarmentType(id){
  if(!await appConfirm('حذف هذا النوع؟')) return;
  db.garmentTypes = db.garmentTypes.filter(g=>g.id!==id);
  saveDB();
  renderGarmentTypes();
  toast('تم الحذف');
}

/* ============================================================
   الإعدادات: كلمة المرور + نسخ احتياطي
   ============================================================ */
function changePassword(){
  const oldP = document.getElementById('oldPass').value;
  const newP = document.getElementById('newPass').value;
  if(oldP !== db.password){ toast('الرقم الحالي غير صحيح'); return; }
  if(!/^\d{4}$/.test(newP)){ toast('الرقم الجديد يجب أن يكون 4 أرقام'); return; }
  db.password = newP;
  saveDB();
  document.getElementById('oldPass').value='';
  document.getElementById('newPass').value='';
  toast('تم تغيير الرقم السري بنجاح ✅');
}

function csvEscape(val){
  let s = (val===null||val===undefined) ? '' : String(val);
  if(/[",\n]/.test(s)) s = '"'+s.replace(/"/g,'""')+'"';
  return s;
}

async function downloadCSV(rows, filename){
  const content = rows.map(r=>r.map(csvEscape).join(',')).join('\r\n');
  // BOM في الأول عشان Excel يعرض العربي صح
  const blob = new Blob(['\uFEFF'+content], {type:'text/csv;charset=utf-8;'});
  const ok = await saveOrShareFile(blob, filename);
  if(ok) toast('تم حفظ الملف ✅');
}

function exportOrdersCSV(){
  const rows = [['رقم الفاتورة','اسم العميل','رقم الهاتف','نوع الجلابية','تاريخ الاستلام','تاريخ التسليم','الحالة','الإجمالي','المدفوع','المتبقي']];
  db.orders.slice().sort((a,b)=>(b.dateReceived||'').localeCompare(a.dateReceived||'')).forEach(o=>{
    const c = customerById(o.customerId);
    rows.push([
      o.invoiceNumber||'', c?c.name:'عميل محذوف', c?(c.phone||''):'', orderTypeLabel(o),
      fmtDate(o.dateReceived), fmtDate(o.dateDelivery), o.status||'',
      orderTotal(o), Number(o.paid)||0, orderRemaining(o)
    ]);
  });
  downloadCSV(rows, 'تقرير_الطلبات_'+todayStr()+'.csv');
}

function exportCustomersCSV(){
  const rows = [['اسم العميل','رقم الهاتف','الطول','طول الكم','الصدر','الخزنة','وسع الكم','ملاحظات']];
  db.customers.slice().sort((a,b)=>a.name.localeCompare(b.name,'ar')).forEach(c=>{
    rows.push([c.name, c.phone||'', c.length||'', c.sleeve||'', c.chest||'', c.waist||'', c.shoulder||'', c.notes||'']);
  });
  downloadCSV(rows, 'تقرير_العملاء_'+todayStr()+'.csv');
}

function exportExpensesCSV(){
  const rows = [['الوصف','المبلغ','التاريخ']];
  db.expenses.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).forEach(e=>{
    rows.push([e.desc||'', Number(e.amount)||0, fmtDate(e.date)]);
  });
  downloadCSV(rows, 'تقرير_المصروفات_'+todayStr()+'.csv');
}

async function exportBackup(){
  const blob = new Blob([JSON.stringify(db, null, 2)], {type:'application/json'});
  await saveOrShareFile(blob, 'نسخة_احتياطية_ورشة_الجلابيب_'+todayStr()+'.json');
  db.lastBackupDate = todayStr();
  saveDB();
  if(currentPage==='settings') renderSettings();
  toast('تم تنزيل النسخة الاحتياطية ✅');
}


function importBackup(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async function(e){
    try{
      const imported = JSON.parse(e.target.result);
      if(!imported.customers || !imported.orders){
        toast('ملف غير صالح');
        return;
      }
      if(!await appConfirm('سيتم استبدال كل البيانات الحالية بالنسخة المستوردة. هل أنت متأكد؟')) return;
      db = imported;
      if(!db.password) db.password='0000';
      if(!db.payments) db.payments=[];
      if(!db.expenses) db.expenses=[];
      if(!db.dailyCapacity) db.dailyCapacity=500;
      if(!db.garmentTypes) db.garmentTypes=[];
      if(!db.vipThreshold) db.vipThreshold=3;
      if(!db.idleLockMinutes) db.idleLockMinutes=3;
      if(!db.debtThreshold) db.debtThreshold=2000;
      if(db.lastBackupDate===undefined) db.lastBackupDate=null;
      if(db.dayOffWeekday===undefined || db.dayOffWeekday===null) db.dayOffWeekday=0;
      if(!db.workshopName) db.workshopName='ورشة تفصيل الجلابيب';
      if(db.ownerName===undefined) db.ownerName='';
      if(db.ownerPhone===undefined) db.ownerPhone='';
      if(db.workshopAddress===undefined) db.workshopAddress='';
      if(db.workshopLogo===undefined) db.workshopLogo=null;
      if(!db.theme) db.theme={...DEFAULT_THEME};
      if(!db.btnRadius) db.btnRadius=DEFAULT_BTN_RADIUS;
      if(db.customCSS===undefined) db.customCSS='';
      if(db.customJS===undefined) db.customJS='';
      if(db.darkMode===undefined) db.darkMode=false;
      if(!db.workStartHour) db.workStartHour=9;
      if(!db.workEndHour) db.workEndHour=18;
      if(!db.queueManualOrder) db.queueManualOrder=[];
      if(!db.trash) db.trash=[];
      if(!db.nextInvoiceNumber) db.nextInvoiceNumber=1001;
      if(db.taxDefaultPercent===undefined || db.taxDefaultPercent===null) db.taxDefaultPercent=0;
      if(!db.holidays) db.holidays=[];
      if(!db.activityLog) db.activityLog=[];
      if(db.updatedAt===undefined) db.updatedAt=0;
      if(!db.cloudSync) db.cloudSync={enabled:false, syncId:null, firebaseConfig:null};
      saveDB();
      renderAll();
      applyWorkshopBranding();
      applyTheme();
      applyFontSettings();
      applyWideMode();
      applyDarkMode();
      applyCustomCSS();
      applyHomeWidgetsLayout();
      toast('تم استيراد النسخة الاحتياطية بنجاح ✅');
    }catch(err){
      toast('حدث خطأ أثناء قراءة الملف');
    }
  };
  reader.readAsText(file);
  event.target.value='';
}

/* ============================================================
   سلة المحذوفات — استرجاع العملاء/الطلبات المحذوفة خلال 7 أيام
   ============================================================ */
const TRASH_RETENTION_DAYS = 7;

function purgeOldTrash(){
  if(!db.trash || !db.trash.length) return;
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS*86400000).toISOString().slice(0,10);
  db.trash = db.trash.filter(t=>t.deletedAt >= cutoff);
}

function renderTrash(){
  const box = document.getElementById('trashList');
  const countTxt = document.getElementById('trashCountTxt');
  if(!box) return;
  purgeOldTrash();
  saveDB();
  const items = (db.trash||[]).slice().sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt));
  if(countTxt) countTxt.textContent = items.length ? `(${items.length})` : '';
  box.innerHTML = items.length ? items.map(t=>{
    const daysLeft = Math.max(0, TRASH_RETENTION_DAYS - Math.round((new Date(todayStr())-new Date(t.deletedAt))/86400000));
    const label = t.type==='customer' ? `👤 عميل: ${escapeHtml(t.data.name)}` : `📋 طلب: ${escapeHtml(customerById(t.data.customerId)?customerById(t.data.customerId).name:(t.data.type||'طلب'))}`;
    return `<div class="card">
      <div class="row"><h3 style="font-size:14.5px;">${label}</h3><span class="meta">باقي ${daysLeft} يوم</span></div>
      <div class="meta">حُذف بتاريخ ${fmtDate(t.deletedAt)}</div>
      <div class="btn-row">
        <button class="btn sm outline" onclick="restoreFromTrash('${t.id}')">↩️ استرجاع</button>
        <button class="btn sm danger" onclick="permanentlyDeleteTrashItem('${t.id}')">🗑️ حذف نهائي</button>
      </div>
    </div>`;
  }).join('') : `<div class="empty-msg">سلة المحذوفات فارغة</div>`;
}

async function restoreFromTrash(trashId){
  const t = db.trash.find(x=>x.id===trashId);
  if(!t) return;
  if(t.type==='customer'){
    db.customers.push(t.data);
  } else if(t.type==='order'){
    db.orders.push(t.data);
    if(t.payments && t.payments.length){
      db.payments.push(...t.payments);
    }
  }
  db.trash = db.trash.filter(x=>x.id!==trashId);
  logActivity(`↩️ استرجاع ${t.type==='customer'?'عميل':'طلب'} من سلة المحذوفات`);
  saveDB();
  renderTrash();
  renderCustomers();
  renderOrders();
  toast('تم الاسترجاع بنجاح ✅');
}

async function permanentlyDeleteTrashItem(trashId){
  if(!await appConfirm('هل تريد حذف هذا العنصر نهائياً؟ لن يمكن التراجع عن هذا الإجراء.')) return;
  db.trash = db.trash.filter(x=>x.id!==trashId);
  logActivity('🗑️ حذف نهائي لعنصر من سلة المحذوفات');
  saveDB();
  renderTrash();
  toast('تم الحذف النهائي');
}

/* ============================================================
   المودال العام
   ============================================================ */
function openModal(html){
  const box = document.getElementById('modalBox');
  box.innerHTML = html;
  box.scrollTop = 0;
  document.getElementById('modalOverlay').classList.add('active');
  syncNavState();
}
function closeModal(){
  document.getElementById('modalOverlay').classList.remove('active');
  syncNavState();
}

/* ============================================================
   تأكيد مخصص (appConfirm) — بديل عن confirm() الأصلية
   بعض تطبيقات الـ WebView (زي تطبيقات WebIntoApp) تمنع أو تتجاهل
   نوافذ confirm()/alert()/prompt() الافتراضية بتاعة المتصفح، فبنستخدم
   مودال داخلي بدلها عشان أزرار الحذف والتأكيد تشتغل دايمًا.
   ============================================================ */
function appConfirm(message, opts){
  opts = opts || {};
  const okText = opts.okText || 'تأكيد';
  const cancelText = opts.cancelText || 'إلغاء';
  const danger = opts.danger !== false;
  return new Promise((resolve)=>{
    openModal(`
      <div class="modal-head"><h3>⚠️ تأكيد</h3></div>
      <div style="padding:4px 2px 14px;font-size:14.5px;line-height:1.7;white-space:pre-line;">${escapeHtml(message)}</div>
      <div class="btn-row">
        <button class="btn outline" id="appConfirmCancel">${escapeHtml(cancelText)}</button>
        <button class="btn ${danger?'danger':''}" id="appConfirmOk">${escapeHtml(okText)}</button>
      </div>
    `);
    const cleanup = (result)=>{
      closeModal();
      resolve(result);
    };
    document.getElementById('appConfirmOk').onclick = ()=>cleanup(true);
    document.getElementById('appConfirmCancel').onclick = ()=>cleanup(false);
  });
}
document.getElementById('modalOverlay').addEventListener('click', function(e){
  if(e.target===this) closeModal();
});

/* ============================================================
   دعم زر الرجوع في تطبيقات الأندرويد (WebView / APK)
   من غير الكود ده، ضغط زر الرجوع وانت فاتح مودال أو القائمة
   الجانبية أو صفحة غير الرئيسية كان هيقفل التطبيق نفسه فورًا.

   الفكرة: كل "طبقة" مفتوحة فوق الحالة الأساسية (صفحة غير الرئيسية،
   مودال، قائمة جانبية) ليها history entry واحد بالظبط. بعد أي تغيير
   في الواجهة بنحسب "العمق" المفروض (navDepth) ونطابق history الحقيقي
   معاه: نزوّد entries لو بعدنا طبقة، أو نسحب نفس عدد الطبقات اللي
   قفلناها لو رجعنا للخلف من غير ما نستخدم زرار الرجوع نفسه (زرار
   إلغاء/إغلاق مثلاً)، عشان history الحقيقي يفضل مطابق تمامًا للي
   ظاهر على الشاشة أيًا كان عمق التداخل.

   وبما إن بعض تطبيقات الـ WebView (مش كلها بتتعامل بنفس الطريقة مع
   زر الرجوع) ممكن ماتدعمش history.pushState فعليًا (خصوصًا لو الملف
   شغال من مسار محلي)، أو تبعت ضغطة الرجوع كإيفنت "backbutton" مخصص
   أو حتى كـ keydown عادي بدل تفعيل popstate، بنغطي الاحتمالات التلاتة
   مع بعض عشان أعلى فرصة ممكنة إن زر الرجوع يشتغل صح.
   ============================================================ */
let handlingBackNav = false;
let syntheticBackCount = 0;
let navDepth = 0;
let lockedScrollY = 0;
let scrollLocked = false;

function currentUiDepth(){
  const modalOpen = document.getElementById('modalOverlay').classList.contains('active');
  const navOpen = document.getElementById('sideNav').classList.contains('open');
  return (currentPage!=='home' ? 1:0) + (modalOpen?1:0) + (navOpen?1:0);
}

// هل فيه "طبقة عائمة" فوق الصفحة فعليًا (مودال أو قائمة جانبية)؟
// مهم إننا نفرّقها عن currentUiDepth، لأن الانتقال بين الصفحات العادية
// (زي فتح صفحة الطلبات أو المالية) بيزوّد currentUiDepth كمان لأغراض
// زر الرجوع، لكنه مش المفروض يقفل تمرير الصفحة — القفل مطلوب بس
// وقت ما يكون فيه حاجة عائمة فوق المحتوى نفسه.
function isOverlayOpen(){
  const modalOpen = document.getElementById('modalOverlay').classList.contains('active');
  const navOpen = document.getElementById('sideNav').classList.contains('open');
  return modalOpen || navOpen;
}

/* قفل تمرير الصفحة اللي وراء المودال/القائمة الجانبية أثناء فتحها.
   من غير القفل ده، سحب الإصبع فوق المودال ممكن "يسرّب" ويحرّك صفحة
   الخلفية بدل محتوى المودال بس — وده اللي بيسبب إحساس إنك تقدر تسحب
   المودال لتحت بس مش لفوق (لأن صفحة الخلفية بتتحرك في اتجاه واحد
   ومش بترجع تاني، خصوصًا لما تفتح لوحة المفاتيح على حقل داخل المودال). */
function lockBodyScroll(){
  lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.style.position = 'fixed';
  document.body.style.top = (-lockedScrollY) + 'px';
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}
function unlockBodyScroll(){
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, lockedScrollY);
}

// تنفيذ آمن لعمليات history — بعض بيئات WebView (خصوصًا لو الملف شغال
// من مسار محلي مش عبر سيرفر) ممكن ترفض pushState/back برمي خطأ بصمت،
// فبنلف كل نداء عشان أي خطأ هنا ميوقفش باقي منطق التنقل الداخلي للتطبيق
function safeHistoryOp(fn){
  try{ fn(); }catch(e){ /* تجاهل: التنقل الداخلي هيشتغل برضه من غير history */ }
}

// يُنادى بعد أي تغيير في الواجهة (فتح/قفل صفحة، مودال، أو قائمة جانبية)
// عشان يزامن حالة history الحقيقية مع اللي ظاهر على الشاشة فعليًا
function syncNavState(){
  if(handlingBackNav) return;
  const target = currentUiDepth();
  const overlayOpen = isOverlayOpen();
  if(!scrollLocked && overlayOpen){ lockBodyScroll(); scrollLocked = true; }
  else if(scrollLocked && !overlayOpen){ unlockBodyScroll(); scrollLocked = false; }
  if(target > navDepth){
    while(navDepth < target){
      navDepth++;
      safeHistoryOp(()=>history.pushState({navLevel:navDepth}, ''));
    }
  } else if(target < navDepth){
    const steps = navDepth - target;
    navDepth = target;
    syntheticBackCount += steps;
    for(let i=0;i<steps;i++) safeHistoryOp(()=>history.back());
  } else if(target === navDepth && target > 0){
    safeHistoryOp(()=>history.replaceState({navLevel:navDepth}, ''));
  }
}


// يقفل أعلى "طبقة" مفتوحة حاليًا: مودال، وإلا قائمة جانبية، وإلا يرجع للرئيسية
function closeTopLayer(){
  const modalOpen = document.getElementById('modalOverlay').classList.contains('active');
  const navOpen = document.getElementById('sideNav').classList.contains('open');
  if(modalOpen){
    closeModal();
  } else if(navOpen){
    closeSideNav();
  } else if(currentPage !== 'home'){
    showPage('home');
  }
}

function handleRealBackNavigation(){
  handlingBackNav = true;
  closeTopLayer();
  navDepth = Math.max(0, navDepth-1);
  setTimeout(()=>{ handlingBackNav = false; }, 0);
}

// 1) المسار المعتاد: الـ WebView بيدعم history الحقيقي، وضغط زر الرجوع بيطلق popstate
window.addEventListener('popstate', function(){
  if(syntheticBackCount > 0){
    // إحنا اللي استهلكنا الحالة دي برمجيًا (مش ضغطة زرار رجوع حقيقية)
    // فالواجهة أصلاً متزامنة، مفيش داعي نعمل أي إجراء إضافي
    syntheticBackCount--;
    return;
  }
  if(window.BACK_NAV_DEBUG) toast('🔧 popstate اشتغل');
  handleRealBackNavigation();
});

// 2) مسار احتياطي: بعض تطبيقات الـ WebView بتبعت إيفنت "backbutton" مخصص
//    (زي أسلوب Cordova القديم) بدل ما تعتمد على history الحقيقي فعليًا
document.addEventListener('backbutton', function(e){
  if(window.BACK_NAV_DEBUG) toast('🔧 backbutton اشتغل');
  if(currentUiDepth() > 0){
    if(e && typeof e.preventDefault==='function') e.preventDefault();
    handleRealBackNavigation();
  }
}, false);

// 3) مسار احتياطي أخير: لو الـ WebView بيمرر ضغطة الرجوع كـ keydown عادي
//    (keyCode 4 هو الكود التقليدي لزر الرجوع في أندرويد)
document.addEventListener('keydown', function(e){
  if(e.keyCode===4 || e.key==='GoBack'){
    if(window.BACK_NAV_DEBUG) toast('🔧 keydown اشتغل');
    if(currentUiDepth() > 0){
      e.preventDefault();
      handleRealBackNavigation();
    }
  }
});

window.BACK_NAV_DEBUG = false;

/* ============================================================
   بدء التشغيل
   ============================================================ */
initLock();

// تسجيل الـ Service Worker (يفعّل التثبيت كتطبيق وتشغيل الأوفلاين)
// شرط أساسي: لازم الملف يكون شغال من سيرفر HTTPS أو localhost (مش file:// مباشرة)
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{ /* تجاهل الخطأ لو الملف مش موجود بجانب الصفحة */ });
  });
}
