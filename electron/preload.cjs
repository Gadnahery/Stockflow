const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('stockflowDesktop', {
  platform: process.platform,
  isDesktop: true,
})
