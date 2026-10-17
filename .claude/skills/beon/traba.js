// Traba para LEER BeOn sin escribir nada (skill beon §0 y §10). Se pega con javascript_tool en cada pagina nueva de
// BeOn, antes del primer clic. Hasta el 17/10/2026 vivia solo como un parrafo que se reescribia a mano cada vez
// (tanda 12): ahora es este archivo, y __tests__/scripts/beonTraba.test.mjs lo prueba sobre una ventana simulada.
//
// Lo que hace, como lo dice la skill: window.confirm anota el mensaje y devuelve false; formSubmit y formSubmit2 dejan
// pasar SOLO search, nextSearch, reset, changeCard y openEmpb[n] (lo demas se corta y se anota). Ademas corta
// buttonConfirm / buttonConfirmOk, el cartel propio de BeOn («¿Realmente quiere realizar esta accion?», §7), que no
// pasa por window.confirm. cardSubmit (las pestañas de arriba) no se toca: solo navega.
// Lo cortado queda en window.__trabaBeon.cortados. Limite: lo prueba una ventana simulada; en el portal no se volvio a
// probar desde que es archivo (tanda 12 sin acceso a BeOn).
(function (w) {
  if (w.__trabaBeon) return 'traba ya puesta (' + w.__trabaBeon.cortados.length + ' cortados)';
  var PERMITIDOS = /^(search|nextSearch|reset|changeCard|openEmpb\[\d+\])$/;
  var traba = { cortados: [] };
  w.__trabaBeon = traba;
  w.confirm = function (m) { traba.cortados.push('confirm: ' + m); return false; };
  var envueltas = 0;
  ['formSubmit', 'formSubmit2'].forEach(function (n) {
    var orig = w[n];
    if (typeof orig !== 'function') return;
    envueltas += 1;
    w[n] = function (accion) {
      if (PERMITIDOS.test(String(accion))) return orig.apply(this, arguments);
      traba.cortados.push(n + ': ' + accion);
      return false;
    };
  });
  ['buttonConfirm', 'buttonConfirmOk'].forEach(function (n) {
    if (typeof w[n] !== 'function') return;
    w[n] = function (accion) { traba.cortados.push(n + ': ' + (accion === undefined ? '' : accion)); return false; };
  });
  // Auditor de la tanda 12: sin formSubmit ni formSubmit2 en la pagina no hay nada que trabar, y decir "traba puesta"
  // seria un verde vacio (la pagina todavia no cargo, o BeOn cambio el nombre de la funcion).
  // Y sin marcar la traba como puesta: pegarla otra vez, con la pagina ya cargada, tiene que trabar de verdad.
  if (!envueltas) { delete w.__trabaBeon; return 'OJO: NO hay traba: la pagina no tiene formSubmit ni formSubmit2 (¿no termino de cargar?). No hacer clic.'; }
  return 'traba puesta';
})(typeof window !== 'undefined' ? window : globalThis);
