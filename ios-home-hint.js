'use strict';

(function initPwaInstallHint() {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const currentLang = localStorage.getItem('kids_art_lang') || 'en';
  let deferredPrompt = null;
  let activeBanner = null;
  let androidBannerShown = false;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    }, { once: true });
  }

  function createBanner(copy, actionLabel = '', actionHandler = null) {
    if (activeBanner) activeBanner.remove();

    const banner = document.createElement('div');
    banner.className = 'ios-home-hint';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `
      <div class="ios-home-hint-icon" aria-hidden="true"><span></span></div>
      <div class="ios-home-hint-copy">
        <div class="ios-home-hint-title">${copy.title}</div>
        <div class="ios-home-hint-text">${copy.body}</div>
      </div>
      ${actionLabel ? `<button type="button" class="ios-home-hint-action">${actionLabel}</button>` : ''}
      <button type="button" class="ios-home-hint-close" aria-label="${copy.close}">✕</button>
    `;

    banner.querySelector('.ios-home-hint-close')?.addEventListener('click', () => {
      sessionStorage.setItem(copy.dismissKey, '1');
      banner.remove();
      activeBanner = null;
    });

    if (actionHandler) {
      banner.querySelector('.ios-home-hint-action')?.addEventListener('click', actionHandler);
    }

    document.body.appendChild(banner);
    activeBanner = banner;
  }

  function showAndroidBanner(forceFallback = false) {
    if (androidBannerShown || isStandalone || sessionStorage.getItem('kids_art_android_hint_dismissed') === '1') {
      return;
    }

    androidBannerShown = true;
    const canInstallDirectly = Boolean(deferredPrompt) && !forceFallback;
    const copy = currentLang === 'zh'
      ? {
          title: '安装到手机桌面',
          body: canInstallDirectly
            ? '点“安装”即可把这个作品站添加到安卓手机桌面。'
            : '可将这个作品站添加到桌面。如果没有弹出安装框，请点浏览器右上角菜单，再选“安装应用”或“添加到主屏幕”。',
          close: '关闭提醒',
          dismissKey: 'kids_art_android_hint_dismissed',
        }
      : {
          title: 'Install App',
          body: canInstallDirectly
            ? 'Tap Install to add this art archive to your Android home screen.'
            : 'You can add this art archive to your home screen. If no install sheet appears, open the browser menu and choose “Install app” or “Add to Home screen”.',
          close: 'Dismiss hint',
          dismissKey: 'kids_art_android_hint_dismissed',
        };

    const actionLabel = canInstallDirectly ? (currentLang === 'zh' ? '安装' : 'Install') : '';
    createBanner(copy, actionLabel, async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch {}
      deferredPrompt = null;
      activeBanner?.remove();
      activeBanner = null;
    });
  }

  if (isIos && isSafari && !isStandalone && sessionStorage.getItem('kids_art_ios_hint_dismissed') !== '1') {
    const copy = currentLang === 'zh'
      ? {
          title: '添加到手机桌面',
          body: '在 Safari 中点分享按钮，再选“添加到主屏幕”。',
          close: '关闭提醒',
          dismissKey: 'kids_art_ios_hint_dismissed',
        }
      : {
          title: 'Add to Home Screen',
          body: 'In Safari, tap Share, then choose “Add to Home Screen”.',
          close: 'Dismiss hint',
          dismissKey: 'kids_art_ios_hint_dismissed',
        };
    window.addEventListener('load', () => createBanner(copy), { once: true });
  }

  if (isAndroid && !isStandalone) {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredPrompt = event;
      showAndroidBanner();
    });

    window.addEventListener('load', () => {
      setTimeout(() => {
        if (!deferredPrompt) showAndroidBanner(true);
      }, 1200);
    }, { once: true });
  }
})();
