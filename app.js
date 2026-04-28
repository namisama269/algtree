// ============================================================
// SECTION 1: MOVE REPRESENTATION
// ============================================================

const FACE_CSS = {
    'R': 'mv-R', 'L': 'mv-L', 'U': 'mv-U', 'D': 'mv-D',
    'F': 'mv-F', 'B': 'mv-B',
    'r': 'mv-r', 'l': 'mv-l', 'u': 'mv-u', 'd': 'mv-d',
    'f': 'mv-f', 'b': 'mv-b',
    'Rw': 'mv-r', 'Lw': 'mv-l', 'Uw': 'mv-u', 'Dw': 'mv-d',
    'Fw': 'mv-f', 'Bw': 'mv-b',
    'M': 'mv-M', 'E': 'mv-E', 'S': 'mv-S',
    'x': 'mv-x', 'y': 'mv-y', 'z': 'mv-z',
};

// ============================================================
// SECTION 2: PARSING
// ============================================================

const MOVE_REGEX = /([RLUDFBrludfb]w?|[MESxyz])([2]?['\u2019]?)/g;

function parse(str) {
    str = str.replace(/\u2019/g, "'");
    const moves = [];
    let m;
    MOVE_REGEX.lastIndex = 0;
    while ((m = MOVE_REGEX.exec(str)) !== null) {
        const face = m[1];
        const mod = m[2];
        let amount;
        if (mod === '' || mod === undefined) {
            amount = 1;
        } else if (mod === '2' || mod === "2'") {
            amount = 2;
        } else if (mod === "'") {
            amount = 3;
        } else {
            amount = 1;
        }
        moves.push({ face, amount });
    }
    return moves;
}

function moveToString(move) {
    const suffix = move.amount === 2 ? '2' : move.amount === 3 ? "'" : '';
    return move.face + suffix;
}

function algToString(moves) {
    return moves.map(moveToString).join(' ');
}

// ============================================================
// SECTION 3: SIMPLIFICATION
// ============================================================

function simplify(moves) {
    const stack = [];
    for (const move of moves) {
        if (stack.length > 0 && stack[stack.length - 1].face === move.face) {
            const combined = (stack[stack.length - 1].amount + move.amount) % 4;
            if (combined === 0) {
                stack.pop();
            } else {
                stack[stack.length - 1] = { face: move.face, amount: combined };
            }
        } else {
            stack.push({ face: move.face, amount: move.amount });
        }
    }
    return stack;
}

function invertMoves(moves) {
    return moves.map(m => ({ face: m.face, amount: (4 - m.amount) % 4 })).reverse();
}

function compareMoves(a, b) {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const faceCmp = a[i].face.localeCompare(b[i].face);
        if (faceCmp !== 0) return faceCmp;
        if (a[i].amount !== b[i].amount) return a[i].amount - b[i].amount;
    }
    return a.length - b.length;
}

// ============================================================
// SECTION 4: FACTORIZATION
// ============================================================

function computeSetup(algA, algB) {
    const invB = invertMoves(algB);
    const combined = algA.concat(invB);
    return simplify(combined);
}

function findPrefixSetup(childMoves, parentMoves, maxCancel) {
    const setup = computeSetup(childMoves, parentMoves);
    const explained = childMoves.length - setup.length;
    const cancellations = setup.length + parentMoves.length - childMoves.length;
    if (cancellations > maxCancel || explained <= 0) return null;
    return { setup, cancellations, explained, isConjugate: false };
}

function findConjugateSetup(childMoves, parentMoves, maxCancel) {
    if (parentMoves.length >= childMoves.length || parentMoves.length === 0) return null;

    const maxSetupLen = Math.floor((childMoves.length - parentMoves.length + maxCancel) / 2);
    if (maxSetupLen < 1) return null;

    let bestSetup = null;
    let bestCancel = Infinity;

    // Strategy 1: Try prefixes of child as setup (handles no-cancellation case)
    for (let k = 1; k <= Math.min(maxSetupLen, childMoves.length - 1); k++) {
        const S = childMoves.slice(0, k);
        const candidate = simplify([...S, ...parentMoves, ...invertMoves(S)]);
        if (movesEqual(candidate, childMoves)) {
            const cancel = 2 * k + parentMoves.length - childMoves.length;
            if (cancel >= 0 && cancel <= maxCancel && (bestSetup === null || k < bestSetup.length)) {
                bestSetup = S;
                bestCancel = cancel;
            }
        }
    }

    // Strategy 2: Enumerate single-move setups (handles cancellation at boundaries)
    if (maxSetupLen >= 1) {
        const faces = ['R','L','U','D','F','B','M','E','S','r','l','u','d','f','b','x','y','z'];
        for (const face of faces) {
            for (const amount of [1, 2, 3]) {
                const S = [{ face, amount }];
                const candidate = simplify([...S, ...parentMoves, ...invertMoves(S)]);
                if (movesEqual(candidate, childMoves)) {
                    const cancel = 2 + parentMoves.length - childMoves.length;
                    if (cancel >= 0 && cancel <= maxCancel && (bestSetup === null || 1 < bestSetup.length)) {
                        bestSetup = S;
                        bestCancel = cancel;
                    }
                }
            }
        }
    }

    // Strategy 3: Enumerate two-move setups (for setups like F R, U R, etc.)
    if (maxSetupLen >= 2) {
        const faces = ['R','L','U','D','F','B'];
        for (const f1 of faces) {
            for (const a1 of [1, 2, 3]) {
                for (const f2 of faces) {
                    if (f1 === f2) continue;
                    for (const a2 of [1, 2, 3]) {
                        const S = [{ face: f1, amount: a1 }, { face: f2, amount: a2 }];
                        const candidate = simplify([...S, ...parentMoves, ...invertMoves(S)]);
                        if (movesEqual(candidate, childMoves)) {
                            const cancel = 4 + parentMoves.length - childMoves.length;
                            if (cancel >= 0 && cancel <= maxCancel && (bestSetup === null || 2 < bestSetup.length)) {
                                bestSetup = S;
                                bestCancel = cancel;
                            }
                        }
                    }
                }
            }
        }
    }

    if (!bestSetup) return null;
    return { setup: bestSetup, cancellations: bestCancel, explained: parentMoves.length, isConjugate: true };
}

function movesEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].face !== b[i].face || a[i].amount !== b[i].amount) return false;
    }
    return true;
}

