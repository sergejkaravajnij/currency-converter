<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

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
function format(value: number, code: Code) {
  const digits = code === "IDR" ? 0 : code === "RUB" ? 2 : 4;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
}
function value(code: Code) {
  if (!rates.value) return "—";
  return format(amount.value * rates.value.rates[selected.value] / rates.value.rates[code], code);
}
function select(code: Code) {
  if (selected.value === code) return;
  const next = rates.value ? amount.value * rates.value.rates[selected.value] / rates.value.rates[code] : amount.value;
  selected.value = code;
  rawAmount.value = String(Number(next.toFixed(8)));
}
function key(input: string) {
  if (input === "AC") rawAmount.value = "";
  else if (input === "back") rawAmount.value = rawAmount.value.slice(0, -1);
  else if (input === ".") { if (!rawAmount.value.includes(".")) rawAmount.value = rawAmount.value || "0"; rawAmount.value += rawAmount.value.endsWith(".") ? "" : "."; }
  else rawAmount.value = rawAmount.value === "0" ? input : rawAmount.value + input;
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
    <header><span class="eyebrow">Currency</span><button class="settings" aria-label="Open currency settings" @click="settingsOpen = true">☰</button></header>
    <section v-if="loading" class="state">Loading official rates…</section>
    <section v-else-if="error" class="state error"><p>{{ error }}</p><button @click="load">Try again</button></section>
    <template v-else-if="rates">
      <p v-if="rates.stale" class="warning">Showing the last available rates.</p>
      <section class="rows" aria-label="Currency values">
        <button v-for="code in visible" :key="code" class="currency-row" :class="{ selected: code === selected }" @click="select(code)">
          <span class="code">{{ code }} <i>⌄</i></span>
          <span class="amount">{{ code === selected ? (rawAmount || "0") : value(code) }}</span>
          <span class="name">{{ names[code] }}</span>
        </button>
      </section>
      <p class="source">Rates: {{ rates.source }} · {{ new Date(rates.effectiveDate).toLocaleDateString(locale) }}</p>
      <section class="keypad" aria-label="Number keypad">
        <button v-for="number in ['7','8','9','4','5','6','1','2','3','0','.']" :key="number" @click="key(number)">{{ number }}</button>
        <button class="action clear" @click="key('AC')">AC</button><button class="action back" aria-label="Backspace" @click="key('back')">⌫</button>
      </section>
    </template>
  </main>
  <div v-if="settingsOpen" class="modal-backdrop" @click.self="settingsOpen = false"><section class="modal"><header><h2>Currencies</h2><button @click="settingsOpen = false">×</button></header><p>Choose the rows to show and their order.</p><div v-for="code in order" :key="code" class="setting-row"><label><input type="checkbox" :checked="!hidden.includes(code)" :disabled="code === selected && !hidden.includes(code)" @change="toggle(code)"/> {{ code }} — {{ names[code] }}</label><span><button aria-label="Move up" @click="move(code, -1)">↑</button><button aria-label="Move down" @click="move(code, 1)">↓</button></span></div></section></div>
</template>
