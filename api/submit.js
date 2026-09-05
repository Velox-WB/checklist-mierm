// /api/submit.js
// Función serverless de Vercel (Node.js, sin dependencias npm — usa fetch nativo).
//
// Recibe: { answers: number[], contactInfo: {...} }
// Hace: 1) recalcula el scoring en el servidor (nunca confiar en el cálculo
//          del navegador para lo que se envía por correo)
//       2) llama a la API de Claude para generar el análisis detallado
//       3) envía el correo al prospecto y el correo a Warren vía Resend
// Devuelve: el resultado (índice, banda, dominios, focos) para pintar la
//           pantalla de resultado en el navegador.

const QUESTIONS_DATA = require('../questions-data.json');

const BANDS = {
  protegido: {
    badgeText: 'Protegido',
    title: 'Su relación laboral está genuinamente bajo control.',
    text: 'Los controles fundamentales del Código de Trabajo están documentados y son demostrables. Todavía vale la pena cerrar los focos puntuales de abajo, pero no está operando a ciegas.'
  },
  transicion: {
    badgeText: 'En transición',
    title: 'Hay más de un punto ciego real en su gestión.',
    text: 'Ninguno de estos hallazgos es, por sí solo, una crisis — pero juntos representan una exposición que un inspector de trabajo, o un colaborador con asesoría legal, puede encontrar sin mucho esfuerzo.'
  },
  expuesto: {
    badgeText: 'Expuesto',
    title: 'Su empresa está corriendo un riesgo real, no hipotético.',
    text: 'Varias obligaciones básicas del Código de Trabajo no tienen un control demostrable hoy. Esto no se resuelve con más cuidado — necesita un proceso y un sistema que no dependa de la memoria de una sola persona.'
  },
  critico: {
    badgeText: 'Crítico',
    title: 'Esto ya no es una alerta preventiva — es una situación activa.',
    text: 'La combinación de hallazgos de abajo es exactamente el patrón que termina en una demanda laboral costosa. Cada uno tiene una solución concreta, y se puede empezar a cerrar la brecha esta misma semana.'
  }
};

function computeResult(answers) {
  const QUESTIONS = QUESTIONS_DATA.questions;
  const BREAKER_INDICES = QUESTIONS_DATA.breakerIndices;
  const DOMAINS = QUESTIONS_DATA.domains;

  let totalRisk = 0, maxRisk = 0, breakerHits = 0;
  const scored = [];

  QUESTIONS.forEach(function (q, i) {
    const v = Number(answers[i]) || 0;
    totalRisk += v * q.weight;
    maxRisk += 3 * q.weight;
    if (BREAKER_INDICES.indexOf(i) !== -1 && v === 3) breakerHits++;
    scored.push({ i: i, v: v, weight: q.weight, score: v * q.weight });
  });

  const indice = Math.max(0, Math.round(100 - (totalRisk / maxRisk * 100)));

  let band;
  if (indice >= 80) band = 'protegido';
  else if (indice >= 60) band = 'transicion';
  else if (indice >= 35) band = 'expuesto';
  else band = 'critico';

  if (breakerHits >= 2) band = 'critico';
  else if (breakerHits >= 1 && (band === 'protegido' || band === 'transicion')) band = 'expuesto';

  const domainScores = DOMAINS.map(function (d) {
    let risk = 0, max = 0;
    for (let i = d.start; i <= d.end; i++) {
      risk += (Number(answers[i]) || 0) * QUESTIONS[i].weight;
      max += 3 * QUESTIONS[i].weight;
    }
    return { label: d.label, value: Math.max(0, Math.round(100 - (risk / max * 100))) };
  });

  const relevant = scored.filter(function (s) { return s.v >= 1; });
  relevant.sort(function (a, c) { return c.score - a.score; });
  const focos = relevant.slice(0, 8).map(function (s) {
    const q = QUESTIONS[s.i];
    return { cat: q.cat, label: q.fix.label, fix: q.fix.text };
  });

  return {
    indice: indice,
    band: band,
    badgeText: BANDS[band].badgeText,
    title: BANDS[band].title,
    text: BANDS[band].text,
    breakerHits: breakerHits,
    domainScores: domainScores,
    focos: focos,
    scored: scored
  };
}

