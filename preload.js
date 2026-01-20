import { contextBridge, desktopCapturer, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSources: () => desktopCapturer.getSources({ types: ['screen'] }),
  saveRecording: (arrayBuffer) => ipcRenderer.invoke('save-recording', arrayBuffer)
});
