<script setup lang="ts">
import { Plus, Trash, WarningTriangle } from '@iconoir/vue'
import { computed, ref } from 'vue'
import type { TemplateVariable, VariableType, VariableValues } from '../api/templates'
import { suggestKey, variableKeyPattern } from '../lib/variables'

const props = defineProps<{ counts: Map<string, number>; undeclared: string[]; readonly: boolean; canInsert: boolean }>()
const variables = defineModel<TemplateVariable[]>({ required: true })
const samples = defineModel<VariableValues>('samples', { required: true })
const emit = defineEmits<{ insert: [key: string] }>()

const newKey = ref('')
const error = ref<string | null>(null)

const typeItems = [
  { label: 'Text', value: 'string' },
  { label: 'Number', value: 'number' },
]

function add() {
  const key = suggestKey(newKey.value)
  if (!key) return
  if (!variableKeyPattern.test(key)) {
    error.value = 'Use letters, numbers and underscores'
    return
  }
  if (variables.value.some((variable) => variable.key === key)) {
    error.value = `${key} already exists`
    return
  }
  variables.value = [...variables.value, { key, type: 'string' }]
  newKey.value = ''
  error.value = null
}

function declare(key: string) {
  if (!variables.value.some((variable) => variable.key === key)) variables.value = [...variables.value, { key, type: 'string' }]
}

function update(key: string, patch: Partial<TemplateVariable>) {
  variables.value = variables.value.map((variable) => {
    if (variable.key !== key) return variable
    const next = { ...variable, ...patch }
    if (next.fallback === '' || next.fallback === undefined) delete next.fallback
    if (next.type === 'number' && next.fallback !== undefined) {
      const number = Number(next.fallback)
      if (Number.isFinite(number)) next.fallback = number
      else delete next.fallback
    }
    return next
  })
}

function remove(key: string) {
  variables.value = variables.value.filter((variable) => variable.key !== key)
}

const braces = (key: string) => `{{${key}}}`

const usage = (key: string) => props.counts.get(key) ?? 0

const sorted = computed(() => [...variables.value])

function setSample(key: string, value: string) {
  const next = { ...samples.value }
  if (value === '') delete next[key]
  else next[key] = value
  samples.value = next
}

const inputClass =
  'h-7 w-full min-w-0 rounded-sm bg-white px-2 text-xs text-slate-900 outline-none ring-1 ring-slate-200 transition-shadow placeholder:text-slate-400 focus:ring-slate-400 disabled:opacity-60'
</script>

<template>
  <div class="grid gap-4 p-4">
    <div v-if="undeclared.length" class="rounded-sm bg-amber-50 p-3 ring-1 ring-amber-200">
      <p class="m-0 flex items-center gap-1.5 text-xs font-medium text-amber-900"><WarningTriangle aria-hidden="true" class="size-3.5" />Used but not declared</p>
      <ul class="m-0 mt-2 grid list-none gap-1.5 p-0">
        <li v-for="key in undeclared" :key="key" class="flex items-center justify-between gap-2">
          <code class="truncate font-mono text-xs text-amber-900">{{ key }}</code>
          <button v-if="!readonly" type="button" class="shrink-0 rounded-sm px-1.5 text-xs font-medium text-amber-900 underline-offset-2 hover:underline" @click="declare(key)">Declare</button>
        </li>
      </ul>
      <p class="m-0 mt-2 text-[11px] leading-relaxed text-amber-800">They’re declared as required text when you save.</p>
    </div>

    <p v-if="!variables.length && !undeclared.length" class="m-0 text-xs leading-relaxed text-slate-500">
      Variables fill in per send, like a name or a link. Type <kbd class="rounded-sm bg-slate-100 px-1 font-mono text-[11px] text-slate-700">{{ '{{' }}</kbd> in the email to add one.
    </p>

    <ul v-if="variables.length" class="m-0 grid list-none gap-2 p-0">
      <li v-for="variable in sorted" :key="variable.key" class="rounded-sm bg-white p-2.5 ring-1 ring-slate-200">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="tpl-variable !m-0 truncate disabled:cursor-default"
            :disabled="readonly || !canInsert"
            :title="canInsert ? 'Insert at the cursor' : undefined"
            @click="emit('insert', variable.key)"
          >{{ braces(variable.key) }}</button>
          <span class="ml-auto shrink-0 font-mono text-[10.5px] text-slate-400">{{ usage(variable.key) ? `used ${usage(variable.key)}×` : 'unused' }}</span>
          <button v-if="!readonly" type="button" class="flex size-6 shrink-0 items-center justify-center rounded-sm text-slate-400 hover:bg-red-50 hover:text-red-600" :aria-label="`Remove ${variable.key}`" @click="remove(variable.key)"><Trash class="size-3.5" /></button>
        </div>
        <div class="mt-2 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-1.5">
          <USelect
            :model-value="variable.type"
            :items="typeItems"
            size="xs"
            :disabled="readonly"
            :aria-label="`${variable.key} type`"
            :ui="{ base: 'h-7 rounded-sm bg-white text-xs' }"
            @update:model-value="(value) => update(variable.key, { type: value as VariableType })"
          />
          <input
            :value="variable.fallback ?? ''"
            :class="inputClass"
            :disabled="readonly"
            :inputmode="variable.type === 'number' ? 'decimal' : undefined"
            placeholder="No fallback, required"
            :aria-label="`${variable.key} fallback`"
            @change="(event) => update(variable.key, { fallback: (event.target as HTMLInputElement).value })"
          />
        </div>
        <input
          :value="samples[variable.key] ?? ''"
          :class="[inputClass, 'mt-1.5 border-dashed']"
          placeholder="Sample value for preview"
          :aria-label="`${variable.key} sample value`"
          @input="(event) => setSample(variable.key, (event.target as HTMLInputElement).value)"
        />
      </li>
    </ul>

    <form v-if="!readonly" class="grid gap-1" @submit.prevent="add">
      <div class="flex gap-1.5">
        <input v-model="newKey" :class="[inputClass, 'font-mono']" placeholder="new_variable" aria-label="New variable name" maxlength="50" spellcheck="false" @input="error = null" />
        <button type="submit" class="flex h-7 shrink-0 items-center gap-1 rounded-sm px-2 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50" :disabled="!newKey.trim()"><Plus class="size-3.5" />Add</button>
      </div>
      <p v-if="error" role="alert" class="m-0 text-xs text-red-600">{{ error }}</p>
    </form>
  </div>
</template>
