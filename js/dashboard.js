/* White Horse & Noodle Bar — order dashboard */
(function () {
  'use strict';

  var root = document.getElementById('root');
  var R = (window.RESTAURANT_DATA && RESTAURANT_DATA.restaurant) || {};
  var gateKey = new URLSearchParams(location.search).get('k');
  var KEY_OK = !!window.DASH_KEY && gateKey === window.DASH_KEY;

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  function money(n) { n = Number(n || 0); return '\u00a3' + n.toFixed(2); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtTime(ts) {
    var d = new Date(ts);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  var pane = null; // database ref
  var seen = {};
  var firstLoad = true;
  var firebaseApi = window.firebase;
  var soundOn = true;

  var cfg = window.FB_CONFIG || {};

  /* ---------- screens ---------- */
  function show(html) { root.innerHTML = html; }

  function notFound() {
    show('<div class="gate"><div class="gate-card"><h1>404</h1><p>Page not found.</p></div></div>');
  }

  function setupNote() {
    show('<div class="gate"><div class="gate-card"><h1>订单面板尚未配置</h1>'
      + '<div class="setup-steps"><p>打开 <b>js/config.js</b>，把 Firebase 的 4 个值填进去：</p>'
      + '<ol><li>apiKey</li><li>authDomain</li><li>databaseURL</li><li>projectId</li></ol>'
      + '<p>填好后刷新本页即可。具体获取步骤请看店主设置说明。</p></div></div></div>');
  }

  function loginScreen() {
    show('<div class="gate"><div class="gate-card">'
      + '<h1>🥢 ' + esc(R.name || 'White Horse') + '</h1>'
      + '<p>订单面板 · 请用店主 Google 账号登录<br><small>' + esc(R.email || 'noodlebar37@gmail.com') + '</small></p>'
      + '<button class="btn-google" id="loginBtn">'
      + '  <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.4 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.4 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.5 40.2 46 34 46 24c0-1.3-.2-2.6-.4-3.9z"/></svg>'
      + '  Sign in with Google'
      + '</button>'
      + '<p style="font-size:12px;color:#8a8a8a;margin-top:14px">订单只在你登录后可见；顾客信息受保护。</p>'
      + '</div></div>');
    document.getElementById('loginBtn').onclick = function () {
      firebaseApi.auth().signInWithPopup(new firebaseApi.auth.GoogleAuthProvider())
        .catch(function (e) { alert('登录失败：' + e.message); });
    };
  }

  /* ---------- main app ---------- */
  function mainScreen(name) {
    show(
      '<header class="dash-header">'
      + '<div class="shop"><h1>🥢 ' + esc(R.name) + '</h1>'
      + '<p>' + esc(R.address) + ' · Tel ' + esc(R.phoneDisplay) + '</p></div>'
      + '<div class="dash-actions">'
      + '<span id="clock" style="font-size:13px;opacity:.95"></span>'
      + '<button class="btn" id="soundBtn" type="button">🔔 响铃开</button>'
      + '<button class="btn btn-out" id="logoutBtn" type="button">退出 ' + esc(name) + '</button>'
      + '</div></header>'
      + '<div class="stats">'
      + '<div class="stat"><b id="sCount">0</b><span>今日订单</span></div>'
      + '<div class="stat"><b id="sTotal">£0.00</b><span>今日营业额</span></div>'
      + '<div class="stat"><b id="sLive">–</b><span>待处理新单</span></div>'
      + '</div>'
      + '<div class="orders" id="orders"><div class="empty">等待订单… 有新订单会响铃提示与高亮</div></div>'
      + '<div class="sound-toggle" id="soundToggle" style="display:none"></div>'
    );

    document.getElementById('logoutBtn').onclick = function () {
      firebaseApi.auth().signOut().then(function () { location.reload(); });
    };
    var soundBtn = document.getElementById('soundBtn');
    soundBtn.onclick = function () {
      soundOn = !soundOn;
      soundBtn.textContent = soundOn ? '🔔 响铃开' : '🔕 响铃关';
    };
    setInterval(function () {
      var el = document.getElementById('clock');
      if (el) el.textContent = fmtTime(Date.now());
    }, 1000);

    // realtime orders
    pane = firebaseApi.database().ref('orders');
    pane.orderByChild('ts').on('value', function (snap) {
      renderOrders(snap.val() || {});
    });
  }

  function renderOrders(obj) {
    var list = [];
    var now = new Date();
    var dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var todaySum = 0, todayCount = 0;
    Object.keys(obj).forEach(function (k) {
      var o = obj[k];
      if (!o || !o.ref) return;
      list.push({ key: k, o: o });
      if (o.ts >= dayStart) { todayCount++; todaySum += o.total || 0; }
      if (k in seen && o.new) { o.new = false; } // server-side status flag stays new until done
    });
    list.sort(function (a, b) { return (b.o.ts || 0) - (a.o.ts || 0); });

    var sCount = document.getElementById('sCount');
    var sTotal = document.getElementById('sTotal');
    var sLive = document.getElementById('sLive');
    if (sCount) sCount.textContent = todayCount;
    if (sTotal) sTotal.textContent = money(todaySum);
    if (sLive) sLive.textContent = list.filter(function (x) { return x.o.status === 'new'; }).length;

    var ordersEl = document.getElementById('orders');
    if (!ordersEl) return;
    if (!list.length) {
      ordersEl.innerHTML = '<div class="empty">等待订单… 有新订单会响铃提示与高亮</div>';
      seen = {};
      return;
    }

    var html = '';
    list.forEach(function (x) {
      html += orderCard(x.key, x.o);
    });
    ordersEl.innerHTML = html;

    // flash + beep for new orders
    list.forEach(function (x) {
      if (firstLoad) { seen[x.key] = 1; return; }
      if (!(x.key in seen)) {
        seen[x.key] = 1;
        var card = document.getElementById('card-' + x.key);
        if (card) {
          card.classList.add('flash');
          if (soundOn) beep();
          document.title = '❗ 新订单 #' + x.o.ref;
          setTimeout(function () { document.title = 'White Horse 订单面板'; }, 8000);
        }
      }
    });
    firstLoad = false;
    bindCardActions(obj);
  }

  function orderCard(key, o) {
    var items = '';
    (o.items || []).forEach(function (it) {
      items += '<div class="it"><div class="it-main">'
        + '<span>' + esc(it.qty) + ' × ' + esc(it.name) + '</span>'
        + '<span>' + money(it.total) + '</span></div>';
      if (it.size) items += '<div class="it-sub">' + esc(it.size) + '</div>';
      if (it.base) items += '<div class="it-sub">配' + esc(it.base.cn || '') + ' ' + esc(it.base.en || '') + '</div>';
      if (it.extras && it.extras.length) {
        var xl = it.extras.map(function (x) {
          return esc(x.cn || '') + ' ' + esc(x.en || '') + (x.price ? ' <span class="chg">+' + money(x.price) + '</span>' : '');
        }).join('；');
        items += '<div class="it-sub">加料: ' + xl + '</div>';
      }
      items += '</div>';
    });

    var c = o.customer || {};
    var cust = '<div class="cust"><b>取餐方式：</b>' + (o.type === 'delivery' ? '外送 Delivery' : '到店取 Collection') + '<br>'
      + '<b>姓名：</b>' + esc(c.name) + '<br>'
      + '<b>电话：</b>' + esc(c.phone) + '<br>';
    if (o.type === 'delivery') cust += '<b>地址：</b>' + esc(c.address) + '<br>';
    if (c.time) cust += '<b>时间：</b>' + esc(c.time) + '<br>';
    cust += '</div>';

    var notes = '';
    if (c.notes) {
      notes = '<div class="notes"><b>⚠️ 特别要求 Special instructions</b>' + esc(c.notes) + '</div>';
    }

    var totals = '<div class="totals">'
      + '<div><div>' + (o.type === 'delivery' ? 'Subtotal ' + money(o.subtotal || 0) + '<br>Delivery ' + money(o.fee || 0) : 'Subtotal ' + money(o.subtotal || 0)) + '</div>'
      + '<div class="grand">Total ' + money(o.total || 0) + '</div></div>'
      + '</div>';

    return '<div class="order-card' + (o.status === 'new' ? '' : '') + '" id="card-' + key + '">'
      + '<div class="order-head ' + esc(o.type || 'collection') + '">'
      + '<span class="ref">#' + esc(o.ref) + '</span>'
      + '<span class="meta">' + fmtTime(o.ts || 0) + '<br>' + (o.type === 'delivery' ? '🚚 Delivery' : '🏪 Collection') + (o.status === 'new' ? '<br><b>NEW</b>' : '') + '</span>'
      + '</div>'
      + '<div class="order-body">'
      + '<div class="order-items">' + items + '</div>'
      + totals
      + cust
      + notes
      + '</div>'
      + '<div class="order-foot">'
      + '<button class="btn btn-print" data-print="' + key + '" type="button">🖨️ 打印发票</button>'
      + '<button class="btn btn-done" data-done="' + key + '" type="button">✓ 已完成(移除)</button>'
      + '</div>'
      + '</div>';
  }

  function bindCardActions(obj) {
    document.querySelectorAll('[data-print]').forEach(function (btn) {
      btn.onclick = function () {
        var o = obj[btn.getAttribute('data-print')];
        if (o) printInvoice(o);
      };
    });
    document.querySelectorAll('[data-done]').forEach(function (btn) {
      btn.onclick = function () {
        var k = btn.getAttribute('data-done');
        pane.child(k).update({ status: 'done' });
        setTimeout(function () { pane.child(k).remove(); }, 250);
      };
    });
  }

  /* ---------- invoice printing (header, no VAT) ---------- */
  function printInvoice(o) {
    var items = '';
    (o.items || []).forEach(function (it) {
      items += '<tr><td colspan="2">' + esc(it.qty) + ' × ' + esc(it.name) + '</td><td class="r">' + money(it.total) + '</td></tr>';
      if (it.size) items += '<tr class="sub"><td colspan="3">' + esc(it.size) + '</td></tr>';
      if (it.base) items += '<tr class="sub"><td colspan="3">配' + esc(it.base.cn || '') + ' ' + esc(it.base.en || '') + '</td></tr>';
      if (it.extras && it.extras.length) {
        items += '<tr class="sub"><td colspan="3">加料: ' + it.extras.map(function (x) {
          return esc(x.cn || '') + ' ' + esc(x.en || '') + (x.price ? ' (+' + money(x.price) + ')' : '');
        }).join('; ') + '</td></tr>';
      }
    });
    var c = o.customer || {};
    var cust = '姓名/Name: ' + esc(c.name || '') + '<br>电话/Phone: ' + esc(c.phone || '');
    if (o.type === 'delivery') cust += '<br>地址/Address: ' + esc(c.address || '');
    if (c.time) cust += '<br>时间/Time: ' + esc(c.time);
    var notes = c.notes ? '<div class="inv-notes">特别要求 / Special instructions:<br>' + esc(c.notes) + '</div>' : '';
    var feeRow = (o.type === 'delivery' && (o.fee || 0) > 0)
      ? '<tr><td colspan="2">Delivery fee</td><td class="r">' + money(o.fee) + '</td></tr>' : '';
    var type = o.type === 'delivery' ? 'DELIVERY 外送' : 'COLLECTION 取餐';

    var doc = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice #' + esc(o.ref) + '</title><style>'
      + 'body{font-family:"Segoe UI",Arial,sans-serif;color:#111;margin:24px;}'
      + '.wrap{max-width:210mm;margin:0 auto;}'
      + 'h1{margin:0 0 2px;font-size:20px;}'
      + '.hdr{text-align:center;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px;}'
      + '.hdr .addr{font-size:12px;line-height:1.5;}'
      + '.meta{font-size:12px;margin:6px 0;}'
      + 'table{width:100%;border-collapse:collapse;font-size:14px;}'
      + 'td{padding:4px 2px;vertical-align:top;border-bottom:1px dotted #ccc;}'
      + 'td.r{text-align:right;white-space:nowrap;}'
      + '.sub td{font-size:11.5px;color:#333;border-bottom:0;padding:0 2px 2px;}'
      + '.grand td{font-size:16px;font-weight:800;border-bottom:0;}'
      + '.cust{font-size:13px;line-height:1.6;margin-top:10px;padding-top:6px;border-top:1px solid #999;margin-bottom:4px;}'
      + '.inv-notes{margin:10px 0;padding:8px 10px;border:1px solid #b71c1c;font-size:13px;white-space:pre-wrap;}'
      + '.foot{margin-top:16px;text-align:center;font-size:12px;border-top:1px solid #999;padding-top:8px;}'
      + '</style></head><body><div class="wrap">'
      + '<div class="hdr"><h1>' + esc(R.name || 'White Horse & Noodle Bar') + '</h1>'
      + '<div class="addr">' + esc(R.address || '') + '<br>Tel: ' + esc(R.phoneDisplay || '') + '</div></div>'
      + '<div class="meta">TAKEAWAY INVOICE · ' + type + '<br>'
      + 'Order No: #' + esc(o.ref) + ' · ' + fmtTime(o.ts || 0) + '</div>'
      + '<table><tr><td colspan="2"><b>Item</b></td><td class="r"><b>Amount</b></td></tr>'
      + items
      + '<tr><td colspan="2">Subtotal</td><td class="r">' + money(o.subtotal || 0) + '</td></tr>'
      + feeRow
      + '<tr class="grand"><td colspan="2">TOTAL</td><td class="r">' + money(o.total || 0) + '</td></tr></table>'
      + '<div class="cust">' + cust + '</div>'
      + notes
      + '<div class="foot">Thank you for your order! · Order ref #' + esc(o.ref) + '</div>'
      + '</div><script>window.onload=function(){setTimeout(function(){window.print();},200);}</scr' + 'ipt></body></html>';

    var w = window.open('', '_blank', 'width=820,height=900');
    if (w) {
      w.document.write(doc);
      w.document.close();
    }
  }

  /* ---------- beep ---------- */
  function beep() {
    try {
      if (!window.AudioContext && !window.webkitAudioContext) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      var ctx = new AC();
      var play = function (freq, at, dur) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.5, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(at); o.stop(at + dur);
      };
      play(880, ctx.currentTime, 0.25);
      play(1174, ctx.currentTime + 0.22, 0.25);
    } catch (e) { /* ignore */ }
  }

  /* ---------- boot ---------- */
  if (!KEY_OK) { notFound(); return; }
  if (!cfg.apiKey || !cfg.databaseURL) { setupNote(); return; }
  if (!firebaseApi) { show('<div class="gate">Firebase SDK 加载失败，请检查网络。</div>'); return; }

  firebaseApi.initializeApp(cfg);
  firebaseApi.auth().onAuthStateChanged(function (user) {
    if (user) { mainScreen(user.displayName || user.email || '店主'); }
    else { loginScreen(); }
  });
})();