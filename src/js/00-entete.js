
(function () {
'use strict';
/* =========================================================================
   Ardoise — éditeur de page autonome. Le document vit dans le JSON
   #ardoise-doc ci-dessus ; à l'enregistrement le fichier se réécrit lui-même.
   ========================================================================= */
var VERSION = 1;
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var uid = function () { return Math.random().toString(36).slice(2, 9); };
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var app = $('#app');
var LS = 'ardoise:';

