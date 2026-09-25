/* ============================================================================
 *  COSMIC PORTFOLIO — Data Layer
 * ----------------------------------------------------------------------------
 *  ชั้นกลางระหว่างหน้าเว็บกับที่เก็บข้อมูล ทั้ง index.html และ admin.html
 *  เรียกผ่าน window.CosmicDB เหมือนกันหมด โดยไม่ต้องรู้ว่าข้างล่างเป็นอะไร
 *
 *    โหมด CLOUD  — ตั้งค่า supabase-config.js แล้ว -> ใช้ Supabase จริง
 *                  ข้อมูลชุดเดียวกันทุกเครื่อง ทุกคนที่เปิดเว็บเห็นเหมือนกัน
 *
 *    โหมด LOCAL  — ยังไม่ได้ตั้งค่า -> ถอยไปใช้ IndexedDB (LocalForage) แบบเดิม
 *                  เว็บยังเปิดได้ปกติ แต่ข้อมูลอยู่แค่ในเบราว์เซอร์เครื่องนั้น
 * ========================================================================== */

(function () {
  'use strict';

  var cfg = window.COSMIC_SUPABASE_CONFIG || {};
  var BUCKET = cfg.bucket || 'portfolio-media';

  // ตัด path ที่คนมักเผลอคัดลอกมาด้วย (/rest/v1, /auth/v1, /storage/v1) และ / ท้ายสุด
  // supabase-js จะเติม path พวกนี้ให้เองอยู่แล้ว
  var rawUrl = typeof cfg.url === 'string' ? cfg.url.trim() : '';
  rawUrl = rawUrl
    .replace(/\/(rest|auth|storage|realtime|functions)\/v\d+\/?$/i, '')
    .replace(/\/+$/, '');
  if (typeof cfg.url === 'string' && cfg.url.trim().replace(/\/+$/, '') !== rawUrl) {
    console.warn('[CosmicDB] ตัด path ออกจาก Project URL ให้อัตโนมัติ -> ' + rawUrl +
                 ' (ในไฟล์ assets/supabase-config.js ควรใส่แค่ https://xxxxx.supabase.co)');
  }
  var rawKey = typeof cfg.anonKey === 'string' ? cfg.anonKey.trim() : '';

  // อ่าน role ที่ฝังอยู่ใน key แบบเก่า (JWT) เพื่อกันการเผลอใส่ service_role
  function jwtRole(k) {
    try {
      var parts = k.split('.');
      if (parts.length !== 3) return null;
      var pad = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (pad.length % 4) pad += '=';
      return (JSON.parse(atob(pad)) || {}).role || null;
    } catch (e) { return null; }
  }

  // Supabase มี key 2 ยุค ใช้ได้ทั้งคู่:
  //   ยุคใหม่  sb_publishable_xxxxx   (Settings > API Keys)
  //   ยุคเก่า  eyJhbGciOi... (anon)   (Settings > API Keys > Legacy API keys)
  var isPublishable = /^sb_publishable_/.test(rawKey);
  var isLegacyAnon  = /^eyJ/.test(rawKey) && jwtRole(rawKey) !== 'service_role';
  var isSecretKey   = /^sb_secret_/.test(rawKey) || jwtRole(rawKey) === 'service_role';

  var hasUrl  = /^https:\/\/[^\s]+\.[^\s]+/.test(rawUrl);
  var notStub = rawKey.indexOf('PASTE_YOUR') === -1 && rawUrl.indexOf('PASTE_YOUR') === -1;

  if (isSecretKey) {
    console.error(
      '%c[CosmicDB] ⛔ อันตราย: คีย์ที่ใส่ใน supabase-config.js เป็น SECRET / SERVICE_ROLE KEY\n' +
      'คีย์นี้ข้ามระบบสิทธิ์ (RLS) ทุกข้อ ห้ามฝังในหน้าเว็บเด็ดขาด\n' +
      'ให้ไปเอา "Publishable key" (sb_publishable_...) หรือ "anon" key มาใช้แทน\n' +
      'แล้วกด Revoke คีย์ที่หลุดตัวนี้ทิ้งใน Supabase Dashboard ทันที',
      'color:#ff2a85;font-weight:bold'
    );
  }

  var configured = hasUrl && notStub && !isSecretKey && (isPublishable || isLegacyAnon);

  var sb = null;
  if (configured && window.supabase && typeof window.supabase.createClient === 'function') {
    sb = window.supabase.createClient(rawUrl, rawKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  } else if (configured) {
    console.error('[CosmicDB] ตั้งค่า Supabase แล้ว แต่โหลด supabase-js ไม่สำเร็จ — ถอยไปใช้โหมด LOCAL');
    configured = false;
  }

  var CLOUD = !!sb;

  /* -- LocalForage (โหมดสำรอง) --------------------------------------------- */
  if (window.localforage) {
    window.localforage.config({ name: 'KuriyaCosmicDB', storeName: 'portfolio_store' });
  }

  /* -- หมวดหมู่ผลงาน ---------------------------------------------------------
   *  อยากเพิ่ม/แก้/ลบหมวดหมู่ แก้ที่นี่ที่เดียว ทั้งฟอร์มและตัวกรองจะอัปเดตตาม
   *  name = ค่าที่เก็บลงฐานข้อมูลและโชว์บนหน้าเว็บ, th = คำอธิบายในหน้าแอดมิน
   *  หมายเหตุ: ช่องหมวดหมู่พิมพ์ชื่อใหม่เองได้ ไม่จำเป็นต้องมีในรายการนี้
   */
  var CATEGORIES = [
    { name: 'AI & Vision',            th: 'ปัญญาประดิษฐ์ & ตรวจจับภาพ' },
    { name: 'Web Platform',           th: 'เว็บแอปพลิเคชัน' },
    { name: 'Mobile Application',     th: 'แอปมือถือ' },
    { name: 'Desktop Application',    th: 'โปรแกรมบนเครื่อง' },
    { name: 'Database & Backend',     th: 'ฐานข้อมูล & ระบบหลังบ้าน' },
    { name: 'Data & Analytics',       th: 'วิเคราะห์ข้อมูล & Dashboard' },
    { name: 'Algo & Trading',         th: 'บอทเทรด & การเงิน' },
    { name: 'Cybersecurity & Network',th: 'ความมั่นคงปลอดภัย & เครือข่าย' },
    { name: 'IoT & Embedded',         th: 'อุปกรณ์อัจฉริยะ & เซนเซอร์' },
    { name: 'Game & Interactive',     th: 'เกม & สื่อโต้ตอบ' },
    { name: 'Design & Multimedia',    th: 'ออกแบบ & มัลติมีเดีย' },
    { name: 'Tools & Cloud',          th: 'ซอฟต์แวร์ & เครื่องมือ' }
  ];

  var LOCAL_KEY = {
    projects:     'cosmic_projects_store',
    certificates: 'cosmic_certificates_store',
    activities:   'cosmic_activities_store'
  };

  /* -- แปลงชื่อฟิลด์ ระหว่าง JS (camelCase) กับ Postgres (snake_case) ------ */
  var FIELD_MAP = {
    projects:     { demoUrl: 'demo_url', githubUrl: 'github_url', imageUrl: 'image_url' },
    certificates: { imageUrl: 'image_url' },
    activities:   {}
  };

  var COLUMNS = {
    projects:     ['id', 'title', 'category', 'summary', 'tags', 'demo_url', 'github_url', 'image_url', 'sort_order'],
    certificates: ['id', 'title', 'category', 'issuer', 'year', 'description', 'image_url', 'sort_order'],
    activities:   ['id', 'title', 'role', 'location', 'icon', 'description', 'tags', 'images', 'sort_order']
  };

  function toDbRow(table, obj) {
    var map = FIELD_MAP[table] || {};
    var allowed = COLUMNS[table] || [];
    var row = {};
    Object.keys(obj || {}).forEach(function (k) {
      var col = map[k] || k;
      if (allowed.indexOf(col) !== -1) row[col] = obj[k];
    });
    if (Array.isArray(obj.tags))   row.tags   = obj.tags;
    if (Array.isArray(obj.images)) row.images = obj.images;
    return row;
  }

  function fromDbRow(table, row) {
    var map = FIELD_MAP[table] || {};
    var reverse = {};
    Object.keys(map).forEach(function (js) { reverse[map[js]] = js; });

    var obj = {};
    Object.keys(row || {}).forEach(function (col) {
      if (col === 'updated_at') return;   // created_at เก็บไว้ ใช้แสดงวันที่บนหน้าเว็บ
      obj[reverse[col] || col] = row[col];
    });
    if (!Array.isArray(obj.tags))   obj.tags   = obj.tags   ? obj.tags   : [];
    if (table === 'activities' && !Array.isArray(obj.images)) obj.images = obj.images ? obj.images : [];
    return obj;
  }

  function newId(table) {
    var prefix = table === 'projects' ? 'p' : table === 'certificates' ? 'cert' : 'act';
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  }

  /* -- กันการค้างรอไม่รู้จบตอนเน็ตมีปัญหา ---------------------------------- */
  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function (_resolve, reject) {
        setTimeout(function () {
          reject(new Error('หมดเวลารอการเชื่อมต่อฐานข้อมูล (' + label + ')'));
        }, ms);
      })
    ]);
  }

  /* -- อ่านข้อมูล ----------------------------------------------------------- */
  async function list(table) {
    if (CLOUD) {
      var res = await withTimeout(
        sb.from(table).select('*').order('sort_order', { ascending: false }),
        15000, table
      );
      if (res.error) throw res.error;
      return (res.data || []).map(function (r) { return fromDbRow(table, r); });
    }
    var stored = await window.localforage.getItem(LOCAL_KEY[table]);
    return Array.isArray(stored) ? stored : [];
  }

  /* -- เพิ่ม / แก้ไข -------------------------------------------------------- */
  async function save(table, obj) {
    var record = Object.assign({}, obj);
    if (!record.id) record.id = newId(table);

    if (CLOUD) {
      var row = toDbRow(table, record);
      if (row.sort_order === undefined || row.sort_order === null) row.sort_order = Date.now();
      var res = await sb.from(table).upsert(row, { onConflict: 'id' }).select().single();
      if (res.error) throw res.error;
      return fromDbRow(table, res.data);
    }

    var all = await list(table);
    var i = all.findIndex(function (x) { return String(x.id) === String(record.id); });
    if (i === -1) all.unshift(record); else all[i] = Object.assign({}, all[i], record);
    await window.localforage.setItem(LOCAL_KEY[table], all);
    return record;
  }

  /* -- ลบ ------------------------------------------------------------------- */
  async function remove(table, id) {
    if (CLOUD) {
      var res = await sb.from(table).delete().eq('id', String(id));
      if (res.error) throw res.error;
      return true;
    }
    var all = await list(table);
    await window.localforage.setItem(
      LOCAL_KEY[table],
      all.filter(function (x) { return String(x.id) !== String(id); })
    );
    return true;
  }

  /* -- เขียนทับทั้งตาราง (ใช้ตอนนำเข้า/กู้คืนไฟล์สำรอง) --------------------- */
  async function replaceAll(table, items) {
    var arr = Array.isArray(items) ? items : [];

    if (CLOUD) {
      var stamp = Date.now();
      var rows = [];
      for (var i = 0; i < arr.length; i++) {
        var rec = Object.assign({}, arr[i]);
        if (!rec.id) rec.id = newId(table);

        // รูปที่เคยเก็บเป็น base64 ในเครื่อง ย้ายขึ้น Storage ให้อัตโนมัติ
        if (typeof rec.imageUrl === 'string' && rec.imageUrl.indexOf('data:') === 0) {
          rec.imageUrl = await uploadDataUrl(rec.imageUrl, table);
        }
        if (Array.isArray(rec.images)) {
          var moved = [];
          for (var j = 0; j < rec.images.length; j++) {
            var img = rec.images[j];
            moved.push(typeof img === 'string' && img.indexOf('data:') === 0
              ? await uploadDataUrl(img, table)
              : img);
          }
          rec.images = moved;
        }

        var row = toDbRow(table, rec);
        row.sort_order = stamp - i;   // รักษาลำดับเดิมไว้
        rows.push(row);
      }

      var del = await sb.from(table).delete().neq('id', '__never_matches__');
      if (del.error) throw del.error;
      if (rows.length) {
        var ins = await sb.from(table).insert(rows);
        if (ins.error) throw ins.error;
      }
      return rows.length;
    }

    await window.localforage.setItem(LOCAL_KEY[table], arr);
    return arr.length;
  }

  /* -- อัปโหลดรูปขึ้น Storage ---------------------------------------------- */
  function extOf(file) {
    var m = /\.([a-z0-9]+)$/i.exec(file.name || '');
    if (m) return m[1].toLowerCase();
    var t = (file.type || '').split('/')[1];
    return t ? t.split('+')[0] : 'png';
  }

  async function uploadFile(file, folder) {
    if (!CLOUD) {
      // โหมด LOCAL: ฝังเป็น base64 เหมือนเดิม
      return await new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (e) { resolve(e.target.result); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    var path = (folder || 'misc') + '/' + Date.now() + '-' +
               Math.random().toString(36).slice(2, 8) + '.' + extOf(file);

    var up = await sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type || undefined
    });
    if (up.error) throw up.error;

    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function uploadDataUrl(dataUrl, folder) {
    if (!CLOUD) return dataUrl;
    try {
      var blob = await (await fetch(dataUrl)).blob();
      var ext = (blob.type || 'image/png').split('/')[1].split('+')[0];
      return await uploadFile(new File([blob], 'import.' + ext, { type: blob.type }), folder);
    } catch (e) {
      console.warn('[CosmicDB] ย้ายรูป base64 ขึ้น Storage ไม่สำเร็จ', e);
      return dataUrl;
    }
  }

  /* -- อ่านข้อมูลเดิมที่ค้างอยู่ใน IndexedDB (ใช้ตอนย้ายขึ้น cloud) --------- */
  async function readLegacyLocal(table) {
    if (!window.localforage) return [];
    try {
      var v = await window.localforage.getItem(LOCAL_KEY[table]);
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  /* -- Auth ----------------------------------------------------------------- */
  var auth = {
    available: CLOUD,

    async signIn(email, password) {
      if (!CLOUD) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
      var res = await sb.auth.signInWithPassword({ email: email, password: password });
      if (res.error) throw res.error;
      return res.data.user;
    },

    async signOut() {
      if (!CLOUD) return;
      await sb.auth.signOut();
    },

    async user() {
      if (!CLOUD) return null;
      var res = await sb.auth.getUser();
      return res.data ? res.data.user : null;
    },

    onChange(cb) {
      if (!CLOUD) return function () {};
      var sub = sb.auth.onAuthStateChange(function (_evt, session) {
        cb(session ? session.user : null);
      });
      return function () { sub.data.subscription.unsubscribe(); };
    }
  };

  /* -- Realtime: หน้าเว็บอัปเดตเองเมื่อแอดมินบันทึก ------------------------ */
  function subscribe(table, cb) {
    if (!CLOUD) return function () {};
    var ch = sb
      .channel('cosmic-' + table + '-' + Math.random().toString(36).slice(2, 7))
      .on('postgres_changes', { event: '*', schema: 'public', table: table }, function () { cb(table); })
      .subscribe();
    return function () { sb.removeChannel(ch); };
  }

  /* -- แปลข้อความ error ให้อ่านรู้เรื่อง ----------------------------------- */
  function explain(err) {
    if (!err) return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    var msg = err.message || String(err);
    if (/Email logins are disabled/i.test(msg))
      return 'Supabase ปิดการล็อกอินด้วยอีเมลอยู่ — ไปที่ Authentication > Sign In / Providers > Email ' +
             'แล้วเปิดสวิตช์ "Enable Email provider" (ส่วน "Allow new users to sign up" ให้ปิดไว้เหมือนเดิม)';
    if (/Signups not allowed|signup is disabled/i.test(msg))
      return 'โปรเจกต์นี้ปิดการสมัครสมาชิกไว้ (ถูกต้องแล้ว) — บัญชีแอดมินต้องสร้างจาก Authentication > Users > Add user';
    if (/Invalid login credentials/i.test(msg))      return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (/Email not confirmed/i.test(msg))            return 'ยังไม่ได้ยืนยันอีเมล — เช็คกล่องจดหมาย หรือปิด Confirm email ใน Supabase';
    if (/row-level security|violates row-level/i.test(msg))
      return 'ไม่มีสิทธิ์เขียนข้อมูล — ต้องล็อกอินก่อน (RLS ปฏิเสธ)';
    if (/JWT|expired/i.test(msg))                    return 'เซสชันหมดอายุ กรุณาล็อกอินใหม่';
    if (/Failed to fetch|NetworkError/i.test(msg))   return 'เชื่อมต่อ Supabase ไม่ได้ — เช็คอินเทอร์เน็ตหรือ URL ในไฟล์ config';
    if (/หมดเวลารอ/.test(msg))                       return msg + ' — เช็คอินเทอร์เน็ตหรือ URL ในไฟล์ assets/supabase-config.js';
    if (/Bucket not found/i.test(msg))               return 'ไม่พบ bucket "' + BUCKET + '" — รัน supabase-setup.sql ให้ครบก่อน';
    if (/duplicate key/i.test(msg))                  return 'มีรายการ id นี้อยู่แล้วในระบบ';
    return msg;
  }

  window.CosmicDB = {
    cloud: CLOUD,
    categories: CATEGORIES,
    bucket: BUCKET,
    client: sb,
    list: list,
    save: save,
    remove: remove,
    replaceAll: replaceAll,
    uploadFile: uploadFile,
    uploadDataUrl: uploadDataUrl,
    readLegacyLocal: readLegacyLocal,
    newId: newId,
    auth: auth,
    subscribe: subscribe,
    explain: explain
  };

  console.log('%c[CosmicDB] โหมด: ' + (CLOUD ? 'CLOUD (Supabase)' : 'LOCAL (IndexedDB)'),
              'color:#ff2a85;font-weight:bold');
})();
