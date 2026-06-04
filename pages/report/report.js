const store = require("../../utils/store");

Page({
  data: {
    tasks: [],
    selectedTaskIndex: 0,
    report: null,
    classInfo: null,
    accountId: ""
  },

  onLoad(options) {
    this.pendingTaskId = options.taskId || "";
    this.classId = options.classId || "";
    this.accountId = options.accountId || "";
  },

  onShow() {
    this.loadReport();
  },

  loadReport() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }
    const teacherProfile = store.ensureTeacherProfile(account.id);

    let classId = this.classId;
    if (this.pendingTaskId) {
      const pendingTask = store.getTaskById(this.pendingTaskId);
      classId = pendingTask ? pendingTask.classId : classId;
    }

    let tasks = [];
    if (classId) {
      tasks = store.isTeacherMember(classId, teacherProfile.id)
        ? store.getTasksByClassId(classId)
        : [];
    } else {
      const classIds = store.getTeacherClassesByAccountId(account.id).map((item) => item.id);
      tasks = store.getTasks().filter((task) => classIds.indexOf(task.classId) >= 0);
    }
    this.classId = classId;

    let selectedTaskIndex = this.data.selectedTaskIndex;

    if (this.pendingTaskId) {
      const matchedIndex = tasks.findIndex((item) => item.id === this.pendingTaskId);
      if (matchedIndex >= 0) {
        selectedTaskIndex = matchedIndex;
      }
      this.pendingTaskId = "";
    }

    if (selectedTaskIndex >= tasks.length) {
      selectedTaskIndex = 0;
    }

    const report = tasks.length ? store.getTaskReport(tasks[selectedTaskIndex].id) : null;
    this.setData({
      tasks,
      selectedTaskIndex,
      report,
      classInfo: report ? report.classInfo : classId ? store.getClassById(classId) : null,
      accountId: this.accountId || account.id
    });
  },

  onTaskChange(event) {
    const selectedTaskIndex = Number(event.detail.value);
    const task = this.data.tasks[selectedTaskIndex];
    this.setData({
      selectedTaskIndex,
      report: task ? store.getTaskReport(task.id) : null,
      classInfo: task ? store.getClassById(task.classId) : this.data.classInfo
    });
  }
});
