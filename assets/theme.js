/**
 * Vanderton Print Co — Theme JS
 * Vanilla JS, no dependencies.
 */

'use strict';

/* =============================================================================
   UTILS
   ============================================================================= */
function $(selector, context) {
  return (context || document).querySelector(selector);
}

function $$(selector, context) {
  return Array.from((context || document).querySelectorAll(selector));
}

function formatMoney(cents) {
  const dollars = cents / 100;
  return '$' + dollars.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function trapFocus(element) {
  const focusable = element.querySelectorAll(
    'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  element.addEventListener('keydown', function handler(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  if (first) first.focus();
}

function openOverlay() {
  const overlay = document.getElementById('overlay');
  if (overlay) {
    overlay.classList.add('is-visible');
    overlay.removeAttribute('aria-hidden');
  }
}

function closeOverlay() {
  const overlay = document.getElementById('overlay');
  if (overlay) {
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

/* =============================================================================
   STICKY HEADER
   ============================================================================= */
function initStickyHeader() {
  const header = $('.site-header');
  if (!header) return;

  const threshold = 40;

  function onScroll() {
    if (window.scrollY > threshold) {
      header.classList.add('is-sticky');
    } else {
      header.classList.remove('is-sticky');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* =============================================================================
   MOBILE MENU
   ============================================================================= */
function initMobileMenu() {
  const menu = $('.mobile-menu');
  const openBtn = $('[data-open-mobile-menu]');
  const closeBtn = $('[data-close-mobile-menu]');
  const overlay = document.getElementById('overlay');

  if (!menu || !openBtn) return;

  function openMenu() {
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    openOverlay();
    trapFocus(menu);
  }

  function closeMenu() {
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    closeOverlay();
    openBtn.focus();
  }

  openBtn.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  if (overlay) overlay.addEventListener('click', closeMenu);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu();
  });

  // Submenu toggles
  $$('[data-mobile-submenu-toggle]').forEach(function(toggle) {
    toggle.addEventListener('click', function() {
      const submenu = this.closest('.mobile-menu__item').querySelector('.mobile-menu__submenu');
      if (!submenu) return;
      submenu.classList.toggle('is-open');
      const isOpen = submenu.classList.contains('is-open');
      this.setAttribute('aria-expanded', isOpen);
    });
  });
}

/* =============================================================================
   CART DRAWER
   ============================================================================= */
const CartDrawer = {
  drawer: null,
  overlay: null,

  init() {
    this.drawer = $('.cart-drawer');
    if (!this.drawer) return;

    const openBtns = $$('[data-open-cart]');
    const closeBtn = $('[data-close-cart]', this.drawer);
    const overlay = document.getElementById('overlay');

    openBtns.forEach(btn => btn.addEventListener('click', () => this.open()));
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (overlay) overlay.addEventListener('click', () => this.close());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.drawer.classList.contains('is-open')) this.close();
    });

    // Handle qty changes and remove inside drawer
    this.drawer.addEventListener('click', (e) => {
      if (e.target.closest('[data-qty-minus]')) {
        const item = e.target.closest('[data-cart-item]');
        this.changeQty(item, -1);
      }
      if (e.target.closest('[data-qty-plus]')) {
        const item = e.target.closest('[data-cart-item]');
        this.changeQty(item, 1);
      }
      if (e.target.closest('[data-remove-item]')) {
        const item = e.target.closest('[data-cart-item]');
        this.removeItem(item);
      }
    });
  },

  open() {
    if (!this.drawer) return;
    this.drawer.classList.add('is-open');
    this.drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    openOverlay();
    this.refresh();
  },

  close() {
    if (!this.drawer) return;
    this.drawer.classList.remove('is-open');
    this.drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    closeOverlay();
  },

  async fetch() {
    const response = await fetch('/cart.js');
    return response.json();
  },

  async addItem(variantId, quantity, properties) {
    const response = await fetch(window.routes.cartAdd, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: quantity || 1, properties: properties || {} })
    });
    const data = await response.json();
    if (data.status) throw new Error(data.description || 'Error adding to cart');
    return data;
  },

  async changeQty(itemEl, delta) {
    if (!itemEl) return;
    const key = itemEl.dataset.key;
    const qtyEl = itemEl.querySelector('[data-qty-value]');
    const currentQty = parseInt(qtyEl ? qtyEl.textContent : 1, 10);
    const newQty = Math.max(0, currentQty + delta);

    await fetch(window.routes.cartChange, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: key, quantity: newQty })
    });

    await this.refresh();
  },

  async removeItem(itemEl) {
    if (!itemEl) return;
    const key = itemEl.dataset.key;
    await fetch(window.routes.cartChange, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: key, quantity: 0 })
    });
    await this.refresh();
  },

  async refresh() {
    const cart = await this.fetch();
    this.renderDrawer(cart);
    this.updateCartCount(cart.item_count);
  },

  updateCartCount(count) {
    $$('.cart-count').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  },

  renderDrawer(cart) {
    const body = this.drawer.querySelector('.cart-drawer__body');
    const subtotalEl = this.drawer.querySelector('.cart-drawer__subtotal-price');
    const countEl = this.drawer.querySelector('.cart-drawer__count');

    if (countEl) countEl.textContent = '(' + cart.item_count + ')';
    if (subtotalEl) subtotalEl.textContent = formatMoney(cart.total_price);

    if (!body) return;

    if (cart.item_count === 0) {
      body.innerHTML = `
        <div class="cart-drawer__empty">
          <p class="cart-drawer__empty-text">Your cart is empty</p>
          <a href="/collections/shop" class="btn btn--primary">Shop our products</a>
        </div>`;
      return;
    }

    const itemsHtml = cart.items.map(item => `
      <div class="cart-item" data-cart-item data-key="${item.key}">
        <div class="cart-item__image">
          <a href="${item.url}">
            <img src="${item.featured_image ? item.featured_image.url + '&width=200' : ''}" alt="${item.title}" loading="lazy">
          </a>
        </div>
        <div class="cart-item__info">
          <p class="cart-item__title"><a href="${item.url}">${item.product_title}</a></p>
          ${item.variant_title ? `<p class="cart-item__variant">${item.variant_title}</p>` : ''}
          <p class="cart-item__price">${formatMoney(item.final_line_price)}</p>
          <div class="cart-item__actions">
            <div class="cart-item__qty">
              <button data-qty-minus aria-label="Decrease quantity">−</button>
              <span class="cart-item__qty-num" data-qty-value>${item.quantity}</span>
              <button data-qty-plus aria-label="Increase quantity">+</button>
            </div>
            <button class="cart-item__remove" data-remove-item>Remove</button>
          </div>
        </div>
      </div>`).join('');

    body.innerHTML = `<div class="cart-drawer__items">${itemsHtml}</div>`;
  }
};

