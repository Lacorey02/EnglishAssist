const store = require("../../utils/store");

Page({
  data: {
    task: null,
    student: null,
    submission: null,
    report: null,
    rankLabel: "暂无"
  },

  onLoad(options) {
    this.loadResult(options.taskId, options.studentId);
  },

  loadResult(taskId, studentId) {
    const task = store.getTaskById(taskId);
    const student = store.getStudentById(studentId);
    const submission = store.getSubmission(taskId, studentId);
    const report = store.getTaskReport(taskId);

    let rankLabel = "暂无";
    if (report && submission) {
      const ranked = report.rows
        .filter((item) => !!item.submission)
        .sort((left, right) => right.submission.score - left.submission.score);
      const rankIndex = ranked.findIndex((item) => item.student.id === studentId);
      if (rankIndex >= 0) {
        rankLabel = "第 " + (rankIndex + 1) + " / " + ranked.length + " 名";
      }
    }

    this.setData({
      task,
      student,
      submission,
      report,
      rankLabel
    });
  },

  goStudent() {
    const classId = this.data.task ? this.data.task.classId : "";
    wx.navigateTo({
      url: "/pages/student/student?classId=" + classId
    });
  },

  goClass() {
    if (!this.data.task) {
      return;
    }
    wx.navigateTo({
      url: "/pages/studentClass/studentClass?classId=" + this.data.task.classId
    });
  }
});
