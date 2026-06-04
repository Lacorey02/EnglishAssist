const cloudService = require("./cloud-service");
const vocabLexicon = require("./vocab-lexicon");

const STORAGE_KEYS = {
  accounts: "english_assistant_accounts",
  session: "english_assistant_session",
  teacherProfiles: "english_assistant_teacher_profiles",
  studentProfiles: "english_assistant_student_profiles",
  classes: "english_assistant_classes",
  tasks: "english_assistant_tasks",
  submissions: "english_assistant_submissions",
  wordMeaningCache: "english_assistant_word_meaning_cache"
};

const CLASS_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function clone(data) {
  if (data === undefined || data === null) {
    return data;
  }
  return JSON.parse(JSON.stringify(data));
}

function createId(prefix) {
  return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function getCollection(key) {
  const data = wx.getStorageSync(STORAGE_KEYS[key]);
  return Array.isArray(data) ? clone(data) : [];
}

function saveCollection(key, records) {
  wx.setStorageSync(STORAGE_KEYS[key], clone(records));
}

function getObjectStorage(key) {
  const data = wx.getStorageSync(STORAGE_KEYS[key]);
  if (!data || Array.isArray(data) || typeof data !== "object") {
    return {};
  }
  return clone(data);
}

function saveObjectStorage(key, data) {
  wx.setStorageSync(STORAGE_KEYS[key], clone(data || {}));
}

function pad(num) {
  return String(num).padStart(2, "0");
}

function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + " " + [pad(date.getHours()), pad(date.getMinutes())].join(":");
}

function formatDateInput(timestamp) {
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");
}

function formatTimeInput(timestamp) {
  const date = new Date(timestamp);
  return [pad(date.getHours()), pad(date.getMinutes())].join(":");
}

function getDateStart(timestamp) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function buildDueAt(dueDate, dueTime) {
  const dateParts = String(dueDate || "").split("-").map(Number);
  const timeParts = String(dueTime || "").split(":").map(Number);
  if (dateParts.length !== 3 || timeParts.length < 2) {
    return 0;
  }

  const dueAt = new Date(
    dateParts[0],
    dateParts[1] - 1,
    dateParts[2],
    timeParts[0],
    timeParts[1],
    0,
    0
  ).getTime();
  return Number.isFinite(dueAt) ? dueAt : 0;
}

function formatDueLabel(dueAt) {
  const timestamp = Number(dueAt || 0);
  if (!timestamp) {
    return "";
  }

  const dueDate = new Date(timestamp);
  const todayStart = getDateStart(Date.now());
  const dueStart = getDateStart(timestamp);
  const dayDiff = Math.round((dueStart - todayStart) / 86400000);
  let dateLabel = (dueDate.getMonth() + 1) + "月" + dueDate.getDate() + "日";
  if (dayDiff === 0) {
    dateLabel = "今天";
  } else if (dayDiff === 1) {
    dateLabel = "明天";
  }

  return dateLabel + " " + formatTimeInput(timestamp) + " 前";
}

function getDefaultDueMeta(baseTime) {
  const now = Number(baseTime || Date.now());
  const nowDate = new Date(now);
  let dueAt = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
    21,
    30,
    0,
    0
  ).getTime();
  if (dueAt <= now) {
    dueAt += 86400000;
  }

  return {
    dueAt,
    dueDate: formatDateInput(dueAt),
    dueTime: formatTimeInput(dueAt),
    dueLabel: formatDueLabel(dueAt)
  };
}

function formatDuration(durationSec) {
  if (!durationSec) {
    return "0 分钟";
  }
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  if (!minutes) {
    return seconds + " 秒";
  }
  return minutes + " 分 " + seconds + " 秒";
}

