/**
 * Expressões Regulares pré-compiladas no escopo do módulo.
 * Compiladas uma única vez pelo motor V8 na inicialização (Load Time).
 */
const REGEX_HTML_HEX = /&#x([0-9a-fA-F]+);/g;
const REGEX_HTML_DEC = /&#(\d+);/g;
const REGEX_QUOTES = /[‘’´`]/g;
const REGEX_CONTROL_CHARS = /[\x00-\x1F\x7F]/g;
const REGEX_UNDERSCORE = /_/g;
const REGEX_MULTI_SPACE = /\s+/g;
const REGEX_DIACRITICS = /[\u0300-\u036f]/g;
const REGEX_NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu; // Categoria Unicode Moderna
const REGEX_TRIM_HYPHENS = /^-+|-+$/g;
const REGEX_NON_DIGIT = /\D/g;
const REGEX_HTML_TAGS = /<[^>]*>?/g;
const REGEX_DANGEROUS_CHARS = /[<>"'&]/g;

const HTML_ENTITIES_MAP = {
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '&': '&amp;'
};

/**
 * Classe utilitária para sanitização e normalização de dados de entrada.
 * Focada em alta performance e agnóstica a regras de negócio.
 */
export class DataSanitizer {
  
  /**
   * Purificador inicial: decodifica HTML entities, normaliza aspas, remove caracteres de controle
   * e colapsa espaços/underlines.
   * * @param {string} text - O texto de entrada.
   * @returns {string} O texto básico purificado.
   */
  static toBasic(text) {
    if (typeof text !== 'string') return '';

    return text
      .replace(REGEX_HTML_HEX, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(REGEX_HTML_DEC, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(REGEX_QUOTES, "'")
      .replace(REGEX_CONTROL_CHARS, '')
      .replace(REGEX_UNDERSCORE, ' ')
      .replace(REGEX_MULTI_SPACE, ' ')
      .trim();
  }

  /**
   * Aplica validações restritas em cima do texto purificado usando injeção de regras.
   * IMPORTANTE: As instâncias de RegExp injetadas não devem conter a flag 'g'.
   * @param {string} text - O texto a ser validado.
   * @param {Object} options - Opções de validação.
   * @param {RegExp} [options.whitelist] - Padrão que o texto DEVE seguir estritamente.
   * @param {RegExp[]} [options.fatalPatterns=[]] - Padrões de blacklist que invalidam o texto.
   * @param {string} [options.fallback=''] - Retorno padrão caso falhe em qualquer validação.
   * @returns {string} O texto sanitizado ou o fallback em caso de falha de segurança.
   */
  static toStrictText(text, { whitelist, fatalPatterns = [], fallback = '' } = {}) {
    const basicText = DataSanitizer.toBasic(text);

    for (let i = 0; i < fatalPatterns.length; i++) {
      const pattern = fatalPatterns[i];
      // Uso seguro de .test() assumindo que as Regex injetadas não possuem a flag 'g'
      if (pattern.test(basicText)) {
        return fallback;
      }
    }

    if (whitelist && !whitelist.test(basicText)) {
      return fallback;
    }

    return basicText;
  }

  /**
   * Calcula um escore de periculosidade baseado na quantidade de correspondências
   * de padrões suspeitos injetados (Ex: Injeção de SQL/NoSQL).
   * @param {string} text - O texto a ser analisado.
   * @param {RegExp[]} suspiciousPatterns - Padrões de ataque (devem conter flag 'g' para contagem total).
   * @returns {number} Score inteiro. Quanto maior, mais suspeito.
   */
  static calculateScore(text, suspiciousPatterns = []) {
    if (typeof text !== 'string') return 0;
    
    let score = 0;

    for (let i = 0; i < suspiciousPatterns.length; i++) {
      let pattern = suspiciousPatterns[i];
      
      // Garante a presença da flag 'g' para que o .match() conte todas as ocorrências
      if (!pattern.global) {
        pattern = new RegExp(pattern.source, pattern.flags + 'g');
      }

      const matches = text.match(pattern);
      if (matches) {
        score += matches.length;
      }
    }

    return score;
  }

  /**
   * Converte o texto para formato URL-friendly usando normalização nativa NFD e classes Unicode.
   * * @param {string} text - O texto a ser convertido.
   * @returns {string} Slug resultante.
   */
  static toSlug(text) {
    if (typeof text !== 'string') return '';

    return text
      .normalize('NFD') // Separa caracteres de seus acentos (ex: 'é' -> 'e' + '´')
      .replace(REGEX_DIACRITICS, '') // Remove os acentos avulsos
      .toLowerCase()
      .replace(REGEX_NON_ALPHANUMERIC, '-') // Substitui não-alfanuméricos (suporte Unicode) por hífen
      .replace(REGEX_TRIM_HYPHENS, ''); // Remove hifens nas extremidades
  }

  /**
   * Retira absolutamente tudo do texto que não for dígito numérico (0-9).
   * Útil para preparação de dados de CNH, CPF, ou identificadores estritamente numéricos.
   * * @param {string} text - O texto com impurezas.
   * @returns {string} Apenas os números.
   */
  static toNumeric(text) {
    if (typeof text !== 'string') return '';
    return text.replace(REGEX_NON_DIGIT, '');
  }

  /**
   * Remove tags HTML e escapa caracteres perigosos no conteúdo textual restante.
   * * @param {string} text - O texto HTML.
   * @returns {string} Texto seguro.
   */
  static stripHTML(text) {
    if (typeof text !== 'string') return '';
    
    const noTags = text.replace(REGEX_HTML_TAGS, '');
    return noTags.replace(REGEX_DANGEROUS_CHARS, (char) => HTML_ENTITIES_MAP[char]);
  }
}