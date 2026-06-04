const cloudService = require("../../utils/cloud-service");
const store = require("../../utils/store");

const EXAMPLE_INPUT = [
  "weather",
  "cloudy",
  "rainy",
  "snowman",
  "cook",
  "park"
].join("\n");

function getVoiceUi(status) {
  const textMap = {
    idle: "语音输入",
    recording: "停止录音",
    recognizing: "识别中",
    done: "重新录入",
    failed: "重新录入"
  };

  return {
    voiceStatus: status,
    isVoiceRecording: status === "recording",
    voiceButtonText: textMap[status] || "语音输入",
    voiceButtonDisabled: status === "recognizing"
  };
}

function formatVoiceDuration(duration) {
  if (!duration) {
    return "";
  }
  return (duration / 1000).toFixed(1) + " 秒";
}

function extractRecognizedText(payload) {
  if (!payload) {
    return "";
  }
  const candidates = [
    payload.text,
    payload.transcript,
    payload.recognizedText,
    payload.resultText
  ];
  if (payload.data) {
    candidates.push(payload.data.text, payload.data.transcript, payload.data.recognizedText);
  }
  if (payload.result) {
    candidates.push(payload.result.text, payload.result.transcript, payload.result.recognizedText);
  }
  return candidates.find((item) => item) || "";
}

function getErrorMessage(error, fallback) {
  if (error && error.message) {
    return error.message;
  }
  return fallback;
}