// ============================================================
// SECTION 5: TREE BUILDING
// ============================================================

function buildTree(algorithms, extraBases) {
    extraBases = extraBases || [];
    const MAX_CANCELLATIONS = parseInt($('opt-max-cancel').value) || 2;
    const setupMode = $('opt-setup-mode').value;

    // Combine main algorithms and extra bases into one pool
    const allAlgs = algorithms.concat(extraBases);
    const nodes = allAlgs.map(alg => ({
        alg,
        children: [],
        setup: null,
        parent: null,
        cancellations: 0,
        isConjugate: false,
        isExtra: !!alg.isExtra,
    }));

    const mainCount = algorithms.length;

    const root = {
        alg: { original: '', moves: [], name: '(identity)' },
        children: [],
        setup: null,
        parent: null,
        cancellations: 0,
        isConjugate: false,
    };

    // Only find parents for all nodes, but any node can be a parent
    for (let i = 0; i < nodes.length; i++) {
        let bestParentIdx = -1;
        let bestResult = null;
        let bestExplained = 0;

        for (let j = 0; j < nodes.length; j++) {
            if (i === j) continue;
            if (nodes[j].alg.moves.length >= nodes[i].alg.moves.length) continue;

            let result = null;

            if (setupMode === 'prefix' || setupMode === 'both') {
                const prefixResult = findPrefixSetup(nodes[i].alg.moves, nodes[j].alg.moves, MAX_CANCELLATIONS);
                if (prefixResult && prefixResult.explained > (result ? result.explained : 0)) {
                    result = prefixResult;
                }
            }

            if (setupMode === 'conjugate' || setupMode === 'both') {
                const conjResult = findConjugateSetup(nodes[i].alg.moves, nodes[j].alg.moves, MAX_CANCELLATIONS);
                if (conjResult && conjResult.explained > (result ? result.explained : 0)) {
                    result = conjResult;
                }
            }

            if (result && result.explained > bestExplained) {
                bestExplained = result.explained;
                bestParentIdx = j;
                bestResult = result;
            }
        }

        if (bestParentIdx >= 0 && bestExplained > 0) {
            nodes[i].parent = nodes[bestParentIdx];
            nodes[i].setup = bestResult.setup;
            nodes[i].cancellations = bestResult.cancellations;
            nodes[i].isConjugate = bestResult.isConjugate;
            nodes[bestParentIdx].children.push(nodes[i]);
        } else {
            nodes[i].parent = root;
            root.children.push(nodes[i]);
        }
    }

    // Remove extra base nodes that have no children (they're only useful as parents)
    root.children = root.children.filter(n => !n.isExtra);
    // Extra bases with children get added to root
    for (const n of nodes) {
        if (n.isExtra && n.children.length > 0 && n.parent === root) {
            root.children.push(n);
        }
    }

    root.children.sort((a, b) => {
        const countDiff = b.children.length - a.children.length;
        if (countDiff !== 0) return countDiff;
        return compareMoves(a.alg.moves, b.alg.moves);
    });

    const childSortMode = $('opt-child-sort').value;
    if (childSortMode === 'length') {
        for (const rootChild of root.children) {
            const flat = [];
            function collectAll(n) {
                for (const child of n.children) {
                    flat.push(child);
                    collectAll(child);
                }
            }
            collectAll(rootChild);
            for (const node of flat) node.children = [];
            flat.sort((a, b) => {
                const lenDiff = a.alg.moves.length - b.alg.moves.length;
                if (lenDiff !== 0) return lenDiff;
                const setupDiff = (a.setup ? a.setup.length : 0) - (b.setup ? b.setup.length : 0);
                if (setupDiff !== 0) return setupDiff;
                return compareMoves(a.alg.moves, b.alg.moves);
            });
            rootChild.children = flat;
        }
    } else {
        function sortChildren(node) {
            if (node.children.length === 0) return;
            node.children.sort((a, b) => {
                const countDiff = countDescendants(b) - countDescendants(a);
                if (countDiff !== 0) return countDiff;
                return compareMoves(a.alg.moves, b.alg.moves);
            });
            for (const child of node.children) sortChildren(child);
        }
        for (const child of root.children) sortChildren(child);
    }

    return root;
}

