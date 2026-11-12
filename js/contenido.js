/* Fenix Aromatic - contenido editable
   Lee los archivos de content/*.json (los que se editan desde /admin con Decap CMS)
   y arma la página: textos, hero, tarjetas del catálogo y opciones de "Personalizar".
   Cuando termina avisa con el evento "fenix:listo" para que js/app.js active Compartir y el formulario. */
(function () {
  'use strict';

  var ARCHIVOS = ['ajustes', 'inicio', 'catalogo', 'personalizar', 'contacto', 'instagram'];
  var FORMAS_VALIDAS = ['cilindro', 'pilar', 'cono', 'esfera', 'cubo', 'jar', 'otra'];
  var F = window.FENIX = { datos: {}, ajustes: {}, listo: false };
  var D = F.datos;

  /* ---------- Utilidades ---------- */
  function texto(x) { return x == null ? '' : String(x); }
  function lista(x) { return Array.isArray(x) ? x : []; }
  function esc(s) {
    return texto(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Las imágenes del CMS se guardan como "/img/archivo.jpg"; las dejamos relativas ("img/archivo.jpg").
  function ruta(p) {
    p = texto(p).trim();
    if (!p) return '';
    if (/^(https?:)?\/\//i.test(p) || /^data:image\//i.test(p)) return p;
    return p.replace(/^\/+/, '');
  }
  function urlSegura(u) {
    u = texto(u).trim();
    return /^https?:\/\//i.test(u) ? u : '';
  }
  function colorSeguro(c) {
    c = texto(c).trim();
    return /^#[0-9a-f]{3,8}$/i.test(c) ? c : '#cccccc';
  }
  function slug(s) {
    return texto(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function wa(mensaje) {
    var url = 'https://wa.me/' + F.ajustes.whatsapp;
    return mensaje ? url + '?text=' + encodeURIComponent(mensaje) : url;
  }
  function valor(ruta) {
    var p = ruta.split('.');
    var o = D[p[0]];
    return o ? o[p[1]] : undefined;
  }
  function indiceInicial(arr) {
    for (var i = 0; i < arr.length; i++) if (arr[i].inicial === true) return i;
    return 0;
  }
  function porId(id) { return document.getElementById(id); }
  function todos(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  var ICO_WA = '<svg class="ico" aria-hidden="true"><use href="#i-wa"/></svg>';
  var ICO_IG = '<svg class="ico" aria-hidden="true"><use href="#i-ig"/></svg>';

  /* ---------- Carga ---------- */
  function cargar(nombre) {
    return fetch('content/' + nombre + '.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('content/' + nombre + '.json (' + r.status + ')');
        return r.json();
      })
      .then(function (j) { D[nombre] = j || {}; })
      .catch(function (e) { console.error('No se pudo leer', e); D[nombre] = D[nombre] || {}; });
  }

  /* ---------- Textos y enlaces ---------- */
  function enlazarTextos() {
    todos('[data-c]').forEach(function (el) {
      var v = texto(valor(el.getAttribute('data-c')));
      el.textContent = v;
      el.style.display = v ? '' : 'none';
    });
    todos('[data-c-ph]').forEach(function (el) {
      el.setAttribute('placeholder', texto(valor(el.getAttribute('data-c-ph'))));
    });
  }

  function enlaces() {
    var marca = texto(D.ajustes.marca) || 'Fenix Aromatic';
    var general = wa(texto(D.ajustes.mensaje_consulta_general));
    todos('[data-wa="general"]').forEach(function (a) { a.href = general; });

    var ig = urlSegura(D.instagram.url);
    todos('[data-ig]').forEach(function (a) {
      if (ig) a.href = ig; else a.style.display = 'none';
    });

    var aria = {
      inicio: marca + ', inicio',
      arriba: marca + ', volver arriba',
      instagram: 'Instagram de ' + marca
    };
    todos('[data-aria]').forEach(function (a) {
      var t = aria[a.getAttribute('data-aria')];
      if (t) a.setAttribute('aria-label', t);
    });
  }

  function metadatos() {
    var marca = texto(D.ajustes.marca) || 'Fenix Aromatic';
    document.title = texto(D.ajustes.titulo_pagina) || marca;
    var desc = texto(D.ajustes.descripcion_pagina);
    var meta = document.querySelector('meta[name="description"]');
    if (meta && desc) meta.setAttribute('content', desc);
  }

  /* ---------- Vela destacada ---------- */
  function hero() {
    var h = D.inicio;
    var img = porId('hero-img');
    var src = ruta(h.imagen);
    if (src) {
      img.src = src;
      img.alt = texto(h.imagen_alt);
    } else {
      img.parentNode.style.display = 'none';
    }
    var nombre = texto(h.titulo).replace(/[.\s]+$/, '');
    var prefijo = texto(D.ajustes.mensaje_consulta_producto).trim();
    porId('hero-wa').href = wa((prefijo + ' ' + nombre).trim());
  }

  /* ---------- Catálogo ---------- */
  function catalogo() {
    var c = D.catalogo;
    var grid = porId('grid-catalogo');
    var productos = lista(c.productos);
    if (!productos.length) {
      grid.innerHTML = '';
      return;
    }
    var prefijo = texto(D.ajustes.mensaje_consulta_producto).trim();
    var btnConsultar = texto(c.boton_consultar);
    var btnCompartir = texto(c.boton_compartir);
    var usados = {};
    var html = '';

    productos.forEach(function (p, i) {
      if (!p || p.visible === false || !texto(p.nombre).trim()) return;
      var nombre = texto(p.nombre).trim();
      var ref = texto(p.ref).trim() || ('FA-' + ('00' + (i + 1)).slice(-3));
      var id = slug(ref) || ('producto-' + (i + 1));
      while (usados[id]) id += '-b';
      usados[id] = true;

      var mensaje = (prefijo + ' ' + nombre + ' (Ref. ' + ref + ')').trim();
      var src = ruta(p.imagen);

      html +=
        '<article class="card" aria-labelledby="' + esc(id) + '" data-ref="' + esc(ref) + '">' +
          '<div class="card-art">' +
            (src ? '<img src="' + esc(src) + '" alt="' + esc(p.imagen_alt || nombre) + '" loading="lazy">' : '') +
          '</div>' +
          '<div class="card-head"><h3 id="' + esc(id) + '">' + esc(nombre) + '</h3>' +
            (texto(p.precio).trim() ? '<span class="price">' + esc(p.precio) + '</span>' : '') +
          '</div>' +
          (texto(p.descripcion).trim() ? '<p class="meta">' + esc(p.descripcion) + '</p>' : '') +
          '<div class="card-actions">' +
            '<a class="btn btn-dark" href="' + esc(wa(mensaje)) + '" target="_blank" rel="noopener">' + ICO_WA + esc(btnConsultar) + '</a>' +
            '<button class="btn btn-line" type="button" data-share aria-label="' + esc((btnCompartir + ' ' + nombre).trim()) + '">' + ICO_IG + esc(btnCompartir) + '</button>' +
          '</div>' +
        '</article>';
    });
    grid.innerHTML = html;
  }

  /* ---------- Personalizar ---------- */
  function ocultarSiVacio(contenedor, hayItems) {
    var fs = contenedor.closest('fieldset');
    if (fs) fs.style.display = hayItems ? '' : 'none';
  }

  function personalizar() {
    var p = D.personalizar;

    // Aromas (el primero queda marcado)
    var aromas = lista(p.aromas).map(texto).map(function (a) { return a.trim(); }).filter(Boolean);
    var contAromas = porId('lista-aromas');
    contAromas.innerHTML = aromas.map(function (a, i) {
      return '<label class="chip"><input type="radio" name="Aroma" id="aroma-' + i + '" value="' + esc(a) + '"' +
        (i === 0 ? ' checked' : '') + '><span>' + esc(a) + '</span></label>';
    }).join('');
    ocultarSiVacio(contAromas, aromas.length > 0);

    // Colores
    var colores = lista(p.colores).filter(function (c) { return c && texto(c.nombre).trim(); });
    var iniColor = indiceInicial(colores);
    var contColores = porId('lista-colores');
    contColores.innerHTML = colores.map(function (c, i) {
      var nombre = texto(c.nombre).trim();
      var hex = colorSeguro(c.hex);
      return '<label class="swatch" title="' + esc(nombre) + '"><input type="radio" name="Color" id="color-' + i + '"' +
        ' value="' + esc(nombre) + '" aria-label="' + esc(nombre) + '" data-hex="' + esc(hex) + '"' +
        (i === iniColor ? ' checked' : '') + '><span style="background:' + esc(hex) + '"></span></label>';
    }).join('');

    // Formas (los dibujos de la vista previa son fijos: solo se puede cambiar el nombre, el orden y si se muestran)
    var formas = lista(p.formas).filter(function (f) {
      return f && FORMAS_VALIDAS.indexOf(f.clave) !== -1 && f.visible !== false && texto(f.nombre).trim();
    });
    var iniForma = indiceInicial(formas);
    var contFormas = porId('lista-formas');
    contFormas.innerHTML = formas.map(function (f, i) {
      var nombre = texto(f.nombre).trim();
      return '<label class="chip"><input type="radio" name="Forma" id="shape-' + esc(f.clave) + '" value="' + esc(nombre) + '"' +
        ' data-clave="' + esc(f.clave) + '"' + (i === iniForma ? ' checked' : '') + '><span>' + esc(nombre) + '</span></label>';
    }).join('');
    ocultarSiVacio(contFormas, formas.length > 0);
    var hayOtra = formas.some(function (f) { return f.clave === 'otra'; });
    var otro = document.querySelector('.shape-other');
    if (otro && !hayOtra) otro.style.display = 'none';
  }

  /* ---------- Arranque ---------- */
  function iniciar() {
    F.ajustes = D.ajustes;
    F.ajustes.whatsapp = texto(F.ajustes.whatsapp).replace(/\D/g, '');
    enlazarTextos();
    enlaces();
    metadatos();
    hero();
    catalogo();
    personalizar();
  }

  function irAlAncla() {
    if (location.hash.length < 2) return;
    try {
      var el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) el.scrollIntoView();
    } catch (e) { /* ancla inválida: se ignora */ }
  }

  function listo() {
    document.documentElement.classList.remove('cargando');
    F.listo = true;
    document.dispatchEvent(new CustomEvent('fenix:listo'));
    irAlAncla();
  }

  Promise.all(ARCHIVOS.map(cargar))
    .then(function () {
      try { iniciar(); } catch (e) { console.error(e); }
      listo();
    });
})();
