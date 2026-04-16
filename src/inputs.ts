import * as core from '@actions/core'

export type EntryType = 'feature' | 'fix' | 'improvement' | 'breaking' | 'announcement'

const ENTRY_TYPES: readonly EntryType[] = [
  'feature',
  'fix',
  'improvement',
  'breaking',
  'announcement',
] as const

export interface ActionInputs {
  apiKey: string
  project: string
  aiSummarize: boolean
  notifySubscribers: boolean
  entryType: EntryType
  apiUrl: string
}

export function readInputs(): ActionInputs {
  const apiKey = core.getInput('api-key', { required: true }).trim()
  const project = core.getInput('project', { required: true }).trim()
  const aiSummarize = readBool('ai-summarize', false)
  const notifySubscribers = readBool('notify-subscribers', false)
  const entryTypeRaw = (core.getInput('entry-type') || 'feature').trim().toLowerCase()
  const apiUrl = (core.getInput('api-url') || 'https://deploylog.dev').trim().replace(/\/+$/, '')

  if (!apiKey.startsWith('dk_')) {
    throw new Error('Invalid api-key. Keys issued by DeployLog start with "dk_".')
  }

  if (!isEntryType(entryTypeRaw)) {
    throw new Error(
      `Invalid entry-type "${entryTypeRaw}". Must be one of: ${ENTRY_TYPES.join(', ')}`,
    )
  }

  return {
    apiKey,
    project,
    aiSummarize,
    notifySubscribers,
    entryType: entryTypeRaw,
    apiUrl,
  }
}

function isEntryType(value: string): value is EntryType {
  return (ENTRY_TYPES as readonly string[]).includes(value)
}

function readBool(name: string, defaultValue: boolean): boolean {
  const raw = core.getInput(name).trim().toLowerCase()
  if (!raw) return defaultValue
  if (['true', '1', 'yes'].includes(raw)) return true
  if (['false', '0', 'no'].includes(raw)) return false
  throw new Error(`Invalid value for ${name}: "${raw}". Expected true or false.`)
}
