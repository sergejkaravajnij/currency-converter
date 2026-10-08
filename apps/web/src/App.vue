<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Delete, Globe, ListChecks, Maximize2, Minimize2 } from "@lucide/vue";

const allCodes = ["USD", "GEL", "RUB", "EUR", "GBP", "PLN", "TRY", "JPY", "CNY", "HKD", "IDR"] as const;
type Code = (typeof allCodes)[number];
type Language = "en" | "ru";
type Snapshot = { rates: Record<Code, number>; effectiveDate: string; fetchedAt: string; source: string; stale: boolean };
const names: Record<Language, Record<Code, string>> = {
  en: { USD: "US Dollar", GEL: "Georgian Lari", RUB: "Russian Ruble", EUR: "Euro", GBP: "British Pound", PLN: "Polish Zloty", TRY: "Turkish Lira", JPY: "Japanese Yen", CNY: "Chinese Yuan", HKD: "Hong Kong Dollar", IDR: "Indonesian Rupiah" },
  ru: { USD: "Доллар США", GEL: "Грузинский лари", RUB: "Российский рубль", EUR: "Евро", GBP: "Фунт стерлингов", PLN: "Польский злотый", TRY: "Турецкая лира", JPY: "Японская иена", CNY: "Китайский юань", HKD: "Гонконгский доллар", IDR: "Индонезийская рупия" },
};
const copy = {
  en: { title: "Currency Converter", clear: "Clear amount", settings: "Open language and number format settings", settingsTitle: "Settings", numberFormat: "Number format", saved: "Settings are saved automatically in your browser.", loading: "Loading official rates…", unavailable: "Rates are not available yet.", failed: "Could not load exchange rates.", retry: "Try again", stale: "Showing the last available rates.", values: "Currency values", amount: "Currency amount", rates: "Rates", editCurrencies: "Edit", done: "Done", compactMode: "Compact mode", standardMode: "Standard mode", hide: "Hide currency", decimal: "Decimal separator", thousands: "Thousands separator", language: "Language", comma: "Comma (,)", dot: "Dot (.)", space: "Space", none: "None", english: "English", russian: "Русский", moveUp: "Move up", moveDown: "Move down" },
  ru: { title: "Конвертер валют", clear: "Очистить сумму", settings: "Открыть настройки языка и формата чисел", settingsTitle: "Настройки", numberFormat: "Формат чисел", saved: "Настройки автоматически сохраняются в браузере.", loading: "Загрузка официальных курсов…", unavailable: "Курсы пока недоступны.", failed: "Не удалось загрузить курсы.", retry: "Повторить", stale: "Показаны последние доступные курсы.", values: "Значения валют", amount: "Сумма в валюте", rates: "Курсы", editCurrencies: "Изменить", done: "Готово", compactMode: "Компактный режим", standardMode: "Обычный режим", hide: "Скрыть валюту", decimal: "Десятичный разделитель", thousands: "Разделитель тысяч", language: "Язык", comma: "Запятая (,)", dot: "Точка (.)", space: "Пробел", none: "Нет", english: "English", russian: "Русский", moveUp: "Выше", moveDown: "Ниже" },
} as const;
const stored = JSON.parse(localStorage.getItem("currency-preferences") ?? "{}") as { order?: Code[]; hidden?: Code[]; decimalSeparator?: "." | ","; groupSeparator?: " " | "." | "," | ""; language?: Language; compactMode?: boolean };
const savedOrder = stored.order?.filter((code) => allCodes.includes(code)) ?? [];
const order = ref<Code[]>([...savedOrder, ...allCodes.filter((code) => !savedOrder.includes(code))]);
const hidden = ref<Code[]>(stored.hidden?.filter((code) => allCodes.includes(code)) ?? []);
const decimalSeparator = ref<"." | ",">(stored.decimalSeparator ?? ",");
const groupSeparator = ref<" " | "." | "," | "">(stored.groupSeparator ?? " ");
const language = ref<Language>(stored.language ?? "en");
const selected = ref<Code>("USD");
const rawAmount = ref("1");
const rates = ref<Snapshot | null>(null);
const error = ref("");
const loading = ref(true);
const settingsOpen = ref(false);
const currencyEditMode = ref(false);
const compactMode = ref(stored.compactMode ?? false);

