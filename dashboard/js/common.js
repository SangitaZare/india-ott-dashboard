/* Shared helpers for every dashboard page. Plain JavaScript, no build step. */
"use strict";

const OTT = (() => {
  async function loadJson(name) {
    const response = await fetch(`data/${name}.json`);
    if (!response.ok) throw new Error(`Could not load data/${name}.json (${response.status})`);
    return response.json();
  }

  /** Read a CSS custom property, so colours are defined once in style.css. */
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /** Create an element with text content (never innerHTML for data, to keep it safe). */
  function el(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text != null) node.textContent = options.text;
    // setProperty is needed for CSS custom properties such as --swatch (plain assignment ignores them).
    for (const [key, value] of Object.entries(options.style || {})) node.style.setProperty(key, value);
    for (const [key, value] of Object.entries(options.attrs || {})) node.setAttribute(key, value);
    for (const child of children) if (child) node.append(child);
    return node;
  }

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /** "2026-11-23" -> "23 Nov 2026" */
  function formatDate(iso) {
    if (!iso) return "unknown";
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }

  /** "2026-07-31" -> "Jul 2026" */
  function formatMonth(iso) {
    if (!iso) return "unknown";
    const [y, m] = iso.split("-").map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }

  function formatNumber(value, digits = 1) {
    return Number(value).toLocaleString("en-IN", { maximumFractionDigits: digits });
  }

  return { loadJson, cssVar, el, formatDate, formatMonth, formatNumber };
})();
