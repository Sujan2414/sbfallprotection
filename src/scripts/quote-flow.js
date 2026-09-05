/**
 * Conversational quote flow — a guided chat that replaces the traditional form.
 *
 * Answers are collected step by step, then submitted to Supabase `inquiries`
 * (anonymous insert is allowed by RLS). If Supabase isn't reachable it falls
 * back to opening a prefilled email, so a lead is never lost.
 */
(function () {
  var root = document.getElementById('quoteFlow');
  if (!root) return;

  var body = document.getElementById('flowBody');
  var foot = document.getElementById('flowFoot');
  // the progress bar was removed from the header; keep the lookup optional
  var bar = document.getElementById('flowBar');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var cats = [];
  try {
    var catNode = document.getElementById('flowCats');
    if (catNode) cats = JSON.parse(catNode.textContent || '[]');
  } catch (e) { cats = []; }

  var preSku = root.getAttribute('data-sku') || '';
  var preCat = root.getAttribute('data-category') || '';
  var answers = { sku: preSku };

  var steps = [
    {
      key: 'category',
      ask: preSku
        ? 'Hi! You’re enquiring about ' + preSku + '. Which range does that sit in?'
        : 'Hi — happy to put a quote together. What are you looking for?',
      chips: cats.concat(['Something else']),
    },
    {
      key: 'detail',
      ask: 'Got it. Which product codes and quantities do you need? Rough numbers are fine.',
      input: 'textarea',
      placeholder: 'e.g. 200 × SBH024, 150 × twin-leg lanyards',
    },
    {
      key: 'country',
      ask: 'Where should this ship to?',
      input: 'text',
      placeholder: 'Country or port',
    },
    {
      key: 'name',
      ask: 'And your name?',
      input: 'text',
      placeholder: 'Full name',
      autocomplete: 'name',
    },
    {
      key: 'company',
      ask: 'Which company are you with?',
      input: 'text',
      placeholder: 'Company name',
      autocomplete: 'organization',
      skippable: true,
    },
    {
      key: 'email',
      ask: 'Last one — where do we send the quotation?',
      input: 'email',
      placeholder: 'you@company.com',
      autocomplete: 'email',
    },
  ];

  var i = 0;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function push(text, who) {
    var el = document.createElement('div');
    el.className = 'flow-msg ' + who;
    el.textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function progress() {
    if (bar) bar.style.width = Math.round((i / steps.length) * 100) + '%';
  }

  function ask() {
    progress();
    if (i >= steps.length) return submit();

    var step = steps[i];

    // the category is already known on a product page — skip that question
    if (step.key === 'category' && preCat) {
      answers.category = preCat;
      i++;
      return ask();
    }

    var delay = reduce ? 0 : 320;
    setTimeout(function () {
      push(step.ask, 'bot');
      render(step);
    }, delay);
  }

  function render(step) {
    foot.innerHTML = '';

    if (step.chips) {
      var wrap = document.createElement('div');
      wrap.className = 'flow-chips';
      step.chips.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'flow-chip';
        b.textContent = c;
        b.addEventListener('click', function () { answer(step, c); });
        wrap.appendChild(b);
      });
      foot.appendChild(wrap);
      return;
    }

    var row = document.createElement('div');
    row.className = 'flow-input';
    var field = document.createElement(step.input === 'textarea' ? 'textarea' : 'input');
    if (step.input !== 'textarea') field.type = step.input;
    field.placeholder = step.placeholder || '';
    field.setAttribute('aria-label', step.placeholder || step.key);
    if (step.autocomplete) field.autocomplete = step.autocomplete;

    var send = document.createElement('button');
    send.type = 'button';
    send.className = 'flow-send';
    send.setAttribute('aria-label', 'Send');
    send.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

    function go() {
      var v = field.value.trim();
      if (!v) {
        if (step.skippable) return answer(step, '—');
        field.focus();
        return;
      }
      if (step.input === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        field.focus();
        return;
      }
      answer(step, v);
    }
    send.addEventListener('click', go);
    field.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (step.input !== 'textarea' || (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        go();
      }
    });

    row.appendChild(field);
    row.appendChild(send);
    foot.appendChild(row);

    var hint = document.createElement('span');
    hint.className = 'flow-hint';
    hint.textContent = step.skippable
      ? 'Optional — press send to skip.'
      : (step.input === 'textarea' ? 'Ctrl + Enter to continue.' : 'Press Enter to continue.');
    foot.appendChild(hint);

    if (!reduce) field.focus({ preventScroll: true });
  }

  function answer(step, value) {
    answers[step.key] = value;
    push(value, 'me');
    i++;
    ask();
  }

  function submit() {
    foot.innerHTML = '';
    var thinking = push('Sending your request…', 'bot');

    var message =
      'Requirement: ' + (answers.detail || '-') +
      '\nDeliver to: ' + (answers.country || '-') +
      (answers.sku ? '\nProduct code: ' + answers.sku : '');

    /* The id is generated here rather than by Postgres: anonymous callers may
       insert an enquiry but not read one back, so this is the only way to know
       which row to ask the notifier about. */
    var newId = null;
    try { newId = crypto.randomUUID(); } catch (e) { newId = null; }

    var payload = {
      id: newId || undefined,
      name: answers.name || null,
      company: answers.company && answers.company !== '—' ? answers.company : null,
      email: answers.email || null,
      country: answers.country || null,
      category: answers.category || null,
      message: message,
      sku: answers.sku || null,
      source_page: location.pathname,
    };

    var url = root.getAttribute('data-sb-url') || window.__SB_URL__;
    var key = root.getAttribute('data-sb-key') || window.__SB_KEY__;

    function done(viaEmail) {
      thinking.remove();
      if (bar) bar.style.width = '100%';
      var subject = 'Quote request' + (answers.sku ? ' — ' + answers.sku : '');
      var mailBody =
        'Name: ' + (answers.name || '-') +
        '\nCompany: ' + (answers.company || '-') +
        '\nEmail: ' + (answers.email || '-') +
        '\nCategory: ' + (answers.category || '-') +
        '\n\n' + message;
      var mailto = 'mailto:sales@sbfallprotection.com?subject=' +
        encodeURIComponent(subject) + '&body=' + encodeURIComponent(mailBody);
      var wa = 'https://wa.me/919544070143?text=' + encodeURIComponent(subject + '\n\n' + mailBody);

      root.querySelector('.flow-body').innerHTML =
        '<div class="flow-done">' +
        '<div class="tick"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg></div>' +
        '<h4>' + (viaEmail ? 'Almost there' : 'Request received') + '</h4>' +
        '<p>' + (viaEmail
          ? 'Your email app is opening with everything filled in — just hit send.'
          : 'Thanks ' + esc((answers.name || '').split(' ')[0]) +
            '. Our sales team will come back with specifications, MOQ and pricing within one business day.') +
        '</p>' +
        '<div class="btns">' +
        '<a class="btn btn-orange" href="' + wa + '" target="_blank" rel="noopener noreferrer">Continue on WhatsApp</a>' +
        (viaEmail ? '<a class="btn btn-line" href="' + mailto + '">Open email</a>'
                  : '<a class="btn btn-line" href="/products">Browse products</a>') +
        '</div></div>';
      foot.innerHTML = '';
      if (viaEmail) location.href = mailto;
    }

    if (!url || !key) return done(true);

    fetch(url + '/rest/v1/inquiries', {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        if (!r.ok) return done(true);
        // Tell the sales desk. Only the id travels — the endpoint reads the
        // enquiry back server-side, so this cannot be used to send mail.
        if (payload.id) {
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: payload.id }),
            keepalive: true,
          }).catch(function () {});
        }
        // the enquiry is saved either way, so never fail the visitor on this
        done(false);
      })
      .catch(function () { done(true); });
  }

  ask();
})();
