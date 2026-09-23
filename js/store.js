/*
 * Merchander – data and authentication services (Sprint 1).
 *
 * This prototype has no server yet, so records live in the browser's
 * localStorage. Every function is async and returns plain objects so the
 * layer can later be swapped for real API calls (PHP/MySQL) without changing
 * the views.
 */
(function () {
  const CFG = window.MERCHANDER_CONFIG;
  const SEC = CFG.security;
  const NS = 'merchander.';
  const SEED_VERSION = 1;

  // ---------- storage helpers ----------
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- hashing ----------
  function randomHex(bytes) {
    const a = new Uint8Array(bytes);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function hashPassword(password, salt) {
    const data = new TextEncoder().encode(salt + ':' + password);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ---------- validation ----------
  const Validate = {
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v),
    mobile: (v) => /^(09|\+639)\d{9}$/.test(normalizeMobile(v)),
    postal: (v) => /^\d{4}$/.test(v),
    passwordIssues(pw) {
      const issues = [];
      if (pw.length < 8) issues.push('at least 8 characters');
      if (!/[A-Z]/.test(pw)) issues.push('an uppercase letter');
      if (!/[a-z]/.test(pw)) issues.push('a lowercase letter');
      if (!/\d/.test(pw)) issues.push('a number');
      if (!/[^A-Za-z0-9]/.test(pw)) issues.push('a symbol');
      return issues;
    },
  };
  function normalizeMobile(v) {
    return String(v || '').replace(/[\s-]/g, '');
  }
  function normalizeEmail(v) {
    return String(v || '').trim().toLowerCase();
  }
  function maskContact(channel, value) {
    if (channel === 'email') {
      const [u, d] = value.split('@');
      return u.slice(0, 2) + '•••@' + d;
    }
    return value.slice(0, 4) + '•••' + value.slice(-3);
  }

  // ---------- users ----------
  function users() {
    return read('users', []);
  }
  function saveUsers(list) {
    return write('users', list);
  }
  function publicUser(u) {
    if (!u) return null;
    const { passwordHash, salt, ...rest } = u;
    return rest;
  }
  function findByIdentifier(identifier) {
    const id = String(identifier || '').trim();
    const email = normalizeEmail(id);
    const mobile = normalizeMobile(id);
    return users().find((u) => u.email === email || u.mobile === mobile) || null;
  }

  async function seed() {
    if (read('seedVersion', 0) >= SEED_VERSION) return;
    const list = [];
    for (const s of CFG.seedUsers) {
      const salt = randomHex(16);
      list.push({
        id: 'U' + String(list.length + 1).padStart(4, '0'),
        role: s.role,
        status: s.status || 'active',
        email: s.email,
        mobile: s.mobile,
        emailVerified: true,
        mobileVerified: true,
        googleLinked: !!s.googleLinked,
        salt,
        passwordHash: await hashPassword(s.password, salt),
        firstName: s.firstName,
        lastName: s.lastName,
        businessName: s.businessName || '',
        address: s.address || null,
        prefs: { theme: 'light' },
        createdAt: new Date().toISOString(),
      });
    }
    saveUsers(list);
    write('seedVersion', SEED_VERSION);
  }

  // ---------- simulated SMS / email gateway ----------
  // Real deployments would call an SMS/email provider here. The prototype
  // delivers the message to an on-screen "inbox" so the flow can be tested.
  const gatewayListeners = [];
  function sendMessage(channel, to, text) {
    const msg = { channel, to, text, at: Date.now() };
    const inbox = read('inbox', []);
    inbox.unshift(msg);
    write('inbox', inbox.slice(0, 20));
    gatewayListeners.forEach((fn) => fn(msg));
    return msg;
  }

  // ---------- one-time passwords ----------
  function otps() {
    return read('otps', {});
  }
  function issueOtp(purpose, key, channel, to) {
    const all = otps();
    const now = Date.now();
    const existing = all[purpose + ':' + key];
    if (existing && now < existing.resendAt) {
      return { ok: false, waitSeconds: Math.ceil((existing.resendAt - now) / 1000) };
    }
    let code = '';
    for (let i = 0; i < SEC.otpLength; i++) code += Math.floor(Math.random() * 10);
    all[purpose + ':' + key] = {
      code,
      channel,
      to,
      expiresAt: now + SEC.otpTtlSeconds * 1000,
      resendAt: now + SEC.otpResendWaitSeconds * 1000,
      tries: 0,
    };
    write('otps', all);
    const label = { register: 'account verification', recover: 'password reset', contact: 'contact change' }[purpose];
    sendMessage(channel, to, `Your Merchander ${label} code is ${code}. It expires in ${SEC.otpTtlSeconds / 60} minutes. Do not share this code.`);
    return { ok: true, maskedTo: maskContact(channel, to), expiresAt: all[purpose + ':' + key].expiresAt, resendAt: all[purpose + ':' + key].resendAt };
  }
  function checkOtp(purpose, key, code) {
    const all = otps();
    const rec = all[purpose + ':' + key];
    if (!rec) return { ok: false, error: 'No code has been sent. Please request a new code.' };
    if (Date.now() > rec.expiresAt) return { ok: false, error: 'This code has expired. Please request a new code.' };
    if (rec.tries >= SEC.otpMaxTries) return { ok: false, error: 'Too many incorrect attempts. Please request a new code.' };
    if (String(code).trim() !== rec.code) {
      rec.tries++;
      write('otps', all);
      return { ok: false, error: 'The code you entered is incorrect.' };
    }
    delete all[purpose + ':' + key];
    write('otps', all);
    return { ok: true };
  }
  function otpState(purpose, key) {
    return otps()[purpose + ':' + key] || null;
  }

  // ---------- session ----------
  function currentUser() {
    const s = read('session', null);
    if (!s) return null;
    const u = users().find((x) => x.id === s.userId);
    if (!u || u.status !== 'active') {
      write('session', null);
      return null;
    }
    return publicUser(u);
  }
  function startSession(u) {
    write('session', { userId: u.id, startedAt: Date.now() });
    const attempts = read('attempts', {});
    delete attempts[u.id];
    write('attempts', attempts);
    return publicUser(u);
  }

  // ---------- auth use cases ----------
  const Auth = {
    // Register Account: validate, check duplicates, send OTP, then activate.
    async startRegistration(form) {
      const errors = {};
      const email = normalizeEmail(form.email);
      const mobile = normalizeMobile(form.mobile);
      const required = ['businessName', 'firstName', 'lastName', 'mobile', 'email', 'line', 'barangay', 'city', 'province', 'postal', 'password', 'confirm'];
      required.forEach((f) => {
        if (!String(form[f] || '').trim()) errors[f] = 'This field is required.';
      });
      if (!errors.email && !Validate.email(email)) errors.email = 'Enter a valid email address.';
      if (!errors.mobile && !Validate.mobile(mobile)) errors.mobile = 'Enter a valid PH mobile number, e.g. 09171234567.';
      if (!errors.postal && !Validate.postal(form.postal)) errors.postal = 'Postal code must be 4 digits.';
      const pwIssues = Validate.passwordIssues(form.password || '');
      if (!errors.password && pwIssues.length) errors.password = 'Password must contain ' + pwIssues.join(', ') + '.';
      if (!errors.confirm && form.password !== form.confirm) errors.confirm = 'Passwords do not match.';
      if (!form.channel) errors.channel = 'Choose where to receive your code.';
      if (Object.keys(errors).length) return { ok: false, errors };

      const list = users();
      if (list.some((u) => u.email === email || u.mobile === mobile)) {
        return { ok: false, error: 'This email or mobile number is already registered. Please log in or recover your account.' };
      }

      const salt = randomHex(16);
      const pending = {
        role: 'customer',
        status: 'active',
        email,
        mobile,
        emailVerified: form.channel === 'email',
        mobileVerified: form.channel === 'mobile',
        googleLinked: false,
        salt,
        passwordHash: await hashPassword(form.password, salt),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        businessName: form.businessName.trim(),
        address: {
          line: form.line.trim(),
          barangay: form.barangay.trim(),
          city: form.city.trim(),
          province: form.province.trim(),
          postal: form.postal.trim(),
        },
        prefs: { theme: read('theme', 'light') },
      };
      write('pendingRegistration', pending);
      const to = form.channel === 'email' ? email : mobile;
      const sent = issueOtp('register', to, form.channel, to);
      return { ok: true, ...sent, key: to };
    },

    resendRegistrationOtp() {
      const p = read('pendingRegistration', null);
      if (!p) return { ok: false, error: 'Your registration session has expired. Please start again.' };
      const channel = p.emailVerified ? 'email' : 'mobile';
      const to = channel === 'email' ? p.email : p.mobile;
      return issueOtp('register', to, channel, to);
    },

    async completeRegistration(code) {
      const p = read('pendingRegistration', null);
      if (!p) return { ok: false, error: 'Your registration session has expired. Please start again.' };
      const key = p.emailVerified ? p.email : p.mobile;
      const res = checkOtp('register', key, code);
      if (!res.ok) return res;
      const list = users();
      if (list.some((u) => u.email === p.email || u.mobile === p.mobile)) {
        return { ok: false, error: 'This email or mobile number is already registered. Please log in or recover your account.' };
      }
      p.id = 'U' + String(list.length + 1).padStart(4, '0') + randomHex(2);
      p.createdAt = new Date().toISOString();
      list.push(p);
      if (!saveUsers(list)) return { ok: false, error: 'Your account could not be saved. Please try again.' };
      write('pendingRegistration', null);
      return { ok: true };
    },

    pendingRegistration() {
      const p = read('pendingRegistration', null);
      if (!p) return null;
      const channel = p.emailVerified ? 'email' : 'mobile';
      const to = channel === 'email' ? p.email : p.mobile;
      return { channel, maskedTo: maskContact(channel, to), otp: otpState('register', to) };
    },

    // Log In: validate format, check credentials, apply lockout, start session.
    async login(identifier, password) {
      const id = String(identifier || '').trim();
      if (!id || !password) return { ok: false, error: 'Enter your email or mobile number and password.' };
      if (!Validate.email(normalizeEmail(id)) && !Validate.mobile(id)) {
        return { ok: false, error: 'Enter a valid email address or mobile number.' };
      }
      const generic = 'Incorrect email or password. Please try again.';
      const u = findByIdentifier(id);
      if (!u) return { ok: false, error: generic };

      const attempts = read('attempts', {});
      const a = attempts[u.id] || { count: 0, lockedUntil: 0 };
      if (a.lockedUntil > Date.now()) {
        const mins = Math.ceil((a.lockedUntil - Date.now()) / 60000);
        return { ok: false, locked: true, error: `Too many failed attempts. This account is locked for ${mins} more minute(s). You can reset your password to regain access.` };
      }
      const hash = await hashPassword(password, u.salt);
      if (hash !== u.passwordHash) {
        a.count = (a.lockedUntil && a.lockedUntil <= Date.now() ? 0 : a.count) + 1;
        a.lockedUntil = 0;
        if (a.count >= SEC.maxLoginAttempts) {
          a.lockedUntil = Date.now() + SEC.lockMinutes * 60000;
          a.count = 0;
          attempts[u.id] = a;
          write('attempts', attempts);
          return { ok: false, locked: true, error: `Too many failed attempts. This account is locked for ${SEC.lockMinutes} minutes. You can reset your password to regain access.` };
        }
        attempts[u.id] = a;
        write('attempts', attempts);
        return { ok: false, error: generic };
      }
      if (u.status !== 'active') return { ok: false, error: 'This account is inactive. Please contact the administrator.' };
      return { ok: true, user: startSession(u) };
    },

    // Google sign-in (simulated identity provider): only a linked account may sign in.
    googleAccounts() {
      return users()
        .filter((u) => u.googleLinked)
        .map((u) => ({ email: u.email, name: u.firstName + ' ' + u.lastName }));
    },
    async loginWithGoogle(googleEmail) {
      const email = normalizeEmail(googleEmail);
      if (!Validate.email(email)) return { ok: false, error: 'Google sign-in was cancelled or failed.' };
      const u = users().find((x) => x.email === email);
      if (!u || !u.googleLinked) {
        return { ok: false, error: 'No Merchander account is linked to this Google account. Log in with your password and link Google from My Account, or register first.' };
      }
      if (u.status !== 'active') return { ok: false, error: 'This account is inactive. Please contact the administrator.' };
      return { ok: true, user: startSession(u) };
    },

    logout() {
      write('session', null);
    },

    // Recover Password: send code, verify, then set a new password.
    requestRecovery(identifier) {
      const id = String(identifier || '').trim();
      if (!Validate.email(normalizeEmail(id)) && !Validate.mobile(id)) {
        return { ok: false, error: 'Enter a valid email address or mobile number.' };
      }
      const u = findByIdentifier(id);
      const isEmail = Validate.email(normalizeEmail(id));
      const channel = isEmail ? 'email' : 'mobile';
      const to = isEmail ? normalizeEmail(id) : normalizeMobile(id);
      write('recovery', { key: to, userId: u ? u.id : null, verified: false });
      if (!u) {
        // Do not reveal whether an account exists.
        return { ok: true, maskedTo: maskContact(channel, to) };
      }
      return issueOtp('recover', to, channel, to);
    },
    resendRecovery() {
      const r = read('recovery', null);
      if (!r) return { ok: false, error: 'Please start the recovery again.' };
      if (!r.userId) return { ok: true };
      const channel = r.key.includes('@') ? 'email' : 'mobile';
      return issueOtp('recover', r.key, channel, r.key);
    },
    verifyRecovery(code) {
      const r = read('recovery', null);
      if (!r) return { ok: false, error: 'Please start the recovery again.' };
      if (!r.userId) return { ok: false, error: 'The code you entered is incorrect.' };
      const res = checkOtp('recover', r.key, code);
      if (!res.ok) return res;
      r.verified = true;
      r.verifiedAt = Date.now();
      write('recovery', r);
      return { ok: true };
    },
    recoveryState() {
      const r = read('recovery', null);
      if (!r) return null;
      return { verified: !!r.verified, key: r.key, otp: otpState('recover', r.key) };
    },
    async resetPassword(password, confirm) {
      const r = read('recovery', null);
      if (!r || !r.verified || Date.now() - r.verifiedAt > SEC.otpTtlSeconds * 1000) {
        return { ok: false, error: 'Please verify your code before setting a new password.' };
      }
      const issues = Validate.passwordIssues(password || '');
      if (issues.length) return { ok: false, errors: { password: 'Password must contain ' + issues.join(', ') + '.' } };
      if (password !== confirm) return { ok: false, errors: { confirm: 'Passwords do not match.' } };
      const list = users();
      const u = list.find((x) => x.id === r.userId);
      u.salt = randomHex(16);
      u.passwordHash = await hashPassword(password, u.salt);
      saveUsers(list);
      const attempts = read('attempts', {});
      delete attempts[u.id];
      write('attempts', attempts);
      write('recovery', null);
      return { ok: true };
    },
  };

  // ---------- profile use cases ----------
  const Profile = {
    update(changes) {
      const me = currentUser();
      if (!me) return { ok: false, error: 'Your session has ended. Please log in again.' };
      const errors = {};
      const req = ['firstName', 'lastName'];
      if (me.role === 'customer') req.push('businessName', 'line', 'barangay', 'city', 'province', 'postal');
      req.forEach((f) => {
        if (!String(changes[f] || '').trim()) errors[f] = 'This field is required.';
      });
      if (me.role === 'customer' && !errors.postal && !Validate.postal(changes.postal)) errors.postal = 'Postal code must be 4 digits.';
      if (Object.keys(errors).length) return { ok: false, errors };
      const list = users();
      const u = list.find((x) => x.id === me.id);
      u.firstName = changes.firstName.trim();
      u.lastName = changes.lastName.trim();
      if (me.role === 'customer') {
        u.businessName = changes.businessName.trim();
        u.address = {
          line: changes.line.trim(),
          barangay: changes.barangay.trim(),
          city: changes.city.trim(),
          province: changes.province.trim(),
          postal: changes.postal.trim(),
        };
      }
      if (!saveUsers(list)) return { ok: false, error: 'Changes could not be saved. Please try again.' };
      return { ok: true };
    },

    // Changing the registered email/mobile requires an OTP sent to the NEW contact.
    requestContactChange(field, value) {
      const me = currentUser();
      if (!me) return { ok: false, error: 'Your session has ended. Please log in again.' };
      const v = field === 'email' ? normalizeEmail(value) : normalizeMobile(value);
      if (field === 'email' && !Validate.email(v)) return { ok: false, error: 'Enter a valid email address.' };
      if (field === 'mobile' && !Validate.mobile(v)) return { ok: false, error: 'Enter a valid PH mobile number, e.g. 09171234567.' };
      if (v === me[field]) return { ok: false, error: 'This is already your registered ' + (field === 'email' ? 'email.' : 'mobile number.') };
      if (users().some((u) => u.id !== me.id && (u.email === v || u.mobile === v))) {
        return { ok: false, error: 'This email or mobile number is already registered to another account.' };
      }
      write('contactChange', { userId: me.id, field, value: v });
      return issueOtp('contact', me.id + ':' + field, field, v);
    },
    confirmContactChange(code) {
      const c = read('contactChange', null);
      if (!c) return { ok: false, error: 'Please request a new code.' };
      const res = checkOtp('contact', c.userId + ':' + c.field, code);
      if (!res.ok) return res;
      const list = users();
      const u = list.find((x) => x.id === c.userId);
      u[c.field] = c.value;
      u[c.field + 'Verified'] = true;
      if (!saveUsers(list)) return { ok: false, error: 'Changes could not be saved. Please try again.' };
      write('contactChange', null);
      return { ok: true, field: c.field };
    },
    cancelContactChange() {
      write('contactChange', null);
    },

    async changePassword(current, next, confirm) {
      const me = currentUser();
      if (!me) return { ok: false, error: 'Your session has ended. Please log in again.' };
      const list = users();
      const u = list.find((x) => x.id === me.id);
      if ((await hashPassword(current || '', u.salt)) !== u.passwordHash) return { ok: false, errors: { current: 'Your current password is incorrect.' } };
      const issues = Validate.passwordIssues(next || '');
      if (issues.length) return { ok: false, errors: { next: 'Password must contain ' + issues.join(', ') + '.' } };
      if (next !== confirm) return { ok: false, errors: { confirmNext: 'Passwords do not match.' } };
      u.salt = randomHex(16);
      u.passwordHash = await hashPassword(next, u.salt);
      if (!saveUsers(list)) return { ok: false, error: 'Changes could not be saved. Please try again.' };
      return { ok: true };
    },

    setGoogleLinked(linked) {
      const me = currentUser();
      if (!me) return { ok: false };
      const list = users();
      list.find((x) => x.id === me.id).googleLinked = !!linked;
      saveUsers(list);
      return { ok: true };
    },
  };

  // ---------- display theme ----------
  const Theme = {
    get() {
      const me = currentUser();
      return (me && me.prefs && me.prefs.theme) || read('theme', 'light');
    },
    set(theme) {
      write('theme', theme);
      const me = currentUser();
      if (me) {
        const list = users();
        const u = list.find((x) => x.id === me.id);
        u.prefs = { ...(u.prefs || {}), theme };
        saveUsers(list);
      }
      document.documentElement.dataset.theme = theme;
    },
    apply() {
      document.documentElement.dataset.theme = Theme.get();
    },
  };

  // ---------- catalog ----------
  const Catalog = {
    products() {
      return CFG.products.map((p) => ({ ...p, status: stockStatus(p.stock) }));
    },
    product(id) {
      return Catalog.products().find((p) => p.id === id) || null;
    },
  };
  function stockStatus(stock) {
    if (stock <= 0) return { key: 'out', label: 'Out of Stock' };
    if (stock <= CFG.lowStockCases) return { key: 'low', label: 'Low Stock' };
    return { key: 'in', label: 'In Stock' };
  }

  window.Merchander = {
    ready: seed(),
    Auth,
    Profile,
    Theme,
    Catalog,
    Validate,
    currentUser,
    inbox: () => read('inbox', []),
    onMessage: (fn) => gatewayListeners.push(fn),
    resetDemo() {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(NS))
        .forEach((k) => localStorage.removeItem(k));
    },
  };
})();