// ============================================================
// SECTION 6: RENDERING
// ============================================================

function countDescendants(node) {
    let count = node.children.length;
    for (const child of node.children) count += countDescendants(child);
    return count;
}

const $ = id => document.getElementById(id);

function getOptions() {
    return {
        showSetup: $('opt-setup').checked,
        colorMoves: $('opt-color').checked,
        showCancel: $('opt-cancel').checked,
    };
}

function colorMoveSpan(move, extraClass) {
    const opts = getOptions();
    const cls = opts.colorMoves ? 'mv-accent' : '';
    const allCls = [cls, extraClass || ''].filter(Boolean).join(' ');
    return `<span class="${allCls}">${moveToString(move)}</span>`;
}

function colorMovesHtml(moves) {
    return moves.map(m => colorMoveSpan(m)).join(' ');
}

function renderTree(root, container) {
    container.innerHTML = '';

    if (root.children.length === 0) {
        container.innerHTML = '<div class="text-body-secondary fst-italic text-center p-5">No algorithms to display. Enter algorithms and click "Build Tree".</div>';
        return;
    }

    const maxDepth = parseInt($('opt-max-depth').value) || 0;

    for (const child of root.children) {
        container.appendChild(renderNode(child, true, 0, maxDepth));
    }
}

function renderSetupSpan(setup, cancellations, opts) {
    const span = document.createElement('span');
    span.className = 'alg-setup';
    if (opts.showCancel && cancellations > 0) {
        span.innerHTML = setup.map((m, idx) =>
            idx === setup.length - 1 ? colorMoveSpan(m, 'cancel-mark') : colorMoveSpan(m)
        ).join(' ');
    } else {
        span.innerHTML = colorMovesHtml(setup);
    }
    return span;
}

