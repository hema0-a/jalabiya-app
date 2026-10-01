/* ============================================================
   storage-optimizer.js - مراقبة وصيانة مساحة التخزين
   [الجزء 1: حماية البيانات]
   
   يراقب حجم localStorage وينظّف تلقائياً عند اقتراب الامتلاء.
   ============================================================ */

(function() {
  if (window.__storageOptimizerLoaded) return;
  window.__storageOptimizerLoaded = true;

  console.log('💾 تحميل storage-optimizer.js...');

  const STORAGE_LIMIT_MB = 4.5; // الحد الآمن من 5 MB
  const WARNING_THRESHOLD = 0.7; // 70% = تحذير
  const CRITICAL_THRESHOLD = 0.9; // 90% = حرج

  // حساب الحجم المستخدم
  function estimateStorageSize() {
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        total += key.length + (value ? value.length : 0);
      }
    } catch (e) {
      console.warn('فشل تقدير حجم التخزين:', e);
    }
    return total;
  }

  function checkStorageSpace() {
    const usedBytes = estimateStorageSize();
    const usedMB = usedBytes / (1024 * 1024);
    const percentUsed = usedMB / STORAGE_LIMIT_MB;
    
    return {
      usedMB: usedMB.toFixed(2),
      usedBytes: usedBytes,
      percentUsed: Math.min(1, percentUsed),
      isWarning: percentUsed > WARNING_THRESHOLD,
      isCritical: percentUsed > CRITICAL_THRESHOLD
    };
  }

  // تنظيف البيانات القديمة
  function cleanOldData() {
    if (!window.db) return 0;
    
    console.log('🧹 بدء تنظيف البيانات القديمة...');
    let cleanedCount = 0;
    
    try {
      // 1. سجل النشاط (أبقِ آخر 50 فقط)
      if (window.db.activityLog && window.db.activityLog.length > 50) {
        const removed = window.db.activityLog.length - 50;
        window.db.activityLog = window.db.activityLog.slice(-50);
        cleanedCount += removed;
      }
      
      // 2. الإشعارات المفقودة
      if (window.db.missedCommitmentNotices && window.db.missedCommitmentNotices.length > 20) {
        const removed = window.db.missedCommitmentNotices.length - 20;
        window.db.missedCommitmentNotices = window.db.missedCommitmentNotices.slice(-20);
        cleanedCount += removed;
      }
      
      // 3. سلة المحذوفات
      if (window.db.trash && window.db.trash.length > 10) {
        const removed = window.db.trash.length - 10;
        window.db.trash = window.db.trash.slice(-10);
        cleanedCount += removed;
      }
      
      // 4. سجل دفعات الالتزامات
      if (window.db.commitmentPayments && window.db.commitmentPayments.length > 100) {
        const removed = window.db.commitmentPayments.length - 100;
        window.db.commitmentPayments = window.db.commitmentPayments.slice(-100);
        cleanedCount += removed;
      }
      
      // 5. سجل المخزون
      if (window.db.inventoryLog && window.db.inventoryLog.length > 50) {
        const removed = window.db.inventoryLog.length - 50;
        window.db.inventoryLog = window.db.inventoryLog.slice(-50);
        cleanedCount += removed;
      }
      
      if (cleanedCount > 0) {
        window.saveDB(true);
        console.log(`✅ تم تنظيف ${cleanedCount} عنصر`);
      }
    } catch (e) {
      console.warn('فشل تنظيف البيانات:', e);
    }
    
    return cleanedCount;
  }

  // إزالة صور كبيرة من localStorage (المعرض)
  function cleanLargeImages() {
    let cleaned = 0;
    try {
      const gallery = JSON.parse(localStorage.getItem('workGallery') || '[]');
      const filtered = gallery.filter(function(item) {
        // إزالة الصور الأكبر من 250 KB
        if (item.img && item.img.length > 250000) {
          cleaned++;
          return false;
        }
        return true;
      });
      
      if (cleaned > 0) {
        localStorage.setItem('workGallery', JSON.stringify(filtered));
        console.log(`✅ تم إزالة ${cleaned} صورة كبيرة`);
      }
    } catch (e) {
      console.warn('فشل تنظيف الصور:', e);
    }
    return cleaned;
  }

  // ضغط شعار الورشة إن كان كبيراً
  function compressLargeLogo() {
    if (!window.db || !window.db.workshopLogo) return;
    
    const logo = window.db.workshopLogo;
    if (logo.length < 100000) return; // أقل من 100 KB، لا حاجة
    
    console.log('🖼️ شعار الورشة كبير — جارٍ الضغط...');
    
    const img = new Image();
    img.onload = function() {
      try {
        const maxSize = 400;
        let width = img.width;
        let height = img.height;
        
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressed = canvas.toDataURL('image/jpeg', 0.5);
        
        if (compressed.length < logo.length) {
          window.db.workshopLogo = compressed;
          window.saveDB(true);
          
          const savedKB = Math.round((logo.length - compressed.length) * 0.75 / 1024);
          console.log(`✅ تم ضغط الشعار (وُفِّر ${savedKB} KB)`);
        }
      } catch (e) {
        console.warn('فشل ضغط الشعار:', e);
      }
    };
    img.onerror = function() {
      console.warn('فشل تحميل صورة الشعار');
    };
    img.src = logo;
  }

  // عرض تحذير للمستخدم
  function showStorageWarning(status) {
    if (!status.isWarning) return;
    
    const alerts = document.getElementById('homeAlerts');
    if (!alerts) return;
    
    // لا تكرر التحذير
    if (alerts.querySelector('.storage-warning-banner')) return;
    
    const isCrit = status.isCritical;
    const icon = isCrit ? '🚨' : '💾';
    const title = isCrit ? 'مساحة التخزين ممتلئة تقريباً!' : 'مساحة التخزين تقترب من الامتلاء';
    const msg = `تم استخدام ${status.usedMB} MB من أصل ${STORAGE_LIMIT_MB} MB. يرجى تصدير نسخة احتياطية وتنظيف البيانات القديمة.`;
    
    const html = `
      <div class="alert-banner ${isCrit ? 'danger' : 'warn'} storage-warning-banner" style="margin-bottom:10px;">
        <span class="ic">${icon}</span>
        <div>
          <b>${title}</b>
          ${msg}
          <div class="btn-row" style="margin-top:8px;">
            <button class="btn sm outline" onclick="window.cleanOldData();renderHome();">
              🧹 تنظيف تلقائي
            </button>
            <button class="btn sm outline" onclick="if(typeof exportBackup==='function')exportBackup()">
              💾 نسخة احتياطية
            </button>
          </div>
        </div>
      </div>
    `;
    
    alerts.insertAdjacentHTML('afterbegin', html);
  }

  // دمج مع boot
  const origBoot = window.boot;
  if (typeof origBoot === 'function') {
    window.boot = function() {
      origBoot.apply(this, arguments);
      
      // فحص بعد 3 ثوانٍ من التحميل
      setTimeout(function() {
        compressLargeLogo();
        const status = checkStorageSpace();
        if (status.isWarning) {
          showStorageWarning(status);
        }
      }, 3000);
    };
  }

  // فحص دوري كل دقيقة
  setInterval(function() {
    const status = checkStorageSpace();
    if (status.isCritical) {
      showStorageWarning(status);
    }
  }, 60000);

  // تصدير الدوال للاستخدام العام
  window.checkStorageSpace = checkStorageSpace;
  window.cleanOldData = cleanOldData;
  window.cleanLargeImages = cleanLargeImages;

  // فحص أولي
  setTimeout(function() {
    const status = checkStorageSpace();
    console.log(`💾 مساحة التخزين: ${status.usedMB} MB / ${STORAGE_LIMIT_MB} MB (${Math.round(status.percentUsed * 100)}%)`);
  }, 2000);

  console.log('✅ تم تحميل storage-optimizer.js');
})();