/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * True if the custom elements polyfill is in use.
 */
const isCEPolyfill = typeof window !== 'undefined' &&
    window.customElements != null &&
    window.customElements.polyfillWrapFlushCallback !==
        undefined;
/**
 * Removes nodes, starting from `start` (inclusive) to `end` (exclusive), from
 * `container`.
 */
const removeNodes = (container, start, end = null) => {
    while (start !== end) {
        const n = start.nextSibling;
        container.removeChild(start);
        start = n;
    }
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An expression marker with embedded unique key to avoid collision with
 * possible text in templates.
 */
const marker = `{{lit-${String(Math.random()).slice(2)}}}`;
/**
 * An expression marker used text-positions, multi-binding attributes, and
 * attributes with markup-like text values.
 */
const nodeMarker = `<!--${marker}-->`;
const markerRegex = new RegExp(`${marker}|${nodeMarker}`);
/**
 * Suffix appended to all bound attribute names.
 */
const boundAttributeSuffix = '$lit$';
/**
 * An updatable Template that tracks the location of dynamic parts.
 */
class Template {
    constructor(result, element) {
        this.parts = [];
        this.element = element;
        const nodesToRemove = [];
        const stack = [];
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(element.content, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        // Keeps track of the last index associated with a part. We try to delete
        // unnecessary nodes, but we never want to associate two different parts
        // to the same index. They must have a constant node between.
        let lastPartIndex = 0;
        let index = -1;
        let partIndex = 0;
        const { strings, values: { length } } = result;
        while (partIndex < length) {
            const node = walker.nextNode();
            if (node === null) {
                // We've exhausted the content inside a nested template element.
                // Because we still have parts (the outer for-loop), we know:
                // - There is a template in the stack
                // - The walker will find a nextNode outside the template
                walker.currentNode = stack.pop();
                continue;
            }
            index++;
            if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
                if (node.hasAttributes()) {
                    const attributes = node.attributes;
                    const { length } = attributes;
                    // Per
                    // https://developer.mozilla.org/en-US/docs/Web/API/NamedNodeMap,
                    // attributes are not guaranteed to be returned in document order.
                    // In particular, Edge/IE can return them out of order, so we cannot
                    // assume a correspondence between part index and attribute index.
                    let count = 0;
                    for (let i = 0; i < length; i++) {
                        if (endsWith(attributes[i].name, boundAttributeSuffix)) {
                            count++;
                        }
                    }
                    while (count-- > 0) {
                        // Get the template literal section leading up to the first
                        // expression in this attribute
                        const stringForPart = strings[partIndex];
                        // Find the attribute name
                        const name = lastAttributeNameRegex.exec(stringForPart)[2];
                        // Find the corresponding attribute
                        // All bound attributes have had a suffix added in
                        // TemplateResult#getHTML to opt out of special attribute
                        // handling. To look up the attribute value we also need to add
                        // the suffix.
                        const attributeLookupName = name.toLowerCase() + boundAttributeSuffix;
                        const attributeValue = node.getAttribute(attributeLookupName);
                        node.removeAttribute(attributeLookupName);
                        const statics = attributeValue.split(markerRegex);
                        this.parts.push({ type: 'attribute', index, name, strings: statics });
                        partIndex += statics.length - 1;
                    }
                }
                if (node.tagName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
            }
            else if (node.nodeType === 3 /* Node.TEXT_NODE */) {
                const data = node.data;
                if (data.indexOf(marker) >= 0) {
                    const parent = node.parentNode;
                    const strings = data.split(markerRegex);
                    const lastIndex = strings.length - 1;
                    // Generate a new text node for each literal section
                    // These nodes are also used as the markers for node parts
                    for (let i = 0; i < lastIndex; i++) {
                        let insert;
                        let s = strings[i];
                        if (s === '') {
                            insert = createMarker();
                        }
                        else {
                            const match = lastAttributeNameRegex.exec(s);
                            if (match !== null && endsWith(match[2], boundAttributeSuffix)) {
                                s = s.slice(0, match.index) + match[1] +
                                    match[2].slice(0, -boundAttributeSuffix.length) + match[3];
                            }
                            insert = document.createTextNode(s);
                        }
                        parent.insertBefore(insert, node);
                        this.parts.push({ type: 'node', index: ++index });
                    }
                    // If there's no text, we must insert a comment to mark our place.
                    // Else, we can trust it will stick around after cloning.
                    if (strings[lastIndex] === '') {
                        parent.insertBefore(createMarker(), node);
                        nodesToRemove.push(node);
                    }
                    else {
                        node.data = strings[lastIndex];
                    }
                    // We have a part for each match found
                    partIndex += lastIndex;
                }
            }
            else if (node.nodeType === 8 /* Node.COMMENT_NODE */) {
                if (node.data === marker) {
                    const parent = node.parentNode;
                    // Add a new marker node to be the startNode of the Part if any of
                    // the following are true:
                    //  * We don't have a previousSibling
                    //  * The previousSibling is already the start of a previous part
                    if (node.previousSibling === null || index === lastPartIndex) {
                        index++;
                        parent.insertBefore(createMarker(), node);
                    }
                    lastPartIndex = index;
                    this.parts.push({ type: 'node', index });
                    // If we don't have a nextSibling, keep this node so we have an end.
                    // Else, we can remove it to save future costs.
                    if (node.nextSibling === null) {
                        node.data = '';
                    }
                    else {
                        nodesToRemove.push(node);
                        index--;
                    }
                    partIndex++;
                }
                else {
                    let i = -1;
                    while ((i = node.data.indexOf(marker, i + 1)) !== -1) {
                        // Comment node has a binding marker inside, make an inactive part
                        // The binding won't work, but subsequent bindings will
                        // TODO (justinfagnani): consider whether it's even worth it to
                        // make bindings in comments work
                        this.parts.push({ type: 'node', index: -1 });
                        partIndex++;
                    }
                }
            }
        }
        // Remove text binding nodes after the walk to not disturb the TreeWalker
        for (const n of nodesToRemove) {
            n.parentNode.removeChild(n);
        }
    }
}
const endsWith = (str, suffix) => {
    const index = str.length - suffix.length;
    return index >= 0 && str.slice(index) === suffix;
};
const isTemplatePartActive = (part) => part.index !== -1;
// Allows `document.createComment('')` to be renamed for a
// small manual size-savings.
const createMarker = () => document.createComment('');
/**
 * This regex extracts the attribute name preceding an attribute-position
 * expression. It does this by matching the syntax allowed for attributes
 * against the string literal directly preceding the expression, assuming that
 * the expression is in an attribute-value position.
 *
 * See attributes in the HTML spec:
 * https://www.w3.org/TR/html5/syntax.html#elements-attributes
 *
 * " \x09\x0a\x0c\x0d" are HTML space characters:
 * https://www.w3.org/TR/html5/infrastructure.html#space-characters
 *
 * "\0-\x1F\x7F-\x9F" are Unicode control characters, which includes every
 * space character except " ".
 *
 * So an attribute is:
 *  * The name: any character except a control character, space character, ('),
 *    ("), ">", "=", or "/"
 *  * Followed by zero or more space characters
 *  * Followed by "="
 *  * Followed by zero or more space characters
 *  * Followed by:
 *    * Any character except space, ('), ("), "<", ">", "=", (`), or
 *    * (") then any non-("), or
 *    * (') then any non-(')
 */
const lastAttributeNameRegex = 
// eslint-disable-next-line no-control-regex
/([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const walkerNodeFilter = 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */;
/**
 * Removes the list of nodes from a Template safely. In addition to removing
 * nodes from the Template, the Template part indices are updated to match
 * the mutated Template DOM.
 *
 * As the template is walked the removal state is tracked and
 * part indices are adjusted as needed.
 *
 * div
 *   div#1 (remove) <-- start removing (removing node is div#1)
 *     div
 *       div#2 (remove)  <-- continue removing (removing node is still div#1)
 *         div
 * div <-- stop removing since previous sibling is the removing node (div#1,
 * removed 4 nodes)
 */
function removeNodesFromTemplate(template, nodesToRemove) {
    const { element: { content }, parts } = template;
    const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
    let partIndex = nextActiveIndexInTemplateParts(parts);
    let part = parts[partIndex];
    let nodeIndex = -1;
    let removeCount = 0;
    const nodesToRemoveInTemplate = [];
    let currentRemovingNode = null;
    while (walker.nextNode()) {
        nodeIndex++;
        const node = walker.currentNode;
        // End removal if stepped past the removing node
        if (node.previousSibling === currentRemovingNode) {
            currentRemovingNode = null;
        }
        // A node to remove was found in the template
        if (nodesToRemove.has(node)) {
            nodesToRemoveInTemplate.push(node);
            // Track node we're removing
            if (currentRemovingNode === null) {
                currentRemovingNode = node;
            }
        }
        // When removing, increment count by which to adjust subsequent part indices
        if (currentRemovingNode !== null) {
            removeCount++;
        }
        while (part !== undefined && part.index === nodeIndex) {
            // If part is in a removed node deactivate it by setting index to -1 or
            // adjust the index as needed.
            part.index = currentRemovingNode !== null ? -1 : part.index - removeCount;
            // go to the next active part.
            partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
            part = parts[partIndex];
        }
    }
    nodesToRemoveInTemplate.forEach((n) => n.parentNode.removeChild(n));
}
const countNodes = (node) => {
    let count = (node.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */) ? 0 : 1;
    const walker = document.createTreeWalker(node, walkerNodeFilter, null, false);
    while (walker.nextNode()) {
        count++;
    }
    return count;
};
const nextActiveIndexInTemplateParts = (parts, startIndex = -1) => {
    for (let i = startIndex + 1; i < parts.length; i++) {
        const part = parts[i];
        if (isTemplatePartActive(part)) {
            return i;
        }
    }
    return -1;
};
/**
 * Inserts the given node into the Template, optionally before the given
 * refNode. In addition to inserting the node into the Template, the Template
 * part indices are updated to match the mutated Template DOM.
 */
function insertNodeIntoTemplate(template, node, refNode = null) {
    const { element: { content }, parts } = template;
    // If there's no refNode, then put node at end of template.
    // No part indices need to be shifted in this case.
    if (refNode === null || refNode === undefined) {
        content.appendChild(node);
        return;
    }
    const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
    let partIndex = nextActiveIndexInTemplateParts(parts);
    let insertCount = 0;
    let walkerIndex = -1;
    while (walker.nextNode()) {
        walkerIndex++;
        const walkerNode = walker.currentNode;
        if (walkerNode === refNode) {
            insertCount = countNodes(node);
            refNode.parentNode.insertBefore(node, refNode);
        }
        while (partIndex !== -1 && parts[partIndex].index === walkerIndex) {
            // If we've inserted the node, simply adjust all subsequent parts
            if (insertCount > 0) {
                while (partIndex !== -1) {
                    parts[partIndex].index += insertCount;
                    partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
                }
                return;
            }
            partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
        }
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const directives = new WeakMap();
const isDirective = (o) => {
    return typeof o === 'function' && directives.has(o);
};

/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * A sentinel value that signals that a value was handled by a directive and
 * should not be written to the DOM.
 */
const noChange = {};
/**
 * A sentinel value that signals a NodePart to fully clear its content.
 */
const nothing = {};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An instance of a `Template` that can be attached to the DOM and updated
 * with new values.
 */
class TemplateInstance {
    constructor(template, processor, options) {
        this.__parts = [];
        this.template = template;
        this.processor = processor;
        this.options = options;
    }
    update(values) {
        let i = 0;
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.setValue(values[i]);
            }
            i++;
        }
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.commit();
            }
        }
    }
    _clone() {
        // There are a number of steps in the lifecycle of a template instance's
        // DOM fragment:
        //  1. Clone - create the instance fragment
        //  2. Adopt - adopt into the main document
        //  3. Process - find part markers and create parts
        //  4. Upgrade - upgrade custom elements
        //  5. Update - set node, attribute, property, etc., values
        //  6. Connect - connect to the document. Optional and outside of this
        //     method.
        //
        // We have a few constraints on the ordering of these steps:
        //  * We need to upgrade before updating, so that property values will pass
        //    through any property setters.
        //  * We would like to process before upgrading so that we're sure that the
        //    cloned fragment is inert and not disturbed by self-modifying DOM.
        //  * We want custom elements to upgrade even in disconnected fragments.
        //
        // Given these constraints, with full custom elements support we would
        // prefer the order: Clone, Process, Adopt, Upgrade, Update, Connect
        //
        // But Safari does not implement CustomElementRegistry#upgrade, so we
        // can not implement that order and still have upgrade-before-update and
        // upgrade disconnected fragments. So we instead sacrifice the
        // process-before-upgrade constraint, since in Custom Elements v1 elements
        // must not modify their light DOM in the constructor. We still have issues
        // when co-existing with CEv0 elements like Polymer 1, and with polyfills
        // that don't strictly adhere to the no-modification rule because shadow
        // DOM, which may be created in the constructor, is emulated by being placed
        // in the light DOM.
        //
        // The resulting order is on native is: Clone, Adopt, Upgrade, Process,
        // Update, Connect. document.importNode() performs Clone, Adopt, and Upgrade
        // in one step.
        //
        // The Custom Elements v1 polyfill supports upgrade(), so the order when
        // polyfilled is the more ideal: Clone, Process, Adopt, Upgrade, Update,
        // Connect.
        const fragment = isCEPolyfill ?
            this.template.element.content.cloneNode(true) :
            document.importNode(this.template.element.content, true);
        const stack = [];
        const parts = this.template.parts;
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(fragment, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        let partIndex = 0;
        let nodeIndex = 0;
        let part;
        let node = walker.nextNode();
        // Loop through all the nodes and parts of a template
        while (partIndex < parts.length) {
            part = parts[partIndex];
            if (!isTemplatePartActive(part)) {
                this.__parts.push(undefined);
                partIndex++;
                continue;
            }
            // Progress the tree walker until we find our next part's node.
            // Note that multiple parts may share the same node (attribute parts
            // on a single element), so this loop may not run at all.
            while (nodeIndex < part.index) {
                nodeIndex++;
                if (node.nodeName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
                if ((node = walker.nextNode()) === null) {
                    // We've exhausted the content inside a nested template element.
                    // Because we still have parts (the outer for-loop), we know:
                    // - There is a template in the stack
                    // - The walker will find a nextNode outside the template
                    walker.currentNode = stack.pop();
                    node = walker.nextNode();
                }
            }
            // We've arrived at our part's node.
            if (part.type === 'node') {
                const part = this.processor.handleTextExpression(this.options);
                part.insertAfterNode(node.previousSibling);
                this.__parts.push(part);
            }
            else {
                this.__parts.push(...this.processor.handleAttributeExpressions(node, part.name, part.strings, this.options));
            }
            partIndex++;
        }
        if (isCEPolyfill) {
            document.adoptNode(fragment);
            customElements.upgrade(fragment);
        }
        return fragment;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Our TrustedTypePolicy for HTML which is declared using the html template
 * tag function.
 *
 * That HTML is a developer-authored constant, and is parsed with innerHTML
 * before any untrusted expressions have been mixed in. Therefor it is
 * considered safe by construction.
 */
const policy = window.trustedTypes &&
    trustedTypes.createPolicy('lit-html', { createHTML: (s) => s });
const commentMarker = ` ${marker} `;
/**
 * The return type of `html`, which holds a Template and the values from
 * interpolated expressions.
 */
class TemplateResult {
    constructor(strings, values, type, processor) {
        this.strings = strings;
        this.values = values;
        this.type = type;
        this.processor = processor;
    }
    /**
     * Returns a string of HTML used to create a `<template>` element.
     */
    getHTML() {
        const l = this.strings.length - 1;
        let html = '';
        let isCommentBinding = false;
        for (let i = 0; i < l; i++) {
            const s = this.strings[i];
            // For each binding we want to determine the kind of marker to insert
            // into the template source before it's parsed by the browser's HTML
            // parser. The marker type is based on whether the expression is in an
            // attribute, text, or comment position.
            //   * For node-position bindings we insert a comment with the marker
            //     sentinel as its text content, like <!--{{lit-guid}}-->.
            //   * For attribute bindings we insert just the marker sentinel for the
            //     first binding, so that we support unquoted attribute bindings.
            //     Subsequent bindings can use a comment marker because multi-binding
            //     attributes must be quoted.
            //   * For comment bindings we insert just the marker sentinel so we don't
            //     close the comment.
            //
            // The following code scans the template source, but is *not* an HTML
            // parser. We don't need to track the tree structure of the HTML, only
            // whether a binding is inside a comment, and if not, if it appears to be
            // the first binding in an attribute.
            const commentOpen = s.lastIndexOf('<!--');
            // We're in comment position if we have a comment open with no following
            // comment close. Because <-- can appear in an attribute value there can
            // be false positives.
            isCommentBinding = (commentOpen > -1 || isCommentBinding) &&
                s.indexOf('-->', commentOpen + 1) === -1;
            // Check to see if we have an attribute-like sequence preceding the
            // expression. This can match "name=value" like structures in text,
            // comments, and attribute values, so there can be false-positives.
            const attributeMatch = lastAttributeNameRegex.exec(s);
            if (attributeMatch === null) {
                // We're only in this branch if we don't have a attribute-like
                // preceding sequence. For comments, this guards against unusual
                // attribute values like <div foo="<!--${'bar'}">. Cases like
                // <!-- foo=${'bar'}--> are handled correctly in the attribute branch
                // below.
                html += s + (isCommentBinding ? commentMarker : nodeMarker);
            }
            else {
                // For attributes we use just a marker sentinel, and also append a
                // $lit$ suffix to the name to opt-out of attribute-specific parsing
                // that IE and Edge do for style and certain SVG attributes.
                html += s.substr(0, attributeMatch.index) + attributeMatch[1] +
                    attributeMatch[2] + boundAttributeSuffix + attributeMatch[3] +
                    marker;
            }
        }
        html += this.strings[l];
        return html;
    }
    getTemplateElement() {
        const template = document.createElement('template');
        let value = this.getHTML();
        if (policy !== undefined) {
            // this is secure because `this.strings` is a TemplateStringsArray.
            // TODO: validate this when
            // https://github.com/tc39/proposal-array-is-template-object is
            // implemented.
            value = policy.createHTML(value);
        }
        template.innerHTML = value;
        return template;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const isPrimitive = (value) => {
    return (value === null ||
        !(typeof value === 'object' || typeof value === 'function'));
};
const isIterable = (value) => {
    return Array.isArray(value) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        !!(value && value[Symbol.iterator]);
};
/**
 * Writes attribute values to the DOM for a group of AttributeParts bound to a
 * single attribute. The value is only set once even if there are multiple parts
 * for an attribute.
 */
class AttributeCommitter {
    constructor(element, name, strings) {
        this.dirty = true;
        this.element = element;
        this.name = name;
        this.strings = strings;
        this.parts = [];
        for (let i = 0; i < strings.length - 1; i++) {
            this.parts[i] = this._createPart();
        }
    }
    /**
     * Creates a single part. Override this to create a differnt type of part.
     */
    _createPart() {
        return new AttributePart(this);
    }
    _getValue() {
        const strings = this.strings;
        const l = strings.length - 1;
        const parts = this.parts;
        // If we're assigning an attribute via syntax like:
        //    attr="${foo}"  or  attr=${foo}
        // but not
        //    attr="${foo} ${bar}" or attr="${foo} baz"
        // then we don't want to coerce the attribute value into one long
        // string. Instead we want to just return the value itself directly,
        // so that sanitizeDOMValue can get the actual value rather than
        // String(value)
        // The exception is if v is an array, in which case we do want to smash
        // it together into a string without calling String() on the array.
        //
        // This also allows trusted values (when using TrustedTypes) being
        // assigned to DOM sinks without being stringified in the process.
        if (l === 1 && strings[0] === '' && strings[1] === '') {
            const v = parts[0].value;
            if (typeof v === 'symbol') {
                return String(v);
            }
            if (typeof v === 'string' || !isIterable(v)) {
                return v;
            }
        }
        let text = '';
        for (let i = 0; i < l; i++) {
            text += strings[i];
            const part = parts[i];
            if (part !== undefined) {
                const v = part.value;
                if (isPrimitive(v) || !isIterable(v)) {
                    text += typeof v === 'string' ? v : String(v);
                }
                else {
                    for (const t of v) {
                        text += typeof t === 'string' ? t : String(t);
                    }
                }
            }
        }
        text += strings[l];
        return text;
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            this.element.setAttribute(this.name, this._getValue());
        }
    }
}
/**
 * A Part that controls all or part of an attribute value.
 */
class AttributePart {
    constructor(committer) {
        this.value = undefined;
        this.committer = committer;
    }
    setValue(value) {
        if (value !== noChange && (!isPrimitive(value) || value !== this.value)) {
            this.value = value;
            // If the value is a not a directive, dirty the committer so that it'll
            // call setAttribute. If the value is a directive, it'll dirty the
            // committer if it calls setValue().
            if (!isDirective(value)) {
                this.committer.dirty = true;
            }
        }
    }
    commit() {
        while (isDirective(this.value)) {
            const directive = this.value;
            this.value = noChange;
            directive(this);
        }
        if (this.value === noChange) {
            return;
        }
        this.committer.commit();
    }
}
/**
 * A Part that controls a location within a Node tree. Like a Range, NodePart
 * has start and end locations and can set and update the Nodes between those
 * locations.
 *
 * NodeParts support several value types: primitives, Nodes, TemplateResults,
 * as well as arrays and iterables of those types.
 */
class NodePart {
    constructor(options) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.options = options;
    }
    /**
     * Appends this part into a container.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendInto(container) {
        this.startNode = container.appendChild(createMarker());
        this.endNode = container.appendChild(createMarker());
    }
    /**
     * Inserts this part after the `ref` node (between `ref` and `ref`'s next
     * sibling). Both `ref` and its next sibling must be static, unchanging nodes
     * such as those that appear in a literal section of a template.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterNode(ref) {
        this.startNode = ref;
        this.endNode = ref.nextSibling;
    }
    /**
     * Appends this part into a parent part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendIntoPart(part) {
        part.__insert(this.startNode = createMarker());
        part.__insert(this.endNode = createMarker());
    }
    /**
     * Inserts this part after the `ref` part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterPart(ref) {
        ref.__insert(this.startNode = createMarker());
        this.endNode = ref.endNode;
        ref.endNode = this.startNode;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        if (this.startNode.parentNode === null) {
            return;
        }
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        const value = this.__pendingValue;
        if (value === noChange) {
            return;
        }
        if (isPrimitive(value)) {
            if (value !== this.value) {
                this.__commitText(value);
            }
        }
        else if (value instanceof TemplateResult) {
            this.__commitTemplateResult(value);
        }
        else if (value instanceof Node) {
            this.__commitNode(value);
        }
        else if (isIterable(value)) {
            this.__commitIterable(value);
        }
        else if (value === nothing) {
            this.value = nothing;
            this.clear();
        }
        else {
            // Fallback, will render the string representation
            this.__commitText(value);
        }
    }
    __insert(node) {
        this.endNode.parentNode.insertBefore(node, this.endNode);
    }
    __commitNode(value) {
        if (this.value === value) {
            return;
        }
        this.clear();
        this.__insert(value);
        this.value = value;
    }
    __commitText(value) {
        const node = this.startNode.nextSibling;
        value = value == null ? '' : value;
        // If `value` isn't already a string, we explicitly convert it here in case
        // it can't be implicitly converted - i.e. it's a symbol.
        const valueAsString = typeof value === 'string' ? value : String(value);
        if (node === this.endNode.previousSibling &&
            node.nodeType === 3 /* Node.TEXT_NODE */) {
            // If we only have a single text node between the markers, we can just
            // set its value, rather than replacing it.
            // TODO(justinfagnani): Can we just check if this.value is primitive?
            node.data = valueAsString;
        }
        else {
            this.__commitNode(document.createTextNode(valueAsString));
        }
        this.value = value;
    }
    __commitTemplateResult(value) {
        const template = this.options.templateFactory(value);
        if (this.value instanceof TemplateInstance &&
            this.value.template === template) {
            this.value.update(value.values);
        }
        else {
            // Make sure we propagate the template processor from the TemplateResult
            // so that we use its syntax extension, etc. The template factory comes
            // from the render function options so that it can control template
            // caching and preprocessing.
            const instance = new TemplateInstance(template, value.processor, this.options);
            const fragment = instance._clone();
            instance.update(value.values);
            this.__commitNode(fragment);
            this.value = instance;
        }
    }
    __commitIterable(value) {
        // For an Iterable, we create a new InstancePart per item, then set its
        // value to the item. This is a little bit of overhead for every item in
        // an Iterable, but it lets us recurse easily and efficiently update Arrays
        // of TemplateResults that will be commonly returned from expressions like:
        // array.map((i) => html`${i}`), by reusing existing TemplateInstances.
        // If _value is an array, then the previous render was of an
        // iterable and _value will contain the NodeParts from the previous
        // render. If _value is not an array, clear this part and make a new
        // array for NodeParts.
        if (!Array.isArray(this.value)) {
            this.value = [];
            this.clear();
        }
        // Lets us keep track of how many items we stamped so we can clear leftover
        // items from a previous render
        const itemParts = this.value;
        let partIndex = 0;
        let itemPart;
        for (const item of value) {
            // Try to reuse an existing part
            itemPart = itemParts[partIndex];
            // If no existing part, create a new one
            if (itemPart === undefined) {
                itemPart = new NodePart(this.options);
                itemParts.push(itemPart);
                if (partIndex === 0) {
                    itemPart.appendIntoPart(this);
                }
                else {
                    itemPart.insertAfterPart(itemParts[partIndex - 1]);
                }
            }
            itemPart.setValue(item);
            itemPart.commit();
            partIndex++;
        }
        if (partIndex < itemParts.length) {
            // Truncate the parts array so _value reflects the current state
            itemParts.length = partIndex;
            this.clear(itemPart && itemPart.endNode);
        }
    }
    clear(startNode = this.startNode) {
        removeNodes(this.startNode.parentNode, startNode.nextSibling, this.endNode);
    }
}
/**
 * Implements a boolean attribute, roughly as defined in the HTML
 * specification.
 *
 * If the value is truthy, then the attribute is present with a value of
 * ''. If the value is falsey, the attribute is removed.
 */
class BooleanAttributePart {
    constructor(element, name, strings) {
        this.value = undefined;
        this.__pendingValue = undefined;
        if (strings.length !== 2 || strings[0] !== '' || strings[1] !== '') {
            throw new Error('Boolean attributes can only contain a single expression');
        }
        this.element = element;
        this.name = name;
        this.strings = strings;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const value = !!this.__pendingValue;
        if (this.value !== value) {
            if (value) {
                this.element.setAttribute(this.name, '');
            }
            else {
                this.element.removeAttribute(this.name);
            }
            this.value = value;
        }
        this.__pendingValue = noChange;
    }
}
/**
 * Sets attribute values for PropertyParts, so that the value is only set once
 * even if there are multiple parts for a property.
 *
 * If an expression controls the whole property value, then the value is simply
 * assigned to the property under control. If there are string literals or
 * multiple expressions, then the strings are expressions are interpolated into
 * a string first.
 */
class PropertyCommitter extends AttributeCommitter {
    constructor(element, name, strings) {
        super(element, name, strings);
        this.single =
            (strings.length === 2 && strings[0] === '' && strings[1] === '');
    }
    _createPart() {
        return new PropertyPart(this);
    }
    _getValue() {
        if (this.single) {
            return this.parts[0].value;
        }
        return super._getValue();
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.element[this.name] = this._getValue();
        }
    }
}
class PropertyPart extends AttributePart {
}
// Detect event listener options support. If the `capture` property is read
// from the options object, then options are supported. If not, then the third
// argument to add/removeEventListener is interpreted as the boolean capture
// value so we should only pass the `capture` property.
let eventOptionsSupported = false;
// Wrap into an IIFE because MS Edge <= v41 does not support having try/catch
// blocks right into the body of a module
(() => {
    try {
        const options = {
            get capture() {
                eventOptionsSupported = true;
                return false;
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.addEventListener('test', options, options);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.removeEventListener('test', options, options);
    }
    catch (_e) {
        // event options not supported
    }
})();
class EventPart {
    constructor(element, eventName, eventContext) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.element = element;
        this.eventName = eventName;
        this.eventContext = eventContext;
        this.__boundHandleEvent = (e) => this.handleEvent(e);
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const newListener = this.__pendingValue;
        const oldListener = this.value;
        const shouldRemoveListener = newListener == null ||
            oldListener != null &&
                (newListener.capture !== oldListener.capture ||
                    newListener.once !== oldListener.once ||
                    newListener.passive !== oldListener.passive);
        const shouldAddListener = newListener != null && (oldListener == null || shouldRemoveListener);
        if (shouldRemoveListener) {
            this.element.removeEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        if (shouldAddListener) {
            this.__options = getOptions(newListener);
            this.element.addEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        this.value = newListener;
        this.__pendingValue = noChange;
    }
    handleEvent(event) {
        if (typeof this.value === 'function') {
            this.value.call(this.eventContext || this.element, event);
        }
        else {
            this.value.handleEvent(event);
        }
    }
}
// We copy options because of the inconsistent behavior of browsers when reading
// the third argument of add/removeEventListener. IE11 doesn't support options
// at all. Chrome 41 only reads `capture` if the argument is an object.
const getOptions = (o) => o &&
    (eventOptionsSupported ?
        { capture: o.capture, passive: o.passive, once: o.once } :
        o.capture);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * The default TemplateFactory which caches Templates keyed on
 * result.type and result.strings.
 */
function templateFactory(result) {
    let templateCache = templateCaches.get(result.type);
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(result.type, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== undefined) {
        return template;
    }
    // If the TemplateStringsArray is new, generate a key from the strings
    // This key is shared between all templates with identical content
    const key = result.strings.join(marker);
    // Check if we already have a Template for this key
    template = templateCache.keyString.get(key);
    if (template === undefined) {
        // If we have not seen this key before, create a new Template
        template = new Template(result, result.getTemplateElement());
        // Cache the Template for this key
        templateCache.keyString.set(key, template);
    }
    // Cache all future queries for this TemplateStringsArray
    templateCache.stringsArray.set(result.strings, template);
    return template;
}
const templateCaches = new Map();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const parts = new WeakMap();
/**
 * Renders a template result or other value to a container.
 *
 * To update a container with new values, reevaluate the template literal and
 * call `render` with the new result.
 *
 * @param result Any value renderable by NodePart - typically a TemplateResult
 *     created by evaluating a template tag like `html` or `svg`.
 * @param container A DOM parent to render to. The entire contents are either
 *     replaced, or efficiently updated if the same result type was previous
 *     rendered there.
 * @param options RenderOptions for the entire render tree rendered to this
 *     container. Render options must *not* change between renders to the same
 *     container, as those changes will not effect previously rendered DOM.
 */
const render = (result, container, options) => {
    let part = parts.get(container);
    if (part === undefined) {
        removeNodes(container, container.firstChild);
        parts.set(container, part = new NodePart(Object.assign({ templateFactory }, options)));
        part.appendInto(container);
    }
    part.setValue(result);
    part.commit();
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Creates Parts when a template is instantiated.
 */
class DefaultTemplateProcessor {
    /**
     * Create parts for an attribute-position binding, given the event, attribute
     * name, and string literals.
     *
     * @param element The element containing the binding
     * @param name  The attribute name
     * @param strings The string literals. There are always at least two strings,
     *   event for fully-controlled bindings with a single expression.
     */
    handleAttributeExpressions(element, name, strings, options) {
        const prefix = name[0];
        if (prefix === '.') {
            const committer = new PropertyCommitter(element, name.slice(1), strings);
            return committer.parts;
        }
        if (prefix === '@') {
            return [new EventPart(element, name.slice(1), options.eventContext)];
        }
        if (prefix === '?') {
            return [new BooleanAttributePart(element, name.slice(1), strings)];
        }
        const committer = new AttributeCommitter(element, name, strings);
        return committer.parts;
    }
    /**
     * Create parts for a text-position binding.
     * @param templateFactory
     */
    handleTextExpression(options) {
        return new NodePart(options);
    }
}
const defaultTemplateProcessor = new DefaultTemplateProcessor();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for lit-html usage.
// TODO(justinfagnani): inject version number at build time
if (typeof window !== 'undefined') {
    (window['litHtmlVersions'] || (window['litHtmlVersions'] = [])).push('1.4.1');
}
/**
 * Interprets a template literal as an HTML template that can efficiently
 * render to and update a container.
 */
const html = (strings, ...values) => new TemplateResult(strings, values, 'html', defaultTemplateProcessor);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// Get a key to lookup in `templateCaches`.
const getTemplateCacheKey = (type, scopeName) => `${type}--${scopeName}`;
let compatibleShadyCSSVersion = true;
if (typeof window.ShadyCSS === 'undefined') {
    compatibleShadyCSSVersion = false;
}
else if (typeof window.ShadyCSS.prepareTemplateDom === 'undefined') {
    console.warn(`Incompatible ShadyCSS version detected. ` +
        `Please update to at least @webcomponents/webcomponentsjs@2.0.2 and ` +
        `@webcomponents/shadycss@1.3.1.`);
    compatibleShadyCSSVersion = false;
}
/**
 * Template factory which scopes template DOM using ShadyCSS.
 * @param scopeName {string}
 */
const shadyTemplateFactory = (scopeName) => (result) => {
    const cacheKey = getTemplateCacheKey(result.type, scopeName);
    let templateCache = templateCaches.get(cacheKey);
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(cacheKey, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== undefined) {
        return template;
    }
    const key = result.strings.join(marker);
    template = templateCache.keyString.get(key);
    if (template === undefined) {
        const element = result.getTemplateElement();
        if (compatibleShadyCSSVersion) {
            window.ShadyCSS.prepareTemplateDom(element, scopeName);
        }
        template = new Template(result, element);
        templateCache.keyString.set(key, template);
    }
    templateCache.stringsArray.set(result.strings, template);
    return template;
};
const TEMPLATE_TYPES = ['html', 'svg'];
/**
 * Removes all style elements from Templates for the given scopeName.
 */
const removeStylesFromLitTemplates = (scopeName) => {
    TEMPLATE_TYPES.forEach((type) => {
        const templates = templateCaches.get(getTemplateCacheKey(type, scopeName));
        if (templates !== undefined) {
            templates.keyString.forEach((template) => {
                const { element: { content } } = template;
                // IE 11 doesn't support the iterable param Set constructor
                const styles = new Set();
                Array.from(content.querySelectorAll('style')).forEach((s) => {
                    styles.add(s);
                });
                removeNodesFromTemplate(template, styles);
            });
        }
    });
};
const shadyRenderSet = new Set();
/**
 * For the given scope name, ensures that ShadyCSS style scoping is performed.
 * This is done just once per scope name so the fragment and template cannot
 * be modified.
 * (1) extracts styles from the rendered fragment and hands them to ShadyCSS
 * to be scoped and appended to the document
 * (2) removes style elements from all lit-html Templates for this scope name.
 *
 * Note, <style> elements can only be placed into templates for the
 * initial rendering of the scope. If <style> elements are included in templates
 * dynamically rendered to the scope (after the first scope render), they will
 * not be scoped and the <style> will be left in the template and rendered
 * output.
 */
const prepareTemplateStyles = (scopeName, renderedDOM, template) => {
    shadyRenderSet.add(scopeName);
    // If `renderedDOM` is stamped from a Template, then we need to edit that
    // Template's underlying template element. Otherwise, we create one here
    // to give to ShadyCSS, which still requires one while scoping.
    const templateElement = !!template ? template.element : document.createElement('template');
    // Move styles out of rendered DOM and store.
    const styles = renderedDOM.querySelectorAll('style');
    const { length } = styles;
    // If there are no styles, skip unnecessary work
    if (length === 0) {
        // Ensure prepareTemplateStyles is called to support adding
        // styles via `prepareAdoptedCssText` since that requires that
        // `prepareTemplateStyles` is called.
        //
        // ShadyCSS will only update styles containing @apply in the template
        // given to `prepareTemplateStyles`. If no lit Template was given,
        // ShadyCSS will not be able to update uses of @apply in any relevant
        // template. However, this is not a problem because we only create the
        // template for the purpose of supporting `prepareAdoptedCssText`,
        // which doesn't support @apply at all.
        window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
        return;
    }
    const condensedStyle = document.createElement('style');
    // Collect styles into a single style. This helps us make sure ShadyCSS
    // manipulations will not prevent us from being able to fix up template
    // part indices.
    // NOTE: collecting styles is inefficient for browsers but ShadyCSS
    // currently does this anyway. When it does not, this should be changed.
    for (let i = 0; i < length; i++) {
        const style = styles[i];
        style.parentNode.removeChild(style);
        condensedStyle.textContent += style.textContent;
    }
    // Remove styles from nested templates in this scope.
    removeStylesFromLitTemplates(scopeName);
    // And then put the condensed style into the "root" template passed in as
    // `template`.
    const content = templateElement.content;
    if (!!template) {
        insertNodeIntoTemplate(template, condensedStyle, content.firstChild);
    }
    else {
        content.insertBefore(condensedStyle, content.firstChild);
    }
    // Note, it's important that ShadyCSS gets the template that `lit-html`
    // will actually render so that it can update the style inside when
    // needed (e.g. @apply native Shadow DOM case).
    window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
    const style = content.querySelector('style');
    if (window.ShadyCSS.nativeShadow && style !== null) {
        // When in native Shadow DOM, ensure the style created by ShadyCSS is
        // included in initially rendered output (`renderedDOM`).
        renderedDOM.insertBefore(style.cloneNode(true), renderedDOM.firstChild);
    }
    else if (!!template) {
        // When no style is left in the template, parts will be broken as a
        // result. To fix this, we put back the style node ShadyCSS removed
        // and then tell lit to remove that node from the template.
        // There can be no style in the template in 2 cases (1) when Shady DOM
        // is in use, ShadyCSS removes all styles, (2) when native Shadow DOM
        // is in use ShadyCSS removes the style if it contains no content.
        // NOTE, ShadyCSS creates its own style so we can safely add/remove
        // `condensedStyle` here.
        content.insertBefore(condensedStyle, content.firstChild);
        const removes = new Set();
        removes.add(condensedStyle);
        removeNodesFromTemplate(template, removes);
    }
};
/**
 * Extension to the standard `render` method which supports rendering
 * to ShadowRoots when the ShadyDOM (https://github.com/webcomponents/shadydom)
 * and ShadyCSS (https://github.com/webcomponents/shadycss) polyfills are used
 * or when the webcomponentsjs
 * (https://github.com/webcomponents/webcomponentsjs) polyfill is used.
 *
 * Adds a `scopeName` option which is used to scope element DOM and stylesheets
 * when native ShadowDOM is unavailable. The `scopeName` will be added to
 * the class attribute of all rendered DOM. In addition, any style elements will
 * be automatically re-written with this `scopeName` selector and moved out
 * of the rendered DOM and into the document `<head>`.
 *
 * It is common to use this render method in conjunction with a custom element
 * which renders a shadowRoot. When this is done, typically the element's
 * `localName` should be used as the `scopeName`.
 *
 * In addition to DOM scoping, ShadyCSS also supports a basic shim for css
 * custom properties (needed only on older browsers like IE11) and a shim for
 * a deprecated feature called `@apply` that supports applying a set of css
 * custom properties to a given location.
 *
 * Usage considerations:
 *
 * * Part values in `<style>` elements are only applied the first time a given
 * `scopeName` renders. Subsequent changes to parts in style elements will have
 * no effect. Because of this, parts in style elements should only be used for
 * values that will never change, for example parts that set scope-wide theme
 * values or parts which render shared style elements.
 *
 * * Note, due to a limitation of the ShadyDOM polyfill, rendering in a
 * custom element's `constructor` is not supported. Instead rendering should
 * either done asynchronously, for example at microtask timing (for example
 * `Promise.resolve()`), or be deferred until the first time the element's
 * `connectedCallback` runs.
 *
 * Usage considerations when using shimmed custom properties or `@apply`:
 *
 * * Whenever any dynamic changes are made which affect
 * css custom properties, `ShadyCSS.styleElement(element)` must be called
 * to update the element. There are two cases when this is needed:
 * (1) the element is connected to a new parent, (2) a class is added to the
 * element that causes it to match different custom properties.
 * To address the first case when rendering a custom element, `styleElement`
 * should be called in the element's `connectedCallback`.
 *
 * * Shimmed custom properties may only be defined either for an entire
 * shadowRoot (for example, in a `:host` rule) or via a rule that directly
 * matches an element with a shadowRoot. In other words, instead of flowing from
 * parent to child as do native css custom properties, shimmed custom properties
 * flow only from shadowRoots to nested shadowRoots.
 *
 * * When using `@apply` mixing css shorthand property names with
 * non-shorthand names (for example `border` and `border-width`) is not
 * supported.
 */
const render$1 = (result, container, options) => {
    if (!options || typeof options !== 'object' || !options.scopeName) {
        throw new Error('The `scopeName` option is required.');
    }
    const scopeName = options.scopeName;
    const hasRendered = parts.has(container);
    const needsScoping = compatibleShadyCSSVersion &&
        container.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ &&
        !!container.host;
    // Handle first render to a scope specially...
    const firstScopeRender = needsScoping && !shadyRenderSet.has(scopeName);
    // On first scope render, render into a fragment; this cannot be a single
    // fragment that is reused since nested renders can occur synchronously.
    const renderContainer = firstScopeRender ? document.createDocumentFragment() : container;
    render(result, renderContainer, Object.assign({ templateFactory: shadyTemplateFactory(scopeName) }, options));
    // When performing first scope render,
    // (1) We've rendered into a fragment so that there's a chance to
    // `prepareTemplateStyles` before sub-elements hit the DOM
    // (which might cause them to render based on a common pattern of
    // rendering in a custom element's `connectedCallback`);
    // (2) Scope the template with ShadyCSS one time only for this scope.
    // (3) Render the fragment into the container and make sure the
    // container knows its `part` is the one we just rendered. This ensures
    // DOM will be re-used on subsequent renders.
    if (firstScopeRender) {
        const part = parts.get(renderContainer);
        parts.delete(renderContainer);
        // ShadyCSS might have style sheets (e.g. from `prepareAdoptedCssText`)
        // that should apply to `renderContainer` even if the rendered value is
        // not a TemplateInstance. However, it will only insert scoped styles
        // into the document if `prepareTemplateStyles` has already been called
        // for the given scope name.
        const template = part.value instanceof TemplateInstance ?
            part.value.template :
            undefined;
        prepareTemplateStyles(scopeName, renderContainer, template);
        removeNodes(container, container.firstChild);
        container.appendChild(renderContainer);
        parts.set(container, part);
    }
    // After elements have hit the DOM, update styling if this is the
    // initial render to this container.
    // This is needed whenever dynamic changes are made so it would be
    // safest to do every render; however, this would regress performance
    // so we leave it up to the user to call `ShadyCSS.styleElement`
    // for dynamic changes.
    if (!hasRendered && needsScoping) {
        window.ShadyCSS.styleElement(container.host);
    }
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
var _a;
/**
 * Use this module if you want to create your own base class extending
 * [[UpdatingElement]].
 * @packageDocumentation
 */
/*
 * When using Closure Compiler, JSCompiler_renameProperty(property, object) is
 * replaced at compile time by the munged name for object[property]. We cannot
 * alias this function, so we have to use a small shim that has the same
 * behavior when not compiling.
 */
window.JSCompiler_renameProperty =
    (prop, _obj) => prop;
const defaultConverter = {
    toAttribute(value, type) {
        switch (type) {
            case Boolean:
                return value ? '' : null;
            case Object:
            case Array:
                // if the value is `null` or `undefined` pass this through
                // to allow removing/no change behavior.
                return value == null ? value : JSON.stringify(value);
        }
        return value;
    },
    fromAttribute(value, type) {
        switch (type) {
            case Boolean:
                return value !== null;
            case Number:
                return value === null ? null : Number(value);
            case Object:
            case Array:
                // Type assert to adhere to Bazel's "must type assert JSON parse" rule.
                return JSON.parse(value);
        }
        return value;
    }
};
/**
 * Change function that returns true if `value` is different from `oldValue`.
 * This method is used as the default for a property's `hasChanged` function.
 */
const notEqual = (value, old) => {
    // This ensures (old==NaN, value==NaN) always returns false
    return old !== value && (old === old || value === value);
};
const defaultPropertyDeclaration = {
    attribute: true,
    type: String,
    converter: defaultConverter,
    reflect: false,
    hasChanged: notEqual
};
const STATE_HAS_UPDATED = 1;
const STATE_UPDATE_REQUESTED = 1 << 2;
const STATE_IS_REFLECTING_TO_ATTRIBUTE = 1 << 3;
const STATE_IS_REFLECTING_TO_PROPERTY = 1 << 4;
/**
 * The Closure JS Compiler doesn't currently have good support for static
 * property semantics where "this" is dynamic (e.g.
 * https://github.com/google/closure-compiler/issues/3177 and others) so we use
 * this hack to bypass any rewriting by the compiler.
 */
const finalized = 'finalized';
/**
 * Base element class which manages element properties and attributes. When
 * properties change, the `update` method is asynchronously called. This method
 * should be supplied by subclassers to render updates as desired.
 * @noInheritDoc
 */
class UpdatingElement extends HTMLElement {
    constructor() {
        super();
        this.initialize();
    }
    /**
     * Returns a list of attributes corresponding to the registered properties.
     * @nocollapse
     */
    static get observedAttributes() {
        // note: piggy backing on this to ensure we're finalized.
        this.finalize();
        const attributes = [];
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        this._classProperties.forEach((v, p) => {
            const attr = this._attributeNameForProperty(p, v);
            if (attr !== undefined) {
                this._attributeToPropertyMap.set(attr, p);
                attributes.push(attr);
            }
        });
        return attributes;
    }
    /**
     * Ensures the private `_classProperties` property metadata is created.
     * In addition to `finalize` this is also called in `createProperty` to
     * ensure the `@property` decorator can add property metadata.
     */
    /** @nocollapse */
    static _ensureClassProperties() {
        // ensure private storage for property declarations.
        if (!this.hasOwnProperty(JSCompiler_renameProperty('_classProperties', this))) {
            this._classProperties = new Map();
            // NOTE: Workaround IE11 not supporting Map constructor argument.
            const superProperties = Object.getPrototypeOf(this)._classProperties;
            if (superProperties !== undefined) {
                superProperties.forEach((v, k) => this._classProperties.set(k, v));
            }
        }
    }
    /**
     * Creates a property accessor on the element prototype if one does not exist
     * and stores a PropertyDeclaration for the property with the given options.
     * The property setter calls the property's `hasChanged` property option
     * or uses a strict identity check to determine whether or not to request
     * an update.
     *
     * This method may be overridden to customize properties; however,
     * when doing so, it's important to call `super.createProperty` to ensure
     * the property is setup correctly. This method calls
     * `getPropertyDescriptor` internally to get a descriptor to install.
     * To customize what properties do when they are get or set, override
     * `getPropertyDescriptor`. To customize the options for a property,
     * implement `createProperty` like this:
     *
     * static createProperty(name, options) {
     *   options = Object.assign(options, {myOption: true});
     *   super.createProperty(name, options);
     * }
     *
     * @nocollapse
     */
    static createProperty(name, options = defaultPropertyDeclaration) {
        // Note, since this can be called by the `@property` decorator which
        // is called before `finalize`, we ensure storage exists for property
        // metadata.
        this._ensureClassProperties();
        this._classProperties.set(name, options);
        // Do not generate an accessor if the prototype already has one, since
        // it would be lost otherwise and that would never be the user's intention;
        // Instead, we expect users to call `requestUpdate` themselves from
        // user-defined accessors. Note that if the super has an accessor we will
        // still overwrite it
        if (options.noAccessor || this.prototype.hasOwnProperty(name)) {
            return;
        }
        const key = typeof name === 'symbol' ? Symbol() : `__${name}`;
        const descriptor = this.getPropertyDescriptor(name, key, options);
        if (descriptor !== undefined) {
            Object.defineProperty(this.prototype, name, descriptor);
        }
    }
    /**
     * Returns a property descriptor to be defined on the given named property.
     * If no descriptor is returned, the property will not become an accessor.
     * For example,
     *
     *   class MyElement extends LitElement {
     *     static getPropertyDescriptor(name, key, options) {
     *       const defaultDescriptor =
     *           super.getPropertyDescriptor(name, key, options);
     *       const setter = defaultDescriptor.set;
     *       return {
     *         get: defaultDescriptor.get,
     *         set(value) {
     *           setter.call(this, value);
     *           // custom action.
     *         },
     *         configurable: true,
     *         enumerable: true
     *       }
     *     }
     *   }
     *
     * @nocollapse
     */
    static getPropertyDescriptor(name, key, options) {
        return {
            // tslint:disable-next-line:no-any no symbol in index
            get() {
                return this[key];
            },
            set(value) {
                const oldValue = this[name];
                this[key] = value;
                this
                    .requestUpdateInternal(name, oldValue, options);
            },
            configurable: true,
            enumerable: true
        };
    }
    /**
     * Returns the property options associated with the given property.
     * These options are defined with a PropertyDeclaration via the `properties`
     * object or the `@property` decorator and are registered in
     * `createProperty(...)`.
     *
     * Note, this method should be considered "final" and not overridden. To
     * customize the options for a given property, override `createProperty`.
     *
     * @nocollapse
     * @final
     */
    static getPropertyOptions(name) {
        return this._classProperties && this._classProperties.get(name) ||
            defaultPropertyDeclaration;
    }
    /**
     * Creates property accessors for registered properties and ensures
     * any superclasses are also finalized.
     * @nocollapse
     */
    static finalize() {
        // finalize any superclasses
        const superCtor = Object.getPrototypeOf(this);
        if (!superCtor.hasOwnProperty(finalized)) {
            superCtor.finalize();
        }
        this[finalized] = true;
        this._ensureClassProperties();
        // initialize Map populated in observedAttributes
        this._attributeToPropertyMap = new Map();
        // make any properties
        // Note, only process "own" properties since this element will inherit
        // any properties defined on the superClass, and finalization ensures
        // the entire prototype chain is finalized.
        if (this.hasOwnProperty(JSCompiler_renameProperty('properties', this))) {
            const props = this.properties;
            // support symbols in properties (IE11 does not support this)
            const propKeys = [
                ...Object.getOwnPropertyNames(props),
                ...(typeof Object.getOwnPropertySymbols === 'function') ?
                    Object.getOwnPropertySymbols(props) :
                    []
            ];
            // This for/of is ok because propKeys is an array
            for (const p of propKeys) {
                // note, use of `any` is due to TypeSript lack of support for symbol in
                // index types
                // tslint:disable-next-line:no-any no symbol in index
                this.createProperty(p, props[p]);
            }
        }
    }
    /**
     * Returns the property name for the given attribute `name`.
     * @nocollapse
     */
    static _attributeNameForProperty(name, options) {
        const attribute = options.attribute;
        return attribute === false ?
            undefined :
            (typeof attribute === 'string' ?
                attribute :
                (typeof name === 'string' ? name.toLowerCase() : undefined));
    }
    /**
     * Returns true if a property should request an update.
     * Called when a property value is set and uses the `hasChanged`
     * option for the property if present or a strict identity check.
     * @nocollapse
     */
    static _valueHasChanged(value, old, hasChanged = notEqual) {
        return hasChanged(value, old);
    }
    /**
     * Returns the property value for the given attribute value.
     * Called via the `attributeChangedCallback` and uses the property's
     * `converter` or `converter.fromAttribute` property option.
     * @nocollapse
     */
    static _propertyValueFromAttribute(value, options) {
        const type = options.type;
        const converter = options.converter || defaultConverter;
        const fromAttribute = (typeof converter === 'function' ? converter : converter.fromAttribute);
        return fromAttribute ? fromAttribute(value, type) : value;
    }
    /**
     * Returns the attribute value for the given property value. If this
     * returns undefined, the property will *not* be reflected to an attribute.
     * If this returns null, the attribute will be removed, otherwise the
     * attribute will be set to the value.
     * This uses the property's `reflect` and `type.toAttribute` property options.
     * @nocollapse
     */
    static _propertyValueToAttribute(value, options) {
        if (options.reflect === undefined) {
            return;
        }
        const type = options.type;
        const converter = options.converter;
        const toAttribute = converter && converter.toAttribute ||
            defaultConverter.toAttribute;
        return toAttribute(value, type);
    }
    /**
     * Performs element initialization. By default captures any pre-set values for
     * registered properties.
     */
    initialize() {
        this._updateState = 0;
        this._updatePromise =
            new Promise((res) => this._enableUpdatingResolver = res);
        this._changedProperties = new Map();
        this._saveInstanceProperties();
        // ensures first update will be caught by an early access of
        // `updateComplete`
        this.requestUpdateInternal();
    }
    /**
     * Fixes any properties set on the instance before upgrade time.
     * Otherwise these would shadow the accessor and break these properties.
     * The properties are stored in a Map which is played back after the
     * constructor runs. Note, on very old versions of Safari (<=9) or Chrome
     * (<=41), properties created for native platform properties like (`id` or
     * `name`) may not have default values set in the element constructor. On
     * these browsers native properties appear on instances and therefore their
     * default value will overwrite any element default (e.g. if the element sets
     * this.id = 'id' in the constructor, the 'id' will become '' since this is
     * the native platform default).
     */
    _saveInstanceProperties() {
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        this.constructor
            ._classProperties.forEach((_v, p) => {
            if (this.hasOwnProperty(p)) {
                const value = this[p];
                delete this[p];
                if (!this._instanceProperties) {
                    this._instanceProperties = new Map();
                }
                this._instanceProperties.set(p, value);
            }
        });
    }
    /**
     * Applies previously saved instance properties.
     */
    _applyInstanceProperties() {
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        // tslint:disable-next-line:no-any
        this._instanceProperties.forEach((v, p) => this[p] = v);
        this._instanceProperties = undefined;
    }
    connectedCallback() {
        // Ensure first connection completes an update. Updates cannot complete
        // before connection.
        this.enableUpdating();
    }
    enableUpdating() {
        if (this._enableUpdatingResolver !== undefined) {
            this._enableUpdatingResolver();
            this._enableUpdatingResolver = undefined;
        }
    }
    /**
     * Allows for `super.disconnectedCallback()` in extensions while
     * reserving the possibility of making non-breaking feature additions
     * when disconnecting at some point in the future.
     */
    disconnectedCallback() {
    }
    /**
     * Synchronizes property values when attributes change.
     */
    attributeChangedCallback(name, old, value) {
        if (old !== value) {
            this._attributeToProperty(name, value);
        }
    }
    _propertyToAttribute(name, value, options = defaultPropertyDeclaration) {
        const ctor = this.constructor;
        const attr = ctor._attributeNameForProperty(name, options);
        if (attr !== undefined) {
            const attrValue = ctor._propertyValueToAttribute(value, options);
            // an undefined value does not change the attribute.
            if (attrValue === undefined) {
                return;
            }
            // Track if the property is being reflected to avoid
            // setting the property again via `attributeChangedCallback`. Note:
            // 1. this takes advantage of the fact that the callback is synchronous.
            // 2. will behave incorrectly if multiple attributes are in the reaction
            // stack at time of calling. However, since we process attributes
            // in `update` this should not be possible (or an extreme corner case
            // that we'd like to discover).
            // mark state reflecting
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_ATTRIBUTE;
            if (attrValue == null) {
                this.removeAttribute(attr);
            }
            else {
                this.setAttribute(attr, attrValue);
            }
            // mark state not reflecting
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_ATTRIBUTE;
        }
    }
    _attributeToProperty(name, value) {
        // Use tracking info to avoid deserializing attribute value if it was
        // just set from a property setter.
        if (this._updateState & STATE_IS_REFLECTING_TO_ATTRIBUTE) {
            return;
        }
        const ctor = this.constructor;
        // Note, hint this as an `AttributeMap` so closure clearly understands
        // the type; it has issues with tracking types through statics
        // tslint:disable-next-line:no-unnecessary-type-assertion
        const propName = ctor._attributeToPropertyMap.get(name);
        if (propName !== undefined) {
            const options = ctor.getPropertyOptions(propName);
            // mark state reflecting
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_PROPERTY;
            this[propName] =
                // tslint:disable-next-line:no-any
                ctor._propertyValueFromAttribute(value, options);
            // mark state not reflecting
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_PROPERTY;
        }
    }
    /**
     * This protected version of `requestUpdate` does not access or return the
     * `updateComplete` promise. This promise can be overridden and is therefore
     * not free to access.
     */
    requestUpdateInternal(name, oldValue, options) {
        let shouldRequestUpdate = true;
        // If we have a property key, perform property update steps.
        if (name !== undefined) {
            const ctor = this.constructor;
            options = options || ctor.getPropertyOptions(name);
            if (ctor._valueHasChanged(this[name], oldValue, options.hasChanged)) {
                if (!this._changedProperties.has(name)) {
                    this._changedProperties.set(name, oldValue);
                }
                // Add to reflecting properties set.
                // Note, it's important that every change has a chance to add the
                // property to `_reflectingProperties`. This ensures setting
                // attribute + property reflects correctly.
                if (options.reflect === true &&
                    !(this._updateState & STATE_IS_REFLECTING_TO_PROPERTY)) {
                    if (this._reflectingProperties === undefined) {
                        this._reflectingProperties = new Map();
                    }
                    this._reflectingProperties.set(name, options);
                }
            }
            else {
                // Abort the request if the property should not be considered changed.
                shouldRequestUpdate = false;
            }
        }
        if (!this._hasRequestedUpdate && shouldRequestUpdate) {
            this._updatePromise = this._enqueueUpdate();
        }
    }
    /**
     * Requests an update which is processed asynchronously. This should
     * be called when an element should update based on some state not triggered
     * by setting a property. In this case, pass no arguments. It should also be
     * called when manually implementing a property setter. In this case, pass the
     * property `name` and `oldValue` to ensure that any configured property
     * options are honored. Returns the `updateComplete` Promise which is resolved
     * when the update completes.
     *
     * @param name {PropertyKey} (optional) name of requesting property
     * @param oldValue {any} (optional) old value of requesting property
     * @returns {Promise} A Promise that is resolved when the update completes.
     */
    requestUpdate(name, oldValue) {
        this.requestUpdateInternal(name, oldValue);
        return this.updateComplete;
    }
    /**
     * Sets up the element to asynchronously update.
     */
    async _enqueueUpdate() {
        this._updateState = this._updateState | STATE_UPDATE_REQUESTED;
        try {
            // Ensure any previous update has resolved before updating.
            // This `await` also ensures that property changes are batched.
            await this._updatePromise;
        }
        catch (e) {
            // Ignore any previous errors. We only care that the previous cycle is
            // done. Any error should have been handled in the previous update.
        }
        const result = this.performUpdate();
        // If `performUpdate` returns a Promise, we await it. This is done to
        // enable coordinating updates with a scheduler. Note, the result is
        // checked to avoid delaying an additional microtask unless we need to.
        if (result != null) {
            await result;
        }
        return !this._hasRequestedUpdate;
    }
    get _hasRequestedUpdate() {
        return (this._updateState & STATE_UPDATE_REQUESTED);
    }
    get hasUpdated() {
        return (this._updateState & STATE_HAS_UPDATED);
    }
    /**
     * Performs an element update. Note, if an exception is thrown during the
     * update, `firstUpdated` and `updated` will not be called.
     *
     * You can override this method to change the timing of updates. If this
     * method is overridden, `super.performUpdate()` must be called.
     *
     * For instance, to schedule updates to occur just before the next frame:
     *
     * ```
     * protected async performUpdate(): Promise<unknown> {
     *   await new Promise((resolve) => requestAnimationFrame(() => resolve()));
     *   super.performUpdate();
     * }
     * ```
     */
    performUpdate() {
        // Abort any update if one is not pending when this is called.
        // This can happen if `performUpdate` is called early to "flush"
        // the update.
        if (!this._hasRequestedUpdate) {
            return;
        }
        // Mixin instance properties once, if they exist.
        if (this._instanceProperties) {
            this._applyInstanceProperties();
        }
        let shouldUpdate = false;
        const changedProperties = this._changedProperties;
        try {
            shouldUpdate = this.shouldUpdate(changedProperties);
            if (shouldUpdate) {
                this.update(changedProperties);
            }
            else {
                this._markUpdated();
            }
        }
        catch (e) {
            // Prevent `firstUpdated` and `updated` from running when there's an
            // update exception.
            shouldUpdate = false;
            // Ensure element can accept additional updates after an exception.
            this._markUpdated();
            throw e;
        }
        if (shouldUpdate) {
            if (!(this._updateState & STATE_HAS_UPDATED)) {
                this._updateState = this._updateState | STATE_HAS_UPDATED;
                this.firstUpdated(changedProperties);
            }
            this.updated(changedProperties);
        }
    }
    _markUpdated() {
        this._changedProperties = new Map();
        this._updateState = this._updateState & ~STATE_UPDATE_REQUESTED;
    }
    /**
     * Returns a Promise that resolves when the element has completed updating.
     * The Promise value is a boolean that is `true` if the element completed the
     * update without triggering another update. The Promise result is `false` if
     * a property was set inside `updated()`. If the Promise is rejected, an
     * exception was thrown during the update.
     *
     * To await additional asynchronous work, override the `_getUpdateComplete`
     * method. For example, it is sometimes useful to await a rendered element
     * before fulfilling this Promise. To do this, first await
     * `super._getUpdateComplete()`, then any subsequent state.
     *
     * @returns {Promise} The Promise returns a boolean that indicates if the
     * update resolved without triggering another update.
     */
    get updateComplete() {
        return this._getUpdateComplete();
    }
    /**
     * Override point for the `updateComplete` promise.
     *
     * It is not safe to override the `updateComplete` getter directly due to a
     * limitation in TypeScript which means it is not possible to call a
     * superclass getter (e.g. `super.updateComplete.then(...)`) when the target
     * language is ES5 (https://github.com/microsoft/TypeScript/issues/338).
     * This method should be overridden instead. For example:
     *
     *   class MyElement extends LitElement {
     *     async _getUpdateComplete() {
     *       await super._getUpdateComplete();
     *       await this._myChild.updateComplete;
     *     }
     *   }
     * @deprecated Override `getUpdateComplete()` instead for forward
     *     compatibility with `lit-element` 3.0 / `@lit/reactive-element`.
     */
    _getUpdateComplete() {
        return this.getUpdateComplete();
    }
    /**
     * Override point for the `updateComplete` promise.
     *
     * It is not safe to override the `updateComplete` getter directly due to a
     * limitation in TypeScript which means it is not possible to call a
     * superclass getter (e.g. `super.updateComplete.then(...)`) when the target
     * language is ES5 (https://github.com/microsoft/TypeScript/issues/338).
     * This method should be overridden instead. For example:
     *
     *   class MyElement extends LitElement {
     *     async getUpdateComplete() {
     *       await super.getUpdateComplete();
     *       await this._myChild.updateComplete;
     *     }
     *   }
     */
    getUpdateComplete() {
        return this._updatePromise;
    }
    /**
     * Controls whether or not `update` should be called when the element requests
     * an update. By default, this method always returns `true`, but this can be
     * customized to control when to update.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    shouldUpdate(_changedProperties) {
        return true;
    }
    /**
     * Updates the element. This method reflects property values to attributes.
     * It can be overridden to render and keep updated element DOM.
     * Setting properties inside this method will *not* trigger
     * another update.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    update(_changedProperties) {
        if (this._reflectingProperties !== undefined &&
            this._reflectingProperties.size > 0) {
            // Use forEach so this works even if for/of loops are compiled to for
            // loops expecting arrays
            this._reflectingProperties.forEach((v, k) => this._propertyToAttribute(k, this[k], v));
            this._reflectingProperties = undefined;
        }
        this._markUpdated();
    }
    /**
     * Invoked whenever the element is updated. Implement to perform
     * post-updating tasks via DOM APIs, for example, focusing an element.
     *
     * Setting properties inside this method will trigger the element to update
     * again after this update cycle completes.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    updated(_changedProperties) {
    }
    /**
     * Invoked when the element is first updated. Implement to perform one time
     * work on the element after update.
     *
     * Setting properties inside this method will trigger the element to update
     * again after this update cycle completes.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    firstUpdated(_changedProperties) {
    }
}
_a = finalized;
/**
 * Marks class as having finished creating properties.
 */
UpdatingElement[_a] = true;

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const legacyCustomElement = (tagName, clazz) => {
    window.customElements.define(tagName, clazz);
    // Cast as any because TS doesn't recognize the return type as being a
    // subtype of the decorated class when clazz is typed as
    // `Constructor<HTMLElement>` for some reason.
    // `Constructor<HTMLElement>` is helpful to make sure the decorator is
    // applied to elements however.
    // tslint:disable-next-line:no-any
    return clazz;
};
const standardCustomElement = (tagName, descriptor) => {
    const { kind, elements } = descriptor;
    return {
        kind,
        elements,
        // This callback is called once the class is otherwise fully defined
        finisher(clazz) {
            window.customElements.define(tagName, clazz);
        }
    };
};
/**
 * Class decorator factory that defines the decorated class as a custom element.
 *
 * ```
 * @customElement('my-element')
 * class MyElement {
 *   render() {
 *     return html``;
 *   }
 * }
 * ```
 * @category Decorator
 * @param tagName The name of the custom element to define.
 */
const customElement = (tagName) => (classOrDescriptor) => (typeof classOrDescriptor === 'function') ?
    legacyCustomElement(tagName, classOrDescriptor) :
    standardCustomElement(tagName, classOrDescriptor);
const standardProperty = (options, element) => {
    // When decorating an accessor, pass it through and add property metadata.
    // Note, the `hasOwnProperty` check in `createProperty` ensures we don't
    // stomp over the user's accessor.
    if (element.kind === 'method' && element.descriptor &&
        !('value' in element.descriptor)) {
        return Object.assign(Object.assign({}, element), { finisher(clazz) {
                clazz.createProperty(element.key, options);
            } });
    }
    else {
        // createProperty() takes care of defining the property, but we still
        // must return some kind of descriptor, so return a descriptor for an
        // unused prototype field. The finisher calls createProperty().
        return {
            kind: 'field',
            key: Symbol(),
            placement: 'own',
            descriptor: {},
            // When @babel/plugin-proposal-decorators implements initializers,
            // do this instead of the initializer below. See:
            // https://github.com/babel/babel/issues/9260 extras: [
            //   {
            //     kind: 'initializer',
            //     placement: 'own',
            //     initializer: descriptor.initializer,
            //   }
            // ],
            initializer() {
                if (typeof element.initializer === 'function') {
                    this[element.key] = element.initializer.call(this);
                }
            },
            finisher(clazz) {
                clazz.createProperty(element.key, options);
            }
        };
    }
};
const legacyProperty = (options, proto, name) => {
    proto.constructor
        .createProperty(name, options);
};
/**
 * A property decorator which creates a LitElement property which reflects a
 * corresponding attribute value. A [[`PropertyDeclaration`]] may optionally be
 * supplied to configure property features.
 *
 * This decorator should only be used for public fields. Private or protected
 * fields should use the [[`internalProperty`]] decorator.
 *
 * @example
 * ```ts
 * class MyElement {
 *   @property({ type: Boolean })
 *   clicked = false;
 * }
 * ```
 * @category Decorator
 * @ExportDecoratedItems
 */
function property(options) {
    // tslint:disable-next-line:no-any decorator
    return (protoOrDescriptor, name) => (name !== undefined) ?
        legacyProperty(options, protoOrDescriptor, name) :
        standardProperty(options, protoOrDescriptor);
}

/**
@license
Copyright (c) 2019 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at
http://polymer.github.io/LICENSE.txt The complete set of authors may be found at
http://polymer.github.io/AUTHORS.txt The complete set of contributors may be
found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by Google as
part of the polymer project is also subject to an additional IP rights grant
found at http://polymer.github.io/PATENTS.txt
*/
/**
 * Whether the current browser supports `adoptedStyleSheets`.
 */
const supportsAdoptingStyleSheets = (window.ShadowRoot) &&
    (window.ShadyCSS === undefined || window.ShadyCSS.nativeShadow) &&
    ('adoptedStyleSheets' in Document.prototype) &&
    ('replace' in CSSStyleSheet.prototype);
const constructionToken = Symbol();
class CSSResult {
    constructor(cssText, safeToken) {
        if (safeToken !== constructionToken) {
            throw new Error('CSSResult is not constructable. Use `unsafeCSS` or `css` instead.');
        }
        this.cssText = cssText;
    }
    // Note, this is a getter so that it's lazy. In practice, this means
    // stylesheets are not created until the first element instance is made.
    get styleSheet() {
        if (this._styleSheet === undefined) {
            // Note, if `supportsAdoptingStyleSheets` is true then we assume
            // CSSStyleSheet is constructable.
            if (supportsAdoptingStyleSheets) {
                this._styleSheet = new CSSStyleSheet();
                this._styleSheet.replaceSync(this.cssText);
            }
            else {
                this._styleSheet = null;
            }
        }
        return this._styleSheet;
    }
    toString() {
        return this.cssText;
    }
}
/**
 * Wrap a value for interpolation in a [[`css`]] tagged template literal.
 *
 * This is unsafe because untrusted CSS text can be used to phone home
 * or exfiltrate data to an attacker controlled site. Take care to only use
 * this with trusted input.
 */
const unsafeCSS = (value) => {
    return new CSSResult(String(value), constructionToken);
};
const textFromCSSResult = (value) => {
    if (value instanceof CSSResult) {
        return value.cssText;
    }
    else if (typeof value === 'number') {
        return value;
    }
    else {
        throw new Error(`Value passed to 'css' function must be a 'css' function result: ${value}. Use 'unsafeCSS' to pass non-literal values, but
            take care to ensure page security.`);
    }
};
/**
 * Template tag which which can be used with LitElement's [[LitElement.styles |
 * `styles`]] property to set element styles. For security reasons, only literal
 * string values may be used. To incorporate non-literal values [[`unsafeCSS`]]
 * may be used inside a template string part.
 */
const css = (strings, ...values) => {
    const cssText = values.reduce((acc, v, idx) => acc + textFromCSSResult(v) + strings[idx + 1], strings[0]);
    return new CSSResult(cssText, constructionToken);
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for LitElement usage.
// TODO(justinfagnani): inject version number at build time
(window['litElementVersions'] || (window['litElementVersions'] = []))
    .push('2.5.1');
/**
 * Sentinal value used to avoid calling lit-html's render function when
 * subclasses do not implement `render`
 */
const renderNotImplemented = {};
/**
 * Base element class that manages element properties and attributes, and
 * renders a lit-html template.
 *
 * To define a component, subclass `LitElement` and implement a
 * `render` method to provide the component's template. Define properties
 * using the [[`properties`]] property or the [[`property`]] decorator.
 */
class LitElement extends UpdatingElement {
    /**
     * Return the array of styles to apply to the element.
     * Override this method to integrate into a style management system.
     *
     * @nocollapse
     */
    static getStyles() {
        return this.styles;
    }
    /** @nocollapse */
    static _getUniqueStyles() {
        // Only gather styles once per class
        if (this.hasOwnProperty(JSCompiler_renameProperty('_styles', this))) {
            return;
        }
        // Take care not to call `this.getStyles()` multiple times since this
        // generates new CSSResults each time.
        // TODO(sorvell): Since we do not cache CSSResults by input, any
        // shared styles will generate new stylesheet objects, which is wasteful.
        // This should be addressed when a browser ships constructable
        // stylesheets.
        const userStyles = this.getStyles();
        if (Array.isArray(userStyles)) {
            // De-duplicate styles preserving the _last_ instance in the set.
            // This is a performance optimization to avoid duplicated styles that can
            // occur especially when composing via subclassing.
            // The last item is kept to try to preserve the cascade order with the
            // assumption that it's most important that last added styles override
            // previous styles.
            const addStyles = (styles, set) => styles.reduceRight((set, s) => 
            // Note: On IE set.add() does not return the set
            Array.isArray(s) ? addStyles(s, set) : (set.add(s), set), set);
            // Array.from does not work on Set in IE, otherwise return
            // Array.from(addStyles(userStyles, new Set<CSSResult>())).reverse()
            const set = addStyles(userStyles, new Set());
            const styles = [];
            set.forEach((v) => styles.unshift(v));
            this._styles = styles;
        }
        else {
            this._styles = userStyles === undefined ? [] : [userStyles];
        }
        // Ensure that there are no invalid CSSStyleSheet instances here. They are
        // invalid in two conditions.
        // (1) the sheet is non-constructible (`sheet` of a HTMLStyleElement), but
        //     this is impossible to check except via .replaceSync or use
        // (2) the ShadyCSS polyfill is enabled (:. supportsAdoptingStyleSheets is
        //     false)
        this._styles = this._styles.map((s) => {
            if (s instanceof CSSStyleSheet && !supportsAdoptingStyleSheets) {
                // Flatten the cssText from the passed constructible stylesheet (or
                // undetectable non-constructible stylesheet). The user might have
                // expected to update their stylesheets over time, but the alternative
                // is a crash.
                const cssText = Array.prototype.slice.call(s.cssRules)
                    .reduce((css, rule) => css + rule.cssText, '');
                return unsafeCSS(cssText);
            }
            return s;
        });
    }
    /**
     * Performs element initialization. By default this calls
     * [[`createRenderRoot`]] to create the element [[`renderRoot`]] node and
     * captures any pre-set values for registered properties.
     */
    initialize() {
        super.initialize();
        this.constructor._getUniqueStyles();
        this.renderRoot = this.createRenderRoot();
        // Note, if renderRoot is not a shadowRoot, styles would/could apply to the
        // element's getRootNode(). While this could be done, we're choosing not to
        // support this now since it would require different logic around de-duping.
        if (window.ShadowRoot && this.renderRoot instanceof window.ShadowRoot) {
            this.adoptStyles();
        }
    }
    /**
     * Returns the node into which the element should render and by default
     * creates and returns an open shadowRoot. Implement to customize where the
     * element's DOM is rendered. For example, to render into the element's
     * childNodes, return `this`.
     * @returns {Element|DocumentFragment} Returns a node into which to render.
     */
    createRenderRoot() {
        return this.attachShadow(this.constructor.shadowRootOptions);
    }
    /**
     * Applies styling to the element shadowRoot using the [[`styles`]]
     * property. Styling will apply using `shadowRoot.adoptedStyleSheets` where
     * available and will fallback otherwise. When Shadow DOM is polyfilled,
     * ShadyCSS scopes styles and adds them to the document. When Shadow DOM
     * is available but `adoptedStyleSheets` is not, styles are appended to the
     * end of the `shadowRoot` to [mimic spec
     * behavior](https://wicg.github.io/construct-stylesheets/#using-constructed-stylesheets).
     */
    adoptStyles() {
        const styles = this.constructor._styles;
        if (styles.length === 0) {
            return;
        }
        // There are three separate cases here based on Shadow DOM support.
        // (1) shadowRoot polyfilled: use ShadyCSS
        // (2) shadowRoot.adoptedStyleSheets available: use it
        // (3) shadowRoot.adoptedStyleSheets polyfilled: append styles after
        // rendering
        if (window.ShadyCSS !== undefined && !window.ShadyCSS.nativeShadow) {
            window.ShadyCSS.ScopingShim.prepareAdoptedCssText(styles.map((s) => s.cssText), this.localName);
        }
        else if (supportsAdoptingStyleSheets) {
            this.renderRoot.adoptedStyleSheets =
                styles.map((s) => s instanceof CSSStyleSheet ? s : s.styleSheet);
        }
        else {
            // This must be done after rendering so the actual style insertion is done
            // in `update`.
            this._needsShimAdoptedStyleSheets = true;
        }
    }
    connectedCallback() {
        super.connectedCallback();
        // Note, first update/render handles styleElement so we only call this if
        // connected after first update.
        if (this.hasUpdated && window.ShadyCSS !== undefined) {
            window.ShadyCSS.styleElement(this);
        }
    }
    /**
     * Updates the element. This method reflects property values to attributes
     * and calls `render` to render DOM via lit-html. Setting properties inside
     * this method will *not* trigger another update.
     * @param _changedProperties Map of changed properties with old values
     */
    update(changedProperties) {
        // Setting properties in `render` should not trigger an update. Since
        // updates are allowed after super.update, it's important to call `render`
        // before that.
        const templateResult = this.render();
        super.update(changedProperties);
        // If render is not implemented by the component, don't call lit-html render
        if (templateResult !== renderNotImplemented) {
            this.constructor
                .render(templateResult, this.renderRoot, { scopeName: this.localName, eventContext: this });
        }
        // When native Shadow DOM is used but adoptedStyles are not supported,
        // insert styling after rendering to ensure adoptedStyles have highest
        // priority.
        if (this._needsShimAdoptedStyleSheets) {
            this._needsShimAdoptedStyleSheets = false;
            this.constructor._styles.forEach((s) => {
                const style = document.createElement('style');
                style.textContent = s.cssText;
                this.renderRoot.appendChild(style);
            });
        }
    }
    /**
     * Invoked on each update to perform rendering tasks. This method may return
     * any value renderable by lit-html's `NodePart` - typically a
     * `TemplateResult`. Setting properties inside this method will *not* trigger
     * the element to update.
     */
    render() {
        return renderNotImplemented;
    }
}
/**
 * Ensure this class is marked as `finalized` as an optimization ensuring
 * it will not needlessly try to `finalize`.
 *
 * Note this property name is a string to prevent breaking Closure JS Compiler
 * optimizations. See updating-element.ts for more information.
 */
LitElement['finalized'] = true;
/**
 * Reference to the underlying library method used to render the element's
 * DOM. By default, points to the `render` method from lit-html's shady-render
 * module.
 *
 * **Most users will never need to touch this property.**
 *
 * This  property should not be confused with the `render` instance method,
 * which should be overridden to define a template for the element.
 *
 * Advanced users creating a new base class based on LitElement can override
 * this property to point to a custom render method with a signature that
 * matches [shady-render's `render`
 * method](https://lit-html.polymer-project.org/api/modules/shady_render.html#render).
 *
 * @nocollapse
 */
LitElement.render = render$1;
/** @nocollapse */
LitElement.shadowRootOptions = { mode: 'open' };

const style = css `
  ha-card {
    cursor: pointer;
    position: relative;
  }
            
.spacer {
  padding-top: 1em;
  border-top: solid 1px var(--primary-text-color);
}
        
.variations {
  display: flex;
  flex-flow: row wrap;
  justify-content: space-between;
  font-weight: 300;
  color: var(--primary-text-color);
  list-style: none;
  padding: 3px 1em;
  margin: 0;
  // border-top: solid 1px var(--primary-text-color);
}

      .variations ha-icon {
        height: 22px;
        margin-right: 5px;
        color: var(--paper-item-icon-color);
      }
      
      .variations svg {
        height: 15px;
        margin-right: 5px;
        fill: var(--paper-item-icon-color);
      }
      
      .variations li {
        flex-basis: auto;
        width: 50%;
        z-index: 200 ;
      }

      .variations li:nth-child(2n) {
        text-align: right;
      }

      .variations li:nth-child(2n) ha-icon {
        margin-right: 0;
        margin-left: 8px;
        float: right;
      }    
      
      .variations li:nth-child(2n) svg {
        margin-right: 0;
        margin-left: 8px;
        float: right;
      }    
      
`;

const styleSummary = css `
  .current {
    padding-top: 1.2em;
    margin-bottom: 3.5em;
  }
  
  .icon.bigger {
    width: 10em;
    height: 10em;
    margin-top: -4em;
    position: absolute;
    left: 0em;
  }
  
  .title {
    position: absolute;
    left: calc(140px + (26 - 14) * ((100vw - 300px) / (1600 - 300)));
    top: 0.6em;
    font-weight: 300;
    font-size: calc(14px + (26 - 14) * ((100vw - 300px) / (1600 - 300)));
    color: var(--primary-text-color);
  }
  .moon {
    position: absolute;
    left: calc(115px + (26 - 14) * ((100vw - 300px) / (1600 - 300)));
    top: calc(63px - (26 - 14) * ((100vw - 300px) / (1600 - 300)));
    font-weight: 300;
    font-size: calc(14px + (26 - 14) * ((100vw - 300px) / (1600 - 300)));
    color: var(--primary-text-color);
    line-height:20px;
    display: inline-block;
  }
            
  .temp {
    position: absolute;
    // top: 0.65em;
    font-weight: 300;
    font-size: calc(35px + (26 - 14) * ((100vw - 300px) / (1600 - 300)));
    color: var(--primary-text-color);
    right: 1em;
    margin-top: 2px;
  }

  .tempc {
    position: absolute;
    font-weight: 300;
    font-size: calc(12px + (26 - 14) * ((100vw - 300px) / (1600 - 300)));
    // font-size: 1.5em;
    vertical-align: super;
    color: var(--primary-text-color);
    right: 0.7em;
    margin-top: -11px;
    margin-right: 7px;
  }      
     
`;

const styleMeter = css `
  .meter {
    background: #efefef; /* Grigio */
    border-radius: 8px;
    border: 1px solid transparent; /* 2 */
    box-shadow:
      0 1px 3px 1px rgba(0,0,0,0.15) inset,
      0 0 0 1px #333; /* 1 */
    height: .75em;
    max-width: 5.5em;
    overflow: hidden;
    width: 100%;
  }

  /* WebKit */
  .meter::-webkit-meter-bar {
    background: #efefef; /* Grigio */
    border: 1px solid transparent; /* 2 */
    border-radius: 8px;
  }

  .meter::-webkit-meter-optimum-value,
  .meter::-webkit-meter-suboptimum-value,
  .meter::-webkit-meter-even-less-good-value {
    border-radius: 8px; 
  }

  .meter::-webkit-meter-optimum-value {
    background: #85cc00; /* verde #3C5C00; */
  }
      
  .meter::-webkit-meter-suboptimum-value {
    background: #F5D000;
  }
      
  .meter::-webkit-meter-even-less-good-value  {
    background: #e65000 ; /* Rosso #D14900; */
  }

  /* Firefox */
  .meter::-moz-meter-bar {
    border-radius: 8px;
  }

  .meter:-moz-meter-optimum::-moz-meter-bar {
    background: #3C5C00;
  }

  .meter:-moz-meter-sub-optimum::-moz-meter-bar {
    background: #F5D000;
  }

  .meter:-moz-meter-sub-sub-optimum::-moz-meter-bar {
    background: #D14900;
  }

`;

const styleForecast = css `
  .day {
    flex: 1;
    display: block;
    text-align: center;
    color: var(--primary-text-color);
    border-right: 0.1em solid #d9d9d9;
    line-height: 2;
    box-sizing: border-box;
    z-index: 200;
  }
  
  .dayname {
    text-transform: uppercase;
  }
      
  .icon {
    width: 50px;
    height: 50px;
    margin-right: 5px;
    display: inline-block;
    vertical-align: middle;
    background-size: contain;
    background-position: center center;
    background-repeat: no-repeat;
    text-indent: -9999px;
  }   
      
  .forecast {
    width: 100%;
    margin: 0 auto;
    display: flex;
    z-index: 200;
  }
  
  .forecast .day:first-child {
    margin-left: 0;
        z-index: 200;
  }
  
  .forecast .day:nth-last-child(1) {
    border-right: none;
    margin-right: 0;
        z-index: 200;
  }  
`;

const styleCamera = css `
      .camera-container {
        margin-top: 10px;
        height: 100%;
        width: 100%;
        display: flex;
        align-items: stretch;
        // position: absolute;
        // background: #000;
      } 
      .camera-image {
        flex: 3;
        height: 100%;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .camera-image > img {
        display: inline-block;
        max-width: 100%;
        max-height: 100%;
      }
`;

const styleNightAndDay = css `
  .nd-container {
    margin: auto;
    padding-top: 1.3em;
    padding-bottom: 1.3em;
    padding-left: 1em;
    padding-right: 1em;
    
    position: relative;
    // background: #5C97FF;
    overflow: hidden;
  }
// .ha-card-night:before {
//   content: ' ';
//   display: block;
//   position: absolute;
//   left: 0;
//   top: 0;
//   width: 100%;
//   height: 100%;
//   z-index: 0;
//   opacity: calc(attr(data-opacity));
//   background-image: url('https://raw.githubusercontent.com/tingletech/moon-phase/gh-pages/background.jpg');
//   background-repeat: no-repeat;
//   background-position: 50% 0;
//  
//   -ms-background-size: cover;
//   -o-background-size: cover;
//   -moz-background-size: cover;
//   -webkit-background-size: cover;
//   background-size: cover;
// }
`;

const getSeaStyle = (path) => {
    return `
  
  
.synoptic {
  width: 100%;
  border-collapse: collapse;
}

table.synoptic tr:not(:last-child) {
  border-bottom: 1px solid #476b6b;
  // background-color: cadetblue;
}
  
table.synoptic td {
  vertical-align: top;
}
  
.msw-sw
{
    display:            inline-block;
    width:              30px;
    height:             30px;
    background:         url("${path}/we-sprite.png") no-repeat top left;
}
.msw-sw-1{ background-position: 0 0; width: 30px; height: 30px; } 
.msw-sw-10{ background-position: 0 -60px; width: 30px; height: 30px; } 
.msw-sw-11{ background-position: 0 -120px; width: 30px; height: 30px; } 
.msw-sw-12{ background-position: 0 -180px; width: 30px; height: 30px; } 
.msw-sw-13{ background-position: 0 -240px; width: 30px; height: 30px; } 
.msw-sw-14{ background-position: 0 -300px; width: 30px; height: 30px; } 
.msw-sw-15{ background-position: 0 -360px; width: 30px; height: 30px; } 
.msw-sw-16{ background-position: 0 -420px; width: 30px; height: 30px; } 
.msw-sw-17{ background-position: 0 -480px; width: 30px; height: 30px; } 
.msw-sw-18{ background-position: 0 -540px; width: 30px; height: 30px; } 
.msw-sw-19{ background-position: 0 -600px; width: 30px; height: 30px; } 
.msw-sw-2{ background-position: 0 -660px; width: 30px; height: 30px; } 
.msw-sw-20{ background-position: 0 -720px; width: 30px; height: 30px; } 
.msw-sw-21{ background-position: 0 -780px; width: 30px; height: 30px; } 
.msw-sw-22{ background-position: 0 -840px; width: 30px; height: 30px; } 
.msw-sw-23{ background-position: 0 -900px; width: 30px; height: 30px; } 
.msw-sw-24{ background-position: 0 -960px; width: 30px; height: 30px; } 
.msw-sw-25{ background-position: 0 -1020px; width: 30px; height: 30px; } 
.msw-sw-26{ background-position: 0 -1080px; width: 30px; height: 30px; } 
.msw-sw-27{ background-position: 0 -1140px; width: 30px; height: 30px; } 
.msw-sw-28{ background-position: 0 -1200px; width: 30px; height: 30px; } 
.msw-sw-29{ background-position: 0 -1260px; width: 30px; height: 30px; } 
.msw-sw-3{ background-position: 0 -1320px; width: 30px; height: 30px; } 
.msw-sw-30{ background-position: 0 -1380px; width: 30px; height: 30px; } 
.msw-sw-31{ background-position: 0 -1440px; width: 30px; height: 30px; } 
.msw-sw-32{ background-position: 0 -1500px; width: 30px; height: 30px; } 
.msw-sw-33{ background-position: 0 -1560px; width: 30px; height: 30px; } 
.msw-sw-34{ background-position: 0 -1620px; width: 30px; height: 30px; } 
.msw-sw-35{ background-position: 0 -1680px; width: 30px; height: 30px; } 
.msw-sw-36{ background-position: 0 -1740px; width: 30px; height: 30px; } 
.msw-sw-37{ background-position: 0 -1800px; width: 30px; height: 30px; } 
.msw-sw-38{ background-position: 0 -1860px; width: 30px; height: 30px; } 
.msw-sw-4{ background-position: 0 -1920px; width: 30px; height: 30px; } 
.msw-sw-5{ background-position: -60px 0; width: 30px; height: 30px; } 
.msw-sw-6{ background-position: -60px -60px; width: 30px; height: 30px; } 
.msw-sw-7{ background-position: -60px -120px; width: 30px; height: 30px; } 
.msw-sw-8{ background-position: -60px -180px; width: 30px; height: 30px; } 
.msw-sw-9{ background-position: -60px -240px; width: 30px; height: 30px; }

.msw-swa /* Inherits from swell arrows */
{
    background:         url("${path}/sa-sprite.png") no-repeat top left;
}
.msw-swa-10{ background-position: 0 0; width: 26px; height: 26px; } 
.msw-swa-100{ background-position: 0 -52px; width: 26px; height: 26px; } 
.msw-swa-105{ background-position: 0 -104px; width: 26px; height: 26px; } 
.msw-swa-110{ background-position: 0 -156px; width: 26px; height: 26px; } 
.msw-swa-115{ background-position: 0 -208px; width: 26px; height: 26px; } 
.msw-swa-120{ background-position: 0 -260px; width: 26px; height: 26px; } 
.msw-swa-125{ background-position: 0 -312px; width: 26px; height: 26px; } 
.msw-swa-130{ background-position: 0 -364px; width: 26px; height: 26px; } 
.msw-swa-135{ background-position: 0 -416px; width: 26px; height: 26px; } 
.msw-swa-140{ background-position: 0 -468px; width: 26px; height: 26px; } 
.msw-swa-145{ background-position: 0 -520px; width: 26px; height: 26px; } 
.msw-swa-15{ background-position: 0 -572px; width: 26px; height: 26px; } 
.msw-swa-150{ background-position: 0 -624px; width: 26px; height: 26px; } 
.msw-swa-155{ background-position: 0 -676px; width: 26px; height: 26px; } 
.msw-swa-160{ background-position: 0 -728px; width: 26px; height: 26px; } 
.msw-swa-165{ background-position: 0 -780px; width: 26px; height: 26px; } 
.msw-swa-170{ background-position: 0 -832px; width: 26px; height: 26px; } 
.msw-swa-175{ background-position: 0 -884px; width: 26px; height: 26px; } 
.msw-swa-180{ background-position: 0 -936px; width: 26px; height: 26px; } 
.msw-swa-185{ background-position: 0 -988px; width: 26px; height: 26px; } 
.msw-swa-190{ background-position: 0 -1040px; width: 26px; height: 26px; } 
.msw-swa-195{ background-position: 0 -1092px; width: 26px; height: 26px; } 
.msw-swa-20{ background-position: 0 -1144px; width: 26px; height: 26px; } 
.msw-swa-200{ background-position: 0 -1196px; width: 26px; height: 26px; } 
.msw-swa-205{ background-position: 0 -1248px; width: 26px; height: 26px; } 
.msw-swa-210{ background-position: 0 -1300px; width: 26px; height: 26px; } 
.msw-swa-215{ background-position: 0 -1352px; width: 26px; height: 26px; } 
.msw-swa-220{ background-position: 0 -1404px; width: 26px; height: 26px; } 
.msw-swa-225{ background-position: 0 -1456px; width: 26px; height: 26px; } 
.msw-swa-230{ background-position: 0 -1508px; width: 26px; height: 26px; } 
.msw-swa-235{ background-position: 0 -1560px; width: 26px; height: 26px; } 
.msw-swa-240{ background-position: 0 -1612px; width: 26px; height: 26px; } 
.msw-swa-245{ background-position: 0 -1664px; width: 26px; height: 26px; } 
.msw-swa-25{ background-position: 0 -1716px; width: 26px; height: 26px; } 
.msw-swa-250{ background-position: 0 -1768px; width: 26px; height: 26px; } 
.msw-swa-255{ background-position: 0 -1820px; width: 26px; height: 26px; } 
.msw-swa-260{ background-position: 0 -1872px; width: 26px; height: 26px; } 
.msw-swa-265{ background-position: 0 -1924px; width: 26px; height: 26px; } 
.msw-swa-270{ background-position: -52px 0; width: 26px; height: 26px; } 
.msw-swa-275{ background-position: -52px -52px; width: 26px; height: 26px; } 
.msw-swa-280{ background-position: -52px -104px; width: 26px; height: 26px; } 
.msw-swa-285{ background-position: -52px -156px; width: 26px; height: 26px; } 
.msw-swa-290{ background-position: -52px -208px; width: 26px; height: 26px; } 
.msw-swa-295{ background-position: -52px -260px; width: 26px; height: 26px; } 
.msw-swa-30{ background-position: -52px -312px; width: 26px; height: 26px; } 
.msw-swa-300{ background-position: -52px -364px; width: 26px; height: 26px; } 
.msw-swa-305{ background-position: -52px -416px; width: 26px; height: 26px; } 
.msw-swa-310{ background-position: -52px -468px; width: 26px; height: 26px; } 
.msw-swa-315{ background-position: -52px -520px; width: 26px; height: 26px; } 
.msw-swa-320{ background-position: -52px -572px; width: 26px; height: 26px; } 
.msw-swa-325{ background-position: -52px -624px; width: 26px; height: 26px; } 
.msw-swa-330{ background-position: -52px -676px; width: 26px; height: 26px; } 
.msw-swa-335{ background-position: -52px -728px; width: 26px; height: 26px; } 
.msw-swa-340{ background-position: -52px -780px; width: 26px; height: 26px; } 
.msw-swa-345{ background-position: -52px -832px; width: 26px; height: 26px; } 
.msw-swa-35{ background-position: -52px -884px; width: 26px; height: 26px; } 
.msw-swa-350{ background-position: -52px -936px; width: 26px; height: 26px; } 
.msw-swa-355{ background-position: -52px -988px; width: 26px; height: 26px; } 
.msw-swa-360{ background-position: -52px -1040px; width: 26px; height: 26px; } 
.msw-swa-40{ background-position: -52px -1092px; width: 26px; height: 26px; } 
.msw-swa-45{ background-position: -52px -1144px; width: 26px; height: 26px; } 
.msw-swa-5{ background-position: -52px -1196px; width: 26px; height: 26px; } 
.msw-swa-50{ background-position: -52px -1248px; width: 26px; height: 26px; } 
.msw-swa-55{ background-position: -52px -1300px; width: 26px; height: 26px; } 
.msw-swa-60{ background-position: -52px -1352px; width: 26px; height: 26px; } 
.msw-swa-65{ background-position: -52px -1404px; width: 26px; height: 26px; } 
.msw-swa-70{ background-position: -52px -1456px; width: 26px; height: 26px; } 
.msw-swa-75{ background-position: -52px -1508px; width: 26px; height: 26px; } 
.msw-swa-80{ background-position: -52px -1560px; width: 26px; height: 26px; } 
.msw-swa-85{ background-position: -52px -1612px; width: 26px; height: 26px; } 
.msw-swa-90{ background-position: -52px -1664px; width: 26px; height: 26px; } 
.msw-swa-95{ background-position: -52px -1716px; width: 26px; height: 26px; }

.msw-ssa,
.msw-swa /* Wind arrows */
{
    display:            inline-block;
    width:              26px;
    height:             26px;
    background:         url("${path}/wa-sprite.png") no-repeat top left;
}
.msw-ssa-10{ background-position: 0 0; width: 26px; height: 26px; } 
.msw-ssa-100{ background-position: 0 -52px; width: 26px; height: 26px; } 
.msw-ssa-105{ background-position: 0 -104px; width: 26px; height: 26px; } 
.msw-ssa-110{ background-position: 0 -156px; width: 26px; height: 26px; } 
.msw-ssa-115{ background-position: 0 -208px; width: 26px; height: 26px; } 
.msw-ssa-120{ background-position: 0 -260px; width: 26px; height: 26px; } 
.msw-ssa-125{ background-position: 0 -312px; width: 26px; height: 26px; } 
.msw-ssa-130{ background-position: 0 -364px; width: 26px; height: 26px; } 
.msw-ssa-135{ background-position: 0 -416px; width: 26px; height: 26px; } 
.msw-ssa-140{ background-position: 0 -468px; width: 26px; height: 26px; } 
.msw-ssa-145{ background-position: 0 -520px; width: 26px; height: 26px; } 
.msw-ssa-15{ background-position: 0 -572px; width: 26px; height: 26px; } 
.msw-ssa-150{ background-position: 0 -624px; width: 26px; height: 26px; } 
.msw-ssa-155{ background-position: 0 -676px; width: 26px; height: 26px; } 
.msw-ssa-160{ background-position: 0 -728px; width: 26px; height: 26px; } 
.msw-ssa-165{ background-position: 0 -780px; width: 26px; height: 26px; } 
.msw-ssa-170{ background-position: 0 -832px; width: 26px; height: 26px; } 
.msw-ssa-175{ background-position: 0 -884px; width: 26px; height: 26px; } 
.msw-ssa-180{ background-position: 0 -936px; width: 26px; height: 26px; } 
.msw-ssa-185{ background-position: 0 -988px; width: 26px; height: 26px; } 
.msw-ssa-190{ background-position: 0 -1040px; width: 26px; height: 26px; } 
.msw-ssa-195{ background-position: 0 -1092px; width: 26px; height: 26px; } 
.msw-ssa-20{ background-position: 0 -1144px; width: 26px; height: 26px; } 
.msw-ssa-200{ background-position: 0 -1196px; width: 26px; height: 26px; } 
.msw-ssa-205{ background-position: 0 -1248px; width: 26px; height: 26px; } 
.msw-ssa-210{ background-position: 0 -1300px; width: 26px; height: 26px; } 
.msw-ssa-215{ background-position: 0 -1352px; width: 26px; height: 26px; } 
.msw-ssa-220{ background-position: 0 -1404px; width: 26px; height: 26px; } 
.msw-ssa-225{ background-position: 0 -1456px; width: 26px; height: 26px; } 
.msw-ssa-230{ background-position: 0 -1508px; width: 26px; height: 26px; } 
.msw-ssa-235{ background-position: 0 -1560px; width: 26px; height: 26px; } 
.msw-ssa-240{ background-position: 0 -1612px; width: 26px; height: 26px; } 
.msw-ssa-245{ background-position: 0 -1664px; width: 26px; height: 26px; } 
.msw-ssa-25{ background-position: 0 -1716px; width: 26px; height: 26px; } 
.msw-ssa-250{ background-position: 0 -1768px; width: 26px; height: 26px; } 
.msw-ssa-255{ background-position: 0 -1820px; width: 26px; height: 26px; } 
.msw-ssa-260{ background-position: 0 -1872px; width: 26px; height: 26px; } 
.msw-ssa-265{ background-position: 0 -1924px; width: 26px; height: 26px; } 
.msw-ssa-270{ background-position: -52px 0; width: 26px; height: 26px; } 
.msw-ssa-275{ background-position: -52px -52px; width: 26px; height: 26px; } 
.msw-ssa-280{ background-position: -52px -104px; width: 26px; height: 26px; } 
.msw-ssa-285{ background-position: -52px -156px; width: 26px; height: 26px; } 
.msw-ssa-290{ background-position: -52px -208px; width: 26px; height: 26px; } 
.msw-ssa-295{ background-position: -52px -260px; width: 26px; height: 26px; } 
.msw-ssa-30{ background-position: -52px -312px; width: 26px; height: 26px; } 
.msw-ssa-300{ background-position: -52px -364px; width: 26px; height: 26px; } 
.msw-ssa-305{ background-position: -52px -416px; width: 26px; height: 26px; } 
.msw-ssa-310{ background-position: -52px -468px; width: 26px; height: 26px; } 
.msw-ssa-315{ background-position: -52px -520px; width: 26px; height: 26px; } 
.msw-ssa-320{ background-position: -52px -572px; width: 26px; height: 26px; } 
.msw-ssa-325{ background-position: -52px -624px; width: 26px; height: 26px; } 
.msw-ssa-330{ background-position: -52px -676px; width: 26px; height: 26px; } 
.msw-ssa-335{ background-position: -52px -728px; width: 26px; height: 26px; } 
.msw-ssa-340{ background-position: -52px -780px; width: 26px; height: 26px; } 
.msw-ssa-345{ background-position: -52px -832px; width: 26px; height: 26px; } 
.msw-ssa-35{ background-position: -52px -884px; width: 26px; height: 26px; } 
.msw-ssa-350{ background-position: -52px -936px; width: 26px; height: 26px; } 
.msw-ssa-355{ background-position: -52px -988px; width: 26px; height: 26px; } 
.msw-ssa-40{ background-position: -52px -1040px; width: 26px; height: 26px; } 
.msw-ssa-45{ background-position: -52px -1092px; width: 26px; height: 26px; } 
.msw-ssa-5{ background-position: -52px -1144px; width: 26px; height: 26px; } 
.msw-ssa-50{ background-position: -52px -1196px; width: 26px; height: 26px; } 
.msw-ssa-55{ background-position: -52px -1248px; width: 26px; height: 26px; } 
.msw-ssa-60{ background-position: -52px -1300px; width: 26px; height: 26px; } 
.msw-ssa-65{ background-position: -52px -1352px; width: 26px; height: 26px; } 
.msw-ssa-70{ background-position: -52px -1404px; width: 26px; height: 26px; } 
.msw-ssa-75{ background-position: -52px -1456px; width: 26px; height: 26px; } 
.msw-ssa-80{ background-position: -52px -1508px; width: 26px; height: 26px; } 
.msw-ssa-85{ background-position: -52px -1560px; width: 26px; height: 26px; } 
.msw-ssa-90{ background-position: -52px -1612px; width: 26px; height: 26px; } 
.msw-ssa-95{ background-position: -52px -1664px; width: 26px; height: 26px; }

.list-group-content {
    display: inline-block;
    vertical-align: middle;
}

.inline-block {
    display: inline-block;
    *display: inline;
    zoom: 1;
}

.svg {
    display: none
}

.svg-icon-container {
    display: inline-block;
    vertical-align: middle;
    margin-left: 5px
}

.svg {
    display: none!important
}

.svg-icon {
    display: inline-block;
    vertical-align: middle
}



.svg-wind-icon {
    width: 20px;
    height: 27px;
    background-size: auto 100%;
    background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHg9IjBweCIgeT0iMHB4IiB3aWR0aD0iMjguODc0cHgiIGhlaWdodD0iMTkuOTAxcHgiIHZpZXdCb3g9IjAgMCAyOC44NzQgMTkuOTAxIiBlbmFibGUtYmFja2dyb3VuZD0ibmV3IDAgMCAyOC44NzQgMTkuOTAxIiB4bWw6c3BhY2U9InByZXNlcnZlIj48cGF0aCBkPSJNNy42MTYgOS43NTVjMCAwIDAuMjA3LTIuMjI3IDAuNjQ1LTQuNjY3QzguNDY4IDMuOSA5IDAgOSAwSDYuNTkxSDQuMTQ4YzAgMCAwLjYgMy45IDAuOCA1LjEgQzUuMzYgNy41IDUuNiA5LjggNS42IDkuNzU1TDAgNy40MzlsNi41OTEgMTIuMzM0bDYuNTkxLTEyLjMzNEw3LjYxNiA5Ljc1NXoiLz48cGF0aCBmaWxsPSIjRkZGRkZGIiBkPSJNMjMuMTg4IDkuNzU1YzAgMCAwLjIwNy0yLjIyNyAwLjY0NS00LjY2N0MyNC4wNCAzLjkgMjQuNiAwIDI0LjYgMGgtMi40NDNoLTIuNDQzIGMwIDAgMC42IDMuOSAwLjggNS4wODhjMC40MzggMi40IDAuNiA0LjcgMC42IDQuNjY3bC01LjU2Ny0yLjMxNmw2LjU5MSAxMi4zMzRsNi41OTEtMTIuMzM0TDIzLjE4OCA5Ljc1NXoiLz48L3N2Zz4=")
}

.svg-wind-icon.svg-icon-white {
    background-position: 100% 0
}

.svg-wind-icon.svg-icon-sm {
    width: 13px;
    height: 20px
}

.svg-wind-icon-dark {
    width: 27px;
    height: 27px;
    background-size: 100%;
    background-image: url("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4iICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPjxzdmcgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIgd2lkdGg9IjMwcHgiIGhlaWdodD0iMzBweCIgdmlld0JveD0iMCAwIDMwIDMwIiBlbmFibGUtYmFja2dyb3VuZD0ibmV3IDAgMCAzMCAzMCIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PGcgaWQ9IkxheWVyXzIiPjxjaXJjbGUgZmlsbD0ibm9uZSIgY3g9IjE1IiBjeT0iMTUiIHI9IjE1Ii8+PC9nPjxnIGlkPSJMYXllcl8xIj48cGF0aCBmaWxsPSIjMUExQTFBIiBkPSJNMTYuNTU0LDE1LjA0MWMwLDAsMC4zMDktMy4zMjUsMC45NjMtNi45NjhjMC4zMDktMS43MTUsMS4xNTQtNy41OTcsMS4xNTQtNy41OTdoLTMuNjQ3aC0zLjY0NmMwLDAsMC44NDYsNS44ODIsMS4xNTQsNy41OTdjMC42NTQsMy42NDMsMC45NjMsNi45NjgsMC45NjMsNi45NjhsLTguMzEyLTMuNDU3TDE1LjAyMywzMGw5Ljg0Mi0xOC40MTZMMTYuNTU0LDE1LjA0MXoiLz48L2c+PC9zdmc+")
}

.svg-wind-icon-danger {
    width: 27px;
    height: 27px;
    background-position: top;
    background-image: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB3aWR0aD0iMzBweCIgaGVpZ2h0PSIzMHB4IiB2aWV3Qm94PSIwIDAgMzAgMzAiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDMwIDMwOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3Qwe2ZpbGw6bm9uZTt9LnN0MXtmaWxsOiNFNzRDM0M7fTwvc3R5bGU+PGcgaWQ9IkxheWVyXzIiPjxjaXJjbGUgY2xhc3M9InN0MCIgY3g9IjE1IiBjeT0iMTUiIHI9IjE1Ii8+PC9nPjxnIGlkPSJMYXllcl8xXzFfIj48cGF0aCBjbGFzcz0ic3QxIiBkPSJNMTYuNiwxNWMwLDAsMC4zLTMuMywxLTdjMC4zLTEuNywxLjItNy42LDEuMi03LjZIMTVoLTMuNmMwLDAsMC44LDUuOSwxLjIsNy42YzAuNywzLjYsMSw3LDEsN2wtOC4zLTMuNUwxNSwzMGw5LjgtMTguNEwxNi42LDE1eiIvPjwvZz48L3N2Zz4=)
}

.svg-wind-icon-gray {
    width: 27px;
    height: 27px;
    background-position: top;
    background-image: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgNC41IDcuMSIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgNC41IDcuMTsiIHhtbDpzcGFjZT0icHJlc2VydmUiPjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+LnN0MHtmaWxsOiM1NTU1NTU7fTwvc3R5bGU+PHBhdGggY2xhc3M9InN0MCIgZD0iTTQuNCwzSDNWMEgxLjZ2M0gwLjJDMCwzLDAsMy4yLDAsMy4zTDIuMSw3YzAuMSwwLjEsMC4zLDAuMSwwLjMsMGwyLjEtMy42QzQuNiwzLjIsNC41LDMsNC40LDN6Ii8+PC9zdmc+)
}

.svg-wind-icon-light {
    width: 30px;
    height: 30px;
    background-image: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgMjgzLjUgMjgzLjUiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDI4My41IDI4My41OyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3Qwe2ZpbGw6I0ZGRkZGRjt9PC9zdHlsZT48cGF0aCBjbGFzcz0ic3QwIiBkPSJNMTU1LjMsMTQyLjFjMCwwLDIuMi0yMy43LDYuOS00OS42YzIuMi0xMi4yLDguMi01NC4xLDguMi01NC4xaC0yNmgtMjZjMCwwLDYsNDEuOSw4LjIsNTQuMWM0LjcsMjUuOSw2LjksNDkuNiw2LjksNDkuNmwtNTkuMi0yNC42bDcwLjEsMTMxLjJsNzAuMS0xMzEuMkwxNTUuMywxNDIuMXoiLz48L3N2Zz4=)
}

// ----
.svg-swell-icon {
    width: 21px;
    height: 21px
}
.svg-swell-icon {
    text-indent: -9999px
}

.svg-swell-icon,.svg .svg-wind-icon {
    background-repeat: no-repeat;
    background-position: 0 0;
    display: inline-block;
    text-align: center
}

.svg-swell-icon {
    width: 17px;
    height: 23px;
    background-size: auto 100%;
    background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHg9IjBweCIgeT0iMHB4IiB3aWR0aD0iNDMuOTU4cHgiIGhlaWdodD0iMTkuOTAxcHgiIHZpZXdCb3g9IjAgMCA0My45NTggMTkuOTAxIiBlbmFibGUtYmFja2dyb3VuZD0ibmV3IDAgMCA0My45NTggMTkuOTAxIiB4bWw6c3BhY2U9InByZXNlcnZlIj48c3R5bGU+LnN0eWxlMHtmaWxsOgkjRkZGRkZGO30uc3R5bGUxe2ZpbGw6CSMzQ0JCRTg7fTwvc3R5bGU+PHBvbHlnb24gcG9pbnRzPSI2LjIsMTkuOSAxMi40LDAuNCA2LjIsNCAwLDAuNCIvPjxwb2x5Z29uIHBvaW50cz0iMjIsMTkuOSAyOC4yLDAuNCAyMiw0IDE1LjgsMC40IiBjbGFzcz0ic3R5bGUwIi8+PHBvbHlnb24gcG9pbnRzPSIzNy44LDE5LjkgNDQsMC40IDM3LjgsNCAzMS42LDAuNCIgY2xhc3M9InN0eWxlMSIvPjwvc3ZnPg==")
}

.svg-swell-icon.svg-icon-white {
    background-position: 60% 0
}

.svg-swell-icon-dark {
    width: 23px;
    height: 23px;
    background-size: 100%;
    background-position: 0 0;
    background-image: url("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4iICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiIHdpZHRoPSI1MHB4IiBoZWlnaHQ9IjUwcHgiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZW5hYmxlLWJhY2tncm91bmQ9Im5ldyAwIDAgNTAgNTAiIHhtbDpzcGFjZT0icHJlc2VydmUiPjxnIGlkPSJMYXllcl8yIj48Y2lyY2xlIGZpbGwtb3BhY2l0eT0iMCIgY3g9IjI0Ljk5IiBjeT0iMjQuOTQ2IiByPSIyNC45NDYiLz48L2c+PGcgaWQ9IkxheWVyXzFfMV8iPjxwb2x5Z29uIGZpbGw9IiMxQTFBMUEiIHBvaW50cz0iMzkuOTYxLDUuMDA4IDI0Ljk2OSw0OS44OTMgMTAuMDM3LDUuMDA4IDI1LjAzOCwxMS4yNDIgIi8+PC9nPjwvc3ZnPg==")
}
`;
};

const cwcClimacellDayIcons = {
    freezing_rain_heavy: "rainy-3",
    "heavy freezing rain": "rainy-3",
    freezing_rain: "rainy-2",
    "freezing rain": "rainy-2",
    freezing_rain_light: "rainy-1",
    "light freezing rain": "rainy-1",
    freezing_drizzle: "rain-and-sleet-mix",
    "freezing drizzle": "rain-and-sleet-mix",
    ice_pellets_heavy: "rain-and-snow-mix",
    "heavy ice pellets": "rain-and-snow-mix",
    ice_pellets: "rain-and-snow-mix",
    "ice pellets": "rain-and-snow-mix",
    ice_pellets_light: "rain-and-snow-mix",
    "light ice pellets": "rain-and-snow-mix",
    snow_heavy: "snowy-3",
    "heavy snow": "snowy-3",
    snow: "snowy-2",
    snow_light: "snowy-1",
    "light snow": "snowy-1",
    flurries: "wind",
    tstorm: "tropical-storm",
    rain_heavy: "rainy-3",
    "heavy rain": "rainy-3",
    rain_light: "rainy-1",
    "light rain": "rainy-1",
    rain: "rainy-2",
    drizzle: "rainy-1",
    fog_light: "haze",
    "light fog": "haze",
    fog: "fog",
    cloudy: "cloudy-original",
    mostly_cloudy: "cloudy-day-3",
    "mostly cloudy": "cloudy-day-3",
    partly_cloudy: "cloudy-day-2",
    "partly cloudy": "cloudy-day-2",
    mostly_clear: "cloudy-day-1",
    "mostly clear": "cloudy-day-1",
    clear: "day",
};
const cwcClimacellNightIcons = Object.assign(Object.assign({}, cwcClimacellDayIcons), { freezing_rain_heavy: "rainy-6", "heavy freezing rain": "rainy-6", freezing_rain: "rainy-5", "freezing rain": "rainy-5", freezing_rain_light: "rainy-4", "light freezing rain": "rainy-4", 
    // freezing_drizzle: "rain-and-sleet-mix",
    // ice_pellets_heavy: "rain-and-snow-mix",
    // ice_pellets: "rain-and-snow-mix",
    // ice_pellets_light: "rain-and-snow-mix",
    snow_heavy: "snowy-6", "heavy snow": "snowy-6", snow: "snowy-5", snow_light: "snowy-4", "light snow": "snowy-4", 
    // flurries: "wind",
    // tstorm: "tropical-storm",
    rain_heavy: "rainy-6", "heavy rain": "rainy-6", rain_light: "rainy-4", "light rain": "rainy-4", rain: "rainy-5", drizzle: "rainy-4", 
    // fog_light: "haze",
    // fog: "fog",
    // cloudy: "cloudy",
    mostly_cloudy: "cloudy-night-3", "mostly cloudy": "cloudy-night-3", partly_cloudy: "cloudy-night-2", "partly cloudy": "cloudy-night-2", mostly_clear: "cloudy-night-1", "mostly clear": "cloudy-night-1", clear: "night", sunny: "night" });

const cwcDarkskyDayIcons = {
    "clear": "day",
    "clear-day": "day",
    "rain": "rainy-2",
    "snow": "snowy-2",
    "sleet": "rain-and-sleet-mix",
    "wind": "cloudy-day-1",
    "fog": "fog",
    "cloudy": "cloudy-original",
    "partly-cloudy-day": "cloudy-day-2",
};
const cwcDarkskyNightIcons = Object.assign(Object.assign({}, cwcDarkskyDayIcons), { "clear": "night", "clear-night": "night", "wind": "cloudy-night-1", "partly-cloudy-day": "cloudy-night-2", "partly-cloudy-night": "cloudy-night-2" });

const cwcOpenWeatherMapDayIcons = {
    "clear sky": "day",
    "few clouds": "cloudy-day-1",
    "scattered clouds": "cloudy-day-2",
    "broken clouds": "cloudy-day-3",
    "shower rain": "rainy-3",
    "rain": "rainy-2",
    "thunderstorm": "tropical-storm",
    "snow": "snowy-2",
    "mist": "fog",
};
const cwcOpenWeatherMapNightIcons = Object.assign(Object.assign({}, cwcOpenWeatherMapDayIcons), { "clear sky": "day-night", "few clouds": "cloudy-night-1", "scattered clouds": "cloudy-night-2", "broken clouds": "cloudy-night-3" });

//clear=ok, partlycloudy=ok, cloudy=ok, partlycloudy-fog=ok, partlycloudy-light-rain=ok, partlycloudy-rain=ok,
// light-rain=ok, rainy=ok, snowy-rainy=ok, partlycloudy-light-snow=ok, partlycloudy-snow=ok, light-snow=ok, snowy=ok,
// partlycloudy-lightning=ok or lightning
const cwcBuienradarDayIcons = {
    // freezing_rain_heavy: "rainy-3",
    // freezing_rain: "rainy-2",
    // freezing_rain_light: "rainy-1",
    // freezing_drizzle: "rain-and-sleet-mix",
    // ice_pellets_heavy: "rain-and-snow-mix",
    // ice_pellets: "rain-and-snow-mix",
    // ice_pellets_light: "rain-and-snow-mix",
    snowy: "snowy-3",
    "light-snow": "snowy-2",
    "snowy-rainy": "snowy-1",
    "partlycloudy-light-snow": "snowy-1",
    "partlycloudy-snow": "snowy-1",
    // flurries: "wind",
    // tstorm: "tropical-storm",
    // rain_heavy: "rainy-3",
    "partlycloudy-light-rain": "rainy-1",
    "light-rain": "rainy-1",
    "rainy": "rainy-2",
    "partlycloudy-rain": "rainy-1",
    // fog_light: "haze",
    "partlycloudy-fog": "fog",
    cloudy: "cloudy-original",
    // mostly_cloudy: "cloudy-day-3",
    partlycloudy: "cloudy-day-2",
    "partlycloudy-lightning": "cloudy-day-1",
    lightning: "cloudy-day-1",
    // mostly_clear: "cloudy-day-1",
    clear: "day",
};
const cwcBuienradarNightIcons = Object.assign({}, cwcBuienradarDayIcons);

const cwcDefaultHassDayIcons = {
    cloudy: "cloudy-day-3",
    exceptional: "severe-thunderstorm",
    fog: "fog",
    hail: "snow-and-sleet-mix",
    lightning: "severe-thunderstorm",
    "lightning-rainy": "scattered-thunderstorms",
    partlycloudy: "cloudy-day-3",
    pouring: "rainy-6",
    rainy: "rainy-5",
    snowy: "snowy-6",
    "snowy-rainy": "snow-and-sleet-mix",
    sunny: "clear-day",
    windy: "wind",
    "windy-variant": "wind",
};
const cwcDefaultHassNightIcons = Object.assign(Object.assign({}, cwcDefaultHassDayIcons), { "clear-night": "clear-night" });

let cwcLocale = { en: 0, it: 1, nl: 2, es: 3, de: 4, fr: 5, "sr-latn": 6, pt: 7, da: 8, "no-no": 9 };
// export let cwcLocWindDirections = {
//   'N': ['N', 'N', 'N', 'N', 'N', 'N', 'S'],
//   'NNE': ['NNE', 'NNE', 'NNO', 'NNE', 'NNO', 'NNE', 'SSI'],
//   'NE': ['NE', 'NE', 'NO', 'NE', 'NO', 'NE', 'SI'],
//   'ENE': ['ENE', 'ENE', 'ONO', 'ENE', 'ONO', 'ENE', 'ISI'],
//   'E': ['E', 'E', 'O', 'E', 'O', 'E', 'I'],
//   'ESE': ['ESE', 'ESE', 'OZO', 'ESE', 'OSO', 'ESE', 'IJI'],
//   'SE': ['SE', 'SE', 'ZO', 'SE', 'SO', 'SE', 'JI'],
//   'SSE': ['SSE', 'SSE', 'ZZO', 'SSE', 'SSO', 'SSE', 'JJI'],
//   'S': ['S', 'S', 'Z', 'S', 'S', 'S', 'J'],
//   'SSW': ['SSW', 'SSO', 'ZZW', 'SSO', 'SSW', 'SSO', 'JJZ'],
//   'SW': ['SW', 'SO', 'ZW', 'SO', 'SW', 'SO', 'JZ'],
//   'WSW': ['WSW', 'OSO', 'WZW', 'OSO', 'WSW', 'OSO', 'ZSZ'],
//   'W': ['W', 'O', 'W', 'O', 'W', 'O', 'Z'],
//   'WNW': ['WNW', 'ONO', 'WNW', 'ONO', 'WNW', 'ONO', 'ZSZ'],
//   'NW': ['NW', 'NO', 'NW', 'NO', 'NW', 'NO', 'SZ'],
//   'NNW': ['NNW', 'NNO', 'NNW', 'NNO', 'NNW', 'NNO', 'SSZ'],
// };
// export let cwcTerms = {
//   'Feels Like' : ['Feels Like', 'Percepita', 'Voelt Als', 'Parece que', 'Gef&uuml;hlt',
//     'Ressentie', 'Subjektivni osećaj'],
//   'new_moon': [ 'New moon', 'Novilunio', 'Nieuwe maan', 'Luna nueva', 'Neumond',
//     'Nouvelle lune', 'Mlad mesec'],
//   'new': [ 'New moon', 'Novilunio', 'Nieuwe maan', 'Luna nueva', 'Neumond',
//     'Nouvelle lune', 'Mlad mesec'],
//   'waxing_crescent': ['Waxing crescent', 'Luna crescente', 'Wassende sikkel', 'Media luna de cera', 'Zunehmende Sichel',
//     'Premier croissant', 'Prva osmina'],
//   'first_quarter': ['First quarter', 'Primo Quarto', 'Eerste kwartaal', 'Primer trimestre', 'Erstes Viertel',
//     'Premier quartier', 'Prva četvrt'],
//   'waxing_gibbous': ['Waxing Gibbous', 'Gibbosa crescente', 'Wassen Gibbous', 'Encerado Gibbous', 'Zunehmender Halbmond',
//     'Gibbeuse croissante', 'Treća osmina'],
//   'full': ['Full', 'Luna piena', 'Volledig', 'Completo', 'Vollmond',
//     'Pleine lune', 'Pun mesec'],
//   'waning_gibbous': ['Waning Gibbous', 'Gibbosa calante', 'Zwemmende Gibbous', 'Waning Gibbous', 'Abnehmender Halbmond',
//     'Gibbeuse décroissante', 'Peta osmina'],
//   'third_quarter': ['Third Quarter', 'Ultimo quarto', 'Derde Kwartier', 'Tercer cuarto', 'Drittes Viertel',
//     'Dernier quartier', 'Treća četvrtina'],
//   'last_quarter': ['Last Quarter', 'Ultimo quarto', 'Laatste Kwartier', 'Último cuarto', 'Letztes Viertel',
//     'Dernier quartier', 'Zadnja četvrtina'],
//   'waning_crescent': ['Waning Crescent', 'Luna calante', 'Zwemmende sikkel', 'Waning Crescent', 'Abnehmende Sichel',
//     'Lune décroissante', 'Sedma osmina'],
// } ;
// 🌑 🌒 🌓 🌔 🌕 🌖 🌗 🌘 🌑
let cwcMoonPhaseIcons = {
    new_moon: "🌑",
    new: "🌑",
    waxing_crescent: "🌒",
    first_quarter: "🌓",
    waxing_gibbous: "🌔",
    full: "🌕",
    full_moon: "🌕",
    waning_gibbous: "🌖",
    third_quarter: "🌗",
    last_quarter: "🌗",
    waning_crescent: "🌘"
};

function pad(n, width, z = undefined) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}
/**
 *
 * @param imageSrc
 */
function imageExist(imageSrc) {
    return new Promise((resolve) => {
        setTimeout(() => {
            let img = new Image();
            img.onload = () => { resolve(true); };
            img.onerror = () => { resolve(false); };
            img.src = imageSrc;
        }, 100);
    });
}
/**
 *
 * @param term
 * @param terms
 */
const translate = (term, terms) => {
    // console.info(">>>>loc:" + lang + "" + cwcLocale[lang] ) ;
    return terms[Object.keys(terms).find(key => key.toLowerCase() === term.toLowerCase())]
        ? terms[Object.keys(terms).find(key => key.toLowerCase() === term.toLowerCase())]
        : term;
};
/**
 *
 * @param condition
 * @param iconsConfig
 * @param sunState
 */
const getWeatherIcon = (condition, iconsConfig, _sunState) => {
    return `${iconsConfig.path}/meteo.lt/${condition}.svg`;
};
/**
 *
 * @param measure
 * @param hass
 */
const getUnit = (hass, measure) => {
    const lengthUnit = hass.config.unit_system.length;
    switch (measure) {
        case "air_pressure":
            return lengthUnit === "km" ? "hPa" : "inHg";
        case "length":
            return lengthUnit;
        case "precipitation":
            return lengthUnit === "km" ? "mm" : "in";
        default:
            return hass.config.unit_system[measure] || "";
    }
};
const getWindDirections = (wd, cwcLocWindDirections) => {
    if (wd < 0 || wd > 360) {
        console.log("Enter a degree between 0 and 360 degrees.");
        return null;
    }
    if (wd >= 0 && wd <= 11.25)
        return cwcLocWindDirections['N'];
    if (wd > 348.75 && wd <= 360)
        return cwcLocWindDirections['N'];
    if (wd > 11.25 && wd <= 33.75)
        return cwcLocWindDirections['NNE'];
    if (wd > 33.75 && wd <= 56.25)
        return cwcLocWindDirections['NE'];
    if (wd > 56.25 && wd <= 78.75)
        return cwcLocWindDirections['ENE'];
    if (wd > 78.75 && wd <= 101.25)
        return cwcLocWindDirections['E'];
    if (wd > 101.25 && wd <= 123.75)
        return cwcLocWindDirections['ESE'];
    if (wd > 123.75 && wd <= 146.25)
        return cwcLocWindDirections['SE'];
    if (wd > 146.25 && wd <= 168.75)
        return cwcLocWindDirections['SSE'];
    if (wd > 168.75 && wd <= 191.25)
        return cwcLocWindDirections['S'];
    if (wd > 191.25 && wd <= 213.75)
        return cwcLocWindDirections['SSW'];
    if (wd > 213.75 && wd <= 236.25)
        return cwcLocWindDirections['SW'];
    if (wd > 236.25 && wd <= 258.75)
        return cwcLocWindDirections['WSW'];
    if (wd > 258.75 && wd <= 281.25)
        return cwcLocWindDirections['W'];
    if (wd > 281.25 && wd <= 303.75)
        return cwcLocWindDirections['WNW'];
    if (wd > 303.75 && wd <= 326.25)
        return cwcLocWindDirections['NW'];
    if (wd > 326.25 && wd <= 348.75)
        return cwcLocWindDirections['NNW'];
    return null;
};
function getMoonIcon(phase) {
    return (cwcMoonPhaseIcons[phase.toLowerCase()]);
}
function loadJSON(full_path_file) {
    return new Promise((resolve) => {
        setTimeout(() => {
            let xobj = new XMLHttpRequest();
            xobj.overrideMimeType("application/json");
            xobj.open('GET', full_path_file, true);
            // Replace 'my_data' with the path to your file
            xobj.onreadystatechange = () => {
                if (xobj.readyState === 4 && xobj.status === 200) {
                    // Required use of an anonymous callback
                    // as .open() will NOT return a value but simply returns undefined in asynchronous mode
                    resolve(xobj.responseText);
                }
                else if (xobj.status !== 200) {
                    let err = "ERROR during json file retrieve: '" + full_path_file
                        + "', readyState: " + xobj.readyState
                        + ", status: " + xobj.status
                        + ", statusText: " + xobj.statusText
                        + ", responseText: " + xobj.responseText;
                    console.info(err);
                }
            };
            xobj.send(null);
        }, 100);
    });
}
function numFormat(stringNumber, fractionDigits = 1) {
    switch (fractionDigits) {
        case 0:
            return numberFormat_0dec.format(parseFloat(stringNumber));
        case 1:
            return numberFormat_1dec.format(parseFloat(stringNumber));
    }
    // return parseFloat(stringNumber).toFixed(fractionDigits) ;
}
// export function circadianRhythm( hass: HomeAssistant, sunId: string ) {
//   let lightRatio;
//   // let nextUpdate;
//
//   let sun = hass.states[sunId] ;
//
//   const now = (new Date()).getTime();
//
//   let times = {
//     sunrise: (new Date(sun.attributes.next_dawn)).getTime(),
//     sunriseEnd: (new Date(sun.attributes.next_rising)).getTime(),
//
//     sunsetStart: (new Date(sun.attributes.next_setting)).getTime(),
//     sunset: (new Date(sun.attributes.next_dusk)).getTime(),
//   };
//
//   console.info( JSON.stringify(times));
//   if (now > times.sunrise && now < times.sunriseEnd) {
//     lightRatio = (now - times.sunrise) / (times.sunriseEnd - times.sunrise);
//     // nextUpdate = now + UPDATE_FREQUENCY;
//   } else if(now > times.sunriseEnd && now < times.sunsetStart) {
//     lightRatio = 1;
//     // nextUpdate = times.sunsetStart;
//   } else if (now > times.sunsetStart && now < times.sunset) {
//     lightRatio = (times.sunset - now) / (times.sunset - times.sunsetStart);
//     // nextUpdate = now + UPDATE_FREQUENCY;
//   } else {
//     lightRatio = 0;
//     // nextUpdate = times.sunrise;
//   }
//
// // Range (in lux) from 0.0001 to 100000 in increments of 0.0001.
//   const lightLevel = Math.round(1 + lightRatio * 999999999) / 10000;
//
//   console.info( "lightLevel=" + lightLevel + " - lightRatio: " + lightRatio ) ;
//   return lightLevel ;
// }

/**
 *
 * @param hass
 * @param currentCfg
 * @param name
 * @param iconsConfig
 */
const renderSummary = (hass, currentCfg, name, iconsConfig, terms) => {
    let temperature, feels_like;
    let sun = currentCfg.sun && hass.states[currentCfg.sun] ? hass.states[currentCfg.sun].state : undefined;
    let moon = currentCfg.moon_phase && hass.states[currentCfg.moon_phase]
        ? hass.states[currentCfg.moon_phase].state : undefined;
    let moonIcon = moon ? getMoonIcon(moon) : undefined;
    let current_conditions = currentCfg.current_conditions && hass.states[currentCfg.current_conditions]
        ? hass.states[currentCfg.current_conditions].state : "Na";
    if (currentCfg.temperature && hass.states[currentCfg.temperature]) {
        // if(getUnit(hass, "temperature") == "°F")
        //   temperature = Math.round(parseFloat(hass.states[currentCfg.temperature].state)) ;
        // else temperature = numFormat(hass.states[currentCfg.temperature].state) ;
        temperature = numFormat(hass.states[currentCfg.temperature].state);
    }
    else {
        temperature = "Na";
    }
    if (currentCfg.feels_like && hass.states[currentCfg.feels_like]) {
        // if( hass.states[currentCfg.feels_like].attributes.unit_of_measurement == "F" )
        //   feels_like = Math.round(parseFloat(hass.states[currentCfg.feels_like].state)) ;
        // else feels_like = parseFloat(hass.states[currentCfg.feels_like].state) ;
        feels_like = numFormat(hass.states[currentCfg.feels_like].state);
    }
    else
        feels_like = "Na";
    return html `
      <div class="current">
        <span class="icon bigger" style="background: none,
            url('${getWeatherIcon(current_conditions.toLowerCase(), iconsConfig)}') no-repeat ; 
            background-size: contain;">${current_conditions}</span>
        ${name ? html `<span class="title"> ${name} </span>` : ""}
        ${moon ? html `<span class="moon"> ${moonIcon} <span style="font-size: 70%">${translate(moon, terms.words)}</span></spa>` : ""}
        ${temperature !== "Na" ? html `
          <span class="temp">${temperature}</span>
          <span class="tempc"> ${getUnit(hass, "temperature")}</span>
        ` : ""}
      </div>
      ${feels_like !== "Na" ? html `
        <ul class="variations polles" style="border: 0;margin-top: 4px;">
          <li><ha-icon icon="none"></ha-icon><span class="unit"></span></li>
          <li>
            <ha-icon icon="${hass.states[currentCfg.feels_like].attributes.icon}"></ha-icon>${translate('Feels Like', terms.words)} ${feels_like}
            <span class="unit"> ${getUnit(hass, "temperature")}</span>
          </li>
        </ul>      
      ` : ""}
   `;
};

/**
 *
 * @param entity_min
 * @param entity_unit_min
 * @param entity_max
 * @param entity_unit_max
 * @param icon
 * @private
 */
const _renderPresentDouble = (entity_min, entity_unit_min, entity_max, entity_unit_max, icon) => {
    return ((undefined !== entity_min) || (undefined !== entity_max) ? html `
    <li>
      <ha-icon icon="${icon}"></ha-icon>${undefined !== entity_min ? entity_min : "Na"} ${entity_unit_min} /
          <b>${undefined !== entity_max ? entity_max : "Na"} ${entity_unit_max}</b>
    </li>
  ` : "");
};
const _renderPresentSingle = (entity, entity_unit, icon) => {
    return (html `
    <li>
      <ha-icon icon="${icon}"></ha-icon>${undefined !== entity ? entity : "Na"} ${entity_unit}
    </li>
  `);
};
/**
 *
 * @param hass
 * @param currentCfg
 * @param forecastCfg
 * @param language
 * @param terms
 * @param border
 */
const renderPresent = (hass, currentCfg, forecastCfg, language, terms, border) => {
    let temperature_high, temperature_low, precipitation_probability, precipitation_intensity;
    let next_rising, next_setting;
    const lang = language || hass.selectedLanguage || hass.language;
    let sun = currentCfg.sun ? hass.states[currentCfg.sun] : undefined;
    if (sun) {
        next_rising = new Date(sun.attributes.next_rising);
        next_setting = new Date(sun.attributes.next_setting);
        //console.log( "now:" + (new Date()).toLocaleTimeString() + " next_rising:" + next_rising.toLocaleTimeString() ) ;
    }
    if (currentCfg.forecast) {
        let temp_high = forecastCfg.temperature_high
            ? Object.entries(forecastCfg.temperature_high) : undefined;
        let temp_low = forecastCfg.temperature_low
            ? Object.entries(forecastCfg.temperature_low) : undefined;
        let prec_probability = forecastCfg.precipitation_probability
            ? Object.entries(forecastCfg.precipitation_probability) : undefined;
        let prec_intensity = forecastCfg.precipitation_intensity
            ? Object.entries(forecastCfg.precipitation_intensity) : undefined;
        // @ts-ignore
        temperature_high = Object.isSet(temp_high) && Object.isSet(hass.states[temp_high[0][1]])
            ? numFormat(hass.states[temp_high[0][1]].state, 0) : undefined;
        // @ts-ignore
        temperature_low = Object.isSet(temp_low) && Object.isSet(hass.states[temp_low[0][1]])
            ? numFormat(hass.states[temp_low[0][1]].state, 0) : undefined;
        // @ts-ignore
        precipitation_probability = Object.isSet(prec_probability) && Object.isSet(hass.states[prec_probability[0][1]])
            ? numFormat(hass.states[prec_probability[0][1]].state, 0) : undefined;
        // @ts-ignore
        precipitation_intensity = Object.isSet(prec_intensity) && Object.isSet(hass.states[prec_intensity[0][1]])
            ? numFormat(hass.states[prec_intensity[0][1]].state, 0) : undefined;
    }
    // @ts-ignore
    let precipitation = Object.isSet(currentCfg.precipitation) && Object.isSet(hass.states[currentCfg.precipitation])
        ? numFormat(hass.states[currentCfg.precipitation].state, 0) : undefined;
    // @ts-ignore
    let humidity = Object.isSet(currentCfg.humidity) && Object.isSet(hass.states[currentCfg.humidity])
        ? numFormat(hass.states[currentCfg.humidity].state, 0) : undefined;
    // @ts-ignore
    let wind_bearing = Object.isSet(currentCfg.wind_bearing) && Object.isSet(hass.states[currentCfg.wind_bearing])
        ? numFormat(hass.states[currentCfg.wind_bearing].state) : undefined;
    // @ts-ignore
    let wind_speed = Object.isSet(currentCfg.wind_speed) && Object.isSet(hass.states[currentCfg.wind_speed])
        ? numFormat(hass.states[currentCfg.wind_speed].state) : undefined;
    // @ts-ignore
    let pressure = Object.isSet(currentCfg.pressure) && Object.isSet(hass.states[currentCfg.pressure])
        ? numFormat(hass.states[currentCfg.pressure].state, 0) : undefined;
    // @ts-ignore
    let visibility = Object.isSet(currentCfg.visibility) && Object.isSet(hass.states[currentCfg.visibility])
        ? numFormat(hass.states[currentCfg.visibility].state, 0) : undefined;
    return html `
    <ul class="variations ${border ? "spacer" : ""}">
        ${void 0 !== typeof precipitation_probability || void 0 !== typeof precipitation_intensity
        ? _renderPresentDouble(precipitation_probability, '%', precipitation_intensity, getUnit(hass, "precipitation") + '/h', 'mdi:weather-rainy') : ""}
        ${currentCfg.forecast && (undefined !== temperature_low || undefined !== temperature_high)
        ? _renderPresentDouble(temperature_low, '', temperature_high, getUnit(hass, "temperature"), 'mdi:thermometer') : ""}
        ${undefined !== precipitation && precipitation > 0 ? html `
          <li>
            <ha-icon icon="mdi:weather-rainy"></ha-icon>${precipitation}
            <span class="unit"> ${getUnit(hass, "precipitation")}/h</span>
          </li>
          <li><ha-icon icon="none"></ha-icon><span class="unit"></span></li>
        ` : ""}            
        ${undefined !== pressure ? _renderPresentSingle(pressure, getUnit(hass, "air_pressure"), 'mdi:gauge') : ""}
        ${undefined !== humidity ? _renderPresentSingle(humidity, '%', 'mdi:water-percent') : ""}
        ${undefined !== visibility ? _renderPresentSingle(visibility, getUnit(hass, "length"), 'mdi:weather-fog') : ""}
        ${(!!wind_speed) || (!!wind_bearing) ? html `
          <li>
            <ha-icon icon="mdi:weather-windy"></ha-icon> ${getWindDirections(wind_bearing, terms.windDirections)} ${wind_speed}
            <span class="unit">${getUnit(hass, "length")}/h</span>
          </li>
        ` : ""}        
        ${undefined !== next_rising ? _renderPresentSingle(next_rising.toLocaleTimeString(language), '', 'mdi:weather-sunset-up') : ""}               
        ${undefined !== next_setting ? _renderPresentSingle(next_setting.toLocaleTimeString(language), '', 'mdi:weather-sunset-down') : ""}           
    </ul>
  `;
};

/**
 *
 * @param entity_low
 * @param entity_unit_low
 * @param entity_high
 * @param entity_unit_high
 * @private
 */
const _renderForecast = (entity_low, entity_unit_low, entity_high, entity_unit_high) => {
    if (undefined == entity_low && undefined == entity_high) {
        return html ``;
    }
    else if (undefined == entity_low) {
        return html `
            <div class="highTemp">
              <b>${entity_high}</b> ${entity_unit_high}
            </div>   
      `;
    }
    else if (undefined == entity_high) {
        return html `
            <div class="lowTemp">
              ${entity_low} ${entity_unit_low}
            </div>  
      `;
    }
    else {
        return html `
            <div class="highTemp">
              ${entity_low} ${entity_unit_low} / <b>${entity_high} ${entity_unit_high}</b>
            </div>
      `;
    }
};
const renderForecasts = (hass, currentCfg, forecastCfg, iconsConfig, lang, border) => {
    let forecastDate = new Date();
    // @ts-ignore
    let sun = Object.isSet(currentCfg) && Object.isSet(currentCfg.sun) && Object.isSet(hass.states[currentCfg.sun])
        ? hass.states[currentCfg.sun].state : undefined;
    let icons = forecastCfg.icons
        ? Object.entries(forecastCfg.icons) : undefined;
    let temperature_high = forecastCfg.temperature_high
        ? Object.entries(forecastCfg.temperature_high) : undefined;
    let temperature_low = forecastCfg.temperature_low
        ? Object.entries(forecastCfg.temperature_low) : undefined;
    let precipitation_probability = forecastCfg.precipitation_probability
        ? Object.entries(forecastCfg.precipitation_probability) : undefined;
    let precipitation_intensity = forecastCfg.precipitation_intensity
        ? Object.entries(forecastCfg.precipitation_intensity) : undefined;
    let maxDays = Math.max(icons ? icons.length : 0, temperature_high ? temperature_high.length : 0, temperature_low ? temperature_low.length : 0, precipitation_probability ? precipitation_probability.length : 0, precipitation_intensity ? precipitation_intensity.length : 0);
    let startDay = 1;
    let days = maxDays > 0 ?
        Array(maxDays - startDay).fill(1, 0, maxDays - startDay).map(() => startDay++)
        : Array();
    return maxDays > 1 ? html `
      <div class="forecast clear ${border ? "spacer" : ""}">
        ${days.map(day => {
        let icon, day_temp_low, day_temp_high, day_prec_probab, day_prec_intensity;
        let date = new Date(forecastDate.setDate(forecastDate.getDate() + 1))
            .toLocaleDateString(lang, { weekday: "short" });
        if (icons && icons[day] && hass.states[icons[day][1]])
            icon = hass.states[icons[day][1]].state.toLowerCase();
        if (temperature_low && temperature_low[day] && hass.states[temperature_low[day][1]])
            day_temp_low = numFormat(hass.states[temperature_low[day][1]].state, 0);
        if (temperature_high && temperature_high[day] && hass.states[temperature_high[day][1]])
            day_temp_high = numFormat(hass.states[temperature_high[day][1]].state, 0);
        if (precipitation_probability && precipitation_probability[day] && hass.states[precipitation_probability[day][1]])
            day_prec_probab = numFormat(hass.states[precipitation_probability[day][1]].state, 0);
        if (precipitation_intensity && precipitation_intensity[day] && hass.states[precipitation_intensity[day][1]])
            day_prec_intensity = numFormat(hass.states[precipitation_intensity[day][1]].state, 0);
        return html `
          <div class="day ${day}">
              <div class="dayname">${date}</div>
              ${icon ? html `
              <i class="icon" style="background: none, url('${getWeatherIcon(icon, iconsConfig)}') no-repeat; 
                    background-size: contain"></i>                
              ` : ""}
              ${_renderForecast(day_temp_low, '', day_temp_high, getUnit(hass, "temperature"))} 
              ${_renderForecast(day_prec_probab, '%', day_prec_intensity, getUnit(hass, "precipitation") + '/h')}                       
          </div>
          `;
    })}
      </div>
    ` : html ``;
};

const _renderPollen = (hass, item) => {
    let entity = hass.states[item.entity];
    let icon = item.icon || entity.attributes.icon;
    let min = undefined !== item.min ? item.min : 0;
    let max = undefined !== item.max ? item.max : 5;
    let low = undefined !== item.low ? item.low : min;
    let high = undefined !== item.high ? item.high : max;
    let d = min == 0 ? 1 : 0;
    return (entity ? html `
     <li>
       <ha-icon icon="${icon}"></ha-icon>
       <meter class="meter" value="${parseInt(entity.state) + d}" optimum="${(high - low) / 2}"
            min="${min}" max="${max + d}" low="${low + d}" high="${high + d}">${entity.state}/${max}</meter>
     </li>
  ` : "");
};
/**
 <li>
 <ha-icon icon="${entity.attributes.icon}"></ha-icon>
 0<meter class="meter" value="${0 + d}"
 min="${min}" max="${max + d}" low="${low + d}" high="${high + d}" optimum="${(high-low)/2}">
 <div class="meter-gauge"><span style="width: 46.42%;">${entity.state}/${max}</span></div>
 </meter>
 </li>
 <li>
 <ha-icon icon="${entity.attributes.icon}"></ha-icon>
 1<meter class="meter" value="${1 + d}"
 min="${min}" max="${max + d}" low="${low + d}" high="${high + d}" optimum="${(high-low)/2}">
 <div class="meter-gauge"><span style="width: 46.42%;">${entity.state}/${max}</span></div>
 </meter>
 </li>
 <li>
 <ha-icon icon="${entity.attributes.icon}"></ha-icon>
 2<meter class="meter" value="${2 + d}"
 min="${min}" max="${max + d}" low="${low + d}" high="${high + d}" optimum="${(high-low)/2}">
 <div class="meter-gauge"><span style="width: 46.42%;">${entity.state}/${max}</span></div>
 </meter>
 </li>
 <li>
 <ha-icon icon="${entity.attributes.icon}"></ha-icon>
 3<meter class="meter" value="${3 + d}"
 min="${min}" max="${max + d}" low="${low + d}" high="${high + d}" optimum="${(high-low)/2}">
 ${entity.state}/${max}
 </meter>
 </li>
 <li>
 <ha-icon icon="${entity.attributes.icon}"></ha-icon>
 4<meter class="meter" value="${4 + d}"
 min="${min}" max="${max + d}" low="${low + d}" high="${high + d}" optimum="${(high-low)/2}">
 <div class="meter-gauge"><span style="width: 46.42%;">${entity.state}/${max}</span></div>
 </meter>
 </li>
 <li>
 <ha-icon icon="${entity.attributes.icon}"></ha-icon>
 5<meter class="meter" value="${5 + d}"
 min="${min}" max="${max + d}" low="${low + d}" high="${high + d}" optimum="${(high-low)/2}">
 <div class="meter-gauge"><span style="width: 46.42%;">${entity.state}/${max}</span></div>
 </meter>
 </li>
 */
function renderPollens(hass, pollen, border) {
    let tree = pollen.tree && pollen.tree.entity ? _renderPollen(hass, pollen.tree) : undefined;
    let weed = pollen.weed && pollen.weed.entity ? _renderPollen(hass, pollen.weed) : undefined;
    let grass = pollen.grass && pollen.grass.entity ? _renderPollen(hass, pollen.grass) : undefined;
    return html `
    <ul class="variations polles ${border ? "spacer" : ""}">
        ${tree ? tree : ""}${weed ? weed : ""}${grass ? grass : ""}
    </ul>
  `;
}

/**
 *
 * @param state
 * @param attributes
 * @param icon
 * @private
 */
const _renderAirQuality = (state, attributes, icon) => {
    return (state ? html `
    <li>
      <svg viewBox="0 0 24 15" width="24" height="15" xmlns="http://www.w3.org/2000/svg">
        <style>.small {font: 8px sans-serif;}</style>
        <text x="0" y="14" class="small">${icon}</text>
      </svg>${state} ${attributes.unit_of_measurement ? attributes.unit_of_measurement : ""}
    </li>    
  ` : "");
};
/**
 *
 * @param hass
 * @param airquality
 */
const renderAirQualities = (hass, airquality, border) => {
    let pm25 = undefined !== airquality.pm25 && undefined !== hass.states[airquality.pm25]
        ? _renderAirQuality(numFormat(hass.states[airquality.pm25].state), hass.states[airquality.pm25].attributes, 'pm25') : undefined;
    let pm10 = undefined !== airquality.pm10 && undefined !== hass.states[airquality.pm10]
        ? _renderAirQuality(numFormat(hass.states[airquality.pm10].state), hass.states[airquality.pm10].attributes, 'pm10') : undefined;
    let o3 = undefined !== airquality.o3 && undefined !== hass.states[airquality.o3]
        ? _renderAirQuality(numFormat(hass.states[airquality.o3].state), hass.states[airquality.o3].attributes, 'o3') : undefined;
    let no2 = undefined !== airquality.no2 && undefined !== hass.states[airquality.no2]
        ? _renderAirQuality(numFormat(hass.states[airquality.no2].state), hass.states[airquality.no2].attributes, 'no2') : undefined;
    let co = undefined !== airquality.co && undefined !== hass.states[airquality.co]
        ? _renderAirQuality(numFormat(hass.states[airquality.co].state), hass.states[airquality.co].attributes, 'co') : undefined;
    let so2 = undefined !== airquality.so2 && undefined !== hass.states[airquality.so2]
        ? _renderAirQuality(numFormat(hass.states[airquality.so2].state), hass.states[airquality.so2].attributes, 'so2') : undefined;
    let epa_aqi = undefined !== airquality.epa_aqi && undefined !== hass.states[airquality.epa_aqi]
        ? _renderAirQuality(numFormat(hass.states[airquality.epa_aqi].state), hass.states[airquality.epa_aqi].attributes, 'aqi') : undefined;
    let epa_health_concern = undefined !== airquality.epa_health_concern && undefined !== hass.states[airquality.epa_health_concern]
        ? _renderAirQuality(hass.states[airquality.epa_health_concern].state, hass.states[airquality.epa_health_concern].attributes, 'aqi') : undefined;
    return html `
    <ul class="variations ${border ? "spacer" : ""}">
        ${epa_aqi ? epa_aqi : ""}${epa_health_concern ? epa_health_concern : ""}
        ${pm25 ? pm25 : ""}${pm10 ? pm10 : ""}${o3 ? o3 : ""}${no2 ? no2 : ""}${co ? co : ""}${so2 ? so2 : ""}
    </ul>
  `;
};

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
var t,i;const s=globalThis.trustedTypes,e=s?s.createPolicy("lit-html",{createHTML:t=>t}):void 0,o=`lit$${(Math.random()+"").slice(9)}$`,n="?"+o,l=`<${n}>`,h=document,r=(t="")=>h.createComment(t),d=t=>null===t||"object"!=typeof t&&"function"!=typeof t,u=Array.isArray,v=t=>{var i;return u(t)||"function"==typeof(null===(i=t)||void 0===i?void 0:i[Symbol.iterator])},c=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,a=/-->/g,f=/>/g,_=/>|[ 	\n\r](?:([^\s"'>=/]+)([ 	\n\r]*=[ 	\n\r]*(?:[^ 	\n\r"'`<>=]|("|')|))|$)/g,g=/'/g,m=/"/g,$=/^(?:script|style|textarea)$/i,p=t=>(i,...s)=>({_$litType$:t,strings:i,values:s}),y=p(1),T=Symbol.for("lit-noChange"),x=Symbol.for("lit-nothing"),w=new WeakMap,C=h.createTreeWalker(h,129,null,!1),P=(t,i)=>{const s=t.length-1,n=[];let h,r=2===i?"<svg>":"",d=c;for(let i=0;i<s;i++){const s=t[i];let e,u,v=-1,p=0;for(;p<s.length&&(d.lastIndex=p,u=d.exec(s),null!==u);)p=d.lastIndex,d===c?"!--"===u[1]?d=a:void 0!==u[1]?d=f:void 0!==u[2]?($.test(u[2])&&(h=RegExp("</"+u[2],"g")),d=_):void 0!==u[3]&&(d=_):d===_?">"===u[0]?(d=null!=h?h:c,v=-1):void 0===u[1]?v=-2:(v=d.lastIndex-u[2].length,e=u[1],d=void 0===u[3]?_:'"'===u[3]?m:g):d===m||d===g?d=_:d===a||d===f?d=c:(d=_,h=void 0);const y=d===_&&t[i+1].startsWith("/>")?" ":"";r+=d===c?s+l:v>=0?(n.push(e),s.slice(0,v)+"$lit$"+s.slice(v)+o+y):s+o+(-2===v?(n.push(void 0),i):y);}const u=r+(t[s]||"<?>")+(2===i?"</svg>":"");return [void 0!==e?e.createHTML(u):u,n]};class V{constructor({strings:t,_$litType$:i},e){let l;this.parts=[];let h=0,d=0;const u=t.length-1,v=this.parts,[c,a]=P(t,i);if(this.el=V.createElement(c,e),C.currentNode=this.el.content,2===i){const t=this.el.content,i=t.firstChild;i.remove(),t.append(...i.childNodes);}for(;null!==(l=C.nextNode())&&v.length<u;){if(1===l.nodeType){if(l.hasAttributes()){const t=[];for(const i of l.getAttributeNames())if(i.endsWith("$lit$")||i.startsWith(o)){const s=a[d++];if(t.push(i),void 0!==s){const t=l.getAttribute(s.toLowerCase()+"$lit$").split(o),i=/([.?@])?(.*)/.exec(s);v.push({type:1,index:h,name:i[2],strings:t,ctor:"."===i[1]?k:"?"===i[1]?H:"@"===i[1]?I:M});}else v.push({type:6,index:h});}for(const i of t)l.removeAttribute(i);}if($.test(l.tagName)){const t=l.textContent.split(o),i=t.length-1;if(i>0){l.textContent=s?s.emptyScript:"";for(let s=0;s<i;s++)l.append(t[s],r()),C.nextNode(),v.push({type:2,index:++h});l.append(t[i],r());}}}else if(8===l.nodeType)if(l.data===n)v.push({type:2,index:h});else {let t=-1;for(;-1!==(t=l.data.indexOf(o,t+1));)v.push({type:7,index:h}),t+=o.length-1;}h++;}}static createElement(t,i){const s=h.createElement("template");return s.innerHTML=t,s}}function E(t,i,s=t,e){var o,n,l,h;if(i===T)return i;let r=void 0!==e?null===(o=s._$Cl)||void 0===o?void 0:o[e]:s._$Cu;const u=d(i)?void 0:i._$litDirective$;return (null==r?void 0:r.constructor)!==u&&(null===(n=null==r?void 0:r._$AO)||void 0===n||n.call(r,!1),void 0===u?r=void 0:(r=new u(t),r._$AT(t,s,e)),void 0!==e?(null!==(l=(h=s)._$Cl)&&void 0!==l?l:h._$Cl=[])[e]=r:s._$Cu=r),void 0!==r&&(i=E(t,r._$AS(t,i.values),r,e)),i}class N{constructor(t,i){this.v=[],this._$AN=void 0,this._$AD=t,this._$AM=i;}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}p(t){var i;const{el:{content:s},parts:e}=this._$AD,o=(null!==(i=null==t?void 0:t.creationScope)&&void 0!==i?i:h).importNode(s,!0);C.currentNode=o;let n=C.nextNode(),l=0,r=0,d=e[0];for(;void 0!==d;){if(l===d.index){let i;2===d.type?i=new S(n,n.nextSibling,this,t):1===d.type?i=new d.ctor(n,d.name,d.strings,this,t):6===d.type&&(i=new L(n,this,t)),this.v.push(i),d=e[++r];}l!==(null==d?void 0:d.index)&&(n=C.nextNode(),l++);}return o}m(t){let i=0;for(const s of this.v)void 0!==s&&(void 0!==s.strings?(s._$AI(t,s,i),i+=s.strings.length-2):s._$AI(t[i])),i++;}}class S{constructor(t,i,s,e){var o;this.type=2,this._$AH=x,this._$AN=void 0,this._$AA=t,this._$AB=i,this._$AM=s,this.options=e,this._$Cg=null===(o=null==e?void 0:e.isConnected)||void 0===o||o;}get _$AU(){var t,i;return null!==(i=null===(t=this._$AM)||void 0===t?void 0:t._$AU)&&void 0!==i?i:this._$Cg}get parentNode(){let t=this._$AA.parentNode;const i=this._$AM;return void 0!==i&&11===t.nodeType&&(t=i.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,i=this){t=E(this,t,i),d(t)?t===x||null==t||""===t?(this._$AH!==x&&this._$AR(),this._$AH=x):t!==this._$AH&&t!==T&&this.$(t):void 0!==t._$litType$?this.T(t):void 0!==t.nodeType?this.S(t):v(t)?this.M(t):this.$(t);}A(t,i=this._$AB){return this._$AA.parentNode.insertBefore(t,i)}S(t){this._$AH!==t&&(this._$AR(),this._$AH=this.A(t));}$(t){this._$AH!==x&&d(this._$AH)?this._$AA.nextSibling.data=t:this.S(h.createTextNode(t)),this._$AH=t;}T(t){var i;const{values:s,_$litType$:e}=t,o="number"==typeof e?this._$AC(t):(void 0===e.el&&(e.el=V.createElement(e.h,this.options)),e);if((null===(i=this._$AH)||void 0===i?void 0:i._$AD)===o)this._$AH.m(s);else {const t=new N(o,this),i=t.p(this.options);t.m(s),this.S(i),this._$AH=t;}}_$AC(t){let i=w.get(t.strings);return void 0===i&&w.set(t.strings,i=new V(t)),i}M(t){u(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let s,e=0;for(const o of t)e===i.length?i.push(s=new S(this.A(r()),this.A(r()),this,this.options)):s=i[e],s._$AI(o),e++;e<i.length&&(this._$AR(s&&s._$AB.nextSibling,e),i.length=e);}_$AR(t=this._$AA.nextSibling,i){var s;for(null===(s=this._$AP)||void 0===s||s.call(this,!1,!0,i);t&&t!==this._$AB;){const i=t.nextSibling;t.remove(),t=i;}}setConnected(t){var i;void 0===this._$AM&&(this._$Cg=t,null===(i=this._$AP)||void 0===i||i.call(this,t));}}class M{constructor(t,i,s,e,o){this.type=1,this._$AH=x,this._$AN=void 0,this.element=t,this.name=i,this._$AM=e,this.options=o,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=x;}get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}_$AI(t,i=this,s,e){const o=this.strings;let n=!1;if(void 0===o)t=E(this,t,i,0),n=!d(t)||t!==this._$AH&&t!==T,n&&(this._$AH=t);else {const e=t;let l,h;for(t=o[0],l=0;l<o.length-1;l++)h=E(this,e[s+l],i,l),h===T&&(h=this._$AH[l]),n||(n=!d(h)||h!==this._$AH[l]),h===x?t=x:t!==x&&(t+=(null!=h?h:"")+o[l+1]),this._$AH[l]=h;}n&&!e&&this.k(t);}k(t){t===x?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,null!=t?t:"");}}class k extends M{constructor(){super(...arguments),this.type=3;}k(t){this.element[this.name]=t===x?void 0:t;}}class H extends M{constructor(){super(...arguments),this.type=4;}k(t){t&&t!==x?this.element.setAttribute(this.name,""):this.element.removeAttribute(this.name);}}class I extends M{constructor(t,i,s,e,o){super(t,i,s,e,o),this.type=5;}_$AI(t,i=this){var s;if((t=null!==(s=E(this,t,i,0))&&void 0!==s?s:x)===T)return;const e=this._$AH,o=t===x&&e!==x||t.capture!==e.capture||t.once!==e.once||t.passive!==e.passive,n=t!==x&&(e===x||o);o&&this.element.removeEventListener(this.name,this,e),n&&this.element.addEventListener(this.name,this,t),this._$AH=t;}handleEvent(t){var i,s;"function"==typeof this._$AH?this._$AH.call(null!==(s=null===(i=this.options)||void 0===i?void 0:i.host)&&void 0!==s?s:this.element,t):this._$AH.handleEvent(t);}}class L{constructor(t,i,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=i,this.options=s;}get _$AU(){return this._$AM._$AU}_$AI(t){E(this,t);}}null===(t=globalThis.litHtmlPolyfillSupport)||void 0===t||t.call(globalThis,V,S),(null!==(i=globalThis.litHtmlVersions)&&void 0!==i?i:globalThis.litHtmlVersions=[]).push("2.0.0");

const num = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const colors = ['#F1D1B1', '#E4B590', '#CF9F7D', '#B67851', '#A15E2D', '#513938'];
/**
 *
 * @param entity
 * @param icon
 * @private
 */
const _renderUvSingle = (entity, icon, round) => {
    let value = round ? numFormat(entity.state, 0) : entity.state;
    return (entity ? y `
    <li>
        <ha-icon icon="${icon}"></ha-icon>${value} ${entity.attributes.unit_of_measurement ? entity.attributes.unit_of_measurement : ""}
    </li>    
  ` : "");
};
/**
 *
 * @param entity1
 * @param entity2
 * @param icon
 * @private
 */
const _renderUvDouble = (entity1, entity2, icon) => {
    let value1 = undefined !== entity1 ? numFormat(entity1.state) : "--";
    let value2 = undefined !== entity2 ? numFormat(entity2.state) : "--";
    return (entity1 || entity2 ? y `
    <li>
        <ha-icon icon="${icon}"></ha-icon>${value1} / <b>${value2}</b>
        ${entity1.attributes.unit_of_measurement ? entity1.attributes.unit_of_measurement : ""}
    </li>    
  ` : "");
};
/**
 *
 * @param state
 * @private
 */
const _getTime = (state) => {
    let result = "- -";
    if (state && "unknown" !== state) {
        let hours = Math.floor(parseInt(state) / 60);
        let minutes = state - (hours * 60);
        if (hours > 0)
            result = "" + hours + ":" + pad(minutes, 2) + " h";
        else
            result = "" + minutes + " m";
    }
    return result;
};
/**
 *
 * @param hass
 * @param uv
 * @param border
 */
const renderUv = (hass, uv, border) => {
    let protection_window = undefined !== uv.protection_window && hass.states[uv.protection_window]
        ? _renderUvSingle(hass.states[uv.protection_window], 'mdi:sunglasses', false) : undefined;
    let uv_level = undefined !== uv.uv_level && hass.states[uv.uv_level]
        ? _renderUvSingle(hass.states[uv.uv_level], 'mdi:weather-sunny', false) : undefined;
    let uv_index = undefined !== uv.uv_index && undefined !== uv.max_uv_index
        ? _renderUvDouble(hass.states[uv.uv_index], hass.states[uv.max_uv_index], 'mdi:weather-sunny') : "";
    let ozone_level = undefined !== uv.ozone_level && hass.states[uv.ozone_level]
        ? _renderUvSingle(hass.states[uv.ozone_level], 'mdi:vector-triangle', true) : undefined;
    return y `
    <ul class="variations ${border ? "spacer" : ""}">
        ${uv_level ? uv_level : ""}${protection_window ? protection_window : ""}
        ${uv_index ? uv_index : ""}${ozone_level ? ozone_level : ""}
    </ul>
    <div class="forecast clear" style="margin-top:  4px; margin-bottom: 4px;">
    ${[1, 2, 3, 4, 5, 6].map(stypen => {
        let stype = 'set_skin_type_' + stypen;
        let sensorId = uv[stype];
        let sstate = undefined !== typeof sensorId && undefined !== typeof hass.states[sensorId] ? hass.states[sensorId] : undefined;
        return sstate ? y `
        <div class="day ${stypen}">
            <div id="rectangle" style="color: black; background: ${colors[stypen - 1]};width:32px;height:32px;display: table;margin: 0 auto;">${num[stypen - 1]}</div>
            <div class="lowTemp">
              ${_getTime(sstate.state)}
            </div>  
        </div>
      ` : "";
    })}
    </div>
  `;
};

// @ts-ignore
const renderAlert = (hass, alert_sensor, border) => {
    let alerts = Object.entries(alert_sensor);
    // console.info( alert_sensor ) ;
    // console.info( alerts) ;
    return y `
    <div class="forecast clear" style="margin-top:  4px; margin-bottom: 4px;">
    ${alerts.map(alert => {
        let key = alert[0], value = alert[1], show = true;
        let sensor = hass.states[value.entity];
        if (undefined !== sensor) {
            let state = "- -", risk = 0, icon;
            if (sensor.state && "unknown" !== sensor.state) {
                icon = undefined !== value.icon ? value.icon : sensor.attributes.icon;
                if (undefined !== value['min'] && undefined !== value['max']) {
                    state = numFormat(sensor.state);
                    risk = Math.abs(((parseFloat(state) - value.min) * 100) / (value.max - value.min)) / 100;
                    if (undefined !== value.show_if_ge && parseFloat(state) < value.show_if_ge)
                        show = false;
                }
                else {
                    state = sensor.state;
                    risk = 'on' == state.toLowerCase() ? 1 : 0;
                    if (value.show_if_on && 'off' == state.toLowerCase())
                        show = false;
                }
            }
            let styleColors = colorByPercent(risk);
            return show ? y `
        <div class="day">
            <div id="rectangle" style="color: ${styleColors.color};background: ${styleColors.bgcolor};width:32px;height:32px;display: table;margin: 0 auto;"><ha-icon icon="${icon}"></ha-icon></div>
            <div class="lowTemp">${state}</div>  
        </div>
        ` : "";
        }
        else
            return "";
    })}
    </div>
  `;
    // return maxDays > 1 ? html`
    //     <div class="forecast clear ${border ? "spacer" : ""}">
    //       ${days.map(day => {
    //   let icon: string, day_temp_low: number, day_temp_high: number, day_prec_probab: number, day_prec_intensity: number;
    //   let date = new Date(forecastDate.setDate(forecastDate.getDate() + 1))
    //     .toLocaleDateString(lang, {weekday: "short"});
    //
    //   if( icons && icons[day] && hass.states[icons[day][1]] )
    //     icon = hass.states[icons[day][1]].state.toLowerCase() ;
    //
    //   if( temperature_low && temperature_low[day] && hass.states[temperature_low[day][1]] )
    //     day_temp_low = numFormat(hass.states[temperature_low[day][1]].state, 0) ;
    //   if( temperature_high && temperature_high[day] && hass.states[temperature_high[day][1]] )
    //     day_temp_high = numFormat(hass.states[temperature_high[day][1]].state, 0) ;
    //
    //   if( precipitation_probability && precipitation_probability[day] && hass.states[precipitation_probability[day][1]] )
    //     day_prec_probab = numFormat(hass.states[precipitation_probability[day][1]].state, 0) ;
    //   if( precipitation_intensity && precipitation_intensity[day] && hass.states[precipitation_intensity[day][1]] )
    //     day_prec_intensity = numFormat(hass.states[precipitation_intensity[day][1]].state, 0) ;
    //
    //   return html`
    //         <div class="day ${day}">
    //             <div class="dayname">${date}</div>
    //             ${icon ? html`
    //             <i class="icon" style="background: none, url('${getWeatherIcon(icon, iconsConfig, sun)}') no-repeat;
    //                   background-size: contain"></i>
    //             ` : ""}
    //             ${_renderForecast(day_temp_low, '', day_temp_high, getUnit(hass,"temperature"))}
    //             ${_renderForecast(day_prec_probab, '%', day_prec_intensity,
    //     getUnit(hass,"precipitation") + '/h')}
    //         </div>
    //         `;
    // })}
    //     </div>
    //   ` : html``;
};
function colorByPercent(value) {
    //value from 0 to 1
    let hue = ((1 - value) * 120).toString(10);
    let tcolor = getContrastYIQ(HSLToHex(hue, 100, 50));
    return { "color": tcolor, "bgcolor": ["hsl(", hue, ",100%,50%)"].join("") };
}
function getContrastYIQ(hexcolor) {
    hexcolor = hexcolor.replace("#", "");
    let r = parseInt(hexcolor.substr(0, 2), 16);
    let g = parseInt(hexcolor.substr(2, 2), 16);
    let b = parseInt(hexcolor.substr(4, 2), 16);
    let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
}
function HSLToHex(h, s, l) {
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) {
        r = c;
        g = x;
        b = 0;
    }
    else if (60 <= h && h < 120) {
        r = x;
        g = c;
        b = 0;
    }
    else if (120 <= h && h < 180) {
        r = 0;
        g = c;
        b = x;
    }
    else if (180 <= h && h < 240) {
        r = 0;
        g = x;
        b = c;
    }
    else if (240 <= h && h < 300) {
        r = x;
        g = 0;
        b = c;
    }
    else if (300 <= h && h < 360) {
        r = c;
        g = 0;
        b = x;
    }
    // Having obtained RGB, convert channels to hex
    let rs = Math.round((r + m) * 255).toString(16);
    let gs = Math.round((g + m) * 255).toString(16);
    let bs = Math.round((b + m) * 255).toString(16);
    // Prepend 0s, if necessary
    if (rs.length == 1)
        rs = "0" + rs;
    if (gs.length == 1)
        gs = "0" + gs;
    if (bs.length == 1)
        bs = "0" + bs;
    return "#" + rs + gs + bs;
}

// @ts-ignore
const renderSeaForecast = (hass, seaCfg, iconsConfig, lang, border) => {
    let swell_directions = seaCfg.swell_direction
        ? Object.entries(seaCfg.swell_direction) : undefined;
    let swell_heights = seaCfg.swell_height
        ? Object.entries(seaCfg.swell_height) : undefined;
    let swell_periods = seaCfg.swell_period
        ? Object.entries(seaCfg.swell_period) : undefined;
    let wind_directions = seaCfg.wind_direction
        ? Object.entries(seaCfg.wind_direction) : undefined;
    let wind_speeds = seaCfg.wind_speed
        ? Object.entries(seaCfg.wind_speed) : undefined;
    let air_temperatures = seaCfg.air_temperature
        ? Object.entries(seaCfg.air_temperature) : undefined;
    let water_temperatures = seaCfg.water_temperature
        ? Object.entries(seaCfg.water_temperature) : undefined;
    let maxHours = Math.max(swell_directions ? swell_directions.length : 0, swell_heights ? swell_heights.length : 0, swell_periods ? swell_periods.length : 0);
    let startHour = 0;
    let hours = maxHours > 0 ?
        Array(maxHours - startHour).fill(1, 0, maxHours - startHour).map(() => startHour++)
        : Array();
    return html `
    <div class="forecast clear ${border ? "spacer" : ""}">
      <div class="day">
        <div class="highTemp">
            <table class="synoptic">
                <thead>
                    <tr>
                        <th>Time</th><th>Swell</th><th>Wind</th><th>Temperature</th>
                    </tr>
                </thead>
                <tbody>
        ${hours.map(hour => {
        let swell_dir_name = swell_directions[hour.toString()][1], swell_dir_sensor = hass.states[swell_dir_name];
        let swell_height_name = swell_heights[hour.toString()][1], swell_height_sensor = hass.states[swell_height_name];
        let swell_periods_name = swell_periods[hour.toString()][1], swell_periods_sensor = hass.states[swell_periods_name];
        let wind_dir_name = wind_directions[hour.toString()][1], wind_dir_sensor = hass.states[wind_dir_name];
        let wind_speed_name = wind_speeds[hour.toString()][1], wind_speed_sensor = hass.states[wind_speed_name];
        let air_temperatures_name = air_temperatures[hour.toString()][1], air_temperatures_sensor = hass.states[air_temperatures_name];
        let water_temperatures_name = water_temperatures[hour.toString()][1], water_temperatures_sensor = hass.states[water_temperatures_name];
        let swell_degree = parseFloat(swell_dir_sensor.state) + "deg"; // , cssclass = (degree % 10==0) ? degree : degree-degree%5 +5 ;
        let height = numFormat(swell_height_sensor.state), height_unit = swell_height_sensor.attributes.unit_of_measurement;
        let period = numFormat(swell_periods_sensor.state, 0), period_unit = swell_periods_sensor.attributes.unit_of_measurement;
        let wind_degree = parseFloat(wind_dir_sensor.state) + "deg"; // , cssclass = (degree % 10==0) ? degree : degree-degree%5 +5 ;
        let wind_speed = numFormat(wind_speed_sensor.state, 0), wind_speed_unit = wind_speed_sensor.attributes.unit_of_measurement;
        let air_temperature = numFormat(air_temperatures_sensor.state, 0), air_temperature_unit = air_temperatures_sensor.attributes.unit_of_measurement;
        let water_temperature = numFormat(water_temperatures_sensor.state, 1), water_temperature_unit = water_temperatures_sensor.attributes.unit_of_measurement;
        return html `
            <tr>
            <td>${pad((new Date(swell_dir_sensor.attributes.observation_time)).getHours(), 2)}:00</td>
            <td>${height}${height_unit} / ${period}${period_unit}
                <span class="svg-icon svg-swell-icon svg-swell-icon-dark" style="transform: rotate(${swell_degree});
                    -ms-transform: rotate(${swell_degree}); -webkit-transform: rotate(${swell_degree});"></span>
            </td>
            <td>${wind_speed} ${wind_speed_unit}
                <span class="svg-icon svg-wind-icon svg-wind-icon-light" style="transform: rotate(${wind_degree});
                    -ms-transform: rotate(${wind_degree}); -webkit-transform: rotate(${wind_degree});"></span>
            </td>
            <td>${water_temperature} - ${air_temperature} ${water_temperature_unit}</td>
            </tr> 
                `;
    })}
                               </tbody>
                    </table>      
                </div>
      </div>           
    </div>
  `;
};

const hacsImagePath = "/local/community/ha-card-weather-conditions/icons";
const manImagePath = "/local/ha-card-weather-conditions/icons";
let hacsImagePathExist = false;
let manImagePathExist = false;
let logo = "%c WEATHER-CONDITION-CARD %c 1.9.9";
let optConsoleParam1 = "color: white; background: green; font-weight: 700;";
let optConsoleParam2 = "color: green; background: white; font-weight: 700;";
let optConsoleParam3 = "color: black; background: white; font-weight: 700;";
let numberFormat_0dec = null;
let numberFormat_1dec = null;
let globalImagePath;
const UNDEFINED = "undefined";
Object.defineProperty(Object.prototype, 'isSet', {
    value: function (object, testIsBlank) {
        let t1 = !(typeof object === UNDEFINED || null === object);
        return (testIsBlank ? t1 && object.length > 0 : t1);
    },
    writable: true,
    configurable: true,
    enumerable: false
});
console.info(logo, optConsoleParam1, optConsoleParam2);
let findImagePath = [imageExist(hacsImagePath + "/static/cloudy.svg"),
    imageExist(manImagePath + "/static/cloudy.svg"),];
Promise.all(findImagePath).then((testResults) => {
    let hacsImages, manImages;
    hacsImages = hacsImagePathExist = testResults[0];
    manImages = manImagePathExist = testResults[1];
    globalImagePath = (hacsImages ? hacsImagePath : manImages ? manImagePath : null);
    let translPath = globalImagePath + '/../transl/';
    let findTranslation = [
        loadJSON(translPath + 'en.json'),
        loadJSON(translPath + 'it.json'),
        loadJSON(translPath + 'nl.json'),
        loadJSON(translPath + 'es.json'),
        loadJSON(translPath + 'de.json'),
        loadJSON(translPath + 'fr.json'),
        loadJSON(translPath + 'sr-latn.json'),
        loadJSON(translPath + 'pt.json'),
        loadJSON(translPath + 'da.json'),
        loadJSON(translPath + 'no-NO.json')
    ];
    if (hacsImages)
        console.info(logo + "%c use HACS path to retrieve icons.", optConsoleParam1, optConsoleParam2, optConsoleParam3);
    else if (manImages)
        console.info(logo + "%c use www root path to retrieve icons.", optConsoleParam1, optConsoleParam2, optConsoleParam3);
    else
        console.info(logo + "%c error setting right icons path.", optConsoleParam1, optConsoleParam2, optConsoleParam3);
    Promise.all(findTranslation).then((translations) => {
        let HaCardWeatherConditions = class HaCardWeatherConditions extends LitElement {
            constructor() {
                super(...arguments);
                this._iconsConfig = new class {
                };
                this._terms = new class {
                };
                this.invalidConfig = false;
                this.numberElements = 0;
                this._header = true;
                this._name = '';
                this._hasCurrent = false;
                this._hasForecast = false;
                this._hasMeteogram = false;
                this._hasAirQuality = false;
                this._hasPollen = false;
                this._hasUv = false;
                this._hasAlert = false;
                this._hasSea = false;
                this._displayTop = true;
                this._displayCurrent = true;
                this._displayForecast = true;
                this._showSummary = true;
                this._showPresent = true;
                this._showUv = true;
                this._showAirQuality = true;
                this._showPollen = true;
                this._showForecast = true;
                this._showAlert = true;
                this._showSea = true;
            }
            /**
             *
             * @param {CardConfig} config
             */
            setConfig(config) {
                console.log({ card_config: config });
                if (!config) {
                    this.invalidConfig = true;
                    throw new Error("Invalid configuration");
                }
                if (config.name && config.name.length > 0) {
                    this._name = config.name;
                }
                if (config.language && config.language.length > 0) {
                    this._language = config.language.toLowerCase();
                }
                else
                    this._language = 'en';
                let transls;
                try {
                    transls = JSON.parse(translations[cwcLocale[this._language]]);
                    this._terms.windDirections = transls.cwcLocWindDirections;
                    this._terms.words = transls.cwcTerms;
                    console.info(logo + "%c card \"" + this._name + "\", locale is '" + this._language + "'.", optConsoleParam1, optConsoleParam2, optConsoleParam3);
                }
                catch (e) {
                    transls = JSON.parse(translations[cwcLocale['en']]);
                    this._terms.windDirections = transls.cwcLocWindDirections;
                    this._terms.words = transls.cwcTerms;
                    console.info(logo + "%c card \"" + this._name + "\" unable to use '" + this._language + "' locale, set as default 'en'.", optConsoleParam1, optConsoleParam2, optConsoleParam3);
                }
                numberFormat_0dec = new Intl.NumberFormat(this._language, { maximumFractionDigits: 0 });
                numberFormat_1dec = new Intl.NumberFormat(this._language, { maximumFractionDigits: 1 });
                if (undefined !== config.display) {
                    this._displayTop = config.display.findIndex(item => 'top' === item.toLowerCase()) >= 0;
                    this._displayCurrent = config.display.findIndex(item => 'current' === item.toLowerCase()) >= 0;
                    this._displayForecast = config.display.findIndex(item => 'forecast' === item.toLowerCase()) >= 0;
                }
                this._hasCurrent = (!!config.weather) && (!!config.weather.current);
                this._hasForecast = (!!config.weather) && (!!config.weather.forecast);
                this._hasMeteogram = this._hasForecast && (!!config.weather.forecast.meteogram);
                this._hasAirQuality = !!config.air_quality;
                this._hasPollen = !!config.pollen && (!!config.pollen.tree || !!config.pollen.weed || !!config.pollen.grass);
                this._hasUv = !!config.uv;
                this._hasAlert = !!config.alert;
                this._hasSea = !!config.sea;
                this._iconsConfig.path = hacsImages ? hacsImagePath : manImages ? manImagePath : null;
                // this._iconsConfig.iconType = config.animation ? "animated" : "static";
                this._iconsConfig.iconType = config.animation ? "animated" : "static";
                this._iconsConfig.iconsDay = cwcClimacellDayIcons;
                this._iconsConfig.iconsNight = cwcClimacellNightIcons;
                this._iconsConfig.icons_model = "climacell";
                if ((!!config.weather) && (!!config.weather.icons_model))
                    switch (config.weather.icons_model.toLowerCase()) {
                        case 'darksky':
                            this._iconsConfig.iconsDay = cwcDarkskyDayIcons;
                            this._iconsConfig.iconsNight = cwcDarkskyNightIcons;
                            this._iconsConfig.icons_model = "darksky";
                            break;
                        case 'openweathermap':
                            this._iconsConfig.iconsDay = cwcOpenWeatherMapDayIcons;
                            this._iconsConfig.iconsNight = cwcOpenWeatherMapNightIcons;
                            this._iconsConfig.icons_model = "openweathermap";
                            break;
                        case 'buienradar':
                            this._iconsConfig.iconsDay = cwcBuienradarDayIcons;
                            this._iconsConfig.iconsNight = cwcBuienradarNightIcons;
                            this._iconsConfig.icons_model = "buienradar";
                            break;
                        case 'defaulthass':
                            this._iconsConfig.iconsDay = cwcDefaultHassDayIcons;
                            this._iconsConfig.iconsNight = cwcDefaultHassNightIcons;
                            this._iconsConfig.icons_model = "defaulthass";
                            break;
                    }
                this._config = config;
            }
            /**
             * get the current size of the card
             * @return {Number}
             */
            getCardSize() {
                return 1;
            }
            /**
             *
             * @returns {CSSResult}
             */
            static get styles() {
                return css `${style}${styleSummary}${styleForecast}${styleMeter}${styleCamera}${styleNightAndDay}${unsafeCSS(getSeaStyle(globalImagePath))}`;
            }
            /**
             * generates the card HTML
             * @return {TemplateResult}
             */
            render() {
                if (this.invalidConfig)
                    return html `
            <ha-card class="ha-card-weather-conditions">
                <div class='banner'>
                    <div class="header">ha-card-weather-conditions</div>
                </div>
                <div class='content'>
                    Configuration ERROR!
                </div>
            </ha-card>
        `;
                else {
                    return this._render();
                }
            }
            /**
             *
             * @returns {TemplateResult}
             * @private
             */
            _render() {
                let _renderedSummary, _renderedPresent, _renderedUv, _renderedAirQuality, _renderedPollen, _renderedForecast, _renderedAlert, _renderedSea;
                // let _renderSummury: boolean = false ;
                let posix = 0;
                let states = this.hass.states;
                if (this._showSummary && this._hasCurrent) {
                    let current = this._config.weather.current;
                    if ((current.current_conditions && typeof states[current.current_conditions] !== undefined)
                        || (current.temperature && typeof states[current.temperature] !== undefined)) {
                        _renderedSummary = renderSummary(this.hass, this._config.weather.current, this._config.name, this._iconsConfig, this._terms);
                        posix++;
                    }
                    else
                        _renderedSummary = "";
                }
                else
                    _renderedSummary = "";
                // Test if render >Present<
                if (this._showPresent && this._hasCurrent) {
                    let current = this._config.weather.current;
                    if ((current.sun && typeof states[current.sun] !== undefined)
                        || (current.humidity && typeof states[current.humidity] !== undefined)
                        || (current.pressure && typeof states[current.pressure] !== undefined)
                        || (current.visibility && typeof states[current.visibility] !== undefined)
                        || (current.wind_bearing && typeof states[current.wind_bearing] !== undefined)
                        || (current.wind_speed && typeof states[current.wind_speed] !== undefined)) {
                        _renderedPresent = renderPresent(this.hass, this._config.weather.current, this._config.weather.forecast, this._language, this._terms, posix > 0);
                        posix++;
                    }
                    else {
                        if (current.forecast && this._hasForecast) {
                            let forecast = this._config.weather.forecast;
                            if ((forecast.temperature_low && forecast.temperature_low.day_1 && typeof states[forecast.temperature_low.day_1] !== undefined)
                                || (forecast.temperature_high && forecast.temperature_high.day_1 && typeof states[forecast.temperature_high.day_1] !== undefined)
                                || (forecast.precipitation_intensity && forecast.precipitation_intensity.day_1 && typeof states[forecast.precipitation_intensity.day_1] !== undefined)
                                || (forecast.precipitation_probability && forecast.precipitation_probability.day_1 && typeof states[forecast.precipitation_probability.day_1] !== undefined)) {
                                _renderedPresent = renderPresent(this.hass, this._config.weather.current, this._config.weather.forecast, this._language, this._terms, posix > 0);
                                posix++;
                            }
                            else
                                _renderedPresent = "";
                        }
                        else
                            _renderedPresent = "";
                    }
                }
                else
                    _renderedPresent = "";
                // Test AirQuality
                if (this._showAirQuality && this._hasAirQuality) {
                    let airQuality = this._config.air_quality;
                    if ((airQuality.co && typeof states[airQuality.co] !== undefined)
                        || (airQuality.epa_aqi && typeof states[airQuality.epa_aqi] !== undefined)
                        || (airQuality.epa_health_concern && typeof states[airQuality.epa_health_concern] !== undefined)
                        || (airQuality.no2 && typeof states[airQuality.no2] !== undefined)
                        || (airQuality.o3 && typeof states[airQuality.o3] !== undefined)
                        || (airQuality.pm10 && typeof states[airQuality.pm10] !== undefined)
                        || (airQuality.pm25 && typeof states[airQuality.pm25] !== undefined)
                        || (airQuality.so2 && typeof states[airQuality.so2] !== undefined)) {
                        _renderedAirQuality = renderAirQualities(this.hass, this._config.air_quality, posix > 0);
                        posix++;
                    }
                    else
                        _renderedAirQuality = "";
                }
                else
                    _renderedAirQuality = "";
                // Test uv
                if (this._showUv && this._hasUv) {
                    let uv = this._config.uv;
                    if ((uv.protection_window && typeof states[uv.protection_window] !== undefined)
                        || (uv.ozone_level && typeof states[uv.ozone_level] !== undefined)
                        || (uv.uv_index && typeof states[uv.uv_index] !== undefined)
                        || (uv.uv_level && typeof states[uv.uv_level] !== undefined)
                        || (uv.max_uv_index && typeof states[uv.max_uv_index] !== undefined)) {
                        _renderedUv = renderUv(this.hass, this._config.uv, posix > 0);
                        posix++;
                    }
                    else
                        _renderedUv = "";
                }
                else
                    _renderedUv = "";
                if (this._showPollen && this._hasPollen) {
                    let pollen = this._config.pollen;
                    if ((pollen.grass && pollen.grass.entity && typeof states[pollen.grass.entity] !== undefined)
                        || (pollen.tree && pollen.tree.entity && typeof states[pollen.tree.entity] !== undefined)
                        || (pollen.weed && pollen.weed.entity && typeof states[pollen.weed.entity] !== undefined)) {
                        _renderedPollen = renderPollens(this.hass, this._config.pollen, posix > 0);
                        posix++;
                    }
                    else
                        _renderedPollen = "";
                }
                else
                    _renderedPollen = "";
                if (this._showForecast && this._hasForecast) {
                    let forecast = this._config.weather.forecast;
                    _renderedForecast = renderForecasts(this.hass, this._config.weather.current, forecast, this._iconsConfig, this._language, posix > 0);
                    posix++;
                }
                else
                    _renderedForecast = "";
                // Test Alert
                if (this._showAlert && this._hasAlert) {
                    let alert = this._config.alert;
                    _renderedAlert = renderAlert(this.hass, alert);
                    posix++;
                }
                else
                    _renderedAlert = "";
                // Test Sea
                if (this._showSea && this._hasSea) {
                    let sea = this._config.sea;
                    _renderedSea = renderSeaForecast(this.hass, sea, this._iconsConfig, this._language, posix > 0);
                    posix++;
                }
                else
                    _renderedSea = "";
                return html `
      ${ ""}
      
      <ha-card class="ha-card-weather-conditions ">
        <div class="nd-container ${ ''}">
        ${this._header ? html `
            ${_renderedSummary}
            ${_renderedAlert}
            ${_renderedPresent}
            ${_renderedUv}
            ${_renderedAirQuality}
            ${_renderedPollen}
            ${_renderedForecast}
            ${_renderedSea}
            ${this._hasMeteogram ? this.renderCamera(this.hass, this._config.weather.forecast.meteogram) : ""}
            ${this._config.camera ? this.renderCamera(this.hass, this._config.camera) : ""}
        ` : html ``}
        </div>
      </ha-card>
    `;
            }
            /**
             *
             * @param hass
             * @param camId
             */
            renderCamera(hass, camId) {
                let camera = hass.states[camId];
                let entity_picture = camera ? camera.attributes.entity_picture : undefined;
                return entity_picture ? html `
        <div @click=${e => this.handlePopup(e, camId)} class="camera-container">
          <div class="camera-image">
            <img src="${entity_picture}" alt="${camera.attributes.friendly_name}"/>
          </div>
        </div>
      ` : html ``;
            }
            /**
             *
             * @param e
             * @param entityId
             */
            handlePopup(e, entityId) {
                e.stopPropagation();
                let ne = new Event('hass-more-info', { composed: true });
                // @ts-ignore
                ne.detail = { entityId };
                this.dispatchEvent(ne);
            }
        };
        __decorate([
            property()
        ], HaCardWeatherConditions.prototype, "hass", void 0);
        __decorate([
            property()
        ], HaCardWeatherConditions.prototype, "_config", void 0);
        HaCardWeatherConditions = __decorate([
            customElement("ha-card-weather-conditions")
        ], HaCardWeatherConditions);
    });
});

export { hacsImagePathExist, manImagePathExist, numberFormat_0dec, numberFormat_1dec };