function buildAnalysisPrompt(contactInfo, result) {
  const QUESTIONS = QUESTIONS_DATA.questions;

  const respuestasDetalle = result.scored.map(function (s) {
    const q = QUESTIONS[s.i];
    const opcion = q.opts.find(function (o) { return o[1] === s.v; });
    return '- [' + q.cat + '] ' + q.text + ' → Respuesta: "' + (opcion ? opcion[0] : '—') + '"';
  }).join('\n');

  const dominiosResumen = result.domainScores.map(function (d) {
    return '- ' + d.label + ': ' + d.value + '/100';
  }).join('\n');

  const focosResumen = result.focos.map(function (f) {
    return '- [' + f.cat + '] ' + f.label + ' → Cómo lo resuelve Mi ERM: ' + f.fix;
  }).join('\n');

  return 'Sos el analista de Mi ERM (una plataforma de gestión de relación laboral para pymes de Costa Rica, ' +
    'basada en el Código de Trabajo). Un Gerente General completó una "Evaluación de Control y Exposición Laboral" ' +
    'de 25 controles. Generá un análisis ejecutivo personalizado en español de Costa Rica, en tono directo y ' +
    'profesional (no alarmista, no genérico), dirigido a: ' + (contactInfo.nombre || 'el Gerente General') +
    ', de la empresa ' + (contactInfo.empresa || '—') + ' (' + (contactInfo.colaboradores || 'tamaño no especificado') +
    ' colaboradores).\n\n' +
    'RESULTADO GENERAL:\n' +
    '- Índice de Control: ' + result.indice + '/100\n' +
    '- Nivel de exposición: ' + result.badgeText + '\n' +
    '- Hallazgos críticos que activan reglas de ruptura (fuero, terminación, jornada, salario o confidencialidad): ' + result.breakerHits + '\n\n' +
    'CONTROL POR DOMINIO (0-100, más bajo = más expuesto):\n' + dominiosResumen + '\n\n' +
    'FOCOS DE ATENCIÓN PRIORITARIOS DETECTADOS:\n' + focosResumen + '\n\n' +
    'DETALLE COMPLETO DE RESPUESTAS (las 25):\n' + respuestasDetalle + '\n\n' +
    'Escribí el análisis con esta estructura, usando subtítulos en negrita (formato Markdown simple, sin usar # ni tablas):\n' +
    '1. Diagnóstico ejecutivo (2-3 oraciones, directo, sin rodeos)\n' +
    '2. Los 3-4 riesgos más importantes y qué significan concretamente para el negocio (legal, financiero, operativo — no solo repetir el hallazgo, explicar la consecuencia real)\n' +
    '3. Qué pasaría si esto no se corrige en los próximos meses (escenario realista, no catastrofista)\n' +
    '4. Cómo Mi ERM resuelve específicamente estos hallazgos (usando los mapeos de "Cómo lo resuelve Mi ERM" de arriba)\n' +
    '5. Una recomendación clara de siguiente paso\n\n' +
    'Extensión: 400-600 palabras. No inventes cifras de costos de demandas ni des asesoría legal específica — ' +
    'cerrá con una nota breve de que esto es una evaluación de gestión, no una opinión jurídica.';
}

async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Error de la API de Claude: ' + errText);
  }

  const data = await response.json();
  const textBlock = (data.content || []).find(function (b) { return b.type === 'text'; });
  return textBlock ? textBlock.text : 'No se pudo generar el análisis detallado.';
}

function buildRadarChartUrl(domainScores) {
  const labels = domainScores.map(function (d) { return d.label; });
  const values = domainScores.map(function (d) { return d.value; });

  const config = {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Índice de Control',
        data: values,
        backgroundColor: 'rgba(184,134,46,0.35)',
        borderColor: '#B8862E',
        borderWidth: 2,
        pointBackgroundColor: '#D7AC5C',
        pointBorderColor: '#D7AC5C',
        pointRadius: 4
      }]
    },
    options: {
      legend: { display: false },
      scale: {
        angleLines: { color: 'rgba(147,160,172,0.35)' },
        gridLines: { color: 'rgba(147,160,172,0.35)' },
        pointLabels: { fontColor: '#FAF7F0', fontSize: 13 },
        ticks: { min: 0, max: 100, stepSize: 25, showLabelBackdrop: false, fontColor: '#93A0AC', fontSize: 10 }
      }
    }
  };

  const encodedConfig = encodeURIComponent(JSON.stringify(config));
  const encodedBg = encodeURIComponent('#182B3E');
  return 'https://quickchart.io/chart?width=500&height=500&backgroundColor=' + encodedBg + '&c=' + encodedConfig;
}

