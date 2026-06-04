const https = require("https");

const FALLBACK_MEANINGS = {
  weather: "天气",
  cloudy: "多云的",
  rainy: "下雨的",
  snowman: "雪人",
  cook: "做饭",
  park: "公园",
  school: "学校",
  teacher: "老师",
  student: "学生",
  family: "家庭",
  friend: "朋友",
  beautiful: "美丽的",
  important: "重要的",
  interesting: "有趣的",
  difficult: "困难的",
  because: "因为"
};

function normalizeWord(word) {
  return String(word || "").trim().toLowerCase().replace(/[^a-z]/g, "");
}

function sanitizeMeaning(rawMeaning) {
  if (Array.isArray(rawMeaning)) {
    rawMeaning = rawMeaning.join("；");
  }

  let meaning = String(rawMeaning || "")
    .replace(/<[^>]+>/g, "")
    .replace(/[a-z]+\./gi, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim();

  const parts = meaning
    .split(/[;；\n\r,，/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const chinesePart = parts.find((item) => /[\u4e00-\u9fff]/.test(item)) || meaning;

  meaning = chinesePart
    .replace(/[^\u4e00-\u9fff·…、，的地得了和与为在到时]+/g, "")
    .trim();

  return meaning.slice(0, 12);
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

function extractMeaning(payload) {
  if (!payload) {
    return "";
  }

  const candidates = [
    payload.meaning,
    payload.translation,
    payload.translatedText,
    payload.explain,
    payload.definition,
    payload.shortMeaning
  ];

  if (Array.isArray(payload.translations)) {
    candidates.push(payload.translations.join("；"));
  }
  if (Array.isArray(payload.explains)) {
    candidates.push(payload.explains.join("；"));
  }
  if (payload.basic && Array.isArray(payload.basic.explains)) {
    candidates.push(payload.basic.explains.join("；"));
  }

  for (let index = 0; index < candidates.length; index += 1) {
    const meaning = sanitizeMeaning(candidates[index]);
    if (meaning) {
      return meaning;
    }
  }

  return "";
}

async function lookupFromConfiguredEndpoint(word) {
  const endpoint = process.env.WORD_LOOKUP_ENDPOINT || "";
  if (!endpoint) {
    return null;
  }

  const url = endpoint.replace("{word}", encodeURIComponent(word));
  const payload = await requestJson(url);
  const meaning = extractMeaning(payload);
  return meaning ? {
    meaning,
    source: payload.source || "dictionary_api",
    phonetic: payload.phonetic || payload.ukphone || payload.usphone || "",
    partOfSpeech: payload.partOfSpeech || ""
  } : null;
}

exports.main = async (event) => {
  const word = normalizeWord(event && event.word);
  if (!word) {
    return {
      ok: false,
      message: "INVALID_WORD"
    };
  }

  if (FALLBACK_MEANINGS[word]) {
    return {
      ok: true,
      word,
      meaning: FALLBACK_MEANINGS[word],
      source: "local_lexicon"
    };
  }

  try {
    const onlineResult = await lookupFromConfiguredEndpoint(word);
    if (onlineResult) {
      return {
        ok: true,
        word,
        ...onlineResult
      };
    }
  } catch (error) {
    return {
      ok: false,
      word,
      message: "LOOKUP_FAILED"
    };
  }

  return {
    ok: false,
    word,
    message: "LOOKUP_NOT_CONFIGURED"
  };
};
