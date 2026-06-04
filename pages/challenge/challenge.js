const audioPlayer = require("../../utils/audio-player");
const cloudService = require("../../utils/cloud-service");
const store = require("../../utils/store");

const READ_ALOUD_PASS_SCORE = 60;
const READ_ALOUD_MIN_DURATION_MS = 500;
const DEBUG_RECORDING = false;

const TASK_TYPE_LABELS = {
  en_to_zh: "看英文选中文",
  zh_to_en: "看中文选英文",
  audio_to_word: "听读音选单词",
  read_aloud: "看英文读单词",
  spell_missing: "补全缺失字母"
};

const READ_ALOUD_INITIAL_STATE = {
  isRecording: false,
  speakingStatus: "idle",
  speakingScore: null,
  speakingScoreLabel: "",
  hasSpeakingScore: false,
  speakingPassed: false,
  speakingMessage: "",
  recordButtonText: "开始录音",
  recordButtonDisabled: false,
  readAloudAttemptCount: 0,
  readAloudBestScore: null,
  readAloudBestScoreLabel: "暂无",
  readAloudLastDuration: 0,
  readAloudLastDurationLabel: ""
};

const RECORDING_DEBUG_LIMIT = 8;

function getSpeakingUi(status) {
  const textMap = {
    idle: "开始录音",
    recording: "停止录音",
    scoring: "正在评分",
    failed: "重新录音",
    passed: "重新录音"
  };

  return {
    speakingStatus: status,
    isRecording: status === "recording",
    recordButtonText: textMap[status] || "开始录音",
    recordButtonDisabled: status === "scoring"
  };
}

function isNumber(value) {
  return typeof value === "number" && isFinite(value);
}

function normalizeScore(value) {
  const score = Number(value);
  if (!isFinite(score) || score < 0 || score > 100) {
    return null;
  }
  return Math.round(score);
}

function parseScoreResult(payload) {
  const candidates = [];
  if (payload) {
    candidates.push(payload.score, payload.Score, payload.pronunciationScore);
    if (payload.data) {
      candidates.push(payload.data.score, payload.data.Score, payload.data.pronunciationScore);
    }
    if (payload.result) {
      candidates.push(payload.result.score, payload.result.Score, payload.result.pronunciationScore);
    }
  }

  for (let index = 0; index < candidates.length; index += 1) {
    const score = normalizeScore(candidates[index]);
    if (score !== null) {
      return score;
    }
  }

  return null;
}

function formatDurationMs(duration) {
  if (!duration) {
    return "";
  }
  return (duration / 1000).toFixed(1) + " 秒";
}

function getExpectedReadDuration(word) {
  const letterCount = String(word || "").replace(/[^a-z]/gi, "").length;
  if (letterCount <= 4) {
    return READ_ALOUD_MIN_DURATION_MS;
  }
  if (letterCount <= 7) {
    return 650;
  }
  return 800;
}

function getErrorMessage(error, fallback) {
  if (error && error.message) {
    return error.message;
  }
  if (error && error.errMsg) {
    return fallback;
  }
  return fallback;
}

