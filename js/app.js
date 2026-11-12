/* Fenix Aromatic - comportamiento del sitio
   1) Botón "Compartir": precarga la publicación (texto + enlace + foto) en el menú de compartir del celular.
   2) Formulario "Personalizar": actualiza la vista previa y arma el mensaje de WhatsApp con las opciones elegidas.
   Los datos (número de WhatsApp, marca, textos) vienen de content/*.json, cargados por js/contenido.js. */
(function () {
  'use strict';

  function ajustes() { return (window.FENIX && window.FENIX.ajustes) || {}; }
  function marca() { return ajustes().marca || 'Fenix Aromatic'; }
  function numeroWhatsApp() { return ajustes().whatsapp || ''; }
  function datosPersonalizar() { return (window.FENIX && window.FENIX.datos && window.FENIX.datos.personalizar) || {}; }

  /* ---------- Aviso breve ---------- */
  var toast = document.getElementById('toast');
  var toastTimer;
  function aviso(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 4500);
  }

  /* ---------- Compartir ---------- */
  var puedeCompartir = typeof navigator.share === 'function';
  var fotos = {}; // id de tarjeta -> File (se precarga para no perder el gesto del toque)

  function datosTarjeta(card) {
    var h3 = card.querySelector('h3');
    var img = card.querySelector('.card-art img');
    var base = location.href.split('#')[0];
    return {
      id: h3 ? h3.id : '',
      nombre: h3 ? h3.textContent.trim() : '',
      precio: (card.querySelector('.price') || {}).textContent || '',
      detalle: (card.querySelector('.meta') || {}).textContent || '',
      ref: card.getAttribute('data-ref') || '',
      imgSrc: img ? img.currentSrc || img.src : '',
      url: base + (h3 && h3.id ? '#' + h3.id : '#catalogo')
    };
  }

  function armarTexto(d) {
    var lineas = [
      '🕯️ ' + d.nombre + ' · ' + marca(),
      d.detalle.trim(),
      d.precio.trim() + (d.ref ? ' · Ref. ' + d.ref : ''),
      ajustes().texto_compartir_cierre
    ];
    return lineas.filter(Boolean).join('\n');
  }

  function precargarFoto(card) {
    var d = datosTarjeta(card);
    if (!d.imgSrc || !d.id || fotos[d.id]) return;
    fetch(d.imgSrc)
      .then(function (r) { return r.ok ? r.blob() : Promise.reject(); })
      .then(function (blob) {
        var ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        var file = new File([blob], d.id + '-fenix-aromatic.' + ext, { type: blob.type || 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) fotos[d.id] = file;
      })
      .catch(function () { /* sin foto: se comparte solo texto y enlace */ });
  }

  // La foto de cada tarjeta se precarga recién cuando la tarjeta aparece en pantalla:
  // la imagen ya se está descargando por loading="lazy", así que no se baja dos veces
  // ni se piden todas las fotos de entrada (ahorra datos en el celular).
  function precargarFotos() {
    if (!puedeCompartir || typeof navigator.canShare !== 'function' || !window.fetch || !window.File) return;
    var tarjetas = document.querySelectorAll('.card');
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(tarjetas, precargarFoto);
      return;
    }
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (!en.isIntersecting) return;
        obs.unobserve(en.target);
        precargarFoto(en.target);
      });
    }, { rootMargin: '200px 0px' });
    Array.prototype.forEach.call(tarjetas, function (c) { obs.observe(c); });
  }

  function copiar(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto);
    }
    return new Promise(function (ok, fail) {
      var ta = document.createElement('textarea');
      ta.value = texto;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? ok() : fail(); } catch (e) { fail(e); }
      document.body.removeChild(ta);
    });
  }

  function descargarFoto(d) {
    if (!d.imgSrc) return false;
    var a = document.createElement('a');
    a.href = d.imgSrc;
    var ext = (d.imgSrc.split('?')[0].split('.').pop() || 'jpg').toLowerCase().replace('jpeg', 'jpg');
    a.download = d.id + '-fenix-aromatic.' + ext;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  function compartir(btn) {
    var card = btn.closest('.card');
    if (!card) return;
    var d = datosTarjeta(card);
    var texto = armarTexto(d);
    var payload = { title: d.nombre + ' · ' + marca(), text: texto, url: d.url };

    function respaldo() {
      // 1) Abrir Instagram (si el navegador lo bloquea, no pasa nada: igual seguimos).
      window.open('https://www.instagram.com/', '_blank', 'noopener');
      // 2) Descargar la foto de la vela.
      var fotoOk = descargarFoto(d);
      // 3) Copiar el texto.
      copiar(texto + '\n' + d.url).then(
        function () {
          aviso('Instagram abierto, texto copiado' + (fotoOk ? ' y foto descargada' : '') +
            '. Creá la publicación (+), elegí la foto y pegá el texto.');
        },
        function () { aviso('No pudimos copiar el texto. Probá desde otro navegador.'); }
      );
    }

    if (!puedeCompartir) { respaldo(); return; }

    var conFoto = fotos[d.id] ? { title: payload.title, text: texto + '\n' + d.url, files: [fotos[d.id]] } : null;
    var intento = conFoto && navigator.canShare && navigator.canShare(conFoto) ? conFoto : payload;

    navigator.share(intento).catch(function (err) {
      if (err && err.name === 'AbortError') return; // la persona canceló
      // Si falló con foto, probamos solo con texto y enlace; si no, copiamos al portapapeles.
      if (intento === conFoto) {
        navigator.share(payload).catch(function (e2) {
          if (!e2 || e2.name !== 'AbortError') respaldo();
        });
      } else {
        respaldo();
      }
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-share]');
    if (btn) { e.preventDefault(); compartir(btn); }
  });

  /* ---------- Formulario "Personalizar": vista previa + pedido por WhatsApp ---------- */
  function iniciarFormulario() {
    var form = document.getElementById('form-personalizar');
    if (!form) return;
    var grilla = form.closest('.custom-grid');
    var resumen = document.getElementById('resumen-vela');
    var otraForma = document.getElementById('otra-forma');

    function marcado(nombre) {
      return form.querySelector('input[name="' + nombre + '"]:checked');
    }
    function esOtraForma() {
      var f = marcado('Forma');
      return !!f && f.getAttribute('data-clave') === 'otra';
    }

    // Color de la vela, texto de resumen y campo obligatorio de "Otra forma…"
    function sincronizar() {
      if (otraForma) otraForma.required = esOtraForma();

      var color = marcado('Color');
      var hex = color && color.getAttribute('data-hex');
      if (grilla) {
        if (hex) grilla.style.setProperty('--candle', hex);
        else grilla.style.removeProperty('--candle');
      }

      if (resumen) {
        var aroma = marcado('Aroma');
        var forma = marcado('Forma');
        var nombreForma = forma ? (esOtraForma() ? (datosPersonalizar().resumen_otra_forma || forma.value) : forma.value) : '';
        resumen.textContent = [aroma && aroma.value, color && color.value, nombreForma]
          .filter(Boolean).join(' \u00b7 ');
      }
    }
    form.addEventListener('change', sincronizar);
    sincronizar();

    function valor(nombre) {
      var el = marcado(nombre);
      return el ? el.value : '';
    }
    function texto(id) {
      var el = document.getElementById(id);
      return el ? el.value.replace(/\s+/g, ' ').trim() : '';
    }

    function armarMensaje() {
      var P = datosPersonalizar();
      var aroma = valor('Aroma');
      var color = valor('Color');
      var otroColor = texto('otro-color');
      var forma = valor('Forma');
      var otra = texto('otra-forma');
      var cant = parseInt(document.getElementById('cantidad').value, 10);
      if (!(cant >= 1)) cant = 1;
      if (cant > 99) cant = 99;
      var notas = document.getElementById('notas').value.trim();

      var inicio = P.whatsapp_inicio || ('Hola ' + marca() + ', quiero pedir una vela personalizada:');
      var cierre = P.whatsapp_cierre || '¿Me confirmás precio y tiempos? ¡Gracias!';
      var lineas = [inicio, ''];
      if (aroma) lineas.push('• *Aroma:* ' + aroma);
      if (otroColor) lineas.push('• *Color:* ' + otroColor + ' (otro color)');
      else if (color) lineas.push('• *Color:* ' + color);
      if (esOtraForma()) lineas.push('• *Forma:* ' + (otra || 'a definir') + ' (a confirmar)');
      else if (forma) lineas.push('• *Forma:* ' + forma);
      lineas.push('• *Cantidad:* ' + cant);
      if (notas) lineas.push('• *Notas:* ' + notas);
      lineas.push('', cierre);
      return lineas.join('\n');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var url = 'https://wa.me/' + numeroWhatsApp() + '?text=' + encodeURIComponent(armarMensaje());
      // Con 'noopener', window.open siempre devuelve null: no sirve para detectar si se abrió.
      // Un enlace temporal abre WhatsApp en una pestaña nueva sin sacar a la persona del sitio.
      var a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  /* ---------- Arranque: espera a que js/contenido.js arme la página ---------- */
  var iniciado = false;
  function iniciar() {
    if (iniciado) return;
    iniciado = true;
    if ('requestIdleCallback' in window) requestIdleCallback(precargarFotos);
    else setTimeout(precargarFotos, 300);
    iniciarFormulario();
  }
  if (window.FENIX && window.FENIX.listo) iniciar();
  else document.addEventListener('fenix:listo', iniciar);
})();