/* =============================================================================
   PRODUCT FORM — VARIANT SELECTOR
   ============================================================================= */
function initVariantSelectors() {
  $$('.product-form').forEach(function(form) {
    const variantButtons = $$('.variant-btn', form);
    const priceEl = form.closest('.product-info') ? form.closest('.product-info').querySelector('.product-info__price') : null;
    const hiddenInput = form.querySelector('[name="id"]');

    // Group buttons by option index
    variantButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const optionIndex = this.dataset.optionIndex;
        $$('.variant-btn[data-option-index="' + optionIndex + '"]', form).forEach(function(b) {
          b.classList.remove('is-active');
        });
        this.classList.add('is-active');
        updateVariant(form, hiddenInput, priceEl);
      });
    });

    // Add to cart
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      const variantId = hiddenInput ? hiddenInput.value : null;
      if (!variantId) return;

      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';
      }

      try {
        await CartDrawer.addItem(variantId, 1);
        await CartDrawer.refresh();
        if (window.cartType === 'drawer') CartDrawer.open();
        else window.location.href = window.routes.cart;
      } catch (err) {
        console.error(err);
        if (submitBtn) submitBtn.textContent = 'Error — try again';
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          setTimeout(() => { submitBtn.textContent = 'Add to Cart'; }, 2000);
        }
      }
    });
  });
}

