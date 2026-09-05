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
      n: 'Operations Manager', r: 'Industrial Safety Supplier', av: '/assets/avatar-1.jpg', ph: '/assets/slide-d2.jpg?v=2' }
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

  /*
   * Quote form. Saves to Supabase like the chat flow on the contact page does,
   * then pings the notifier so the sales desk is emailed. Opening the visitor's
   * mail client is the fallback, not the plan: it used to be the only path,
   * which meant an enquiry was lost whenever they had no mail app set up.
   */
  var form = document.getElementById('quoteForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      var val = function (name) {
        return f.elements[name] && f.elements[name].value ? f.elements[name].value.trim() : '';
      };
      var type = val('type') || 'General enquiry';
      var name = (val('fname') + ' ' + val('lname')).trim();
      var lines = [
        'Name: ' + name,
        'Company: ' + (val('company') || '-'),
        'Phone: ' + (val('phone') || '-'),
        'Email: ' + val('email'),
        'Delivery country / port: ' + (val('country') || '-'),
        'Product category: ' + type,
        '',
        'Message:',
        val('msg'),
      ];

      var btn = f.querySelector('button[type=submit]');
      var label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      function mailFallback() {
        location.href = 'mailto:sales@sbfallprotection.com?subject=' +
          encodeURIComponent('Quote request — ' + type) +
          '&body=' + encodeURIComponent(lines.join('\n'));
      }

      function done(ok) {
        if (btn) { btn.disabled = false; btn.textContent = label; }
        if (!ok) return mailFallback();
        f.innerHTML =
          '<h3>Thank you<em>.</em></h3>' +
          '<p class="respond">Your request has reached our sales desk. ' +
          'We typically respond within one business day.</p>';
      }

      var url = f.getAttribute('data-sb-url');
      var key = f.getAttribute('data-sb-key');
      if (!url || !key) return done(false);

      // minted here because anonymous callers may insert an enquiry but not
      // read one back, and the notifier needs to know which row to send
      var id = null;
      try { id = crypto.randomUUID(); } catch (err) { id = null; }

      fetch(url + '/rest/v1/inquiries', {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          id: id || undefined,
          name: name || null,
          company: val('company') || null,
          email: val('email') || null,
          phone: val('phone') || null,
          country: val('country') || null,
          category: type,
          message: val('msg') || null,
          source_page: location.pathname,
        }),
      })
        .then(function (r) {
          if (!r.ok) return done(false);
          if (id) {
            fetch('/api/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: id }),
              keepalive: true,
            }).catch(function () {});
          }
          done(true);
        })
        .catch(function () { done(false); });
    });
  }

  /*
   * "Why global buyers trust us" drifts along on a phone, where the cards are
   * a horizontal row. It pauses while the visitor is dragging it and resumes
   * afterwards, so the automatic motion never fights a deliberate swipe.
   */
  var whyRow = document.querySelector('.why-g');
  if (whyRow && window.matchMedia('(max-width:620px)').matches && !reduce) {
    var whyPaused = false, whyIdle = null;

    function whyHold(ms) {
      whyPaused = true;
      clearTimeout(whyIdle);
      whyIdle = setTimeout(function () { whyPaused = false; }, ms || 2600);
    }
    /* Only real input pauses it. A 'scroll' listener cannot tell the drift's own
       scrollLeft write from a swipe, so it paused itself on every frame and the
       row never moved. */
    ['touchstart', 'pointerdown', 'wheel'].forEach(function (ev) {
      whyRow.addEventListener(ev, function () { whyHold(); }, { passive: true });
    });
    whyRow.addEventListener('touchend', function () { whyHold(2600); }, { passive: true });

    /* The position is accumulated here rather than read back from scrollLeft
       each frame: a ~0.4px step gets rounded away on read, so the row crawled
       at a fifth of the intended speed. */
    var whyLast = 0;
    var whyPos = whyRow.scrollLeft;
    ['touchend', 'pointerup'].forEach(function (ev) {
      whyRow.addEventListener(ev, function () { whyPos = whyRow.scrollLeft; }, { passive: true });
    });

    (function drift(now) {
      requestAnimationFrame(drift);
      if (whyPaused || !whyLast) { whyLast = now; return; }
      var dt = now - whyLast;
      whyLast = now;
      if (dt > 120) return;                     // tab was in the background
      var max = whyRow.scrollWidth - whyRow.clientWidth;
      if (max <= 0) return;
      whyPos += dt * 0.022;                     // ~22px per second
      if (whyPos >= max) whyPos = 0;            // loop back to the start
      whyRow.scrollLeft = whyPos;
    })(0);
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
  /*
   * Factory ticker. Motion is a CSS transform animation on an inner strip, not
   * a scrollLeft write per frame: on a phone the per-frame write fought the
   * native scroll compositor and rounded to device pixels, which read as
   * stutter. A transform runs on the compositor thread and stays smooth even
   * while the main thread is busy. The track itself stays a real scroller so a
   * swipe or a mouse drag still works on top of it.
   */
  var track = document.getElementById('facTrack');
  if (track){
    /* two identical sets, each with a trailing gap, so -50% is a seamless wrap */
    var cards = Array.prototype.slice.call(track.children);
    var strip = document.createElement('div');
    strip.className = 'fac-strip';
    for (var k = 0; k < 2; k++){
      var set = document.createElement('div');
      set.className = 'fac-set';
      cards.forEach(function(c){ set.appendChild(k ? c.cloneNode(true) : c); });
      strip.appendChild(set);
    }
    track.appendChild(strip);

    var speedPerSec = reduce ? 15 : 75;                 // px per second
    function measure(){
      var loopW = strip.scrollWidth / 2;
      if (loopW > 0) strip.style.setProperty('--fac-dur', (loopW / speedPerSec) + 's');
    }
    measure();
    window.addEventListener('resize', measure);
    if (window.ResizeObserver) new ResizeObserver(measure).observe(strip);

    var down = false, startX = 0, startScroll = 0, resume;
    function hold(){ track.classList.add('is-paused'); clearTimeout(resume); }
    function release(ms){ clearTimeout(resume); resume = setTimeout(function(){ track.classList.remove('is-paused'); }, ms); }

    if (canHover){
      track.addEventListener('mousedown', function(e){
        down = true; startX = e.pageX; startScroll = track.scrollLeft;
        track.classList.add('dragging'); hold(); e.preventDefault();
      });
      window.addEventListener('mousemove', function(e){
        if (down) track.scrollLeft = startScroll - (e.pageX - startX);
      });
      window.addEventListener('mouseup', function(){
        if (!down) return;
        down = false; track.classList.remove('dragging'); release(600);
      });
      /* hover pause is CSS; nothing to do here */
    } else {
      track.addEventListener('touchstart', hold, { passive: true });
      track.addEventListener('touchend', function(){ release(2000); }, { passive: true });
      track.addEventListener('touchcancel', function(){ release(400); }, { passive: true });
    }
  }

  /* reels strip: load + play each clip only while it is on screen, so four
     videos never download at once (matters most on mobile data) */
  var reels = document.querySelectorAll('.reel video');

  /* play() straight after load() rejects on most phones — the element has no
     data yet. Try now; if it refuses, try once more when it can actually play. */
  /* named distinctly: the showreel block above declares its own tryPlay(), and a
     block-level function declaration overwrites a same-named outer one when the
     block runs — so the reels were calling the showreel helper instead. */
  function playReel(v){
    /* HAVE_CURRENT_DATA or better: safe to play. Below that, play() right after
       load() is rejected with AbortError and nothing retries — so wait for the
       data instead of racing it. */
    if (v.readyState >= 2) {
      var p = v.play(); if (p && p.catch) p.catch(function(){});
      return;
    }
    if (v.dataset.waiting) return;
    v.dataset.waiting = '1';
    v.addEventListener('loadeddata', function once(){
      v.removeEventListener('loadeddata', once);
      delete v.dataset.waiting;
      if (v.dataset.onscreen) { var q = v.play(); if (q && q.catch) q.catch(function(){}); }
    });
  }
  /* Some phones need one gesture before any media plays, even muted. The first
     touch anywhere retries every clip that is on screen. */
  if (reels.length) {
    document.addEventListener('touchstart', function unlock(){
      document.removeEventListener('touchstart', unlock);
      reels.forEach(function(v){ if (v.dataset.onscreen && v.paused && !reduce) playReel(v); });
    }, { passive: true, once: true });
  }

  if (reels.length && 'IntersectionObserver' in window) {
    var reelObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) {
          v.dataset.onscreen = '1';
          if (v.preload === 'none') { v.preload = 'auto'; v.load(); }
          if (!reduce) playReel(v);
        } else {
          delete v.dataset.onscreen;
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

  /* A silent clip should not offer a speaker. Stock footage usually carries no
     audio track; reels pulled from Instagram do. Chrome only reports this once
     playback has started, so check a moment after each clip begins. */
  function hasAudio(v) {
    if (v.mozHasAudio !== undefined) return v.mozHasAudio;
    if (v.audioTracks) return v.audioTracks.length > 0;
    if (v.webkitAudioDecodedByteCount !== undefined) return v.webkitAudioDecodedByteCount > 0;
    return true;   // unknown: leave the control in place
  }
  soundBtns.forEach(function (btn) {
    var v = btn.closest('.reel').querySelector('video');
    if (!v) return;
    v.addEventListener('playing', function once() {
      setTimeout(function () { if (!hasAudio(v)) btn.hidden = true; }, 400);
      v.removeEventListener('playing', once);
    });
  });

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