function renderNode(node, isRootLevel, depth, maxDepth) {
    const wrapper = document.createElement('div');
    const isOrphan = isRootLevel && node.children.length === 0;
    wrapper.className = 'tree-node' + (isRootLevel ? ' root-level' : '') + (isOrphan ? ' orphan' : '');

    const header = document.createElement('div');
    header.className = 'node-header';

    // Toggle button
    if (node.children.length > 0) {
        const toggle = document.createElement('span');
        toggle.className = 'toggle-btn';
        toggle.textContent = '\u25BC';
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const childContainer = wrapper.querySelector(':scope > .node-children');
            if (childContainer) {
                const collapsed = childContainer.classList.toggle('collapsed');
                toggle.textContent = collapsed ? '\u25B6' : '\u25BC';
            }
        });
        header.appendChild(toggle);
    } else {
        const spacer = document.createElement('span');
        spacer.className = 'toggle-spacer';
        header.appendChild(spacer);
    }

    const opts = getOptions();

    // Algorithm name (or extra base label)
    if (node.isExtra) {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'alg-name';
        nameSpan.style.opacity = '0.6';
        nameSpan.textContent = '(extra)';
        header.appendChild(nameSpan);
    } else if (node.alg.name) {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'alg-name';
        nameSpan.textContent = node.alg.name;
        header.appendChild(nameSpan);
    }

    // Content depends on whether this node has a parent factorization
    if (node.setup !== null && node.parent && node.parent.alg.moves.length > 0 && opts.showSetup) {
        // Setup moves
        if (node.setup.length > 0) {
            header.appendChild(renderSetupSpan(node.setup, node.cancellations, opts));
        }

        const arrow1 = document.createElement('span');
        arrow1.className = 'setup-arrow';
        arrow1.textContent = node.setup.length > 0 ? ' \u2192 ' : '';
        header.appendChild(arrow1);

        const parentRef = document.createElement('span');
        parentRef.className = 'alg-parent-ref';
        parentRef.textContent = node.parent.alg.name || algToString(node.parent.alg.moves);
        header.appendChild(parentRef);

        // Show inverse setup (undo) for conjugate
        if (node.isConjugate && node.setup.length > 0) {
            const arrow2 = document.createElement('span');
            arrow2.className = 'setup-arrow';
            arrow2.textContent = ' \u2192 ';
            header.appendChild(arrow2);

            const undoSpan = document.createElement('span');
            undoSpan.className = 'alg-setup';
            const invSetup = invertMoves(node.setup);
            if (opts.showCancel && node.cancellations > 0) {
                undoSpan.innerHTML = invSetup.map((m, idx) =>
                    idx === 0 ? colorMoveSpan(m, 'cancel-mark') : colorMoveSpan(m)
                ).join(' ');
            } else {
                undoSpan.innerHTML = colorMovesHtml(invSetup);
            }
            header.appendChild(undoSpan);
        }

        const full = document.createElement('span');
        full.className = 'alg-full';
        full.textContent = ' = ' + algToString(node.alg.moves);
        header.appendChild(full);
    } else {
        const movesSpan = document.createElement('span');
        movesSpan.className = 'alg-moves';
        movesSpan.innerHTML = colorMovesHtml(node.alg.moves);
        header.appendChild(movesSpan);
    }

    // Tooltip
    const algTooltip = document.createElement('div');
    algTooltip.className = 'alg-tooltip';
    const tipRows = [];
    tipRows.push(algTooltipRow('Algorithm', algToString(node.alg.moves)));
    tipRows.push(algTooltipRow('Moves', String(node.alg.moves.length)));
    if (node.setup !== null && node.parent && node.parent.alg.moves.length > 0) {
        tipRows.push(algTooltipRow('Type', node.isConjugate ? 'Conjugate [S: A]' : 'Prefix (S\u00B7A)'));
        tipRows.push(algTooltipRow('Setup', node.setup.length > 0 ? algToString(node.setup) : '(none)'));
        if (node.isConjugate && node.setup.length > 0) {
            tipRows.push(algTooltipRow('Undo', algToString(invertMoves(node.setup))));
        }
        tipRows.push(algTooltipRow('Base case', node.parent.alg.name || algToString(node.parent.alg.moves)));
        if (node.cancellations > 0) {
            tipRows.push(algTooltipRow('Cancellations', String(node.cancellations)));
        }
    }
    if (node.children.length > 0) {
        const total = countDescendants(node);
        if (total !== node.children.length) {
            tipRows.push(algTooltipRow('Direct children', String(node.children.length)));
            tipRows.push(algTooltipRow('Total descendants', String(total)));
        } else {
            tipRows.push(algTooltipRow('Children', String(node.children.length)));
        }
    }
    algTooltip.innerHTML = tipRows.join('');
    const invAlgStr = algToString(invertMoves(node.alg.moves)).replace(/ /g, '');
    const cubeImg = document.createElement('img');
    cubeImg.src = `https://visualcube.api.cubing.net/?fmt=svg&size=500&bg=t&stage=vh&alg=${encodeURIComponent(invAlgStr)}`;
    cubeImg.style.cssText = 'display:block;margin:8px auto 4px;width:200px;height:200px;';
    cubeImg.alt = 'Cube state';
    algTooltip.appendChild(cubeImg);
    const copyBtn = document.createElement('button');
    copyBtn.className = 'alg-tooltip-copy';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = tipRows.map(r => r.replace(/<[^>]*>/g, '').replace(/&rarr;/g, '\u2192')).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => copyBtn.textContent = 'Copy', 1500);
        });
    });
    algTooltip.appendChild(copyBtn);
    header.appendChild(algTooltip);

    // Child count badge
    if (node.children.length > 0) {
        const total = countDescendants(node);
        const countSpan = document.createElement('span');
        countSpan.className = 'child-count';
        countSpan.textContent = `(${total})`;
        header.appendChild(countSpan);
    }

    // "Copy all" button for root-level base cases
    if (isRootLevel && node.children.length > 0) {
        const copyAllBtn = document.createElement('button');
        copyAllBtn.className = 'alg-tooltip-copy';
        copyAllBtn.textContent = 'Copy all';
        copyAllBtn.style.marginLeft = '6px';
        copyAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const lines = [algToString(node.alg.moves)];
            function collectChildren(n) {
                for (const child of n.children) {
                    lines.push(algToString(child.alg.moves));
                    collectChildren(child);
                }
            }
            collectChildren(node);
            navigator.clipboard.writeText(lines.join('\n')).then(() => {
                copyAllBtn.textContent = 'Copied!';
                setTimeout(() => copyAllBtn.textContent = 'Copy all', 1500);
            });
        });
        header.appendChild(copyAllBtn);
    }

    header.addEventListener('click', (e) => {
        if (e.target.closest('.toggle-btn') || e.target.closest('.alg-tooltip-copy') || e.target.closest('button')) return;
        if (e.shiftKey) {
            // Shift+click: open this algTooltip, close others
            document.querySelectorAll('.alg-tooltip-open').forEach(t => {
                if (t !== algTooltip) t.classList.remove('alg-tooltip-open');
            });
            algTooltip.classList.toggle('alg-tooltip-open');
        } else {
            // Normal click: close all algTooltips
            document.querySelectorAll('.alg-tooltip-open').forEach(t => {
                t.classList.remove('alg-tooltip-open');
            });
        }
    });

    wrapper.appendChild(header);

    // Children (respect max depth: 0 = unlimited)
    if (node.children.length > 0 && (maxDepth === 0 || depth < maxDepth)) {
        const childContainer = document.createElement('div');
        childContainer.className = 'node-children';
        for (const child of node.children) {
            childContainer.appendChild(renderNode(child, false, depth + 1, maxDepth));
        }
        wrapper.appendChild(childContainer);
    }

    return wrapper;
}

