const store = require("../../utils/store");

Page({
  data: {
    classInfo: null,
    currentStudent: null,
    taskCards: [],
    completedCount: 0,
    accountId: ""
  },

  onLoad(options) {
    this.classId = options.classId || "";
    this.accountId = options.accountId || "";
  },

  onShow() {
    this.loadPage();
  },

  loadPage() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    const currentStudent = store.getStudentProfileByAccountId(account.id);
    if (!currentStudent || !currentStudent.joinedClassIds || !currentStudent.joinedClassIds.length) {
      wx.redirectTo({
        url: "/pages/studentHome/studentHome?role=student&accountId=" + account.id
      });
      return;
    }

    const classId = this.classId || currentStudent.joinedClassId || currentStudent.joinedClassIds[0];
    const classInfo = store.getClassById(classId);
    if (!classInfo || !store.isStudentInClass(currentStudent, classInfo.id)) {
      this.setData({
        classInfo: null,
        currentStudent,
        taskCards: [],
        completedCount: 0,
        accountId: this.accountId || account.id
      });
      return;
    }

    const taskCards = store.getTasksByClassIdForStudent(classInfo.id, currentStudent.id).map((task) => {
      const submission = currentStudent ? store.getSubmission(task.id, currentStudent.id) : null;
      return {
        ...task,
        submission,
        done: !!submission
      };
    });

    this.setData({
      classInfo,
      currentStudent,
      taskCards,
      completedCount: taskCards.filter((item) => item.done).length,
      accountId: this.accountId || account.id
    });
  },

  openTask(event) {
    const taskId = event.currentTarget.dataset.taskId;
    const done = event.currentTarget.dataset.done;
    const studentId = this.data.currentStudent && this.data.currentStudent.id;

    if (!studentId) {
      return;
    }

    if (done) {
      wx.navigateTo({
        url: "/pages/result/result?taskId=" + taskId + "&studentId=" + studentId
      });
      return;
    }

    wx.navigateTo({
      url: "/pages/challenge/challenge?taskId=" + taskId + "&studentId=" + studentId
    });
  },

  goClassDetail() {
    if (!this.data.classInfo) {
      return;
    }

    wx.navigateTo({
      url: "/pages/studentClass/studentClass?role=student&classId=" + this.data.classInfo.id
        + "&accountId=" + this.data.accountId
    });
  }
});
