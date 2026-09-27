/* White Horse & Noodle Bar - ordering app */
(function () {
  'use strict';

  var D = RESTAURANT_DATA;
  var R = D.restaurant;
  var CURRENCY = D.meta.currencySymbol;
  var CATEGORIES = D.categories;
  var ZONES = D.delivery_zones || [];

  // categories (by id) that get the combo base + extras dialog ("main dishes")
  var COMBO_CAT_IDS = [1274474];
  var BASE_OPTIONS = EXTRAS_DATA.baseOptions;
  var EXTRA_OPTIONS = EXTRAS_DATA.extras;

  var cart = loadCart();

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function money(n) {
    n = Number(n || 0);
    return CURRENCY + n.toFixed(2);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function loadCart() {
    try {
      var raw = localStorage.getItem('noodlebar_cart');
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveCart() {
    try { localStorage.setItem('noodlebar_cart', JSON.stringify(cart)); } catch (e) {}
  }

  function cartKeys() { return Object.keys(cart); }

  function cartCount() {
    return cartKeys().reduce(function (s, k) { return s + (cart[k].qty || 0); }, 0);
  }

  function subtotal() {
    var tot = 0;
    cartKeys().forEach(function (k) {
      var line = cart[k];
      tot += line.unit * (line.qty || 0);
    });
    return round2(tot);
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  /* ---------- find item ---------- */
  function findItem(itemId) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      var items = CATEGORIES[i].items;
      for (var j = 0; j < items.length; j++) {
        if (items[j].id === itemId) return items[j];
      }
    }
    return null;
  }

  function isComboItem(itemId) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      var cat = CATEGORIES[i];
      if (COMBO_CAT_IDS.indexOf(cat.id) > -1) {
        for (var j = 0; j < cat.items.length; j++) {
          if (cat.items[j].id === itemId) return true;
        }
      }
    }
    return false;
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ---------- render menu ---------- */
  function renderMenu() {
    var menuHtml = '';
    CATEGORIES.forEach(function (cat, ci) {
      var pic = cat.picture
        ? '<img class="category-pic" src="' + esc(cat.picture) + '" alt="" loading="lazy">'
        : '';
      var desc = cat.description ? '<p class="category-desc">' + esc(cat.description) + '</p>' : '';
      var cards = cat.items.map(function (item) {
        return itemCard(cat, item);
      }).join('');
      menuHtml +=
        '<section class="category" id="cat-' + cat.id + '" data-cat="' + ci + '">' +
        '  <div class="category-head">' + pic +
        '    <div><h2 class="category-title">' + esc(cat.name) + '</h2>' + desc + '</div>' +
        '  </div>' +
        '  <div class="items-grid">' + cards + '</div>' +
        '</section>';
    });
    $('#menuContent').innerHTML = menuHtml;

    var pills = CATEGORIES.map(function (cat, ci) {
      return '<button type="button" class="catpill" data-pill="' + ci + '">' + esc(cat.name) + '</button>';
    }).join('');
    $('#catnavList').innerHTML = pills;
  }

  function itemCard(cat, item) {
    var price = money(item.price);
    var combo = isComboItem(item.id);
    var size = item.sizes && item.sizes.length > 0;
    var label = combo ? 'View & Customise' : (size ? 'View & Choose' : 'View & Add');
    var control = '<button type="button" class="item-add-btn" data-detail="' + item.id + '">' + label + '</button>';
    var desc = item.description ? '<p class="item-desc">' + esc(item.description) + '</p>' : '';
    var tag = combo ? '<p class="item-tag">Comes with fried rice · choose noodles / chips 配炒饭</p>' : '';
    return '' +
      '<div class="item-card">' +
      '  <div class="item-foot"><span class="item-price">' + price + '</span>' + control + '</div>' +
      '  <h3 class="item-name">' + esc(item.name) + '</h3>' +
      tag +
      desc +
      '</div>';
  }

  /* ---------- category nav + scroll spy ---------- */
  function setupNav() {
    var pills = $all('.catpill');
    var sections = $all('.category');

    pills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        var ci = Number(pill.getAttribute('data-pill'));
        var sec = sections[ci];
        if (sec) {
          var top = sec.getBoundingClientRect().top + window.pageYOffset - 130;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
    });

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.pageYOffset + 150;
        var active = 0;
        sections.forEach(function (sec, i) {
          if (sec.offsetTop <= y) active = i;
        });
        pills.forEach(function (p, i) {
          p.classList.toggle('active', i === active);
        });
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- cart ops ---------- */
  function addToCart(item, opts) {
    opts = opts || {};
    var extras = opts.extras || [];
    var base = opts.base || null;
    var qty = Math.max(1, Number(opts.qty) || 1);
    var unit = round2(
      item.price
      + (opts.sizePrice || 0)
      + (base ? base.price : 0)
      + extras.reduce(function (s, e) { return s + e.price; }, 0)
    );
    var extraKey = extras.map(function (e) { return e.code; }).sort().join(',');
    var key = String(item.id)
      + (opts.size ? '|S:' + opts.size : '')
      + (base ? '|B:' + base.id : '')
      + (extraKey ? '|E:' + extraKey : '');

    if (!cart[key]) {
      cart[key] = {
        id: item.id,
        size: opts.size || null,
        base: base,
        extras: extras,
        qty: qty,
        unit: unit,
        name: item.name
      };
    } else {
      cart[key].qty += qty;
    }
    saveCart();
    refreshCartUI();
    var label = item.name
      + (opts.size ? ' (' + opts.size + ')' : '')
      + (base ? ' (' + base.en + ')' : '')
      + (extras.length ? ' +' + extras.length + ' add-on' + (extras.length > 1 ? 's' : '') : '');
    toast('Added: ' + label);
  }

  function changeQty(key, delta) {
    if (!cart[key]) return;
    cart[key].qty += delta;
    if (cart[key].qty <= 0) delete cart[key];
    saveCart();
    refreshCartUI();
  }

  function removeLine(key) {
    delete cart[key];
    saveCart();
    refreshCartUI();
  }

  function linePrice(key) {
    return round2(cart[key].unit * cart[key].qty);
  }

  /* ---------- cart UI ---------- */
  function refreshCartUI() {
    var count = cartCount();
    $('#cartCount').textContent = count;
    $('#cartFabCount').textContent = count;
    $('#cartFab').style.display = count > 0 ? 'grid' : 'none';

    var body = $('#drawerBody');
    if (count === 0) {
      body.innerHTML = '<div class="cart-empty"><p>Your basket is empty.</p><p style="font-size:13px">Browse the menu and add some dishes!</p></div>';
      $('#cartSummary').innerHTML = '<p class="delivery-note">Subtotal £0.00 — delivery fee &amp; total shown at checkout.</p>';
      return;
    }

    var rows = cartKeys().map(function (k) {
      var line = cart[k];
      var details = '';
      if (line.size) details += '<div class="cart-line-detail">' + esc(line.size) + '</div>';
      if (line.base) details += '<div class="cart-line-detail">Base: ' + esc(line.base.cn) + ' ' + esc(line.base.en) + '</div>';
      if (line.extras && line.extras.length) {
        details += line.extras.map(function (x) {
          return '<div class="cart-line-detail">+ ' + esc(x.cn) + ' ' + esc(x.en) +
            (x.price ? ' <span class="cart-line-detail-price">+' + money(x.price) + '</span>' : '') +
            '</div>';
        }).join('');
      }
      return '' +
        '<div class="cart-item">' +
        '  <div class="cart-item-info">' +
        '    <div class="cart-item-name">' + esc(line.name) + '</div>' +
        details +
        '    <div class="cart-item-price">' + money(line.unit) + ' each</div>' +
        '  </div>' +
        '  <div class="cart-item-controls">' +
        '    <button type="button" class="ctl-btn" data-dec="' + k + '" aria-label="Decrease">−</button>' +
        '    <span class="cart-item-amt">' + line.qty + '</span>' +
        '    <button type="button" class="ctl-btn" data-inc="' + k + '" aria-label="Increase">+</button>' +
        '    <button type="button" class="ctl-btn remove" data-del="' + k + '" aria-label="Remove">🗑</button>' +
        '  </div>' +
        '</div>';
    }).join('');

    body.innerHTML = rows;

    var sub = subtotal();
    $('#cartSummary').innerHTML =
      '<div class="sum-row"><span>Subtotal</span><span>' + money(sub) + '</span></div>' +
      '<div class="sum-row"><span>Delivery / collection</span><span>at checkout</span></div>' +
      '<div class="sum-row total"><span>Total</span><span>' + money(sub) + '</span></div>';

    $all('.ctl-btn[data-inc]', body).forEach(function (b) { b.onclick = function () { changeQty(b.getAttribute('data-inc'), 1); }; });
    $all('.ctl-btn[data-dec]', body).forEach(function (b) { b.onclick = function () { changeQty(b.getAttribute('data-dec'), -1); }; });
    $all('.ctl-btn[data-del]', body).forEach(function (b) { b.onclick = function () { removeLine(b.getAttribute('data-del')); }; });

    $('#checkoutBtn').disabled = false;
  }

  /* ---------- drawer ---------- */
  function openDrawer() {
    if (cartCount() === 0) { toast('Your basket is empty'); return; }
    $('#cartDrawer').classList.add('open');
    $('#drawerOverlay').classList.add('show');
    $('#cartDrawer').setAttribute('aria-hidden', 'false');
  }
  function closeDrawer() {
    $('#cartDrawer').classList.remove('open');
    $('#drawerOverlay').classList.remove('show');
    $('#cartDrawer').setAttribute('aria-hidden', 'true');
  }

  /* ---------- options modal ---------- */
  function openOptions(itemId) {
    var item = findItem(itemId);
    if (!item) return;
    openDetailDialog(item);
  }

  /* unified detail dialog: shows what's in the dish + qty (+ combo base/extras/sizes) */
  function openDetailDialog(item) {
    var html = '<h2>' + esc(item.name) + '</h2>';
    if (item.description) {
      html += '<p class="item-desc dialog-desc">' + esc(item.description) + '</p>';
    }
    html += '<div class="dialog-price-line">' + money(item.price) + '</div>';

    var addOn = isComboItem(item.id) ? comboAddonHtml() : (item.sizes && item.sizes.length ? sizeAddonHtml(item) : '');
    html += addOn;

    // quantity stepper
    html += '<div class="qty-row">' +
      '<span class="qty-label">Quantity</span>' +
      '<div class="qty-stepper">' +
      '<button type="button" class="ctl-btn" data-qty="-1" aria-label="Decrease">−</button>' +
      '<span class="cart-item-amt" id="qtyVal">1</span>' +
      '<button type="button" class="ctl-btn" data-qty="1" aria-label="Increase">+</button>' +
      '</div>' +
      '</div>';

    html += '<div class="option-actions">' +
      '<div class="combo-total">Total <span id="comboTotal">' + money(item.price) + '</span></div>' +
      '<button type="button" class="btn btn-primary" id="optAdd">Add to basket</button>' +
      '</div>';
    showModalHtml(html);

    var totalEl = $('#comboTotal');
    // bind listeners
    var baseRadios = $all('#modalOverlay [name="base"]');
    var extraBoxes = $all('#modalOverlay .opt-chip input');
    var sizeRadios = $all('#modalOverlay [name="opt"]');
    var qtyEl = $('#qtyVal');

    function currentQty() { return Math.max(1, Number(qtyEl.textContent) || 1); }
    function addonSum() {
      var s = 0;
      if (baseRadios.length) {
        var b = $('input[name="base"]:checked');
        if (b) s += (BASE_OPTIONS[Number(b.value)].price || 0);
      }
      if (sizeRadios.length) {
        var sz = $('input[name="opt"]:checked');
        if (sz) s += (item.sizes[Number(sz.value)].price || 0);
      }
      extraBoxes.forEach(function (cb) { if (cb.checked) s += EXTRA_OPTIONS[Number(cb.value)].price; });
      return s;
    }
    function updateTotal() {
      totalEl.textContent = money(round2((item.price + addonSum()) * currentQty()));
    }
    baseRadios.forEach(function (r) { r.onchange = updateTotal; });
    sizeRadios.forEach(function (r) { r.onchange = updateTotal; });
    extraBoxes.forEach(function (cb) { cb.onchange = updateTotal; });
    $all('#modalOverlay [data-qty]').forEach(function (b) {
      b.onclick = function () {
        var v = currentQty() + Number(b.getAttribute('data-qty'));
        qtyEl.textContent = Math.max(1, v);
        updateTotal();
      };
    });

    $('#optAdd').onclick = function () {
      var opts = { qty: currentQty() };
      if (baseRadios.length) {
        opts.base = BASE_OPTIONS[Number($('input[name="base"]:checked').value)];
        opts.extras = extraBoxes.filter(function (cb) { return cb.checked; }).map(function (cb) {
          return EXTRA_OPTIONS[Number(cb.value)];
        });
      }
      if (sizeRadios.length) {
        var sz = item.sizes[Number($('input[name="opt"]:checked').value)];
        opts.size = sz.name;
        opts.sizePrice = sz.price || 0;
      }
      addToCart(item, opts);
      closeModal();
    };
  }

  function comboAddonHtml() {
    var html = '<p class="dialog-sub">Base · 配饭/面 <small>— comes with fried rice by default</small></p>';
    html += '<div class="option-list">';
    BASE_OPTIONS.forEach(function (b, bi) {
      html +=
        '<label class="option">' +
        '  <input type="radio" name="base" value="' + bi + '"' + (b.def ? ' checked' : '') + '>' +
        '  <span>' + esc(b.en) + ' ' + esc(b.cn) + '</span>' +
        (b.price ? '<span class="option-price">+' + money(b.price) + '</span>' : '') +
        '</label>';
    });
    html += '</div>';
    html += '<p class="dialog-sub">Add-ons · 加料 <small>— optional, tick what you want</small></p>';
    html += '<div class="opt-grid">';
    EXTRA_OPTIONS.forEach(function (x, xi) {
      html +=
        '<label class="opt-chip">' +
        '  <input type="checkbox" value="' + xi + '">' +
        '  <span class="opt-chip-label">' + esc(x.en) +
        (x.price ? ' <b class="opt-chip-price">+' + money(x.price) + '</b>' : '') +
        '</span>' +
        '</label>';
    });
    html += '</div>';
    return html;
  }

  function sizeAddonHtml(item) {
    var html = '<p class="dialog-sub">Size</p>';
    html += '<div class="option-list">';
    item.sizes.forEach(function (s, si) {
      html +=
        '<label class="option">' +
        '  <input type="radio" name="opt" value="' + si + '"' + (si === 0 ? ' checked' : '') + '>' +
        '  <span>' + esc(s.name) + '</span>' +
        (s.price ? '<span class="option-price">+' + money(s.price) + '</span>' : '') +
        '</label>';
    });
    html += '</div>';
    return html;
  }

  function showModalHtml(html) {
    var modal = $('#modalOverlay');
    modal.innerHTML = '<div class="modal" role="dialog" aria-modal="true">'
      + '<button class="modal-close" data-close-modal type="button" aria-label="Close">×</button>'
      + html
      + '</div>';
    modal.classList.add('show');
    setTimeout(function () {
      var first = modal.querySelector('button, input');
      if (first) first.focus();
    }, 50);
  }

  function closeModal() {
    $('#modalOverlay').classList.remove('show');
  }

  /* ---------- checkout ---------- */
  var orderType = 'pickup';
  var deliveryZone = null;

  function buildCheckoutModal() {
    var sub = subtotal();
    var zoneOptions = ZONES.map(function (z, i) {
      var label = z.name + ' — ' + money(z.fee) + (z.min > 0 ? ' (min order ' + money(z.min) + ')' : '');
      return '<option value="' + i + '">' + esc(label) + '</option>';
    }).join('');

    var html =
      '<h2>Checkout</h2>' +
      '<div class="field-row">' +
      '  <label class="field"><span>Full name *</span><input type="text" id="custName" autocomplete="name" placeholder="Your name"></label>' +
      '  <label class="field"><span>Mobile number *</span><input type="tel" id="custPhone" autocomplete="tel" placeholder="07xxx / +44..."></label>' +
      '</div>' +
      '<label class="field"><span>Order type *</span>' +
      '  <div class="seg" id="orderTypeSeg">' +
      '    <button type="button" class="seg-btn' + (orderType === 'pickup' ? ' active' : '') + '" data-type="pickup">Collection</button>' +
      '    <button type="button" class="seg-btn' + (orderType === 'delivery' ? ' active' : '') + '" data-type="delivery">Delivery</button>' +
      '  </div>' +
      '</label>' +
      '<div id="deliveryFields" class="' + (orderType === 'delivery' ? '' : 'hidden') + '">' +
      '  <label class="field"><span>Delivery address *</span><input type="text" id="custAddress" placeholder="House no. and street, postcode"></label>' +
      '  <label class="field"><span>Delivery area / zone *</span><select id="custZone">' + zoneOptions + '</select></label>' +
      '</div>' +
      '<label class="field"><span>Preferred time (optional)</span><input type="text" id="custTime" placeholder="e.g. 6:30pm, or leave blank for ASAP"></label>' +
      '<label class="field field-note"><span>Special Instructions (allergies, dietary, requests)</span><textarea id="custNotes" rows="3" placeholder="e.g. peanut / nut allergy, no MSG, no spring onion, extra chilli sauce..."></textarea></label>' +
      '<div class="checkout-summary" id="checkoutSummary"></div>' +
'<button type="button" class="btn btn-whatsapp btn-xl" id="confirmBtn">' +
      '  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>' +
      '  Send order via WhatsApp' +
      '</button>' +
      '<div class="checkout-divider"><span>or</span></div>' +
      '<button type="button" class="btn btn-email btn-xl" id="mailBtn">' +
      '  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4.236-8 4.882L4 8.236V6.5l8 4.882L20 6.5v1.736Z"/></svg>' +
      '  No WhatsApp? Send order by Email' +
      '</button>' +
      '<p class="checkout-hint">Your order and any notes are sent to ' + esc(R.phoneDisplay) + '. WhatsApp is fastest — else use the email button. We confirm and arrange payment on collection / delivery.</p>';

    showModalHtml(html);
    wireCheckoutModal();
    updateCheckoutSummary();
  }

  function wireCheckoutModal() {
    var segBtns = $all('#orderTypeSeg .seg-btn');
    segBtns.forEach(function (b) {
      b.onclick = function () {
        orderType = b.getAttribute('data-type');
        segBtns.forEach(function (x) { x.classList.toggle('active', x === b); });
        $('#deliveryFields').classList.toggle('hidden', orderType !== 'delivery');
        updateCheckoutSummary();
      };
    });

    var zoneSel = $('#custZone');
    if (zoneSel) zoneSel.onchange = function () { updateCheckoutSummary(); };

    $('#confirmBtn').onclick = function () { submitOrder('whatsapp'); };
    var mailBtn = $('#mailBtn');
    if (mailBtn) mailBtn.onclick = function () { submitOrder('email'); };

    function submitOrder(channel) {
      var name = ($('#custName').value || '').trim();
      var phone = ($('#custPhone').value || '').trim();
      var address = orderType === 'delivery' ? ($('#custAddress') ? $('#custAddress').value.trim() : '') : '';
      var time = ($('#custTime').value || '').trim();
      var notes = ($('#custNotes').value || '').trim();

      var ok = true;
      if (!name) { markInvalid('#custName', true); ok = false; } else markInvalid('#custName', false);
      if (!phone) { markInvalid('#custPhone', true); ok = false; } else markInvalid('#custPhone', false);
      if (orderType === 'delivery' && !address) { markInvalid('#custAddress', true); ok = false; } else if ($('#custAddress')) markInvalid('#custAddress', false);

      if (!ok) { toast('Please fill in the highlighted fields'); return; }

      // delivery minimum check
      if (orderType === 'delivery') {
        var zoneIdx = Number($('#custZone').value);
        var zone = ZONES[zoneIdx];
        if (zone && subtotal() < zone.min) {
          toast('Minimum order for ' + zone.name + ' delivery is ' + money(zone.min));
          return;
        }
      }

      var msg = buildWhatsAppMessage({ name: name, phone: phone, address: address, time: time, notes: notes });

      if (channel === 'whatsapp') {
        window.open('https://wa.me/' + R.whatsapp + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
        toast('Opening WhatsApp with your order…');
      } else {
        var subject = 'Online Order from ' + name;
        window.open('mailto:' + R.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(msg), '_self', 'noopener');
        toast('Opening your email app with the order…');
      }
      setTimeout(function () { closeModal(); closeDrawer(); }, 300);
    }
  }

  function markInvalid(sel, invalid) {
    var el = $(sel);
    if (el) el.closest('.field').classList.toggle('invalid', invalid);
  }

  function deliveryFee() {
    if (orderType !== 'delivery') return 0;
    var zoneSel = $('#custZone');
    if (!zoneSel) return 0;
    var zone = ZONES[Number(zoneSel.value)];
    return zone ? zone.fee : 0;
  }

  function updateCheckoutSummary() {
    var el = $('#checkoutSummary');
    if (!el) return;
    var sub = subtotal();
    var fee = deliveryFee();
    var total = round2(sub + fee);
    var rows =
      '<div class="sum-row"><span>Subtotal</span><span>' + money(sub) + '</span></div>' +
      (fee > 0 ? '<div class="sum-row"><span>Delivery fee</span><span>' + money(fee) + '</span></div>' : '') +
      '<div class="sum-row total"><span>Total</span><span>' + money(total) + '</span></div>';
    el.innerHTML = rows;
  }

  function buildWhatsAppMessage(info) {
    var lines = [];
    lines.push('*New Order — ' + R.name + '*');
    lines.push('');
    lines.push('*' + (orderType === 'delivery' ? 'Delivery' : 'Collection') + ' order*');
    lines.push('Ref: #' + orderRef());
    lines.push('');
    lines.push('*Items*');
    cartKeys().forEach(function (k) {
      var line = cart[k];
      var nm = line.name + (line.size ? ' (' + line.size + ')' : '');
      lines.push('• ' + line.qty + ' × ' + nm + ' — ' + money(linePrice(k)));
      if (line.base) {
        lines.push('     配' + line.base.cn + ' ' + line.base.en +
          (line.base.price ? ' (+' + money(line.base.price) + ')' : ''));
      }
      if (line.extras && line.extras.length) {
        line.extras.forEach(function (x) {
          lines.push('     + ' + x.cn + ' ' + x.en +
            (x.price ? ' (+' + money(x.price) + ')' : ''));
        });
      }
    });
    lines.push('');
    lines.push('Subtotal: ' + money(subtotal()));
    if (orderType === 'delivery') {
      lines.push('Delivery fee: ' + money(deliveryFee()));
      lines.push('*Total: ' + money(round2(subtotal() + deliveryFee())) + '*');
    } else {
      lines.push('*Total: ' + money(subtotal()) + '*');
    }
    lines.push('');
    lines.push('*Your details*');
    lines.push('Name: ' + info.name);
    lines.push('Phone: ' + info.phone);
    if (orderType === 'delivery') {
      lines.push('Address: ' + info.address);
      var zone = ZONES[Number($('#custZone').value)];
      if (zone) lines.push('Delivery area: ' + zone.name);
    }
    if (info.time) lines.push('Preferred time: ' + info.time);
    if (info.notes) lines.push('*Special instructions:* ' + info.notes);
    lines.push('');
    lines.push('Please confirm — thank you! 🥢');
    return lines.join('\n');
  }

  function orderRef() {
    var t = Date.now().toString(36).toUpperCase().slice(-5);
    return t;
  }

  /* ---------- footer hours ---------- */
  function renderFooter() {
    var list = $('#hoursList');
    list.innerHTML = D.opening_hours.map(function (row) {
      var sess = row.sessions.length
        ? row.sessions.join(' & ')
        : (row.note || 'Closed');
      return '<li class="' + (row.sessions.length ? '' : 'closed') + '"><span>' + esc(row.day) + '</span><span>' + esc(sess) + '</span></li>';
    }).join('');
    $('#hoursNote').textContent = (D.note || '') + ' · Closed Mondays.';
    $('#year').textContent = new Date().getFullYear();
  }

  /* ---------- events ---------- */
  function bindEvents() {
    $('#cartBtn').onclick = openDrawer;
    $('#cartFab').onclick = openDrawer;
    $('#drawerClose').onclick = closeDrawer;
    $('#drawerOverlay').onclick = closeDrawer;
    $('#checkoutBtn').onclick = openCheckout;
    $('#modalOverlay').onclick = function (e) {
      if (e.target === $('#modalOverlay') || e.target.getAttribute('data-close-modal') !== null) closeModal();
    };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeModal(); closeDrawer(); }
    });

    var heroWhats = $('#heroWhats');
    heroWhats.href = 'https://wa.me/' + R.whatsapp + '?text=' +
      encodeURIComponent('Hi ' + R.name.split('&')[0].trim() + ', I would like to place an order. 🥡');
    $('#footWhats').href = 'https://wa.me/' + R.whatsapp;

    $('#menuContent').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-detail]');
      if (btn) { openOptions(Number(btn.getAttribute('data-detail'))); return; }
    });
  }

  function openCheckout() {
    if (cartCount() === 0) { toast('Your basket is empty'); return; }
    closeDrawer();
    buildCheckoutModal();
  }

  /* ---------- init ---------- */
  function init() {
    renderMenu();
    renderFooter();
    setupNav();
    bindEvents();
    refreshCartUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();