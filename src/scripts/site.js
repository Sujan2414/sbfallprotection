(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* nav: transparent over hero -> floating white capsule on scroll */
  var nav = document.querySelector('nav');
  function navState(){ nav.classList.toggle('scrolled', window.scrollY > 40); }
  window.addEventListener('scroll', navState, { passive: true });
  navState();

  /* mobile menu */
  var burger = document.getElementById('navBurger');
  var panel = document.getElementById('navPanel');
  if (burger && panel){
    function setMenu(open){
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open){ panel.hidden = false; panel.setAttribute('data-open', '1'); nav.classList.add('scrolled'); }
      else { panel.removeAttribute('data-open'); panel.hidden = true; navState(); }
    }
    burger.addEventListener('click', function(){
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
    panel.addEventListener('click', function(e){
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', function(){ if (window.innerWidth > 920) setMenu(false); });
  }

  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* hero parallax: scroll drift everywhere, mouse-follow on pointer devices only */
  var hero = document.querySelector('.hero');
  var hImg = document.querySelector('.hero-img');
  if (hero && hImg){
    var mx = 0, my = 0, tx = 0, ty = 0;
    var drift = reduce ? 0.12 : 0.3;
    if (canHover && !reduce){
      hero.addEventListener('mousemove', function(e){
        var r = hero.getBoundingClientRect();
        mx = ((e.clientX - r.left) / r.width  - .5) * -20;
        my = ((e.clientY - r.top)  / r.height - .5) * -14;
      });
      hero.addEventListener('mouseleave', function(){ mx = 0; my = 0; });
    }
    var heroVisible = true;
    if ('IntersectionObserver' in window){
      new IntersectionObserver(function(en){ heroVisible = en[0].isIntersecting; }).observe(hero);
    }
    (function loop(){
      if (heroVisible){
        tx += (mx - tx) * 0.06;
        ty += (my - ty) * 0.06;
        var sy = Math.min(window.scrollY, hero.offsetHeight) * drift;
        hImg.style.transform =
          'translate3d(' + tx.toFixed(2) + 'px,' + (sy + ty).toFixed(2) + 'px,0) scale(1.12)';
      }
      requestAnimationFrame(loop);
    })();
  }

  /* reveals */
  var els = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce){
    var ro = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('in'); ro.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(function(el){ ro.observe(el); });
  } else { els.forEach(function(el){ el.classList.add('in'); }); }

  /* counters */
  function count(el){
    var t = +el.getAttribute('data-count'), t0 = null, dur = 1500;
    function step(ts){
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      el.textContent = Math.round(t * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var nums = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window){
    var co = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting){ count(e.target); co.unobserve(e.target); } });
    }, { threshold: 0.35 });
    nums.forEach(function(el){ co.observe(el); });
  } else { nums.forEach(function(el){ el.textContent = el.getAttribute('data-count'); }); }

  /* testimonial slider */
  var slides = [
    { q: '\u201cThe premium harness series cut our donning time noticeably, and every shipment has passed site audit first pass. That consistency is why we keep reordering.\u201d',
      n: 'Procurement Head', r: 'Infrastructure & EPC Group', av: '/assets/avatar-2.jpg', ph: '/assets/slide-a.jpg' },
    { q: '\u201cWe needed a twin-leg lanyard built to our spec. SB\u2019s design team prototyped it, tested it, and had it in production faster than anyone else we approached.\u201d',
      n: 'Safety Director', r: 'Wind Energy Contractor', av: '/assets/avatar-4.jpg', ph: '/assets/slide-b2.jpg' },
    { q: '\u201cAs a US importer, documentation and lead times matter as much as the gear itself. SB delivers on all three, order after order.\u201d',
      n: 'Managing Director', r: 'Safety Equipment Distributor, USA', av: '/assets/avatar-3.jpg', ph: '/assets/slide-c2.jpg' },
    { q: '\u201cTheir garments and PPE range let us consolidate three suppliers into one \u2014 and the quality has stayed consistent across every order since.\u201d',
      n: 'Operations Manager', r: 'Industrial Safety Supplier', av: '/assets/avatar-1.jpg', ph: '/assets/slide-d2.jpg' }
  ];
  var qEl = document.getElementById('tQuote'), nEl = document.getElementById('tName'),
      rEl = document.getElementById('tRole'), pEl = document.getElementById('tPhoto'),
      avEl = document.getElementById('tAvatars'), card = document.getElementById('tCard');

  /* only the homepage carries the slider markup */
  if (qEl && avEl && card) {
    var idx = 0, timer;
    slides.forEach(function(s, i){
      var w = document.createElement('span');
      w.className = 't-av' + (i === 0 ? ' on' : '');
      var a = document.createElement('img');
      a.src = s.av; a.alt = 'Show testimonial ' + (i + 1);
      w.addEventListener('click', function(){ go(i); });
      w.appendChild(a);
      avEl.appendChild(w);
    });
    function render(){
      var s = slides[idx];
      qEl.textContent = s.q; nEl.textContent = s.n; rEl.textContent = s.r; pEl.src = s.ph;
      Array.prototype.forEach.call(avEl.children, function(w, i){
        w.classList.remove('on');
        if (i === idx){ void w.offsetWidth; w.classList.add('on'); }
      });
    }
    function go(i){
      idx = (i + slides.length) % slides.length;
      if (reduce){ render(); restart(); return; }
      card.style.transition = 'opacity .25s ease'; card.style.opacity = '0';
      setTimeout(function(){ render(); card.style.opacity = '1'; }, 250);
      restart();
    }
    function restart(){ clearInterval(timer); timer = setInterval(function(){ go(idx + 1); }, 7000); }
    var prev = document.getElementById('tPrev'), next = document.getElementById('tNext');
    if (prev) prev.addEventListener('click', function(){ go(idx - 1); });
    if (next) next.addEventListener('click', function(){ go(idx + 1); });
    render(); restart();
  }

  /* quote form -> mailto (interim until the Nodemailer/M365 endpoint is live) */
  var form = document.getElementById('quoteForm');
  if (form) {
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var f = e.target;
      var val = function(name){
        return f.elements[name] && f.elements[name].value ? f.elements[name].value.trim() : '';
      };
      var type = val('type') || 'General enquiry';
      var lines = [
        'Name: ' + (val('fname') + ' ' + val('lname')).trim(),
        'Company: ' + (val('company') || '-'),
        'Phone: ' + (val('phone') || '-'),
        'Email: ' + val('email'),
        'Delivery country / port: ' + (val('country') || '-'),
        'Product category: ' + type,
        '',
        'Message:',
        val('msg'),
      ];
      location.href = 'mailto:sales@sbfallprotection.com?subject=' +
        encodeURIComponent('Quote request — ' + type) +
        '&body=' + encodeURIComponent(lines.join('\n'));
    });
  }

  /* showreel: chain three clips, with mobile-safe autoplay */
  var vid = document.querySelector('.video-blk video');
  if (vid){
    var reels = ['/assets/showreel.mp4', '/assets/showreel-2.mp4', '/assets/showreel-3.mp4'];
    var ri = 0;
    vid.muted = true;              /* property, not just attribute — required by mobile autoplay policies */
    vid.playsInline = true;
    vid.removeAttribute('loop');

    function tryPlay(){
      var p = vid.play();
      if (p && p.catch) p.catch(function(){ /* blocked until a user gesture */ });
    }
    vid.addEventListener('ended', function(){
      ri = (ri + 1) % reels.length;
      vid.src = reels[ri];
      tryPlay();
    });
    /* mobile browsers often defer autoplay until the element is on screen */
    if ('IntersectionObserver' in window){
      new IntersectionObserver(function(en){
        if (en[0].isIntersecting) tryPlay(); else vid.pause();
      }, { threshold: 0.2 }).observe(vid);
    } else { tryPlay(); }
    /* last-resort: first tap anywhere starts it */
    document.addEventListener('touchstart', function once(){
      tryPlay(); document.removeEventListener('touchstart', once);
    }, { passive: true, once: true });
  }

  /* factory gallery: continuous ticker, drag on desktop, native swipe on touch */
  var track = document.getElementById('facTrack');
  if (track){
    var down = false, startX = 0, startScroll = 0, paused = false, loopW = 0;

    /* duplicate cards so the ticker can wrap seamlessly */
    track.innerHTML += track.innerHTML;
    function measure(){ loopW = track.scrollWidth / 2; }
    measure();
    window.addEventListener('resize', measure);
    if (window.ResizeObserver) new ResizeObserver(measure).observe(track);

    if (canHover){
      track.addEventListener('mousedown', function(e){
        down = true; startX = e.pageX; startScroll = track.scrollLeft;
        track.classList.add('dragging'); e.preventDefault();
      });
      window.addEventListener('mousemove', function(e){
        if (down) track.scrollLeft = startScroll - (e.pageX - startX);
      });
      window.addEventListener('mouseup', function(){
        down = false; track.classList.remove('dragging');
      });
      track.addEventListener('mouseenter', function(){ paused = true; });
      track.addEventListener('mouseleave', function(){ paused = false; });
    } else {
      /* touch: let the browser scroll natively, just pause the ticker meanwhile */
      var resume;
      track.addEventListener('touchstart', function(){
        paused = true; clearTimeout(resume);
      }, { passive: true });
      track.addEventListener('touchend', function(){
        clearTimeout(resume); resume = setTimeout(function(){ paused = false; }, 2000);
      }, { passive: true });
      track.addEventListener('touchcancel', function(){ paused = false; }, { passive: true });
    }

    var speedPerSec = reduce ? 15 : 75; // pixels per second
    var floatScroll = track.scrollLeft;
    var lastTime = performance.now();
    (function tick(now){
      var dt = Math.min(now - lastTime, 100); // cap dt at 100ms to prevent huge jumps
      lastTime = now;
      
      if (!down && !paused) {
        if (Math.abs(floatScroll - track.scrollLeft) > 10) floatScroll = track.scrollLeft;
        floatScroll += (speedPerSec * dt) / 1000;
        track.scrollLeft = floatScroll;
      } else {
        floatScroll = track.scrollLeft;
      }
      
      if (loopW > 0){
        if (track.scrollLeft >= loopW) { track.scrollLeft -= loopW; floatScroll -= loopW; }
        else if (track.scrollLeft < 0) { track.scrollLeft += loopW; floatScroll += loopW; }
      }
      requestAnimationFrame(tick);
    })(performance.now());
  }

  /* reels strip: load + play each clip only while it is on screen, so four
     videos never download at once (matters most on mobile data) */
  var reels = document.querySelectorAll('.reel video');
  if (reels.length && 'IntersectionObserver' in window) {
    var reelObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) {
          if (v.preload === 'none') { v.preload = 'auto'; v.load(); }
          if (!reduce) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.35 });
    reels.forEach(function (v) {
      v.muted = true;
      v.playsInline = true;
      reelObs.observe(v);
    });
  }

  /* Per-clip sound. Autoplay is only allowed while muted, so clips start silent
     and the viewer opts in. Unmuting one mutes the rest — four soundtracks at
     once is nobody's idea of a good time. */
  var soundBtns = document.querySelectorAll('.reel-sound');
  soundBtns.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      // the tile is wrapped in a link to Instagram; don't follow it
      e.preventDefault();
      e.stopPropagation();
      var vid = btn.closest('.reel').querySelector('video');
      if (!vid) return;
      var turningOn = vid.muted;

      soundBtns.forEach(function (other) {
        if (other === btn) return;
        var ov = other.closest('.reel').querySelector('video');
        if (ov) ov.muted = true;
        other.setAttribute('aria-pressed', 'false');
        other.setAttribute('aria-label', 'Unmute this clip');
      });

      vid.muted = !turningOn;
      btn.setAttribute('aria-pressed', turningOn ? 'true' : 'false');
      btn.setAttribute('aria-label', turningOn ? 'Mute this clip' : 'Unmute this clip');
      if (turningOn) {
        var pr = vid.play();
        if (pr && pr.catch) pr.catch(function () {});
      }
    });
  });

  /* A clip that scrolls out of view should not keep playing sound. */
  if (soundBtns.length && 'IntersectionObserver' in window) {
    var muteObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) return;
        var v = en.target.querySelector('video');
        var b = en.target.querySelector('.reel-sound');
        if (v && !v.muted) {
          v.muted = true;
          if (b) {
            b.setAttribute('aria-pressed', 'false');
            b.setAttribute('aria-label', 'Unmute this clip');
          }
        }
      });
    }, { threshold: 0.2 });
    document.querySelectorAll('.reel').forEach(function (r) { muteObs.observe(r); });
  }


  /* inner-page hero: scroll-driven drift + a slow fade of the copy, matching
     the homepage hero treatment. Scroll-linked only, no mouse dependency. */
  var pHero = document.querySelector('.page-hero');
  var pImg = document.querySelector('.page-hero-media img');
  var pIn = document.querySelector('.page-hero-in');
  if (pHero && pImg) {
    var pVisible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { pVisible = en[0].isIntersecting; }).observe(pHero);
    }
    var lastY = -1;
    (function pLoop() {
      if (pVisible) {
        var y = window.scrollY;
        if (y !== lastY) {
          lastY = y;
          var h = pHero.offsetHeight || 1;
          var k = Math.min(y / h, 1);
          /* pinned hero: zoom + dim rather than translate, so the image never
             slides out from behind the content sheet riding over it */
          pImg.style.transform = 'scale(' + (1.1 + k * 0.07).toFixed(4) + ')';
          pImg.style.filter = 'brightness(' + (1 - k * 0.30).toFixed(3) + ')';
          if (pIn && !reduce) {
            pIn.style.opacity = Math.max(0, 1 - k * 1.25).toFixed(3);
            pIn.style.transform = 'translate3d(0,' + (y * 0.05).toFixed(2) + 'px,0)';
          }
        }
      }
      requestAnimationFrame(pLoop);
    })();
  }


  /* back-to-top FAB: appears past one viewport, smooth unless reduced-motion */
  var fabTop = document.getElementById('fabTop');
  if (fabTop) {
    var showAt = Math.max(400, window.innerHeight * 0.8);
    function fabState() { fabTop.classList.toggle('show', window.scrollY > showAt); }
    window.addEventListener('scroll', fabState, { passive: true });
    window.addEventListener('resize', function () {
      showAt = Math.max(400, window.innerHeight * 0.8);
      fabState();
    });
    fabTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
    fabState();
  }

})();