function updateVariant(form, hiddenInput, priceEl) {
  const selectedOptions = [];
  const optionGroups = {};

  $$('.variant-btn.is-active', form).forEach(function(btn) {
    optionGroups[btn.dataset.optionIndex] = btn.dataset.value;
  });

  const indices = Object.keys(optionGroups).sort();
  indices.forEach(function(i) { selectedOptions.push(optionGroups[i]); });

  const variantsData = form.dataset.variants;
  if (!variantsData) return;

  try {
    const variants = JSON.parse(variantsData);
    const matched = variants.find(function(v) {
      return v.options.every(function(opt, i) {
        return opt === selectedOptions[i];
      });
    });

    if (matched) {
      if (hiddenInput) hiddenInput.value = matched.id;
      if (priceEl) priceEl.textContent = formatMoney(matched.price);

      // Update availability
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) {
        if (matched.available) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Add to Cart';
        } else {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Sold Out';
        }
      }
    }
  } catch (e) {
    console.error('Variant parse error', e);
  }
}

/* =============================================================================
   PRODUCT GALLERY
   ============================================================================= */
function initProductGallery() {
  $$('.product-gallery').forEach(function(gallery) {
    const mainImg = gallery.querySelector('.product-gallery__main img');
    const thumbs = $$('.product-gallery__thumb', gallery);

    thumbs.forEach(function(thumb) {
      thumb.addEventListener('click', function() {
        const src = this.dataset.src;
        const alt = this.dataset.alt || '';
        if (mainImg && src) {
          mainImg.src = src;
          mainImg.alt = alt;
        }
        thumbs.forEach(t => t.classList.remove('is-active'));
        this.classList.add('is-active');
      });
    });

    // Touch swipe on main image
    if (mainImg) {
      let startX = 0;
      mainImg.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
      mainImg.addEventListener('touchend', function(e) {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) < 50) return;
        const activeThumb = gallery.querySelector('.product-gallery__thumb.is-active');
        const index = thumbs.indexOf(activeThumb);
        if (diff > 0 && index < thumbs.length - 1) thumbs[index + 1].click();
        else if (diff < 0 && index > 0) thumbs[index - 1].click();
      }, { passive: true });
    }
  });
}

/* =============================================================================
   PRODUCT TABS
   ============================================================================= */
function initProductTabs() {
  $$('.product-tabs').forEach(function(tabs) {
    const tabBtns = $$('.product-tabs__tab', tabs);
    const panels = $$('.product-tabs__panel', tabs);

    tabBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const target = this.dataset.tab;

        tabBtns.forEach(t => t.classList.remove('is-active'));
        panels.forEach(p => p.classList.remove('is-active'));

        this.classList.add('is-active');
        const panel = tabs.querySelector('.product-tabs__panel[data-tab="' + target + '"]');
        if (panel) panel.classList.add('is-active');
      });
    });

    // Activate first tab by default
    if (tabBtns[0]) tabBtns[0].click();
  });
}

/* =============================================================================
   COLLECTION FILTERS
   ============================================================================= */
