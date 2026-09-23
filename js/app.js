/*
 * Merchander – views and hash router (Sprint 1).
 */
(function () {
  const CFG = window.MERCHANDER_CONFIG;
  const M = window.Merchander;
  const BIZ = CFG.business;
  const app = document.getElementById('app');

  // ---------- helpers ----------
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const go = (hash) => {
    if (location.hash === hash) render();
    else location.hash = hash;
  };
  const ROLE_LABEL = { customer: 'Customer', employee: 'Employee', delivery: 'Delivery Personnel', owner: 'Business Owner' };

  function toast(text, kind = 'info') {
    const t = document.createElement('div');
    t.className = 'toast toast-' + kind;
    t.setAttribute('role', 'status');
    t.textContent = text;
    const box = $('#toasts');
    box.appendChild(t);
    while (box.children.length > 3) box.firstElementChild.remove();
    setTimeout(() => t.remove(), 4000);
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }
  function showErrors(form, errors = {}, message) {
    $$('.field-error', form).forEach((e) => e.remove());
    $$('[aria-invalid]', form).forEach((e) => e.removeAttribute('aria-invalid'));
    const alert = $('.form-alert', form);
    if (alert) {
      alert.hidden = !message;
      alert.textContent = message || '';
    }
    let first = null;
    Object.entries(errors).forEach(([name, msg]) => {
      const input = form.elements[name];
      if (!input) return;
      const el = input.length && !input.tagName ? input[0] : input;
      el.setAttribute('aria-invalid', 'true');
      const p = document.createElement('p');
      p.className = 'field-error';
      p.textContent = msg;
      (el.closest('.field') || el.parentElement).appendChild(p);
      first = first || el;
    });
    if (first) first.focus();
    else if (message && alert) alert.scrollIntoView({ block: 'nearest' });
  }
  function busy(form, on) {
    $$('button', form).forEach((b) => (b.disabled = on));
  }

  function field(name, label, opts = {}) {
    const { type = 'text', value = '', placeholder = '', autocomplete = 'off', hint = '', required = true, attrs = '' } = opts;
    return `<div class="field ${opts.cls || ''}">
      <label for="f-${name}">${esc(label)}${required ? '' : ' <span class="muted">(optional)</span>'}</label>
      <input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="${autocomplete}" ${required ? 'required' : ''} ${attrs}>
      ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
    </div>`;
  }
  function passwordField(name, label, autocomplete, hint = '') {
    return `<div class="field">
      <label for="f-${name}">${esc(label)}</label>
      <div class="pw-wrap">
        <input id="f-${name}" name="${name}" type="password" autocomplete="${autocomplete}" required>
        <button type="button" class="pw-toggle" data-toggle-pw="f-${name}" aria-label="Show password">Show</button>
      </div>
      ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
    </div>`;
  }
  const PW_HINT = 'At least 8 characters with uppercase, lowercase, a number, and a symbol.';

  // Simple product illustration drawn as SVG so the catalog needs no image files.
  function productArt(p) {
    const c = p.color;
    const shapes = {
      bottle: `<path d="M52 14h16v14c0 4 10 8 10 18v58c0 5-4 8-8 8H50c-4 0-8-3-8-8V46c0-10 10-14 10-18z" fill="${c}"/><rect x="42" y="60" width="36" height="24" fill="#fff" opacity=".9"/><rect x="50" y="8" width="20" height="8" rx="2" fill="${c}" opacity=".7"/>`,
      can: `<rect x="38" y="22" width="44" height="90" rx="8" fill="${c}"/><ellipse cx="60" cy="24" rx="22" ry="5" fill="#cbd5e1"/><rect x="38" y="52" width="44" height="26" fill="#fff" opacity=".9"/>`,
      glass: `<path d="M53 10h14v20c0 4 12 10 12 22v54c0 5-4 8-8 8H49c-4 0-8-3-8-8V52c0-12 12-18 12-22z" fill="${c}"/><ellipse cx="60" cy="72" rx="15" ry="11" fill="#fff" opacity=".9"/>`,
      liquor: `<path d="M54 10h12v22l16 10v64c0 5-4 8-8 8H46c-4 0-8-3-8-8V42l16-10z" fill="${c}"/><rect x="44" y="56" width="32" height="30" rx="3" fill="#fff" opacity=".9"/>`,
    };
    return `<svg viewBox="0 0 120 124" role="img" aria-label="${esc(p.name)}" class="art">${shapes[p.shape] || shapes.bottle}</svg>`;
  }

  // ---------- header / nav ----------
  function renderHeader() {
    const me = M.currentUser();
    const nav = $('#nav');
    nav.innerHTML = me
      ? `<a href="#/">Home</a><a href="#/catalog">Catalog</a><a href="#/dashboard">Dashboard</a><a href="#/account">My Account</a>
         <button class="btn btn-ghost" data-action="logout">Log out</button>`
      : `<a href="#/">Home</a><a href="#/catalog">Catalog</a><a href="#/login" class="btn btn-ghost">Log in</a><a href="#/register" class="btn btn-primary">Create account</a>`;
    $$('a', nav).forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + route().path));
    const theme = M.Theme.get();
    const tbtn = $('#themeToggle');
    tbtn.textContent = theme === 'dark' ? '☀' : '☾';
    tbtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }

  // ---------- views ----------
  function viewWelcome() {
    const products = M.Catalog.products();
    const me = M.currentUser();
    const cats = CFG.categories
      .map((c) => {
        const count = products.filter((p) => p.category === c.id).length;
        return `<a class="cat-card" href="#/catalog?c=${c.id}"><strong>${esc(c.name)}</strong><span class="muted">${count} products</span></a>`;
      })
      .join('');
    return `
      <section class="hero">
        <div class="hero-text">
          <p class="eyebrow">Wholesale beverages · Caloocan City</p>
          <h1>${esc(BIZ.name)}</h1>
          <p class="lead">${esc(BIZ.overview)}</p>
          <div class="cta-row">
            <a class="btn btn-primary btn-lg" href="#/catalog">Browse products</a>
            ${me ? `<a class="btn btn-ghost btn-lg" href="#/dashboard">Go to dashboard</a>` : `<a class="btn btn-ghost btn-lg" href="#/register">Create an account</a><a class="link" href="#/login">Already a customer? Log in</a>`}
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">${products.slice(0, 1).concat(products.slice(6, 7), products.slice(10, 11)).map(productArt).join('')}</div>
      </section>

      <section class="section">
        <h2>What we carry</h2>
        <div class="cat-grid">${cats}</div>
      </section>

      <section class="section info-grid">
        <div class="card">
          <h3>How ordering works</h3>
          <ol class="steps">
            <li><strong>Create an account</strong> with your store details and verify your mobile number or email.</li>
            <li><strong>Check the catalog</strong> for case and half-case prices and current stock.</li>
            <li><strong>Order online</strong> and track it until it reaches your store. <span class="muted">(coming in the next release)</span></li>
          </ol>
        </div>
        <div class="card" id="contact">
          <h3>Visit or contact us</h3>
          <dl class="details">
            <dt>Address</dt><dd>${esc(BIZ.address)}</dd>
            <dt>Landline</dt><dd><a href="tel:${esc(BIZ.phone.replace(/[^\d+]/g, ''))}">${esc(BIZ.phone)}</a></dd>
            <dt>Mobile</dt><dd><a href="tel:${esc(BIZ.mobile.replace(/[^\d+]/g, ''))}">${esc(BIZ.mobile)}</a></dd>
            <dt>Email</dt><dd><a href="mailto:${esc(BIZ.email)}">${esc(BIZ.email)}</a></dd>
          </dl>
        </div>
        <div class="card">
          <h3>Operating hours</h3>
          <dl class="details">${BIZ.hours.map((h) => `<dt>${esc(h.days)}</dt><dd>${esc(h.time)}</dd>`).join('')}</dl>
        </div>
      </section>`;
  }

  function productCard(p, me) {
    return `<article class="product">
      <a href="#/product/${p.id}" class="product-art">${productArt(p)}</a>
      <div class="product-body">
        <span class="badge badge-${p.status.key}">${p.status.label}</span>
        <h3><a href="#/product/${p.id}">${esc(p.name)}</a></h3>
        <p class="muted small">${esc(p.description)}</p>
        <dl class="prices">
          <div><dt>Per case</dt><dd>${peso(p.priceCase)}</dd></div>
          <div><dt>Per half-case</dt><dd>${peso(p.priceHalf)}</dd></div>
        </dl>
        <p class="small muted">${esc(p.packSize)} · ${p.stock > 0 ? p.stock + ' cases available' : 'none available'}</p>
        ${orderButton(p, me)}
      </div>
    </article>`;
  }
  function orderButton(p, me) {
    if (p.stock <= 0) return `<button class="btn btn-block" disabled>Out of Stock</button>`;
    if (!me) return `<a class="btn btn-block btn-ghost" href="#/login?next=${encodeURIComponent('/product/' + p.id)}">Log in to order</a>`;
    if (me.role !== 'customer') return '';
    return `<button class="btn btn-block btn-primary" data-action="add-to-cart" data-id="${p.id}">Add to Cart</button>`;
  }

  function viewCatalog(q) {
    const me = M.currentUser();
    const products = M.Catalog.products();
    if (!products.length) return `<h1>Product Catalog</h1><p class="empty">No products are available at this time.</p>`;
    const selected = q.get('c');
    const cats = CFG.categories.filter((c) => !selected || c.id === selected);
    return `
      <div class="page-head">
        <h1>Product Catalog</h1>
        <p class="muted">Prices are per case and per half-case. Stock is updated from our warehouse records.</p>
        ${!me ? `<p class="notice">You are browsing as a visitor. <a href="#/login?next=%2Fcatalog">Log in</a> or <a href="#/register">create an account</a> to order.</p>` : ''}
      </div>
      <nav class="chips" aria-label="Categories">
        <a href="#/catalog" class="chip ${!selected ? 'active' : ''}">All</a>
        ${CFG.categories.map((c) => `<a href="#/catalog?c=${c.id}" class="chip ${selected === c.id ? 'active' : ''}">${esc(c.name)}</a>`).join('')}
      </nav>
      ${cats
        .map((c) => {
          const list = products.filter((p) => p.category === c.id);
          return `<section class="section" id="cat-${c.id}">
            <h2>${esc(c.name)} <span class="muted small">(${list.length})</span></h2>
            ${list.length ? `<div class="product-grid">${list.map((p) => productCard(p, me)).join('')}</div>` : `<p class="empty">No products in this category yet.</p>`}
          </section>`;
        })
        .join('')}`;
  }

  function viewProduct(id) {
    const p = M.Catalog.product(id);
    const me = M.currentUser();
    if (!p) return `<p class="empty">This product could not be found. <a href="#/catalog">Back to catalog</a></p>`;
    const cat = CFG.categories.find((c) => c.id === p.category);
    return `
      <p class="crumbs"><a href="#/catalog">Catalog</a> › <a href="#/catalog?c=${cat.id}">${esc(cat.name)}</a> › ${esc(p.name)}</p>
      <div class="product-detail card">
        <div class="product-art large">${productArt(p)}</div>
        <div>
          <span class="badge badge-${p.status.key}">${p.status.label}</span>
          <h1>${esc(p.name)}</h1>
          <p>${esc(p.description)}</p>
          <dl class="prices big">
            <div><dt>Per case</dt><dd>${peso(p.priceCase)}</dd></div>
            <div><dt>Per half-case</dt><dd>${peso(p.priceHalf)}</dd></div>
          </dl>
          <dl class="details">
            <dt>Packaging</dt><dd>${esc(p.packSize)}</dd>
            <dt>Available</dt><dd>${p.stock > 0 ? p.stock + ' cases' : 'Out of stock'}</dd>
            <dt>Product code</dt><dd>${esc(p.id)}</dd>
          </dl>
          <div class="narrow">${orderButton(p, me)}</div>
        </div>
      </div>`;
  }

  // ---------- auth views ----------
  function authShell(title, sub, body) {
    return `<div class="auth"><div class="card auth-card"><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}${body}</div></div>`;
  }

  function viewLogin(q) {
    return authShell(
      'Log in',
      'Use your registered email address or mobile number.',
      `<form id="loginForm" novalidate>
        <p class="form-alert" role="alert" hidden></p>
        ${field('identifier', 'Email or mobile number', { autocomplete: 'username', placeholder: 'you@store.com or 09171234567' })}
        ${passwordField('password', 'Password', 'current-password')}
        <p class="right"><a href="#/forgot">Forgot password?</a></p>
        <button class="btn btn-primary btn-block" type="submit">Log in</button>
      </form>
      <div class="divider"><span>or</span></div>
      <button class="btn btn-block btn-google" data-action="google"><span class="g">G</span> Sign in with Google</button>
      <p class="center small">New to ${esc(BIZ.shortName)}? <a href="#/register">Create an account</a></p>
      <details class="demo"><summary>Demo accounts</summary>
        <table><tbody>${CFG.seedUsers.map((u) => `<tr><td>${ROLE_LABEL[u.role]}${u.status === 'inactive' ? ' (inactive)' : ''}</td><td><code>${u.email}</code></td><td><code>${u.password}</code></td></tr>`).join('')}</tbody></table>
      </details>`
    );
  }
  function bindLogin(q) {
    const form = $('#loginForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(form);
      busy(form, true);
      const res = await M.Auth.login(d.identifier, d.password);
      busy(form, false);
      if (!res.ok) {
        showErrors(form, {}, res.error);
        if (res.locked) $('.form-alert', form).insertAdjacentHTML('beforeend', ' <a href="#/forgot">Reset password</a>');
        return;
      }
      afterLogin(res.user, q);
    });
  }
  function afterLogin(user, q) {
    M.Theme.apply();
    toast(`Welcome, ${user.firstName}!`, 'success');
    const next = q && q.get('next');
    go('#' + (next && next.startsWith('/') ? next : '/dashboard'));
  }

  function openGoogleChooser() {
    const accounts = M.Auth.googleAccounts();
    const dlg = $('#modal');
    dlg.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="gTitle">
      <div class="g-head"><span class="g">G</span><h2 id="gTitle">Choose an account</h2><p class="muted small">to continue to Merchander</p></div>
      <ul class="g-list">${accounts.map((a) => `<li><button data-g="${esc(a.email)}"><span class="avatar">${esc(a.name[0])}</span><span><strong>${esc(a.name)}</strong><br><span class="muted small">${esc(a.email)}</span></span></button></li>`).join('')}</ul>
      <form id="gOther" class="g-other"><label for="gEmail" class="small">Use another Google account</label><div class="row"><input id="gEmail" type="email" placeholder="name@gmail.com" required><button class="btn">Next</button></div></form>
      <p class="muted small">Demo: this simulates the Google Identity Provider. Only accounts linked in Merchander can sign in.</p>
      <div class="right"><button class="btn btn-ghost" data-close>Cancel</button></div>
    </div>`;
    dlg.hidden = false;
    const close = () => (dlg.hidden = true);
    const pick = async (email) => {
      close();
      const res = await M.Auth.loginWithGoogle(email);
      if (!res.ok) {
        const form = $('#loginForm');
        if (form) showErrors(form, {}, res.error);
        else toast(res.error, 'error');
        return;
      }
      afterLogin(res.user, route().query);
    };
    $$('[data-g]', dlg).forEach((b) => b.addEventListener('click', () => pick(b.dataset.g)));
    $('#gOther', dlg).addEventListener('submit', (e) => {
      e.preventDefault();
      pick($('#gEmail', dlg).value);
    });
    $('[data-close]', dlg).addEventListener('click', close);
    dlg.onclick = (e) => e.target === dlg && close();
    (dlg.querySelector('[data-g]') || $('#gEmail', dlg)).focus();
  }

  function viewRegister() {
    const pending = M.Auth.pendingRegistration();
    if (pending && pending.otp) return viewOtp('register', pending.channel, pending.maskedTo, pending.otp);
    return authShell(
      'Create your customer account',
      'Register your store to order wholesale online. We will verify your mobile number or email before activating the account.',
      `<form id="registerForm" novalidate>
        <p class="form-alert" role="alert" hidden></p>
        <fieldset><legend>Business &amp; contact</legend>
          ${field('businessName', 'Business / store name', { autocomplete: 'organization' })}
          <div class="grid-2">
            ${field('firstName', 'Contact person first name', { autocomplete: 'given-name' })}
            ${field('lastName', 'Last name', { autocomplete: 'family-name' })}
          </div>
          <div class="grid-2">
            ${field('mobile', 'Mobile number', { type: 'tel', autocomplete: 'tel', placeholder: '09171234567' })}
            ${field('email', 'Email address', { type: 'email', autocomplete: 'email', placeholder: 'you@store.com' })}
          </div>
        </fieldset>
        <fieldset><legend>Delivery address</legend>
          ${field('line', 'House / unit, street', { autocomplete: 'address-line1' })}
          <div class="grid-2">
            ${field('barangay', 'Barangay')}
            ${field('city', 'City / municipality', { value: 'Caloocan City', autocomplete: 'address-level2' })}
          </div>
          <div class="grid-2">
            ${field('province', 'Province / region', { value: 'Metro Manila', autocomplete: 'address-level1' })}
            ${field('postal', 'Postal code', { autocomplete: 'postal-code', placeholder: '1400', attrs: 'inputmode="numeric" maxlength="4"' })}
          </div>
        </fieldset>
        <fieldset><legend>Password</legend>
          ${passwordField('password', 'Password', 'new-password', PW_HINT)}
          ${passwordField('confirm', 'Confirm password', 'new-password')}
        </fieldset>
        <fieldset class="field"><legend>Send my verification code by</legend>
          <label class="radio"><input type="radio" name="channel" value="mobile" checked> SMS to my mobile number</label>
          <label class="radio"><input type="radio" name="channel" value="email"> Email</label>
        </fieldset>
        <button class="btn btn-primary btn-block" type="submit">Register</button>
        <p class="center small">Already have an account? <a href="#/login">Log in</a></p>
      </form>`
    );
  }
  function bindRegister() {
    const form = $('#registerForm');
    if (!form) return bindOtp('register');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      busy(form, true);
      const res = await M.Auth.startRegistration(formData(form));
      busy(form, false);
      if (!res.ok) return showErrors(form, res.errors, res.error || (res.errors ? 'Please correct the highlighted fields.' : ''));
      toast(`Verification code sent to ${res.maskedTo}.`, 'success');
      render();
    });
  }

  // Shared OTP entry step (registration and password recovery).
  function viewOtp(kind, channel, maskedTo, otp) {
    const title = kind === 'register' ? 'Verify your account' : 'Enter your reset code';
    return authShell(
      title,
      `We sent a ${CFG.security.otpLength}-digit code by ${channel === 'email' ? 'email' : 'SMS'} to <strong>${esc(maskedTo)}</strong>.`,
      `<form id="otpForm" novalidate>
        <p class="form-alert" role="alert" hidden></p>
        ${field('code', 'One-time code', { autocomplete: 'one-time-code', attrs: `inputmode="numeric" maxlength="${CFG.security.otpLength}" class="otp"` })}
        <p class="small muted" id="otpTimer" data-expires="${otp ? otp.expiresAt : 0}"></p>
        <button class="btn btn-primary btn-block" type="submit">Verify</button>
        <p class="center small"><button type="button" class="link" id="resendBtn" data-resend-at="${otp ? otp.resendAt : 0}">Resend code</button>
        · <button type="button" class="link" id="otpBack">${kind === 'register' ? 'Edit details' : 'Use a different account'}</button></p>
      </form>`
    );
  }
  let timer = null;
  function startOtpTimers() {
    clearInterval(timer);
    const tick = () => {
      const t = $('#otpTimer');
      const r = $('#resendBtn');
      if (!t) return clearInterval(timer);
      const left = Math.max(0, Math.round((+t.dataset.expires - Date.now()) / 1000));
      t.textContent = left > 0 ? `Code expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'This code has expired. Request a new one.';
      const wait = Math.max(0, Math.round((+r.dataset.resendAt - Date.now()) / 1000));
      r.disabled = wait > 0;
      r.textContent = wait > 0 ? `Resend code in ${wait}s` : 'Resend code';
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  function bindOtp(kind) {
    const form = $('#otpForm');
    if (!form) return;
    startOtpTimers();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = form.elements.code.value;
      if (!/^\d+$/.test(code)) return showErrors(form, { code: 'Enter the numeric code we sent you.' });
      busy(form, true);
      const res = kind === 'register' ? await M.Auth.completeRegistration(code) : M.Auth.verifyRecovery(code);
      busy(form, false);
      if (!res.ok) return showErrors(form, {}, res.error);
      if (kind === 'register') {
        toast('Your account is verified. You can now log in.', 'success');
        go('#/login');
      } else {
        render();
      }
    });
    $('#resendBtn').addEventListener('click', () => {
      const res = kind === 'register' ? M.Auth.resendRegistrationOtp() : M.Auth.resendRecovery();
      if (res.ok === false && res.waitSeconds) return toast(`Please wait ${res.waitSeconds}s before requesting a new code.`);
      if (res.ok === false) return showErrors(form, {}, res.error);
      toast('A new code has been sent.', 'success');
      render();
    });
    $('#otpBack').addEventListener('click', () => {
      localStorage.removeItem('merchander.' + (kind === 'register' ? 'pendingRegistration' : 'recovery'));
      render();
    });
  }

  function viewForgot() {
    const st = M.Auth.recoveryState();
    if (st && st.verified) {
      return authShell(
        'Set a new password',
        'Your code was verified. Choose a new password for your account.',
        `<form id="resetForm" novalidate>
          <p class="form-alert" role="alert" hidden></p>
          ${passwordField('password', 'New password', 'new-password', PW_HINT)}
          ${passwordField('confirm', 'Confirm new password', 'new-password')}
          <button class="btn btn-primary btn-block" type="submit">Save new password</button>
        </form>`
      );
    }
    if (st) {
      const channel = st.key.includes('@') ? 'email' : 'mobile';
      const masked = channel === 'email' ? st.key.slice(0, 2) + '•••@' + st.key.split('@')[1] : st.key.slice(0, 4) + '•••' + st.key.slice(-3);
      return viewOtp('recover', channel, masked, st.otp || { expiresAt: Date.now() + CFG.security.otpTtlSeconds * 1000, resendAt: Date.now() + CFG.security.otpResendWaitSeconds * 1000 });
    }
    return authShell(
      'Recover your password',
      'Enter the email address or mobile number registered to your account and we will send a one-time code.',
      `<form id="forgotForm" novalidate>
        <p class="form-alert" role="alert" hidden></p>
        ${field('identifier', 'Email or mobile number', { autocomplete: 'username' })}
        <button class="btn btn-primary btn-block" type="submit">Send code</button>
        <p class="center small"><a href="#/login">Back to log in</a></p>
      </form>`
    );
  }
  function bindForgot() {
    const f = $('#forgotForm');
    if (f) {
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const res = M.Auth.requestRecovery(f.elements.identifier.value);
        if (!res.ok) return showErrors(f, res.waitSeconds ? {} : { identifier: res.error }, res.waitSeconds ? `Please wait ${res.waitSeconds}s before requesting a new code.` : '');
        toast('If an account matches, a code has been sent.', 'success');
        render();
      });
      return;
    }
    const r = $('#resetForm');
    if (r) {
      r.addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = formData(r);
        busy(r, true);
        const res = await M.Auth.resetPassword(d.password, d.confirm);
        busy(r, false);
        if (!res.ok) {
          if (res.error) {
            localStorage.removeItem('merchander.recovery');
            toast(res.error, 'error');
            return render();
          }
          return showErrors(r, res.errors);
        }
        toast('Your password has been reset. Please log in.', 'success');
        go('#/login');
      });
      return;
    }
    bindOtp('recover');
  }

  // ---------- dashboards (role-based) ----------
  const ROADMAP = {
    customer: [
      ['Search & filter products', 2],
      ['Shopping cart', 2],
      ['Place orders & choose payment', 3],
      ['Track order status', 3],
      ['Order history, reorder & invoices', 4],
      ['Chat FAQ', 5],
    ],
    employee: [
      ['Product records & inventory', 2],
      ['Stock-in / stock-out & supplier purchases', 2],
      ['Approve orders & verify payments', 3],
      ['Walk-in sales', 3],
      ['Assign deliveries & low-stock alerts', 4],
      ['QR attendance', 5],
    ],
    delivery: [
      ['Assigned deliveries', 4],
      ['Update & confirm deliveries', 4],
      ['Commission dashboard', 5],
      ['QR attendance', 5],
    ],
    owner: [
      ['Staff accounts & permissions', 5],
      ['Sales dashboard & analytics', 4],
      ['Reports, income & expenses', 4],
      ['Attendance & commissions', 5],
      ['Chat FAQ entries', 5],
      ['Settings, backups & activity logs', 6],
    ],
  };
  function viewDashboard() {
    const me = M.currentUser();
    const products = M.Catalog.products();
    const count = (k) => products.filter((p) => p.status.key === k).length;
    const stockSummary = `<div class="stats">
        <div class="stat"><span>${products.length}</span>Products listed</div>
        <div class="stat"><span>${count('in')}</span>In stock</div>
        <div class="stat warn"><span>${count('low')}</span>Low stock</div>
        <div class="stat bad"><span>${count('out')}</span>Out of stock</div>
      </div>`;
    const lowList = products.filter((p) => p.status.key !== 'in');
    let main = '';
    if (me.role === 'customer') {
      const a = me.address || {};
      main = `<div class="info-grid">
        <div class="card"><h3>Your store</h3><p><strong>${esc(me.businessName)}</strong><br>${esc(me.firstName + ' ' + me.lastName)}</p>
          <p class="muted small">${esc([a.line, a.barangay, a.city, a.province, a.postal].filter(Boolean).join(', '))}</p>
          <a href="#/account" class="btn btn-ghost">Edit profile</a></div>
        <div class="card"><h3>Start shopping</h3><p>See today's prices per case and half-case and what's in stock.</p><a href="#/catalog" class="btn btn-primary">Browse catalog</a></div>
        <div class="card"><h3>Need help?</h3><p>Call <a href="tel:${esc(BIZ.mobile.replace(/\s/g, ''))}">${esc(BIZ.mobile)}</a> or email <a href="mailto:${esc(BIZ.email)}">${esc(BIZ.email)}</a>.</p></div>
      </div>`;
    } else {
      main = `${stockSummary}
        <div class="card"><h3>Items needing attention</h3>
          ${lowList.length ? `<table class="table"><thead><tr><th>Product</th><th>Cases</th><th>Status</th></tr></thead><tbody>${lowList.map((p) => `<tr><td><a href="#/product/${p.id}">${esc(p.name)}</a></td><td>${p.stock}</td><td><span class="badge badge-${p.status.key}">${p.status.label}</span></td></tr>`).join('')}</tbody></table>` : '<p class="muted">All products are well stocked.</p>'}
        </div>`;
    }
    return `
      <div class="page-head">
        <p class="eyebrow">${ROLE_LABEL[me.role]} dashboard</p>
        <h1>Good day, ${esc(me.firstName)}!</h1>
      </div>
      ${main}
      <section class="section">
        <h2>Coming soon to your dashboard</h2>
        <ul class="roadmap">${ROADMAP[me.role].map(([t, s]) => `<li><span>${esc(t)}</span><span class="badge">Sprint ${s}</span></li>`).join('')}</ul>
      </section>`;
  }

  // ---------- my account ----------
  function viewAccount() {
    const me = M.currentUser();
    const a = me.address || {};
    const theme = M.Theme.get();
    return `
      <div class="page-head"><p class="eyebrow">${ROLE_LABEL[me.role]}</p><h1>My Account</h1></div>
      <div class="account-grid">
        <form class="card" id="profileForm" novalidate>
          <h2>Profile</h2>
          <p class="form-alert" role="alert" hidden></p>
          ${me.role === 'customer' ? field('businessName', 'Business / store name', { value: me.businessName }) : ''}
          <div class="grid-2">${field('firstName', 'First name', { value: me.firstName })}${field('lastName', 'Last name', { value: me.lastName })}</div>
          ${
            me.role === 'customer'
              ? `<h3>Delivery address</h3>
            ${field('line', 'House / unit, street', { value: a.line })}
            <div class="grid-2">${field('barangay', 'Barangay', { value: a.barangay })}${field('city', 'City / municipality', { value: a.city })}</div>
            <div class="grid-2">${field('province', 'Province / region', { value: a.province })}${field('postal', 'Postal code', { value: a.postal, attrs: 'inputmode="numeric" maxlength="4"' })}</div>
            <p class="hint">New orders will default to this address.</p>`
              : ''
          }
          <button class="btn btn-primary" type="submit">Save changes</button>
        </form>

        <div class="stack">
          <div class="card">
            <h2>Login details</h2>
            <div class="contact-row"><div><span class="muted small">Email</span><br><strong>${esc(me.email)}</strong> ${me.emailVerified ? '<span class="badge badge-in">Verified</span>' : ''}</div><button class="btn btn-ghost" data-change="email">Change</button></div>
            <div class="contact-row"><div><span class="muted small">Mobile</span><br><strong>${esc(me.mobile)}</strong> ${me.mobileVerified ? '<span class="badge badge-in">Verified</span>' : ''}</div><button class="btn btn-ghost" data-change="mobile">Change</button></div>
            <div id="contactChange"></div>
            <div class="contact-row"><div><span class="muted small">Google sign-in</span><br><strong>${me.googleLinked ? 'Linked' : 'Not linked'}</strong></div><button class="btn btn-ghost" data-action="toggle-google">${me.googleLinked ? 'Unlink' : 'Link Google'}</button></div>
          </div>

          <form class="card" id="passwordForm" novalidate>
            <h2>Change password</h2>
            <p class="form-alert" role="alert" hidden></p>
            ${passwordField('current', 'Current password', 'current-password')}
            ${passwordField('next', 'New password', 'new-password', PW_HINT)}
            ${passwordField('confirmNext', 'Confirm new password', 'new-password')}
            <button class="btn btn-primary" type="submit">Update password</button>
          </form>

          <div class="card">
            <h2>Display</h2>
            <p class="muted small">Your choice is saved to your account and kept the next time you log in.</p>
            <div class="seg" role="radiogroup" aria-label="Theme">
              <label><input type="radio" name="theme" value="light" ${theme === 'light' ? 'checked' : ''}> Light</label>
              <label><input type="radio" name="theme" value="dark" ${theme === 'dark' ? 'checked' : ''}> Dark</label>
            </div>
          </div>
        </div>
      </div>`;
  }
  function bindAccount() {
    const pf = $('#profileForm');
    pf.addEventListener('submit', (e) => {
      e.preventDefault();
      const res = M.Profile.update(formData(pf));
      if (!res.ok) return showErrors(pf, res.errors, res.error || 'Please correct the highlighted fields.');
      showErrors(pf);
      toast('Your profile has been updated.', 'success');
      renderHeader();
    });

    const pw = $('#passwordForm');
    pw.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(pw);
      busy(pw, true);
      const res = await M.Profile.changePassword(d.current, d.next, d.confirmNext);
      busy(pw, false);
      if (!res.ok) return showErrors(pw, res.errors, res.error);
      showErrors(pw);
      pw.reset();
      toast('Your password has been changed.', 'success');
    });

    $$('input[name=theme]').forEach((r) =>
      r.addEventListener('change', () => {
        M.Theme.set(r.value);
        renderHeader();
        toast(`${r.value === 'dark' ? 'Dark' : 'Light'} theme saved.`, 'success');
      })
    );

    $$('[data-change]').forEach((b) => b.addEventListener('click', () => showContactChange(b.dataset.change)));
    $('[data-action=toggle-google]').addEventListener('click', () => {
      const me = M.currentUser();
      M.Profile.setGoogleLinked(!me.googleLinked);
      toast(me.googleLinked ? 'Google sign-in unlinked.' : `Google sign-in linked to ${me.email}.`, 'success');
      render();
    });
  }
  function showContactChange(fieldName) {
    const box = $('#contactChange');
    const label = fieldName === 'email' ? 'email address' : 'mobile number';
    box.innerHTML = `<form class="inline-form" id="ccForm" novalidate>
        <p class="form-alert" role="alert" hidden></p>
        ${field('value', 'New ' + label, { type: fieldName === 'email' ? 'email' : 'tel', hint: 'We will send a one-time code to the new ' + label + ' to confirm it.' })}
        <div class="row"><button class="btn btn-primary" type="submit">Send code</button><button class="btn btn-ghost" type="button" data-cancel>Cancel</button></div>
      </form>`;
    const f = $('#ccForm');
    f.elements.value.focus();
    $('[data-cancel]', f).addEventListener('click', () => {
      M.Profile.cancelContactChange();
      box.innerHTML = '';
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const res = M.Profile.requestContactChange(fieldName, f.elements.value.value);
      if (!res.ok) return showErrors(f, res.waitSeconds ? {} : { value: res.error }, res.waitSeconds ? `Please wait ${res.waitSeconds}s before requesting a new code.` : '');
      box.innerHTML = `<form class="inline-form" id="ccVerify" novalidate>
          <p class="form-alert" role="alert" hidden></p>
          ${field('code', `Code sent to ${res.maskedTo}`, { autocomplete: 'one-time-code', attrs: `inputmode="numeric" maxlength="${CFG.security.otpLength}" class="otp"` })}
          <div class="row"><button class="btn btn-primary" type="submit">Verify &amp; save</button><button class="btn btn-ghost" type="button" data-cancel>Cancel</button></div>
        </form>`;
      const v = $('#ccVerify');
      v.elements.code.focus();
      $('[data-cancel]', v).addEventListener('click', () => {
        M.Profile.cancelContactChange();
        box.innerHTML = '';
      });
      v.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const r = M.Profile.confirmContactChange(v.elements.code.value);
        if (!r.ok) return showErrors(v, {}, r.error);
        toast(`Your ${label} has been updated and verified.`, 'success');
        render();
      });
    });
  }

  // ---------- router ----------
  function route() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    return { path, query: new URLSearchParams(qs || '') };
  }
  const ROUTES = [
    { re: /^\/$/, title: 'Welcome', view: viewWelcome },
    { re: /^\/catalog$/, title: 'Product Catalog', view: (m, q) => viewCatalog(q) },
    { re: /^\/product\/([\w-]+)$/, title: 'Product', view: (m) => viewProduct(m[1]) },
    { re: /^\/login$/, title: 'Log in', guest: true, view: (m, q) => viewLogin(q), bind: (m, q) => bindLogin(q) },
    { re: /^\/register$/, title: 'Create account', guest: true, view: viewRegister, bind: bindRegister },
    { re: /^\/forgot$/, title: 'Recover password', guest: true, view: viewForgot, bind: bindForgot },
    { re: /^\/dashboard$/, title: 'Dashboard', auth: true, view: viewDashboard },
    { re: /^\/account$/, title: 'My Account', auth: true, view: viewAccount, bind: bindAccount },
  ];

  function render() {
    clearInterval(timer);
    const { path, query } = route();
    const me = M.currentUser();
    let r = null;
    let m = null;
    for (const x of ROUTES) {
      m = path.match(x.re);
      if (m) {
        r = x;
        break;
      }
    }
    if (!r) {
      app.innerHTML = `<p class="empty">Page not found. <a href="#/">Go home</a></p>`;
      return renderHeader();
    }
    if (r.auth && !me) return go('#/login?next=' + encodeURIComponent(path));
    if (r.guest && me) return go('#/dashboard');
    document.title = `${r.title} · Merchander – ${BIZ.shortName}`;
    app.innerHTML = r.view(m, query);
    if (r.bind) r.bind(m, query);
    renderHeader();
    app.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  // ---------- global events ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action], [data-toggle-pw]');
    if (!t) return;
    if (t.dataset.togglePw) {
      const input = document.getElementById(t.dataset.togglePw);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      t.textContent = show ? 'Hide' : 'Show';
      t.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      return;
    }
    switch (t.dataset.action) {
      case 'logout':
        M.Auth.logout();
        M.Theme.apply();
        toast('You have been logged out.');
        go('#/');
        break;
      case 'google':
        openGoogleChooser();
        break;
      case 'add-to-cart':
        toast('The shopping cart is coming in the next release (Sprint 2).');
        break;
    }
  });
  $('#themeToggle').addEventListener('click', () => {
    M.Theme.set(M.Theme.get() === 'dark' ? 'light' : 'dark');
    renderHeader();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal').hidden) $('#modal').hidden = true;
  });

  // Simulated SMS/email inbox so one-time codes can be read during testing.
  M.onMessage((msg) => {
    const box = $('#inbox');
    const item = document.createElement('div');
    item.className = 'sms';
    item.innerHTML = `<p class="small muted">${msg.channel === 'email' ? '✉ Email' : '💬 SMS'} to ${esc(msg.to)} · demo gateway</p><p>${esc(msg.text)}</p><button class="link small" aria-label="Dismiss message">Dismiss</button>`;
    $('button', item).addEventListener('click', () => item.remove());
    box.prepend(item);
    setTimeout(() => item.remove(), 60000);
  });
  $('#resetDemo').addEventListener('click', async () => {
    if (!confirm('Reset all demo data (accounts, sessions, and settings) in this browser?')) return;
    M.resetDemo();
    location.hash = '#/';
    location.reload();
  });

  window.addEventListener('hashchange', render);
  M.ready.then(() => {
    M.Theme.apply();
    render();
  });
})();
