const LEXICON = [
  {
    word: "weather",
    meaning: "天气",
    partOfSpeech: "noun",
    topic: "weather",
    phonetic: "/'weðər/",
    similarWords: ["whether", "water", "winter", "warmth", "windy"],
    meaningDistractors: ["气候", "温度", "季节", "风向", "湿度"]
  },
  {
    word: "cloudy",
    meaning: "多云的",
    partOfSpeech: "adjective",
    topic: "weather",
    phonetic: "/'klaudi/",
    similarWords: ["cloud", "clouds", "cold", "clear", "clothes"],
    meaningDistractors: ["阴冷的", "晴朗的", "有风的", "潮湿的", "寒冷的"]
  },
  {
    word: "rainy",
    meaning: "下雨的",
    partOfSpeech: "adjective",
    topic: "weather",
    phonetic: "/'reini/",
    similarWords: ["rain", "rainbow", "windy", "snowy", "ready"],
    meaningDistractors: ["多风的", "下雪的", "潮湿的", "晴朗的", "炎热的"]
  },
  {
    word: "windy",
    meaning: "有风的",
    partOfSpeech: "adjective",
    topic: "weather",
    phonetic: "/'wɪndi/",
    relatedWords: ["cloudy", "rainy", "sunny", "snowy"],
    similarWords: ["window", "winter", "wind", "cloudy", "rainy"],
    meaningDistractors: ["多云的", "下雨的", "晴朗的", "下雪的", "寒冷的"]
  },
  {
    word: "sunny",
    meaning: "晴朗的",
    partOfSpeech: "adjective",
    topic: "weather",
    phonetic: "/'sʌni/",
    relatedWords: ["cloudy", "rainy", "windy", "snowy"],
    similarWords: ["snowy", "funny", "rainy", "windy", "cloudy"],
    meaningDistractors: ["多云的", "下雨的", "有风的", "下雪的", "炎热的"]
  },
  {
    word: "snowy",
    meaning: "下雪的",
    partOfSpeech: "adjective",
    topic: "weather",
    phonetic: "/'snoʊi/",
    relatedWords: ["cloudy", "rainy", "windy", "sunny"],
    similarWords: ["snowman", "sunny", "rainy", "windy", "cloudy"],
    meaningDistractors: ["多云的", "下雨的", "有风的", "晴朗的", "寒冷的"]
  },
  {
    word: "snowman",
    meaning: "雪人",
    partOfSpeech: "noun",
    topic: "weather",
    phonetic: "/'snoʊmæn/",
    similarWords: ["snow", "snowy", "showman", "slowman", "snowball"],
    meaningDistractors: ["雪球", "雪花", "雨伞", "围巾", "冰块"]
  },
  {
    word: "cook",
    meaning: "做饭",
    partOfSpeech: "verb",
    topic: "daily",
    phonetic: "/kʊk/",
    similarWords: ["book", "look", "cool", "cooker", "cake"],
    meaningDistractors: ["阅读", "观看", "清洗", "购买", "品尝"]
  },
  {
    word: "park",
    meaning: "公园",
    partOfSpeech: "noun",
    topic: "place",
    phonetic: "/pɑːrk/",
    similarWords: ["part", "dark", "mark", "parking", "path"],
    meaningDistractors: ["操场", "街道", "广场", "车站", "小路"]
  },
  {
    word: "school",
    meaning: "学校",
    partOfSpeech: "noun",
    topic: "school",
    phonetic: "/skuːl/",
    similarWords: ["cool", "class", "student", "teacher", "subject"],
    meaningDistractors: ["教室", "课程", "老师", "学生", "作业"]
  },
  {
    word: "teacher",
    meaning: "老师",
    partOfSpeech: "noun",
    topic: "school",
    phonetic: "/'tiːtʃər/",
    similarWords: ["teach", "teaching", "student", "classmate", "reader"],
    meaningDistractors: ["学生", "同学", "校长", "家长", "读者"]
  },
  {
    word: "student",
    meaning: "学生",
    partOfSpeech: "noun",
    topic: "school",
    phonetic: "/'stuːdnt/",
    similarWords: ["study", "subject", "teacher", "classmate", "school"],
    meaningDistractors: ["老师", "同学", "课程", "学校", "作业"]
  },
  {
    word: "family",
    meaning: "家庭",
    partOfSpeech: "noun",
    topic: "family",
    phonetic: "/'fæməli/",
    similarWords: ["father", "mother", "friendly", "finally", "famous"],
    meaningDistractors: ["朋友", "父亲", "母亲", "亲戚", "邻居"]
  },
  {
    word: "friend",
    meaning: "朋友",
    partOfSpeech: "noun",
    topic: "people",
    phonetic: "/frend/",
    similarWords: ["friendly", "find", "front", "fresh", "family"],
    meaningDistractors: ["同学", "邻居", "亲戚", "家人", "陌生人"]
  },
  {
    word: "beautiful",
    meaning: "美丽的",
    partOfSpeech: "adjective",
    topic: "description",
    phonetic: "/'bjuːtɪfl/",
    similarWords: ["beauty", "careful", "wonderful", "helpful", "colorful"],
    meaningDistractors: ["有用的", "精彩的", "小心的", "彩色的", "困难的"]
  },
  {
    word: "important",
    meaning: "重要的",
    partOfSpeech: "adjective",
    topic: "description",
    phonetic: "/ɪm'pɔːrtnt/",
    similarWords: ["import", "improve", "interesting", "different", "difficult"],
    meaningDistractors: ["有趣的", "不同的", "困难的", "普通的", "必要的"]
  },
  {
    word: "interesting",
    meaning: "有趣的",
    partOfSpeech: "adjective",
    topic: "description",
    phonetic: "/'ɪntrəstɪŋ/",
    similarWords: ["interest", "important", "different", "exciting", "boring"],
    meaningDistractors: ["重要的", "令人兴奋的", "无聊的", "不同的", "困难的"]
  },
  {
    word: "difficult",
    meaning: "困难的",
    partOfSpeech: "adjective",
    topic: "description",
    phonetic: "/'dɪfɪkəlt/",
    similarWords: ["different", "difficulty", "important", "beautiful", "careful"],
    meaningDistractors: ["不同的", "重要的", "美丽的", "小心的", "简单的"]
  },
  {
    word: "because",
    meaning: "因为",
    partOfSpeech: "conjunction",
    topic: "logic",
    phonetic: "/bɪ'kɔːz/",
    similarWords: ["cause", "before", "become", "between", "beside"],
    meaningDistractors: ["但是", "所以", "如果", "当……时", "虽然"]
  }
];