function formatAnalysisHtml(analysisText) {
  // Conversión mínima de markdown simple (negritas y saltos de línea) a HTML,
  // suficiente para un correo — no requiere ninguna librería externa.
  return analysisText
    .split('\n\n')
    .map(function (p) {
      const withBold = p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return '<p style="margin:0 0 16px;line-height:1.6;">' + withBold.replace(/\n/g, '<br>') + '</p>';
    })
    .join('');
}

function emailShell(innerHtml) {
  return '<div style="background:#12202F;padding:32px 16px;font-family:-apple-system,Segoe UI,Public Sans,sans-serif;">' +
    '<div style="max-width:560px;margin:0 auto;background:#182B3E;border:1px solid #2A3F55;border-radius:10px;padding:32px;color:#FAF7F0;">' +
    '<div style="font-size:18px;margin-bottom:24px;"><span style="font-family:Georgia,serif;font-style:italic;color:#D7AC5C;">Mi</span><span style="font-weight:800;letter-spacing:0.02em;margin-left:2px;">ERM</span></div>' +
    innerHtml +
    '<p style="font-size:12px;color:#93A0AC;margin-top:28px;">Mi ERM — Ecosistema nxt LVL · Evaluación de Control y Exposición Laboral</p>' +
    '</div></div>';
}

function buildProspectEmailHtml(contactInfo, result, analysisText) {
  const radarUrl = buildRadarChartUrl(result.domainScores);
  const focosHtml = result.focos.slice(0, 5).map(function (f) {
    return '<li style="margin-bottom:10px;"><strong>' + f.label + '</strong><br><span style="color:#93A0AC;font-size:14px;">' + f.fix + '</span></li>';
  }).join('');

  const inner =
    '<p style="font-size:13px;color:#D7AC5C;font-weight:600;margin:0 0 6px;">' + result.badgeText.toUpperCase() + '</p>' +
    '<h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 8px;">' + result.title + '</h1>' +
    '<p style="font-size:14px;color:#93A0AC;margin:0 0 20px;">Índice de Control: ' + result.indice + ' / 100</p>' +
    '<p style="font-size:15px;color:#93A0AC;line-height:1.6;margin:0 0 28px;">' + result.text + '</p>' +
    '<p style="font-size:13px;color:#D7AC5C;font-weight:600;margin:0 0 14px;">SU CONTROL POR DOMINIO</p>' +
    '<img src="' + radarUrl + '" alt="Control por dominio" width="400" style="display:block;width:100%;max-width:400px;margin:0 auto 8px;border-radius:8px;border:1px solid #2A3F55;">' +
    '<p style="font-size:12px;color:#93A0AC;text-align:center;margin:0 0 28px;">Cada eje va de 0 (sin control) a 100 (control total). Entre más cerca del centro, mayor la exposición en ese dominio.</p>' +
    '<p style="font-size:13px;color:#D7AC5C;font-weight:600;margin:0 0 14px;">SU ANÁLISIS DETALLADO</p>' +
    formatAnalysisHtml(analysisText) +
    '<p style="font-size:13px;color:#D7AC5C;font-weight:600;margin:24px 0 14px;">SUS FOCOS PRIORITARIOS</p>' +
    '<ul style="padding-left:18px;margin:0 0 24px;">' + focosHtml + '</ul>' +
    '<p style="font-size:12px;color:#93A0AC;opacity:0.85;line-height:1.5;">Esta evaluación identifica condiciones de gestión y posibles áreas de exposición, con base en artículos del Código de Trabajo de Costa Rica. No constituye una opinión jurídica ni sustituye la revisión de un profesional en Derecho para situaciones específicas.</p>';

  return emailShell(inner);
}

