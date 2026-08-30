import { getFinancialTools } from './financialTools';
import { getRoomieTools } from './roomieTools';
import { getPantryTools } from './pantryTools';
import { getPersonTools } from './personTools';
import { getMoodHabitTools } from './moodHabitTools';
import { getProductivityTools } from './productivityTools';
import { getHealthTools } from './healthTools';
import { getWardrobeTools } from './wardrobeTools';

export function getSofiTools(userId: string) {
  const rawTools = {
    ...getFinancialTools(userId),
    ...getRoomieTools(userId),
    ...getPantryTools(userId),
    ...getPersonTools(userId),
    ...getMoodHabitTools(userId),
    ...getProductivityTools(userId),
    ...getHealthTools(userId),
    ...getWardrobeTools(userId),
  };

  // Envolver cada herramienta con logs visuales en consola
  const instrumentedTools: Record<string, any> = {};

  for (const [toolName, toolDef] of Object.entries(rawTools)) {
    const originalExecute = (toolDef as any).execute;
    if (typeof originalExecute === 'function') {
      instrumentedTools[toolName] = {
        ...toolDef,
        execute: async (args: any, context: any) => {
          console.log(`\n  🛠️  [Tool Calling] ➔ ${toolName}`);
          console.log(`     📥 Argumentos:`, JSON.stringify(args, null, 2));
          try {
            const result = await originalExecute(args, context);
            console.log(`     ✅ Resultado:`, JSON.stringify(result, null, 2));
            return result;
          } catch (err) {
            console.error(`     ❌ Error en Tool [${toolName}]:`, err);
            throw err;
          }
        },
      };
    } else {
      instrumentedTools[toolName] = toolDef;
    }
  }

  return instrumentedTools;
}

export {
  getFinancialTools,
  getRoomieTools,
  getPantryTools,
  getPersonTools,
  getMoodHabitTools,
  getProductivityTools,
  getHealthTools,
  getWardrobeTools,
};

