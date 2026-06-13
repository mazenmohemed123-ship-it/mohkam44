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
  const t = text.toLowerCase().trim();

  if (lang.startsWith('ar')) {
    // اسم الموكل — طرق متعددة
    const nameMatch = t.match(
      /(?:اسم(?:ه|ها|ي|المتهم|المدعي|الموكل)?[\s:]+|موكل(?:ي|ه)?[\s:]+|المتهم[\s:]+|المدعي[\s:]+)([^\s,،.]+(?:\s[^\s,،.]+)?)/
    );
    // رقم القضية
    const caseMatch = t.match(
      /(?:قضية|رقم القضية|ملف|القضية رقم|رقم|ملف رقم)[\s:#]+([0-9]+)/
    );
    // الأتعاب
    const feesMatch = t.match(
      /(?:أتعاب|الأتعاب|مبلغ|التعاب|المبلغ)[\s:]+([0-9]+)/
    );
    // المصاريف
    const adminMatch = t.match(
      /(?:مصاريف|المصاريف|رسوم|الرسوم)[\s:]+([0-9]+)/
    );
    // نوع القضية
    const typeMatch = t.match(
      /(?:نوع(?:ها|ه)?|القضية من نوع|قضية)[\s:]+([^\s,،.]+(?:\s[^\s,،.]+)?)/
    );
    // رقم الهاتف
    const phoneMatch = t.match(
      /(?:رقم(?:ه|ها)?|تليفون|موبايل|هاتف)[\s:]+([0-9]{10,11})/
    );
    // الحكم
    const judgmentMatch = t.match(
      /(?:الحكم|حكم|النتيجة)[\s:]+([^\s,،.]+(?:\s[^\s,،.]+)?)/
    );

    if (nameMatch) data.client_name = nameMatch[1];
    if (caseMatch) data.case_number = caseMatch[1];
    if (feesMatch) data.total_fees = Number(feesMatch[1]);
    if (adminMatch) data.admin_fees = Number(adminMatch[1]);
    if (typeMatch) data.case_type = typeMatch[1];
    if (phoneMatch) data.client_phone = phoneMatch[1];
    if (judgmentMatch) data.judgment = judgmentMatch[1];
  }

  if (lang === 'en') {
    const nameMatch = t.match(
      /(?:name(?:\s+is)?|client(?:\s+is)?|defendant|plaintiff)[\s:]+([a-z]+(?:\s[a-z]+)?)/i
    );
    const caseMatch = t.match(
      /(?:case\s*(?:number|no|#)?|file\s*(?:number|no|#)?)[\s:]+([0-9]+)/i
    );
    const feesMatch = t.match(
      /(?:fees?|amount|total)[\s:]+([0-9]+)/i
    );
    const phoneMatch = t.match(
      /(?:phone|mobile|number)[\s:]+([0-9]{10,11})/i
    );
    const typeMatch = t.match(
      /(?:type(?:\s+is)?|case\s+type)[\s:]+([a-z]+(?:\s[a-z]+)?)/i
    );

    if (nameMatch) data.client_name = nameMatch[1];
    if (caseMatch) data.case_number = caseMatch[1];
    if (feesMatch) data.total_fees = Number(feesMatch[1]);
    if (phoneMatch) data.client_phone = phoneMatch[1];
    if (typeMatch) data.case_type = typeMatch[1];
  }

  if (lang === 'fr') {
    const nameMatch = t.match(
      /(?:nom(?:\s+est)?|client(?:\s+est)?|défendeur|demandeur)[\s:]+([a-zÀ-ÿ]+(?:\s[a-zÀ-ÿ]+)?)/i
    );
    const caseMatch = t.match(
      /(?:dossier|affaire|numéro?(?:\s+de\s+dossier)?)[\s:#]+([0-9]+)/i
    );
    const feesMatch = t.match(
      /(?:honoraires?|frais|montant)[\s:]+([0-9]+)/i
    );
    const phoneMatch = t.match(
      /(?:téléphone|mobile|numéro)[\s:]+([0-9]{10,11})/i
    );

    if (nameMatch) data.client_name = nameMatch[1];
    if (caseMatch) data.case_number = caseMatch[1];
    if (feesMatch) data.total_fees = Number(feesMatch[1]);
    if (phoneMatch) data.client_phone = phoneMatch[1];
  }

  if (lang === 'tr') {
    const nameMatch = t.match(
      /(?:isim(?:\s+is)?|müvekkil|sanık|davacı)[\s:]+([a-zÇĞİÖŞÜçğışöşü]+(?:\s[a-zÇĞİÖŞÜ]+)?)/i
    );
    const caseMatch = t.match(
      /(?:dava\s*(?:numarası|no)?|dosya\s*(?:numarası|no)?)[\s:#]+([0-9]+)/i
    );
    const feesMatch = t.match(
      /(?:ücret|miktar|tutar)[\s:]+([0-9]+)/i
    );

    if (nameMatch) data.client_name = nameMatch[1];
    if (caseMatch) data.case_number = caseMatch[1];
    if (feesMatch) data.total_fees = Number(feesMatch[1]);
  }

  if (lang === 'it') {
    const nameMatch = t.match(
      /(?:nome(?:\s+è)?|cliente|imputato|attore)[\s:]+([a-zÀ-ÿ]+(?:\s[a-zÀ-ÿ]+)?)/i
    );
    const caseMatch = t.match(
      /(?:caso|fascicolo|numero\s*(?:del\s*caso)?)[\s:#]+([0-9]+)/i
    );
    const feesMatch = t.match(
      /(?:onorario|compenso|importo)[\s:]+([0-9]+)/i
    );

    if (nameMatch) data.client_name = nameMatch[1];
    if (caseMatch) data.case_number = caseMatch[1];
    if (feesMatch) data.total_fees = Number(feesMatch[1]);
  }

  if (lang === 'es') {
    const nameMatch = t.match(
      /(?:nombre(?:\s+es)?|cliente|demandado|demandante)[\s:]+([a-záéíóúñ]+(?:\s[a-záéíóúñ]+)?)/i
    );
    const caseMatch = t.match(
      /(?:caso|expediente|número\s*(?:de\s*caso)?)[\s:#]+([0-9]+)/i
    );
    const feesMatch = t.match(
      /(?:honorarios?|monto|cantidad)[\s:]+([0-9]+)/i
    );

    if (nameMatch) data.client_name = nameMatch[1];
    if (caseMatch) data.case_number = caseMatch[1];
    if (feesMatch) data.total_fees = Number(feesMatch[1]);
  }

  if (lang === 'de') {
    const nameMatch = t.match(
      /(?:name(?:\s+ist)?|mandant|beklagter|kläger)[\s:]+([a-zäöüß]+(?:\s[a-zäöüß]+)?)/i
    );
    const caseMatch = t.match(
      /(?:fall|akte|nummer\s*(?:des\s*falls)?)[\s:#]+([0-9]+)/i
    );
    const feesMatch = t.match(
      /(?:honorar|betrag|kosten)[\s:]+([0-9]+)/i
    );

    if (nameMatch) data.client_name = nameMatch[1];
    if (caseMatch) data.case_number = caseMatch[1];
    if (feesMatch) data.total_fees = Number(feesMatch[1]);
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