function buildWarrenEmailHtml(contactInfo, result, analysisText) {
  const radarUrl = buildRadarChartUrl(result.domainScores);
  const inner =
    '<p style="font-size:13px;color:#D7AC5C;font-weight:600;margin:0 0 14px;">NUEVO LEAD — LISTO PARA LA LLAMADA</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">' +
    '<tr><td style="padding:4px 0;color:#93A0AC;">Nombre</td><td style="padding:4px 0;">' + (contactInfo.nombre || '—') + '</td></tr>' +
    '<tr><td style="padding:4px 0;color:#93A0AC;">Empresa</td><td style="padding:4px 0;">' + (contactInfo.empresa || '—') + '</td></tr>' +
    '<tr><td style="padding:4px 0;color:#93A0AC;">Puesto</td><td style="padding:4px 0;">' + (contactInfo.puesto || '—') + '</td></tr>' +
    '<tr><td style="padding:4px 0;color:#93A0AC;">Correo</td><td style="padding:4px 0;">' + (contactInfo.correo || '—') + '</td></tr>' +
    '<tr><td style="padding:4px 0;color:#93A0AC;">WhatsApp</td><td style="padding:4px 0;">' + (contactInfo.whatsapp || '—') + '</td></tr>' +
    '<tr><td style="padding:4px 0;color:#93A0AC;">Colaboradores</td><td style="padding:4px 0;">' + (contactInfo.colaboradores || '—') + '</td></tr>' +
    '</table>' +
    '<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 8px;">' + result.title + '</h1>' +
    '<p style="font-size:14px;color:#93A0AC;margin:0 0 20px;">Índice de Control: ' + result.indice + ' / 100 · ' + result.badgeText +
    (result.breakerHits >= 1 ? ' · ' + result.breakerHits + ' hallazgo(s) crítico(s)' : '') + '</p>' +
    '<p style="font-size:13px;color:#D7AC5C;font-weight:600;margin:0 0 14px;">CONTROL POR DOMINIO</p>' +
    '<img src="' + radarUrl + '" alt="Control por dominio" width="400" style="display:block;width:100%;max-width:400px;margin:0 auto 24px;border-radius:8px;border:1px solid #2A3F55;">' +
    '<p style="font-size:13px;color:#D7AC5C;font-weight:600;margin:0 0 14px;">ANÁLISIS COMPLETO</p>' +
    formatAnalysisHtml(analysisText);

  return emailShell(inner);
}

async function sendEmail(to, subject, html) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject: subject,
      html: html
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Error enviando correo a ' + to + ': ' + errText);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  try {
    const body = req.body || {};
    const answers = body.answers;
    const contactInfo = body.contactInfo || {};

    if (!Array.isArray(answers) || answers.length !== QUESTIONS_DATA.questions.length) {
      res.status(400).json({ error: 'Respuestas inválidas o incompletas.' });
      return;
    }
    if (!contactInfo.correo) {
      res.status(400).json({ error: 'Falta el correo de contacto.' });
      return;
    }

    const result = computeResult(answers);
    const prompt = buildAnalysisPrompt(contactInfo, result);
    const analysisText = await callClaude(prompt);

    const prospectHtml = buildProspectEmailHtml(contactInfo, result, analysisText);
    const warrenHtml = buildWarrenEmailHtml(contactInfo, result, analysisText);

    await Promise.all([
      sendEmail(
        contactInfo.correo,
        'Su resultado — Evaluación de Control y Exposición Laboral (' + result.badgeText + ')',
        prospectHtml
      ),
      sendEmail(
        process.env.WARREN_EMAIL,
        'Nuevo lead: ' + (contactInfo.empresa || contactInfo.nombre || 'sin nombre') + ' — ' + result.badgeText,
        warrenHtml
      )
    ]);

    res.status(200).json({
      indice: result.indice,
      band: result.band,
      badgeText: result.badgeText,
      title: result.title,
      text: result.text,
      breakerHits: result.breakerHits,
      domainScores: result.domainScores,
      focos: result.focos
    });
  } catch (err) {
    console.error('Error en /api/submit:', err);
    res.status(500).json({ error: 'Hubo un problema generando su análisis. Por favor intente de nuevo en unos minutos.' });
  }
};
