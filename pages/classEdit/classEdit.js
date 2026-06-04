const store = require("../../utils/store");

Page({
  data: {
    pageState: "loading",
    classInfo: null,
    className: "",
    classCode: "",
    students: [],
    teachers: [],
    accountId: "",
    errorText: ""
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

    const teacherProfile = store.ensureTeacherProfile(account.id);
    const classInfo = store.getClassById(this.classId);
    if (!classInfo) {
      this.setData({
        pageState: "error",
        classInfo: null,
        accountId: this.accountId || account.id,
        errorText: "班级不存在，或已被删除。"
      });
      return;
    }

    if (!store.canEditClass(classInfo.id, teacherProfile.id)) {
      this.setData({
        pageState: "forbidden",
        classInfo,
        accountId: this.accountId || account.id,
        errorText: "只有创建老师可以编辑班级"
      });
      return;
    }

    const students = store.getStudentsByClassId(classInfo.id).map((student) => {
      const accountProfile = store.getAccountProfile(student.accountId);
      return {
        ...student,
        accountName: accountProfile ? accountProfile.username : ""
      };
    });

    this.setData({
      pageState: "ready",
      classInfo,
      className: classInfo.name,
      classCode: classInfo.code,
      students,
      teachers: store.getTeacherMembersByClassId(classInfo.id),
      accountId: this.accountId || account.id,
      errorText: ""
    });
  },

  onNameInput(event) {
    this.setData({ className: event.detail.value });
  },

  onCodeInput(event) {
    this.setData({ classCode: store.normalizeClassCode(event.detail.value) });
  },

  saveClass() {
    const account = store.getCurrentAccount();
    const teacherProfile = account ? store.getTeacherProfileByAccountId(account.id) : null;
    const name = (this.data.className || "").trim();
    const code = store.normalizeClassCode(this.data.classCode);

    if (!teacherProfile || !this.data.classInfo) {
      return;
    }
    if (name.length < 2 || name.length > 30) {
      wx.showToast({
        title: "班级名需为 2 到 30 个字符",
        icon: "none"
      });
      return;
    }
    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      wx.showToast({
        title: "代号需为 4 到 8 位大写字母或数字",
        icon: "none"
      });
      return;
    }
    if (!store.isClassCodeAvailable(code, this.data.classInfo.id)) {
      wx.showToast({
        title: "班级代号已存在，请更换一个代号",
        icon: "none"
      });
      return;
    }

    try {
      store.updateClassInfo(this.data.classInfo.id, {
        name,
        code,
        actorTeacherProfileId: teacherProfile.id
      });
      wx.showToast({
        title: "已保存",
        icon: "success"
      });
      this.loadPage();
    } catch (error) {
      wx.showToast({
        title: error.message === "CLASS_CODE_TAKEN" ? "班级代号已存在，请更换一个代号" : "保存失败，请重试",
        icon: "none"
      });
    }
  },

  removeStudent(event) {
    const studentId = event.currentTarget.dataset.studentId;
    wx.showModal({
      title: "确认踢出学生？",
      content: "踢出后，该学生将不能继续查看这个班级的任务。",
      confirmText: "确认踢出",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        store.removeStudentFromClass(this.data.classInfo.id, studentId);
        this.loadPage();
      }
    });
  },

  removeTeacher(event) {
    const teacherProfileId = event.currentTarget.dataset.teacherProfileId;
    wx.showModal({
      title: "确认移除老师？",
      content: "移除后，该老师将不能继续查看这个班级的信息和完成情况。",
      confirmText: "确认移除",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          store.removeTeacherFromClass(this.data.classInfo.id, teacherProfileId);
          this.loadPage();
        } catch (error) {
          wx.showToast({
            title: "不能移除创建者",
            icon: "none"
          });
        }
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