function normalizeClassCode(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isAudioUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function normalizeEnglishWord(word) {
  return String(word || "").trim().toLowerCase().replace(/[^a-z]/g, "");
}

function isValidEnglishWord(word) {
  return /^[a-z]{2,}$/.test(normalizeEnglishWord(word));
}

function normalizeAccount(account) {
  if (!account) {
    return account;
  }

  return {
    ...account,
    username: account.username || account.displayName || "",
    displayName: account.displayName || account.username || "",
    avatarUrl: account.avatarUrl || "",
    phone: account.phone || "",
    lastSelectedRole: account.lastSelectedRole || ""
  };
}

function getAccounts() {
  return getCollection("accounts").map((account) => normalizeAccount(account));
}

function saveAccounts(accounts) {
  saveCollection("accounts", accounts.map((account) => normalizeAccount(account)));
}

function normalizeUsername(username) {
  return String(username || "").trim();
}

function getAccountByUsername(username) {
  const normalizedUsername = normalizeUsername(username);
  return clone(getAccounts().find((item) => item.username === normalizedUsername) || null);
}

function isUsernameTaken(username) {
  return !!getAccountByUsername(username);
}

function getCurrentSession() {
  const session = wx.getStorageSync(STORAGE_KEYS.session) || null;
  if (!session || !session.currentAccountId) {
    return null;
  }

  const account = getAccounts().find((item) => item.id === session.currentAccountId);
  return account ? clone(session) : null;
}

function getCurrentAccount() {
  const session = getCurrentSession();
  if (!session) {
    return null;
  }
  return clone(getAccounts().find((item) => item.id === session.currentAccountId) || null);
}

function clearCurrentSession() {
  if (typeof wx.removeStorageSync === "function") {
    wx.removeStorageSync(STORAGE_KEYS.session);
    return;
  }

  wx.setStorageSync(STORAGE_KEYS.session, null);
}

function createSession(accountId) {
  wx.setStorageSync(STORAGE_KEYS.session, {
    currentAccountId: accountId,
    loggedInAt: Date.now()
  });
}

function createAccount(payload) {
  const username = normalizeUsername(payload.username);
  if (isUsernameTaken(username)) {
    throw new Error("USERNAME_TAKEN");
  }

  const now = Date.now();
  const account = {
    id: createId("acc"),
    username,
    password: payload.password,
    displayName: username,
    avatarUrl: "",
    phone: "",
    createdAt: now,
    updatedAt: now,
    lastSelectedRole: ""
  };

  saveAccounts([account].concat(getAccounts()));
  return clone(account);
}

function registerAccount(payload) {
  const account = createAccount(payload);
  createSession(account.id);
  return clone(account);
}

function loginAccount(payload) {
  const account = getAccountByUsername(payload.username);
  if (!account) {
    throw new Error("USERNAME_NOT_FOUND");
  }

  if (account.password !== payload.password) {
    throw new Error("PASSWORD_INCORRECT");
  }

  createSession(account.id);
  return clone(account);
}

function ensureLocalAccount(displayName) {
  const now = Date.now();
  const accounts = getAccounts();
  let account = accounts[0] || null;

  if (!account) {
    account = {
      id: createId("acc"),
      displayName: (displayName || "本地用户").trim(),
      username: (displayName || "本地用户").trim(),
      avatarUrl: "",
      phone: "",
      createdAt: now,
      updatedAt: now,
      lastSelectedRole: ""
    };
    accounts.unshift(account);
    saveAccounts(accounts);
  }

  wx.setStorageSync(STORAGE_KEYS.session, {
    currentAccountId: account.id,
    loggedInAt: now
  });

  return clone(account);
}

function setLastSelectedRole(role) {
  const session = getCurrentSession();
  if (!session) {
    return null;
  }

  const accounts = getAccounts();
  const index = accounts.findIndex((item) => item.id === session.currentAccountId);
  if (index < 0) {
    return null;
  }

  accounts[index] = {
    ...accounts[index],
    lastSelectedRole: role,
    updatedAt: Date.now()
  };
  saveAccounts(accounts);
  return clone(accounts[index]);
}

function getAccountProfile(accountId) {
  const account = getAccounts().find((item) => item.id === accountId) || null;
  if (!account) {
    return null;
  }

  return clone({
    avatarUrl: "",
    phone: "",
    username: account.username || account.displayName || "",
    ...account
  });
}

function updateAccountPhone(accountId, phone) {
  const accounts = getAccounts();
  const index = accounts.findIndex((item) => item.id === accountId);
  if (index < 0) {
    return null;
  }

  accounts[index] = {
    ...accounts[index],
    phone: String(phone || "").trim(),
    updatedAt: Date.now()
  };
  saveAccounts(accounts);
  return clone(accounts[index]);
}

function updateAccountAvatar(accountId, avatarUrl) {
  const accounts = getAccounts();
  const index = accounts.findIndex((item) => item.id === accountId);
  if (index < 0) {
    return null;
  }

  accounts[index] = {
    ...accounts[index],
    avatarUrl: avatarUrl || "",
    updatedAt: Date.now()
  };
  saveAccounts(accounts);
  return clone(accounts[index]);
}

function normalizeTeacherProfile(profile) {
  if (!profile) {
    return profile;
  }

  return {
    ...profile,
    joinedClassIds: Array.isArray(profile.joinedClassIds)
      ? uniqueValues(profile.joinedClassIds.filter(Boolean))
      : []
  };
}

function getTeacherProfiles() {
  return getCollection("teacherProfiles").map((profile) => normalizeTeacherProfile(profile));
}

function saveTeacherProfiles(profiles) {
  saveCollection("teacherProfiles", profiles.map((profile) => normalizeTeacherProfile(profile)));
}

function getTeacherProfileById(teacherProfileId) {
  return clone(getTeacherProfiles().find((item) => item.id === teacherProfileId) || null);
}

function getTeacherProfileByAccountId(accountId) {
  return clone(getTeacherProfiles().find((item) => item.accountId === accountId) || null);
}

function ensureTeacherProfile(accountId, name) {
  const now = Date.now();
  const profiles = getTeacherProfiles();
  const existingIndex = profiles.findIndex((item) => item.accountId === accountId);
  const trimmedName = (name || "").trim();
  const existing = profiles[existingIndex];
  if (existing) {
    if (trimmedName) {
      profiles[existingIndex] = {
        ...existing,
        name: trimmedName,
        joinedClassIds: existing.joinedClassIds || [],
        updatedAt: now
      };
      saveTeacherProfiles(profiles);
      return clone(profiles[existingIndex]);
    }
    return clone(existing);
  }

  const profile = {
    id: createId("teacher"),
    accountId,
    name: trimmedName || "老师",
    joinedClassIds: [],
    createdAt: now,
    updatedAt: now
  };
  profiles.unshift(profile);
  saveTeacherProfiles(profiles);
  return clone(profile);
}

function addTeacherClass(teacherProfileId, classId) {
  const profiles = getTeacherProfiles();
  const index = profiles.findIndex((item) => item.id === teacherProfileId);
  if (index < 0 || !classId) {
    return null;
  }

  const profile = normalizeTeacherProfile(profiles[index]);
  const joinedClassIds = profile.joinedClassIds.slice();
  if (joinedClassIds.indexOf(classId) < 0) {
    joinedClassIds.unshift(classId);
  }

  profiles[index] = normalizeTeacherProfile({
    ...profile,
    joinedClassIds,
    updatedAt: Date.now()
  });
  saveTeacherProfiles(profiles);
  return clone(profiles[index]);
}

function removeTeacherClass(teacherProfileId, classId) {
  const profiles = getTeacherProfiles();
  const index = profiles.findIndex((item) => item.id === teacherProfileId);
  if (index < 0) {
    return null;
  }

  const profile = normalizeTeacherProfile(profiles[index]);
  profiles[index] = normalizeTeacherProfile({
    ...profile,
    joinedClassIds: profile.joinedClassIds.filter((item) => item !== classId),
    updatedAt: Date.now()
  });
  saveTeacherProfiles(profiles);
  return clone(profiles[index]);
}

function getStudentProfiles() {
  return getCollection("studentProfiles").map((profile) => normalizeStudentProfile(profile));
}

function saveStudentProfiles(profiles) {
  saveCollection("studentProfiles", profiles.map((profile) => normalizeStudentProfile(profile)));
}

function normalizeStudentProfile(profile) {
  if (!profile) {
    return profile;
  }

  const joinedClassIds = Array.isArray(profile.joinedClassIds)
    ? profile.joinedClassIds.slice()
    : [];
  if (profile.joinedClassId && joinedClassIds.indexOf(profile.joinedClassId) < 0) {
    joinedClassIds.unshift(profile.joinedClassId);
  }

  const classNames = {
    ...(profile.classNames || {})
  };
  joinedClassIds.forEach((classId) => {
    if (!classNames[classId] && profile.name) {
      classNames[classId] = profile.name;
    }
  });

  return {
    ...profile,
    joinedClassId: profile.joinedClassId || joinedClassIds[0] || "",
    joinedClassIds,
    classNames
  };
}

function getStudentProfileByAccountId(accountId) {
  return clone(getStudentProfiles().find((item) => item.accountId === accountId) || null);
}

function getStudentById(studentId) {
  return clone(getStudentProfiles().find((item) => item.id === studentId) || null);
}

function createOrUpdateStudentProfile(payload) {
  const now = Date.now();
  const accountId = payload.accountId;
  const profiles = getStudentProfiles();
  const index = profiles.findIndex((item) => item.accountId === accountId);
  const name = (payload.name || "学生").trim();

  if (index >= 0) {
    const existing = normalizeStudentProfile(profiles[index]);
    const joinedClassId = payload.joinedClassId || existing.joinedClassId || "";
    const joinedClassIds = existing.joinedClassIds.slice();
    if (joinedClassId && joinedClassIds.indexOf(joinedClassId) < 0) {
      joinedClassIds.unshift(joinedClassId);
    }
    profiles[index] = normalizeStudentProfile({
      ...existing,
      name,
      joinedClassId,
      joinedClassIds,
      classNames: {
        ...(existing.classNames || {}),
        ...(joinedClassId ? { [joinedClassId]: name } : {})
      },
      updatedAt: now
    });
    saveStudentProfiles(profiles);
    return clone(profiles[index]);
  }

  const profile = normalizeStudentProfile({
    id: createId("student"),
    accountId,
    name,
    joinedClassId: payload.joinedClassId || "",
    joinedClassIds: payload.joinedClassId ? [payload.joinedClassId] : [],
    classNames: payload.joinedClassId ? { [payload.joinedClassId]: name } : {},
    createdAt: now,
    updatedAt: now
  });
  profiles.unshift(profile);
  saveStudentProfiles(profiles);
  return clone(profile);
}

function isStudentJoinedClass(accountId) {
  const profile = getStudentProfileByAccountId(accountId);
  return !!(profile && profile.joinedClassIds && profile.joinedClassIds.length);
}

function clearStudentJoinedClass(accountId) {
  const profiles = getStudentProfiles();
  const index = profiles.findIndex((item) => item.accountId === accountId);
  if (index < 0) {
    return null;
  }

  profiles[index] = normalizeStudentProfile({
    ...profiles[index],
    joinedClassId: "",
    joinedClassIds: [],
    classNames: {},
    updatedAt: Date.now()
  });
  saveStudentProfiles(profiles);
  return clone(profiles[index]);
}

function isClassActive(classInfo) {
  return !!classInfo && !classInfo.deletedAt;
}

function getOwnerTeacherAccountId(classInfo) {
  return (classInfo && (classInfo.ownerTeacherAccountId || classInfo.teacherAccountId)) || "";
}

function getOwnerTeacherProfileId(classInfo) {
  return (classInfo && (classInfo.ownerTeacherProfileId || classInfo.teacherProfileId)) || "";
}

function normalizeTeacherMember(member, classInfo, role) {
  const teacherProfileId = member.teacherProfileId || getOwnerTeacherProfileId(classInfo);
  const teacherAccountId = member.teacherAccountId || getOwnerTeacherAccountId(classInfo);
  const profile = teacherProfileId ? getTeacherProfileById(teacherProfileId) : null;
  return {
    teacherProfileId,
    teacherAccountId: teacherAccountId || (profile ? profile.accountId : ""),
    teacherName: member.teacherName || (profile ? profile.name : "") || "老师",
    role,
    joinedAt: member.joinedAt || classInfo.createdAt || Date.now()
  };
}

function normalizeClassInfo(classInfo) {
  if (!classInfo) {
    return classInfo;
  }

  const ownerTeacherAccountId = getOwnerTeacherAccountId(classInfo);
  const ownerTeacherProfileId = getOwnerTeacherProfileId(classInfo);
  const teacherMembers = [];
  const seen = {};
  const rawMembers = Array.isArray(classInfo.teacherMembers)
    ? classInfo.teacherMembers
    : [];

  rawMembers.forEach((member) => {
    const teacherProfileId = member && member.teacherProfileId;
    const teacherAccountId = member && member.teacherAccountId;
    if (!teacherProfileId && !teacherAccountId) {
      return;
    }

    const isOwner = teacherProfileId === ownerTeacherProfileId ||
      teacherAccountId === ownerTeacherAccountId ||
      member.role === "owner";
    const normalizedMember = normalizeTeacherMember(member, classInfo, isOwner ? "owner" : "viewer");
    const key = normalizedMember.teacherProfileId || normalizedMember.teacherAccountId;
    if (!key || seen[key]) {
      return;
    }
    seen[key] = true;
    teacherMembers.push(normalizedMember);
  });

  if (ownerTeacherProfileId || ownerTeacherAccountId) {
    const ownerKey = ownerTeacherProfileId || ownerTeacherAccountId;
    if (!seen[ownerKey]) {
      teacherMembers.unshift(normalizeTeacherMember({
        teacherProfileId: ownerTeacherProfileId,
        teacherAccountId: ownerTeacherAccountId,
        role: "owner"
      }, classInfo, "owner"));
    } else {
      teacherMembers.forEach((member, index) => {
        if (member.teacherProfileId === ownerTeacherProfileId || member.teacherAccountId === ownerTeacherAccountId) {
          teacherMembers[index] = {
            ...member,
            role: "owner"
          };
        }
      });
    }
  }

  teacherMembers.sort((left, right) => {
    if (left.role === right.role) {
      return (left.joinedAt || 0) - (right.joinedAt || 0);
    }
    return left.role === "owner" ? -1 : 1;
  });

  return {
    ...classInfo,
    code: normalizeClassCode(classInfo.code),
    teacherAccountId: ownerTeacherAccountId,
    teacherProfileId: ownerTeacherProfileId,
    ownerTeacherAccountId,
    ownerTeacherProfileId,
    teacherMemberIds: uniqueValues(teacherMembers.map((member) => member.teacherProfileId).filter(Boolean)),
    teacherMembers,
    studentIds: Array.isArray(classInfo.studentIds) ? uniqueValues(classInfo.studentIds.filter(Boolean)) : [],
    deletedAt: classInfo.deletedAt || null
  };
}

function getAllClasses() {
  return getCollection("classes")
    .map((classInfo) => normalizeClassInfo(classInfo))
    .sort((left, right) => right.createdAt - left.createdAt);
}

function getClasses() {
  return getAllClasses().filter(isClassActive);
}

function saveClasses(classes) {
  saveCollection("classes", classes.map((classInfo) => normalizeClassInfo(classInfo)));
}

function getClassById(classId) {
  return clone(getClasses().find((item) => item.id === classId) || null);
}

function getClassesByTeacherAccountId(accountId) {
  const teacherProfile = getTeacherProfileByAccountId(accountId);
  return clone(getClasses().filter((classInfo) => {
    return classInfo.ownerTeacherAccountId === accountId ||
      (classInfo.teacherMembers || []).some((member) => (
        member.teacherAccountId === accountId ||
        (teacherProfile && member.teacherProfileId === teacherProfile.id)
      ));
  }));
}

function getActiveClassesByTeacherAccountId(accountId) {
  return getClassesByTeacherAccountId(accountId);
}

function getTeacherClassesByAccountId(accountId) {
  return getClassesByTeacherAccountId(accountId);
}

function isClassCodeTaken(code, ignoredClassId) {
  const normalizedCode = normalizeClassCode(code);
  return getClasses().some((item) => item.code === normalizedCode && item.id !== ignoredClassId);
}

function isClassCodeAvailable(code, ignoredClassId) {
  const normalizedCode = normalizeClassCode(code);
  return !!normalizedCode && !isClassCodeTaken(normalizedCode, ignoredClassId);
}

function findClassByCode(code) {
  const normalizedCode = normalizeClassCode(code);
  return clone(getClasses().find((item) => item.code === normalizedCode) || null);
}

function generateClassCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = "";
    for (let index = 0; index < 6; index += 1) {
      code += CLASS_CODE_CHARS[Math.floor(Math.random() * CLASS_CODE_CHARS.length)];
    }
    if (isClassCodeAvailable(code)) {
      return code;
    }
  }
  return "";
}

