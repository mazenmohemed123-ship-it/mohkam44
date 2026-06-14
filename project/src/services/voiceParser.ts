export interface ParsedVoice {
  client_name: string;
  case_number: string;
  case_type: string;
  judgment: string;
  total_fees: string;
  admin_fees: string;
  client_phone: string;
  raw: string;
}

export const extractCaseData = (text: string, lang: string) => {
  const data: any = {};
  const t = text.trim();

  if (lang.startsWith('ar')) {
    const patterns = {
      client_name: /(?:اسم(?:ه|ها|الموكل)?|الموكل(?:\s+اسمه)?)[\s:]+([^\s,،.]+(?:\s[^\s,،.]+)?)/,
      case_number: /(?:رقم(?:\s+القضية)?|القضية(?:\s+رقم)?|ملف(?:\s+رقم)?)[\s:#]+([0-9\-]+)/,
      case_type: /(?:نوع(?:\s+القضية)?|القضية(?:\s+من\s+نوع)?)[\s:]+([^\s,،.]+(?:\s[^\s,،.]+){0,2})/,
      judgment: /(?:الحكم|حكم|النتيجة|الحالة)[\s:]+([^\s,،.]+(?:\s[^\s,،.]+)?)/,
      total_fees: /(?:أتعاب|الأتعاب|مبلغ|المبلغ|التعاب)[\s:]+([0-9,]+)/,
      admin_fees: /(?:مصاريف|المصاريف|مصروفات|رسوم)[\s:]+([0-9,]+)/,
      client_phone: /(?:رقم(?:\s+(?:الهاتف|التليفون|الموبايل))?|تليفون|موبايل)[\s:]+([0-9]{10,11})/,
    };
    Object.entries(patterns).forEach(([key, regex]) => {
      const match = t.match(regex);
      if (match) data[key] = match[1].replace(/,/g, '');
    });
  }

  if (lang === 'en') {
    const patterns = {
      client_name: /(?:client|name|defendant|plaintiff)[\s:is]+([a-zA-Z]+(?:\s[a-zA-Z]+)?)/i,
      case_number: /(?:case|file|docket)[\s:#no.]+([0-9\-]+)/i,
      case_type: /(?:type|case\s+type|matter)[\s:is]+([a-zA-Z]+(?:\s[a-zA-Z]+){0,2})/i,
      judgment: /(?:judgment|verdict|outcome|status)[\s:is]+([a-zA-Z]+(?:\s[a-zA-Z]+)?)/i,
      total_fees: /(?:fees?|amount|total|cost)[\s:]+([0-9,]+)/i,
      admin_fees: /(?:admin(?:istrative)?\s+fees?|expenses?|costs?)[\s:]+([0-9,]+)/i,
      client_phone: /(?:phone|mobile|cell|contact)[\s:#]+([0-9]{10,11})/i,
    };
    Object.entries(patterns).forEach(([key, regex]) => {
      const match = t.match(regex);
      if (match) data[key] = match[1].replace(/,/g, '');
    });
  }

  if (lang === 'fr') {
    const patterns = {
      client_name: /(?:nom(?:\s+du\s+client)?|client)[\s:est]+([a-zA-ZÀ-ÿ]+(?:\s[a-zA-ZÀ-ÿ]+)?)/i,
      case_number: /(?:dossier|affaire|numéro?)[\s:#]+([0-9\-]+)/i,
      case_type: /(?:type(?:\s+d'affaire)?|affaire\s+de)[\s:]+([a-zA-ZÀ-ÿ]+(?:\s[a-zA-ZÀ-ÿ]+){0,2})/i,
      judgment: /(?:jugement|verdict|décision)[\s:]+([a-zA-ZÀ-ÿ]+(?:\s[a-zA-ZÀ-ÿ]+)?)/i,
      total_fees: /(?:honoraires?|montant|frais)[\s:]+([0-9,]+)/i,
      admin_fees: /(?:frais\s+admin|dépenses?)[\s:]+([0-9,]+)/i,
      client_phone: /(?:téléphone|mobile|numéro)[\s:]+([0-9]{10,11})/i,
    };
    Object.entries(patterns).forEach(([key, regex]) => {
      const match = t.match(regex);
      if (match) data[key] = match[1].replace(/,/g, '');
    });
  }

  if (lang === 'ar_ma') {
    const patterns = {
      client_name: /(?:سمية|سمو|الموكل|المتهم|المدعي)[\s:]+([^\s,،.]+(?:\s[^\s,،.]+)?)/,
      case_number: /(?:رقم|ملف|الملف|دوسيي)[\s:#]+([0-9\-]+)/,
      case_type: /(?:نوع|القضية|الملف\s+ديال)[\s:]+([^\s,،.]+(?:\s[^\s,،.]+){0,2})/,
      judgment: /(?:الحكم|النتيجة|القرار)[\s:]+([^\s,،.]+(?:\s[^\s,،.]+)?)/,
      total_fees: /(?:الأتعاب|المبلغ|الفلوس|أتعاب)[\s:]+([0-9,]+)/,
      admin_fees: /(?:المصاريف|رسوم|المصروفات)[\s:]+([0-9,]+)/,
      client_phone: /(?:التليفون|النمرة|الهاتف|رقم)[\s:]+([0-9]{10,11})/,
    };
    Object.entries(patterns).forEach(([key, regex]) => {
      const match = t.match(regex);
      if (match) data[key] = match[1].replace(/,/g, '');
    });
  }

  if (lang === 'tr') {
    const patterns = {
      client_name: /(?:müvekkil|isim|ad|sanık|davacı)[\s:]+([a-zA-ZÇĞİÖŞÜçğışöşü]+(?:\s[a-zA-ZÇĞİÖŞÜ]+)?)/i,
      case_number: /(?:dava\s*no|dosya\s*no|numara)[\s:#]+([0-9\-]+)/i,
      case_type: /(?:dava\s*türü|konu|tür)[\s:]+([a-zA-ZÇĞİÖŞÜ]+(?:\s[a-zA-ZÇĞİÖŞÜ]+){0,2})/i,
      judgment: /(?:karar|hüküm|sonuç)[\s:]+([a-zA-ZÇĞİÖŞÜ]+(?:\s[a-zA-ZÇĞİÖŞÜ]+)?)/i,
      total_fees: /(?:ücret|ödeme|tutar|miktar)[\s:]+([0-9,]+)/i,
      admin_fees: /(?:masraf|gider|idari\s+ücret)[\s:]+([0-9,]+)/i,
      client_phone: /(?:telefon|cep|numara)[\s:]+([0-9]{10,11})/i,
    };
    Object.entries(patterns).forEach(([key, regex]) => {
      const match = t.match(regex);
      if (match) data[key] = match[1].replace(/,/g, '');
    });
  }

  if (lang === 'it') {
    const patterns = {
      client_name: /(?:nome|cliente|imputato|attore)[\s:è]+([a-zA-ZÀ-ÿ]+(?:\s[a-zA-ZÀ-ÿ]+)?)/i,
      case_number: /(?:caso|fascicolo|numero\s*(?:del\s*caso)?)[\s:#]+([0-9\-]+)/i,
      case_type: /(?:tipo(?:\s+di\s+caso)?|materia)[\s:è]+([a-zA-ZÀ-ÿ]+(?:\s[a-zA-ZÀ-ÿ]+){0,2})/i,
      judgment: /(?:sentenza|verdetto|decisione|esito)[\s:è]+([a-zA-ZÀ-ÿ]+(?:\s[a-zA-ZÀ-ÿ]+)?)/i,
      total_fees: /(?:onorario|compenso|importo|totale)[\s:]+([0-9,]+)/i,
      admin_fees: /(?:spese\s+amm|costi\s+amm|spese)[\s:]+([0-9,]+)/i,
      client_phone: /(?:telefono|cellulare|numero)[\s:]+([0-9]{10,11})/i,
    };
    Object.entries(patterns).forEach(([key, regex]) => {
      const match = t.match(regex);
      if (match) data[key] = match[1].replace(/,/g, '');
    });
  }

  if (lang === 'es') {
    const patterns = {
      client_name: /(?:nombre|cliente|demandado|demandante)[\s:es]+([a-zA-ZÁÉÍÓÚÑáéíóúñ]+(?:\s[a-zA-ZÁÉÍÓÚÑ]+)?)/i,
      case_number: /(?:caso|expediente|número\s*(?:de\s*caso)?)[\s:#]+([0-9\-]+)/i,
      case_type: /(?:tipo(?:\s+de\s+caso)?|materia)[\s:es]+([a-zA-ZÁÉÍÓÚÑ]+(?:\s[a-zA-ZÁÉÍÓÚÑ]+){0,2})/i,
      judgment: /(?:sentencia|veredicto|resolución|estado)[\s:]+([a-zA-ZÁÉÍÓÚÑáéíóúñ]+(?:\s[a-zA-ZÁÉÍÓÚÑ]+)?)/i,
      total_fees: /(?:honorarios?|monto|total|importe)[\s:]+([0-9,]+)/i,
      admin_fees: /(?:gastos\s+adm|costas|gastos)[\s:]+([0-9,]+)/i,
      client_phone: /(?:teléfono|móvil|celular|número)[\s:]+([0-9]{10,11})/i,
    };
    Object.entries(patterns).forEach(([key, regex]) => {
      const match = t.match(regex);
      if (match) data[key] = match[1].replace(/,/g, '');
    });
  }

  if (lang === 'de') {
    const patterns = {
      client_name: /(?:name|mandant|beklagter|kläger)[\s:ist]+([a-zA-ZÄÖÜäöüß]+(?:\s[a-zA-ZÄÖÜäöüß]+)?)/i,
      case_number: /(?:fall(?:nummer)?|akte(?:nnummer)?|nummer)[\s:#]+([0-9\-]+)/i,
      case_type: /(?:fallart|art\s+(?:des\s+)?falls|rechtsgebiet)[\s:ist]+([a-zA-ZÄÖÜäöüß]+(?:\s[a-zA-ZÄÖÜäöüß]+){0,2})/i,
      judgment: /(?:urteil|entscheidung|ergebnis|status)[\s:ist]+([a-zA-ZÄÖÜäöüß]+(?:\s[a-zA-ZÄÖÜäöüß]+)?)/i,
      total_fees: /(?:honorar|betrag|gebühren|kosten)[\s:]+([0-9,]+)/i,
      admin_fees: /(?:verwaltungskosten|nebenkosten|auslagen)[\s:]+([0-9,]+)/i,
      client_phone: /(?:telefon|handy|nummer)[\s:]+([0-9]{10,11})/i,
    };
    Object.entries(patterns).forEach(([key, regex]) => {
      const match = t.match(regex);
      if (match) data[key] = match[1].replace(/,/g, '');
    });
  }

  return data;
};

export function parseVoice(text: string, lang: string = 'ar'): ParsedVoice {
  const parsed = extractCaseData(text, lang);
  return {
    client_name: parsed.client_name || '',
    case_number: parsed.case_number || '',
    case_type: parsed.case_type || '',
    judgment: parsed.judgment || '',
    total_fees: parsed.total_fees ? String(parsed.total_fees) : '',
    admin_fees: parsed.admin_fees ? String(parsed.admin_fees) : '',
    client_phone: parsed.client_phone || '',
    raw: text,
  };
}

export interface DetectedIntent {
  type: 'new' | 'update';
  existing: any | null;
  parsed: ParsedVoice;
}

export function detectIntent(text: string, existingCases: any[], lang: string = 'ar'): DetectedIntent {
  const parsed = extractCaseData(text, lang);
  const byNum = parsed.case_number ? existingCases.find((c) => String(c.case_number) === String(parsed.case_number)) : null;
  const byName = parsed.client_name
    ? existingCases.find((c) => c.client_name?.toLowerCase().includes(parsed.client_name.toLowerCase().split(' ')[0]))
    : null;
  const existing = byNum || byName;

  return {
    type: existing ? 'update' : 'new',
    existing,
    parsed: {
      client_name: parsed.client_name || '',
      case_number: parsed.case_number || '',
      case_type: parsed.case_type || '',
      judgment: parsed.judgment || '',
      total_fees: parsed.total_fees ? String(parsed.total_fees) : '',
      admin_fees: parsed.admin_fees ? String(parsed.admin_fees) : '',
      client_phone: parsed.client_phone || '',
      raw: text,
    },
  };
}
