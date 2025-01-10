import { isNumeric, stringTemplate } from '#libs/utils/string-utils.js'
import { logger } from '#logger'
import SyncReport from '#sync-report'
import { SyncProcessor } from '../sync-porcessor.js'

export const executeRules = async (data, step, syncConfig, syncReport) => {
  const rulesSequence = rulesSequenceByStep[step]
  let checkedData = data
  for (const ruleId of rulesSequence) {
    const rule = findRuleById(ruleId, syncConfig)
    if (!rule) {
      createRuleNotFoundLogs(ruleId, step, syncReport)
      throw new Error('Rule not found on sync-config.json')
    }
    if (rule.disabled) {
      createRuleDisabledLogs(rule, step, syncReport)
      continue
    } 
    checkedData = await executeRuleMethod(checkedData, rule, syncReport)
  }
  return checkedData
} 

const transformRulesSequence = [
  'transform/criticalInconsistenceIfVeryLowQuantity',
  'transform/criticalInconsistenceIfMaxNotNumericCbvlId',
  'transform/criticalInconsistenceIfMaxHasNoName',
  'transform/criticalInconsistenceIfMaxPending',
  'transform/criticalInconsistenceIfMinParagliderPilots',
  'transform/criticalInconsistenceIfMaxNeitherParagliderNorHangglider',
  'transform/inconsistenceIfLowQuantity',
  'transform/inconsistenceIfIsNotNumericCbvlId',
  'transform/inconsistenceIfHasNoName',
  'transform/inconsistenceIfNeitherParagliderNorHangglider',
  'transform/inconsistenceIfLevelUndefined',
  'transform/inconsistenceIfMaxLevelUndefined',
]

const tansformRulesMethods = {
  criticalInconsistenceIfVeryLowQuantity: (data, rule, syncReport) => {
    const minQuantity = rule.value
    const quantity = data.length
    if (quantity < minQuantity) {
      createRuleLogs(rule, { count: quantity }, syncReport, null, SyncReport.OCCURENCE_TYPES.criticalDataInconssitence)  
      throw new Error(stringTemplate(rule.text, { count: quantity }))
    }
    return data
  },
  inconsistenceIfLowQuantity: (data, rule, syncReport) => { 
    const minQuantity = rule.value
    const quantity = data.length
    if (quantity < minQuantity) {
      createRuleLogs(rule, { count: quantity }, syncReport, null, SyncReport.OCCURENCE_TYPES.dataInconssitence)
    }
    return data
  },
  inconsistenceIfIsNotNumericCbvlId: (data, rule, syncReport) => {
    let index = data.length
    while (index--) {
      if (!isNumeric(data[index].cbvlId)) {
        const removedPilot = splice(index, 1)
        createRuleLogs(rule, null, syncReport, removedPilot, SyncReport.OCCURENCE_TYPES.dataInconssitence)
      } 
    }
    return data
  },
  criticalInconsistenceIfMaxNotNumericCbvlId: (data, rule, syncReport) => { 
    const maxNotNumeric = rule.value
    const countNotNumeric = data.filter(pilotData => !isNumeric(pilotData.cbvlId)).length
    if (countNotNumeric > maxNotNumeric) {
      createRuleLogs(rule, { count: countNotNumeric }, syncReport, null, SyncReport.OCCURENCE_TYPES.criticalDataInconssitence)
      throw new Error(stringTemplate(rule.text, { count: countNotNumeric }))
    }
    return data
  },
  inconsistenceIfHasNoName: (data, rule, syncReport) => { return data },
  criticalInconsistenceIfMaxHasNoName: (data, rule, syncReport) => { return data },
  criticalInconsistenceIfMaxPending: (data, rule, syncReport) => { return data },
  criticalInconsistenceIfMinParagliderPilots: (data, rule, syncReport) => { return data },
  inconsistenceIfNeitherParagliderNorHangglider: (data, rule, syncReport) => { return data },
  criticalInconsistenceIfMaxNeitherParagliderNorHangglider: (data, rule, syncReport) => { return data },
  inconsistenceIfLevelUndefined: (data, rule, syncReport) => { return data },
  inconsistenceIfMaxLevelUndefined: (data, rule, syncReport) => { return data },
}