function algTooltipRow(label, value) {
    return `<div class="alg-tooltip-row"><span class="alg-tooltip-label">${label}:</span> <span class="alg-tooltip-value">${value}</span></div>`;
}

// ============================================================
// SECTION 7: UI EVENT HANDLERS
// ============================================================

let currentRoot = null;

function handleBuild() {
    const input = $('alg-input').value;
    const lines = input.split('\n');
    const algorithms = [];
    const seen = new Map();

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let name = null;
        let algStr = trimmed;

        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0) {
            const potentialName = trimmed.substring(0, colonIdx).trim();
            const potentialAlg = trimmed.substring(colonIdx + 1).trim();
            if (potentialName.length > 2 || potentialName.includes(' ')) {
                name = potentialName;
                algStr = potentialAlg;
            }
        }

        let moves = simplify(parse(algStr));
        // Strip AUF
        const stripAuf = $('opt-strip-auf').value;
        if ((stripAuf === 'leading' || stripAuf === 'both') && moves.length > 0 && moves[0].face === 'U') {
            moves = moves.slice(1);
        }
        if ((stripAuf === 'trailing' || stripAuf === 'both') && moves.length > 0 && moves[moves.length - 1].face === 'U') {
            moves = moves.slice(0, -1);
        }
        if (moves.length === 0) continue;

        const key = algToString(moves);
        if (seen.has(key)) {
            if (name && !seen.get(key).name) {
                seen.get(key).name = name;
            }
            continue;
        }

        const alg = { original: algStr, moves, name };
        seen.set(key, alg);
        algorithms.push(alg);
    }

    if (algorithms.length === 0) {
        $('tree-display').innerHTML = '<div class="text-body-secondary fst-italic text-center p-5">No valid algorithms found. Enter algorithms one per line.</div>';
        $('stats').textContent = '';
        currentRoot = null;
        return;
    }

    // Parse extra base algorithms
    const extraBases = [];
    const extraInput = $('extra-bases') ? $('extra-bases').value : '';
    for (const line of extraInput.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let moves = simplify(parse(trimmed));
        if (moves.length === 0) continue;
        const key = algToString(moves);
        if (seen.has(key)) continue;
        const alg = { original: trimmed, moves, name: null, isExtra: true };
        seen.set(key, alg);
        extraBases.push(alg);
    }

    currentRoot = buildTree(algorithms, extraBases);
    renderTree(currentRoot, $('tree-display'));

    const totalNodes = algorithms.length;
    const extraWithChildren = currentRoot.children.filter(c => c.isExtra).length;
    const mainRoots = currentRoot.children.filter(c => !c.isExtra);
    const baseCases = mainRoots.filter(c => c.children.length > 0).length;
    const isolateNodes = mainRoots.filter(c => c.children.length === 0);
    const isolates = isolateNodes.length;
    const factored = totalNodes - mainRoots.length;
    let statsText = `${totalNodes} algorithms \u2022 ${baseCases} base cases \u2022 ${factored} factored \u2022 ${isolates} isolates`;
    if (extraWithChildren > 0) statsText += ` \u2022 ${extraWithChildren} extra bases`;
    $('stats').textContent = statsText;

    // Suggest virtual bases that would group isolates
    suggestBases(isolateNodes);
}

