/**
 * NaviAble AI 3.0 — Command Router
 * 
 * Validates intents against registered schemas, checks parameters,
 * routes execution through CommandExecutor, and returns verified responses.
 */

import { COMMAND_CATALOG, type CommandDefinition } from './CommandRegistry'
import { CommandExecutor, type ExecutionResult } from './CommandExecutor'
import { SpeechOutput } from '../voice/SpeechOutput'
import { VoiceStateManager } from '../voice/VoiceStateManager'
import type { ParsedCommandIntent } from './IntentClassifier'

export class CommandRouterClass {
  /**
   * Route and execute parsed user intent
   */
  public async route(intent: ParsedCommandIntent): Promise<ExecutionResult> {
    console.log(`[CommandRouter] Routing Intent: ${intent.intent} (${intent.category}) [Conf: ${intent.confidence.toFixed(2)}]`)

    // 1. Emergency silence fast path
    if (intent.intent === 'ASSISTANT_STOP_SPEAKING') {
      SpeechOutput.stopSpeaking()
      VoiceStateManager.setState('IDLE')
      return {
        success: true,
        spokenResponse: '',
        actionTaken: 'SILENCE_EXECUTED',
      }
    }

    // 2. Validate against schema if known
    const schema = COMMAND_CATALOG.find(c => c.intent === intent.intent)
    if (schema) {
      // Validate required parameters
      for (const paramDef of schema.parameters) {
        if (paramDef.required && !intent.params[paramDef.name]) {
          console.warn(`[CommandRouter] Missing required parameter: ${paramDef.name}`)
          const prompt = `Please specify the ${paramDef.name}.`
          VoiceStateManager.setState('SPEAKING')
          VoiceStateManager.addTurn('navi', prompt)
          await SpeechOutput.speak(prompt, 'HIGH')
          return {
            success: false,
            spokenResponse: prompt,
            actionTaken: 'MISSING_PARAM',
          }
        }
      }
    }

    // 3. Set state to EXECUTING_COMMAND
    VoiceStateManager.setState('EXECUTING_COMMAND')

    // 4. Execute via CommandExecutor
    const result = await CommandExecutor.execute(intent)

    // 5. Output response if any
    if (result.spokenResponse) {
      VoiceStateManager.addTurn('navi', result.spokenResponse, intent.intent, result.success)
      VoiceStateManager.setState('SPEAKING')
      await SpeechOutput.speak(result.spokenResponse, 'HIGH')
    } else {
      VoiceStateManager.setState('IDLE')
    }

    return result
  }
}

export const CommandRouter = new CommandRouterClass()
