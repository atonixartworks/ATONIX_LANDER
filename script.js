/* ==========================================================================
   ATONIX — Premium Interactive Engine v2.0
   Dark Cinematic + Aurora UI | Rebuilt Scroll Engine + Live Counters
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ══════════════════════════════════════════════════════════════════════
  // CONFIGURATION & WAITLIST ENGINE
  // ══════════════════════════════════════════════════════════════════════
  const CONFIG = {
    // Your Supabase Project URL
    SUPABASE_URL: "https://ucmsgxdggqbjroljebdx.supabase.co",
    // Your Supabase public/anon Key (Paste the full publishable key here)
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjbXNneGRnZ3FianJvbGplYmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4ODIyNTksImV4cCI6MjA5NzQ1ODI1OX0.ESiAlrAJ1eLGk3EiHjvRKkU7Oz6TNAxi_sV0YwLylhc",
    // Your database table name in Supabase
    SUPABASE_TABLE: "waitlist",
    // Enable/disable localStorage database backup
    BACKUP_LOCAL_STORAGE: true
  };

  // Local storage save function
  function saveToLocalStorage(user) {
    if (!CONFIG.BACKUP_LOCAL_STORAGE) return;
    try {
      const waitlist = JSON.parse(localStorage.getItem('atonix_waitlist') || '[]');
      // Avoid duplicate emails
      if (!waitlist.some(u => u.email.toLowerCase() === user.email.toLowerCase())) {
        waitlist.push(user);
        localStorage.setItem('atonix_waitlist', JSON.stringify(waitlist));
      }
    } catch (e) {
      console.error('Error saving to localStorage waitlist:', e);
    }
  }

  // Developer console exporter
  // To view and export registered users, run: exportWaitlist() in the browser developer console.
  window.exportWaitlist = function() {
    try {
      const list = JSON.parse(localStorage.getItem('atonix_waitlist') || '[]');
      if (list.length === 0) {
        console.log("No registered users found in localStorage yet.");
        return;
      }
      const csvHeaders = ["Name", "Phone", "Email", "City", "Identity", "Role", "Timestamp"];
      const csvRows = [csvHeaders];
      list.forEach(u => {
        csvRows.push([
          u.name || "",
          u.phone || "",
          u.email || "",
          u.city || "",
          u.identity || "",
          u.role || "",
          u.timestamp || ""
        ]);
      });
      const csvContent = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      
      console.log("%c--- ATONIX WAITLIST EXPORT (CSV) ---", "color: #8A2BE2; font-weight: bold; font-size: 14px;");
      console.log(csvContent);
      console.log("%c-----------------------------------", "color: #8A2BE2; font-weight: bold;");
      
      // Download as actual file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `atonix_waitlist_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Error exporting waitlist:', e);
    }
  };

  // Main submission handler (targeting Supabase REST API)
  async function submitWaitlistData(user) {
    user.timestamp = new Date().toISOString();
    saveToLocalStorage(user);

    const hasSupabase = CONFIG.SUPABASE_URL && CONFIG.SUPABASE_URL.trim() !== "" && 
                        CONFIG.SUPABASE_ANON_KEY && CONFIG.SUPABASE_ANON_KEY.trim() !== "";

    if (hasSupabase) {
      try {
        const cleanedUrl = CONFIG.SUPABASE_URL.endsWith('/') ? CONFIG.SUPABASE_URL.slice(0, -1) : CONFIG.SUPABASE_URL;
        const endpoint = `${cleanedUrl}/rest/v1/${CONFIG.SUPABASE_TABLE}`;
        
        // Prepare Supabase record payload (exclude timestamp since created_at is default timezone in db)
        const payload = {
          name: user.name,
          phone: user.phone || null,
          email: user.email || null,
          city: user.city,
          identity: user.identity,
          role: user.role
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errMsg = await response.text();
          throw new Error(`Supabase REST error: ${response.status} - ${errMsg}`);
        }
        
        return { success: true, api: true };
      } catch (err) {
        console.error('Supabase submission failed, fell back to local storage:', err);
        return { success: true, api: false, error: err.message };
      }
    }
    return { success: true, api: false };
  }

  // Force scroll to top if flagged by Back to Top button
  if (sessionStorage.getItem('scroll_to_top') === 'true') {
    sessionStorage.removeItem('scroll_to_top');
    window.scrollTo(0, 0);
  }

  // Respect user's reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Category Carousel State
  let currentCatIndex = 0;
  let catInterval;
  let isScrollingCategories = false;
  const catCards = document.querySelectorAll('.cat-card');
  const totalCatCards = catCards.length;

  // Smooth Scroll Variables
  let smoothScrollTop = window.scrollY;
  let targetScrollTop = window.scrollY;

  // Real scroll direction and inactivity variables
  let lastActualScrollY = window.scrollY;
  let scrollInactivityTimer = null;
  const heroScrollHint = document.getElementById('hero-scroll-hint');

  // ══════════════════════════════════════════════════════════════════════
  // 1. Canvas Frame Animation Engine
  // ══════════════════════════════════════════════════════════════════════
  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas.getContext('2d');

  // Detect mobile device on startup to disable heavy canvas animations and image downloads
  const isMobileDevice = window.innerWidth <= 992;

  const totalFrames = 1639;
  const imageCache  = {};
  let currentFrameIndex = 0;
  let targetFrameIndex  = 0;
  let lastRenderIndex   = -1;

  function getFramePath(globalIndex) {
    let folder, fileIndex;
    if      (globalIndex < 300)  { folder = 1; fileIndex = globalIndex + 1; }
    else if (globalIndex < 600)  { folder = 2; fileIndex = globalIndex - 300 + 1; }
    else if (globalIndex < 900)  { folder = 3; fileIndex = globalIndex - 600 + 1; }
    else if (globalIndex < 1200) { folder = 4; fileIndex = globalIndex - 900 + 1; }
    else if (globalIndex < 1500) { folder = 5; fileIndex = globalIndex - 1200 + 1; }
    else                          { folder = 6; fileIndex = globalIndex - 1500 + 1; }
    return `Frames/${folder}/ezgif-frame-${String(fileIndex).padStart(3, '0')}.jpg`;
  }

  function resizeCanvas() {
    if (isMobileDevice) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ri  = Math.round(currentFrameIndex);
    const img = imageCache[ri] || getClosestLoadedFrame(ri);
    if (img && img.complete && img.naturalWidth) drawFrame(img);
  }

  function drawFrame(img) {
    const cW = canvas.width, cH = canvas.height;
    const iW = img.naturalWidth || 1920, iH = img.naturalHeight || 1080;
    const ratio = Math.max(cW / iW, cH / iH);
    const nW = iW * ratio, nH = iH * ratio;
    ctx.clearRect(0, 0, cW, cH);
    ctx.drawImage(img, (cW - nW) / 2, (cH - nH) / 2, nW, nH);
  }

  function preloadFrame(index, callback, priority = 'low') {
    if (index < 0 || index >= totalFrames) {
      if (callback) callback();
      return;
    }
    if (imageCache[index]) {
      if (callback) callback();
      return;
    }
    const img = new Image();
    img.fetchPriority = priority;
    img.src = getFramePath(index);
    imageCache[index] = img;
    img.onload = () => {
      img.decode().then(() => {
        if (callback) callback();
      }).catch(() => {
        if (callback) callback();
      });
    };
    img.onerror = () => {
      if (callback) callback();
    };
  }

  function getClosestLoadedFrame(targetIndex) {
    let closestIndex = -1, minDiff = Infinity;
    for (const key in imageCache) {
      const idx = parseInt(key);
      const img = imageCache[idx];
      if (img && img.complete && img.naturalWidth) {
        const diff = Math.abs(idx - targetIndex);
        if (diff < minDiff) { minDiff = diff; closestIndex = idx; }
      }
    }
    return closestIndex !== -1 ? imageCache[closestIndex] : null;
  }

  function renderLoop() {
    // Buttery smooth scroll reveal animations (JS scroll lerping)
    const isScrollActive = Math.abs(targetScrollTop - smoothScrollTop) > 0.05;
    if (isScrollActive) {
      smoothScrollTop += (targetScrollTop - smoothScrollTop) * 0.03;
      updateScrollProgress(smoothScrollTop);
      updateHeaderState(smoothScrollTop);
      updateNavActive(smoothScrollTop);
    } else if (Math.round(smoothScrollTop) !== Math.round(targetScrollTop)) {
      smoothScrollTop = targetScrollTop;
      updateScrollProgress(smoothScrollTop);
      updateHeaderState(smoothScrollTop);
      updateNavActive(smoothScrollTop);
    }

    // On mobile devices, do not load or draw canvas animation frames to optimize network/CPU
    if (isMobileDevice) {
      requestAnimationFrame(renderLoop);
      return;
    }

    // Synchronize targetFrameIndex with smoothScrollTop to eliminate canvas animation lag
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll > 0) {
      targetFrameIndex = Math.min(totalFrames - 1, Math.floor((smoothScrollTop / maxScroll) * totalFrames));
    }

    // Lerp canvas animation frames (reduced coefficient for butter-smooth cinematic drift)
    currentFrameIndex += (targetFrameIndex - currentFrameIndex) * 0.08;
    const ri  = Math.round(currentFrameIndex);
    const img = imageCache[ri];

    if (img && img.complete && img.naturalWidth) {
      drawFrame(img);
    } else {
      const fb = getClosestLoadedFrame(ri);
      if (fb) drawFrame(fb);
      
      // Load the current active frame immediately with high priority
      preloadFrame(ri, () => {
        if (Math.round(currentFrameIndex) === ri) {
          const freshImg = imageCache[ri];
          if (freshImg && freshImg.complete && freshImg.naturalWidth) {
            drawFrame(freshImg);
          }
        }
      }, 'high');
    }

    if (ri !== lastRenderIndex) {
      // Preload 12 frames ahead in the direction of scroll with low priority
      const direction = ri > lastRenderIndex ? 1 : -1;
      for (let i = 1; i <= 12; i++) {
        preloadFrame(ri + i * direction, null, 'low');
      }

      // Garbage collect far-away frames from cache, preserving backbone frames (multiples of 20)
      Object.keys(imageCache).forEach(key => {
        const idx = parseInt(key);
        if (idx % 20 === 0) return; // Keep backbone frames
        if (Math.abs(idx - ri) > 40) {
          delete imageCache[idx];
        }
      });
      lastRenderIndex = ri;
    }
    requestAnimationFrame(renderLoop);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. Header scroll state
  // ══════════════════════════════════════════════════════════════════════
  let lastScrollY = 0;
  const siteHeader = document.getElementById('site-header');

  function updateHeaderState(scrollTop = window.scrollY) {
    const currentScrollY = scrollTop;

    // SCROLL CLASS
    if (currentScrollY > 20) {
      siteHeader?.classList.add('scrolled');
    } else {
      siteHeader?.classList.remove('scrolled');
    }

    // Scroll Down Hint Visibility
    // At the top, keep the hint visible and clear the inactivity timer if no modal is open.
    // Past 50px, the inactivity timer handles the visibility state.
    const regModalOpen = document.getElementById('register-modal')?.classList.contains('open');
    const succModalOpen = document.getElementById('success-modal')?.classList.contains('open');
    const modalIsOpen = regModalOpen || succModalOpen;

    if (currentScrollY <= 50 && !modalIsOpen) {
      heroScrollHint?.classList.remove('hidden-hint');
      clearTimeout(scrollInactivityTimer);
    } else if (modalIsOpen) {
      heroScrollHint?.classList.add('hidden-hint');
    }

    // AUTO HIDE / SHOW
    // Use raw window.scrollY to detect direction changes instantly
    const actualScrollY = window.scrollY;

    if (actualScrollY <= 20) {
      siteHeader?.classList.remove('nav-hidden');
      siteHeader?.classList.add('at-top');
    } else if (actualScrollY > lastActualScrollY) {
      // Scrolling down
      siteHeader?.classList.add('nav-hidden');
      siteHeader?.classList.remove('at-top');
    } else if (actualScrollY < lastActualScrollY) {
      // Scrolling up
      siteHeader?.classList.remove('nav-hidden');
      siteHeader?.classList.remove('at-top');
    }

    lastActualScrollY = actualScrollY;
    lastScrollY = currentScrollY;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. Mobile Nav Drawer
  // ══════════════════════════════════════════════════════════════════════
  const hamburgerBtn     = document.getElementById('hamburger-btn');
  const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
  const mobileNavDrawer  = document.getElementById('mobile-nav-drawer');
  const mobileNavClose   = document.getElementById('mobile-nav-close');
  const mobileNavLinks   = document.querySelectorAll('.mobile-nav-link');

  function openMobileNav() {
    hamburgerBtn?.classList.add('open');
    mobileNavOverlay?.classList.add('open');
    mobileNavDrawer?.classList.add('open');
    hamburgerBtn?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileNav() {
    hamburgerBtn?.classList.remove('open');
    mobileNavOverlay?.classList.remove('open');
    mobileNavDrawer?.classList.remove('open');
    hamburgerBtn?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  hamburgerBtn?.addEventListener('click', () => {
    if (hamburgerBtn.classList.contains('open')) closeMobileNav();
    else openMobileNav();
  });

  mobileNavClose?.addEventListener('click', closeMobileNav);
  mobileNavOverlay?.addEventListener('click', closeMobileNav);
  mobileNavLinks.forEach(link => link.addEventListener('click', closeMobileNav));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMobileNav();
  });

  // ══════════════════════════════════════════════════════════════════════
  // 4. Nav active state on scroll (section tracking)
  // ══════════════════════════════════════════════════════════════════════
  const navLinks = document.querySelectorAll('.nav-links a[id]');
  const sectionIds = ['hero-section', 'about', 'audiences', 'features', 'categories', 'register'];
  const sectionEls = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

  const navMap = {
    'hero-section': 'nav-home',
    about:          'nav-about',
    audiences:      'nav-audiences',
    features:       'nav-features',
    categories:     'nav-categories',
    register:       'nav-register',
  };

  function updateNavActive(scrollTop = window.scrollY) {
    const scrollMid = scrollTop + window.innerHeight * 0.45;
    let activeSection = null;
    sectionEls.forEach(section => {
      const top = section.offsetTop;
      if (scrollMid >= top) activeSection = section.id;
    });
    navLinks.forEach(link => link.classList.remove('active'));
    if (activeSection && navMap[activeSection]) {
      const activeLink = document.getElementById(navMap[activeSection]);
      activeLink?.classList.add('active');
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. Scroll Presentation Engine (5-Stage Reveal)
  // ══════════════════════════════════════════════════════════════════════
  const tracks = document.querySelectorAll('.scroll-track');
  const headlineOffsets = [];

  function measureHeadlinePositions() {
    if (window.innerWidth <= 1024 || prefersReducedMotion) return;

    // Temporarily reveal hidden audience tabs to measure
    const hiddenEls = [];
    document.querySelectorAll('.audience-content').forEach(el => {
      if (getComputedStyle(el).display === 'none') {
        hiddenEls.push({ el, prevDisplay: el.style.display, prevPos: el.style.position, prevVis: el.style.visibility });
        el.style.setProperty('display', 'block', 'important');
        el.style.position = 'absolute';
        el.style.visibility = 'hidden';
      }
    });

    tracks.forEach((track, ti) => {
      const sticky    = track.querySelector('.sticky-container');
      const headlines = track.querySelectorAll('.reveal-headline');
      headlineOffsets[ti] = [];

      headlines.forEach((hl, hi) => {
        const prevTf = hl.style.transform;
        hl.style.transform = 'none';
        const sRect = sticky.getBoundingClientRect();
        const hRect = hl.getBoundingClientRect();
        const dX = (sRect.width  / 2) - ((hRect.left - sRect.left) + hRect.width  / 2);
        const dY = (sRect.height / 2) - ((hRect.top  - sRect.top)  + hRect.height / 2);
        
        // Calculate fitScale to scale the headline to 90% of viewport width on entry, making it even bigger but safe from cropping
        const fitScale = hRect.width > 0 ? Math.max(2.0, Math.min(5.5, (sRect.width * 0.90) / hRect.width)) : 4.0;

        headlineOffsets[ti][hi] = { dX, dY, fitScale };
        hl.style.transform = prevTf;
      });
    });

    hiddenEls.forEach(({ el, prevDisplay, prevPos, prevVis }) => {
      el.style.display     = prevDisplay;
      el.style.position    = prevPos;
      el.style.visibility  = prevVis;
    });
  }

  // Snapping functions removed

  function updateScrollProgress(scrollTop = window.scrollY) {
    const vH        = window.innerHeight;
    const isMobile  = window.innerWidth <= 1024 || prefersReducedMotion;

    if (isMobile) {
      tracks.forEach(track => {
        track.style.removeProperty('--headline-opacity');
        track.style.removeProperty('--line-scale');
        track.style.removeProperty('--content-opacity');
        track.style.removeProperty('--content-translate');
        track.style.removeProperty('--section-opacity');
        track.style.removeProperty('--section-scale');
        track.querySelectorAll('.reveal-headline').forEach(hl => {
          hl.style.removeProperty('--headline-translate-x');
          hl.style.removeProperty('--headline-translate-y');
          hl.style.removeProperty('--headline-scale');
        });
      });
      return;
    }

    tracks.forEach((track, ti) => {
      const rect        = track.getBoundingClientRect();
      const trackTop    = rect.top + scrollTop;
      const scrollRange = track.offsetHeight - vH;
      const isLast      = ti === tracks.length - 1;

      let p = scrollRange > 0 ? (scrollTop - trackTop) / scrollRange : 0;
      p = Math.max(0, Math.min(1, p));

      let headlineOpacity   = 0;
      let lineScale         = 0;
      let contentOpacity    = 0;
      let contentTranslateY = 28;
      let sectionOpacity    = 0;
      let sectionScale      = 1;
      let currDX = 0, currDY = 0, currScale = 1;

      const isActive = scrollTop >= trackTop && scrollTop <= trackTop + scrollRange;

      if (isActive) {
        // Hero section: glass fades in WITH the headline (starts blank)
        sectionOpacity = 1;
        if (ti === 0) {
          sectionOpacity = (p < 0.30) ? (p / 0.30) : 1;
        }
        sectionScale   = 1;
        const offsets  = headlineOffsets[ti] || [];
        const fitScale = (offsets[0] && offsets[0].fitScale) ? offsets[0].fitScale : 2.8;

        if (p < 0.18) {
          // Stage 1: Headline materialises at screen center as big text (floats up 80px into position)
          const t      = p / 0.18;
          const easeT  = (1 - Math.cos(t * Math.PI)) / 2; // sine ease-in-out for super smooth entry
          headlineOpacity   = t;
          lineScale         = 0;
          contentOpacity    = 0;
          contentTranslateY = 28;
          currScale         = fitScale;
          if (offsets[0]) { currDX = offsets[0].dX; currDY = offsets[0].dY + (80 * (1 - easeT)); }

        } else if (p < 0.52) {
          // Stage 2: Headline morphs into layout position, divider draws (extended, slower)
          const t      = (p - 0.18) / 0.34;
          const easeT  = (1 - Math.cos(t * Math.PI)) / 2; // sine ease-in-out for super smooth morphing
          headlineOpacity   = 1;
          lineScale         = easeT;
          contentOpacity    = 0;
          contentTranslateY = 28;
          currScale = fitScale - ((fitScale - 1) * easeT);
          if (offsets[0]) {
            currDX = offsets[0].dX * (1 - easeT);
            currDY = offsets[0].dY * (1 - easeT);
          }

        } else if (p < 0.70) {
          // Stage 3: Content fades in, slides up (starts after headline takes its place)
          const t      = (p - 0.52) / 0.18;
          const easeT  = (1 - Math.cos(t * Math.PI)) / 2; // sine ease-in-out for super smooth content reveal
          headlineOpacity   = 1;
          lineScale         = 1;
          contentOpacity    = easeT;
          contentTranslateY = 28 * (1 - easeT);
          currScale = 1; currDX = 0; currDY = 0;

        } else if (p < 0.90) {
          // Stage 4: Fully visible (breathing room - extended to wait for extra scroll)
          headlineOpacity   = 1;
          lineScale         = 1;
          contentOpacity    = 1;
          contentTranslateY = 0;
          currScale = 1; currDX = 0; currDY = 0;

        } else {
          // Stage 5: Exit — fade out (last section stays visible)
          const t = (p - 0.90) / 0.10;
          if (isLast) {
            headlineOpacity = 1; lineScale = 1; contentOpacity = 1;
            contentTranslateY = 0; sectionOpacity = 1; sectionScale = 1;
          } else {
            headlineOpacity   = 1 - t;
            lineScale         = 1 - t;
            contentOpacity    = 1 - t;
            contentTranslateY = 0;
            sectionOpacity    = 1 - t;
            sectionScale      = 1 - 0.03 * t;
          }
          currScale = 1; currDX = 0; currDY = 0;
        }

      } else if (scrollTop > trackTop + scrollRange) {
        // Scrolled past this section
        if (isLast) {
          sectionOpacity = 1; headlineOpacity = 1; lineScale = 1;
          contentOpacity = 1; contentTranslateY = 0;
        } else {
          sectionOpacity = 0;
        }
      }
      // Before section → sectionOpacity stays 0

      // Link categories section scroll progress to carousel active card
      if (ti === 4) {
        if (isActive && !window.userInteractingWithCarousel) {
          const targetIndex = Math.min(totalCatCards - 1, Math.floor(p * totalCatCards));
          if (targetIndex !== currentCatIndex) {
            stopCatAuto();
            updateCatCarousel(targetIndex);
            
            // Resume autoplay after 2 seconds of page scroll inactivity
            clearTimeout(window.catScrollResumeTimer);
            window.catScrollResumeTimer = setTimeout(() => {
              startCatAuto();
            }, 2000);
          }
        }
      }

      track.style.setProperty('--headline-opacity',  headlineOpacity);
      track.style.setProperty('--line-scale',         lineScale);
      track.style.setProperty('--content-opacity',    contentOpacity);
      track.style.setProperty('--content-translate',  `${contentTranslateY}px`);
      track.style.setProperty('--section-opacity',    sectionOpacity);
      track.style.setProperty('--section-scale',      sectionScale);

      const headlines = track.querySelectorAll('.reveal-headline');
      const offsets   = headlineOffsets[ti] || [];
      headlines.forEach((hl, hi) => {
        const off = offsets[hi];
        hl.style.setProperty('--headline-translate-x', off ? `${currDX}px` : '0px');
        hl.style.setProperty('--headline-translate-y', off ? `${currDY}px` : '0px');
        hl.style.setProperty('--headline-scale',       currScale);
      });
    });
  }

  function isSettledOnSection(scrollTop) {
    // 1. If modals are open, do not show the hint.
    const regModalOpen = document.getElementById('register-modal')?.classList.contains('open');
    const succModalOpen = document.getElementById('success-modal')?.classList.contains('open');
    if (regModalOpen || succModalOpen) return false;

    // 2. If at the very top, show the hint.
    if (scrollTop <= 50) return true;

    // 3. Otherwise, never show the hint on content/headline sections.
    return false;
  }

  function handleScrollActivity() {
    // Hide hint immediately when scrolling
    heroScrollHint?.classList.add('hidden-hint');

    // Clear existing timer
    clearTimeout(scrollInactivityTimer);

    // Start a new 3-second timer
    scrollInactivityTimer = setTimeout(() => {
      if (isSettledOnSection(window.scrollY)) {
        heroScrollHint?.classList.remove('hidden-hint');
      }
    }, 3000);
  }

  function handleScroll() {
    targetScrollTop = window.scrollY;
    handleScrollActivity();
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. Category Carousel (Stacked 3D card deck, moving left-top-right loop)
  // ══════════════════════════════════════════════════════════════════════
  function updateCatCarousel(index) {
    if (totalCatCards === 0) return;
    // Keep index in bounds
    currentCatIndex = (index + totalCatCards) % totalCatCards;

    catCards.forEach((card, idx) => {
      // Clear classes
      card.classList.remove('pos-front', 'pos-left', 'pos-right', 'pos-back');
      
      const diff = (idx - currentCatIndex + totalCatCards) % totalCatCards;
      
      if (diff === 0) {
        card.classList.add('pos-front');
      } else if (diff === totalCatCards - 1) {
        card.classList.add('pos-left');
      } else if (diff === 1) {
        card.classList.add('pos-right');
      } else {
        card.classList.add('pos-back');
      }
    });

    // Update active pagination dot
    const dots = document.querySelectorAll('.cat-dot');
    dots.forEach((dot, idx) => {
      if (idx === currentCatIndex) {
        dot.classList.add('active');
        dot.setAttribute('aria-selected', 'true');
      } else {
        dot.classList.remove('active');
        dot.setAttribute('aria-selected', 'false');
      }
    });
  }

  function startCatAuto() {
    stopCatAuto();
    if (window.innerWidth <= 1024 || prefersReducedMotion) return;
    catInterval = setInterval(() => {
      updateCatCarousel(currentCatIndex + 1);
    }, 2800);
  }

  function stopCatAuto() {
    if (catInterval) clearInterval(catInterval);
  }

  function initCatCarousel() {
    if (totalCatCards === 0) return;

    // Generate pagination dots dynamically
    const dotsContainer = document.getElementById('cat-carousel-dots');
    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      for (let i = 0; i < totalCatCards; i++) {
        const dot = document.createElement('button');
        dot.className = `cat-dot${i === 0 ? ' active' : ''}`;
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        dot.addEventListener('click', () => {
          window.userInteractingWithCarousel = true;
          stopCatAuto();
          updateCatCarousel(i);
          startCatAuto();
          clearTimeout(window.catInteractionTimer);
          window.catInteractionTimer = setTimeout(() => {
            window.userInteractingWithCarousel = false;
          }, 2000);
        });
        dotsContainer.appendChild(dot);
      }
    }

    // Initial positioning
    updateCatCarousel(0);

    // Click to focus card
    catCards.forEach((card, idx) => {
      card.addEventListener('click', () => {
        window.userInteractingWithCarousel = true;
        stopCatAuto();
        updateCatCarousel(idx);
        startCatAuto();
        clearTimeout(window.catInteractionTimer);
        window.catInteractionTimer = setTimeout(() => {
          window.userInteractingWithCarousel = false;
        }, 2000);
      });

      card.addEventListener('focus', () => {
        window.userInteractingWithCarousel = true;
        stopCatAuto();
        updateCatCarousel(idx);
        clearTimeout(window.catInteractionTimer);
        window.catInteractionTimer = setTimeout(() => {
          window.userInteractingWithCarousel = false;
        }, 2000);
      });

      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          updateCatCarousel(idx);
        }
      });
    });

    // Hover + Wheel event: when scrolling while hovering over cards, it should scroll them fast
    const carouselContainer = document.getElementById('cat-carousel');
    let lastWheelTime = 0;
    let resumeAutoplayTimer;

    carouselContainer?.addEventListener('wheel', (e) => {
      // Only intercept wheel scroll if the Categories section is fully revealed
      const catTrack = document.getElementById('categories');
      if (catTrack) {
        const catRect = catTrack.getBoundingClientRect();
        const catTrackTop = catRect.top + window.scrollY;
        const catScrollRange = catTrack.offsetHeight - window.innerHeight;
        const catProgress = (window.scrollY - catTrackTop) / catScrollRange;
        
        // Skip interception if the section content is not fully active
        if (catProgress < 0.70 || catProgress >= 0.90) {
          return;
        }
      }

      // Prevent the page from scrolling while hovering and scrolling the cards
      e.preventDefault();
      
      window.userInteractingWithCarousel = true;
      clearTimeout(window.catInteractionTimer);
      window.catInteractionTimer = setTimeout(() => {
        window.userInteractingWithCarousel = false;
      }, 2000);

      // Autoplay is paused when active wheel scroll happens
      stopCatAuto();
      clearTimeout(resumeAutoplayTimer);

      const now = performance.now();
      if (now - lastWheelTime > 40) { // Super fast shifting (40ms throttle)
        if (e.deltaY > 0) {
          updateCatCarousel(currentCatIndex + 1);
        } else {
          updateCatCarousel(currentCatIndex - 1);
        }
        lastWheelTime = now;
      }

      // Resume autoplay after 1.5 seconds of scroll inactivity
      resumeAutoplayTimer = setTimeout(() => {
        startCatAuto();
      }, 1500);
    }, { passive: false });

    startCatAuto();
  }

  // ══════════════════════════════════════════════════════════════════════
  // 7. ATONIX Letters hover
  // ══════════════════════════════════════════════════════════════════════
  const letters     = document.querySelectorAll('.letter-card');
  const letterTitle = document.getElementById('letter-title');
  const letterDesc  = document.getElementById('letter-desc');

  if (letters.length && letterTitle && letterDesc) {
    const activateLetter = (letter) => {
      letters.forEach(l => l.classList.remove('active'));
      letter.classList.add('active');
      letterTitle.innerText = letter.getAttribute('data-term');
      letterDesc.innerText  = letter.getAttribute('data-desc');
    };

    letters.forEach(letter => {
      letter.addEventListener('mouseenter', () => activateLetter(letter));
      letter.addEventListener('focus',      () => activateLetter(letter));
      letter.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateLetter(letter); }
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // 8. Audience Tab toggle
  // ══════════════════════════════════════════════════════════════════════
  const toggleBtns       = document.querySelectorAll('.toggle-btn');
  const audienceContents = document.querySelectorAll('.audience-content');

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      const target = btn.getAttribute('data-target');
      audienceContents.forEach(content => {
        if (content.id === target) content.classList.add('active');
        else content.classList.remove('active');
      });
    });
  });

  // ── Scroll Centering Helper for Card Tap on Mobile ──
  const scrollCardIntoView = (card) => {
    const grid = card.closest('.why-join-cards-grid');
    if (!grid) return;

    const wrapper = card.closest('.wjc-card-wrapper');
    if (!wrapper) return;

    const gridRect = grid.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    const paddingLeft = parseFloat(window.getComputedStyle(grid).paddingLeft) || 20;
    const targetScrollLeft = grid.scrollLeft + (wrapperRect.left - gridRect.left) - paddingLeft;

    grid.scrollTo({
      left: targetScrollLeft,
      behavior: 'smooth'
    });
  };

  // Professionals cards hover/click/scroll to change showcase image
  const profCards = document.querySelectorAll('#audience-professionals .wjc-card');
  const profSlider = document.getElementById('prof-images-slider');
  let currentProfIndex = 0;
  let isProfSliderScrolling = false;

  const activateProfCard = (index, userInitiated = false, fromSliderScroll = false) => {
    if (index < 0 || index >= profCards.length) return;
    if (index === currentProfIndex && !userInitiated && !fromSliderScroll) return;

    currentProfIndex = index;

    // Update active class on card list items
    profCards.forEach((c, idx) => {
      if (idx === index) c.classList.add('active');
      else c.classList.remove('active');
    });

    // Scroll image slider to match active card index
    if (!fromSliderScroll && profSlider) {
      isProfSliderScrolling = true;
      profSlider.scrollTo({
        left: index * profSlider.clientWidth,
        behavior: 'smooth'
      });
      // Clear flag after transition completes
      setTimeout(() => { isProfSliderScrolling = false; }, 600);
    }

    // Update strip icon and title dynamically
    const stripIcon = document.getElementById('prof-strip-icon');
    const stripTitle = document.getElementById('prof-strip-title');
    const card = profCards[index];
    if (card && stripIcon && stripTitle) {
      const cardTitleEl = card.querySelector('.wjc-title');
      const cardIconEl = card.querySelector('.wjc-icon-wrap i');
      if (cardTitleEl) stripTitle.innerText = cardTitleEl.innerText;
      if (cardIconEl) {
        stripIcon.className = cardIconEl.className;
      }
    }

    // Scroll the active title card into view on mobile
    if ((userInitiated || fromSliderScroll) && window.innerWidth <= 992 && card) {
      scrollCardIntoView(card);
    }
  };

  if (profCards.length > 0 && profSlider) {
    profCards.forEach((card, index) => {
      card.addEventListener('mouseenter', () => activateProfCard(index, false));
      card.addEventListener('click', () => activateProfCard(index, true));
    });

    // Handle scroll events directly on the showcase image slider
    let profScrollTimeout;
    profSlider.addEventListener('scroll', () => {
      if (isProfSliderScrolling) return; // Ignore programmatic scrolls
      clearTimeout(profScrollTimeout);
      profScrollTimeout = setTimeout(() => {
        const index = Math.round(profSlider.scrollLeft / profSlider.clientWidth);
        if (index !== currentProfIndex) {
          activateProfCard(index, false, true);
        }
      }, 80);
    });

    // Handle vertical mouse wheel scroll to change images page-by-page
    let lastProfWheelTime = 0;
    profSlider.addEventListener('wheel', (e) => {
      const now = Date.now();
      if (now - lastProfWheelTime < 450) {
        e.preventDefault();
        return;
      }
      
      if (e.deltaY !== 0) {
        e.preventDefault();
        lastProfWheelTime = now;
        
        let newIndex = currentProfIndex;
        if (e.deltaY > 0) {
          newIndex = Math.min(profCards.length - 1, currentProfIndex + 1);
        } else {
          newIndex = Math.max(0, currentProfIndex - 1);
        }
        
        if (newIndex !== currentProfIndex) {
          activateProfCard(newIndex, true);
        }
      }
    }, { passive: false });
  }

  // Enthusiasts cards hover/click/scroll to change showcase image
  const enthCards = document.querySelectorAll('#audience-users .wjc-card');
  const enthSlider = document.getElementById('enth-images-slider');
  let currentEnthIndex = 0;
  let isEnthSliderScrolling = false;

  const activateEnthCard = (index, userInitiated = false, fromSliderScroll = false) => {
    if (index < 0 || index >= enthCards.length) return;
    if (index === currentEnthIndex && !userInitiated && !fromSliderScroll) return;

    currentEnthIndex = index;

    // Update active class on card list items
    enthCards.forEach((c, idx) => {
      if (idx === index) c.classList.add('active');
      else c.classList.remove('active');
    });

    // Scroll image slider to match active card index
    if (!fromSliderScroll && enthSlider) {
      isEnthSliderScrolling = true;
      enthSlider.scrollTo({
        left: index * enthSlider.clientWidth,
        behavior: 'smooth'
      });
      // Clear flag after transition completes
      setTimeout(() => { isEnthSliderScrolling = false; }, 600);
    }

    // Update strip icon and title dynamically
    const stripIcon = document.getElementById('enth-strip-icon');
    const stripTitle = document.getElementById('enth-strip-title');
    const card = enthCards[index];
    if (card && stripIcon && stripTitle) {
      const cardTitleEl = card.querySelector('.wjc-title');
      const cardIconEl = card.querySelector('.wjc-icon-wrap i');
      if (cardTitleEl) stripTitle.innerText = cardTitleEl.innerText;
      if (cardIconEl) {
        stripIcon.className = cardIconEl.className;
      }
    }

    // Scroll the active title card into view on mobile
    if ((userInitiated || fromSliderScroll) && window.innerWidth <= 992 && card) {
      scrollCardIntoView(card);
    }
  };

  if (enthCards.length > 0 && enthSlider) {
    enthCards.forEach((card, index) => {
      card.addEventListener('mouseenter', () => activateEnthCard(index, false));
      card.addEventListener('click', () => activateEnthCard(index, true));
    });

    // Handle scroll events directly on the showcase image slider
    let enthScrollTimeout;
    enthSlider.addEventListener('scroll', () => {
      if (isEnthSliderScrolling) return; // Ignore programmatic scrolls
      clearTimeout(enthScrollTimeout);
      enthScrollTimeout = setTimeout(() => {
        const index = Math.round(enthSlider.scrollLeft / enthSlider.clientWidth);
        if (index !== currentEnthIndex) {
          activateEnthCard(index, false, true);
        }
      }, 80);
    });

    // Handle vertical mouse wheel scroll to change images page-by-page
    let lastEnthWheelTime = 0;
    enthSlider.addEventListener('wheel', (e) => {
      const now = Date.now();
      if (now - lastEnthWheelTime < 450) {
        e.preventDefault();
        return;
      }
      
      if (e.deltaY !== 0) {
        e.preventDefault();
        lastEnthWheelTime = now;
        
        let newIndex = currentEnthIndex;
        if (e.deltaY > 0) {
          newIndex = Math.min(enthCards.length - 1, currentEnthIndex + 1);
        } else {
          newIndex = Math.max(0, currentEnthIndex - 1);
        }
        
        if (newIndex !== currentEnthIndex) {
          activateEnthCard(newIndex, true);
        }
      }
    }, { passive: false });
  }

  // Set first card active on load for both tabs
  if (profCards.length > 0) {
    activateProfCard(0, false);
  }
  if (enthCards.length > 0) {
    activateEnthCard(0, false);
  }

  // ── Scroll-Based Active Card Sync for Mobile Grids ──
  const whyJoinGrids = document.querySelectorAll('.why-join-cards-grid');
  whyJoinGrids.forEach(grid => {
    let scrollTimeout;
    grid.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (window.innerWidth > 992) return;
        
        const gridRect = grid.getBoundingClientRect();
        const gridCenter = gridRect.left + gridRect.width / 2;
        
        const cardWrappers = grid.querySelectorAll('.wjc-card-wrapper');
        let closestIndex = -1;
        let minDiff = Infinity;
        
        cardWrappers.forEach((wrapper, idx) => {
          const rect = wrapper.getBoundingClientRect();
          const center = rect.left + rect.width / 2;
          const diff = Math.abs(center - gridCenter);
          if (diff < minDiff) {
            minDiff = diff;
            closestIndex = idx;
          }
        });
        
        if (closestIndex !== -1) {
          const isProfessionals = grid.closest('#audience-professionals') !== null;
          if (isProfessionals) {
            if (closestIndex !== currentProfIndex) {
              activateProfCard(closestIndex, false);
            }
          } else {
            if (closestIndex !== currentEnthIndex) {
              activateEnthCard(closestIndex, false);
            }
          }
        }
      }, 80);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 9. Features Horizontal Slider
  // ══════════════════════════════════════════════════════════════════════
  const featCards = document.querySelectorAll('.feat-card');
  const totalFeatCards = featCards.length;
  const featureItems = document.querySelectorAll('.feature-item');
  const featSliderTrack = document.getElementById('feat-slider-track');
  let currentFeatIndex = 0;

  function updateFeatCarousel(index) {
    if (totalFeatCards === 0) return;
    currentFeatIndex = (index + totalFeatCards) % totalFeatCards;

    if (featSliderTrack) {
      featSliderTrack.style.transform = `translateX(-${currentFeatIndex * (100 / totalFeatCards)}%)`;
    }

    featCards.forEach((card, idx) => {
      if (idx === currentFeatIndex) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    // Sync left list items active state
    featureItems.forEach((item, idx) => {
      if (idx === currentFeatIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // Hover and click triggers on left items
  featureItems.forEach((item, idx) => {
    item.addEventListener('mouseenter', () => {
      updateFeatCarousel(idx);
    });
    item.addEventListener('click', () => {
      updateFeatCarousel(idx);
    });
  });

  // Click triggers on the cards themselves
  featCards.forEach((card, idx) => {
    card.addEventListener('click', () => {
      updateFeatCarousel(idx);
    });
  });

  // Wheel scroll event listener on Features Carousel
  const featCarouselContainer = document.getElementById('feat-carousel');
  let lastFeatWheelTime = 0;

  featCarouselContainer?.addEventListener('wheel', (e) => {
    // Only intercept wheel scroll if the Features section is fully revealed
    const featTrack = document.getElementById('features');
    if (featTrack) {
      const featRect = featTrack.getBoundingClientRect();
      const featTrackTop = featRect.top + window.scrollY;
      const featScrollRange = featTrack.offsetHeight - window.innerHeight;
      const featProgress = (window.scrollY - featTrackTop) / featScrollRange;

      // Skip interception if the section content is not fully active
      if (featProgress < 0.70 || featProgress >= 0.90) {
        return;
      }
    }

    e.preventDefault();
    const now = performance.now();
    if (now - lastFeatWheelTime > 40) {
      if (e.deltaY > 0) {
        updateFeatCarousel(currentFeatIndex + 1);
      } else {
        updateFeatCarousel(currentFeatIndex - 1);
      }
      lastFeatWheelTime = now;
    }
  }, { passive: false });

  // Initial call to set positions
  updateFeatCarousel(0);

  // ══════════════════════════════════════════════════════════════════════
  // 10. Live Counters (Count-up + Real-time Simulation)
  // ══════════════════════════════════════════════════════════════════════
  let mindsCount       = 0;
  let artistsCount     = 0;
  let enthusiastsCount = 0;
  let worldsCount      = 9;

  const mindsEl            = document.getElementById('live-total-users');
  const artistsEl          = document.getElementById('live-artists-joined');
  const artistSpotsEl      = document.getElementById('live-artist-spots-left');
  const artistProgressFill = document.getElementById('artist-progress-fill');
  const enthEl             = document.getElementById('live-enth-joined');
  const enthSpotsEl        = document.getElementById('live-enth-spots-left');
  const enthProgressFill   = document.getElementById('enth-progress-fill');
  const worldsEl           = document.getElementById('live-worlds-count');

  // Ticker list of recent joins (holds database values or fallbacks)
  let recentJoins = [
    { name: 'Rahul S.', city: 'Mumbai' },
    { name: 'Priya A.', city: 'Delhi' },
    { name: 'Karan V.', city: 'Bengaluru' }
  ];

  async function updateRecentJoinsFromDb() {
    const hasSupabase = CONFIG.SUPABASE_URL && CONFIG.SUPABASE_URL.trim() !== "" && 
                        CONFIG.SUPABASE_ANON_KEY && CONFIG.SUPABASE_ANON_KEY.trim() !== "";
    if (!hasSupabase) return;

    const cleanedUrl = CONFIG.SUPABASE_URL.endsWith('/') ? CONFIG.SUPABASE_URL.slice(0, -1) : CONFIG.SUPABASE_URL;
    let dataLoaded = false;

    // 1. Try secure RPC endpoint first (highly recommended for production/security)
    try {
      const endpoint = `${cleanedUrl}/rest/v1/rpc/get_recent_joins`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const dbUsers = await res.json();
        if (Array.isArray(dbUsers) && dbUsers.length > 0) {
          formatAndSetJoins(dbUsers);
          dataLoaded = true;
        }
      }
    } catch (rpcErr) {
      console.warn('RPC get_recent_joins not available. Trying direct select.', rpcErr);
    }

    // 2. Direct Select Fallback (requires SELECT policy on table)
    if (!dataLoaded) {
      async function tryFetch(orderCol) {
        const orderParam = orderCol ? `&order=${orderCol}.desc` : '';
        const endpoint = `${cleanedUrl}/rest/v1/${CONFIG.SUPABASE_TABLE}?select=name,city${orderParam}&limit=3`;
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
          }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }

      try {
        let dbUsers = null;
        try {
          dbUsers = await tryFetch('id');
        } catch (e) {
          try {
            dbUsers = await tryFetch('created_at');
          } catch (e2) {
            try {
              dbUsers = await tryFetch(null);
            } catch (e3) {
              // ignore
            }
          }
        }

        if (Array.isArray(dbUsers) && dbUsers.length > 0) {
          formatAndSetJoins(dbUsers);
        }
      } catch (err) {
        console.warn('Failed direct select from Supabase:', err);
      }
    }

    function formatAndSetJoins(dbUsers) {
      const formattedUsers = dbUsers.map(u => {
        let displayName = u.name || 'Anonymous';
        const parts = displayName.trim().split(/\s+/);
        if (parts.length > 1) {
          displayName = `${parts[0]} ${parts[parts.length - 1][0]}.`;
        }
        return {
          name: displayName,
          city: u.city || 'Somewhere'
        };
      });

      const fallbacks = [
        { name: 'Rahul S.', city: 'Mumbai' },
        { name: 'Priya A.', city: 'Delhi' },
        { name: 'Karan V.', city: 'Bengaluru' }
      ];
      while (formattedUsers.length < 3) {
        formattedUsers.push(fallbacks[formattedUsers.length]);
      }
      recentJoins = formattedUsers;
    }
  }

  // Helper to fetch live waitlist counts from Supabase
  async function fetchWaitlistStats(isInitial = false) {
    updateRecentJoinsFromDb();

    const hasSupabase = CONFIG.SUPABASE_URL && CONFIG.SUPABASE_URL.trim() !== "" && 
                        CONFIG.SUPABASE_ANON_KEY && CONFIG.SUPABASE_ANON_KEY.trim() !== "";
    
    let statsLoaded = false;
    const prevMinds = mindsCount;
    const prevArtists = artistsCount;
    const prevEnthusiasts = enthusiastsCount;

    if (hasSupabase) {
      try {
        const cleanedUrl = CONFIG.SUPABASE_URL.endsWith('/') ? CONFIG.SUPABASE_URL.slice(0, -1) : CONFIG.SUPABASE_URL;
        const endpoint = `${cleanedUrl}/rest/v1/rpc/get_waitlist_stats`;
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const stats = await response.json();
          const data = Array.isArray(stats) ? stats[0] : stats;
          mindsCount = data.total ?? 0;
          artistsCount = data.artists ?? 0;
          enthusiastsCount = data.enthusiasts ?? 0;
          statsLoaded = true;
        } else {
          console.warn(`Supabase RPC returned status ${response.status}. Using fallback stats.`);
        }
      } catch (err) {
        console.error('Failed to fetch waitlist stats from Supabase:', err);
      }
    }

    // Fallback if Supabase is not configured, or if the API fetch fails/returns error
    if (!statsLoaded && isInitial) {
      mindsCount = 2487;
      artistsCount = 327;
      enthusiastsCount = 412;
    }

    if (isInitial) {
      animateCounter(mindsEl,   0, mindsCount);
      animateCounter(artistsEl, 0, artistsCount);
      animateCounter(enthEl,    0, enthusiastsCount);
    } else if (statsLoaded) {
      // Only animate transitions during polling if we got valid fresh stats
      if (prevMinds !== mindsCount) animateCounter(mindsEl, prevMinds, mindsCount, '', 1000);
      if (prevArtists !== artistsCount) animateCounter(artistsEl, prevArtists, artistsCount, '', 1000);
      if (prevEnthusiasts !== enthusiastsCount) animateCounter(enthEl, prevEnthusiasts, enthusiastsCount, '', 1000);
    }
    updateProgressBars();
  }

  const totalCard       = document.getElementById('metric-card-total');
  const artistsCard     = document.getElementById('metric-card-artists');
  const enthusiastsCard = document.getElementById('metric-card-enthusiasts');

  function formatNum(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function calcProgressWidth(val) {
    if (val <= 0) return 0;
    if (val <= 500) return (val / 500) * 33.33;
    if (val <= 1000) return 33.33 + ((val - 500) / 500) * 33.33;
    if (val <= 10000) return 66.66 + ((val - 1000) / 9000) * 33.33;
    return 100;
  }

  function updateMilestones(val, prefix) {
    const ms500  = document.getElementById(`${prefix}-ms-500`);
    const ms1k   = document.getElementById(`${prefix}-ms-1k`);
    const ms10k  = document.getElementById(`${prefix}-ms-10k`);
    
    if (ms500) {
      if (val >= 500) ms500.classList.add('reached');
      else ms500.classList.remove('reached');
    }
    if (ms1k) {
      if (val >= 1000) ms1k.classList.add('reached');
      else ms1k.classList.remove('reached');
    }
    if (ms10k) {
      if (val >= 10000) ms10k.classList.add('reached');
      else ms10k.classList.remove('reached');
    }
  }

  function updateProgressBars() {
    if (artistProgressFill) {
      artistProgressFill.style.width = calcProgressWidth(artistsCount) + '%';
    }
    if (enthProgressFill) {
      enthProgressFill.style.width = calcProgressWidth(enthusiastsCount) + '%';
    }
    if (artistSpotsEl) {
      artistSpotsEl.innerText = `${Math.max(0, 500 - artistsCount)} spots left`;
    }
    if (enthSpotsEl) {
      enthSpotsEl.innerText = `${Math.max(0, 500 - enthusiastsCount)} spots left`;
    }
    updateMilestones(artistsCount, 'art');
    updateMilestones(enthusiastsCount, 'enth');
  }

  function animateCounter(el, from, to, suffix = '', duration = 1800) {
    if (!el || prefersReducedMotion) {
      if (el) el.innerText = formatNum(to) + suffix;
      return;
    }
    const startTime = performance.now();
    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease     = 1 - Math.pow(1 - progress, 4);
      el.innerText   = formatNum(Math.floor(from + ease * (to - from))) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function pulseCard(cardEl) {
    if (cardEl && !prefersReducedMotion) {
      cardEl.classList.remove('live-pulse');
      void cardEl.offsetWidth; // reflow
      cardEl.classList.add('live-pulse');
    }
  }

  // Initial count-up on load
  if (!prefersReducedMotion) {
    if (mindsEl)   mindsEl.innerText   = '0';
    if (artistsEl) artistsEl.innerText = '0';
    if (enthEl)    enthEl.innerText    = '0';
    if (worldsEl)  worldsEl.innerText  = '0';
  }

  setTimeout(async () => {
    // Fetch dynamic stats from Supabase
    await fetchWaitlistStats(true);
    
    // Always animate static worlds count
    animateCounter(worldsEl, 0, worldsCount);
  }, 550);

  // Set up live real-time updates (poll database every 10 seconds)
  setInterval(() => fetchWaitlistStats(false), 10000);

  // ── Recent Joins Ticker (Flash) ──

  const flashEl = document.getElementById('recent-joins-flash');
  if (flashEl) {
    let joinIdx = 0;
    
    function showNextJoin() {
      // 1. Fade out and slide right slightly
      flashEl.classList.remove('opacity-100', 'translate-x-0');
      flashEl.classList.add('opacity-0', 'translate-x-2');
      
      setTimeout(() => {
        // 2. Change text
        const person = recentJoins[joinIdx];
        flashEl.textContent = `${person.name} (${person.city}) joined`;
        
        // 3. Fade in and slide to original position
        flashEl.classList.remove('opacity-0', 'translate-x-2');
        flashEl.classList.add('opacity-100', 'translate-x-0');
        
        // 4. Update index for next time
        joinIdx = (joinIdx + 1) % recentJoins.length;
      }, 500); // match transition duration
    }
    
    // Start ticker
    setTimeout(showNextJoin, 1500); // first show
    setInterval(showNextJoin, 6000); // repeat every 6 seconds
  }

  // Simulated real-time signup every 8-15 seconds
  function scheduleNextSignup() {
    const delay = (8 + Math.random() * 7) * 1000;
    setTimeout(() => {
      const inc = Math.random() > 0.4 ? 1 : 2;
      const prevMinds = mindsCount;
      const prevArtists = artistsCount;
      const prevEnthusiasts = enthusiastsCount;
      
      let artistInc = 0;
      let enthInc = 0;
      
      for (let i = 0; i < inc; i++) {
        const rand = Math.random();
        if (rand < 0.45) {
          artistInc++;
        } else if (rand < 0.90) {
          enthInc++;
        }
      }
      
      mindsCount       += inc;
      artistsCount     += artistInc;
      enthusiastsCount += enthInc;
      
      animateCounter(mindsEl, prevMinds, mindsCount, '', 900);
      
      if (artistInc > 0) {
        animateCounter(artistsEl, prevArtists, artistsCount, '', 900);
        pulseCard(artistsCard);
      }
      if (enthInc > 0) {
        animateCounter(enthEl, prevEnthusiasts, enthusiastsCount, '', 900);
        pulseCard(enthusiastsCard);
      }
      if (artistInc === 0 && enthInc === 0) {
        pulseCard(totalCard);
      }
      
      updateProgressBars();
      // scheduleNextSignup();
    }, delay);
  }
  // scheduleNextSignup(); // Disabled to show only real registration numbers

  // ══════════════════════════════════════════════════════════════════════
  // 11. Form Submission & Unification
  // ══════════════════════════════════════════════════════════════════════
  const identityBtns        = document.querySelectorAll('.identity-btn');
  const hiddenIdentityInput = document.getElementById('identity-value');
  const rolePills           = document.querySelectorAll('.role-pill');
  const hiddenRoleInput     = document.getElementById('role-value');
  const regForm             = document.getElementById('registration-form');
  const submitBtn           = document.getElementById('submit-btn');
  const toast               = document.getElementById('toast');
  const toastMessage        = document.getElementById('toast-message');

  // Modal elements references for sync
  const modalForm         = document.getElementById('modal-registration-form');
  const modalSubmitBtn    = document.getElementById('modal-submit-btn');
  const modalIdentityBtns = document.querySelectorAll('.modal-identity-btn');
  const modalIdentityVal  = document.getElementById('modal-identity-value');
  const modalRolePills    = document.querySelectorAll('.modal-role-pill');
  const modalRoleVal      = document.getElementById('modal-role-value');

  // Bidirectional Text/Select Field Sync (supports input and change events)
  function setupInputSync(id1, id2) {
    const el1 = document.getElementById(id1);
    const el2 = document.getElementById(id2);
    if (!el1 || !el2) return;
    const syncValues = () => { el2.value = el1.value; };
    const syncValuesReverse = () => { el1.value = el2.value; };
    
    el1.addEventListener('input', syncValues);
    el1.addEventListener('change', syncValues);
    el2.addEventListener('input', syncValuesReverse);
    el2.addEventListener('change', syncValuesReverse);
  }
  setupInputSync('name', 'modal-name');
  setupInputSync('phone', 'modal-phone');
  setupInputSync('email', 'modal-email');
  setupInputSync('city', 'modal-city');
  setupInputSync('country-code', 'modal-country-code');
  setupInputSync('otp-code', 'modal-otp-code');

  // Select Your Identity Buttons Sync
  function syncIdentity(value) {
    // Inline Form buttons style sync
    identityBtns.forEach(btn => {
      if (btn.getAttribute('data-value') === value) {
        btn.classList.add('active');
        btn.classList.remove('border-white/8', 'bg-[#110924]/50', 'text-brandMuted');
        btn.classList.add('border-brandPurple', 'bg-brandPurple/12', 'text-white');
      } else {
        btn.classList.remove('active');
        btn.classList.add('border-white/8', 'bg-[#110924]/50', 'text-brandMuted');
        btn.classList.remove('border-brandPurple', 'bg-brandPurple/12', 'text-white');
      }
    });
    if (hiddenIdentityInput) hiddenIdentityInput.value = value;

    // Modal Form buttons style sync
    modalIdentityBtns.forEach(btn => {
      if (btn.getAttribute('data-value') === value) {
        btn.classList.add('active');
        btn.classList.remove('border-white/8', 'bg-[#110924]/50', 'text-brandMuted');
        btn.classList.add('border-brandPurple', 'bg-brandPurple/12', 'text-white');
      } else {
        btn.classList.remove('active');
        btn.classList.add('border-white/8', 'bg-[#110924]/50', 'text-brandMuted');
        btn.classList.remove('border-brandPurple', 'bg-brandPurple/12', 'text-white');
      }
    });
    if (modalIdentityVal) modalIdentityVal.value = value;
  }

  identityBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      syncIdentity(btn.getAttribute('data-value'));
    });
  });

  modalIdentityBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      syncIdentity(btn.getAttribute('data-value'));
    });
  });

  // Your Creative Role Pills Sync
  function syncRole(value) {
    // Inline Form pills style sync
    rolePills.forEach(p => {
      if (p.innerText.trim() === value) {
        p.classList.add('active');
        p.classList.remove('border-white/8', 'bg-[#110924]/50', 'text-brandMuted');
        p.classList.add('border-brandPurple', 'bg-brandPurple/12', 'text-white');
      } else {
        p.classList.remove('active');
        p.classList.add('border-white/8', 'bg-[#110924]/50', 'text-brandMuted');
        p.classList.remove('border-brandPurple', 'bg-brandPurple/12', 'text-white');
      }
    });
    if (hiddenRoleInput) hiddenRoleInput.value = value;

    // Modal Form pills style sync
    modalRolePills.forEach(p => {
      if (p.innerText.trim() === value) {
        p.classList.add('active');
        p.classList.remove('border-white/8', 'bg-[#110924]/50', 'text-brandMuted');
        p.classList.add('border-brandPurple', 'bg-brandPurple/12', 'text-white');
      } else {
        p.classList.remove('active');
        p.classList.add('border-white/8', 'bg-[#110924]/50', 'text-brandMuted');
        p.classList.remove('border-brandPurple', 'bg-brandPurple/12', 'text-white');
      }
    });
    if (modalRoleVal) modalRoleVal.value = value;
  }

  rolePills.forEach(pill => {
    pill.addEventListener('click', () => {
      syncRole(pill.innerText.trim());
    });
  });

  modalRolePills.forEach(pill => {
    pill.addEventListener('click', () => {
      syncRole(pill.innerText.trim());
    });
  });

  function showToast(msg) {
    if (!toast || !toastMessage) return;
    toastMessage.innerHTML = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 5000);
  }

  function resetForm() {
    if (regForm) regForm.reset();
    if (modalForm) modalForm.reset();
    syncIdentity('Creative Professional');
    syncRole('Creator');
  }

  // Validate Form Data
  function validateFormData(data, isModal) {
    const prefix = isModal ? 'modal-' : '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!data.name || data.name.trim() === "") {
      alert("Please enter your name.");
      document.getElementById(`${prefix}name`)?.focus();
      return false;
    }

    // Strict Phone validation
    const countryCode = document.getElementById(`${prefix}country-code`)?.value || '+91';
    const rawPhone = data.phone_raw ? data.phone_raw.trim().replace(/[-\s()]/g, '') : '';
    
    if (countryCode === '+91') {
      const indRegex = /^[6-9]\d{9}$/;
      if (!indRegex.test(rawPhone)) {
        alert("Please enter a valid 10-digit Indian mobile number (should start with 6, 7, 8, or 9).");
        document.getElementById(`${prefix}phone`)?.focus();
        return false;
      }
    } else {
      const genRegex = /^\d{7,15}$/;
      if (!genRegex.test(rawPhone)) {
        alert("Please enter a valid mobile number (7 to 15 digits).");
        document.getElementById(`${prefix}phone`)?.focus();
        return false;
      }
    }

    if (!data.email || !emailRegex.test(data.email)) {
      alert("Please enter a valid email address.");
      document.getElementById(`${prefix}email`)?.focus();
      return false;
    }
    if (!data.city || data.city.trim() === "") {
      alert("Please enter your city.");
      document.getElementById(`${prefix}city`)?.focus();
      return false;
    }
    return true;
  }

  // Temporary container for waitlist registration details before email OTP verification
  let tempFormData = null;

  // Toggle standard form fields / OTP screen state dynamically for both twin forms
  function setOtpState(showOtp, targetEmail = '') {
    const fieldsInline = document.getElementById('form-fields-wrapper');
    const otpInline = document.getElementById('otp-fields-wrapper');
    const fieldsModal = document.getElementById('modal-form-fields-wrapper');
    const otpModal = document.getElementById('modal-otp-fields-wrapper');
    const targetEmailInline = document.getElementById('otp-target-email');
    const targetEmailModal = document.getElementById('modal-otp-target-email');

    if (showOtp) {
      fieldsInline?.classList.add('hidden');
      otpInline?.classList.remove('hidden');
      fieldsModal?.classList.add('hidden');
      otpModal?.classList.remove('hidden');
      if (targetEmailInline) targetEmailInline.textContent = targetEmail;
      if (targetEmailModal) targetEmailModal.textContent = targetEmail;
    } else {
      fieldsInline?.classList.remove('hidden');
      otpInline?.classList.add('hidden');
      fieldsModal?.classList.remove('hidden');
      otpModal?.classList.add('hidden');
      // Clear values
      const otpInputInline = document.getElementById('otp-code');
      const otpInputModal = document.getElementById('modal-otp-code');
      if (otpInputInline) otpInputInline.value = '';
      if (otpInputModal) otpInputModal.value = '';
    }
  }

  // Request Supabase passwordless OTP
  async function requestOTP(email) {
    try {
      const cleanedUrl = CONFIG.SUPABASE_URL.endsWith('/') ? CONFIG.SUPABASE_URL.slice(0, -1) : CONFIG.SUPABASE_URL;
      const endpoint = `${cleanedUrl}/auth/v1/otp`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          create_user: true
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.msg || errJson.error_description || `Status ${response.status}`);
      }
      return { success: true };
    } catch (err) {
      console.error('Failed to request OTP:', err);
      return { success: false, error: err.message };
    }
  }

  // Call Supabase verification API helper
  async function callVerifyApi(email, token, type) {
    try {
      const cleanedUrl = CONFIG.SUPABASE_URL.endsWith('/') ? CONFIG.SUPABASE_URL.slice(0, -1) : CONFIG.SUPABASE_URL;
      const endpoint = `${cleanedUrl}/auth/v1/verify`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: type,
          email: email,
          token: token
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        return { 
          success: false, 
          error_code: errJson.error_code || '', 
          error: errJson.msg || errJson.error_description || `Status ${response.status}` 
        };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Verify token, trying both signup (new user) and magiclink (existing user) types
  async function verifyOTP(email, token) {
    let result = await callVerifyApi(email, token, 'signup');
    if (!result.success) {
      const magicResult = await callVerifyApi(email, token, 'magiclink');
      if (magicResult.success) {
        result = magicResult;
      }
    }
    return result;
  }

  // Unified Submission Engine (Requests OTP code first)
  async function handleFormSubmit(e, isModal) {
    e.preventDefault();
    
    const prefix = isModal ? 'modal-' : '';
    const name     = document.getElementById(`${prefix}name`)?.value?.trim() || '';
    const phone    = document.getElementById(`${prefix}phone`)?.value?.trim() || '';
    const email    = document.getElementById(`${prefix}email`)?.value?.trim() || '';
    const city     = document.getElementById(`${prefix}city`)?.value?.trim() || '';
    const identity = (isModal ? modalIdentityVal : hiddenIdentityInput)?.value || 'Creative Professional';
    const role     = (isModal ? modalRoleVal : hiddenRoleInput)?.value || 'Creator';

    // Combine phone code + number for database storage
    const countryCode = document.getElementById(`${prefix}country-code`)?.value || '+91';
    const rawPhone = phone.trim().replace(/[-\s()]/g, '');
    const fullPhone = rawPhone ? `${countryCode}${rawPhone}` : '';

    const formData = { 
      name, 
      phone: fullPhone, 
      phone_raw: rawPhone,
      email, 
      city, 
      identity, 
      role 
    };

    if (!validateFormData(formData, isModal)) {
      return;
    }

    const currentSubmitBtn = isModal ? modalSubmitBtn : submitBtn;
    if (!currentSubmitBtn) return;

    // Disable button during processing
    currentSubmitBtn.disabled = true;
    const originalContent = currentSubmitBtn.querySelector('span').innerHTML;
    currentSubmitBtn.querySelector('span').innerHTML = '<i class="ph ph-circle-notch ph-spin" style="animation:spin 1s linear infinite" aria-hidden="true"></i> Sending Code...';

    const result = await requestOTP(email);

    if (result.success) {
      tempFormData = formData;
      setOtpState(true, email);
    } else {
      alert(`Failed to send verification code: ${result.error}`);
    }

    currentSubmitBtn.disabled = false;
    currentSubmitBtn.querySelector('span').innerHTML = originalContent;
  }

  if (regForm) {
    regForm.addEventListener('submit', e => handleFormSubmit(e, false));
  }
  if (modalForm) {
    modalForm.addEventListener('submit', e => handleFormSubmit(e, true));
  }

  // Hook up verification UI button handlers
  const verifyOtpBtn = document.getElementById('verify-otp-btn');
  const modalVerifyOtpBtn = document.getElementById('modal-verify-otp-btn');
  const cancelOtpBtn = document.getElementById('cancel-otp-btn');
  const modalCancelOtpBtn = document.getElementById('modal-cancel-otp-btn');
  const resendOtpBtn = document.getElementById('resend-otp-btn');
  const modalResendOtpBtn = document.getElementById('modal-resend-otp-btn');

  // Verify OTP button click handler
  async function handleVerifyOtpClick(isModal) {
    if (!tempFormData) {
      alert("No registration data found. Please start over.");
      setOtpState(false);
      return;
    }

    const prefix = isModal ? 'modal-' : '';
    const otpInput = document.getElementById(`${prefix}otp-code`);
    const otpCode = otpInput?.value?.trim() || '';

    if (!/^\d{6}$|^\d{8}$/.test(otpCode)) {
      alert("Please enter a valid 6 or 8-digit verification code.");
      otpInput?.focus();
      return;
    }

    const currentVerifyBtn = isModal ? modalVerifyOtpBtn : verifyOtpBtn;
    if (!currentVerifyBtn) return;

    currentVerifyBtn.disabled = true;
    const originalText = currentVerifyBtn.querySelector('span').innerHTML;
    currentVerifyBtn.querySelector('span').innerHTML = '<i class="ph ph-circle-notch ph-spin" style="animation:spin 1s linear infinite" aria-hidden="true"></i> Verifying...';

    const result = await verifyOTP(tempFormData.email, otpCode);

    if (result.success) {
      // Save waitlist entry to database
      const dbResult = await submitWaitlistData(tempFormData);
      
      // Update counters
      const prevMinds = mindsCount;
      const prevArtists = artistsCount;
      const prevEnthusiasts = enthusiastsCount;
      
      mindsCount += 1;
      const isArtist = (tempFormData.identity === 'Creative Professional');
      if (isArtist) {
        artistsCount += 1;
      } else {
        enthusiastsCount += 1;
      }

      // Close modal if open
      if (isModal || document.getElementById('register-modal')?.classList.contains('open')) {
        closeModal();
      }
      
      const registeredName = tempFormData.name;

      // Animate counters and progress
      setTimeout(() => {
        animateCounter(mindsEl, prevMinds, mindsCount, '', 1200);
        if (isArtist) {
          animateCounter(artistsEl, prevArtists, artistsCount, '', 1200);
          pulseCard(artistsCard);
        } else {
          animateCounter(enthEl, prevEnthusiasts, enthusiastsCount, '', 1200);
          pulseCard(enthusiastsCard);
        }
        pulseCard(totalCard);
        updateProgressBars();
        
        // Open success modal and populate name
        const successNameEl = document.getElementById('success-user-name');
        if (successNameEl) {
          successNameEl.textContent = registeredName;
        }
        const successModal = document.getElementById('success-modal');
        if (successModal) {
          successModal.classList.add('open');
          document.body.style.overflow = 'hidden';
          heroScrollHint?.classList.add('hidden-hint');
        }
      }, 900);

      resetForm();
      tempFormData = null;
      setOtpState(false);
    } else {
      alert(`Verification failed: ${result.error || 'Invalid OTP code.'}`);
    }

    currentVerifyBtn.disabled = false;
    currentVerifyBtn.querySelector('span').innerHTML = originalText;
  }

  verifyOtpBtn?.addEventListener('click', () => handleVerifyOtpClick(false));
  modalVerifyOtpBtn?.addEventListener('click', () => handleVerifyOtpClick(true));

  // Cancel OTP buttons click handler
  const handleCancelOtp = () => {
    tempFormData = null;
    setOtpState(false);
  };
  cancelOtpBtn?.addEventListener('click', handleCancelOtp);
  modalCancelOtpBtn?.addEventListener('click', handleCancelOtp);

  // Resend OTP buttons click handler
  async function handleResendOtpClick(isModal) {
    if (!tempFormData) {
      alert("No registration data found. Please start over.");
      setOtpState(false);
      return;
    }

    const currentResendBtn = isModal ? modalResendOtpBtn : resendOtpBtn;
    if (currentResendBtn) {
      currentResendBtn.disabled = true;
      currentResendBtn.innerText = 'Sending...';
    }

    const result = await requestOTP(tempFormData.email);
    if (result.success) {
      alert(`A new verification code has been sent to ${tempFormData.email}`);
    } else {
      alert(`Failed to resend code: ${result.error}`);
    }

    if (currentResendBtn) {
      currentResendBtn.disabled = false;
      currentResendBtn.innerText = 'Resend Code';
    }
  }
  resendOtpBtn?.addEventListener('click', () => handleResendOtpClick(false));
  modalResendOtpBtn?.addEventListener('click', () => handleResendOtpClick(true));

  // ══════════════════════════════════════════════════════════════════════
  // 12. Init — boot everything
  // ══════════════════════════════════════════════════════════════════════
  document.body.classList.add('js-active');

  measureHeadlinePositions();
  resizeCanvas();
  requestAnimationFrame(renderLoop);
  // Preload first 45 frames with progress tracking (load only 1 frame on mobile to save bandwidth)
  const framesToLoadFirst = isMobileDevice ? 1 : 45;
  let loadedCount = 0;
  const loaderText = document.getElementById('loader-text');
  const loaderEl = document.getElementById('page-loader');
  const loaderRing = document.getElementById('loader-ring-progress');
  const loaderStatus = document.getElementById('loader-status');

  // HUD Coordinates
  const coordX = document.getElementById('loader-coord-x');
  const coordY = document.getElementById('loader-coord-y');
  const coordZ = document.getElementById('loader-coord-z');
  const coordW = document.getElementById('loader-coord-w');

  function checkPreloadProgress() {
    loadedCount++;
    const pct = Math.min(100, Math.round((loadedCount / framesToLoadFirst) * 100));
    
    // Update SVG progress ring (circumference = 283)
    if (loaderRing) {
      const offset = 283 - (pct / 100) * 283;
      loaderRing.style.strokeDashoffset = offset;
    }
    
    if (loaderText) loaderText.textContent = `${pct}%`;

    // Dynamic, fast coordinates update for futuristic sci-fi effect
    if (coordX) coordX.textContent = `COORD X : ${120 + Math.floor(Math.random() * 10)}`;
    if (coordY) coordY.textContent = `COORD Y : ${840 + Math.floor(Math.random() * 15)}`;
    if (coordZ) coordZ.textContent = `COORD Z : ${(0.001 + Math.random() * 0.004).toFixed(3)}`;
    if (coordW) coordW.textContent = `COORD W : ${(765.0 + Math.random() * 8.0).toFixed(1)}`;
    
    if (loaderStatus) {
      if (pct < 25)       loaderStatus.textContent = 'INITIALIZING SYNAPSE ENGINE...';
      else if (pct < 50)  loaderStatus.textContent = 'RESOLVING TERRAIN DYNAMICS...';
      else if (pct < 75)  loaderStatus.textContent = 'GENERATING TERRAIN...';
      else if (pct < 95)  loaderStatus.textContent = 'COMPILING CANVAS FRAMES...';
      else                loaderStatus.textContent = 'TERRAIN GENERATED';
    }
    
    if (loadedCount >= framesToLoadFirst) {
      setTimeout(() => {
        if (loaderEl) {
          loaderEl.style.opacity = '0';
          loaderEl.style.pointerEvents = 'none';
          setTimeout(() => {
            loaderEl.remove();
            // Start preloading backbone frames in the background!
            startBackbonePreload();
          }, 600);
        }
      }, 300);
    }
  }

  // Preload initial frames with high priority to speed up first paint
  for (let i = 0; i < framesToLoadFirst; i++) {
    preloadFrame(i, checkPreloadProgress, 'high');
  }

  // Background backbone frame loader (loads every 20th frame in requestIdleCallback)
  function startBackbonePreload() {
    if (isMobileDevice) return;
    const backboneStep = 20;
    const backboneFrames = [];
    for (let i = 0; i < totalFrames; i += backboneStep) {
      if (i >= framesToLoadFirst) {
        backboneFrames.push(i);
      }
    }
    
    let currentIdx = 0;
    function loadNext() {
      if (currentIdx >= backboneFrames.length) return;
      const frameIdx = backboneFrames[currentIdx];
      preloadFrame(frameIdx, () => {
        currentIdx++;
        if (window.requestIdleCallback) {
          window.requestIdleCallback(() => loadNext());
        } else {
          setTimeout(loadNext, 40);
        }
      }, 'low');
    }
    // Delay slightly to let the page initialize smoothly before background network requests
    setTimeout(loadNext, 1000);
  }

  // Initial calls
  handleScroll();
  updateHeaderState();
  updateNavActive();
  initCatCarousel();

  // Re-measure after custom web fonts are fully loaded to prevent cropping/misalignments
  document.fonts.ready.then(() => {
    measureHeadlinePositions();
    updateScrollProgress();
  });

  window.addEventListener('load', () => {
    measureHeadlinePositions();
    updateScrollProgress();
  });

  // Resize handler (debounced)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeCanvas();
      measureHeadlinePositions();
      updateScrollProgress();
    }, 150);
  });

  // Passive scroll listener for max performance
  window.addEventListener('scroll', handleScroll, { passive: true });

  // ══════════════════════════════════════════════════════════════════════
  // 13. PRE-REGISTRATION MODAL
  // ══════════════════════════════════════════════════════════════════════
  const modalOverlay     = document.getElementById('register-modal');
  const modalPanel       = document.getElementById('register-modal-panel');
  const openModalBtn     = document.getElementById('open-modal-btn');
  const modalCloseBtn    = document.getElementById('modal-close-btn');

  let modalPrevFocus = null;

  function openModal() {
    modalPrevFocus = document.activeElement;
    modalOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
    heroScrollHint?.classList.add('hidden-hint');
    // Move focus into modal after transition
    setTimeout(() => {
      const firstInput = modalPanel?.querySelector('input, select, button');
      firstInput?.focus();
    }, 400);
  }

  function closeModal() {
    modalOverlay?.classList.remove('open');
    document.body.style.overflow = '';
    modalPrevFocus?.focus();
    handleScrollActivity();
  }

  openModalBtn?.addEventListener('click', openModal);
  modalCloseBtn?.addEventListener('click', closeModal);



  // Close on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay?.classList.contains('open')) {
      closeModal();
    }
  });

  // Success Modal closing handlers
  const successModal = document.getElementById('success-modal');
  const successModalCloseBtn = document.getElementById('success-modal-close-btn');
  const successModalCta = document.getElementById('success-modal-cta');

  function closeSuccessModal() {
    successModal?.classList.remove('open');
    document.body.style.overflow = '';
    handleScrollActivity();
  }

  successModalCloseBtn?.addEventListener('click', closeSuccessModal);
  successModalCta?.addEventListener('click', closeSuccessModal);

  // Close success modal on overlay click (outside panel)
  successModal?.addEventListener('click', (e) => {
    if (e.target === successModal) closeSuccessModal();
  });

  // Close success modal on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && successModal?.classList.contains('open')) {
      closeSuccessModal();
    }
  });

  // Also wire up the section "PRE-REGISTER" / "I BELIEVE" buttons to open modal
  document.querySelectorAll('a[href="#register"]').forEach(link => {
    // Skip interception if it's the desktop or mobile navigation/Early Access links
    if (
      link.id === 'nav-register' || 
      link.classList.contains('mobile-nav-link') || 
      link.textContent.toLowerCase().includes('early access')
    ) {
      return;
    }
    link.addEventListener('click', (e) => {
      // Only intercept if modal exists
      if (modalOverlay) {
        e.preventDefault();
        openModal();
      }
    });
  });

  // Add CSS spin keyframe dynamically for loading spinner
  const spinStyle = document.createElement('style');
  spinStyle.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(spinStyle);

  // ══════════════════════════════════════════════════════════════════════
  // 14. City Autocomplete Engine (Indian Cities)
  // ══════════════════════════════════════════════════════════════════════
  const indianCities = [
    "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Ahmedabad", "Chennai", "Kolkata", 
    "Surat", "Pune", "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane", 
    "Bhopal", "Visakhapatnam", "Pimpri-Chinchwad", "Patna", "Vadodara", "Ghaziabad", 
    "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot", "Kalyan-Dombivli", 
    "Vasai-Virar", "Varanasi", "Srinagar", "Aurangabad", "Dhanbad", "Amritsar", 
    "Navi Mumbai", "Allahabad", "Ranchi", "Howrah", "Coimbatore", "Jabalpur", 
    "Gwalior", "Vijayawada", "Jodhpur", "Madurai", "Raipur", "Kota", "Guwahati", 
    "Chandigarh", "Noida", "Gurugram", "Bhubaneswar", "Dehradun", "Kochi", 
    "Trivandrum", "Mysore"
  ];

  function setupCityAutocomplete(inputId, listId) {
    const input = document.getElementById(inputId);
    const list  = document.getElementById(listId);
    if (!input || !list) return;

    let activeIndex = -1;

    function renderSuggestions(matches) {
      list.innerHTML = '';
      if (matches.length === 0) {
        list.classList.remove('open');
        input.setAttribute('aria-expanded', 'false');
        return;
      }

      matches.forEach((city, index) => {
        const li = document.createElement('li');
        li.textContent = city;
        li.setAttribute('role', 'option');
        li.setAttribute('id', `${inputId}-opt-${index}`);
        li.addEventListener('click', () => {
          selectCity(city);
        });
        list.appendChild(li);
      });

      list.classList.add('open');
      input.setAttribute('aria-expanded', 'true');
    }

    function selectCity(city) {
      input.value = city;
      input.dispatchEvent(new Event('input'));
      list.classList.remove('open');
      input.setAttribute('aria-expanded', 'false');
      activeIndex = -1;
    }

    input.addEventListener('input', () => {
      const val = input.value.trim().toLowerCase();
      if (!val) {
        list.classList.remove('open');
        input.setAttribute('aria-expanded', 'false');
        return;
      }

      // Filter cities that start with or contain the typed value
      const matches = indianCities.filter(city => 
        city.toLowerCase().startsWith(val)
      ).concat(
        indianCities.filter(city => 
          !city.toLowerCase().startsWith(val) && city.toLowerCase().includes(val)
        )
      ).slice(0, 5); // Limit to 5 suggestions

      renderSuggestions(matches);
      activeIndex = -1;
    });

    input.addEventListener('keydown', (e) => {
      const items = list.querySelectorAll('li');
      if (!list.classList.contains('open') || items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        updateActiveItem(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        updateActiveItem(items);
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < items.length) {
          e.preventDefault();
          selectCity(items[activeIndex].textContent);
        }
      } else if (e.key === 'Escape') {
        list.classList.remove('open');
        input.setAttribute('aria-expanded', 'false');
        activeIndex = -1;
      }
    });

    function updateActiveItem(items) {
      items.forEach((item, index) => {
        if (index === activeIndex) {
          item.setAttribute('aria-selected', 'true');
          input.setAttribute('aria-activedescendant', item.id);
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.removeAttribute('aria-selected');
        }
      });
    }

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (e.target !== input && e.target !== list) {
        list.classList.remove('open');
        input.setAttribute('aria-expanded', 'false');
        activeIndex = -1;
      }
    });
  }

  setupCityAutocomplete('city', 'city-suggestions');
  setupCityAutocomplete('modal-city', 'modal-city-suggestions');

  // ══════════════════════════════════════════════════════════════════════
  // Enjoy Animation Mode Toggle
  // ══════════════════════════════════════════════════════════════════════
  const toggleAnimBtn = document.getElementById('toggle-animation-btn');
  toggleAnimBtn?.addEventListener('click', () => {
    document.body.classList.toggle('enjoy-animation-active');
    const isActive = document.body.classList.contains('enjoy-animation-active');
    
    if (isActive) {
      toggleAnimBtn.querySelector('i').className = 'ph ph-eye';
      toggleAnimBtn.classList.add('active');
    } else {
      toggleAnimBtn.querySelector('i').className = 'ph ph-eye-closed';
      toggleAnimBtn.classList.remove('active');
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // Back to Top Click Handler
  // ══════════════════════════════════════════════════════════════════════
  const backToTopBtn = document.getElementById('back-to-top-btn');
  backToTopBtn?.addEventListener('click', () => {
    window.scrollTo(0, 0);
    sessionStorage.setItem('scroll_to_top', 'true');
    window.location.reload();
  });

  // ══════════════════════════════════════════════════════════════════════
  // Navigation links click intercept (Smooth scroll directly to Stage 4 fully visible state)
  // ══════════════════════════════════════════════════════════════════════
  const allNavLinks = document.querySelectorAll('.nav-links a, .mobile-nav-link');
  allNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        const targetSection = document.getElementById(href.substring(1));
        if (targetSection) {
          e.preventDefault();
          
          closeMobileNav();

          const isMobile = window.innerWidth <= 1024 || prefersReducedMotion;
          const trackTop = targetSection.offsetTop;
          
          let targetScroll = trackTop;
          if (!isMobile && targetSection.classList.contains('scroll-track')) {
            const scrollRange = targetSection.offsetHeight - window.innerHeight;
            targetScroll = trackTop + 0.80 * scrollRange; // Center of Stage 4 (0.70 to 0.90)
          }

          window.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
          });
        }
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Logo Click Reload Handler
  // ══════════════════════════════════════════════════════════════════════
  const logoWrappers = document.querySelectorAll('.logo-wrapper');
  logoWrappers.forEach(logo => {
    logo.addEventListener('click', (e) => {
      e.preventDefault();
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
      }
      sessionStorage.setItem('scroll_to_top', 'true');
      window.scrollTo(0, 0);
      window.location.reload();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Holographic Card Engine — Who Can Join Section (wjc-card)
  // Vanilla equivalent of HolographicCard React component
  // ══════════════════════════════════════════════════════════════════════
  (function initHolographicCards() {
    const PERSPECTIVE   = 900;     // px
    const MAX_ROTATE    = 14;      // max tilt degrees
    const SCALE_HOVER   = 1.15;    // scale on hover
    const TRANSITION_OUT = 'perspective(' + PERSPECTIVE + 'px) rotateX(0deg) rotateY(0deg) scale(1)';

    // Inject overlay divs into every wjc-card once
    document.querySelectorAll('.wjc-card').forEach(card => {
      // Prevent double-injection on hot reload
      if (card.querySelector('.holo-glow')) return;

      const glow = document.createElement('div');
      glow.className = 'holo-glow';
      glow.setAttribute('aria-hidden', 'true');
      card.appendChild(glow);

      const shimmer = document.createElement('div');
      shimmer.className = 'holo-shimmer';
      shimmer.setAttribute('aria-hidden', 'true');
      card.appendChild(shimmer);
    });

    // Shared RAF-throttled handler
    let raf = null;

    function applyHoloEffect(card, e) {
      const rect     = card.getBoundingClientRect();
      const x        = e.clientX - rect.left;
      const y        = e.clientY - rect.top;
      const centerX  = rect.width  / 2;
      const centerY  = rect.height / 2;

      // Tilt: mouse above center → positive rotateX (tilt top toward viewer)
      const rotX = ((y - centerY) / centerY) * MAX_ROTATE;
      // Tilt: mouse right of center → negative rotateY (tilt right toward viewer)
      const rotY = -((x - centerX) / centerX) * MAX_ROTATE;

      // Percentage position for gradient origins
      const pctX = ((x / rect.width)  * 100).toFixed(1) + '%';
      const pctY = ((y / rect.height) * 100).toFixed(1) + '%';

      card.style.setProperty('--bg-x', pctX);
      card.style.setProperty('--bg-y', pctY);
      const currentScale = window.innerWidth <= 992 ? 1.0 : SCALE_HOVER;
      card.style.transform = [
        'perspective(' + PERSPECTIVE + 'px)',
        'rotateX(' + rotX.toFixed(2) + 'deg)',
        'rotateY(' + rotY.toFixed(2) + 'deg)',
        'scale(' + currentScale + ')'
      ].join(' ');
    }

    document.querySelectorAll('.wjc-card').forEach(card => {
      // Skip holographic 3D effects entirely on mobile/tablet
      if (window.innerWidth <= 992) return;

      card.addEventListener('mouseenter', () => {
        card.classList.add('holo-active');
        // Reset CSS transition so transform is instant when JS takes over
        card.style.transition = 'box-shadow 0.55s cubic-bezier(0.23,1,0.32,1), background 0.4s ease, border-color 0.4s ease';
      });

      card.addEventListener('mousemove', (e) => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => applyHoloEffect(card, e));
      });

      card.addEventListener('mouseleave', () => {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        card.classList.remove('holo-active');

        // Smooth spring-back via transition
        card.style.transition = [
          'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
          'box-shadow 0.55s cubic-bezier(0.23, 1, 0.32, 1)',
          'background 0.4s ease',
          'border-color 0.4s ease'
        ].join(', ');
        card.style.transform = TRANSITION_OUT;

        // Reset gradient origins to center
        card.style.setProperty('--bg-x', '50%');
        card.style.setProperty('--bg-y', '50%');

        // After spring-back, restore fast transition for next hover
        setTimeout(() => {
          card.style.transition = 'box-shadow 0.55s cubic-bezier(0.23,1,0.32,1), background 0.4s ease, border-color 0.4s ease';
        }, 620);
      });
    });
  })();

  // ── Drag & Touch Swipe Support ──
  function setupCarouselDrag(elementId, onSwipe) {
    const el = document.getElementById(elementId);
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let distX = 0;
    let distY = 0;
    let isDragging = false;
    const threshold = 40; // minimum distance in px to trigger transition

    // Touch Support
    el.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      isDragging = true;
      distX = 0;
      distY = 0;
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      distX = touch.clientX - startX;
      distY = touch.clientY - startY;
      
      // If horizontal swiping is dominant, prevent default to block vertical page scroll
      if (Math.abs(distX) > Math.abs(distY) && Math.abs(distX) > 10) {
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    el.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      if (Math.abs(distX) > Math.abs(distY) && Math.abs(distX) >= threshold) {
        if (distX > 0) {
          onSwipe('right');
        } else {
          onSwipe('left');
        }
      }
    });

    // Mouse Drag Support (Premium desktop feel)
    el.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      isDragging = true;
      distX = 0;
      distY = 0;
      el.style.cursor = 'grabbing';
      e.preventDefault(); // prevent text selection
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      distX = e.clientX - startX;
      distY = e.clientY - startY;
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      el.style.cursor = '';
      if (Math.abs(distX) > Math.abs(distY) && Math.abs(distX) >= threshold) {
        if (distX > 0) {
          onSwipe('right');
        } else {
          onSwipe('left');
        }
      }
    });
  }

  // Setup for Categories Carousel
  setupCarouselDrag('cat-carousel', (direction) => {
    window.userInteractingWithCarousel = true;
    if (direction === 'left') {
      updateCatCarousel(currentCatIndex + 1);
    } else {
      updateCatCarousel(currentCatIndex - 1);
    }
    // Release interactive lock shortly after transition
    setTimeout(() => {
      window.userInteractingWithCarousel = false;
    }, 1500);
  });

  // Setup for Features Carousel
  setupCarouselDrag('feat-carousel', (direction) => {
    if (direction === 'left') {
      updateFeatCarousel(currentFeatIndex + 1);
    } else {
      updateFeatCarousel(currentFeatIndex - 1);
    }
  });

  // Drag-to-scroll for horizontally scrolling layouts on desktop
  function makeScrollContainerDraggable(className) {
    const containers = document.querySelectorAll(className);
    containers.forEach(container => {
      let isDown = false;
      let startX;
      let scrollLeft;

      container.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
        container.style.cursor = 'grabbing';
        container.style.scrollSnapType = 'none'; // disable snapping temporarily while dragging
      });

      container.addEventListener('mouseleave', () => {
        if (!isDown) return;
        isDown = false;
        container.style.cursor = '';
        container.style.scrollSnapType = ''; // restore snapping
      });

      container.addEventListener('mouseup', () => {
        if (!isDown) return;
        isDown = false;
        container.style.cursor = '';
        container.style.scrollSnapType = ''; // restore snapping
      });

      container.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 1.5;
        container.scrollLeft = scrollLeft - walk;
      });
    });
  }

  // Apply to audiences grids (which display as flex sliders on mobile/tablet)
  makeScrollContainerDraggable('.why-join-cards-grid');

});