function suggestBases(isolateNodes) {
    const isolates = isolateNodes.map(n => n.alg.moves);
    const baseCandidates = new Map(); // baseKey -> { moves, children: Set<algKey> }
    const faces = ['R','L','U','D','F','B','M','E','S'];

    // Build set of already-added extra bases to avoid re-suggesting
    const extraSet = new Set();
    const extraInput = $('extra-bases') ? $('extra-bases').value : '';
    for (const line of extraInput.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const moves = simplify(parse(trimmed));
        if (moves.length > 0) extraSet.add(algToString(moves));
    }

    for (const iso of isolates) {
        // Try stripping single-move conjugates to find a virtual base
        for (const f of faces) {
            for (const a of [1, 2, 3]) {
                const S = [{ face: f, amount: a }];
                const base = simplify([...invertMoves(S), ...iso, ...S]);
                const baseKey = algToString(base);
                if (extraSet.has(baseKey)) continue;
                if (!baseCandidates.has(baseKey)) {
                    baseCandidates.set(baseKey, { moves: base, children: new Set() });
                }
                baseCandidates.get(baseKey).children.add(algToString(iso));
            }
        }
    }

    // Also check: isolates that ARE the base (other isolates are their conjugates)
    for (const iso of isolates) {
        const isoKey = algToString(iso);
        if (extraSet.has(isoKey)) continue; // already added as extra base
        for (const f of faces) {
            for (const a of [1, 2, 3]) {
                const S = [{ face: f, amount: a }];
                const child = simplify([...S, ...iso, ...invertMoves(S)]);
                for (const other of isolates) {
                    if (movesEqual(child, other)) {
                        if (!baseCandidates.has(isoKey)) {
                            baseCandidates.set(isoKey, { moves: iso, children: new Set() });
                        }
                        baseCandidates.get(isoKey).children.add(algToString(child));
                        baseCandidates.get(isoKey).children.add(isoKey);
                    }
                }
            }
        }
    }

    // Filter: only bases that would group 2+ isolates, sorted by group size desc then length desc
    const suggestions = [...baseCandidates.entries()]
        .filter(([k, v]) => v.children.size >= 2)
        .sort((a, b) => {
            const sizeDiff = b[1].children.size - a[1].children.size;
            if (sizeDiff !== 0) return sizeDiff;
            return b[1].moves.length - a[1].moves.length;
        });

    // Remove duplicates: if two bases have the exact same children set, keep the shorter one
    const uniqueSuggestions = [];
    const seenChildSets = new Set();
    for (const [key, val] of suggestions) {
        const childSetKey = [...val.children].sort().join('|');
        if (seenChildSets.has(childSetKey)) continue;
        seenChildSets.add(childSetKey);
        uniqueSuggestions.push({ key, moves: val.moves, count: val.children.size });
    }

    // Store suggestions for the modal
    currentSuggestions = uniqueSuggestions;

    // Show a button to open the modal if there are suggestions
    let suggestEl = document.getElementById('base-suggestions');
    if (!suggestEl) {
        suggestEl = document.createElement('div');
        suggestEl.id = 'base-suggestions';
        const statsEl = $('stats');
        statsEl.parentNode.insertBefore(suggestEl, statsEl.nextSibling);
    }

    if (uniqueSuggestions.length === 0) {
        suggestEl.innerHTML = '';
        return;
    }

    suggestEl.innerHTML = `<button class="btn btn-sm btn-outline-danger mt-2" id="open-suggestions">${uniqueSuggestions.length} suggested extra bases</button>`;
    document.getElementById('open-suggestions').addEventListener('click', openSuggestionsModal);
}

let currentSuggestions = [];