const amount = computed(() => Number(rawAmount.value.replace(",", ".")) || 0);
const visible = computed(() => order.value.filter((code) => currencyEditMode.value || !hidden.value.includes(code)));
const locale = computed(() => language.value === "ru" ? "ru-RU" : "en-US");
function t(key: keyof typeof copy.en) { return copy[language.value][key]; }
function format(value: number, _code: Code) {
  const plain = new Intl.NumberFormat("en-US", { useGrouping: false, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value);
  const [whole, fractional] = plain.split(".");
  const grouped = groupSeparator.value ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator.value) : whole;
  return fractional ? `${grouped}${decimalSeparator.value}${fractional}` : grouped;
}
function displayedRawAmount() {
  return rawAmount.value.replace(".", decimalSeparator.value);
}
function value(code: Code) {
  if (!rates.value) return "—";
  return format(amount.value * rates.value.rates[selected.value] / rates.value.rates[code], code);
}
function rateStatus(snapshot: Snapshot) {
  const [year, month, day] = snapshot.effectiveDate.slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const calendarDate = date.toLocaleDateString(locale.value, { year: "numeric", month: "long", day: "numeric" });
  const weekday = date.toLocaleDateString(locale.value, { weekday: "long" });
  return language.value === "ru"
    ? `Официальный курс от ${calendarDate} (${weekday})`
    : `Official rate from ${weekday}, ${calendarDate}`;
}
function rateDate(snapshot: Snapshot) {
  const [year, month, day] = snapshot.effectiveDate.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale.value, { year: "numeric", month: "long", day: "numeric" });
}
function compactRateStatus(snapshot: Snapshot) {
  return language.value === "ru" ? `Курсы от ${rateDate(snapshot)}` : `Rates from ${rateDate(snapshot)}`;
}
function select(code: Code) {
  if (selected.value === code) return;
  const next = rates.value ? amount.value * rates.value.rates[selected.value] / rates.value.rates[code] : amount.value;
  selected.value = code;
  rawAmount.value = String(Number(next.toFixed(2)));
}
function activateInput(code: Code, event: Event) {
  if (selected.value !== code) selected.value = code;
  rawAmount.value = "";
  const input = event.target as HTMLInputElement;
  requestAnimationFrame(() => {
    input.focus();
    input.setSelectionRange(0, 0);
  });
}
function clearAmount() {
  selected.value = "USD";
  rawAmount.value = "1";
}
function toggleCurrencyEdit() {
  currencyEditMode.value = !currencyEditMode.value;
}
function updateAmount(code: Code, event: Event) {
  const input = event.target as HTMLInputElement;
  const withoutGrouping = groupSeparator.value ? input.value.split(groupSeparator.value).join("") : input.value;
  const normalized = withoutGrouping.split(decimalSeparator.value).join(".").replace(/[^\d.]/g, "");
  const [whole = "", ...decimals] = normalized.split(".");
  const next = decimals.length ? `${whole}.${decimals.join("").slice(0, 2)}` : whole;
  if (selected.value !== code) selected.value = code;
  rawAmount.value = next;
}
function applyAmount(code: Code, event: KeyboardEvent) {
  updateAmount(code, event);
  const input = event.target as HTMLInputElement;
  input.blur();
}
function move(code: Code, direction: -1 | 1) {
  const index = order.value.indexOf(code), target = index + direction;
  if (target < 0 || target >= order.value.length) return;
  [order.value[index], order.value[target]] = [order.value[target], order.value[index]];
}
function toggle(code: Code) {
  if (hidden.value.includes(code)) {
    hidden.value = hidden.value.filter((item) => item !== code);
    return;
  }
  const nextHidden = [...hidden.value, code];
  if (code === selected.value) {
    const nextSelected = order.value.find((item) => !nextHidden.includes(item));
    if (nextSelected) {
      select(nextSelected);
    }
  }
  hidden.value = nextHidden;
}
async function load() {
  loading.value = true; error.value = "";
  try {
    const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
    const response = await fetch(`${base}/api/rates`);
    if (!response.ok) throw new Error(response.status === 503 ? t("unavailable") : t("failed"));
    rates.value = await response.json();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : t("failed"); }
  finally { loading.value = false; }
}
watch([order, hidden, decimalSeparator, groupSeparator, language, compactMode], () => localStorage.setItem("currency-preferences", JSON.stringify({ order: order.value, hidden: hidden.value, decimalSeparator: decimalSeparator.value, groupSeparator: groupSeparator.value, language: language.value, compactMode: compactMode.value })), { deep: true });
watch(language, () => { document.title = t("title"); }, { immediate: true });
onMounted(() => {
  load();
});
</script>