function getDateAfter(days) {
  const date = new Date(Date.now() + days * 86400000);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

Page({
  data: {
    classInfo: null,
    lessonTitle: "",
    dueAt: 0,
    dueDate: "",
    dueTime: "",
    dueLabel: "",
    duePickerVisible: false,
    dueDraftDate: "",
    dueDraftTime: "",
    minDueDate: "",
    maxDueDate: "",
    teacherNote: "先完成闯关，再对错词复习 5 分钟。",
    wordInput: "",
    previewWords: [],
    previewMissingCount: 0,
    isMeaningLookup: false,
    meaningLookupMessage: "",
    students: [],
    assignmentMode: "all",
    assignedStudentIds: [],
    selectedStudentCount: 0,
    assignmentAllLabel: "当前班级暂无学生",
    assignmentSelectedLabel: "已选择 0 人",
    assignmentNotice: "",
    recentTasks: [],
    voiceStatus: "idle",
    voiceButtonText: "语音输入",
    voiceButtonDisabled: false,
    isVoiceRecording: false,
    voiceMessage: "",
    voiceDurationLabel: "",
    voiceCloudReady: true,
    cloudNotice: "",
    photoImportImagePath: "",
    photoImportDraftText: "",
    photoImportVisible: false,
    photoImportStatus: "idle",
    photoImportMessage: "",
    accountId: ""
  },

  onLoad(options) {
    this.classId = options.classId || "";
    this.accountId = options.accountId || "";
    const defaultDue = store.getDefaultDueMeta();
    this.setData({
      ...defaultDue,
      dueDraftDate: defaultDue.dueDate,
      dueDraftTime: defaultDue.dueTime,
      minDueDate: getDateAfter(0),
      maxDueDate: getDateAfter(365)
    });
    this.setupVoiceRecorder();
  },

  onShow() {
    this.loadPage();
    if (!this.data.wordInput) {
      this.useExampleWords();
    }
  },

  onUnload() {
    this.isLeaving = true;
    if (this.voiceRecorderManager && this.data.isVoiceRecording) {
      this.voiceRecorderManager.stop();
    }
  },

  loadPage() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    const teacherProfile = store.ensureTeacherProfile(account.id);
    const classInfo = store.getClassById(this.classId);
    if (!classInfo || !store.canPublishTask(classInfo.id, teacherProfile.id)) {
      this.setData({ classInfo: null, recentTasks: [] });
      return;
    }

    const voiceCloudReady = cloudService.canUseCloudUpload();
    const cloudNotice = voiceCloudReady && cloudService.canUseCloudFunction()
      ? ""
      : cloudService.getCloudFeatureNotice();
    const students = store.getStudentsByClassId(classInfo.id).map((student) => ({
      ...student,
      displayName: store.getStudentNameInClass(student.id, classInfo.id) || student.name || "学生"
    }));

    wx.setNavigationBarTitle({ title: "发布任务" });
    this.setData({
      classInfo,
      ...this.getAssignmentPatch(students, this.data.assignedStudentIds),
      recentTasks: store.getTasksByClassId(classInfo.id).slice(0, 3),
      accountId: this.accountId || account.id,
      voiceCloudReady,
      cloudNotice
    });
  },

  getAssignmentPatch(students, selectedIds) {
    const studentList = students || [];
    const studentMap = studentList.reduce((result, student) => {
      result[student.id] = true;
      return result;
    }, {});
    const normalizedIds = Array.from(new Set(selectedIds || []))
      .filter((studentId) => studentMap[studentId]);
    const selectedMap = normalizedIds.reduce((result, studentId) => {
      result[studentId] = true;
      return result;
    }, {});

    return {
      students: studentList.map((student) => ({
        ...student,
        selected: !!selectedMap[student.id]
      })),
      assignedStudentIds: normalizedIds,
      selectedStudentCount: normalizedIds.length,
      assignmentAllLabel: studentList.length
        ? "当前班级 " + studentList.length + " 人"
        : "当前班级暂无学生",
      assignmentSelectedLabel: "已选择 " + normalizedIds.length + " 人",
      assignmentNotice: studentList.length
        ? ""
        : "当前班级暂无学生，发布后暂时无人需要完成"
    };
  },

  setupVoiceRecorder() {
    if (!wx.getRecorderManager) {
      return;
    }

    this.voiceRecorderManager = wx.getRecorderManager();
    this.voiceRecorderManager.onStop((res) => {
      this.handleVoiceRecordingStop(res || {});
    });
    this.voiceRecorderManager.onError(() => {
      if (this.isLeaving) {
        return;
      }
      this.setVoiceState("failed", {
        voiceMessage: "录音失败，请重新录入"
      });
    });
  },

  useExampleWords() {
    const lessonTitle = "七下 Unit 7 课堂重点词汇";
    this.applyWordInput(EXAMPLE_INPUT, "manual", {
      lessonTitle
    });
  },

  getDemoPhotoWords() {
    return EXAMPLE_INPUT;
  },

  mockRecognizeWordsFromImage(imagePath) {
    if (!imagePath) {
      return "";
    }
    return this.getDemoPhotoWords();
  },

  choosePhotoImport() {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["camera", "album"],
        sizeType: ["compressed"],
        success: (res) => {
          const file = res && res.tempFiles && res.tempFiles[0];
          this.setPhotoImportImage(file ? file.tempFilePath : "");
        },
        fail: () => {
          wx.showToast({
            title: "没有选择图片",
            icon: "none"
          });
        }
      });
      return;
    }

    if (!wx.chooseImage) {
      wx.showToast({
        title: "当前环境不支持选择图片",
        icon: "none"
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sourceType: ["camera", "album"],
      sizeType: ["compressed"],
      success: (res) => {
        const tempFilePath = res && res.tempFilePaths && res.tempFilePaths[0];
        this.setPhotoImportImage(tempFilePath || "");
      },
      fail: () => {
        wx.showToast({
          title: "没有选择图片",
          icon: "none"
        });
      }
    });
  },

  setPhotoImportImage(imagePath) {
    if (!imagePath) {
      this.setData({
        photoImportVisible: true,
        photoImportStatus: "failed",
        photoImportMessage: "图片读取失败，请重新拍照"
      });
      return;
    }

    const draftText = this.mockRecognizeWordsFromImage(imagePath);
    this.setData({
      photoImportImagePath: imagePath,
      photoImportDraftText: draftText,
      photoImportVisible: true,
      photoImportStatus: "drafting",
      photoImportMessage: "请检查单词草稿，确认后导入任务"
    });
  },

  onPhotoDraftInput(event) {
    this.setData({
      photoImportDraftText: event.detail.value,
      photoImportStatus: "drafting"
    });
  },

  confirmPhotoImport() {
    const draftText = (this.data.photoImportDraftText || "").trim();
    const previewWords = store.parseWordInput(draftText, "photo");
    if (!previewWords.length) {
      this.setData({
        photoImportStatus: "failed",
        photoImportMessage: "单词草稿里还没有可导入的英文单词"
      });
      return;
    }

    this.setData({
      photoImportStatus: "confirmed",
      photoImportMessage: "已导入词汇预览，请检查释义后发布"
    });
    this.applyWordInput(draftText, "photo");
  },

  cancelPhotoImport() {
    this.setData({
      photoImportImagePath: "",
      photoImportDraftText: "",
      photoImportVisible: false,
      photoImportStatus: "idle",
      photoImportMessage: ""
    });
  },

  applyWordInput(wordInput, source, extra) {
    const previewWords = store.parseWordInput(wordInput, source || "manual");
    const lookupToken = "meaning_" + Date.now();
    this.meaningLookupToken = lookupToken;
    this.setData({
      wordInput,
      ...this.getPreviewPatch(previewWords),
      ...(extra || {})
    }, () => {
      this.resolvePreviewMeanings(previewWords, lookupToken);
    });
  },

  getPreviewPatch(previewWords) {
    return {
      previewWords,
      previewMissingCount: previewWords.filter((item) => !item.meaning).length
    };
  },

  resolvePreviewMeanings(previewWords, lookupToken) {
    const missingCount = previewWords.filter((item) => !item.meaning).length;
    if (!missingCount) {
      this.setData({
        isMeaningLookup: false,
        meaningLookupMessage: ""
      });
      return;
    }

    this.setData({
      isMeaningLookup: true,
      meaningLookupMessage: cloudService.canUseCloudFunction()
        ? "正在尝试在线查询 " + missingCount + " 个词的释义"
        : "云开发服务暂不可用，本地词库查不到的单词需要手动补充"
    });

    store.resolveWordMeanings(previewWords).then((resolvedWords) => {
      if (lookupToken !== this.meaningLookupToken || this.isLeaving) {
        return;
      }

      const resolvedMissingCount = resolvedWords.filter((item) => !item.meaning).length;
      const cloudErrorCount = resolvedWords.filter((item) => (
        item.lookupError && item.lookupError.indexOf("云开发") >= 0
      )).length;
      const onlineResolvedCount = resolvedWords.filter((item) => (
        item.meaning &&
        (item.meaningSource === "dictionary_api" ||
          item.meaningSource === "translation_api" ||
          item.meaningSource === "ai" ||
          item.meaningSource === "cache")
      )).length;

      let meaningLookupMessage = "";
      if (resolvedMissingCount) {
        meaningLookupMessage = cloudErrorCount
          ? "云开发服务暂不可用，还有 " + resolvedMissingCount + " 个词需手动补充"
          : cloudService.canUseCloudFunction()
          ? "还有 " + resolvedMissingCount + " 个词未找到释义，可手动补充"
          : "云开发服务暂不可用，还有 " + resolvedMissingCount + " 个词需手动补充";
      } else if (onlineResolvedCount) {
        meaningLookupMessage = "释义已补全，可继续检查后发布";
      }

      this.setData({
        ...this.getPreviewPatch(resolvedWords),
        isMeaningLookup: false,
        meaningLookupMessage
      });
    });
  },

  onLessonInput(event) {
    this.setData({ lessonTitle: event.detail.value });
  },

  openDuePicker() {
    this.setData({
      duePickerVisible: true,
      dueDraftDate: this.data.dueDate,
      dueDraftTime: this.data.dueTime
    });
  },

  onDueDateChange(event) {
    this.setData({ dueDraftDate: event.detail.value });
  },

  onDueTimeChange(event) {
    this.setData({ dueDraftTime: event.detail.value });
  },

  cancelDuePicker() {
    this.setData({ duePickerVisible: false });
  },

  confirmDuePicker() {
    const dueAt = store.buildDueAt(this.data.dueDraftDate, this.data.dueDraftTime);
    if (!dueAt) {
      wx.showToast({
        title: "请选择截止时间",
        icon: "none"
      });
      return;
    }

    if (dueAt <= Date.now()) {
      wx.showToast({
        title: "截止时间不能早于当前时间",
        icon: "none"
      });
      return;
    }

    this.setData({
      dueAt,
      dueDate: this.data.dueDraftDate,
      dueTime: this.data.dueDraftTime,
      dueLabel: store.formatDueLabel(dueAt),
      duePickerVisible: false
    });
  },

  noop() {},

  onNoteInput(event) {
    this.setData({ teacherNote: event.detail.value });
  },

  selectAssignmentMode(event) {
    const mode = event.currentTarget.dataset.mode === "selected" ? "selected" : "all";
    this.setData({
      assignmentMode: mode,
      ...this.getAssignmentPatch(this.data.students, this.data.assignedStudentIds)
    });
  },

  toggleAssignedStudent(event) {
    const studentId = event.currentTarget.dataset.studentId;
    if (!studentId) {
      return;
    }

    const selectedIds = this.data.assignedStudentIds.slice();
    const existingIndex = selectedIds.indexOf(studentId);
    if (existingIndex >= 0) {
      selectedIds.splice(existingIndex, 1);
    } else {
      selectedIds.push(studentId);
    }

    this.setData({
      assignmentMode: "selected",
      ...this.getAssignmentPatch(this.data.students, selectedIds)
    });
  },

  selectAllStudents() {
    const selectedIds = this.data.students.map((student) => student.id);
    this.setData({
      assignmentMode: "selected",
      ...this.getAssignmentPatch(this.data.students, selectedIds)
    });
  },

  getSelectedStudents() {
    const selectedMap = this.data.assignedStudentIds.reduce((result, studentId) => {
      result[studentId] = true;
      return result;
    }, {});
    return this.data.students.filter((student) => selectedMap[student.id]);
  },

  onWordInput(event) {
    this.applyWordInput(event.detail.value, "manual");
  },

  onMeaningInput(event) {
    this.meaningLookupToken = "manual_" + Date.now();
    const index = Number(event.currentTarget.dataset.index);
    const previewWords = this.data.previewWords.slice();
    if (!previewWords[index]) {
      return;
    }

    const meaning = (event.detail.value || "").trim();
    previewWords[index] = {
      ...previewWords[index],
      meaning,
      meaningSource: meaning ? "manual" : "missing",
      meaningSourceLabel: meaning ? "手动" : "待补充",
      meaningStatus: meaning ? "ready" : "missing",
      meaningStatusLabel: meaning ? "已补全" : "未找到释义"
    };
    if (meaning) {
      store.cacheWordMeaning({
        word: previewWords[index].word,
        meaning,
        source: "manual"
      });
    }
    const missingCount = previewWords.filter((item) => !item.meaning).length;
    this.setData({
      ...this.getPreviewPatch(previewWords),
      isMeaningLookup: false,
      meaningLookupMessage: missingCount ? "还有 " + missingCount + " 个词未找到释义，可手动补充" : ""
    });
  },

  removePreviewWord(event) {
    this.meaningLookupToken = "remove_" + Date.now();
    const index = Number(event.currentTarget.dataset.index);
    const previewWords = this.data.previewWords.slice();
    if (!previewWords[index]) {
      return;
    }

    previewWords.splice(index, 1);
    const missingCount = previewWords.filter((item) => !item.meaning).length;
    this.setData({
      ...this.getPreviewPatch(previewWords),
      isMeaningLookup: false,
      meaningLookupMessage: missingCount ? "还有 " + missingCount + " 个词未找到释义，可手动补充" : "",
      wordInput: previewWords.map((item) => item.word).join("\n")
    });
  },

  toggleVoiceInput() {
    if (this.data.voiceStatus === "recognizing") {
      return;
    }

    if (!this.data.voiceCloudReady) {
      this.setVoiceState("failed", {
        voiceMessage: "语音识别服务暂未配置，请先手动输入英文单词"
      });
      return;
    }

    if (!this.voiceRecorderManager) {
      this.setVoiceState("failed", {
        voiceMessage: "当前环境不支持录音"
      });
      return;
    }

    if (this.data.voiceStatus === "recording") {
      this.stopVoiceRecording();
      return;
    }

    wx.authorize({
      scope: "scope.record",
      success: () => {
        this.startVoiceRecording();
      },
      fail: () => {
        this.setVoiceState("failed", {
          voiceMessage: "需要录音权限才能使用语音输入"
        });
      }
    });
  },

  startVoiceRecording() {
    const token = "voice_" + Date.now();
    this.voiceRecordingToken = token;
    this.voiceRecordingStartedAt = Date.now();
    this.setVoiceState("recording", {
      voiceMessage: "正在录音，请说出英文单词",
      voiceDurationLabel: ""
    });

    try {
      this.voiceRecorderManager.start({
        duration: 15000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: "mp3"
      });
    } catch (error) {
      this.setVoiceState("failed", {
        voiceMessage: "录音开始失败，请重新录入"
      });
    }
  },

  stopVoiceRecording() {
    this.setVoiceState("recognizing", {
      voiceMessage: "识别中"
    });

    try {
      this.voiceRecorderManager.stop();
    } catch (error) {
      this.setVoiceState("failed", {
        voiceMessage: "录音停止失败，请重新录入"
      });
    }
  },

  handleVoiceRecordingStop(recording) {
    if (this.isLeaving) {
      return;
    }

    const startedAt = this.voiceRecordingStartedAt || Date.now();
    const duration = Number(recording.duration || 0) || Math.max(0, Date.now() - startedAt);
    const tempFilePath = recording.tempFilePath || "";
    const durationLabel = formatVoiceDuration(duration);

    this.setVoiceState("recognizing", {
      voiceMessage: "识别中",
      voiceDurationLabel: durationLabel
    });

    if (!tempFilePath) {
      this.setVoiceState("failed", {
        voiceMessage: "没有录到语音，请重新录入",
        voiceDurationLabel: durationLabel
      });
      return;
    }

    if (duration < 600) {
      this.setVoiceState("failed", {
        voiceMessage: "录音太短，请重新录入",
        voiceDurationLabel: durationLabel
      });
      return;
    }

    this.requestVoiceRecognition({
      tempFilePath,
      duration,
      token: this.voiceRecordingToken
    }).then((text) => {
      if (this.isLeaving) {
        return;
      }

      const recognizedWords = store.parseWordInput(text, "voice");
      if (!recognizedWords.length) {
        this.setVoiceState("failed", {
          voiceMessage: "没有识别到英文单词，请重新录入",
          voiceDurationLabel: durationLabel
        });
        return;
      }

      const mergedWords = this.mergePreviewWords(this.data.previewWords, recognizedWords);
      const recognizedInput = recognizedWords.map((item) => item.word).join("\n");
      const wordInput = this.data.wordInput
        ? this.data.wordInput + "\n" + recognizedInput
        : recognizedInput;
      const lookupToken = "meaning_" + Date.now();
      this.meaningLookupToken = lookupToken;
      this.setData({
        wordInput,
        ...this.getPreviewPatch(mergedWords)
      }, () => {
        this.resolvePreviewMeanings(mergedWords, lookupToken);
      });
      this.setVoiceState("done", {
        voiceMessage: "已识别 " + recognizedWords.length + " 个英文单词",
        voiceDurationLabel: durationLabel
      });
    }).catch((error) => {
      if (this.isLeaving) {
        return;
      }
      this.setVoiceState("failed", {
        voiceMessage: getErrorMessage(error, "语音识别失败，请手动输入英文单词"),
        voiceDurationLabel: durationLabel
      });
    });
  },

  mergePreviewWords(currentWords, incomingWords) {
    const seen = {};
    const merged = [];
    currentWords.concat(incomingWords).forEach((wordItem) => {
      if (wordItem && wordItem.word && !seen[wordItem.word]) {
        seen[wordItem.word] = true;
        merged.push(wordItem);
      }
    });
    return merged;
  },

  requestVoiceRecognition(recording) {
    return new Promise((resolve, reject) => {
      if (!cloudService.canUseCloudUpload()) {
        reject(new Error("语音识别服务暂未配置，请先手动输入英文单词"));
        return;
      }

      const cloudPath = [
        "teacher-word-input",
        this.classId || "class",
        recording.token + ".mp3"
      ].join("/");

      wx.cloud.uploadFile({
        cloudPath,
        filePath: recording.tempFilePath,
        success: (uploadRes) => {
          const fileID = uploadRes && uploadRes.fileID;
          if (!fileID) {
            reject(new Error("语音上传失败，请重新录入"));
            return;
          }

          wx.cloud.callFunction({
            name: "recognizeWordInput",
            data: {
              fileID,
              language: "en",
              duration: recording.duration
            },
            success: (recognitionRes) => {
              const text = extractRecognizedText(recognitionRes && recognitionRes.result);
              if (!text) {
                reject(new Error("语音识别结果为空，请重新录入"));
                return;
              }
              resolve(text);
            },
            fail: () => {
              reject(new Error("语音识别失败，请手动输入英文单词"));
            }
          });
        },
        fail: (error) => {
          reject(new Error(cloudService.normalizeCloudError(error)));
        }
      });
    });
  },

  publishTask() {
    const account = store.getCurrentAccount();
    const classInfo = this.data.classInfo;
    const lessonTitle = (this.data.lessonTitle || "").trim();
    const words = this.data.previewWords.filter((item) => item.word);

    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    if (!classInfo) {
      wx.showToast({
        title: "请先从班级详情进入",
        icon: "none"
      });
      return;
    }

    if (!lessonTitle) {
      wx.showToast({
        title: "请先填写任务标题",
        icon: "none"
      });
      return;
    }

    if (!this.data.dueAt) {
      wx.showToast({
        title: "请选择截止时间",
        icon: "none"
      });
      return;
    }

    if (this.data.dueAt <= Date.now()) {
      wx.showToast({
        title: "截止时间不能早于当前时间",
        icon: "none"
      });
      return;
    }

    if (words.length < 1) {
      wx.showToast({
        title: "请至少输入 1 个单词",
        icon: "none"
      });
      return;
    }

    if (words.some((item) => !item.meaning)) {
      wx.showToast({
        title: "还有单词缺少中文释义，补全后才能发布",
        icon: "none"
      });
      return;
    }

    const assignmentMode = this.data.assignmentMode === "selected" ? "selected" : "all";
    const selectedStudents = this.getSelectedStudents();
    const targetStudents = assignmentMode === "selected" ? selectedStudents : this.data.students;
    if (assignmentMode === "selected" && this.data.students.length && !targetStudents.length) {
      wx.showToast({
        title: "请选择至少 1 名学生",
        icon: "none"
      });
      return;
    }

    words.forEach((item) => {
      if (item.meaning && item.meaningSource === "manual") {
        store.cacheWordMeaning({
          word: item.word,
          meaning: item.meaning,
          source: "manual"
        });
      }
    });

    let task = null;
    try {
      task = store.createTask({
        classId: classInfo.id,
        teacherAccountId: account.id,
        teacherProfileId: store.ensureTeacherProfile(account.id).id,
        lessonTitle,
        dueAt: this.data.dueAt,
        dueDate: this.data.dueDate,
        dueTime: this.data.dueTime,
        teacherNote: this.data.teacherNote,
        assignmentMode,
        assignedStudentIds: targetStudents.map((student) => student.id),
        assignedStudentNames: targetStudents.map((student) => student.displayName || student.name || "学生"),
        words
      });
    } catch (error) {
      let title = "发布失败，请检查词汇";
      if (error.message === "DUE_REQUIRED") {
        title = "请选择截止时间";
      } else if (error.message === "DUE_PAST") {
        title = "截止时间不能早于当前时间";
      } else if (error.message === "WORD_REQUIRED") {
        title = "请至少输入 1 个单词";
      } else if (error.message === "WORD_MEANING_REQUIRED") {
        title = "还有单词缺少中文释义，补全后才能发布";
      } else if (error.message === "ASSIGNEE_REQUIRED") {
        title = "请选择至少 1 名学生";
      } else if (error.message === "PUBLISH_FORBIDDEN") {
        title = "只有创建老师可以发布任务";
      }
      wx.showToast({
        title,
        icon: "none"
      });
      return;
    }

    this.loadPage();
    wx.showModal({
      title: "任务已发布",
      content: targetStudents.length
        ? "已发布给 " + targetStudents.length + " 名学生。"
        : "当前班级暂无学生，任务已保存，暂时无人需要完成。",
      confirmText: "看完成情况",
      cancelText: "回班级",
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: "/pages/report/report?role=teacher&taskId=" + task.id
              + "&classId=" + classInfo.id
              + "&accountId=" + this.data.accountId
          });
          return;
        }

        wx.redirectTo({
          url: "/pages/classDetail/classDetail?role=teacher&classId=" + classInfo.id
            + "&accountId=" + this.data.accountId
        });
      }
    });
  },

  goClassDetail() {
    if (!this.data.classInfo) {
      return;
    }

    wx.redirectTo({
      url: "/pages/classDetail/classDetail?role=teacher&classId=" + this.data.classInfo.id
        + "&accountId=" + this.data.accountId
    });
  },

  openReport(event) {
    wx.navigateTo({
      url: "/pages/report/report?role=teacher&taskId=" + event.currentTarget.dataset.taskId
        + "&classId=" + this.data.classInfo.id
        + "&accountId=" + this.data.accountId
    });
  },

  setVoiceState(status, extra) {
    this.setData({
      ...getVoiceUi(status),
      ...(extra || {})
    });
  }
});