function createClass(payload) {
  const now = Date.now();
  const code = normalizeClassCode(payload.code);

  if (!isClassCodeAvailable(code)) {
    throw new Error("CLASS_CODE_TAKEN");
  }

  const classInfo = {
    id: createId("class"),
    name: (payload.name || "").trim(),
    code,
    teacherAccountId: payload.teacherAccountId,
    teacherProfileId: payload.teacherProfileId,
    ownerTeacherAccountId: payload.teacherAccountId,
    ownerTeacherProfileId: payload.teacherProfileId,
    teacherMemberIds: [payload.teacherProfileId].filter(Boolean),
    teacherMembers: [{
      teacherProfileId: payload.teacherProfileId,
      teacherAccountId: payload.teacherAccountId,
      teacherName: payload.teacherName || (getTeacherProfileById(payload.teacherProfileId) || {}).name || "老师",
      role: "owner",
      joinedAt: now
    }],
    studentIds: [],
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };
  saveClasses([classInfo].concat(getAllClasses()));
  if (payload.teacherProfileId) {
    addTeacherClass(payload.teacherProfileId, classInfo.id);
  }
  return clone(classInfo);
}

function getTeacherRoleInClass(classId, teacherProfileId) {
  const classInfo = getClassById(classId);
  if (!classInfo || !teacherProfileId) {
    return "";
  }

  const member = (classInfo.teacherMembers || []).find((item) => item.teacherProfileId === teacherProfileId);
  return member ? member.role : "";
}

function isClassOwner(classId, teacherProfileId) {
  return getTeacherRoleInClass(classId, teacherProfileId) === "owner";
}

function isTeacherMember(classId, teacherProfileId) {
  return !!getTeacherRoleInClass(classId, teacherProfileId);
}

function canPublishTask(classId, teacherProfileId) {
  return isClassOwner(classId, teacherProfileId);
}

function canEditClass(classId, teacherProfileId) {
  return isClassOwner(classId, teacherProfileId);
}

function canRemoveClassMember(classId, teacherProfileId) {
  return isClassOwner(classId, teacherProfileId);
}

function getTeacherMembersByClassId(classId) {
  const classInfo = getClassById(classId);
  if (!classInfo) {
    return [];
  }

  return clone((classInfo.teacherMembers || []).map((member) => ({
    ...member,
    roleLabel: member.role === "owner" ? "创建者" : "协作老师",
    canRemove: member.role !== "owner"
  })));
}

