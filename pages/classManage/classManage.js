const store = require("../../utils/store");

Page({
  data: {
    role: "",
    classId: "",
    accountId: "",
    classes: [],
    emptyText: ""
  },

  onLoad(options) {
    this.role = options.role || "";
    this.classId = options.classId || "";
    this.accountId = options.accountId || "";
    this.setData({
      role: this.role,
      classId: this.classId,
      accountId: this.accountId
    });
  },

  onShow() {
    this.loadClasses();
  },

  loadClasses() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    if (this.role === "teacher") {
      const teacherProfile = store.ensureTeacherProfile(account.id);
      const classes = store.getTeacherClassesByAccountId(account.id).map((classInfo) => ({
        ...classInfo,
        teacherName: classInfo.teacherMembers && classInfo.teacherMembers[0]
          ? classInfo.teacherMembers[0].teacherName
          : "老师",
        studentCount: (classInfo.studentIds || []).length,
        sideLabel: store.isClassOwner(classInfo.id, teacherProfile.id) ? "创建者" : "协作老师",
        canEdit: store.canEditClass(classInfo.id, teacherProfile.id),
        canLeaveAsTeacher: store.isTeacherMember(classInfo.id, teacherProfile.id) &&
          !store.isClassOwner(classInfo.id, teacherProfile.id)
      }));
      const activeClassId = classes.some((classInfo) => classInfo.id === this.classId)
        ? this.classId
        : (classes[0] ? classes[0].id : "");
      this.classId = activeClassId;
      this.setData({
        role: this.role,
        classId: activeClassId,
        accountId: this.accountId || account.id,
        classes,
        emptyText: "还没有班级"
      });
      return;
    }

    const classes = store.getJoinedClassesByStudentAccountId(account.id).map((classInfo) => ({
      ...classInfo,
      studentCount: (classInfo.studentIds || []).length,
      sideLabel: classInfo.studentName || "学生"
    }));
    const activeClassId = classes.some((classInfo) => classInfo.id === this.classId)
      ? this.classId
      : (classes[0] ? classes[0].id : "");
    this.classId = activeClassId;
    this.setData({
      role: "student",
      classId: activeClassId,
      accountId: this.accountId || account.id,
      classes,
      emptyText: "还没有加入班级"
    });
  },

  openClass(event) {
    const classId = event.currentTarget.dataset.classId;
    const query = "?role=" + this.data.role
      + "&classId=" + classId
      + "&accountId=" + this.data.accountId;
    wx.redirectTo({
      url: this.data.role === "teacher"
        ? "/pages/classDetail/classDetail" + query
        : "/pages/studentClass/studentClass" + query
    });
  },

  editClass(event) {
    const classId = event.currentTarget.dataset.classId;
    wx.navigateTo({
      url: "/pages/classEdit/classEdit?role=teacher&classId=" + classId
        + "&accountId=" + this.data.accountId
    });
  },

  deleteClass(event) {
    const classId = event.currentTarget.dataset.classId;
    const account = store.getCurrentAccount();
    const teacherProfile = account ? store.getTeacherProfileByAccountId(account.id) : null;
    if (!teacherProfile || !store.canEditClass(classId, teacherProfile.id)) {
      wx.showToast({
        title: "只有创建老师可以操作",
        icon: "none"
      });
      return;
    }

    wx.showModal({
      title: "确认删除班级？",
      content: "删除后该班级的任务和学生关系将无法在当前列表中继续使用。",
      confirmText: "确认删除",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        store.softDeleteClass(classId);
        this.loadClasses();
      }
    });
  },

  leaveTeacherClass(event) {
    const classId = event.currentTarget.dataset.classId;
    const account = store.getCurrentAccount();
    const teacherProfile = account ? store.getTeacherProfileByAccountId(account.id) : null;
    if (!teacherProfile || !store.isTeacherMember(classId, teacherProfile.id)) {
      wx.showToast({
        title: "当前账号无法退出该班级",
        icon: "none"
      });
      return;
    }
    if (store.isClassOwner(classId, teacherProfile.id)) {
      wx.showToast({
        title: "创建老师不能退出自己的班级",
        icon: "none"
      });
      return;
    }

    wx.showModal({
      title: "确定退出班级？",
      content: "退出后将不能继续查看该班级的学生完成情况。",
      confirmText: "确认退出",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        store.removeTeacherFromClass(classId, teacherProfile.id);
        if (this.classId === classId) {
          this.classId = "";
        }
        this.loadClasses();
      }
    });
  },

  leaveClass(event) {
    const classId = event.currentTarget.dataset.classId;
    const account = store.getCurrentAccount();
    const studentProfile = account ? store.getStudentProfileByAccountId(account.id) : null;
    if (!studentProfile) {
      return;
    }

    wx.showModal({
      title: "确认退出班级？",
      content: "退出后你将不能继续查看这个班级的任务。",
      confirmText: "确认退出",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        store.leaveClass(classId, studentProfile.id);
        if (this.classId === classId) {
          this.classId = "";
        }
        this.loadClasses();
      }
    });
  },

  goCreateClass() {
    wx.navigateTo({
      url: "/pages/classCreate/classCreate?role=teacher&accountId=" + this.data.accountId
    });
  },

  goJoinClass() {
    if (this.data.role === "teacher") {
      wx.navigateTo({
        url: "/pages/teacherJoin/teacherJoin?role=teacher&accountId=" + this.data.accountId
      });
      return;
    }

    wx.navigateTo({
      url: "/pages/studentJoin/studentJoin?role=student&accountId=" + this.data.accountId
    });
  }
});