function initCollectionFilters() {
  // Filter group accordion
  $$('.collection-filters__group').forEach(function(group) {
    const heading = group.querySelector('.collection-filters__heading');
    if (!heading) return;

    heading.addEventListener('click', function() {
      group.classList.toggle('is-open');
    });

    // Open first group by default
    if (group === $('.collection-filters__group')) group.classList.add('is-open');
  });

  // Filter form — AJAX collection update
  const filterForm = $('.collection-filters-form');
  if (!filterForm) return;

  filterForm.addEventListener('change', function() {
    const url = new URL(window.location.href);
    const formData = new FormData(filterForm);

    // Clear existing filter params
    Array.from(url.searchParams.keys()).forEach(key => {
      if (key.startsWith('filter.')) url.searchParams.delete(key);
    });

    // Set new filter params
    for (const [key, value] of formData.entries()) {
      if (value) url.searchParams.append(key, value);
    }

    // Preserve sort
    const sortSelect = $('.collection-toolbar__sort select');
    if (sortSelect && sortSelect.value) {
      url.searchParams.set('sort_by', sortSelect.value);
    }

    window.history.pushState({}, '', url.toString());
    fetchCollection(url.toString());
  });

  // Sort change
  const sortSelect = $('.collection-toolbar__sort select');
  if (sortSelect) {
    sortSelect.addEventListener('change', function() {
      const url = new URL(window.location.href);
      url.searchParams.set('sort_by', this.value);
      window.history.pushState({}, '', url.toString());
      fetchCollection(url.toString());
    });
  }

  // Remove active filter tag
  document.addEventListener('click', function(e) {
    const removeBtn = e.target.closest('[data-remove-filter]');
    if (!removeBtn) return;
    const param = removeBtn.dataset.removeFilter;
    const val = removeBtn.dataset.removeValue;
    const url = new URL(window.location.href);

    if (val) {
      const existing = url.searchParams.getAll(param).filter(v => v !== val);
      url.searchParams.delete(param);
      existing.forEach(v => url.searchParams.append(param, v));
    } else {
      url.searchParams.delete(param);
    }

    window.history.pushState({}, '', url.toString());
    fetchCollection(url.toString());
  });

  window.addEventListener('popstate', function() {
    fetchCollection(window.location.href);
  });
}

async function fetchCollection(url) {
  const grid = $('.product-grid-container');
  const toolbar = $('.collection-toolbar');
  const activeFilters = $('.active-filters-container');

  if (grid) grid.style.opacity = '0.5';

  try {
    const response = await fetch(url + (url.includes('?') ? '&' : '?') + 'sections=collection-grid');
    const data = await response.json();

    if (data['collection-grid']) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(data['collection-grid'], 'text/html');
      const newGrid = doc.querySelector('.product-grid-container');
      const newToolbar = doc.querySelector('.collection-toolbar');
      const newActiveFilters = doc.querySelector('.active-filters-container');

      if (grid && newGrid) grid.innerHTML = newGrid.innerHTML;
      if (toolbar && newToolbar) toolbar.innerHTML = newToolbar.innerHTML;
      if (activeFilters && newActiveFilters) activeFilters.innerHTML = newActiveFilters.innerHTML;
    }
  } catch (e) {
    console.error('Filter fetch error', e);
    window.location.href = url;
  } finally {
    if (grid) grid.style.opacity = '1';
  }
}

/* =============================================================================
   ANNOUNCEMENT MARQUEE (optional)
   ============================================================================= */
function initAnnouncementMarquee() {
  const bar = $('.announcement-bar--marquee');
  if (!bar) return;

  const text = bar.querySelector('.announcement-bar__text');
  if (!text) return;

  const clone = text.cloneNode(true);
  bar.appendChild(clone);
  bar.style.overflow = 'hidden';

  let pos = 0;
  const speed = 0.4;

  function animate() {
    pos -= speed;
    if (Math.abs(pos) >= text.offsetWidth + 40) pos = 0;
    text.style.transform = `translateX(${pos}px)`;
    clone.style.transform = `translateX(${pos + text.offsetWidth + 40}px)`;
    requestAnimationFrame(animate);
  }

  animate();
}

/* =============================================================================
   INIT
   ============================================================================= */
document.addEventListener('DOMContentLoaded', function() {
  initStickyHeader();
  initMobileMenu();
  CartDrawer.init();
  initVariantSelectors();
  initProductGallery();
  initProductTabs();
  initCollectionFilters();
  initAnnouncementMarquee();
});
