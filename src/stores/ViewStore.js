import { defineStore } from 'pinia';

export const useViewStore = defineStore('view', {
  state: () => ({
    chapterListVisible: false,
    introPanelVisible: true
  })
});