var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? undefined : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        if (value != null || input.value) {
            input.value = value;
        }
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment && $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined' ? window : global);

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, props) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (key, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
                return ret;
            })
            : prop_values;
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /*
     * anime.js v3.1.0
     * (c) 2019 Julian Garnier
     * Released under the MIT license
     * animejs.com
     */

    // Defaults

    var defaultInstanceSettings = {
      update: null,
      begin: null,
      loopBegin: null,
      changeBegin: null,
      change: null,
      changeComplete: null,
      loopComplete: null,
      complete: null,
      loop: 1,
      direction: 'normal',
      autoplay: true,
      timelineOffset: 0
    };

    var defaultTweenSettings = {
      duration: 1000,
      delay: 0,
      endDelay: 0,
      easing: 'easeOutElastic(1, .5)',
      round: 0
    };

    var validTransforms = ['translateX', 'translateY', 'translateZ', 'rotate', 'rotateX', 'rotateY', 'rotateZ', 'scale', 'scaleX', 'scaleY', 'scaleZ', 'skew', 'skewX', 'skewY', 'perspective'];

    // Caching

    var cache = {
      CSS: {},
      springs: {}
    };

    // Utils

    function minMax(val, min, max) {
      return Math.min(Math.max(val, min), max);
    }

    function stringContains(str, text) {
      return str.indexOf(text) > -1;
    }

    function applyArguments(func, args) {
      return func.apply(null, args);
    }

    var is = {
      arr: function (a) { return Array.isArray(a); },
      obj: function (a) { return stringContains(Object.prototype.toString.call(a), 'Object'); },
      pth: function (a) { return is.obj(a) && a.hasOwnProperty('totalLength'); },
      svg: function (a) { return a instanceof SVGElement; },
      inp: function (a) { return a instanceof HTMLInputElement; },
      dom: function (a) { return a.nodeType || is.svg(a); },
      str: function (a) { return typeof a === 'string'; },
      fnc: function (a) { return typeof a === 'function'; },
      und: function (a) { return typeof a === 'undefined'; },
      hex: function (a) { return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(a); },
      rgb: function (a) { return /^rgb/.test(a); },
      hsl: function (a) { return /^hsl/.test(a); },
      col: function (a) { return (is.hex(a) || is.rgb(a) || is.hsl(a)); },
      key: function (a) { return !defaultInstanceSettings.hasOwnProperty(a) && !defaultTweenSettings.hasOwnProperty(a) && a !== 'targets' && a !== 'keyframes'; }
    };

    // Easings

    function parseEasingParameters(string) {
      var match = /\(([^)]+)\)/.exec(string);
      return match ? match[1].split(',').map(function (p) { return parseFloat(p); }) : [];
    }

    // Spring solver inspired by Webkit Copyright © 2016 Apple Inc. All rights reserved. https://webkit.org/demos/spring/spring.js

    function spring(string, duration) {

      var params = parseEasingParameters(string);
      var mass = minMax(is.und(params[0]) ? 1 : params[0], .1, 100);
      var stiffness = minMax(is.und(params[1]) ? 100 : params[1], .1, 100);
      var damping = minMax(is.und(params[2]) ? 10 : params[2], .1, 100);
      var velocity =  minMax(is.und(params[3]) ? 0 : params[3], .1, 100);
      var w0 = Math.sqrt(stiffness / mass);
      var zeta = damping / (2 * Math.sqrt(stiffness * mass));
      var wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : 0;
      var a = 1;
      var b = zeta < 1 ? (zeta * w0 + -velocity) / wd : -velocity + w0;

      function solver(t) {
        var progress = duration ? (duration * t) / 1000 : t;
        if (zeta < 1) {
          progress = Math.exp(-progress * zeta * w0) * (a * Math.cos(wd * progress) + b * Math.sin(wd * progress));
        } else {
          progress = (a + b * progress) * Math.exp(-progress * w0);
        }
        if (t === 0 || t === 1) { return t; }
        return 1 - progress;
      }

      function getDuration() {
        var cached = cache.springs[string];
        if (cached) { return cached; }
        var frame = 1/6;
        var elapsed = 0;
        var rest = 0;
        while(true) {
          elapsed += frame;
          if (solver(elapsed) === 1) {
            rest++;
            if (rest >= 16) { break; }
          } else {
            rest = 0;
          }
        }
        var duration = elapsed * frame * 1000;
        cache.springs[string] = duration;
        return duration;
      }

      return duration ? solver : getDuration;

    }

    // Basic steps easing implementation https://developer.mozilla.org/fr/docs/Web/CSS/transition-timing-function

    function steps(steps) {
      if ( steps === void 0 ) steps = 10;

      return function (t) { return Math.round(t * steps) * (1 / steps); };
    }

    // BezierEasing https://github.com/gre/bezier-easing

    var bezier = (function () {

      var kSplineTableSize = 11;
      var kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

      function A(aA1, aA2) { return 1.0 - 3.0 * aA2 + 3.0 * aA1 }
      function B(aA1, aA2) { return 3.0 * aA2 - 6.0 * aA1 }
      function C(aA1)      { return 3.0 * aA1 }

      function calcBezier(aT, aA1, aA2) { return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT }
      function getSlope(aT, aA1, aA2) { return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1) }

      function binarySubdivide(aX, aA, aB, mX1, mX2) {
        var currentX, currentT, i = 0;
        do {
          currentT = aA + (aB - aA) / 2.0;
          currentX = calcBezier(currentT, mX1, mX2) - aX;
          if (currentX > 0.0) { aB = currentT; } else { aA = currentT; }
        } while (Math.abs(currentX) > 0.0000001 && ++i < 10);
        return currentT;
      }

      function newtonRaphsonIterate(aX, aGuessT, mX1, mX2) {
        for (var i = 0; i < 4; ++i) {
          var currentSlope = getSlope(aGuessT, mX1, mX2);
          if (currentSlope === 0.0) { return aGuessT; }
          var currentX = calcBezier(aGuessT, mX1, mX2) - aX;
          aGuessT -= currentX / currentSlope;
        }
        return aGuessT;
      }

      function bezier(mX1, mY1, mX2, mY2) {

        if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) { return; }
        var sampleValues = new Float32Array(kSplineTableSize);

        if (mX1 !== mY1 || mX2 !== mY2) {
          for (var i = 0; i < kSplineTableSize; ++i) {
            sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
          }
        }

        function getTForX(aX) {

          var intervalStart = 0;
          var currentSample = 1;
          var lastSample = kSplineTableSize - 1;

          for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
            intervalStart += kSampleStepSize;
          }

          --currentSample;

          var dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
          var guessForT = intervalStart + dist * kSampleStepSize;
          var initialSlope = getSlope(guessForT, mX1, mX2);

          if (initialSlope >= 0.001) {
            return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
          } else if (initialSlope === 0.0) {
            return guessForT;
          } else {
            return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
          }

        }

        return function (x) {
          if (mX1 === mY1 && mX2 === mY2) { return x; }
          if (x === 0 || x === 1) { return x; }
          return calcBezier(getTForX(x), mY1, mY2);
        }

      }

      return bezier;

    })();

    var penner = (function () {

      // Based on jQuery UI's implemenation of easing equations from Robert Penner (http://www.robertpenner.com/easing)

      var eases = { linear: function () { return function (t) { return t; }; } };

      var functionEasings = {
        Sine: function () { return function (t) { return 1 - Math.cos(t * Math.PI / 2); }; },
        Circ: function () { return function (t) { return 1 - Math.sqrt(1 - t * t); }; },
        Back: function () { return function (t) { return t * t * (3 * t - 2); }; },
        Bounce: function () { return function (t) {
          var pow2, b = 4;
          while (t < (( pow2 = Math.pow(2, --b)) - 1) / 11) {}
          return 1 / Math.pow(4, 3 - b) - 7.5625 * Math.pow(( pow2 * 3 - 2 ) / 22 - t, 2)
        }; },
        Elastic: function (amplitude, period) {
          if ( amplitude === void 0 ) amplitude = 1;
          if ( period === void 0 ) period = .5;

          var a = minMax(amplitude, 1, 10);
          var p = minMax(period, .1, 2);
          return function (t) {
            return (t === 0 || t === 1) ? t : 
              -a * Math.pow(2, 10 * (t - 1)) * Math.sin((((t - 1) - (p / (Math.PI * 2) * Math.asin(1 / a))) * (Math.PI * 2)) / p);
          }
        }
      };

      var baseEasings = ['Quad', 'Cubic', 'Quart', 'Quint', 'Expo'];

      baseEasings.forEach(function (name, i) {
        functionEasings[name] = function () { return function (t) { return Math.pow(t, i + 2); }; };
      });

      Object.keys(functionEasings).forEach(function (name) {
        var easeIn = functionEasings[name];
        eases['easeIn' + name] = easeIn;
        eases['easeOut' + name] = function (a, b) { return function (t) { return 1 - easeIn(a, b)(1 - t); }; };
        eases['easeInOut' + name] = function (a, b) { return function (t) { return t < 0.5 ? easeIn(a, b)(t * 2) / 2 : 
          1 - easeIn(a, b)(t * -2 + 2) / 2; }; };
      });

      return eases;

    })();

    function parseEasings(easing, duration) {
      if (is.fnc(easing)) { return easing; }
      var name = easing.split('(')[0];
      var ease = penner[name];
      var args = parseEasingParameters(easing);
      switch (name) {
        case 'spring' : return spring(easing, duration);
        case 'cubicBezier' : return applyArguments(bezier, args);
        case 'steps' : return applyArguments(steps, args);
        default : return applyArguments(ease, args);
      }
    }

    // Strings

    function selectString(str) {
      try {
        var nodes = document.querySelectorAll(str);
        return nodes;
      } catch(e) {
        return;
      }
    }

    // Arrays

    function filterArray(arr, callback) {
      var len = arr.length;
      var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
      var result = [];
      for (var i = 0; i < len; i++) {
        if (i in arr) {
          var val = arr[i];
          if (callback.call(thisArg, val, i, arr)) {
            result.push(val);
          }
        }
      }
      return result;
    }

    function flattenArray(arr) {
      return arr.reduce(function (a, b) { return a.concat(is.arr(b) ? flattenArray(b) : b); }, []);
    }

    function toArray(o) {
      if (is.arr(o)) { return o; }
      if (is.str(o)) { o = selectString(o) || o; }
      if (o instanceof NodeList || o instanceof HTMLCollection) { return [].slice.call(o); }
      return [o];
    }

    function arrayContains(arr, val) {
      return arr.some(function (a) { return a === val; });
    }

    // Objects

    function cloneObject(o) {
      var clone = {};
      for (var p in o) { clone[p] = o[p]; }
      return clone;
    }

    function replaceObjectProps(o1, o2) {
      var o = cloneObject(o1);
      for (var p in o1) { o[p] = o2.hasOwnProperty(p) ? o2[p] : o1[p]; }
      return o;
    }

    function mergeObjects(o1, o2) {
      var o = cloneObject(o1);
      for (var p in o2) { o[p] = is.und(o1[p]) ? o2[p] : o1[p]; }
      return o;
    }

    // Colors

    function rgbToRgba(rgbValue) {
      var rgb = /rgb\((\d+,\s*[\d]+,\s*[\d]+)\)/g.exec(rgbValue);
      return rgb ? ("rgba(" + (rgb[1]) + ",1)") : rgbValue;
    }

    function hexToRgba(hexValue) {
      var rgx = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      var hex = hexValue.replace(rgx, function (m, r, g, b) { return r + r + g + g + b + b; } );
      var rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      var r = parseInt(rgb[1], 16);
      var g = parseInt(rgb[2], 16);
      var b = parseInt(rgb[3], 16);
      return ("rgba(" + r + "," + g + "," + b + ",1)");
    }

    function hslToRgba(hslValue) {
      var hsl = /hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/g.exec(hslValue) || /hsla\((\d+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\)/g.exec(hslValue);
      var h = parseInt(hsl[1], 10) / 360;
      var s = parseInt(hsl[2], 10) / 100;
      var l = parseInt(hsl[3], 10) / 100;
      var a = hsl[4] || 1;
      function hue2rgb(p, q, t) {
        if (t < 0) { t += 1; }
        if (t > 1) { t -= 1; }
        if (t < 1/6) { return p + (q - p) * 6 * t; }
        if (t < 1/2) { return q; }
        if (t < 2/3) { return p + (q - p) * (2/3 - t) * 6; }
        return p;
      }
      var r, g, b;
      if (s == 0) {
        r = g = b = l;
      } else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return ("rgba(" + (r * 255) + "," + (g * 255) + "," + (b * 255) + "," + a + ")");
    }

    function colorToRgb(val) {
      if (is.rgb(val)) { return rgbToRgba(val); }
      if (is.hex(val)) { return hexToRgba(val); }
      if (is.hsl(val)) { return hslToRgba(val); }
    }

    // Units

    function getUnit(val) {
      var split = /[+-]?\d*\.?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(%|px|pt|em|rem|in|cm|mm|ex|ch|pc|vw|vh|vmin|vmax|deg|rad|turn)?$/.exec(val);
      if (split) { return split[1]; }
    }

    function getTransformUnit(propName) {
      if (stringContains(propName, 'translate') || propName === 'perspective') { return 'px'; }
      if (stringContains(propName, 'rotate') || stringContains(propName, 'skew')) { return 'deg'; }
    }

    // Values

    function getFunctionValue(val, animatable) {
      if (!is.fnc(val)) { return val; }
      return val(animatable.target, animatable.id, animatable.total);
    }

    function getAttribute(el, prop) {
      return el.getAttribute(prop);
    }

    function convertPxToUnit(el, value, unit) {
      var valueUnit = getUnit(value);
      if (arrayContains([unit, 'deg', 'rad', 'turn'], valueUnit)) { return value; }
      var cached = cache.CSS[value + unit];
      if (!is.und(cached)) { return cached; }
      var baseline = 100;
      var tempEl = document.createElement(el.tagName);
      var parentEl = (el.parentNode && (el.parentNode !== document)) ? el.parentNode : document.body;
      parentEl.appendChild(tempEl);
      tempEl.style.position = 'absolute';
      tempEl.style.width = baseline + unit;
      var factor = baseline / tempEl.offsetWidth;
      parentEl.removeChild(tempEl);
      var convertedUnit = factor * parseFloat(value);
      cache.CSS[value + unit] = convertedUnit;
      return convertedUnit;
    }

    function getCSSValue(el, prop, unit) {
      if (prop in el.style) {
        var uppercasePropName = prop.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        var value = el.style[prop] || getComputedStyle(el).getPropertyValue(uppercasePropName) || '0';
        return unit ? convertPxToUnit(el, value, unit) : value;
      }
    }

    function getAnimationType(el, prop) {
      if (is.dom(el) && !is.inp(el) && (getAttribute(el, prop) || (is.svg(el) && el[prop]))) { return 'attribute'; }
      if (is.dom(el) && arrayContains(validTransforms, prop)) { return 'transform'; }
      if (is.dom(el) && (prop !== 'transform' && getCSSValue(el, prop))) { return 'css'; }
      if (el[prop] != null) { return 'object'; }
    }

    function getElementTransforms(el) {
      if (!is.dom(el)) { return; }
      var str = el.style.transform || '';
      var reg  = /(\w+)\(([^)]*)\)/g;
      var transforms = new Map();
      var m; while (m = reg.exec(str)) { transforms.set(m[1], m[2]); }
      return transforms;
    }

    function getTransformValue(el, propName, animatable, unit) {
      var defaultVal = stringContains(propName, 'scale') ? 1 : 0 + getTransformUnit(propName);
      var value = getElementTransforms(el).get(propName) || defaultVal;
      if (animatable) {
        animatable.transforms.list.set(propName, value);
        animatable.transforms['last'] = propName;
      }
      return unit ? convertPxToUnit(el, value, unit) : value;
    }

    function getOriginalTargetValue(target, propName, unit, animatable) {
      switch (getAnimationType(target, propName)) {
        case 'transform': return getTransformValue(target, propName, animatable, unit);
        case 'css': return getCSSValue(target, propName, unit);
        case 'attribute': return getAttribute(target, propName);
        default: return target[propName] || 0;
      }
    }

    function getRelativeValue(to, from) {
      var operator = /^(\*=|\+=|-=)/.exec(to);
      if (!operator) { return to; }
      var u = getUnit(to) || 0;
      var x = parseFloat(from);
      var y = parseFloat(to.replace(operator[0], ''));
      switch (operator[0][0]) {
        case '+': return x + y + u;
        case '-': return x - y + u;
        case '*': return x * y + u;
      }
    }

    function validateValue(val, unit) {
      if (is.col(val)) { return colorToRgb(val); }
      if (/\s/g.test(val)) { return val; }
      var originalUnit = getUnit(val);
      var unitLess = originalUnit ? val.substr(0, val.length - originalUnit.length) : val;
      if (unit) { return unitLess + unit; }
      return unitLess;
    }

    // getTotalLength() equivalent for circle, rect, polyline, polygon and line shapes
    // adapted from https://gist.github.com/SebLambla/3e0550c496c236709744

    function getDistance(p1, p2) {
      return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    function getCircleLength(el) {
      return Math.PI * 2 * getAttribute(el, 'r');
    }

    function getRectLength(el) {
      return (getAttribute(el, 'width') * 2) + (getAttribute(el, 'height') * 2);
    }

    function getLineLength(el) {
      return getDistance(
        {x: getAttribute(el, 'x1'), y: getAttribute(el, 'y1')}, 
        {x: getAttribute(el, 'x2'), y: getAttribute(el, 'y2')}
      );
    }

    function getPolylineLength(el) {
      var points = el.points;
      var totalLength = 0;
      var previousPos;
      for (var i = 0 ; i < points.numberOfItems; i++) {
        var currentPos = points.getItem(i);
        if (i > 0) { totalLength += getDistance(previousPos, currentPos); }
        previousPos = currentPos;
      }
      return totalLength;
    }

    function getPolygonLength(el) {
      var points = el.points;
      return getPolylineLength(el) + getDistance(points.getItem(points.numberOfItems - 1), points.getItem(0));
    }

    // Path animation

    function getTotalLength(el) {
      if (el.getTotalLength) { return el.getTotalLength(); }
      switch(el.tagName.toLowerCase()) {
        case 'circle': return getCircleLength(el);
        case 'rect': return getRectLength(el);
        case 'line': return getLineLength(el);
        case 'polyline': return getPolylineLength(el);
        case 'polygon': return getPolygonLength(el);
      }
    }

    function setDashoffset(el) {
      var pathLength = getTotalLength(el);
      el.setAttribute('stroke-dasharray', pathLength);
      return pathLength;
    }

    // Motion path

    function getParentSvgEl(el) {
      var parentEl = el.parentNode;
      while (is.svg(parentEl)) {
        if (!is.svg(parentEl.parentNode)) { break; }
        parentEl = parentEl.parentNode;
      }
      return parentEl;
    }

    function getParentSvg(pathEl, svgData) {
      var svg = svgData || {};
      var parentSvgEl = svg.el || getParentSvgEl(pathEl);
      var rect = parentSvgEl.getBoundingClientRect();
      var viewBoxAttr = getAttribute(parentSvgEl, 'viewBox');
      var width = rect.width;
      var height = rect.height;
      var viewBox = svg.viewBox || (viewBoxAttr ? viewBoxAttr.split(' ') : [0, 0, width, height]);
      return {
        el: parentSvgEl,
        viewBox: viewBox,
        x: viewBox[0] / 1,
        y: viewBox[1] / 1,
        w: width / viewBox[2],
        h: height / viewBox[3]
      }
    }

    function getPath(path, percent) {
      var pathEl = is.str(path) ? selectString(path)[0] : path;
      var p = percent || 100;
      return function(property) {
        return {
          property: property,
          el: pathEl,
          svg: getParentSvg(pathEl),
          totalLength: getTotalLength(pathEl) * (p / 100)
        }
      }
    }

    function getPathProgress(path, progress) {
      function point(offset) {
        if ( offset === void 0 ) offset = 0;

        var l = progress + offset >= 1 ? progress + offset : 0;
        return path.el.getPointAtLength(l);
      }
      var svg = getParentSvg(path.el, path.svg);
      var p = point();
      var p0 = point(-1);
      var p1 = point(+1);
      switch (path.property) {
        case 'x': return (p.x - svg.x) * svg.w;
        case 'y': return (p.y - svg.y) * svg.h;
        case 'angle': return Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
      }
    }

    // Decompose value

    function decomposeValue(val, unit) {
      // const rgx = /-?\d*\.?\d+/g; // handles basic numbers
      // const rgx = /[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g; // handles exponents notation
      var rgx = /[+-]?\d*\.?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g; // handles exponents notation
      var value = validateValue((is.pth(val) ? val.totalLength : val), unit) + '';
      return {
        original: value,
        numbers: value.match(rgx) ? value.match(rgx).map(Number) : [0],
        strings: (is.str(val) || unit) ? value.split(rgx) : []
      }
    }

    // Animatables

    function parseTargets(targets) {
      var targetsArray = targets ? (flattenArray(is.arr(targets) ? targets.map(toArray) : toArray(targets))) : [];
      return filterArray(targetsArray, function (item, pos, self) { return self.indexOf(item) === pos; });
    }

    function getAnimatables(targets) {
      var parsed = parseTargets(targets);
      return parsed.map(function (t, i) {
        return {target: t, id: i, total: parsed.length, transforms: { list: getElementTransforms(t) } };
      });
    }

    // Properties

    function normalizePropertyTweens(prop, tweenSettings) {
      var settings = cloneObject(tweenSettings);
      // Override duration if easing is a spring
      if (/^spring/.test(settings.easing)) { settings.duration = spring(settings.easing); }
      if (is.arr(prop)) {
        var l = prop.length;
        var isFromTo = (l === 2 && !is.obj(prop[0]));
        if (!isFromTo) {
          // Duration divided by the number of tweens
          if (!is.fnc(tweenSettings.duration)) { settings.duration = tweenSettings.duration / l; }
        } else {
          // Transform [from, to] values shorthand to a valid tween value
          prop = {value: prop};
        }
      }
      var propArray = is.arr(prop) ? prop : [prop];
      return propArray.map(function (v, i) {
        var obj = (is.obj(v) && !is.pth(v)) ? v : {value: v};
        // Default delay value should only be applied to the first tween
        if (is.und(obj.delay)) { obj.delay = !i ? tweenSettings.delay : 0; }
        // Default endDelay value should only be applied to the last tween
        if (is.und(obj.endDelay)) { obj.endDelay = i === propArray.length - 1 ? tweenSettings.endDelay : 0; }
        return obj;
      }).map(function (k) { return mergeObjects(k, settings); });
    }


    function flattenKeyframes(keyframes) {
      var propertyNames = filterArray(flattenArray(keyframes.map(function (key) { return Object.keys(key); })), function (p) { return is.key(p); })
      .reduce(function (a,b) { if (a.indexOf(b) < 0) { a.push(b); } return a; }, []);
      var properties = {};
      var loop = function ( i ) {
        var propName = propertyNames[i];
        properties[propName] = keyframes.map(function (key) {
          var newKey = {};
          for (var p in key) {
            if (is.key(p)) {
              if (p == propName) { newKey.value = key[p]; }
            } else {
              newKey[p] = key[p];
            }
          }
          return newKey;
        });
      };

      for (var i = 0; i < propertyNames.length; i++) loop( i );
      return properties;
    }

    function getProperties(tweenSettings, params) {
      var properties = [];
      var keyframes = params.keyframes;
      if (keyframes) { params = mergeObjects(flattenKeyframes(keyframes), params); }
      for (var p in params) {
        if (is.key(p)) {
          properties.push({
            name: p,
            tweens: normalizePropertyTweens(params[p], tweenSettings)
          });
        }
      }
      return properties;
    }

    // Tweens

    function normalizeTweenValues(tween, animatable) {
      var t = {};
      for (var p in tween) {
        var value = getFunctionValue(tween[p], animatable);
        if (is.arr(value)) {
          value = value.map(function (v) { return getFunctionValue(v, animatable); });
          if (value.length === 1) { value = value[0]; }
        }
        t[p] = value;
      }
      t.duration = parseFloat(t.duration);
      t.delay = parseFloat(t.delay);
      return t;
    }

    function normalizeTweens(prop, animatable) {
      var previousTween;
      return prop.tweens.map(function (t) {
        var tween = normalizeTweenValues(t, animatable);
        var tweenValue = tween.value;
        var to = is.arr(tweenValue) ? tweenValue[1] : tweenValue;
        var toUnit = getUnit(to);
        var originalValue = getOriginalTargetValue(animatable.target, prop.name, toUnit, animatable);
        var previousValue = previousTween ? previousTween.to.original : originalValue;
        var from = is.arr(tweenValue) ? tweenValue[0] : previousValue;
        var fromUnit = getUnit(from) || getUnit(originalValue);
        var unit = toUnit || fromUnit;
        if (is.und(to)) { to = previousValue; }
        tween.from = decomposeValue(from, unit);
        tween.to = decomposeValue(getRelativeValue(to, from), unit);
        tween.start = previousTween ? previousTween.end : 0;
        tween.end = tween.start + tween.delay + tween.duration + tween.endDelay;
        tween.easing = parseEasings(tween.easing, tween.duration);
        tween.isPath = is.pth(tweenValue);
        tween.isColor = is.col(tween.from.original);
        if (tween.isColor) { tween.round = 1; }
        previousTween = tween;
        return tween;
      });
    }

    // Tween progress

    var setProgressValue = {
      css: function (t, p, v) { return t.style[p] = v; },
      attribute: function (t, p, v) { return t.setAttribute(p, v); },
      object: function (t, p, v) { return t[p] = v; },
      transform: function (t, p, v, transforms, manual) {
        transforms.list.set(p, v);
        if (p === transforms.last || manual) {
          var str = '';
          transforms.list.forEach(function (value, prop) { str += prop + "(" + value + ") "; });
          t.style.transform = str;
        }
      }
    };

    // Set Value helper

    function setTargetsValue(targets, properties) {
      var animatables = getAnimatables(targets);
      animatables.forEach(function (animatable) {
        for (var property in properties) {
          var value = getFunctionValue(properties[property], animatable);
          var target = animatable.target;
          var valueUnit = getUnit(value);
          var originalValue = getOriginalTargetValue(target, property, valueUnit, animatable);
          var unit = valueUnit || getUnit(originalValue);
          var to = getRelativeValue(validateValue(value, unit), originalValue);
          var animType = getAnimationType(target, property);
          setProgressValue[animType](target, property, to, animatable.transforms, true);
        }
      });
    }

    // Animations

    function createAnimation(animatable, prop) {
      var animType = getAnimationType(animatable.target, prop.name);
      if (animType) {
        var tweens = normalizeTweens(prop, animatable);
        var lastTween = tweens[tweens.length - 1];
        return {
          type: animType,
          property: prop.name,
          animatable: animatable,
          tweens: tweens,
          duration: lastTween.end,
          delay: tweens[0].delay,
          endDelay: lastTween.endDelay
        }
      }
    }

    function getAnimations(animatables, properties) {
      return filterArray(flattenArray(animatables.map(function (animatable) {
        return properties.map(function (prop) {
          return createAnimation(animatable, prop);
        });
      })), function (a) { return !is.und(a); });
    }

    // Create Instance

    function getInstanceTimings(animations, tweenSettings) {
      var animLength = animations.length;
      var getTlOffset = function (anim) { return anim.timelineOffset ? anim.timelineOffset : 0; };
      var timings = {};
      timings.duration = animLength ? Math.max.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.duration; })) : tweenSettings.duration;
      timings.delay = animLength ? Math.min.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.delay; })) : tweenSettings.delay;
      timings.endDelay = animLength ? timings.duration - Math.max.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.duration - anim.endDelay; })) : tweenSettings.endDelay;
      return timings;
    }

    var instanceID = 0;

    function createNewInstance(params) {
      var instanceSettings = replaceObjectProps(defaultInstanceSettings, params);
      var tweenSettings = replaceObjectProps(defaultTweenSettings, params);
      var properties = getProperties(tweenSettings, params);
      var animatables = getAnimatables(params.targets);
      var animations = getAnimations(animatables, properties);
      var timings = getInstanceTimings(animations, tweenSettings);
      var id = instanceID;
      instanceID++;
      return mergeObjects(instanceSettings, {
        id: id,
        children: [],
        animatables: animatables,
        animations: animations,
        duration: timings.duration,
        delay: timings.delay,
        endDelay: timings.endDelay
      });
    }

    // Core

    var activeInstances = [];
    var pausedInstances = [];
    var raf;

    var engine = (function () {
      function play() { 
        raf = requestAnimationFrame(step);
      }
      function step(t) {
        var activeInstancesLength = activeInstances.length;
        if (activeInstancesLength) {
          var i = 0;
          while (i < activeInstancesLength) {
            var activeInstance = activeInstances[i];
            if (!activeInstance.paused) {
              activeInstance.tick(t);
            } else {
              var instanceIndex = activeInstances.indexOf(activeInstance);
              if (instanceIndex > -1) {
                activeInstances.splice(instanceIndex, 1);
                activeInstancesLength = activeInstances.length;
              }
            }
            i++;
          }
          play();
        } else {
          raf = cancelAnimationFrame(raf);
        }
      }
      return play;
    })();

    function handleVisibilityChange() {
      if (document.hidden) {
        activeInstances.forEach(function (ins) { return ins.pause(); });
        pausedInstances = activeInstances.slice(0);
        anime.running = activeInstances = [];
      } else {
        pausedInstances.forEach(function (ins) { return ins.play(); });
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Public Instance

    function anime(params) {
      if ( params === void 0 ) params = {};


      var startTime = 0, lastTime = 0, now = 0;
      var children, childrenLength = 0;
      var resolve = null;

      function makePromise(instance) {
        var promise = window.Promise && new Promise(function (_resolve) { return resolve = _resolve; });
        instance.finished = promise;
        return promise;
      }

      var instance = createNewInstance(params);
      var promise = makePromise(instance);

      function toggleInstanceDirection() {
        var direction = instance.direction;
        if (direction !== 'alternate') {
          instance.direction = direction !== 'normal' ? 'normal' : 'reverse';
        }
        instance.reversed = !instance.reversed;
        children.forEach(function (child) { return child.reversed = instance.reversed; });
      }

      function adjustTime(time) {
        return instance.reversed ? instance.duration - time : time;
      }

      function resetTime() {
        startTime = 0;
        lastTime = adjustTime(instance.currentTime) * (1 / anime.speed);
      }

      function seekChild(time, child) {
        if (child) { child.seek(time - child.timelineOffset); }
      }

      function syncInstanceChildren(time) {
        if (!instance.reversePlayback) {
          for (var i = 0; i < childrenLength; i++) { seekChild(time, children[i]); }
        } else {
          for (var i$1 = childrenLength; i$1--;) { seekChild(time, children[i$1]); }
        }
      }

      function setAnimationsProgress(insTime) {
        var i = 0;
        var animations = instance.animations;
        var animationsLength = animations.length;
        while (i < animationsLength) {
          var anim = animations[i];
          var animatable = anim.animatable;
          var tweens = anim.tweens;
          var tweenLength = tweens.length - 1;
          var tween = tweens[tweenLength];
          // Only check for keyframes if there is more than one tween
          if (tweenLength) { tween = filterArray(tweens, function (t) { return (insTime < t.end); })[0] || tween; }
          var elapsed = minMax(insTime - tween.start - tween.delay, 0, tween.duration) / tween.duration;
          var eased = isNaN(elapsed) ? 1 : tween.easing(elapsed);
          var strings = tween.to.strings;
          var round = tween.round;
          var numbers = [];
          var toNumbersLength = tween.to.numbers.length;
          var progress = (void 0);
          for (var n = 0; n < toNumbersLength; n++) {
            var value = (void 0);
            var toNumber = tween.to.numbers[n];
            var fromNumber = tween.from.numbers[n] || 0;
            if (!tween.isPath) {
              value = fromNumber + (eased * (toNumber - fromNumber));
            } else {
              value = getPathProgress(tween.value, eased * toNumber);
            }
            if (round) {
              if (!(tween.isColor && n > 2)) {
                value = Math.round(value * round) / round;
              }
            }
            numbers.push(value);
          }
          // Manual Array.reduce for better performances
          var stringsLength = strings.length;
          if (!stringsLength) {
            progress = numbers[0];
          } else {
            progress = strings[0];
            for (var s = 0; s < stringsLength; s++) {
              var a = strings[s];
              var b = strings[s + 1];
              var n$1 = numbers[s];
              if (!isNaN(n$1)) {
                if (!b) {
                  progress += n$1 + ' ';
                } else {
                  progress += n$1 + b;
                }
              }
            }
          }
          setProgressValue[anim.type](animatable.target, anim.property, progress, animatable.transforms);
          anim.currentValue = progress;
          i++;
        }
      }

      function setCallback(cb) {
        if (instance[cb] && !instance.passThrough) { instance[cb](instance); }
      }

      function countIteration() {
        if (instance.remaining && instance.remaining !== true) {
          instance.remaining--;
        }
      }

      function setInstanceProgress(engineTime) {
        var insDuration = instance.duration;
        var insDelay = instance.delay;
        var insEndDelay = insDuration - instance.endDelay;
        var insTime = adjustTime(engineTime);
        instance.progress = minMax((insTime / insDuration) * 100, 0, 100);
        instance.reversePlayback = insTime < instance.currentTime;
        if (children) { syncInstanceChildren(insTime); }
        if (!instance.began && instance.currentTime > 0) {
          instance.began = true;
          setCallback('begin');
        }
        if (!instance.loopBegan && instance.currentTime > 0) {
          instance.loopBegan = true;
          setCallback('loopBegin');
        }
        if (insTime <= insDelay && instance.currentTime !== 0) {
          setAnimationsProgress(0);
        }
        if ((insTime >= insEndDelay && instance.currentTime !== insDuration) || !insDuration) {
          setAnimationsProgress(insDuration);
        }
        if (insTime > insDelay && insTime < insEndDelay) {
          if (!instance.changeBegan) {
            instance.changeBegan = true;
            instance.changeCompleted = false;
            setCallback('changeBegin');
          }
          setCallback('change');
          setAnimationsProgress(insTime);
        } else {
          if (instance.changeBegan) {
            instance.changeCompleted = true;
            instance.changeBegan = false;
            setCallback('changeComplete');
          }
        }
        instance.currentTime = minMax(insTime, 0, insDuration);
        if (instance.began) { setCallback('update'); }
        if (engineTime >= insDuration) {
          lastTime = 0;
          countIteration();
          if (!instance.remaining) {
            instance.paused = true;
            if (!instance.completed) {
              instance.completed = true;
              setCallback('loopComplete');
              setCallback('complete');
              if (!instance.passThrough && 'Promise' in window) {
                resolve();
                promise = makePromise(instance);
              }
            }
          } else {
            startTime = now;
            setCallback('loopComplete');
            instance.loopBegan = false;
            if (instance.direction === 'alternate') {
              toggleInstanceDirection();
            }
          }
        }
      }

      instance.reset = function() {
        var direction = instance.direction;
        instance.passThrough = false;
        instance.currentTime = 0;
        instance.progress = 0;
        instance.paused = true;
        instance.began = false;
        instance.loopBegan = false;
        instance.changeBegan = false;
        instance.completed = false;
        instance.changeCompleted = false;
        instance.reversePlayback = false;
        instance.reversed = direction === 'reverse';
        instance.remaining = instance.loop;
        children = instance.children;
        childrenLength = children.length;
        for (var i = childrenLength; i--;) { instance.children[i].reset(); }
        if (instance.reversed && instance.loop !== true || (direction === 'alternate' && instance.loop === 1)) { instance.remaining++; }
        setAnimationsProgress(instance.reversed ? instance.duration : 0);
      };

      // Set Value helper

      instance.set = function(targets, properties) {
        setTargetsValue(targets, properties);
        return instance;
      };

      instance.tick = function(t) {
        now = t;
        if (!startTime) { startTime = now; }
        setInstanceProgress((now + (lastTime - startTime)) * anime.speed);
      };

      instance.seek = function(time) {
        setInstanceProgress(adjustTime(time));
      };

      instance.pause = function() {
        instance.paused = true;
        resetTime();
      };

      instance.play = function() {
        if (!instance.paused) { return; }
        if (instance.completed) { instance.reset(); }
        instance.paused = false;
        activeInstances.push(instance);
        resetTime();
        if (!raf) { engine(); }
      };

      instance.reverse = function() {
        toggleInstanceDirection();
        resetTime();
      };

      instance.restart = function() {
        instance.reset();
        instance.play();
      };

      instance.reset();

      if (instance.autoplay) { instance.play(); }

      return instance;

    }

    // Remove targets from animation

    function removeTargetsFromAnimations(targetsArray, animations) {
      for (var a = animations.length; a--;) {
        if (arrayContains(targetsArray, animations[a].animatable.target)) {
          animations.splice(a, 1);
        }
      }
    }

    function removeTargets(targets) {
      var targetsArray = parseTargets(targets);
      for (var i = activeInstances.length; i--;) {
        var instance = activeInstances[i];
        var animations = instance.animations;
        var children = instance.children;
        removeTargetsFromAnimations(targetsArray, animations);
        for (var c = children.length; c--;) {
          var child = children[c];
          var childAnimations = child.animations;
          removeTargetsFromAnimations(targetsArray, childAnimations);
          if (!childAnimations.length && !child.children.length) { children.splice(c, 1); }
        }
        if (!animations.length && !children.length) { instance.pause(); }
      }
    }

    // Stagger helpers

    function stagger(val, params) {
      if ( params === void 0 ) params = {};

      var direction = params.direction || 'normal';
      var easing = params.easing ? parseEasings(params.easing) : null;
      var grid = params.grid;
      var axis = params.axis;
      var fromIndex = params.from || 0;
      var fromFirst = fromIndex === 'first';
      var fromCenter = fromIndex === 'center';
      var fromLast = fromIndex === 'last';
      var isRange = is.arr(val);
      var val1 = isRange ? parseFloat(val[0]) : parseFloat(val);
      var val2 = isRange ? parseFloat(val[1]) : 0;
      var unit = getUnit(isRange ? val[1] : val) || 0;
      var start = params.start || 0 + (isRange ? val1 : 0);
      var values = [];
      var maxValue = 0;
      return function (el, i, t) {
        if (fromFirst) { fromIndex = 0; }
        if (fromCenter) { fromIndex = (t - 1) / 2; }
        if (fromLast) { fromIndex = t - 1; }
        if (!values.length) {
          for (var index = 0; index < t; index++) {
            if (!grid) {
              values.push(Math.abs(fromIndex - index));
            } else {
              var fromX = !fromCenter ? fromIndex%grid[0] : (grid[0]-1)/2;
              var fromY = !fromCenter ? Math.floor(fromIndex/grid[0]) : (grid[1]-1)/2;
              var toX = index%grid[0];
              var toY = Math.floor(index/grid[0]);
              var distanceX = fromX - toX;
              var distanceY = fromY - toY;
              var value = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
              if (axis === 'x') { value = -distanceX; }
              if (axis === 'y') { value = -distanceY; }
              values.push(value);
            }
            maxValue = Math.max.apply(Math, values);
          }
          if (easing) { values = values.map(function (val) { return easing(val / maxValue) * maxValue; }); }
          if (direction === 'reverse') { values = values.map(function (val) { return axis ? (val < 0) ? val * -1 : -val : Math.abs(maxValue - val); }); }
        }
        var spacing = isRange ? (val2 - val1) / maxValue : val1;
        return start + (spacing * (Math.round(values[i] * 100) / 100)) + unit;
      }
    }

    // Timeline

    function timeline(params) {
      if ( params === void 0 ) params = {};

      var tl = anime(params);
      tl.duration = 0;
      tl.add = function(instanceParams, timelineOffset) {
        var tlIndex = activeInstances.indexOf(tl);
        var children = tl.children;
        if (tlIndex > -1) { activeInstances.splice(tlIndex, 1); }
        function passThrough(ins) { ins.passThrough = true; }
        for (var i = 0; i < children.length; i++) { passThrough(children[i]); }
        var insParams = mergeObjects(instanceParams, replaceObjectProps(defaultTweenSettings, params));
        insParams.targets = insParams.targets || params.targets;
        var tlDuration = tl.duration;
        insParams.autoplay = false;
        insParams.direction = tl.direction;
        insParams.timelineOffset = is.und(timelineOffset) ? tlDuration : getRelativeValue(timelineOffset, tlDuration);
        passThrough(tl);
        tl.seek(insParams.timelineOffset);
        var ins = anime(insParams);
        passThrough(ins);
        children.push(ins);
        var timings = getInstanceTimings(children, params);
        tl.delay = timings.delay;
        tl.endDelay = timings.endDelay;
        tl.duration = timings.duration;
        tl.seek(0);
        tl.reset();
        if (tl.autoplay) { tl.play(); }
        return tl;
      };
      return tl;
    }

    anime.version = '3.1.0';
    anime.speed = 1;
    anime.running = activeInstances;
    anime.remove = removeTargets;
    anime.get = getOriginalTargetValue;
    anime.set = setTargetsValue;
    anime.convertPx = convertPxToUnit;
    anime.path = getPath;
    anime.setDashoffset = setDashoffset;
    anime.stagger = stagger;
    anime.timeline = timeline;
    anime.easing = parseEasings;
    anime.penner = penner;
    anime.random = function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; };

    /* components/animations/BoxGrid.svelte generated by Svelte v3.15.0 */
    const file = "components/animations/BoxGrid.svelte";

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx._ = list[i];
    	child_ctx.j = i;
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx._ = list[i];
    	child_ctx.i = i;
    	return child_ctx;
    }

    // (57:4) {#each new Array(parseInt(columns)).fill(0) as _, j}
    function create_each_block_1(ctx) {
    	let rect;
    	let rect_x_value;
    	let rect_y_value;

    	const block = {
    		c: function create() {
    			rect = svg_element("rect");
    			attr_dev(rect, "class", "boxgrid-anim");
    			attr_dev(rect, "x", rect_x_value = (ctx.boxSize + 1) * ctx.i);
    			attr_dev(rect, "y", rect_y_value = (ctx.boxSize + 1) * ctx.j);
    			attr_dev(rect, "width", ctx.boxSize);
    			attr_dev(rect, "height", ctx.boxSize);
    			set_style(rect, "transform-origin", (ctx.boxSize + 1) * ctx.i + (ctx.boxSize + 1) / 2 + "px \n            " + ((ctx.boxSize + 1) * ctx.j + (ctx.boxSize + 1) / 2) + "px");
    			set_style(rect, "transform", "scale(1)");
    			attr_dev(rect, "fill", ctx.boxColor);
    			add_location(rect, file, 57, 6, 1235);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, rect, anchor);
    		},
    		p: function update(changed, ctx) {
    			if (changed.boxSize && rect_x_value !== (rect_x_value = (ctx.boxSize + 1) * ctx.i)) {
    				attr_dev(rect, "x", rect_x_value);
    			}

    			if (changed.boxSize && rect_y_value !== (rect_y_value = (ctx.boxSize + 1) * ctx.j)) {
    				attr_dev(rect, "y", rect_y_value);
    			}

    			if (changed.boxSize) {
    				attr_dev(rect, "width", ctx.boxSize);
    			}

    			if (changed.boxSize) {
    				attr_dev(rect, "height", ctx.boxSize);
    			}

    			if (changed.boxSize) {
    				set_style(rect, "transform-origin", (ctx.boxSize + 1) * ctx.i + (ctx.boxSize + 1) / 2 + "px \n            " + ((ctx.boxSize + 1) * ctx.j + (ctx.boxSize + 1) / 2) + "px");
    			}

    			if (changed.boxColor) {
    				attr_dev(rect, "fill", ctx.boxColor);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(rect);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(57:4) {#each new Array(parseInt(columns)).fill(0) as _, j}",
    		ctx
    	});

    	return block;
    }

    // (56:2) {#each new Array(parseInt(rows)).fill(0) as _, i}
    function create_each_block(ctx) {
    	let each_1_anchor;
    	let each_value_1 = new Array(parseInt(ctx.columns)).fill(0);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(changed, ctx) {
    			if (changed.boxSize || changed.boxColor || changed.Array || changed.parseInt || changed.columns) {
    				each_value_1 = new Array(parseInt(ctx.columns)).fill(0);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(56:2) {#each new Array(parseInt(rows)).fill(0) as _, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let svg;
    	let svg_width_value;
    	let svg_height_value;
    	let each_value = new Array(parseInt(ctx.rows)).fill(0);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(svg, "x", ctx.x);
    			attr_dev(svg, "y", ctx.y);
    			attr_dev(svg, "width", svg_width_value = ctx.rows * (ctx.boxSize + 1));
    			attr_dev(svg, "height", svg_height_value = ctx.columns * (ctx.boxSize + 1));
    			add_location(svg, file, 49, 0, 1021);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(svg, null);
    			}
    		},
    		p: function update(changed, ctx) {
    			if (changed.Array || changed.parseInt || changed.columns || changed.boxSize || changed.boxColor || changed.rows) {
    				each_value = new Array(parseInt(ctx.rows)).fill(0);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(svg, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (changed.x) {
    				attr_dev(svg, "x", ctx.x);
    			}

    			if (changed.y) {
    				attr_dev(svg, "y", ctx.y);
    			}

    			if ((changed.rows || changed.boxSize) && svg_width_value !== (svg_width_value = ctx.rows * (ctx.boxSize + 1))) {
    				attr_dev(svg, "width", svg_width_value);
    			}

    			if ((changed.columns || changed.boxSize) && svg_height_value !== (svg_height_value = ctx.columns * (ctx.boxSize + 1))) {
    				attr_dev(svg, "height", svg_height_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const { stagger: stagger$1 } = anime;

    const animation = (rows = 20, columns = 10) => {
    	return {
    		targets: document.getElementsByClassName("boxgrid-anim"),
    		easing: "easeInOutExpo",
    		keyframes: [
    			{
    				duration: 2000,
    				opacity: 0.05,
    				fill: "#ff0000",
    				scale: 5
    			},
    			{ duration: 1000, fill: "#ffffff" },
    			{
    				duration: 2000,
    				opacity: 1,
    				scale: 1,
    				fill: "#80bfff"
    			}
    		],
    		delay: stagger$1(100, { grid: [columns, rows], from: "center" })
    	};
    };

    const props = {
    	rows: 20,
    	columns: 10,
    	boxSize: 20,
    	x: 0,
    	y: 0,
    	boxColor: "#80bfff"
    };

    function instance($$self, $$props, $$invalidate) {
    	let { rows = props.rows } = $$props;
    	let { columns = props.columns } = $$props;
    	let { boxSize = props.boxSize } = $$props;
    	let { x = props.x } = $$props;
    	let { y = props.y } = $$props;
    	let { boxColor = props.boxColor } = $$props;
    	const writable_props = ["rows", "columns", "boxSize", "x", "y", "boxColor"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<BoxGrid> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("rows" in $$props) $$invalidate("rows", rows = $$props.rows);
    		if ("columns" in $$props) $$invalidate("columns", columns = $$props.columns);
    		if ("boxSize" in $$props) $$invalidate("boxSize", boxSize = $$props.boxSize);
    		if ("x" in $$props) $$invalidate("x", x = $$props.x);
    		if ("y" in $$props) $$invalidate("y", y = $$props.y);
    		if ("boxColor" in $$props) $$invalidate("boxColor", boxColor = $$props.boxColor);
    	};

    	$$self.$capture_state = () => {
    		return { rows, columns, boxSize, x, y, boxColor };
    	};

    	$$self.$inject_state = $$props => {
    		if ("rows" in $$props) $$invalidate("rows", rows = $$props.rows);
    		if ("columns" in $$props) $$invalidate("columns", columns = $$props.columns);
    		if ("boxSize" in $$props) $$invalidate("boxSize", boxSize = $$props.boxSize);
    		if ("x" in $$props) $$invalidate("x", x = $$props.x);
    		if ("y" in $$props) $$invalidate("y", y = $$props.y);
    		if ("boxColor" in $$props) $$invalidate("boxColor", boxColor = $$props.boxColor);
    	};

    	return { rows, columns, boxSize, x, y, boxColor };
    }

    class BoxGrid extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			rows: 0,
    			columns: 0,
    			boxSize: 0,
    			x: 0,
    			y: 0,
    			boxColor: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "BoxGrid",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get rows() {
    		throw new Error("<BoxGrid>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rows(value) {
    		throw new Error("<BoxGrid>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get columns() {
    		throw new Error("<BoxGrid>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set columns(value) {
    		throw new Error("<BoxGrid>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get boxSize() {
    		throw new Error("<BoxGrid>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set boxSize(value) {
    		throw new Error("<BoxGrid>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get x() {
    		throw new Error("<BoxGrid>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set x(value) {
    		throw new Error("<BoxGrid>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get y() {
    		throw new Error("<BoxGrid>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set y(value) {
    		throw new Error("<BoxGrid>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get boxColor() {
    		throw new Error("<BoxGrid>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set boxColor(value) {
    		throw new Error("<BoxGrid>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/shapes/cheveron.svelte generated by Svelte v3.15.0 */

    const file$1 = "components/shapes/cheveron.svelte";

    function create_fragment$1(ctx) {
    	let path_1;

    	const block = {
    		c: function create() {
    			path_1 = svg_element("path");
    			attr_dev(path_1, "d", ctx.path);
    			attr_dev(path_1, "style", ctx.style);
    			add_location(path_1, file$1, 21, 0, 321);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path_1, anchor);
    		},
    		p: function update(changed, ctx) {
    			if (changed.path) {
    				attr_dev(path_1, "d", ctx.path);
    			}

    			if (changed.style) {
    				attr_dev(path_1, "style", ctx.style);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { width } = $$props;
    	let { height } = $$props;
    	let { skew } = $$props;
    	let { style } = $$props;
    	let path = "";
    	const writable_props = ["width", "height", "skew", "style"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Cheveron> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("width" in $$props) $$invalidate("width", width = $$props.width);
    		if ("height" in $$props) $$invalidate("height", height = $$props.height);
    		if ("skew" in $$props) $$invalidate("skew", skew = $$props.skew);
    		if ("style" in $$props) $$invalidate("style", style = $$props.style);
    	};

    	$$self.$capture_state = () => {
    		return { width, height, skew, style, path };
    	};

    	$$self.$inject_state = $$props => {
    		if ("width" in $$props) $$invalidate("width", width = $$props.width);
    		if ("height" in $$props) $$invalidate("height", height = $$props.height);
    		if ("skew" in $$props) $$invalidate("skew", skew = $$props.skew);
    		if ("style" in $$props) $$invalidate("style", style = $$props.style);
    		if ("path" in $$props) $$invalidate("path", path = $$props.path);
    	};

    	$$self.$$.update = (changed = { skew: 1, width: 1, height: 1 }) => {
    		if (changed.skew || changed.width || changed.height) {
    			 {
    				$$invalidate("path", path = `
      M ${skew} 0
      H ${skew + width}
      L ${width} ${height / 2}
      L ${skew + width} ${height}
      H ${skew}
      L 0 ${height / 2}
      L ${skew} 0
      Z
    `);
    			}
    		}
    	};

    	return { width, height, skew, style, path };
    }

    class Cheveron extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { width: 0, height: 0, skew: 0, style: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Cheveron",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (ctx.width === undefined && !("width" in props)) {
    			console.warn("<Cheveron> was created without expected prop 'width'");
    		}

    		if (ctx.height === undefined && !("height" in props)) {
    			console.warn("<Cheveron> was created without expected prop 'height'");
    		}

    		if (ctx.skew === undefined && !("skew" in props)) {
    			console.warn("<Cheveron> was created without expected prop 'skew'");
    		}

    		if (ctx.style === undefined && !("style" in props)) {
    			console.warn("<Cheveron> was created without expected prop 'style'");
    		}
    	}

    	get width() {
    		throw new Error("<Cheveron>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Cheveron>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Cheveron>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Cheveron>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get skew() {
    		throw new Error("<Cheveron>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set skew(value) {
    		throw new Error("<Cheveron>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Cheveron>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Cheveron>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/animations/LowerThird.svelte generated by Svelte v3.15.0 */
    const file$2 = "components/animations/LowerThird.svelte";

    function create_fragment$2(ctx) {
    	let svg;
    	let text_1;
    	let t;
    	let text_1_y_value;
    	let svg_width_value;
    	let current;

    	const cheveron = new Cheveron({
    			props: {
    				height: parseInt(ctx.actualHeight),
    				width: parseInt(ctx.actualWidth) + parseInt(ctx.skew),
    				skew: parseInt(ctx.skew),
    				style: "fill: #ddd;"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			create_component(cheveron.$$.fragment);
    			text_1 = svg_element("text");
    			t = text(ctx.text);
    			attr_dev(text_1, "id", "anim-text");
    			attr_dev(text_1, "x", ctx.skew);
    			attr_dev(text_1, "y", text_1_y_value = ctx.actualHeight - 5);
    			set_style(text_1, "font-family", ctx.fontFamily);
    			set_style(text_1, "font-size", ctx.fontSize);
    			set_style(text_1, "transform-origin", ctx.skew + "px " + (ctx.actualHeight - 5) + "px");
    			set_style(text_1, "transform", "scaleX(" + ctx.textXScale + ") scaleY(" + ctx.textYScale + ")");
    			add_location(text_1, file$2, 126, 2, 2955);
    			attr_dev(svg, "x", ctx.x);
    			attr_dev(svg, "y", ctx.y);
    			attr_dev(svg, "width", svg_width_value = ctx.actualWidth + parseInt(ctx.skew) * 2);
    			attr_dev(svg, "height", ctx.actualHeight);
    			add_location(svg, file$2, 113, 0, 2678);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			mount_component(cheveron, svg, null);
    			append_dev(svg, text_1);
    			append_dev(text_1, t);
    			ctx.text_1_binding(text_1);
    			ctx.svg_binding(svg);
    			current = true;
    		},
    		p: function update(changed, ctx) {
    			const cheveron_changes = {};
    			if (changed.actualHeight) cheveron_changes.height = parseInt(ctx.actualHeight);
    			if (changed.actualWidth || changed.skew) cheveron_changes.width = parseInt(ctx.actualWidth) + parseInt(ctx.skew);
    			if (changed.skew) cheveron_changes.skew = parseInt(ctx.skew);
    			cheveron.$set(cheveron_changes);
    			if (!current || changed.text) set_data_dev(t, ctx.text);

    			if (!current || changed.skew) {
    				attr_dev(text_1, "x", ctx.skew);
    			}

    			if (!current || changed.actualHeight && text_1_y_value !== (text_1_y_value = ctx.actualHeight - 5)) {
    				attr_dev(text_1, "y", text_1_y_value);
    			}

    			if (!current || changed.fontFamily) {
    				set_style(text_1, "font-family", ctx.fontFamily);
    			}

    			if (!current || changed.fontSize) {
    				set_style(text_1, "font-size", ctx.fontSize);
    			}

    			if (!current || (changed.skew || changed.actualHeight)) {
    				set_style(text_1, "transform-origin", ctx.skew + "px " + (ctx.actualHeight - 5) + "px");
    			}

    			if (!current || (changed.textXScale || changed.textYScale)) {
    				set_style(text_1, "transform", "scaleX(" + ctx.textXScale + ") scaleY(" + ctx.textYScale + ")");
    			}

    			if (!current || changed.x) {
    				attr_dev(svg, "x", ctx.x);
    			}

    			if (!current || changed.y) {
    				attr_dev(svg, "y", ctx.y);
    			}

    			if (!current || (changed.actualWidth || changed.skew) && svg_width_value !== (svg_width_value = ctx.actualWidth + parseInt(ctx.skew) * 2)) {
    				attr_dev(svg, "width", svg_width_value);
    			}

    			if (!current || changed.actualHeight) {
    				attr_dev(svg, "height", ctx.actualHeight);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(cheveron.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(cheveron.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			destroy_component(cheveron);
    			ctx.text_1_binding(null);
    			ctx.svg_binding(null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const animation$1 = () => {
    	return {
    		targets: document.getElementsByClassName("boxgrid-anim"),
    		easing: "easeInOutExpo"
    	};
    };

    const props$1 = {
    	minWidth: 50,
    	maxWidth: 300,
    	minHeight: 25,
    	maxHeight: 50,
    	xmargin: 0,
    	ymargin: 0,
    	text: "hello world",
    	fontSize: 25,
    	fontFamily: "Roboto",
    	position: "bottom",
    	skew: 30
    };

    function instance$2($$self, $$props, $$invalidate) {
    	let { parentWidth } = $$props;
    	let { parentHeight } = $$props;
    	let { minWidth = props$1.minWidth } = $$props;
    	let { maxWidth = props$1.maxWidth } = $$props;
    	let { minHeight = props$1.minHeight } = $$props;
    	let { maxHeight = props$1.maxHeight } = $$props;
    	let { text = props$1.text } = $$props;
    	let { fontSize = props$1.fontSize } = $$props;
    	let { fontFamily = props$1.fontFamily } = $$props;
    	let { position = props$1.position } = $$props;
    	let { xmargin = props$1.xmargin } = $$props;
    	let { ymargin = props$1.ymargin } = $$props;
    	let { skew = props$1.skew } = $$props;
    	let x = 0;
    	let y = 0;
    	let actualWidth = 0;
    	let actualHeight = 0;
    	let svgContainer;
    	let textEl;
    	let textXScale = 1;
    	let textYScale = 1;

    	const updatePosition = () => {
    		if (position.includes("bottom")) {
    			$$invalidate("y", y = parentHeight - actualHeight - ymargin);
    		} else if (position.includes("top")) {
    			$$invalidate("y", y = ymargin);
    		} else {
    			$$invalidate("y", y = parentHeight / 2 - actualHeight / 2);
    		}

    		if (position.includes("right")) {
    			$$invalidate("x", x = parentWidth - actualWidth - xmargin);
    		} else if (position.includes("left")) {
    			$$invalidate("x", x = xmargin);
    		} else {
    			$$invalidate("x", x = parentWidth / 2 - actualWidth / 2 - skew);
    		}
    	};

    	const updateSvgTextDimensions = () => {
    		let BBox = textEl.getBBox();
    		$$invalidate("textXScale", textXScale = 1);
    		$$invalidate("textYScale", textYScale = 1);

    		if (BBox.width > maxWidth) {
    			$$invalidate("actualWidth", actualWidth = maxWidth);
    			$$invalidate("textXScale", textXScale = maxWidth / BBox.width);
    		} else if (BBox.width < minWidth) $$invalidate("actualWidth", actualWidth = minWidth); else $$invalidate("actualWidth", actualWidth = BBox.width);

    		if (BBox.height > maxHeight) {
    			$$invalidate("actualHeight", actualHeight = maxHeight);
    			$$invalidate("textYScale", textYScale = maxHeight / BBox.height);
    		} else if (BBox.height < minHeight) $$invalidate("actualHeight", actualHeight = minHeight); else $$invalidate("actualHeight", actualHeight = BBox.height);

    		updatePosition();
    	};

    	onMount(() => updateSvgTextDimensions());

    	const writable_props = [
    		"parentWidth",
    		"parentHeight",
    		"minWidth",
    		"maxWidth",
    		"minHeight",
    		"maxHeight",
    		"text",
    		"fontSize",
    		"fontFamily",
    		"position",
    		"xmargin",
    		"ymargin",
    		"skew"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<LowerThird> was created with unknown prop '${key}'`);
    	});

    	function text_1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate("textEl", textEl = $$value);
    		});
    	}

    	function svg_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate("svgContainer", svgContainer = $$value);
    		});
    	}

    	$$self.$set = $$props => {
    		if ("parentWidth" in $$props) $$invalidate("parentWidth", parentWidth = $$props.parentWidth);
    		if ("parentHeight" in $$props) $$invalidate("parentHeight", parentHeight = $$props.parentHeight);
    		if ("minWidth" in $$props) $$invalidate("minWidth", minWidth = $$props.minWidth);
    		if ("maxWidth" in $$props) $$invalidate("maxWidth", maxWidth = $$props.maxWidth);
    		if ("minHeight" in $$props) $$invalidate("minHeight", minHeight = $$props.minHeight);
    		if ("maxHeight" in $$props) $$invalidate("maxHeight", maxHeight = $$props.maxHeight);
    		if ("text" in $$props) $$invalidate("text", text = $$props.text);
    		if ("fontSize" in $$props) $$invalidate("fontSize", fontSize = $$props.fontSize);
    		if ("fontFamily" in $$props) $$invalidate("fontFamily", fontFamily = $$props.fontFamily);
    		if ("position" in $$props) $$invalidate("position", position = $$props.position);
    		if ("xmargin" in $$props) $$invalidate("xmargin", xmargin = $$props.xmargin);
    		if ("ymargin" in $$props) $$invalidate("ymargin", ymargin = $$props.ymargin);
    		if ("skew" in $$props) $$invalidate("skew", skew = $$props.skew);
    	};

    	$$self.$capture_state = () => {
    		return {
    			parentWidth,
    			parentHeight,
    			minWidth,
    			maxWidth,
    			minHeight,
    			maxHeight,
    			text,
    			fontSize,
    			fontFamily,
    			position,
    			xmargin,
    			ymargin,
    			skew,
    			x,
    			y,
    			actualWidth,
    			actualHeight,
    			svgContainer,
    			textEl,
    			textXScale,
    			textYScale
    		};
    	};

    	$$self.$inject_state = $$props => {
    		if ("parentWidth" in $$props) $$invalidate("parentWidth", parentWidth = $$props.parentWidth);
    		if ("parentHeight" in $$props) $$invalidate("parentHeight", parentHeight = $$props.parentHeight);
    		if ("minWidth" in $$props) $$invalidate("minWidth", minWidth = $$props.minWidth);
    		if ("maxWidth" in $$props) $$invalidate("maxWidth", maxWidth = $$props.maxWidth);
    		if ("minHeight" in $$props) $$invalidate("minHeight", minHeight = $$props.minHeight);
    		if ("maxHeight" in $$props) $$invalidate("maxHeight", maxHeight = $$props.maxHeight);
    		if ("text" in $$props) $$invalidate("text", text = $$props.text);
    		if ("fontSize" in $$props) $$invalidate("fontSize", fontSize = $$props.fontSize);
    		if ("fontFamily" in $$props) $$invalidate("fontFamily", fontFamily = $$props.fontFamily);
    		if ("position" in $$props) $$invalidate("position", position = $$props.position);
    		if ("xmargin" in $$props) $$invalidate("xmargin", xmargin = $$props.xmargin);
    		if ("ymargin" in $$props) $$invalidate("ymargin", ymargin = $$props.ymargin);
    		if ("skew" in $$props) $$invalidate("skew", skew = $$props.skew);
    		if ("x" in $$props) $$invalidate("x", x = $$props.x);
    		if ("y" in $$props) $$invalidate("y", y = $$props.y);
    		if ("actualWidth" in $$props) $$invalidate("actualWidth", actualWidth = $$props.actualWidth);
    		if ("actualHeight" in $$props) $$invalidate("actualHeight", actualHeight = $$props.actualHeight);
    		if ("svgContainer" in $$props) $$invalidate("svgContainer", svgContainer = $$props.svgContainer);
    		if ("textEl" in $$props) $$invalidate("textEl", textEl = $$props.textEl);
    		if ("textXScale" in $$props) $$invalidate("textXScale", textXScale = $$props.textXScale);
    		if ("textYScale" in $$props) $$invalidate("textYScale", textYScale = $$props.textYScale);
    	};

    	$$self.$$.update = (changed = { textEl: 1, text: 1, minWidth: 1, maxWidth: 1, position: 1, xmargin: 1, ymargin: 1, minHeight: 1, maxHeight: 1, fontSize: 1, skew: 1 }) => {
    		if (changed.textEl || changed.text || changed.minWidth || changed.maxWidth || changed.position || changed.xmargin || changed.ymargin || changed.minHeight || changed.maxHeight || changed.fontSize || changed.skew) {
    			 if (textEl) (async () => {
    				await tick();
    				updateSvgTextDimensions();
    			})();
    		}
    	};

    	return {
    		parentWidth,
    		parentHeight,
    		minWidth,
    		maxWidth,
    		minHeight,
    		maxHeight,
    		text,
    		fontSize,
    		fontFamily,
    		position,
    		xmargin,
    		ymargin,
    		skew,
    		x,
    		y,
    		actualWidth,
    		actualHeight,
    		svgContainer,
    		textEl,
    		textXScale,
    		textYScale,
    		text_1_binding,
    		svg_binding
    	};
    }

    class LowerThird extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			parentWidth: 0,
    			parentHeight: 0,
    			minWidth: 0,
    			maxWidth: 0,
    			minHeight: 0,
    			maxHeight: 0,
    			text: 0,
    			fontSize: 0,
    			fontFamily: 0,
    			position: 0,
    			xmargin: 0,
    			ymargin: 0,
    			skew: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "LowerThird",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (ctx.parentWidth === undefined && !("parentWidth" in props)) {
    			console.warn("<LowerThird> was created without expected prop 'parentWidth'");
    		}

    		if (ctx.parentHeight === undefined && !("parentHeight" in props)) {
    			console.warn("<LowerThird> was created without expected prop 'parentHeight'");
    		}
    	}

    	get parentWidth() {
    		throw new Error("<LowerThird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set parentWidth(value) {
    		throw new Error("<LowerThird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get parentHeight() {
    		throw new Error("<LowerThird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set parentHeight(value) {
    		throw new Error("<LowerThird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get minWidth() {
    		throw new Error("<LowerThird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set minWidth(value) {
    		throw new Error("<LowerThird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get maxWidth() {
    		throw new Error("<LowerThird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set maxWidth(value) {
    		throw new Error("<LowerThird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get minHeight() {
    		throw new Error("<LowerThird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set minHeight(value) {
    		throw new Error("<LowerThird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get maxHeight() {
    		throw new Error("<LowerThird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set maxHeight(value) {
    		throw new Error("<LowerThird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get text() {
    		throw new Error("<LowerThird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set text(value) {
    		throw new Error("<LowerThird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fontSize() {
    		throw new Error("<LowerThird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fontSize(value) {
    		throw new Error("<LowerThird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fontFamily() {
    		throw new Error("<LowerThird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fontFamily(value) {
    		throw new Error("<LowerThird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get position() {
    		throw new Error("<LowerThird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set position(value) {
    		throw new Error("<LowerThird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get xmargin() {
    		throw new Error("<LowerThird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set xmargin(value) {
    		throw new Error("<LowerThird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get ymargin() {
    		throw new Error("<LowerThird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ymargin(value) {
    		throw new Error("<LowerThird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get skew() {
    		throw new Error("<LowerThird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set skew(value) {
    		throw new Error("<LowerThird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var animations = {
      "box grid": {
        component: BoxGrid,
        animation: animation,
        props: props
      },
      "lower third": {
        component: LowerThird,
        animation: animation$1,
        props: props$1
      }
    };

    /* components/tools/timeline.svelte generated by Svelte v3.15.0 */

    const { console: console_1 } = globals;
    const file$3 = "components/tools/timeline.svelte";

    function create_fragment$3(ctx) {
    	let button0;
    	let t1;
    	let button1;
    	let t3;
    	let button2;
    	let t5;
    	let button3;
    	let t7;
    	let input;
    	let dispose;

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			button0.textContent = "(update!)";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "play";
    			t3 = space();
    			button2 = element("button");
    			button2.textContent = "pause";
    			t5 = space();
    			button3 = element("button");
    			button3.textContent = "restart";
    			t7 = space();
    			input = element("input");
    			add_location(button0, file$3, 44, 0, 915);
    			add_location(button1, file$3, 45, 0, 972);
    			add_location(button2, file$3, 46, 0, 1023);
    			add_location(button3, file$3, 47, 0, 1076);
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "100");
    			add_location(input, file$3, 48, 0, 1133);

    			dispose = [
    				listen_dev(button0, "click", ctx.click_handler, false, false, false),
    				listen_dev(button1, "click", ctx.click_handler_1, false, false, false),
    				listen_dev(button2, "click", ctx.click_handler_2, false, false, false),
    				listen_dev(button3, "click", ctx.click_handler_3, false, false, false),
    				listen_dev(
    					input,
    					"input",
    					function () {
    						ctx.input_handler.apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				)
    			];
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button2, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button3, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, input, anchor);
    			ctx.input_binding(input);
    		},
    		p: function update(changed, new_ctx) {
    			ctx = new_ctx;
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button2);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button3);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(input);
    			ctx.input_binding(null);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { animFunction } = $$props;
    	let anim;
    	let progress;

    	onMount(() => {
    		$$invalidate("anim", anim = anime({
    			...animFunction(),
    			autoplay: false,
    			update: () => {
    				$$invalidate("progress", progress.value = anim.progress, progress);
    			}
    		}));
    	});

    	const getTargets = ani => {
    		console.log(ani);
    		return ani.children.reduce((all, one) => all.concat(getTargets(one)), ani.animatables.map(a => a.target));
    	};

    	const cancelAnim = ani => getTargets(ani).forEach(anime.remove);

    	const updateAnim = () => {
    		anim.restart();
    		anim.pause();
    		cancelAnim(anim);
    		$$invalidate("anim", anim = null);

    		$$invalidate("anim", anim = anime({
    			...animFunction(),
    			autoplay: false,
    			update: () => {
    				$$invalidate("progress", progress.value = anim.progress, progress);
    			}
    		}));
    	};

    	const writable_props = ["animFunction"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Timeline> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => updateAnim();
    	const click_handler_1 = () => anim.play();
    	const click_handler_2 = () => anim.pause();
    	const click_handler_3 = () => anim.restart();

    	function input_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate("progress", progress = $$value);
    		});
    	}

    	const input_handler = evt => anim.seek(anim.duration * evt.target.value / 100);

    	$$self.$set = $$props => {
    		if ("animFunction" in $$props) $$invalidate("animFunction", animFunction = $$props.animFunction);
    	};

    	$$self.$capture_state = () => {
    		return { animFunction, anim, progress };
    	};

    	$$self.$inject_state = $$props => {
    		if ("animFunction" in $$props) $$invalidate("animFunction", animFunction = $$props.animFunction);
    		if ("anim" in $$props) $$invalidate("anim", anim = $$props.anim);
    		if ("progress" in $$props) $$invalidate("progress", progress = $$props.progress);
    	};

    	return {
    		animFunction,
    		anim,
    		progress,
    		updateAnim,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		input_binding,
    		input_handler
    	};
    }

    class Timeline extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { animFunction: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Timeline",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (ctx.animFunction === undefined && !("animFunction" in props)) {
    			console_1.warn("<Timeline> was created without expected prop 'animFunction'");
    		}
    	}

    	get animFunction() {
    		throw new Error("<Timeline>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set animFunction(value) {
    		throw new Error("<Timeline>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/shapes/Polygon.svelte generated by Svelte v3.15.0 */

    const file$4 = "components/shapes/Polygon.svelte";

    function create_fragment$4(ctx) {
    	let path_1;

    	const block = {
    		c: function create() {
    			path_1 = svg_element("path");
    			attr_dev(path_1, "d", ctx.path);
    			attr_dev(path_1, "style", ctx.style);
    			add_location(path_1, file$4, 65, 0, 2121);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path_1, anchor);
    		},
    		p: function update(changed, ctx) {
    			if (changed.path) {
    				attr_dev(path_1, "d", ctx.path);
    			}

    			if (changed.style) {
    				attr_dev(path_1, "style", ctx.style);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { width } = $$props;
    	let { sides } = $$props;
    	let { curve } = $$props;
    	let { style } = $$props;

    	const calcComponents = () => {
    		let radius = width / 2;
    		let ratio = 180 * (sides - 2) / sides;
    		let startingAngle = 180 - ratio;
    		let innerAngle = 180 - ratio;
    		let side = Math.sqrt(2 * radius ** 2 - 2 * radius ** 2 * Math.cos(innerAngle * Math.PI / 180));
    		return [side, startingAngle / 2, innerAngle];
    	};

    	let path;
    	let bezierPoints = [];
    	const writable_props = ["width", "sides", "curve", "style"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Polygon> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("width" in $$props) $$invalidate("width", width = $$props.width);
    		if ("sides" in $$props) $$invalidate("sides", sides = $$props.sides);
    		if ("curve" in $$props) $$invalidate("curve", curve = $$props.curve);
    		if ("style" in $$props) $$invalidate("style", style = $$props.style);
    	};

    	$$self.$capture_state = () => {
    		return {
    			width,
    			sides,
    			curve,
    			style,
    			path,
    			bezierPoints
    		};
    	};

    	$$self.$inject_state = $$props => {
    		if ("width" in $$props) $$invalidate("width", width = $$props.width);
    		if ("sides" in $$props) $$invalidate("sides", sides = $$props.sides);
    		if ("curve" in $$props) $$invalidate("curve", curve = $$props.curve);
    		if ("style" in $$props) $$invalidate("style", style = $$props.style);
    		if ("path" in $$props) $$invalidate("path", path = $$props.path);
    		if ("bezierPoints" in $$props) $$invalidate("bezierPoints", bezierPoints = $$props.bezierPoints);
    	};

    	$$self.$$.update = (changed = { width: 1, sides: 1, curve: 1, x: 1, y: 1, dir: 1, path: 1, bezierPoints: 1 }) => {
    		if (changed.width || changed.sides || changed.curve || changed.path || changed.bezierPoints) {
    			 {
    				$$invalidate("path", path = `M ${width / 2} 0`);
    				$$invalidate("bezierPoints", bezierPoints = []);
    				let x = width / 2;
    				let y = 0;
    				let dir = 0;
    				let KAPPA = 4 / 3 * Math.tan(Math.PI / (2 * sides));
    				const KLength = KAPPA * (width / 2);
    				const [sideLength, startingAngle, chDir] = calcComponents();
    				const curvFormula = () => chDir * curve / 2;

    				for (let i = 0; i < sides; i++) {
    					let xc1 = x + Math.cos(Math.PI / 180 * (startingAngle + dir - curvFormula())) * KLength;
    					let yc1 = y + Math.sin(Math.PI / 180 * (startingAngle + dir - curvFormula())) * KLength;
    					x += Math.cos(Math.PI / 180 * (startingAngle + dir)) * sideLength;
    					y += Math.sin(Math.PI / 180 * (startingAngle + dir)) * sideLength;
    					dir += chDir;
    					let xc2 = x - Math.cos(Math.PI / 180 * (startingAngle + dir - chDir + curvFormula())) * KLength;
    					let yc2 = y - Math.sin(Math.PI / 180 * (startingAngle + dir - chDir + curvFormula())) * KLength;
    					$$invalidate("path", path += `\nC${xc1} ${yc1}, ${xc2} ${yc2}, ${x} ${y}`);
    					bezierPoints.push([xc1, yc1], [xc2, yc2]);
    				}
    			}
    		}
    	};

    	return { width, sides, curve, style, path };
    }

    class Polygon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { width: 0, sides: 0, curve: 0, style: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Polygon",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (ctx.width === undefined && !("width" in props)) {
    			console.warn("<Polygon> was created without expected prop 'width'");
    		}

    		if (ctx.sides === undefined && !("sides" in props)) {
    			console.warn("<Polygon> was created without expected prop 'sides'");
    		}

    		if (ctx.curve === undefined && !("curve" in props)) {
    			console.warn("<Polygon> was created without expected prop 'curve'");
    		}

    		if (ctx.style === undefined && !("style" in props)) {
    			console.warn("<Polygon> was created without expected prop 'style'");
    		}
    	}

    	get width() {
    		throw new Error("<Polygon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Polygon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get sides() {
    		throw new Error("<Polygon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set sides(value) {
    		throw new Error("<Polygon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get curve() {
    		throw new Error("<Polygon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set curve(value) {
    		throw new Error("<Polygon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Polygon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Polygon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* App.svelte generated by Svelte v3.15.0 */

    const { Object: Object_1 } = globals;
    const file$5 = "App.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = Object_1.create(ctx);
    	child_ctx.propName = list[i][0];
    	child_ctx.defValue = list[i][1];
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = Object_1.create(ctx);
    	child_ctx.anim = list[i];
    	return child_ctx;
    }

    // (43:4) {#each Object.keys(animations) as anim}
    function create_each_block_1$1(ctx) {
    	let option;
    	let t_value = ctx.anim + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = animations[ctx.anim];
    			option.value = option.__value;
    			add_location(option, file$5, 43, 6, 900);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1$1.name,
    		type: "each",
    		source: "(43:4) {#each Object.keys(animations) as anim}",
    		ctx
    	});

    	return block;
    }

    // (47:2) {#each Object.entries(selectedAnimation.props) as [propName, defValue]}
    function create_each_block$1(ctx) {
    	let br;
    	let t0;
    	let span;
    	let t1_value = ctx.propName + "";
    	let t1;
    	let t2;
    	let t3;
    	let input;
    	let dispose;

    	function input_input_handler() {
    		ctx.input_input_handler.call(input, ctx);
    	}

    	const block = {
    		c: function create() {
    			br = element("br");
    			t0 = space();
    			span = element("span");
    			t1 = text(t1_value);
    			t2 = text(":");
    			t3 = space();
    			input = element("input");
    			add_location(br, file$5, 47, 4, 1053);
    			add_location(span, file$5, 48, 4, 1063);
    			add_location(input, file$5, 49, 4, 1092);
    			dispose = listen_dev(input, "input", input_input_handler);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, br, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, span, anchor);
    			append_dev(span, t1);
    			append_dev(span, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, input, anchor);
    			set_input_value(input, ctx.selectedAnimation.props[ctx.propName]);
    		},
    		p: function update(changed, new_ctx) {
    			ctx = new_ctx;
    			if (changed.selectedAnimation && t1_value !== (t1_value = ctx.propName + "")) set_data_dev(t1, t1_value);

    			if ((changed.selectedAnimation || changed.Object) && input.value !== ctx.selectedAnimation.props[ctx.propName]) {
    				set_input_value(input, ctx.selectedAnimation.props[ctx.propName]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(input);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(47:2) {#each Object.entries(selectedAnimation.props) as [propName, defValue]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let main;
    	let select;
    	let t0;
    	let t1;
    	let br0;
    	let t2;
    	let span0;
    	let t4;
    	let input0;
    	let input0_updating = false;
    	let t5;
    	let br1;
    	let t6;
    	let span1;
    	let t8;
    	let input1;
    	let input1_updating = false;
    	let t9;
    	let br2;
    	let t10;
    	let svg;
    	let switch_instance_anchor;
    	let t11;
    	let br3;
    	let t12;
    	let current;
    	let dispose;
    	let each_value_1 = Object.keys(animations);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	let each_value = Object.entries(ctx.selectedAnimation.props);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	function input0_input_handler() {
    		input0_updating = true;
    		ctx.input0_input_handler.call(input0);
    	}

    	function input1_input_handler() {
    		input1_updating = true;
    		ctx.input1_input_handler.call(input1);
    	}

    	const switch_instance_spread_levels = [{ parentWidth: 500 }, { parentHeight: 500 }, ctx.selectedAnimation.props];
    	var switch_value = ctx.selectedAnimation.component;

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		var switch_instance = new switch_value(switch_props());
    	}

    	const pg = new Polygon({
    			props: {
    				width: 100,
    				sides: ctx.numSides,
    				curve: ctx.curve,
    				style: "stroke: #000; fill:transparent; transform: translateX(50px) translateY(50px)"
    			},
    			$$inline: true
    		});

    	const timeline = new Timeline({
    			props: {
    				animFunction: ctx.selectedAnimation.animation
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			main = element("main");
    			select = element("select");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t0 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			br0 = element("br");
    			t2 = space();
    			span0 = element("span");
    			span0.textContent = "num of sides";
    			t4 = space();
    			input0 = element("input");
    			t5 = space();
    			br1 = element("br");
    			t6 = space();
    			span1 = element("span");
    			span1.textContent = "curvature";
    			t8 = space();
    			input1 = element("input");
    			t9 = space();
    			br2 = element("br");
    			t10 = space();
    			svg = svg_element("svg");
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    			create_component(pg.$$.fragment);
    			t11 = space();
    			br3 = element("br");
    			t12 = space();
    			create_component(timeline.$$.fragment);
    			if (ctx.selectedAnimation === void 0) add_render_callback(() => ctx.select_change_handler.call(select));
    			add_location(select, file$5, 41, 2, 810);
    			add_location(br0, file$5, 52, 2, 1164);
    			add_location(span0, file$5, 53, 2, 1172);
    			attr_dev(input0, "type", "number");
    			add_location(input0, file$5, 54, 2, 1200);
    			add_location(br1, file$5, 55, 2, 1247);
    			add_location(span1, file$5, 56, 2, 1255);
    			attr_dev(input1, "type", "number");
    			add_location(input1, file$5, 57, 2, 1280);
    			add_location(br2, file$5, 59, 2, 1325);
    			attr_dev(svg, "id", "main-display");
    			attr_dev(svg, "width", "500");
    			attr_dev(svg, "height", "500");
    			attr_dev(svg, "class", "svelte-lpikhh");
    			add_location(svg, file$5, 60, 2, 1333);
    			add_location(br3, file$5, 72, 2, 1697);
    			attr_dev(main, "class", "svelte-lpikhh");
    			add_location(main, file$5, 39, 0, 800);

    			dispose = [
    				listen_dev(select, "change", ctx.select_change_handler),
    				listen_dev(input0, "input", input0_input_handler),
    				listen_dev(input1, "input", input1_input_handler)
    			];
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, select);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(select, null);
    			}

    			select_option(select, ctx.selectedAnimation);
    			append_dev(main, t0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(main, null);
    			}

    			append_dev(main, t1);
    			append_dev(main, br0);
    			append_dev(main, t2);
    			append_dev(main, span0);
    			append_dev(main, t4);
    			append_dev(main, input0);
    			set_input_value(input0, ctx.numSides);
    			append_dev(main, t5);
    			append_dev(main, br1);
    			append_dev(main, t6);
    			append_dev(main, span1);
    			append_dev(main, t8);
    			append_dev(main, input1);
    			set_input_value(input1, ctx.curve);
    			append_dev(main, t9);
    			append_dev(main, br2);
    			append_dev(main, t10);
    			append_dev(main, svg);

    			if (switch_instance) {
    				mount_component(switch_instance, svg, null);
    			}

    			append_dev(svg, switch_instance_anchor);
    			mount_component(pg, svg, null);
    			append_dev(main, t11);
    			append_dev(main, br3);
    			append_dev(main, t12);
    			mount_component(timeline, main, null);
    			current = true;
    		},
    		p: function update(changed, ctx) {
    			if (changed.animations || changed.Object) {
    				each_value_1 = Object.keys(animations);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(changed, child_ctx);
    					} else {
    						each_blocks_1[i] = create_each_block_1$1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (changed.selectedAnimation) {
    				select_option(select, ctx.selectedAnimation);
    			}

    			if (changed.selectedAnimation || changed.Object) {
    				each_value = Object.entries(ctx.selectedAnimation.props);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(main, t1);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (!input0_updating && changed.numSides) {
    				set_input_value(input0, ctx.numSides);
    			}

    			input0_updating = false;

    			if (!input1_updating && changed.curve) {
    				set_input_value(input1, ctx.curve);
    			}

    			input1_updating = false;

    			const switch_instance_changes = changed.selectedAnimation
    			? get_spread_update(switch_instance_spread_levels, [
    					switch_instance_spread_levels[0],
    					switch_instance_spread_levels[1],
    					get_spread_object(ctx.selectedAnimation.props)
    				])
    			: {};

    			if (switch_value !== (switch_value = ctx.selectedAnimation.component)) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, svg, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}

    			const pg_changes = {};
    			if (changed.numSides) pg_changes.sides = ctx.numSides;
    			if (changed.curve) pg_changes.curve = ctx.curve;
    			pg.$set(pg_changes);
    			const timeline_changes = {};
    			if (changed.selectedAnimation) timeline_changes.animFunction = ctx.selectedAnimation.animation;
    			timeline.$set(timeline_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			transition_in(pg.$$.fragment, local);
    			transition_in(timeline.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			transition_out(pg.$$.fragment, local);
    			transition_out(timeline.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			if (switch_instance) destroy_component(switch_instance);
    			destroy_component(pg);
    			destroy_component(timeline);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let selectedAnimation = animations["lower third"];
    	let numSides = 2;
    	let curve = 0;

    	onMount(() => {
    		let thing = anime({
    			targets: { value: 3 },
    			value: 20,
    			duration: 5000,
    			easing: "easeInOutBack",
    			direction: "alternate",
    			loop: true,
    			update(anim) {
    				$$invalidate("numSides", numSides = anim.animations[0].currentValue);
    			}
    		});
    	});

    	function select_change_handler() {
    		selectedAnimation = select_value(this);
    		$$invalidate("selectedAnimation", selectedAnimation);
    		$$invalidate("animations", animations);
    		$$invalidate("Object", Object);
    	}

    	function input_input_handler({ propName }) {
    		selectedAnimation.props[propName] = this.value;
    		$$invalidate("selectedAnimation", selectedAnimation);
    		$$invalidate("Object", Object);
    		$$invalidate("animations", animations);
    	}

    	function input0_input_handler() {
    		numSides = to_number(this.value);
    		$$invalidate("numSides", numSides);
    	}

    	function input1_input_handler() {
    		curve = to_number(this.value);
    		$$invalidate("curve", curve);
    	}

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("selectedAnimation" in $$props) $$invalidate("selectedAnimation", selectedAnimation = $$props.selectedAnimation);
    		if ("numSides" in $$props) $$invalidate("numSides", numSides = $$props.numSides);
    		if ("curve" in $$props) $$invalidate("curve", curve = $$props.curve);
    	};

    	return {
    		selectedAnimation,
    		numSides,
    		curve,
    		select_change_handler,
    		input_input_handler,
    		input0_input_handler,
    		input1_input_handler
    	};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