function joinClassAsTeacher(payload) {
  const accountId = payload.accountId;
  const classInfo = findClassByCode(payload.code);
  if (!classInfo) {
    throw new Error("CLASS_NOT_FOUND");
  }

  const teacher = ensureTeacherProfile(accountId, payload.name);
  if (classInfo.ownerTeacherAccountId === accountId || classInfo.ownerTeacherProfileId === teacher.id) {
    throw new Error("TEACHER_ALREADY_OWNER");
  }
  if (isTeacherMember(classInfo.id, teacher.id)) {
    throw new Error("TEACHER_ALREADY_JOINED");
  }

  const classes = getAllClasses();
  const index = classes.findIndex((item) => item.id === classInfo.id);
  if (index < 0) {
    throw new Error("CLASS_NOT_FOUND");
  }

  const now = Date.now();
  const member = {
    teacherProfileId: teacher.id,
    teacherAccountId: teacher.accountId,
    teacherName: teacher.name,
    role: "viewer",
    joinedAt: now
  };
  classes[index] = normalizeClassInfo({
    ...classes[index],
    teacherMembers: (classes[index].teacherMembers || []).concat(member),
    updatedAt: now
  });
  saveClasses(classes);
  addTeacherClass(teacher.id, classInfo.id);

  return {
    classInfo: clone(classes[index]),
    teacher: clone(teacher)
  };
}

function updateClassInfo(classId, payload) {
  const actorTeacherProfileId = payload.actorTeacherProfileId;
  if (actorTeacherProfileId && !canEditClass(classId, actorTeacherProfileId)) {
    throw new Error("CLASS_EDIT_FORBIDDEN");
  }

  const name = String(payload.name || "").trim();
  const code = normalizeClassCode(payload.code);
  if (!name) {
    throw new Error("CLASS_NAME_REQUIRED");
  }
  if (!code) {
    throw new Error("CLASS_CODE_REQUIRED");
  }
  if (!isClassCodeAvailable(code, classId)) {
    throw new Error("CLASS_CODE_TAKEN");
  }

  const classes = getAllClasses();
  const index = classes.findIndex((item) => item.id === classId);
  if (index < 0) {
    throw new Error("CLASS_NOT_FOUND");
  }

  classes[index] = normalizeClassInfo({
    ...classes[index],
    name,
    code,
    updatedAt: Date.now()
  });
  saveClasses(classes);
  return clone(classes[index]);
}

function removeTeacherFromClass(classId, teacherProfileId) {
  const classInfo = getClassById(classId);
  if (!classInfo) {
    return null;
  }
  if (classInfo.ownerTeacherProfileId === teacherProfileId) {
    throw new Error("OWNER_CANNOT_REMOVE_SELF");
  }

  const classes = getAllClasses();
  const index = classes.findIndex((item) => item.id === classId);
  if (index < 0) {
    return null;
  }

  classes[index] = normalizeClassInfo({
    ...classes[index],
    teacherMembers: (classes[index].teacherMembers || [])
      .filter((member) => member.teacherProfileId !== teacherProfileId),
    updatedAt: Date.now()
  });
  saveClasses(classes);
  removeTeacherClass(teacherProfileId, classId);
  return clone(classes[index]);
}

function removeStudentFromClass(classId, studentProfileId) {
  return leaveClass(classId, studentProfileId);
}

function addStudentToClass(classId, studentId) {
  const classes = getAllClasses();
  const index = classes.findIndex((item) => item.id === classId);
  if (index < 0 || !isClassActive(classes[index])) {
    return null;
  }

  const studentIds = classes[index].studentIds || [];
  if (studentIds.indexOf(studentId) < 0) {
    classes[index] = {
      ...classes[index],
      studentIds: studentIds.concat(studentId),
      updatedAt: Date.now()
    };
    saveClasses(classes);
  }

  return clone(classes[index]);
}

function getStudentsByClassId(classId) {
  const classInfo = getClassById(classId);
  if (!classInfo) {
    return [];
  }
  return clone(
    (classInfo.studentIds || [])
      .map((studentId) => getStudentById(studentId))
      .filter(Boolean)
  );
}

function softDeleteClass(classId) {
  const classes = getAllClasses();
  const index = classes.findIndex((item) => item.id === classId);
  if (index < 0) {
    return null;
  }

  classes[index] = {
    ...classes[index],
    deletedAt: Date.now(),
    updatedAt: Date.now()
  };
  saveClasses(classes);
  return clone(classes[index]);
}

function getStudentNameInClass(studentProfileId, classId) {
  const student = getStudentById(studentProfileId);
  if (!student) {
    return "";
  }

  return (student.classNames && student.classNames[classId]) || student.name || "学生";
}

function addStudentClass(studentProfileId, classId, studentName) {
  const profiles = getStudentProfiles();
  const index = profiles.findIndex((item) => item.id === studentProfileId);
  if (index < 0) {
    return null;
  }

  const profile = normalizeStudentProfile(profiles[index]);
  const joinedClassIds = profile.joinedClassIds.slice();
  if (joinedClassIds.indexOf(classId) < 0) {
    joinedClassIds.unshift(classId);
  }

  profiles[index] = normalizeStudentProfile({
    ...profile,
    name: studentName || profile.name,
    joinedClassId: classId || profile.joinedClassId,
    joinedClassIds,
    classNames: {
      ...(profile.classNames || {}),
      [classId]: studentName || profile.name || "学生"
    },
    updatedAt: Date.now()
  });
  saveStudentProfiles(profiles);
  return clone(profiles[index]);
}

function removeStudentClass(studentProfileId, classId) {
  const profiles = getStudentProfiles();
  const index = profiles.findIndex((item) => item.id === studentProfileId);
  if (index < 0) {
    return null;
  }

  const profile = normalizeStudentProfile(profiles[index]);
  const joinedClassIds = profile.joinedClassIds.filter((item) => item !== classId);
  const classNames = {
    ...(profile.classNames || {})
  };
  delete classNames[classId];

  profiles[index] = normalizeStudentProfile({
    ...profile,
    joinedClassId: profile.joinedClassId === classId ? joinedClassIds[0] || "" : profile.joinedClassId,
    joinedClassIds,
    classNames,
    updatedAt: Date.now()
  });
  saveStudentProfiles(profiles);
  return clone(profiles[index]);
}

function leaveClass(classId, studentProfileId) {
  const classes = getAllClasses();
  const classIndex = classes.findIndex((item) => item.id === classId);
  if (classIndex >= 0) {
    classes[classIndex] = {
      ...classes[classIndex],
      studentIds: (classes[classIndex].studentIds || []).filter((item) => item !== studentProfileId),
      updatedAt: Date.now()
    };
    saveClasses(classes);
  }

  return removeStudentClass(studentProfileId, classId);
}

function isStudentInClass(studentProfile, classId) {
  const profile = normalizeStudentProfile(studentProfile);
  return !!(profile && profile.joinedClassIds && profile.joinedClassIds.indexOf(classId) >= 0);
}

function getJoinedClassesByStudentAccountId(accountId) {
  const profile = getStudentProfileByAccountId(accountId);
  if (!profile) {
    return [];
  }

  return clone((profile.joinedClassIds || [])
    .map((classId) => {
      const classInfo = getClassById(classId);
      if (!classInfo) {
        return null;
      }
      const teacherProfile = getTeacherProfileById(classInfo.teacherProfileId);
      return {
        ...classInfo,
        teacherName: teacherProfile ? teacherProfile.name : "老师",
        studentName: getStudentNameInClass(profile.id, classInfo.id)
      };
    })
    .filter(Boolean));
}

