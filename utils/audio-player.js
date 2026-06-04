let audioContext = null;

function ensureAudioContext() {
  if (!audioContext && typeof wx !== "undefined" && wx.createInnerAudioContext) {
    audioContext = wx.createInnerAudioContext();
    audioContext.obeyMuteSwitch = false;
  }
  return audioContext;
}

function showAudioToast(title) {
  if (typeof wx !== "undefined" && wx.showToast) {
    wx.showToast({
      title,
      icon: "none"
    });
  }
}

function playWordAudio(wordItem) {
  const audioUrl = wordItem && wordItem.audioUrl;
  if (!audioUrl) {
    showAudioToast("读音暂不可用");
    return;
  }

  const context = ensureAudioContext();
  if (!context) {
    showAudioToast("当前环境不支持音频播放");
    return;
  }

  context.stop();
  context.src = audioUrl;
  context.play();
}

function destroyAudioPlayer() {
  if (audioContext) {
    audioContext.stop();
    audioContext.destroy();
    audioContext = null;
  }
}

module.exports = {
  destroyAudioPlayer,
  playWordAudio
};
