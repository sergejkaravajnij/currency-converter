<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";

const allCodes = ["USD", "GEL", "RUB", "EUR", "GBP", "PLN", "IDR"] as const;
type Code = (typeof allCodes)[number];
type Snapshot = { rates: Record<Code, number>; effectiveDate: string; fetchedAt: string; source: string; stale: boolean };
const names: Record<Code, string> = { USD: "US Dollar", GEL: "Georgian Lari", RUB: "Russian Ruble", EUR: "Euro", GBP: "British Pound", PLN: "Polish Zloty", IDR: "Indonesian Rupiah" };
const stored = JSON.parse(localStorage.getItem("currency-preferences") ?? "{}") as { order?: Code[]; hidden?: Code[] };
const order = ref<Code[]>(stored.order?.filter((code) => allCodes.includes(code)) ?? [...allCodes]);
const hidden = ref<Code[]>(stored.hidden ?? []);
const selected = ref<Code>("USD");
const rawAmount = ref("1");
const rates = ref<Snapshot | null>(null);
const error = ref("");
const loading = ref(true);
const settingsOpen = ref(false);

const amount = computed(() => Number(rawAmount.value.replace(",", ".")) || 0);
const visible = computed(() => order.value.filter((code) => !hidden.value.includes(code)));
const locale = "en-US";
function format(value: number, _code: Code) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value);
}
function value(code: Code) {
  if (!rates.value) return "—";
  return format(amount.value * rates.value.rates[selected.value] / rates.value.rates[code], code);
}
function select(code: Code) {
  if (selected.value === code) return;
  const next = rates.value ? amount.value * rates.value.rates[selected.value] / rates.value.rates[code] : amount.value;
  selected.value = code;
  rawAmount.value = String(Number(next.toFixed(2)));
}
async function focusAmount(code: Code, event: FocusEvent) {
  select(code);
  await nextTick();
  const input = event.target as HTMLInputElement;
  const position = input.value.length;
  input.setSelectionRange(position, position);
}
function clearAmount() {
  rawAmount.value = "0";
}
function updateAmount(code: Code, event: Event) {
  const input = event.target as HTMLInputElement;
  const normalized = input.value.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole = "", ...decimals] = normalized.split(".");
  const next = decimals.length ? `${whole}.${decimals.join("").slice(0, 2)}` : whole;
  if (selected.value !== code) selected.value = code;
  rawAmount.value = next;
}
function move(code: Code, direction: -1 | 1) {
  const index = order.value.indexOf(code), target = index + direction;
  if (target < 0 || target >= order.value.length) return;
  [order.value[index], order.value[target]] = [order.value[target], order.value[index]];
}
function toggle(code: Code) {
  if (code === selected.value && !hidden.value.includes(code)) return;
  hidden.value = hidden.value.includes(code) ? hidden.value.filter((item) => item !== code) : [...hidden.value, code];
}
async function load() {
  loading.value = true; error.value = "";
  try {
    const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
    const response = await fetch(`${base}/api/rates`);
    if (!response.ok) throw new Error(response.status === 503 ? "Rates are not available yet." : "Could not load exchange rates.");
    rates.value = await response.json();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "Could not load exchange rates."; }
  finally { loading.value = false; }
}
watch([order, hidden], () => localStorage.setItem("currency-preferences", JSON.stringify({ order: order.value, hidden: hidden.value })), { deep: true });
onMounted(load);
</script>

<template>
  <main class="calculator">
    <header><span class="eyebrow">Currency</span><span class="header-actions"><button class="clear-top" aria-label="Clear amount" @click="clearAmount">AC</button><button class="settings" aria-label="Open currency settings" @click="settingsOpen = true">☰</button></span></header>
    <section v-if="loading" class="state">Loading official rates…</section>
    <section v-else-if="error" class="state error"><p>{{ error }}</p><button @click="load">Try again</button></section>
    <template v-else-if="rates">
      <p v-if="rates.stale" class="warning">Showing the last available rates.</p>
      <section class="rows" aria-label="Currency values">
        <article v-for="code in visible" :key="code" class="currency-row" :class="{ selected: code === selected }">
          <span class="code">{{ code }}</span>
          <input class="amount" type="text" inputmode="decimal" aria-label="Currency amount" :value="code === selected ? (rawAmount || '0') : value(code)" @focus="focusAmount(code, $event)" @input="updateAmount(code, $event)" />
          <span class="name">{{ names[code] }}</span>
        </article>
      </section>
      <p class="source">Rates: {{ rates.source }} · {{ new Date(rates.effectiveDate).toLocaleDateString(locale) }}</p>
    </template>
  </main>
  <div v-if="settingsOpen" class="modal-backdrop" @click.self="settingsOpen = false"><section class="modal"><header><h2>Currencies</h2><button @click="settingsOpen = false">×</button></header><p>Choose the rows to show and their order.</p><div v-for="code in order" :key="code" class="setting-row"><label><input type="checkbox" :checked="!hidden.includes(code)" :disabled="code === selected && !hidden.includes(code)" @change="toggle(code)"/> {{ code }} — {{ names[code] }}</label><span><button aria-label="Move up" @click="move(code, -1)">↑</button><button aria-label="Move down" @click="move(code, 1)">↓</button></span></div></section></div>
</template>