function joinClass(payload) {
  const accountId = payload.accountId;
  const classInfo = findClassByCode(payload.code);
  if (!classInfo) {
    throw new Error("CLASS_NOT_FOUND");
  }

  const student = createOrUpdateStudentProfile({
    accountId,
    name: payload.name,
    joinedClassId: classInfo.id
  });
  const updatedStudent = addStudentClass(student.id, classInfo.id, payload.name) || student;
  const updatedClass = addStudentToClass(classInfo.id, student.id);

  return {
    classInfo: clone(updatedClass || classInfo),
    student: clone(updatedStudent)
  };
}

function getStudentDefaultRoute(accountId) {
  const studentProfile = getStudentProfileByAccountId(accountId);
  if (studentProfile && studentProfile.joinedClassIds && studentProfile.joinedClassIds.length) {
    const classes = (studentProfile.joinedClassIds || [])
      .map((classId) => getClassById(classId))
      .filter(Boolean);
    if (classes.length === 1) {
      return "/pages/studentClass/studentClass?role=student&classId=" + classes[0].id
        + "&accountId=" + accountId;
    }
    if (classes.length > 1) {
      return "/pages/studentHome/studentHome?role=student&accountId=" + accountId;
    }
    return "/pages/studentHome/studentHome?role=student&accountId=" + accountId + "&state=classMissing";
  }

  return "/pages/studentHome/studentHome?role=student&accountId=" + accountId;
}

function getDefaultEntryRoute(account) {
  if (!account) {
    return "/pages/login/login";
  }

  if (account.lastSelectedRole === "teacher") {
    ensureTeacherProfile(account.id);
    return "/pages/teacher/teacher?role=teacher&accountId=" + account.id;
  }

  if (account.lastSelectedRole === "student") {
    return getStudentDefaultRoute(account.id);
  }

  return "/pages/role/role";
}

function getWordMeaningCache() {
  return getObjectStorage("wordMeaningCache");
}

function saveWordMeaningCache(cache) {
  saveObjectStorage("wordMeaningCache", cache);
}

function getCachedWordMeaning(word) {
  const normalizedWord = normalizeEnglishWord(word);
  const record = getWordMeaningCache()[normalizedWord];
  return record && record.meaning ? clone(record) : null;
}

