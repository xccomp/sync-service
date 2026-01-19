import { registerInXcminas } from './RegisterTakeoffInXcminas.js';
import { registerInXcibituruna } from './RegisterTakeoffInXcibituruna.js';
import { registerInXcaparao } from './RegisterTakeoffInXcaparao.js';

const competitionStrategies = {
  'XC_MINAS_GERAL': registerInXcMinasGeral,
  'XC_MINAS_LIGA_LESTE_MINEIRO': registerInXcMinasLigaLesteMineiro,
  'XC_MINAS_LIGA_CERRADO_MINEIRO': registerInXcMinasLigaCerradoMineiro,
  'XC_MINAS_LIGA_SUL_DE_MINAS': registerInXcMinasLigaSulDeMinas,
  'XC_IBITURUNA': registerInXcIbituruna,
  'XCAPARAO': registerInXCaparao

};

export async function registerTakeoffInCompetition({ competition, takeoff }) {
  const specificRegisterFn = competitionStrategies[competition.name]

  if (!specificRegisterFn) {
    throw new Error(`No specific rules found for competition: ${competition.name}`)
  }

  // 2. Executa a lógica específica (validações, regras de pontuação, etc)
  // Passamos os dados e o campo is_active que você criou
  const registrationData = {
    competitionId: competition.id,
    takeoffId: takeoffId,
    notes: notes || '',
    isActive: true // Registro inicia ativado por padrão
  };

  return await specificRegisterFn(competition, takeoff)
}