const scrapeRulesSequence   = [
  'scrape/criticalInconsistenceIfVeryLowQuantity',
  'scrape/inconsistenceIfLowQuantity'
]

const scrapRulesMethods = {
  criticalInconsistenceIfVeryLowQuantity: (data, rule, syncReport) => {
    const minQuantity = rule.value
    const quantity = data.length
    if (quantity < minQuantity) {
      createRuleLogs(rule, { count: quantity }, syncReport, null, SyncReport.OCCURENCE_TYPES.criticalDataInconssitence)  
      throw new Error(stringTemplate(rule.text, { count: quantity }))
    }
    return data
  },
  inconsistenceIfLowQuantity: (data, rule, syncReport) => { 
    const minQuantity = rule.value
    const quantity = data.length
    if (quantity < minQuantity) {
      createRuleLogs(rule, { count: quantity }, syncReport, null, SyncReport.OCCURENCE_TYPES.dataInconssitence)
    }
    return data
  },
}


function findRuleById (ruleId, syncConfig) {
  const rules = syncConfig.pillotSync[ruleId.split('/')[0]].rules
  return rules.find(rule => rule.id === ruleId)
}

async function executeRuleMethod(data, rule, syncReport) {
  logger.info(`Iniciando aplicação de regra ${rule.id}`)
  const step = rule.id.split('/')[0].toLowerCase()
  const methodName = rule.id.split('/')[1]
  const rulesMethods = rulesMethodsByStep[step]
  return await rulesMethods[methodName](data, rule, syncReport)
  logger.info(`Aplicação da regra ${rule.id} finalizada`) 
}

function createRuleLogs (rule, ruleTextValues, syncReport, SyncReportDetails, syncReportOccuerncType) {
  const step = rule.id.split('/')[0]
  const log = stringTemplate(rule.text, ruleTextValues)
  
  const errorTypes = [
    SyncReport.OCCURENCE_TYPES.error,
    SyncReport.OCCURENCE_TYPES.criticalDataInconssitence
  ]
  errorTypes.includes(syncReportOccuerncType) 
    ? logger.error(`sync-procces: 'SYNC-PILOT' - step: ${step.toUpperCase()} | ${log}`) 
    : logger.warn(`sync-procces: 'SYNC-PILOT' - step: ${step.toUpperCase()} | ${log}`)

  syncReport.addOccurrence({ 
    process: 'SYNC-PILOT',
    step: SyncProcessor.STEP_NAMES[step.toLowerCase()], 
    type: syncReportOccuerncType,
    info: log,
    details: SyncReportDetails
  })
}

async function createRuleNotFoundLogs(ruleId, step, syncReport) {
  const log = `Rule "${ruleId}" not found on sync-config.json`
  logger.info(`sync-procces: 'SYNC-PILOT' - step: ${step.toUpperCase()} | ${log}`)
  syncReport.addOccurrence({ 
    process: 'SYNC-PILOT',
    step: SyncProcessor.STEP_NAMES[step.toLowerCase()], 
    type: SyncReport.OCCURENCE_TYPES.error,
    info: log,
  })
}

async function createRuleDisabledLogs(rule, step, syncReport) {
  const log = `Rule "${rule.id}" is disabled`
  logger.warn(`sync-procces: 'SYNC-PILOT' - step: ${step.toUpperCase()} | ${log}`)
  syncReport.addOccurrence({ 
    process: 'SYNC-PILOT',
    step: SyncProcessor.STEP_NAMES[step.toLowerCase()], 
    type: SyncReport.OCCURENCE_TYPES.warning,
    info: log
  })
}

const rulesMethodsByStep = {
  scrape: scrapRulesMethods,
  transform: tansformRulesMethods,
  load: {},
  syncronize: {},
  postProcess: {}
}

const rulesSequenceByStep = {
  scrape: scrapeRulesSequence,
  transform: transformRulesSequence,
  load: [],
  syncronize: [],
  postProcess: []
}