function getMeaningSourceLabel(meaningSource) {
  const meaningSourceLabelMap = {
    cache: "本地缓存",
    local_lexicon: "本地词库",
    dictionary_api: "在线词典",
    translation_api: "翻译服务",
    ai: "AI",
    manual: "手动",
    missing: "待补充"
  };
  return meaningSourceLabelMap[meaningSource] || "待补充";
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
    .replace(/^[\s:：,，;；、/-]+/, "")
    .trim();

  const parts = meaning
    .split(/[;；\n\r,，/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const chinesePart = parts.find((item) => /[\u4e00-\u9fff]/.test(item)) || meaning;

  meaning = chinesePart
    .replace(/[^\u4e00-\u9fff·…、，的地得了和与为在到时]+/g, "")
    .replace(/^的+/, "")
    .trim();

  if (meaning.length > 12) {
    meaning = meaning.slice(0, 12);
  }

  return meaning;
}

function cacheWordMeaning(payload) {
  const word = normalizeEnglishWord(payload && payload.word);
  const meaning = sanitizeMeaning(payload && payload.meaning);
  if (!word || !meaning) {
    return null;
  }

  const source = payload.source || "manual";
  const cache = getWordMeaningCache();
  cache[word] = {
    word,
    meaning,
    source,
    phonetic: payload.phonetic || "",
    partOfSpeech: payload.partOfSpeech || "",
    sample: payload.sample || "",
    updatedAt: Date.now()
  };
  saveWordMeaningCache(cache);
  return clone(cache[word]);
}

function extractOnlineMeaning(payload) {
  if (!payload) {
    return null;
  }

  const result = payload.result || payload.data || payload;
  const candidates = [
    result.meaning,
    result.translation,
    result.translatedText,
    result.explain,
    result.definition,
    result.shortMeaning
  ];

  if (Array.isArray(result.translations)) {
    candidates.push(result.translations.join("；"));
  }
  if (Array.isArray(result.explains)) {
    candidates.push(result.explains.join("；"));
  }
  if (result.basic && Array.isArray(result.basic.explains)) {
    candidates.push(result.basic.explains.join("；"));
  }

  for (let index = 0; index < candidates.length; index += 1) {
    const meaning = sanitizeMeaning(candidates[index]);
    if (meaning) {
      return {
        meaning,
        source: result.source || result.meaningSource || "dictionary_api",
        phonetic: result.phonetic || result.ukphone || result.usphone || "",
        partOfSpeech: result.partOfSpeech || "",
        sample: result.sample || ""
      };
    }
  }

  return null;
}

function createWordRecord(payload, index) {
  const word = normalizeEnglishWord(payload.word);
  if (!isValidEnglishWord(word)) {
    return null;
  }

  const lexiconEntry = vocabLexicon.findEntry(word);
  const cachedMeaning = payload.meaning ? null : getCachedWordMeaning(word);
  const meaning = sanitizeMeaning(
    payload.meaning ||
    (cachedMeaning ? cachedMeaning.meaning : "") ||
    (lexiconEntry ? lexiconEntry.meaning : "")
  );
  const explicitAudioUrl = payload.audioUrl || "";
  const source = payload.source || "manual";
  const meaningSource = meaning
    ? payload.meaningSource || (payload.meaning ? "manual" : cachedMeaning ? "cache" : "local_lexicon")
    : "missing";
  const sourceLabelMap = {
    manual: "文本",
    photo: "拍照",
    voice: "语音"
  };
  const sourceLabel = sourceLabelMap[source] || "文本";

  return {
    id: payload.id || createId("word") + "_" + index,
    word,
    meaning,
    sample: payload.sample || "",
    audioUrl: vocabLexicon.getAudioUrl(word, explicitAudioUrl),
    phonetic: lexiconEntry ? lexiconEntry.phonetic : "",
    partOfSpeech: lexiconEntry ? lexiconEntry.partOfSpeech : "",
    topic: lexiconEntry ? lexiconEntry.topic : "",
    source,
    meaningSource,
    sourceLabel,
    meaningSourceLabel: getMeaningSourceLabel(meaningSource),
    meaningStatus: meaning ? "ready" : "missing",
    meaningStatusLabel: meaning ? "已补全" : "未找到释义",
    lookupError: payload.lookupError || ""
  };
}

function parseManualWordLine(line, index, source) {
  const trimmed = (line || "").trim();
  if (!trimmed) {
    return null;
  }

  let segments = trimmed.split(/[|｜]/).map((item) => item.trim()).filter(Boolean);
  if (segments.length < 2) {
    segments = trimmed.split(/[：:]/).map((item) => item.trim()).filter(Boolean);
  }
  if (segments.length < 2) {
    const matched = trimmed.match(/^([A-Za-z]+)\s+([\u4e00-\u9fff].*)$/);
    if (matched) {
      segments = [matched[1], matched[2]];
    }
  }
  if (segments.length < 2) {
    return null;
  }

  const detailSegments = segments.slice(2);
  const explicitAudioUrl = detailSegments.find((item) => isAudioUrl(item)) || "";
  const sample = detailSegments.find((item) => !isAudioUrl(item)) || "";
  return createWordRecord({
    word: segments[0],
    meaning: segments[1],
    sample,
    audioUrl: explicitAudioUrl,
    source: source || "manual",
    meaningSource: "manual"
  }, index);
}

function parseEnglishTokens(input) {
  return uniqueValues(
    (String(input || "").match(/[A-Za-z]+/g) || [])
      .map(normalizeEnglishWord)
      .filter(isValidEnglishWord)
  );
}

function parseWordInput(input, source) {
  const words = [];
  const seen = {};

  String(input || "").split("\n").forEach((line) => {
    const manualWord = parseManualWordLine(line, words.length, source || "manual");
    if (manualWord) {
      if (!seen[manualWord.word]) {
        seen[manualWord.word] = true;
        words.push(manualWord);
      }
      return;
    }

    parseEnglishTokens(line).forEach((word) => {
      if (!seen[word]) {
        const wordRecord = createWordRecord({
          word,
          source: source || "manual"
        }, words.length);
        if (wordRecord) {
          seen[word] = true;
          words.push(wordRecord);
        }
      }
    });
  });

  return words;
}

function normalizePublishedWords(words) {
  const seen = {};
  return (words || [])
    .map((wordItem, index) => createWordRecord({
      ...wordItem,
      meaningSource: wordItem.meaningSource || "manual"
    }, index))
    .filter((wordItem) => {
      if (!wordItem || seen[wordItem.word]) {
        return false;
      }
      seen[wordItem.word] = true;
      return true;
    });
}

function applyMeaningResult(wordItem, result) {
  const meaning = sanitizeMeaning(result && result.meaning);
  if (!meaning) {
    return {
      ...wordItem,
      meaning: "",
      meaningSource: "missing",
      meaningSourceLabel: getMeaningSourceLabel("missing"),
      meaningStatus: "missing",
      meaningStatusLabel: "未找到释义",
      lookupError: result && result.lookupError ? result.lookupError : "未找到释义"
    };
  }

  return {
    ...wordItem,
    meaning,
    phonetic: result.phonetic || wordItem.phonetic || "",
    partOfSpeech: result.partOfSpeech || wordItem.partOfSpeech || "",
    sample: result.sample || wordItem.sample || "",
    meaningSource: result.source || "dictionary_api",
    meaningSourceLabel: getMeaningSourceLabel(result.source || "dictionary_api"),
    meaningStatus: "ready",
    meaningStatusLabel: "已补全",
    lookupError: ""
  };
}

function lookupWordMeaningOnline(word) {
  const normalizedWord = normalizeEnglishWord(word);
  return new Promise((resolve, reject) => {
    if (!cloudService.canUseCloudFunction()) {
      reject(new Error(cloudService.getUnavailableMessage("在线释义服务")));
      return;
    }

    wx.cloud.callFunction({
      name: "lookupWordMeaning",
      data: {
        word: normalizedWord
      },
      success: (res) => {
        const meaningResult = extractOnlineMeaning(res && res.result);
        if (!meaningResult || !meaningResult.meaning) {
          reject(new Error("在线释义未返回结果"));
          return;
        }

        const cachedRecord = cacheWordMeaning({
          word: normalizedWord,
          meaning: meaningResult.meaning,
          source: meaningResult.source || "dictionary_api",
          phonetic: meaningResult.phonetic,
          partOfSpeech: meaningResult.partOfSpeech,
          sample: meaningResult.sample
        });
        resolve({
          ...meaningResult,
          source: cachedRecord ? cachedRecord.source : meaningResult.source || "dictionary_api"
        });
      },
      fail: (error) => {
        reject(new Error(cloudService.normalizeCloudError(error)));
      }
    });
  });
}

function lookupWordMeaning(word) {
  const normalizedWord = normalizeEnglishWord(word);
  const cachedRecord = getCachedWordMeaning(normalizedWord);
  if (cachedRecord) {
    return Promise.resolve({
      meaning: cachedRecord.meaning,
      source: "cache",
      phonetic: cachedRecord.phonetic || "",
      partOfSpeech: cachedRecord.partOfSpeech || "",
      sample: cachedRecord.sample || ""
    });
  }

  const lexiconEntry = vocabLexicon.findEntry(normalizedWord);
  if (lexiconEntry && lexiconEntry.meaning) {
    return Promise.resolve({
      meaning: lexiconEntry.meaning,
      source: "local_lexicon",
      phonetic: lexiconEntry.phonetic || "",
      partOfSpeech: lexiconEntry.partOfSpeech || "",
      sample: ""
    });
  }

  return lookupWordMeaningOnline(normalizedWord);
}

function resolveWordMeanings(words) {
  return Promise.all((words || []).map((wordItem) => {
    if (!wordItem || !wordItem.word || wordItem.meaning) {
      return Promise.resolve(wordItem);
    }

    return lookupWordMeaning(wordItem.word)
      .then((result) => applyMeaningResult(wordItem, result))
      .catch((error) => applyMeaningResult(wordItem, {
        meaning: "",
        source: "missing",
        lookupError: error && error.message ? error.message : "未找到释义"
      }));
  }));
}

function uniqueValues(values) {
  return Array.from(new Set(values));
}

function shuffle(items) {
  const list = items.slice();
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = list[index];
    list[index] = list[swapIndex];
    list[swapIndex] = temp;
  }
  return list;
}

function makeOption(value, isCorrect) {
  return {
    label: value,
    value,
    isCorrect: !!isCorrect
  };
}

function makeChoiceOptions(correctAnswer, distractors) {
  return shuffle(
    uniqueValues([correctAnswer].concat(distractors))
      .slice(0, 4)
      .map((value) => makeOption(value, value === correctAnswer))
  );
}

function getChallengeAudioUrl(wordItem) {
  return vocabLexicon.getAudioUrl(wordItem.word, wordItem.audioUrl);
}

function buildMissingWord(word) {
  const letters = String(word || "").split("");
  if (letters.length <= 2) {
    return letters.join(" ");
  }

  let missingCount = 1;
  if (letters.length >= 8) {
    missingCount = 3;
  } else if (letters.length >= 5) {
    missingCount = 2;
  }

  const vowels = ["a", "e", "i", "o", "u"];
  const candidateIndexes = letters
    .map((letter, index) => ({ letter, index }))
    .filter((item) => item.index > 0 && item.index < letters.length - 1)
    .sort((left, right) => {
      const leftIsVowel = vowels.indexOf(left.letter.toLowerCase()) >= 0 ? 0 : 1;
      const rightIsVowel = vowels.indexOf(right.letter.toLowerCase()) >= 0 ? 0 : 1;
      return leftIsVowel - rightIsVowel ||
        Math.abs(left.index - letters.length / 2) - Math.abs(right.index - letters.length / 2);
    });

  const missingIndexes = candidateIndexes.slice(0, missingCount).map((item) => item.index);
  return letters
    .map((letter, letterIndex) => (missingIndexes.indexOf(letterIndex) >= 0 ? "_" : letter))
    .join(" ");
}

function buildWordChallenge(task, wordItem, taskType, wordIndex) {
  const taskWords = ((task && task.words) || []).map((item) => item.word);
  const taskMeanings = ((task && task.words) || []).map((item) => item.meaning);
  const base = {
    id: "challenge_" + task.id + "_" + wordItem.id + "_" + taskType,
    wordId: wordItem.id,
    word: wordItem.word,
    meaning: wordItem.meaning,
    taskType,
    type: taskType,
    audioUrl: getChallengeAudioUrl(wordItem),
    phonetic: wordItem.phonetic || "",
    status: "pending",
    score: null,
    explanation: wordItem.word + " = " + wordItem.meaning,
    order: wordIndex
  };

  if (taskType === "en_to_zh") {
    return {
      ...base,
      title: "看英文选中文",
      stem: wordItem.word,
      options: makeChoiceOptions(
        wordItem.meaning,
        vocabLexicon.generateMeaningDistractors(wordItem.word, 3, taskMeanings)
      ),
      answer: wordItem.meaning,
      correctAnswer: wordItem.meaning
    };
  }

  if (taskType === "zh_to_en") {
    return {
      ...base,
      title: "看中文选英文",
      stem: wordItem.meaning,
      options: makeChoiceOptions(
        wordItem.word,
        vocabLexicon.generateEnglishDistractors(wordItem.word, 3, taskWords)
      ),
      answer: wordItem.word,
      correctAnswer: wordItem.word
    };
  }

  if (taskType === "audio_to_word") {
    return {
      ...base,
      title: "听读音选单词",
      stem: "听读音，选择正确单词",
      options: makeChoiceOptions(
        wordItem.word,
        vocabLexicon.generateEnglishDistractors(wordItem.word, 3, taskWords)
      ),
      answer: wordItem.word,
      correctAnswer: wordItem.word
    };
  }

  if (taskType === "read_aloud") {
    return {
      ...base,
      title: "看英文读单词",
      stem: wordItem.word,
      answer: wordItem.word,
      correctAnswer: wordItem.word
    };
  }

  return {
    ...base,
    title: "补全缺失字母",
    stem: buildMissingWord(wordItem.word),
    hint: wordItem.meaning,
    answer: wordItem.word,
    correctAnswer: wordItem.word
  };
}

function buildChallenge(task) {
  const words = (task && task.words) || [];
  if (!words.length) {
    return [];
  }

  const taskTypes = ["en_to_zh", "zh_to_en", "audio_to_word", "read_aloud", "spell_missing"];
  return taskTypes.reduce((result, taskType) => {
    return result.concat(words.map((item, index) => buildWordChallenge(task, item, taskType, index)));
  }, []);
}

function getTasks() {
  return getAllTasks().filter((task) => !task.deletedAt);
}

function getAllTasks() {
  return getCollection("tasks")
    .map((task) => normalizeTask(task))
    .sort((left, right) => right.createdAt - left.createdAt);
}

function saveTasks(tasks) {
  saveCollection("tasks", tasks.map((task) => normalizeTask(task)));
}

function hasAssignmentScope(task) {
  return !!task && Array.isArray(task.assignedStudentIds);
}

function normalizeAssignedStudentIds(ids) {
  return uniqueValues((Array.isArray(ids) ? ids : []).filter((item) => !!item));
}

function getAssignmentLabel(task) {
  if (!hasAssignmentScope(task)) {
    return "全班";
  }

  const count = normalizeAssignedStudentIds(task.assignedStudentIds).length;
  return count ? count + " 人" : "暂无指定学生";
}

function getAssignmentDetailLabel(task) {
  if (!hasAssignmentScope(task)) {
    return "全班学生";
  }

  const countLabel = getAssignmentLabel(task);
  return task.assignmentMode === "selected"
    ? "指定学生 · " + countLabel
    : "全班学生 · " + countLabel;
}

function normalizeTask(task) {
  if (!task) {
    return task;
  }

  const dueAt = Number(task.dueAt || 0);
  const assignmentPatch = {};
  if (hasAssignmentScope(task)) {
    assignmentPatch.assignmentMode = task.assignmentMode === "selected" ? "selected" : "all";
    assignmentPatch.assignedStudentIds = normalizeAssignedStudentIds(task.assignedStudentIds);
    assignmentPatch.assignedStudentNames = Array.isArray(task.assignedStudentNames)
      ? task.assignedStudentNames.slice(0, assignmentPatch.assignedStudentIds.length)
      : [];
  }
  const normalizedTask = {
    ...task,
    ...assignmentPatch,
    dueAt,
    dueDate: task.dueDate || (dueAt ? formatDateInput(dueAt) : ""),
    dueTime: task.dueTime || (dueAt ? formatTimeInput(dueAt) : ""),
    dueLabel: dueAt ? formatDueLabel(dueAt) : (task.dueLabel || "24 小时内完成"),
    createdAtLabel: task.createdAtLabel || formatDateTime(task.createdAt),
    deletedAt: task.deletedAt || null
  };

  return {
    ...normalizedTask,
    assignmentLabel: getAssignmentLabel(normalizedTask),
    assignmentDetailLabel: getAssignmentDetailLabel(normalizedTask)
  };
}

function getTaskById(taskId) {
  return clone(getTasks().find((item) => item.id === taskId) || null);
}

function getTasksByClassId(classId) {
  return clone(getTasks().filter((item) => item.classId === classId));
}

function isTaskAssignedToStudent(task, studentId) {
  const normalizedTask = normalizeTask(task);
  if (!hasAssignmentScope(normalizedTask)) {
    return true;
  }

  return normalizeAssignedStudentIds(normalizedTask.assignedStudentIds).indexOf(studentId) >= 0;
}

function getTasksByClassIdForStudent(classId, studentId) {
  return clone(getTasksByClassId(classId).filter((task) => isTaskAssignedToStudent(task, studentId)));
}

function getTaskTargetStudents(task) {
  const normalizedTask = normalizeTask(task);
  if (!hasAssignmentScope(normalizedTask)) {
    return getStudentsByClassId(normalizedTask.classId);
  }

  const ids = normalizeAssignedStudentIds(normalizedTask.assignedStudentIds);
  const names = Array.isArray(normalizedTask.assignedStudentNames)
    ? normalizedTask.assignedStudentNames
    : [];

  return clone(ids.map((studentId, index) => {
    const student = getStudentById(studentId);
    if (student) {
      return {
        ...student,
        name: getStudentNameInClass(student.id, normalizedTask.classId) || student.name || names[index] || "学生"
      };
    }

    return {
      id: studentId,
      accountId: "",
      name: names[index] || "学生",
      joinedClassId: "",
      joinedClassIds: [],
      classNames: {}
    };
  }));
}

function createTask(payload) {
  const classInfo = getClassById(payload.classId);
  if (!classInfo) {
    throw new Error("CLASS_REQUIRED");
  }
  const publisherTeacherProfileId = payload.publisherTeacherProfileId ||
    payload.teacherProfileId ||
    classInfo.ownerTeacherProfileId ||
    classInfo.teacherProfileId;
  if (!canPublishTask(classInfo.id, publisherTeacherProfileId)) {
    throw new Error("PUBLISH_FORBIDDEN");
  }

  const words = payload.words
    ? normalizePublishedWords(payload.words)
    : parseWordInput(payload.wordInput);
  if (!words.length) {
    throw new Error("WORD_REQUIRED");
  }
  if (words.some((item) => !item.meaning)) {
    throw new Error("WORD_MEANING_REQUIRED");
  }
  const now = Date.now();
  const dueAt = Number(payload.dueAt || buildDueAt(payload.dueDate, payload.dueTime));
  if (!dueAt) {
    throw new Error("DUE_REQUIRED");
  }
  if (dueAt <= now) {
    throw new Error("DUE_PAST");
  }

  const classStudents = getStudentsByClassId(classInfo.id);
  const assignmentMode = payload.assignmentMode === "selected" ? "selected" : "all";
  const requestedStudentIds = normalizeAssignedStudentIds(payload.assignedStudentIds);
  const requestedStudentMap = requestedStudentIds.reduce((result, studentId) => {
    result[studentId] = true;
    return result;
  }, {});
  const assignedStudents = assignmentMode === "selected"
    ? classStudents.filter((student) => requestedStudentMap[student.id])
    : classStudents;
  if (assignmentMode === "selected" && classStudents.length && !assignedStudents.length) {
    throw new Error("ASSIGNEE_REQUIRED");
  }
  const assignedStudentIds = assignedStudents.map((student) => student.id);
  const assignedStudentNames = assignedStudents.map((student) => (
    getStudentNameInClass(student.id, classInfo.id) || student.name || "学生"
  ));

  const task = {
    id: createId("task"),
    classId: classInfo.id,
    teacherAccountId: payload.teacherAccountId || classInfo.ownerTeacherAccountId || classInfo.teacherAccountId,
    teacherProfileId: publisherTeacherProfileId,
    publisherTeacherProfileId,
    lessonTitle: payload.lessonTitle.trim(),
    dueAt,
    dueDate: payload.dueDate || formatDateInput(dueAt),
    dueTime: payload.dueTime || formatTimeInput(dueAt),
    dueLabel: formatDueLabel(dueAt),
    teacherNote: (payload.teacherNote || "").trim(),
    assignmentMode,
    assignedStudentIds,
    assignedStudentNames,
    createdAt: now,
    createdAtLabel: formatDateTime(now),
    words
  };

  saveTasks([task].concat(getAllTasks()));
  return clone(task);
}

function softDeleteTask(taskId) {
  const tasks = getAllTasks();
  const index = tasks.findIndex((item) => item.id === taskId);
  if (index < 0) {
    return null;
  }

  tasks[index] = {
    ...tasks[index],
    deletedAt: Date.now()
  };
  saveTasks(tasks);
  return clone(tasks[index]);
}

function getSubmissions() {
  return getCollection("submissions");
}

function saveSubmissions(submissions) {
  saveCollection("submissions", submissions);
}

function getSubmission(taskId, studentId) {
  return clone(
    getSubmissions().find((item) => item.taskId === taskId && item.studentId === studentId) || null
  );
}

function getSubmissionsByTaskId(taskId) {
  return clone(getSubmissions().filter((item) => item.taskId === taskId));
}

function getSubmissionsByClassId(classId) {
  return clone(getSubmissions().filter((item) => item.classId === classId));
}

function saveSubmission(payload) {
  const submissions = getSubmissions();
  const existingIndex = submissions.findIndex(
    (item) => item.taskId === payload.taskId && item.studentId === payload.studentId
  );
  const existing = existingIndex >= 0 ? submissions[existingIndex] : null;
  const task = getTaskById(payload.taskId);
  const finishedAt = Date.now();
  const submission = {
    id: payload.id || (existing && existing.id) || createId("submission"),
    taskId: payload.taskId,
    classId: payload.classId || (task && task.classId) || "",
    studentId: payload.studentId,
    studentName: payload.studentName,
    score: payload.score,
    correctCount: payload.correctCount,
    totalCount: payload.totalCount,
    durationSec: payload.durationSec,
    firstRoundWrongCount: payload.firstRoundWrongCount || 0,
    totalRetryCount: payload.totalRetryCount || 0,
    allPassed: !!payload.allPassed,
    finishedAt,
    finishedAtLabel: formatDateTime(finishedAt),
    wrongWords: payload.wrongWords || [],
    challengeResults: payload.challengeResults || []
  };

  if (existingIndex >= 0) {
    submissions.splice(existingIndex, 1, submission);
  } else {
    submissions.unshift(submission);
  }

  saveSubmissions(submissions);
  return clone(submission);
}

function getTaskReport(taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    return null;
  }

  const students = getTaskTargetStudents(task);
  const targetStudentIds = students.map((student) => student.id);
  const targetStudentMap = targetStudentIds.reduce((result, studentId) => {
    result[studentId] = true;
    return result;
  }, {});
  const submissions = getSubmissionsByTaskId(task.id).filter((submission) => targetStudentMap[submission.studentId]);
  const completedRows = students.map((student) => {
    const submission = submissions.find((item) => item.studentId === student.id) || null;
    const wrongWords = submission && Array.isArray(submission.wrongWords) ? submission.wrongWords : [];
    return {
      id: student.id,
      student,
      submission,
      statusText: submission ? "已完成" : "未完成",
      scoreLabel: submission ? submission.score + " 分" : "待完成",
      durationLabel: submission ? formatDuration(submission.durationSec) : "暂无",
      finishedAtLabel: submission ? submission.finishedAtLabel : "暂无",
      wrongWordsPreview: wrongWords.length
        ? wrongWords.map((item) => item.word).join(" / ")
        : "无"
    };
  });

  const completedCount = completedRows.filter((item) => !!item.submission).length;
  const avgScore = completedCount
    ? Math.round(
        completedRows
          .filter((item) => !!item.submission)
          .reduce((sum, item) => sum + item.submission.score, 0) / completedCount
      )
    : 0;
  const completionRate = students.length ? Math.round((completedCount / students.length) * 100) : 0;

  const wrongWordMap = {};
  submissions.forEach((submission) => {
    (submission.wrongWords || []).forEach((wrongWord) => {
      const key = wrongWord.word;
      if (!wrongWordMap[key]) {
        wrongWordMap[key] = {
          word: wrongWord.word,
          meaning: wrongWord.meaning,
          wrongCount: 0
        };
      }
      wrongWordMap[key].wrongCount += 1;
    });
  });

  const hardestWords = Object.keys(wrongWordMap)
    .map((key) => wrongWordMap[key])
    .sort((left, right) => right.wrongCount - left.wrongCount)
    .slice(0, 5);

  return {
    task,
    classInfo: getClassById(task.classId),
    stats: {
      totalStudents: students.length,
      completedCount,
      completionRate,
      completionRateLabel: students.length ? completionRate + "%" : "暂无指定学生",
      avgScore,
      avgScoreLabel: completedCount ? String(avgScore) : "暂无",
      assigneeLabel: getAssignmentLabel(task),
      assignmentDetailLabel: getAssignmentDetailLabel(task)
    },
    rows: completedRows,
    hardestWords
  };
}