function openSuggestionsModal() {
    const modalEl = document.getElementById('suggestions-modal');
    const modalBody = document.getElementById('suggestions-modal-body');

    let rows = '';
    for (const s of currentSuggestions) {
        const alg = algToString(s.moves);
        rows += `<div class="suggestion-row">`;
        rows += `<button class="suggestion-add" data-alg="${alg}">+</button>`;
        rows += `<span class="suggestion-alg">${alg}</span>`;
        rows += `<span class="suggestion-count">${s.count} isolates</span>`;
        rows += `</div>`;
    }
    modalBody.innerHTML = rows;

    // Wire up add buttons
    let pendingAdds = [];
    modalBody.querySelectorAll('.suggestion-add').forEach(btn => {
        btn.addEventListener('click', () => {
            const alg = btn.dataset.alg;
            const extraEl = $('extra-bases');
            const existing = extraEl.value.trim().split('\n').map(l => l.trim()).filter(l => l);
            if (existing.includes(alg) || pendingAdds.includes(alg)) return;
            pendingAdds.push(alg);
            btn.disabled = true;
            btn.textContent = '\u2713';
            btn.classList.add('added');
        });
    });

    // Rebuild when modal closes
    modalEl.addEventListener('hidden.bs.modal', function onHidden() {
        modalEl.removeEventListener('hidden.bs.modal', onHidden);
        if (pendingAdds.length > 0) {
            const extraEl = $('extra-bases');
            const current = extraEl.value.trim();
            const newVal = current ? current + '\n' + pendingAdds.join('\n') : pendingAdds.join('\n');
            extraEl.value = newVal;
            handleBuild();
        }
    });

    new bootstrap.Modal(modalEl).show();
}

function loadExample() {
    fetch('zbls_rewritten.txt')
        .then(r => r.text())
        .then(text => {
            $('alg-input').value = text.trim();
            localStorage.setItem('algtree-input', $('alg-input').value);
            handleBuild();
        })
        .catch(() => {
            $('alg-input').value = "Sexy Move: R U R' U'\nSledgehammer: R' F R F'\nSune: R U R' U R U2 R'\nOLL 44: F U R U' R' F'";
            handleBuild();
        });
}

function expandAll() {
    document.querySelectorAll('.node-children.collapsed').forEach(el => {
        el.classList.remove('collapsed');
    });
    document.querySelectorAll('.toggle-btn').forEach(el => {
        el.textContent = '\u25BC';
    });
}

function collapseAll() {
    document.querySelectorAll('.node-children').forEach(el => {
        el.classList.add('collapsed');
    });
    document.querySelectorAll('.toggle-btn').forEach(el => {
        el.textContent = '\u25B6';
    });
}

function toggleBaseCases() {
    document.querySelectorAll('.tree-node.root-level > .node-children').forEach(el => {
        const collapsed = el.classList.toggle('collapsed');
        const toggle = el.parentElement.querySelector(':scope > .node-header > .toggle-btn');
        if (toggle) toggle.textContent = collapsed ? '\u25B6' : '\u25BC';
    });
}

function exportTree() {
    if (!currentRoot || currentRoot.children.length === 0) return;

    const baseCases = currentRoot.children.filter(c => c.children.length > 0);
    const isolates = currentRoot.children.filter(c => c.children.length === 0);
    const sections = [];

    for (const node of baseCases) {
        const total = countDescendants(node);
        const nameStr = node.alg.name ? ` (${node.alg.name})` : '';
        const header = `--- ${algToString(node.alg.moves)}${nameStr} [${total} descendants] ---`;
        const lines = [header, algToString(node.alg.moves)];
        function collect(n) {
            for (const child of n.children) {
                lines.push(algToString(child.alg.moves));
                collect(child);
            }
        }
        collect(node);
        sections.push(lines.join('\n'));
    }

    if (isolates.length > 0) {
        const lines = ['--- Isolates ---'];
        for (const node of isolates) {
            lines.push(algToString(node.alg.moves));
        }
        sections.push(lines.join('\n'));
    }

    const text = sections.join('\n\n');
    const btn = $('export-btn');
    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Export', 1500);
    });
}

function popoutTree() {
    const treeHtml = $('tree-display').innerHTML;
    if (!treeHtml || !currentRoot) return;

    const w = window.open('', '_blank');
    if (!w) return;

    const theme = document.documentElement.getAttribute('data-bs-theme') || 'dark';
    w.document.write(`<!DOCTYPE html><html lang="en" data-bs-theme="${theme}"><head><meta charset="UTF-8">`);
    w.document.write('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    w.document.write('<title>Algorithm Tree</title>');
    w.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">');
    w.document.write('<link rel="stylesheet" href="style.css">');
    w.document.write('<style>body{overflow:auto;height:auto}#tree-display{padding:16px}</style>');
    w.document.write('</head><body>');
    w.document.write('<div id="tree-display">' + treeHtml + '</div>');
    w.document.write('</body></html>');
    w.document.close();

    // Attach event listeners in the new window
    w.document.querySelectorAll('.toggle-btn').forEach(function(toggle) {
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            var wrapper = toggle.closest('.tree-node');
            var cc = wrapper.querySelector(':scope > .node-children');
            if (cc) {
                var collapsed = cc.classList.toggle('collapsed');
                toggle.textContent = collapsed ? '\u25B6' : '\u25BC';
            }
        });
    });
    w.document.querySelectorAll('.node-header').forEach(function(header) {
        header.addEventListener('click', function(e) {
            if (e.target.closest('.toggle-btn') || e.target.closest('.alg-tooltip-copy') || e.target.closest('button')) return;
            var tip = header.querySelector('.alg-tooltip');
            if (e.shiftKey && tip) {
                w.document.querySelectorAll('.alg-tooltip-open').forEach(function(t) {
                    if (t !== tip) t.classList.remove('alg-tooltip-open');
                });
                tip.classList.toggle('alg-tooltip-open');
            } else {
                w.document.querySelectorAll('.alg-tooltip-open').forEach(function(t) {
                    t.classList.remove('alg-tooltip-open');
                });
            }
        });
    });
}