Page({
  data: {
    task: null,
    student: null,
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    pendingQueue: [],
    retryQueue: [],
    passedCardIds: [],
    cardStates: {},
    passedCount: 0,
    totalCards: 0,
    currentRound: 1,
    firstRoundWrongCardIds: [],
    firstRoundWrongCount: 0,
    totalRetryCount: 0,
    answers: [],
    selectedOption: "",
    inputAnswer: "",
    isAnswered: false,
    answerCorrect: false,
    progress: 0,
    startTime: 0,
    recordingDebugLogs: [],
    recordingDebugText: "录音调试：等待操作",
    recordingTempFilePath: "",
    recordingFileSizeLabel: "",
    recordingPlaybackText: "",
    showRecordingDebug: DEBUG_RECORDING,
    devtoolsMicNotice: "开发者工具若停止后仍显示麦克风占用，请确认页面已触发 stop/onStop；最终以真机验证为准。",
    ...READ_ALOUD_INITIAL_STATE
  },

  onLoad(options) {
    const task = store.getTaskById(options.taskId);
    const student = store.getStudentById(options.studentId);

    if (!task || !student) {
      wx.showToast({
        title: "任务不存在",
        icon: "none"
      });
      return;
    }

    if (task.classId && !store.isStudentInClass(student, task.classId)) {
      wx.showToast({
        title: "只能完成所在班级任务",
        icon: "none"
      });
      return;
    }

    if (!store.isTaskAssignedToStudent(task, student.id)) {
      wx.showToast({
        title: "你不需要完成这个任务",
        icon: "none"
      });
      return;
    }

    this.setupRecorder();
    const questions = store.buildChallenge(task);
    const firstQuestion = questions[0] || null;
    this.setData({
      task,
      student,
      questions,
      currentQuestion: firstQuestion,
      pendingQueue: questions.slice(1),
      retryQueue: [],
      passedCardIds: [],
      cardStates: {},
      passedCount: 0,
      totalCards: questions.length,
      currentRound: 1,
      firstRoundWrongCardIds: [],
      firstRoundWrongCount: 0,
      totalRetryCount: 0,
      progress: 0,
      startTime: Date.now()
    }, () => {
      this.autoPlayCurrentQuestion();
    });
  },

  onHide() {
    this.cleanupRecording("onHide");
    this.destroyRecordingPlayback();
  },

  onUnload() {
    this.isLeaving = true;
    this.addRecordingDebugLog("onUnload");
    this.cleanupRecording("onUnload");
    audioPlayer.destroyAudioPlayer();
    this.destroyRecordingPlayback();
  },

  setupRecorder() {
    if (!wx.getRecorderManager) {
      this.addRecordingDebugLog("getRecorderManager unavailable");
      return;
    }

    this.recorderManager = wx.getRecorderManager();
    this.recorderManager.onStart(() => {
      this.addRecordingDebugLog("recorderManager onStart");
    });
    this.recorderManager.onStop((res) => {
      this.addRecordingDebugLog("recorderManager onStop", {
        tempFilePath: (res && res.tempFilePath) || "",
        duration: (res && res.duration) || 0,
        fileSize: (res && res.fileSize) || 0
      });
      this.scoreReadAloud(res || {});
    });
    this.recorderManager.onError((error) => {
      this.addRecordingDebugLog("recorderManager onError", {
        errMsg: error && error.errMsg
      });
      if (this.isLeaving) {
        return;
      }
      this.cleanupRecording("onError", { resetUi: false });
      this.markReadAloudFailed(getErrorMessage(error, "录音失败，请重新录音"));
    });
  },

  addRecordingDebugLog(message, extra) {
    const time = new Date();
    const timeLabel = [
      String(time.getHours()).padStart(2, "0"),
      String(time.getMinutes()).padStart(2, "0"),
      String(time.getSeconds()).padStart(2, "0")
    ].join(":");
    const detail = extra
      ? " " + Object.keys(extra)
        .filter((key) => extra[key] !== undefined && extra[key] !== "")
        .map((key) => key + "=" + extra[key])
        .join(" ")
      : "";
    const log = timeLabel + " " + message + detail;
    const recordingDebugLogs = [log].concat(this.data.recordingDebugLogs || []).slice(0, RECORDING_DEBUG_LIMIT);
    if (!this.isLeaving) {
      this.setData({
        recordingDebugLogs,
        recordingDebugText: log
      });
    }
    if (typeof console !== "undefined" && console.log) {
      console.log("[recording]", log);
    }
  },

  cleanupRecording(reason, options) {
    const shouldResetUi = !(options && options.resetUi === false);
    this.addRecordingDebugLog("cleanupRecording " + reason, {
      status: this.data.speakingStatus
    });

    if (this.recorderManager && this.data.isRecording) {
      try {
        this.addRecordingDebugLog("stopRecord called", { reason });
        this.recorderManager.stop();
      } catch (error) {
        this.addRecordingDebugLog("stopRecord error", {
          errMsg: error && error.errMsg
        });
      }
    }

    this.currentRecordingToken = "";
    this.currentRecordingStartedAt = 0;

    if (!this.isLeaving && shouldResetUi && this.data.isRecording) {
      this.setSpeakingState("idle", {
        speakingMessage: "录音已停止",
        readAloudLastDuration: 0,
        readAloudLastDurationLabel: ""
      });
    }
  },

  autoPlayCurrentQuestion() {
    const question = this.data.currentQuestion;
    if (question && question.taskType === "audio_to_word") {
      this.playCurrentAudio();
    }
  },

  playCurrentAudio() {
    const question = this.data.currentQuestion;
    if (!question) {
      return;
    }

    audioPlayer.playWordAudio({
      word: question.word,
      audioUrl: question.audioUrl
    });
  },

  playLastRecording() {
    const tempFilePath = this.data.recordingTempFilePath;
    if (!tempFilePath) {
      wx.showToast({
        title: "暂无可回放录音",
        icon: "none"
      });
      return;
    }

    if (!wx.createInnerAudioContext) {
      wx.showToast({
        title: "当前环境不支持回放",
        icon: "none"
      });
      return;
    }

    this.destroyRecordingPlayback();
    const context = wx.createInnerAudioContext();
    this.recordingPlaybackContext = context;
    context.src = tempFilePath;
    context.onPlay(() => {
      this.addRecordingDebugLog("recording playback started");
      this.setData({ recordingPlaybackText: "正在回放刚才的录音" });
    });
    context.onEnded(() => {
      this.addRecordingDebugLog("recording playback ended");
      this.setData({ recordingPlaybackText: "录音回放结束" });
      this.destroyRecordingPlayback();
    });
    context.onError((error) => {
      this.addRecordingDebugLog("recording playback error", {
        errMsg: error && error.errMsg
      });
      this.setData({ recordingPlaybackText: "录音回放失败" });
      this.destroyRecordingPlayback();
    });
    context.play();
  },

  destroyRecordingPlayback() {
    if (this.recordingPlaybackContext) {
      this.recordingPlaybackContext.stop();
      this.recordingPlaybackContext.destroy();
      this.recordingPlaybackContext = null;
    }
  },

  selectOption(event) {
    if (this.data.isAnswered) {
      return;
    }
    this.lockAnswer(event.currentTarget.dataset.value);
  },

  onInputChange(event) {
    this.setData({
      inputAnswer: event.detail.value
    });
  },

  submitSpelling() {
    if (this.data.isAnswered) {
      return;
    }

    const value = (this.data.inputAnswer || "").trim();
    if (!value) {
      wx.showToast({
        title: "请先输入答案",
        icon: "none"
      });
      return;
    }
    this.lockAnswer(value);
  },

  toggleRecording() {
    const question = this.data.currentQuestion;
    if (!question || question.taskType !== "read_aloud") {
      return;
    }

    if (this.data.speakingStatus === "scoring") {
      return;
    }

    if (!this.recorderManager) {
      this.markReadAloudFailed("当前环境不支持录音");
      return;
    }

    if (this.data.speakingStatus === "recording") {
      this.stopRecording();
      return;
    }

    if (wx.getSetting) {
      wx.getSetting({
        success: (settingRes) => {
          const authorized = !!(settingRes.authSetting && settingRes.authSetting["scope.record"]);
          this.addRecordingDebugLog("record permission checked", {
            authorized
          });
          if (authorized) {
            this.startRecording();
            return;
          }
          this.requestRecordPermission();
        },
        fail: () => {
          this.requestRecordPermission();
        }
      });
      return;
    }

    this.requestRecordPermission();
  },

  requestRecordPermission() {
    this.addRecordingDebugLog("request scope.record");
    wx.authorize({
      scope: "scope.record",
      success: () => {
        this.addRecordingDebugLog("scope.record authorized");
        this.startRecording();
      },
      fail: () => {
        this.addRecordingDebugLog("scope.record denied");
        this.markReadAloudFailed("需要录音权限才能完成朗读，请在设置里开启麦克风权限");
      }
    });
  },

  startRecording() {
    const question = this.data.currentQuestion;
    if (!question || question.taskType !== "read_aloud") {
      return;
    }

    this.cleanupRecording("before-start", { resetUi: false });

    const attemptCount = this.data.readAloudAttemptCount + 1;
    const token = question.id + "_" + Date.now() + "_" + attemptCount;

    this.currentRecordingToken = token;
    this.currentRecordingStartedAt = Date.now();
    this.setSpeakingState("recording", {
      isAnswered: false,
      answerCorrect: false,
      speakingScore: null,
      speakingScoreLabel: "",
      hasSpeakingScore: false,
      speakingPassed: false,
      speakingMessage: "正在录音",
      readAloudAttemptCount: attemptCount,
      readAloudLastDuration: 0,
      readAloudLastDurationLabel: ""
    });

    try {
      this.addRecordingDebugLog("startRecord called", {
        token,
        word: question.word
      });
      this.recorderManager.start({
        duration: 5000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: "mp3"
      });
    } catch (error) {
      this.addRecordingDebugLog("startRecord error", {
        errMsg: error && error.errMsg
      });
      this.markReadAloudFailed("录音开始失败，请重新录音", {
        token
      });
    }
  },

  stopRecording() {
    this.addRecordingDebugLog("stopRecord called", {
      token: this.currentRecordingToken
    });
    this.setSpeakingState("scoring", {
      speakingMessage: "正在评分"
    });

    try {
      this.recorderManager.stop();
    } catch (error) {
      this.addRecordingDebugLog("stopRecord error", {
        errMsg: error && error.errMsg
      });
      this.markReadAloudFailed("录音停止失败，请重新录音", {
        token: this.currentRecordingToken
      });
    }
  },

  scoreReadAloud(recording) {
    const question = this.data.currentQuestion;
    const token = this.currentRecordingToken;
    if (!question || question.taskType !== "read_aloud" || this.isLeaving) {
      return;
    }

    const startedAt = this.currentRecordingStartedAt || Date.now();
    const duration = Number(recording.duration || 0) || Math.max(0, Date.now() - startedAt);
    const tempFilePath = recording.tempFilePath || "";
    const fileSize = Number(recording.fileSize || 0);
    const durationLabel = formatDurationMs(duration);

    this.setSpeakingState("scoring", {
      speakingMessage: "正在评分",
      readAloudLastDuration: duration,
      readAloudLastDurationLabel: durationLabel,
      recordingTempFilePath: tempFilePath,
      recordingFileSizeLabel: fileSize ? fileSize + " B" : "未知"
    });

    const invalidMessage = this.getInvalidRecordingMessage(question, {
      tempFilePath,
      duration,
      fileSize
    });
    if (invalidMessage) {
      this.markReadAloudFailed(invalidMessage, {
        duration,
        token
      });
      return;
    }

    this.requestReadAloudScore(question, {
      tempFilePath,
      duration,
      token
    }).then((result) => {
      if (this.isLeaving || token !== this.currentRecordingToken) {
        return;
      }

      const score = result.score;
      if (score >= READ_ALOUD_PASS_SCORE) {
        this.commitReadAloudAnswer(score, {
          duration,
          fileID: result.fileID || "",
          token
        });
        return;
      }

      this.markReadAloudFailed("再读一次试试", {
        score,
        duration,
        token
      });
    }).catch((error) => {
      if (this.isLeaving || token !== this.currentRecordingToken) {
        return;
      }
      this.markReadAloudFailed(getErrorMessage(error, "评分失败，请重新录音"), {
        duration,
        token
      });
    });
  },

  getInvalidRecordingMessage(question, recording) {
    if (!recording.tempFilePath) {
      return "没有录到声音，请重新读一次";
    }
    if (recording.fileSize && recording.fileSize < 400) {
      return "没有录到声音，请重新读一次";
    }
    if (recording.duration < READ_ALOUD_MIN_DURATION_MS) {
      return "录音太短，请完整读出单词";
    }
    if (recording.duration < getExpectedReadDuration(question.word)) {
      return "录音太短，请完整读出单词";
    }
    return "";
  },

  requestReadAloudScore(question, recording) {
    return new Promise((resolve, reject) => {
      if (
        typeof wx === "undefined" ||
        !wx.cloud ||
        !wx.cloud.uploadFile ||
        !wx.cloud.callFunction ||
        !cloudService.canUseCloudUpload()
      ) {
        this.addRecordingDebugLog("score fallback local", {
          reason: "cloud unavailable"
        });
        resolve({
          score: READ_ALOUD_PASS_SCORE,
          fileID: "",
          localFallback: true
        });
        return;
      }

      const student = this.data.student || {};
      const cloudPath = [
        "read-aloud",
        student.id || "student",
        question.id,
        recording.token + ".mp3"
      ].join("/");

      wx.cloud.uploadFile({
        cloudPath,
        filePath: recording.tempFilePath,
        success: (uploadRes) => {
          const fileID = uploadRes && uploadRes.fileID;
          if (!fileID) {
            reject(new Error("上传失败，请重新录音"));
            return;
          }

          wx.cloud.callFunction({
            name: "scoreReadAloud",
            data: {
              fileID,
              targetWord: question.word,
              word: question.word,
              challengeId: question.id,
              duration: recording.duration
            },
            success: (scoreRes) => {
              this.addRecordingDebugLog("score function returned");
              const score = parseScoreResult(scoreRes && scoreRes.result);
              if (score === null) {
                reject(new Error("评分接口返回异常，请重新录音"));
                return;
              }
              resolve({
                score,
                fileID
              });
            },
            fail: () => {
              this.addRecordingDebugLog("score function failed");
              reject(new Error("评分失败，请重新录音"));
            }
          });
        },
        fail: () => {
          this.addRecordingDebugLog("upload failed");
          reject(new Error("上传失败，请重新录音"));
        }
      });
    });
  },

  getPassedPatch(question) {
    if (!question) {
      return {};
    }

    const passedCardIds = this.data.passedCardIds.indexOf(question.id) >= 0
      ? this.data.passedCardIds.slice()
      : this.data.passedCardIds.concat(question.id);
    const cardStates = {
      ...this.data.cardStates,
      [question.id]: "passed"
    };
    const passedCount = passedCardIds.length;
    const totalCards = this.data.totalCards || this.data.questions.length || 1;

    return {
      passedCardIds,
      cardStates,
      passedCount,
      progress: Math.round((passedCount / totalCards) * 100)
    };
  },

  getRetryPatch(question, options) {
    if (!question) {
      return {};
    }

    const shouldQueue = !(options && options.immediateRetry);
    const retryQueue = this.data.retryQueue.slice();
    const firstRoundWrongCardIds = this.data.firstRoundWrongCardIds.slice();
    if (shouldQueue && !retryQueue.some((item) => item.id === question.id)) {
      retryQueue.push(question);
    }
    if (this.data.currentRound === 1 && firstRoundWrongCardIds.indexOf(question.id) < 0) {
      firstRoundWrongCardIds.push(question.id);
    }

    return {
      retryQueue,
      cardStates: {
        ...this.data.cardStates,
        [question.id]: shouldQueue ? "retry" : "failed"
      },
      firstRoundWrongCardIds,
      firstRoundWrongCount: firstRoundWrongCardIds.length,
      totalRetryCount: this.data.totalRetryCount + 1
    };
  },

  getNextQuestionPatch() {
    let pendingQueue = this.data.pendingQueue.slice();
    let retryQueue = this.data.retryQueue.slice();
    let currentRound = this.data.currentRound;
    let nextQuestion = pendingQueue.shift() || null;

    if (!nextQuestion && retryQueue.length) {
      currentRound += 1;
      nextQuestion = retryQueue.shift();
      pendingQueue = retryQueue;
      retryQueue = [];
    }

    if (!nextQuestion) {
      return null;
    }

    return {
      currentIndex: this.data.currentIndex + 1,
      currentQuestion: nextQuestion,
      pendingQueue,
      retryQueue,
      currentRound,
      selectedOption: "",
      inputAnswer: "",
      isAnswered: false,
      answerCorrect: false,
      ...READ_ALOUD_INITIAL_STATE
    };
  },

  markReadAloudFailed(message, options) {
    const question = this.data.currentQuestion;
    const token = options && options.token;
    if (token && token !== this.currentRecordingToken) {
      return;
    }

    const score = options && isNumber(options.score) ? options.score : null;
    const duration = options && isNumber(options.duration) ? options.duration : this.data.readAloudLastDuration;
    const nextBestScore = score === null
      ? this.data.readAloudBestScore
      : Math.max(score, this.data.readAloudBestScore || 0);
    const failedAnswer = question ? {
      challengeId: question.id,
      questionId: question.id,
      wordId: question.wordId,
      word: question.word,
      meaning: question.meaning,
      type: question.taskType,
      taskType: question.taskType,
      userAnswer: score === null ? "录音未通过" : score + " 分",
      correctAnswer: "达到 " + READ_ALOUD_PASS_SCORE + " 分",
      isCorrect: false,
      isPassed: false,
      score,
      duration,
      finishedAt: Date.now()
    } : null;
    const nextAnswers = failedAnswer
      ? this.data.answers.concat(failedAnswer)
      : this.data.answers;

    this.setSpeakingState("failed", {
      answers: nextAnswers,
      ...this.getRetryPatch(question, { immediateRetry: true }),
      isAnswered: false,
      answerCorrect: false,
      speakingPassed: false,
      speakingScore: score,
      speakingScoreLabel: score === null ? "" : String(score),
      hasSpeakingScore: score !== null,
      speakingMessage: message,
      readAloudBestScore: nextBestScore,
      readAloudBestScoreLabel: nextBestScore === null ? "暂无" : String(nextBestScore),
      readAloudLastDuration: duration || 0,
      readAloudLastDurationLabel: formatDurationMs(duration)
    });
  },

  commitReadAloudAnswer(score, recording) {
    const question = this.data.currentQuestion;
    if (!question || question.taskType !== "read_aloud") {
      return;
    }

    const bestScore = Math.max(score, this.data.readAloudBestScore || 0);
    const answer = {
      challengeId: question.id,
      questionId: question.id,
      wordId: question.wordId,
      word: question.word,
      meaning: question.meaning,
      type: question.taskType,
      taskType: question.taskType,
      userAnswer: question.word,
      correctAnswer: question.correctAnswer,
      isCorrect: true,
      isPassed: true,
      score,
      attemptCount: this.data.readAloudAttemptCount,
      lastScore: score,
      bestScore,
      recordingDuration: recording.duration,
      fileID: recording.fileID || "",
      finishedAt: Date.now()
    };
    const nextAnswers = this.data.answers.concat(answer);

    this.setSpeakingState("passed", {
      answers: nextAnswers,
      ...this.getPassedPatch(question),
      selectedOption: question.word,
      isAnswered: true,
      answerCorrect: true,
      speakingPassed: true,
      speakingScore: score,
      speakingScoreLabel: String(score),
      hasSpeakingScore: true,
      speakingMessage: "发音通过",
      readAloudBestScore: bestScore,
      readAloudBestScoreLabel: String(bestScore),
      readAloudLastDuration: recording.duration,
      readAloudLastDurationLabel: formatDurationMs(recording.duration)
    });
  },

  lockAnswer(rawValue, speakingScore) {
    const question = this.data.currentQuestion;
    if (!question) {
      return;
    }

    const answerValue = String(rawValue || "").trim();
    const isCorrect = answerValue.toLowerCase() === String(question.correctAnswer).trim().toLowerCase();
    const nextAnswers = this.data.answers.concat({
      challengeId: question.id,
      questionId: question.id,
      wordId: question.wordId,
      word: question.word,
      meaning: question.meaning,
      type: question.taskType,
      taskType: question.taskType,
      userAnswer: answerValue,
      correctAnswer: question.correctAnswer,
      isCorrect,
      isPassed: isCorrect,
      score: typeof speakingScore === "number" ? speakingScore : null,
      finishedAt: Date.now()
    });

    this.setData({
      answers: nextAnswers,
      ...(isCorrect ? this.getPassedPatch(question) : this.getRetryPatch(question)),
      selectedOption: answerValue,
      isAnswered: true,
      answerCorrect: isCorrect
    });

    if (question.taskType === "en_to_zh" || question.taskType === "zh_to_en") {
      this.playCurrentAudio();
    }
  },

  nextQuestion() {
    const question = this.data.currentQuestion;
    if (question && question.taskType === "read_aloud") {
      if (
        this.data.speakingStatus !== "passed" ||
        !this.data.speakingPassed ||
        !isNumber(this.data.speakingScore) ||
        this.data.speakingScore < READ_ALOUD_PASS_SCORE ||
        !this.data.isAnswered
      ) {
        wx.showToast({
          title: "达到 60 分后才能进入下一题",
          icon: "none"
        });
        return;
      }
    } else if (!this.data.isAnswered) {
      wx.showToast({
        title: "请先完成当前任务",
        icon: "none"
      });
      return;
    }

    const nextPatch = this.getNextQuestionPatch();
    if (!nextPatch) {
      if (this.data.passedCount < this.data.totalCards) {
        wx.showToast({
          title: "还有错题需要重做",
          icon: "none"
        });
        return;
      }
      this.finishChallenge();
      return;
    }

    this.cleanupRecording("switch-question", { resetUi: false });
    this.currentRecordingToken = "";
    this.currentRecordingStartedAt = 0;
    this.setData({
      ...nextPatch
    }, () => {
      this.autoPlayCurrentQuestion();
    });
  },

  finishChallenge() {
    const correctCount = this.data.passedCount;
    const totalCount = this.data.totalCards || this.data.questions.length;
    if (correctCount < totalCount || this.data.pendingQueue.length || this.data.retryQueue.length) {
      wx.showToast({
        title: "还有错题需要重做",
        icon: "none"
      });
      return;
    }

    const score = totalCount ? Math.round((correctCount / totalCount) * 100) : 0;
    const durationSec = Math.max(1, Math.round((Date.now() - this.data.startTime) / 1000));
    const wrongWords = this.data.answers
      .filter((item) => !item.isPassed)
      .map((item) => ({
        challengeId: item.challengeId,
        word: item.word,
        meaning: item.meaning,
        taskType: item.taskType,
        taskTitle: this.getTaskLabel(item.taskType),
        correctAnswer: item.correctAnswer,
        userAnswer: item.userAnswer || "未作答"
      }));

    store.saveSubmission({
      taskId: this.data.task.id,
      classId: this.data.task.classId,
      studentId: this.data.student.id,
      studentName: this.data.student.name,
      score,
      correctCount,
      totalCount,
      durationSec,
      wrongWords,
      challengeResults: this.data.answers,
      firstRoundWrongCount: this.data.firstRoundWrongCount,
      totalRetryCount: this.data.totalRetryCount,
      allPassed: true
    });

    wx.redirectTo({
      url: "/pages/result/result?taskId=" + this.data.task.id + "&studentId=" + this.data.student.id
    });
  },

  setSpeakingState(status, extra) {
    this.setData({
      ...getSpeakingUi(status),
      ...(extra || {})
    });
  },

  getTaskLabel(taskType) {
    return TASK_TYPE_LABELS[taskType] || "词汇任务";
  }
});