function resetDemoData() {
  saveTasks([]);
  saveSubmissions([]);
}

module.exports = {
  addStudentToClass,
  addStudentClass,
  addTeacherClass,
  buildChallenge,
  cacheWordMeaning,
  canEditClass,
  canPublishTask,
  canRemoveClassMember,
  clearStudentJoinedClass,
  clearCurrentSession,
  createAccount,
  createClass,
  createOrUpdateStudentProfile,
  createTask,
  ensureLocalAccount,
  ensureTeacherProfile,
  findClassByCode,
  buildDueAt,
  formatDueLabel,
  formatDuration,
  formatDateInput,
  formatTimeInput,
  generateClassCode,
  getDefaultDueMeta,
  getAccounts,
  getAccountByUsername,
  getAccountProfile,
  getActiveClassesByTeacherAccountId,
  getClassById,
  getClasses,
  getClassesByTeacherAccountId,
  getCachedWordMeaning,
  getCurrentAccount,
  getCurrentSession,
  getDefaultEntryRoute,
  getStudentById,
  getStudentDefaultRoute,
  getJoinedClassesByStudentAccountId,
  getStudentProfileByAccountId,
  getStudentProfiles,
  getStudentNameInClass,
  getStudentsByClassId,
  getSubmission,
  getSubmissions,
  getSubmissionsByClassId,
  getSubmissionsByTaskId,
  getTaskById,
  getTaskReport,
  getTasks,
  getTasksByClassId,
  getTasksByClassIdForStudent,
  getTaskTargetStudents,
  getTeacherClassesByAccountId,
  getTeacherMembersByClassId,
  getTeacherProfileByAccountId,
  getTeacherProfileById,
  getTeacherProfiles,
  getTeacherRoleInClass,
  getWordMeaningCache,
  isUsernameTaken,
  isClassCodeAvailable,
  isClassCodeTaken,
  isClassOwner,
  isStudentJoinedClass,
  isStudentInClass,
  isTeacherMember,
  isTaskAssignedToStudent,
  joinClass,
  joinClassAsTeacher,
  leaveClass,
  loginAccount,
  normalizeEnglishWord,
  normalizeClassCode,
  normalizeUsername,
  parseEnglishTokens,
  parseWordInput,
  registerAccount,
  removeStudentClass,
  removeStudentFromClass,
  removeTeacherClass,
  removeTeacherFromClass,
  resetDemoData,
  resolveWordMeanings,
  saveSubmission,
  softDeleteClass,
  softDeleteTask,
  updateClassInfo,
  updateAccountAvatar,
  updateAccountPhone,
  setLastSelectedRole
};