function handleOptionChange() {
    if (currentRoot) {
        renderTree(currentRoot, $('tree-display'));
    }
}

// ============================================================
// SECTION 8: INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    $('build-btn').addEventListener('click', handleBuild);
    $('example-btn').addEventListener('click', loadExample);
    $('expand-all').addEventListener('click', expandAll);
    $('collapse-all').addEventListener('click', collapseAll);
    $('toggle-bases').addEventListener('click', toggleBaseCases);
    $('export-btn').addEventListener('click', exportTree);
    $('popout-btn').addEventListener('click', popoutTree);

    const SETTINGS_KEY = 'algtree-settings';
    function saveSettings() {
        const settings = {
            setup: $('opt-setup').checked,
            color: $('opt-color').checked,
            cancel: $('opt-cancel').checked,
            maxCancel: $('opt-max-cancel').value,
            childSort: $('opt-child-sort').value,
            setupMode: $('opt-setup-mode').value,
            maxDepth: $('opt-max-depth').value,
            stripAuf: $('opt-strip-auf').value,
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    $('opt-setup').addEventListener('change', () => { saveSettings(); handleOptionChange(); });
    $('opt-color').addEventListener('change', () => { saveSettings(); handleOptionChange(); });
    $('opt-cancel').addEventListener('change', () => { saveSettings(); handleOptionChange(); });
    $('opt-max-cancel').addEventListener('change', () => { saveSettings(); handleBuild(); });
    $('opt-child-sort').addEventListener('change', () => { saveSettings(); handleBuild(); });
    $('opt-setup-mode').addEventListener('change', () => { saveSettings(); handleBuild(); });
    $('opt-max-depth').addEventListener('change', () => { saveSettings(); handleOptionChange(); });
    $('opt-strip-auf').addEventListener('change', () => { saveSettings(); handleBuild(); });

    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
        try {
            const s = JSON.parse(savedSettings);
            if (s.setup !== undefined) $('opt-setup').checked = s.setup;
            if (s.color !== undefined) $('opt-color').checked = s.color;
            if (s.cancel !== undefined) $('opt-cancel').checked = s.cancel;
            if (s.maxCancel !== undefined) $('opt-max-cancel').value = s.maxCancel;
            if (s.childSort !== undefined) $('opt-child-sort').value = s.childSort;
            if (s.setupMode !== undefined) $('opt-setup-mode').value = s.setupMode;
                if (s.maxDepth !== undefined) $('opt-max-depth').value = s.maxDepth;
                if (s.stripAuf !== undefined) $('opt-strip-auf').value = s.stripAuf;
        } catch (e) {}
    }

    const saved = localStorage.getItem('algtree-input');
    if (saved) {
        $('alg-input').value = saved;
        handleBuild();
    }

    const savedBases = localStorage.getItem('algtree-extra-bases');
    if (savedBases) {
        $('extra-bases').value = savedBases;
    }

    $('alg-input').addEventListener('input', () => {
        localStorage.setItem('algtree-input', $('alg-input').value);
    });

    $('extra-bases').addEventListener('input', () => {
        localStorage.setItem('algtree-extra-bases', $('extra-bases').value);
    });

    $('alg-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleBuild();
        }
    });

    // Theme toggle
    const THEME_KEY = 'algtree-theme';
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    updateThemeIcons(savedTheme);

    function updateThemeIcons(theme) {
        document.querySelectorAll('.theme-icon').forEach(icon => {
            icon.className = theme === 'dark' ? 'bi bi-moon-fill theme-icon' : 'bi bi-sun-fill theme-icon';
        });
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-bs-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-bs-theme', next);
        localStorage.setItem(THEME_KEY, next);
        updateThemeIcons(next);
    }

    $('theme-toggle').addEventListener('click', toggleTheme);
    $('theme-toggle-mobile').addEventListener('click', toggleTheme);
});
