/* Depmap viewer
 *
 * Reads the graph JSON embedded at #graph, builds a Cytoscape graph, and wires up
 * selection, filters, search, layout toggles, and the impact-analysis side panels.
 *
 * No framework. No build step. No network.
 */
(function () {
  'use strict';

  // ---------- Data ----------------------------------------------------------
  var graphEl = document.getElementById('graph');
  var graph;
  try {
    graph = JSON.parse(graphEl.textContent);
  } catch (e) {
    document.body.innerHTML = '<pre style="padding:20px;color:#f88">Failed to parse embedded graph JSON: ' + e.message + '</pre>';
    return;
  }

  // Build lookup maps.
  var nodesById = Object.create(null);
  var projectsById = Object.create(null);
  var packagesById = Object.create(null);

  graph.repos.forEach(function (r) { nodesById[r.id] = { ...r, type: 'repo' }; });
  graph.solutions.forEach(function (s) { nodesById[s.id] = { ...s, type: 'solution' }; });
  graph.projects.forEach(function (p) { nodesById[p.id] = { ...p, type: 'project' }; projectsById[p.id] = p; });
  graph.packages.forEach(function (p) { nodesById[p.id] = { ...p, type: 'package' }; packagesById[p.id] = p; });

  // Reverse adjacency (used for impact analysis).
  var reverseAdj = Object.create(null); // id -> [{from, kind}]
  var forwardAdj = Object.create(null);
  graph.edges.forEach(function (e) {
    (reverseAdj[e.to] = reverseAdj[e.to] || []).push(e);
    (forwardAdj[e.from] = forwardAdj[e.from] || []).push(e);
  });

  // Impact analysis: reverse BFS across all edge kinds. Crosses produced-by edges so that a change
  // in a packable project reaches consumers via its published NuGet.
  function reverseReach(startId) {
    var seen = Object.create(null);
    var queue = [startId];
    seen[startId] = true;
    while (queue.length) {
      var cur = queue.shift();
      var incoming = reverseAdj[cur] || [];
      for (var i = 0; i < incoming.length; i++) {
        var e = incoming[i];
        if (!seen[e.from]) { seen[e.from] = true; queue.push(e.from); }
      }
    }
    delete seen[startId];
    return Object.keys(seen);
  }

  function forwardReach(startId) {
    var seen = Object.create(null);
    var queue = [startId];
    seen[startId] = true;
    while (queue.length) {
      var cur = queue.shift();
      var outgoing = forwardAdj[cur] || [];
      for (var i = 0; i < outgoing.length; i++) {
        var e = outgoing[i];
        if (!seen[e.to]) { seen[e.to] = true; queue.push(e.to); }
      }
    }
    delete seen[startId];
    return Object.keys(seen);
  }

  function projectKinds(p) { return (p && p.kinds) || []; }
  function isTest(p) { return projectKinds(p).indexOf('test') !== -1; }
  function isDeployable(p) { return projectKinds(p).indexOf('web') !== -1 || projectKinds(p).indexOf('service') !== -1; }

  // ---------- Cytoscape wiring ---------------------------------------------
  if (typeof cytoscape === 'undefined') {
    document.body.innerHTML = '<pre style="padding:20px;color:#f88">Cytoscape.js is not available. If this is a dev build, ensure the viewer script tag for cytoscape is included.</pre>';
    return;
  }

  if (typeof cytoscapeFcose !== 'undefined') { cytoscape.use(cytoscapeFcose); }
  if (typeof cytoscapeDagre !== 'undefined') { cytoscape.use(cytoscapeDagre); }

  var canvas = document.getElementById('canvas');
  var cyContainer = document.createElement('div');
  cyContainer.id = 'cy';
  canvas.appendChild(cyContainer);

  var elements = [];

  // Project nodes
  graph.projects.forEach(function (p) {
    elements.push({
      data: {
        id: p.id,
        label: p.name,
        type: 'project',
        kinds: (p.kinds || []).join(' '),
        repo: p.repo,
      },
      classes: ['n-project'].concat((p.kinds || []).map(function (k) { return 'kind-' + k; })).join(' '),
    });
  });

  // Package nodes
  graph.packages.forEach(function (pkg) {
    elements.push({
      data: {
        id: pkg.id,
        label: pkg.name,
        type: 'package',
        classification: pkg.classification,
      },
      classes: 'n-package pkg-' + pkg.classification,
    });
  });

  // Edges
  graph.edges.forEach(function (e, i) {
    // Solution-contains edges are not rendered by default (too visually noisy). They live in the data only
    // so we can honour "group by solution" in the future if needed.
    if (e.kind === 'solutionContains') return;
    elements.push({
      data: { id: 'e' + i, source: e.from, target: e.to, kind: e.kind },
      classes: 'e-' + e.kind,
    });
  });

  var cy = cytoscape({
    container: cyContainer,
    elements: elements,
    wheelSensitivity: 0.2,
    style: [
      { selector: 'node', style: {
        'label': 'data(label)',
        'color': '#e6e9ef',
        'font-size': 10,
        'text-valign': 'bottom', 'text-halign': 'center',
        'text-margin-y': 4,
        'background-color': '#94a3b8',
        'width': 28, 'height': 28,
        'border-width': 1, 'border-color': '#2a303d',
      }},
      { selector: '.n-project', style: { shape: 'round-rectangle', 'background-color': '#94a3b8' }},
      { selector: '.kind-test', style: { 'background-color': '#a78bfa' }},
      { selector: '.kind-web', style: { 'background-color': '#f59e0b' }},
      { selector: '.kind-blazor', style: { 'background-color': '#ec4899' }},
      { selector: '.kind-service', style: { 'background-color': '#14b8a6' }},
      { selector: '.kind-nuget-producing', style: { 'border-color': '#22c55e', 'border-width': 2 }},
      { selector: '.n-package', style: { shape: 'diamond' }},
      { selector: '.pkg-internal', style: { 'background-color': '#22c55e' }},
      { selector: '.pkg-unknown',  style: { 'background-color': '#64748b', opacity: 0.7 }},
      { selector: '.pkg-external', style: { 'background-color': '#64748b', opacity: 0.7 }},

      { selector: 'edge', style: {
        'width': 1,
        'line-color': '#2a303d',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#2a303d',
        'curve-style': 'bezier',
        'arrow-scale': 0.8,
      }},
      { selector: '.e-projectRef', style: { 'line-color': '#4ea1f3', 'target-arrow-color': '#4ea1f3' }},
      { selector: '.e-packageRef', style: { 'line-color': '#5ecb5e', 'target-arrow-color': '#5ecb5e' }},
      { selector: '.e-packageRefTransitive', style: { 'line-color': '#3b4150', 'target-arrow-color': '#3b4150', 'line-style': 'dashed' }},
      { selector: '.e-producedBy', style: { 'line-color': '#22c55e', 'target-arrow-color': '#22c55e', 'line-style': 'dotted' }},

      // Selection highlighting
      { selector: '.dim', style: { opacity: 0.12 }},
      { selector: '.hilite', style: { opacity: 1 }},
      { selector: '.ancestor', style: { 'border-color': '#ef5350', 'border-width': 3 }},
      { selector: '.descendant', style: { 'border-color': '#4ea1f3', 'border-width': 3 }},
      { selector: ':selected', style: { 'border-color': '#fff', 'border-width': 3 }},
    ],
    layout: { name: 'grid' },
  });

  // ---------- Layouts -------------------------------------------------------
  function runLayout(name) {
    var cfg;
    if (name === 'fcose' && typeof cytoscapeFcose !== 'undefined') {
      cfg = { name: 'fcose', animate: false, nodeRepulsion: 4500, idealEdgeLength: 90, packComponents: true };
    } else if (name === 'dagre' && typeof cytoscapeDagre !== 'undefined') {
      cfg = { name: 'dagre', rankDir: 'LR', nodeSep: 20, rankSep: 60 };
    } else if (name === 'concentric') {
      cfg = { name: 'concentric', concentric: function (n) { return n.degree(); }, levelWidth: function () { return 2; }};
    } else {
      cfg = { name: 'cose' }; // fallback always available
    }
    cy.layout(cfg).run();
  }
  runLayout('fcose');

  // ---------- Selection + impact ------------------------------------------
  function clearHighlights() {
    cy.elements().removeClass('dim hilite ancestor descendant');
  }

  function highlightSelection(id) {
    clearHighlights();
    var ancestors = reverseReach(id);
    var descendants = forwardReach(id);
    var keep = new Set([id].concat(ancestors).concat(descendants));
    cy.nodes().forEach(function (n) {
      if (!keep.has(n.id())) n.addClass('dim');
      else n.addClass('hilite');
    });
    cy.edges().forEach(function (e) {
      if (!(keep.has(e.source().id()) && keep.has(e.target().id()))) e.addClass('dim');
      else e.addClass('hilite');
    });
    ancestors.forEach(function (aid) { var n = cy.getElementById(aid); if (n && n.nonempty()) n.addClass('ancestor'); });
    descendants.forEach(function (did) { var n = cy.getElementById(did); if (n && n.nonempty()) n.addClass('descendant'); });
  }

  function renderSelection(id) {
    var node = nodesById[id];
    var panel = document.getElementById('selectionPanel');
    var details = document.getElementById('selectionDetails');
    if (!node) { panel.hidden = true; return; }
    panel.hidden = false;

    var rows = [];
    function row(k, v) { if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return; rows.push('<div class="row"><span class="key">' + k + '</span><span class="val">' + escapeHtml(String(Array.isArray(v) ? v.join(', ') : v)) + '</span></div>'); }
    row('Type', node.type);
    row('Name', node.name || node.label);
    if (node.type === 'project') {
      row('Kinds', (node.kinds || []).join(', '));
      row('SDK', node.sdk);
      row('TFMs', node.tfms);
      row('Package ID', node.packageId);
      row('Path', node.path);
    } else if (node.type === 'package') {
      row('Classification', node.classification);
      row('Versions', (node.versions || []).join(', '));
      if (node.producedBy) {
        var prod = projectsById[node.producedBy];
        row('Produced by', prod ? prod.name : node.producedBy);
      }
    }
    details.innerHTML = rows.join('');

    // Impact panels
    var ancestors = reverseReach(id);
    var tests = ancestors.map(function (aid) { return projectsById[aid]; }).filter(function (p) { return p && isTest(p); });
    var deployables = ancestors.map(function (aid) { return projectsById[aid]; }).filter(function (p) { return p && isDeployable(p); });
    renderPathList('testsPanel', 'testsList', 'testsCount', tests);
    renderPathList('deployablesPanel', 'deployablesList', 'deployablesCount', deployables);
  }

  function renderPathList(panelId, listId, countId, projects) {
    var panel = document.getElementById(panelId);
    var list = document.getElementById(listId);
    var count = document.getElementById(countId);
    if (!projects.length) { panel.hidden = true; return; }
    panel.hidden = false;
    count.textContent = projects.length;
    projects.sort(function (a, b) { return a.name.localeCompare(b.name); });
    list.innerHTML = projects.map(function (p) {
      return '<li data-id="' + p.id + '">' + escapeHtml(p.name) + '<br><span class="muted">' + escapeHtml(p.path) + '</span></li>';
    }).join('');
    list.onclick = function (e) {
      var li = e.target.closest('li'); if (!li) return;
      selectNode(li.getAttribute('data-id'));
    };
  }

  function selectNode(id) {
    cy.elements().unselect();
    var n = cy.getElementById(id);
    if (n && n.nonempty()) {
      n.select();
      cy.animate({ center: { eles: n }, zoom: Math.max(cy.zoom(), 0.9) }, { duration: 200 });
    }
    highlightSelection(id);
    renderSelection(id);
  }

  cy.on('tap', 'node', function (evt) { selectNode(evt.target.id()); });
  cy.on('tap', function (evt) {
    if (evt.target === cy) {
      clearHighlights();
      document.getElementById('selectionPanel').hidden = true;
      document.getElementById('testsPanel').hidden = true;
      document.getElementById('deployablesPanel').hidden = true;
    }
  });

  // ---------- Filters & search ---------------------------------------------
  var allKinds = ['library', 'test', 'web', 'blazor', 'service', 'nuget-producing'];
  var kindFiltersEl = document.getElementById('kindFilters');
  kindFiltersEl.innerHTML = allKinds.map(function (k) {
    return '<label class="toggle"><input type="checkbox" class="kind" value="' + k + '" checked /> ' + k + '</label>';
  }).join('');

  function applyFilters() {
    var enabledKinds = Array.from(document.querySelectorAll('.kind')).filter(function (el) { return el.checked; }).map(function (el) { return el.value; });
    var showExternal = document.getElementById('showExternal').checked;
    var showTransitive = document.getElementById('showTransitive').checked;

    cy.batch(function () {
      cy.nodes().forEach(function (n) {
        var d = n.data();
        var visible = true;
        if (d.type === 'project') {
          var kinds = (d.kinds || '').split(/\s+/).filter(Boolean);
          if (kinds.length === 0) kinds = ['library'];
          visible = kinds.some(function (k) { return enabledKinds.indexOf(k) !== -1; });
        } else if (d.type === 'package') {
          if ((d.classification === 'external' || d.classification === 'unknown') && !showExternal) visible = false;
        }
        n.style('display', visible ? 'element' : 'none');
      });
      cy.edges().forEach(function (e) {
        var visible = true;
        if (e.data('kind') === 'packageRefTransitive' && !showTransitive) visible = false;
        if (e.source().style('display') === 'none' || e.target().style('display') === 'none') visible = false;
        e.style('display', visible ? 'element' : 'none');
      });
    });
  }

  document.getElementById('kindFilters').addEventListener('change', applyFilters);
  document.getElementById('showExternal').addEventListener('change', applyFilters);
  document.getElementById('showTransitive').addEventListener('change', applyFilters);
  applyFilters();

  document.getElementById('search').addEventListener('input', function (e) {
    var q = e.target.value.trim().toLowerCase();
    if (!q) { cy.nodes().removeClass('dim'); return; }
    cy.nodes().forEach(function (n) {
      var label = (n.data('label') || '').toLowerCase();
      if (label.indexOf(q) === -1) n.addClass('dim'); else n.removeClass('dim');
    });
  });

  document.querySelectorAll('.segmented button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.segmented button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      runLayout(b.getAttribute('data-layout'));
    });
  });

  // ---------- Summary + footer ---------------------------------------------
  document.getElementById('summary').textContent =
    graph.repos.length + ' repos • ' + graph.projects.length + ' projects • ' +
    graph.packages.length + ' packages • ' + graph.edges.length + ' edges';
  document.getElementById('footer').textContent = 'Scanned ' + (graph.scannedAt || '') + ' — click a node to see impact';

  // ---------- Helpers -------------------------------------------------------
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
