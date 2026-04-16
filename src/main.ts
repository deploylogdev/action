import * as core from '@actions/core'
import * as github from '@actions/github'
import { readInputs } from './inputs.js'
import { run } from './run.js'
import type { ReleasePayload } from './release.js'

async function main(): Promise<void> {
  try {
    const inputs = readInputs()
    const release = (github.context.payload.release as ReleasePayload | undefined) ?? null

    await run({
      inputs,
      release,
      logger: {
        info: (msg) => core.info(msg),
        warning: (msg) => core.warning(msg),
        debug: (msg) => core.debug(msg),
        setOutput: (name, value) => core.setOutput(name, value),
        setFailed: (msg) => core.setFailed(msg),
      },
    })
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err))
  }
}

void main()