const FALLBACK_ENGLISH = [
  "water", "winter", "window", "wonder", "teacher", "student", "family",
  "friend", "beautiful", "important", "interesting", "different", "difficult",
  "because", "between", "before", "school", "subject", "weather", "season"
];

const FALLBACK_MEANINGS = [
  "天气", "气候", "温度", "季节", "学校", "课程", "老师", "学生",
  "朋友", "家庭", "美丽的", "重要的", "有趣的", "困难的", "不同的",
  "因为", "但是", "公园", "街道", "作业"
];

function normalizeWord(word) {
  return String(word || "").trim().toLowerCase();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function findEntry(word) {
  const normalized = normalizeWord(word);
  return LEXICON.find((item) => normalizeWord(item.word) === normalized) || null;
}

function isKnownEnglishWord(word) {
  return !!findEntry(word);
}

function getAudioUrl(word, audioUrl) {
  if (audioUrl) {
    return audioUrl;
  }
  const normalized = normalizeWord(word);
  if (!normalized) {
    return "";
  }
  return "https://dict.youdao.com/dictvoice?type=2&audio=" + encodeURIComponent(normalized);
}

function scoreCandidate(target, candidate) {
  const normalizedTarget = normalizeWord(target);
  const normalizedCandidate = normalizeWord(candidate);
  let score = Math.abs(normalizedTarget.length - normalizedCandidate.length);
  if (normalizedTarget.slice(0, 1) !== normalizedCandidate.slice(0, 1)) {
    score += 2;
  }
  return score;
}

function byTopicAndPart(entry, field) {
  if (!entry) {
    return [];
  }
  return LEXICON
    .filter((item) => item.word !== entry.word && (item.topic === entry.topic || item.partOfSpeech === entry.partOfSpeech))
    .map((item) => item[field]);
}

function generateEnglishDistractors(word, count, excludedWords) {
  const entry = findEntry(word);
  const excluded = (excludedWords || []).map(normalizeWord).concat([normalizeWord(word)]);
  const candidates = []
    .concat(entry ? entry.relatedWords : [])
    .concat(entry ? entry.similarWords : [])
    .concat(byTopicAndPart(entry, "word"))
    .concat(LEXICON.map((item) => item.word).sort((left, right) => scoreCandidate(word, left) - scoreCandidate(word, right)))
    .concat(FALLBACK_ENGLISH.filter(isKnownEnglishWord));

  return unique(candidates)
    .filter((item) => isKnownEnglishWord(item))
    .filter((item) => excluded.indexOf(normalizeWord(item)) < 0)
    .slice(0, count);
}

function generateMeaningDistractors(word, count, excludedMeanings) {
  const entry = findEntry(word);
  const excluded = (excludedMeanings || []).concat(entry ? [entry.meaning] : []);
  const candidates = []
    .concat(entry ? entry.meaningDistractors : [])
    .concat(byTopicAndPart(entry, "meaning"))
    .concat(FALLBACK_MEANINGS);

  return unique(candidates)
    .filter((item) => excluded.indexOf(item) < 0)
    .slice(0, count);
}

module.exports = {
  findEntry,
  generateEnglishDistractors,
  generateMeaningDistractors,
  getAudioUrl
};