<template>
  <main class="calculator" :class="{ compact: compactMode }">
    <header><span v-if="!compactMode" class="eyebrow">{{ t("title") }}</span><span v-else></span><span class="header-actions"><button v-if="currencyEditMode" class="compact-toggle" :class="{ active: compactMode }" :aria-label="compactMode ? t('standardMode') : t('compactMode')" :title="compactMode ? t('standardMode') : t('compactMode')" @click="compactMode = !compactMode"><Maximize2 v-if="compactMode"/><Minimize2 v-else/></button><button class="currency-edit-toggle" :class="{ active: currencyEditMode }" :aria-label="currencyEditMode ? t('done') : t('editCurrencies')" :title="currencyEditMode ? t('done') : t('editCurrencies')" @click="toggleCurrencyEdit"><ListChecks/></button><button class="settings" :aria-label="t('settings')" :title="t('settings')" @click="settingsOpen = true"><Globe/></button></span></header>
    <section v-if="loading" class="state">{{ t("loading") }}</section>
    <section v-else-if="error" class="state error"><p>{{ error }}</p><button @click="load">{{ t("retry") }}</button></section>
    <template v-else-if="rates">
      <p v-if="rates.stale" class="warning">{{ t("stale") }}</p>
      <section class="rows" :aria-label="t('values')">
        <div class="rows-toolbar"><button class="clear-top" :aria-label="t('clear')" :title="t('clear')" @click="clearAmount"><Delete/><span>AC</span></button></div>
        <article v-for="code in visible" :key="code" class="currency-row" :class="{ selected: code === selected, hidden: hidden.includes(code) }">
          <div class="code-area"><span class="code">{{ code }}</span><span v-if="currencyEditMode" class="row-actions"><button :aria-label="t('moveUp')" @click="move(code, -1)">↑</button><button :aria-label="t('moveDown')" @click="move(code, 1)">↓</button><label class="currency-visibility" :title="t('hide')"><input type="checkbox" :checked="!hidden.includes(code)" :aria-label="t('hide')" @change="toggle(code)"/></label></span></div>
          <input class="amount" type="text" inputmode="decimal" enterkeyhint="enter" :aria-label="t('amount')" :value="code === selected ? displayedRawAmount() : value(code)" @focus="activateInput(code, $event)" @click="activateInput(code, $event)" @input="updateAmount(code, $event)" @keydown.enter.prevent.stop="applyAmount(code, $event)" />
          <span v-if="!compactMode" class="name">{{ names[language][code] }}</span>
        </article>
      </section>
      <p v-if="!compactMode" class="source">{{ t("rates") }}: {{ rates.source }}</p>
      <p class="rate-status" :class="{ 'compact-rate-status': compactMode }">{{ compactMode ? compactRateStatus(rates) : rateStatus(rates) }}</p>
    </template>
  </main>
  <div v-if="settingsOpen" class="modal-backdrop" @click.self="settingsOpen = false">
    <section class="modal" role="dialog" aria-modal="true" :aria-label="t('settingsTitle')">
      <header class="modal-header"><h2>{{ t("settingsTitle") }}</h2><button class="close" aria-label="Close" @click="settingsOpen = false">×</button></header>
      <section class="settings-section">
        <h3>{{ t("language") }}</h3>
        <div class="language-settings"><select v-model="language" :aria-label="t('language')"><option value="en">{{ t("english") }}</option><option value="ru">{{ t("russian") }}</option></select></div>
      </section>
      <section class="settings-section">
        <h3>{{ t("numberFormat") }}</h3>
        <div class="format-settings">
          <label>{{ t("decimal") }}<select v-model="decimalSeparator"><option value=",">{{ t("comma") }}</option><option value=".">{{ t("dot") }}</option></select></label>
          <label>{{ t("thousands") }}<select v-model="groupSeparator"><option value=" ">{{ t("space") }}</option><option value=",">{{ t("comma") }}</option><option value=".">{{ t("dot") }}</option><option value="">{{ t("none") }}</option></select></label>
        </div>
      </section>
      <p class="settings-note">{{ t("saved") }}</p>
    </section>
  </div>
</template>
